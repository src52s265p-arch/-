import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Focus } from 'lucide-react';
import { DesignStudio } from '@/components/live/DesignStudio';
import { LiveConsole } from '@/components/live/LiveConsole';
import { ScreenOutput } from '@/components/screen/ScreenOutput';
import { ShowControlBridge } from '@/components/ShowControlBridge';
import { Visualizer } from '@/components/visualizer/Visualizer';
import { audioEngine } from '@/lib/AudioEngine';
import type { AudioDebugSnapshot } from '@/lib/AudioEngine';
import { useApiAudioSource } from '@/lib/useApiAudioSource';
import { useScreenSync } from '@/lib/screenSync';
import { useStore, type VisualInputSource } from '@/store/useStore';

const audioDebugChanged = (a: AudioDebugSnapshot, b: AudioDebugSnapshot) => (
  a.status !== b.status ||
  a.message !== b.message ||
  a.contextState !== b.contextState ||
  a.streamActive !== b.streamActive ||
  a.sourceType !== b.sourceType ||
  Math.abs(a.rawRms - b.rawRms) > 0.006 ||
  Math.abs(a.rawVolume - b.rawVolume) > 0.006 ||
  Math.abs(a.frequencyDelta - b.frequencyDelta) > 0.004 ||
  a.frequencyChanged !== b.frequencyChanged ||
  a.peakFrequencyBin !== b.peakFrequencyBin ||
  a.sampleRate !== b.sampleRate
);

export default function App() {
  const screenMatch = window.location.pathname.match(/^\/screen\/([^/]+)/);

  if (screenMatch) {
    return <ScreenApp screenId={decodeURIComponent(screenMatch[1])} />;
  }

  return <ControllerApp />;
}

function ScreenApp({ screenId }: { screenId: string }) {
  useApiAudioSource(true);

  return (
    <>
      <ShowControlBridge showStatus={false} publishState={false} role="screen" />
      <ScreenOutput screenId={screenId} />
    </>
  );
}

function getReadableMicErrorMessage(err: unknown, language: 'EN' | 'ZH') {
  const name = err && typeof err === 'object' && 'name' in err ? String((err as { name?: unknown }).name) : '';
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
    return language === 'ZH'
      ? '麦克风权限被拒绝，请在浏览器地址栏允许麦克风后重试。'
      : 'Microphone permission was denied. Allow microphone access in the browser and try again.';
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return language === 'ZH' ? '没有检测到可用麦克风。' : 'No available microphone was found.';
  }
  if (name === 'NotReadableError' || name === 'TrackStartError') {
    return language === 'ZH'
      ? '麦克风可能正被其他程序占用，请关闭占用后重试。'
      : 'The microphone is in use by another app. Close it and try again.';
  }
  if (err instanceof Error && err.message.includes('localhost or HTTPS')) {
    return language === 'ZH'
      ? '麦克风权限需要 localhost 或 HTTPS 环境。请使用 http://localhost:4302 或 HTTPS 访问。'
      : 'Microphone access requires localhost or HTTPS. Use http://localhost:4302 or HTTPS.';
  }
  return language === 'ZH'
    ? '麦克风启动失败，请检查浏览器权限和输入设备。'
    : 'Could not start the microphone. Check browser permissions and input device.';
}

