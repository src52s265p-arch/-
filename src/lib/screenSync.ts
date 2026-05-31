import { useEffect, useState } from 'react';
import { getAudioDriveSnapshot, setRemoteAudioEnabled, setRemoteAudioSnapshot } from '@/lib/audioDrive';
import { useStore } from '@/store/useStore';

type SyncRole = 'controller' | 'screen';
const SYNC_INTERVAL_MS = 33;

const selectSyncState = (
  audioSnapshot = getAudioDriveSnapshot(useStore.getState().audioDriveMode),
  syncedScreenSignal?: number,
) => {
  const state = useStore.getState();
  return {
    activeScreenId: state.activeScreenId,
    visualScreens: state.visualScreens,
    outputMode: state.outputMode,
    screenTransitionStyle: state.screenTransitionStyle,
    screenTransitionAmount: state.screenTransitionAmount,
    screenAudioReactive: state.screenAudioReactive,
    syncedScreenSignal: syncedScreenSignal ?? state.syncedScreenSignal,
    currentScene: state.currentScene,
    baseColor: state.baseColor,
    secondaryColor: state.secondaryColor,
    accentColor: state.accentColor,
    bgColor: state.bgColor,
    bloomIntensity: state.bloomIntensity,
    bloomThreshold: state.bloomThreshold,
    glitchActive: state.glitchActive,
    rgbSplitAmount: state.rgbSplitAmount,
    distortion: state.distortion,
    speed: state.speed,
    chaos: state.chaos,
    saturation: state.saturation,
    contrast: state.contrast,
    brightness: state.brightness,
    gamma: state.gamma,
    exposure: state.exposure,
    textInput: state.textInput,
    textAnimStyle: state.textAnimStyle,
    textGlow: state.textGlow,
    textSpeed: state.textSpeed,
    textReactive: state.textReactive,
    textFontSize: state.textFontSize,
    textFontWeight: state.textFontWeight,
    textLetterSpacing: state.textLetterSpacing,
    autoVjEnabled: state.autoVjEnabled,
    audioFxReactive: state.audioFxReactive,
    musicCameraEnabled: state.musicCameraEnabled,
    musicCameraAmount: state.musicCameraAmount,
    transitionEnergy: state.transitionEnergy,
    audioDriveMode: state.audioDriveMode,
    liveControls: state.liveControls,
    audioSnapshot,
  };
};

const selectSignalState = () => {
  const state = useStore.getState();
  const audioSnapshot = getAudioDriveSnapshot(state.audioDriveMode);
  const syncedScreenSignal = state.screenAudioReactive
    ? Math.min(1, state.screenTransitionAmount * (0.45 + audioSnapshot.energy * 0.55 + audioSnapshot.beat * 0.45 + audioSnapshot.spectralFlux * 0.35 + audioSnapshot.transient * 0.25))
    : state.screenTransitionAmount;

  return { audioSnapshot, syncedScreenSignal };
};

const getSyncUrl = () => {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/sync`;
};

const isLanRuntime = (hostname: string) =>
  hostname.endsWith('.local') ||
  /^10\./.test(hostname) ||
  /^192\.168\./.test(hostname) ||
  /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname);

const isLocalRuntime = () => {
  const hostname = window.location.hostname;
  return ['localhost', '127.0.0.1', '0.0.0.0'].includes(hostname) || isLanRuntime(hostname);
};

export function useScreenSync(role: SyncRole, screenId?: string) {
  const [connected, setConnected] = useState(false);
  const [clientCount, setClientCount] = useState(0);

  useEffect(() => {
    if (!isLocalRuntime()) {
      setConnected(false);
      setClientCount(0);
      return;
    }

    let socket: WebSocket | null = null;
    let unsubscribe: (() => void) | undefined;
    let reconnectTimer = 0;
    let signalFrame = 0;
    let lastSyncAt = 0;
    let stopped = false;

    const send = (message: unknown) => {
      if (socket?.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(message));
      }
    };

    const sendControllerState = () => {
      send({ type: 'controller-state', payload: selectSyncState() });
    };

    const updateSignal = () => {
      const now = performance.now();
      if (now - lastSyncAt >= SYNC_INTERVAL_MS) {
        lastSyncAt = now;
        send({ type: 'controller-signal', payload: selectSignalState() });
      }
      signalFrame = window.requestAnimationFrame(updateSignal);
    };

    const connect = () => {
      socket = new WebSocket(getSyncUrl());

      socket.addEventListener('open', () => {
        setConnected(true);
        if (role === 'screen') {
          setRemoteAudioEnabled(true);
          send({ type: 'screen-hello', payload: { screenId } });
        } else {
          sendControllerState();
          unsubscribe = useStore.subscribe(sendControllerState);
          signalFrame = window.requestAnimationFrame(updateSignal);
        }
      });

      socket.addEventListener('message', (event) => {
        try {
          const message = JSON.parse(event.data);

          if (message.type === 'sync-status') {
            setClientCount(message.payload?.connected || 0);
          }

          if (role === 'screen' && message.type === 'screen-state') {
            if (message.payload?.audioSnapshot) {
              setRemoteAudioSnapshot(message.payload.audioSnapshot, message.payload.syncedScreenSignal);
            }
            useStore.getState().applyRemoteSyncState(message.payload);
          }

          if (role === 'screen' && message.type === 'screen-signal') {
            if (message.payload?.audioSnapshot) {
              setRemoteAudioSnapshot(message.payload.audioSnapshot, message.payload.syncedScreenSignal);
            }
            if (typeof message.payload?.syncedScreenSignal === 'number') {
              useStore.getState().setSyncedScreenSignal(message.payload.syncedScreenSignal);
            }
          }
        } catch {
          // Ignore malformed sync messages from older tabs.
        }
      });

      socket.addEventListener('close', () => {
        setConnected(false);
        unsubscribe?.();
        unsubscribe = undefined;
        window.cancelAnimationFrame(signalFrame);

        if (!stopped) {
          reconnectTimer = window.setTimeout(connect, 1200);
        }
      });
    };

    connect();

    return () => {
      stopped = true;
      unsubscribe?.();
      window.cancelAnimationFrame(signalFrame);
      window.clearTimeout(reconnectTimer);
      if (role === 'screen') {
        setRemoteAudioEnabled(false);
      }
      socket?.close();
    };
  }, [role, screenId]);

  return { connected, clientCount };
}