function ControllerApp() {
  const audioReady = useStore((state) => state.audioReady);
  const isFullscreen = useStore((state) => state.isFullscreen);
  const language = useStore((state) => state.language);
  const liveMode = useStore((state) => state.liveMode);
  const setAudioReady = useStore((state) => state.setAudioReady);
  const setIsFullscreen = useStore((state) => state.setIsFullscreen);
  const setVisualInputSource = useStore((state) => state.setVisualInputSource);
  const visualInputSource = useStore((state) => state.visualInputSource);
  const [initError, setInitError] = useState('');
  const [audioDebug, setAudioDebug] = useState<AudioDebugSnapshot>(() => audioEngine.getDebugSnapshot());
  const audioDebugRef = useRef(audioDebug);
  const lastAudioDebugUpdateRef = useRef(0);

  useScreenSync('controller');
  useApiAudioSource(visualInputSource === 'api');

  useEffect(() => {
    if (visualInputSource === 'api') {
      const nextDebug = audioEngine.getDebugSnapshot();
      audioDebugRef.current = nextDebug;
      setAudioDebug(nextDebug);
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      const state = useStore.getState();
      audioEngine.update(state.inputGain, {
        subBassSense: state.subBassSense,
        bassSense: state.bassSense,
        midSense: state.midSense,
        trebleSense: state.trebleSense,
        noiseGate: state.noiseGate,
        beatMultiplier: state.beatMultiplier,
      });
      const now = performance.now();
      if (now - lastAudioDebugUpdateRef.current > 120) {
        lastAudioDebugUpdateRef.current = now;
        const nextDebug = audioEngine.getDebugSnapshot();
        if (audioDebugChanged(audioDebugRef.current, nextDebug)) {
          audioDebugRef.current = nextDebug;
          setAudioDebug(nextDebug);
        }
      }
    }, 33);

    return () => window.clearInterval(intervalId);
  }, [visualInputSource]);

  useEffect(() => {
    const updateViewport = () => {
      document.documentElement.style.setProperty('--vj-vh', `${window.innerHeight}px`);
    };
    const updateFullscreen = () => setIsFullscreen(Boolean(document.fullscreenElement));

    updateViewport();
    updateFullscreen();
    window.addEventListener('resize', updateViewport);
    window.addEventListener('orientationchange', updateViewport);
    document.addEventListener('fullscreenchange', updateFullscreen);
    return () => {
      window.removeEventListener('resize', updateViewport);
      window.removeEventListener('orientationchange', updateViewport);
      document.removeEventListener('fullscreenchange', updateFullscreen);
    };
  }, [setIsFullscreen]);

  const toggleFullscreenView = useCallback(async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        setIsFullscreen(false);
      } else {
        await document.documentElement.requestFullscreen();
        setIsFullscreen(true);
      }
    } catch {
      setIsFullscreen(!isFullscreen);
    }
  }, [isFullscreen, setIsFullscreen]);

  const activateMic = useCallback(async () => {
    setVisualInputSource('mic');
    setAudioReady(false);
    setInitError('');
    const requestingDebug = { ...audioEngine.getDebugSnapshot(), status: 'requesting' as const, message: 'Waiting for microphone permission.' };
    audioDebugRef.current = requestingDebug;
    setAudioDebug(requestingDebug);
    try {
      window.dispatchEvent(new Event('vj:stop-music'));
      await audioEngine.startMicrophone();
      setAudioReady(true);
      setInitError('');
      const nextDebug = audioEngine.getDebugSnapshot();
      audioDebugRef.current = nextDebug;
      setAudioDebug(nextDebug);
    } catch (err: unknown) {
      setAudioReady(false);
      setInitError(getReadableMicErrorMessage(err, language));
      const nextDebug = audioEngine.getDebugSnapshot();
      audioDebugRef.current = nextDebug;
      setAudioDebug(nextDebug);
    }
  }, [language, setAudioReady, setVisualInputSource]);

  const selectInputSource = useCallback((source: VisualInputSource) => {
    if (source === 'mic') {
      void activateMic();
      return;
    }
    audioEngine.stopCurrentAudioSource();
    setAudioReady(false);
    setInitError('');
    const nextDebug = audioEngine.getDebugSnapshot();
    audioDebugRef.current = nextDebug;
    setAudioDebug(nextDebug);
    if (source !== 'music') window.dispatchEvent(new Event('vj:stop-music'));
    setVisualInputSource(source);
  }, [activateMic, setAudioReady, setVisualInputSource]);

  useEffect(() => {
    const handleSelectInput = (event: Event) => {
      const source = (event as CustomEvent<VisualInputSource>).detail;
      if (source === 'mic' || source === 'music' || source === 'api') {
        selectInputSource(source);
      }
    };
    const handleStopMic = () => {
      audioEngine.stopCurrentAudioSource();
      setAudioReady(false);
      setInitError('');
      const nextDebug = audioEngine.getDebugSnapshot();
      audioDebugRef.current = nextDebug;
      setAudioDebug(nextDebug);
    };

    window.addEventListener('vj:select-input', handleSelectInput);
    window.addEventListener('vj:stop-mic', handleStopMic);
    return () => {
      window.removeEventListener('vj:select-input', handleSelectInput);
      window.removeEventListener('vj:stop-mic', handleStopMic);
    };
  }, [selectInputSource, setAudioReady]);

  const micStatusText = (() => {
    if (visualInputSource !== 'mic') return language === 'ZH' ? '未连接' : 'Not connected';
    if (audioDebug.status === 'requesting') return language === 'ZH' ? '等待授权' : 'Waiting for permission';
    if (audioDebug.status === 'connected') return language === 'ZH' ? '麦克风已连接' : 'Microphone connected';
    if (audioDebug.status === 'receiving') return language === 'ZH' ? '正在接收声音' : 'Receiving sound';
    if (audioDebug.status === 'low') return language === 'ZH' ? '输入音量过低' : 'Input volume too low';
    if (audioDebug.status === 'error') return language === 'ZH' ? '麦克风错误' : 'Microphone error';
    return language === 'ZH' ? '未连接' : 'Not connected';
  })();

  const commonProps = useMemo(() => ({
    audioDebug,
    initError,
    micStatusText,
    selectInputSource,
    toggleFullscreenView,
  }), [audioDebug, initError, micStatusText, selectInputSource, toggleFullscreenView]);

  return (
    <>
      <ShowControlBridge />
      {isFullscreen ? (
        <div className="relative h-[100dvh] min-h-[100svh] w-screen overflow-hidden bg-black text-white">
          <Visualizer />
          {initError && visualInputSource === 'mic' && (
            <div className="absolute left-4 top-4 z-50 rounded border border-red-400/30 bg-red-500/20 px-3 py-2 text-xs font-bold text-red-100">
              {initError}
            </div>
          )}
          <button
            type="button"
            onClick={toggleFullscreenView}
            className="absolute bottom-5 right-5 z-50 flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white backdrop-blur-md hover:bg-white hover:text-black"
            title="Exit fullscreen"
          >
            <Focus size={20} />
          </button>
        </div>
      ) : liveMode ? (
        <LiveConsole audioReady={audioReady} {...commonProps} />
      ) : (
        <DesignStudio {...commonProps} />
      )}
    </>
  );
}
