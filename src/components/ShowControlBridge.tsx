import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '@/store/useStore';
import { createShowControlClient, type ControlCommand } from '@/lib/showControlClient';
import { FIREBASE_DATABASE_URL, SHOW_BACKEND_URL, SHOW_CONTROL_TOKEN, SHOW_ID, SHOW_TRANSPORT } from '@/lib/runtimeConfig';
import { applyLiveControlPatch, LIVE_CONTROL_NUMERIC_KEYS, LIVE_PAD_DEFINITIONS } from '@/lib/liveControls';
import { ShowRuntimeSettingsPanel } from '@/components/ShowRuntimeSettingsPanel';
import type { AudioDriveMode } from '@/lib/audioDrive';
import type { LiveControls, VisualInputSource } from '@/store/useStore';
import { getVisualModule, getVisualModuleByPreset, visualModules } from '@/visuals/registry';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const toNumber = (value: unknown, fallback: number) =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

const scenePresetMap: Record<string, string> = Object.fromEntries(
  visualModules.map((module) => [module.id, module.presetId]),
);

const createIdFragment = () => {
  const uuid = globalThis.crypto?.randomUUID?.();
  return uuid ? uuid.slice(0, 8) : Math.random().toString(36).slice(2, 10);
};

type ShowControlBridgeProps = {
  showStatus?: boolean;
  publishState?: boolean;
  role?: 'vj' | 'screen';
};

export const INTERACTION_PATCH_EVENT = 'vad:interaction-patch';

export function ShowControlBridge({ showStatus = true, publishState = true, role = 'vj' }: ShowControlBridgeProps) {
  const clientRef = useRef<ReturnType<typeof createShowControlClient> | null>(null);
  const clientIdRef = useRef(`${role === 'screen' ? 'vj-screen' : 'vj-visual-dynamic-effect'}-${createIdFragment()}`);
  const [status, setStatus] = useState<'connecting' | 'connected' | 'offline'>('connecting');
  const [stateHydrated, setStateHydrated] = useState(false);
  const store = useStore();

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    const connect = async () => {
      await hydrateVisualState(controller.signal);
      if (cancelled) return;
      setStateHydrated(true);
      clientRef.current = createShowControlClient({
        module: 'visual',
        clientId: clientIdRef.current,
        role,
        capabilities: [
          ...(publishState ? ['module.statePatch'] : []),
          'control.command',
          'state.visual',
          'state.interaction',
          'visual.scene',
          'visual.fx',
          'visual.text',
          'visual.liveControls',
        ],
        onStatus: setStatus,
        onCommand: (command) => applyVisualCommand(command),
        onSnapshot: applyRemoteSnapshot,
        onStatePatch: applyRemoteStatePatch,
      });
    };

    void connect();

    return () => {
      cancelled = true;
      controller.abort();
      clientRef.current?.close();
      clientRef.current = null;
    };
  }, []);

  const patch = useMemo(() => ({
    status: 'online',
    scene: store.currentScene,
    preset: store.textAnimStyle,
    colors: {
      base: store.baseColor,
      secondary: store.secondaryColor,
      accent: store.accentColor,
      background: store.bgColor,
    },
    fx: {
      bloomIntensity: store.bloomIntensity,
      rgbSplitAmount: store.rgbSplitAmount,
      distortion: store.distortion,
      glitchActive: store.glitchActive,
      speed: store.speed,
      chaos: store.chaos,
      saturation: store.saturation,
      contrast: store.contrast,
      brightness: store.brightness,
      exposure: store.exposure,
    },
    text: {
      value: store.textInput,
      animation: store.textAnimStyle,
      reactive: store.textReactive,
      glow: store.textGlow,
      speed: store.textSpeed,
      fontSize: store.textFontSize,
      fontWeight: store.textFontWeight,
      letterSpacing: store.textLetterSpacing,
    },
    audioDriveMode: store.audioDriveMode,
    inputSource: store.visualInputSource,
    liveControls: store.liveControls,
    fullscreen: store.isFullscreen,
    visualMemories: store.visualMemories.map((memory) => ({
      id: memory.id,
      name: memory.name,
      scene: memory.currentScene,
    })),
  }), [
    store.currentScene,
    store.textAnimStyle,
    store.baseColor,
    store.secondaryColor,
    store.accentColor,
    store.bgColor,
    store.bloomIntensity,
    store.rgbSplitAmount,
    store.distortion,
    store.glitchActive,
    store.speed,
    store.chaos,
    store.saturation,
    store.contrast,
    store.brightness,
    store.exposure,
    store.textInput,
    store.textReactive,
    store.textGlow,
    store.textSpeed,
    store.textFontSize,
    store.textFontWeight,
    store.textLetterSpacing,
    store.audioDriveMode,
    store.visualInputSource,
    store.liveControls,
    store.isFullscreen,
    store.visualMemories,
  ]);

  useEffect(() => {
    if (!stateHydrated || !publishState) return;
    clientRef.current?.publishState(patch);
  }, [patch, publishState, stateHydrated]);

  if (!showStatus) return null;

  return (
    <>
      <div className="pointer-events-none fixed left-3 bottom-3 z-30 hidden rounded-full border border-white/10 bg-black/55 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-white/60 backdrop-blur md:block">
        Show API: {status}
      </div>
      <ShowRuntimeSettingsPanel status={status} />
    </>
  );
}

async function hydrateVisualState(signal?: AbortSignal) {
  if (!SHOW_CONTROL_TOKEN.trim()) return;
  try {
    const snapshot = await fetchShowStateSnapshot(signal);
    applyRemoteSnapshot(snapshot);
  } catch {
    // A failed initial read should not block live commands; the bridge can still reconnect and receive updates.
  }
}

function applyRemoteSnapshot(snapshot: unknown) {
  const visual = readVisualSnapshot(snapshot);
  if (visual) applyRemoteVisualSnapshot(visual);
  const interaction = readInteractionSnapshot(snapshot);
  if (interaction) dispatchInteractionPatch(interaction);
}

function applyRemoteStatePatch(module: string, patch: Record<string, unknown>) {
  if (module === 'visual') {
    applyRemoteVisualSnapshot(patch);
    return;
  }
  if (module === 'interaction') {
    dispatchInteractionPatch(patch);
  }
}

async function fetchShowStateSnapshot(signal?: AbortSignal) {
  const backendFirst = shouldPreferBackendSnapshot();
  const primary = backendFirst ? fetchBackendSnapshot : fetchFirebaseSnapshot;
  const fallback = backendFirst ? fetchFirebaseSnapshot : fetchBackendSnapshot;

  try {
    return await primary(signal);
  } catch (error) {
    if (!FIREBASE_DATABASE_URL && backendFirst) throw error;
    if (!SHOW_BACKEND_URL && !backendFirst) throw error;
    return fallback(signal);
  }
}

async function fetchBackendSnapshot(signal?: AbortSignal) {
  const headers: Record<string, string> = {};
  if (SHOW_CONTROL_TOKEN) headers['x-control-token'] = SHOW_CONTROL_TOKEN;
  const response = await fetch(`${SHOW_BACKEND_URL}/api/state`, { headers, signal });
  if (!response.ok) throw new Error(`Show API state failed: ${response.status}`);
  return response.json();
}

async function fetchFirebaseSnapshot(signal?: AbortSignal) {
  if (!FIREBASE_DATABASE_URL) throw new Error('Firebase database URL is not configured');
  const response = await fetch(`${FIREBASE_DATABASE_URL}/shows/${safeFirebasePath(SHOW_ID)}/state.json`, { signal });
  if (!response.ok) throw new Error(`Firebase state failed: ${response.status}`);
  return response.json();
}

function shouldPreferBackendSnapshot() {
  if (isLocalRuntime()) return true;
  if (SHOW_TRANSPORT === 'firebase') return false;
  return true;
}

function isLocalRuntime() {
  if (typeof window === 'undefined') return false;
  const hostname = window.location.hostname;
  return hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '0.0.0.0' ||
    hostname.endsWith('.local') ||
    /^10\./.test(hostname) ||
    /^192\.168\./.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname);
}

function readVisualSnapshot(snapshot: unknown) {
  const root = isRecord(snapshot) ? snapshot : {};
  const modules = isRecord(root.modules) ? root.modules : {};
  return isRecord(modules.visual) ? modules.visual : null;
}

function readInteractionSnapshot(snapshot: unknown) {
  const root = isRecord(snapshot) ? snapshot : {};
  const modules = isRecord(root.modules) ? root.modules : {};
  return isRecord(modules.interaction) ? modules.interaction : null;
}

function dispatchInteractionPatch(patch: Record<string, unknown>) {
  window.dispatchEvent(new CustomEvent(INTERACTION_PATCH_EVENT, { detail: patch }));
}

function applyRemoteVisualSnapshot(visual: Record<string, unknown>) {
  const state = useStore.getState();
  const patch: Record<string, unknown> = {};

  if (typeof visual.scene === 'string') applyRemoteScene(visual.scene);
  if (typeof visual.preset === 'string' && typeof visual.scene !== 'string') applyRemotePreset(visual.preset);
  if (typeof visual.audioDriveMode === 'string') patch.audioDriveMode = visual.audioDriveMode;
  if (typeof visual.fullscreen === 'boolean') patch.isFullscreen = visual.fullscreen;

  const colors = isRecord(visual.colors) ? visual.colors : {};
  if (typeof colors.base === 'string') patch.baseColor = colors.base;
  if (typeof colors.secondary === 'string') patch.secondaryColor = colors.secondary;
  if (typeof colors.accent === 'string') patch.accentColor = colors.accent;
  if (typeof colors.background === 'string') patch.bgColor = colors.background;

  const fx = isRecord(visual.fx) ? visual.fx : {};
  if (typeof fx.bloomIntensity === 'number') patch.bloomIntensity = fx.bloomIntensity;
  if (typeof fx.rgbSplitAmount === 'number') patch.rgbSplitAmount = fx.rgbSplitAmount;
  if (typeof fx.distortion === 'number') patch.distortion = fx.distortion;
  if (typeof fx.glitchActive === 'boolean') patch.glitchActive = fx.glitchActive;
  if (typeof fx.speed === 'number') patch.speed = fx.speed;
  if (typeof fx.chaos === 'number') patch.chaos = fx.chaos;
  if (typeof fx.saturation === 'number') patch.saturation = fx.saturation;
  if (typeof fx.contrast === 'number') patch.contrast = fx.contrast;
  if (typeof fx.brightness === 'number') patch.brightness = fx.brightness;
  if (typeof fx.exposure === 'number') patch.exposure = fx.exposure;

  const text = isRecord(visual.text) ? visual.text : {};
  if (typeof text.value === 'string') patch.textInput = text.value;
  if (typeof text.animation === 'string') patch.textAnimStyle = text.animation;
  if (typeof text.reactive === 'number') patch.textReactive = text.reactive;
  if (typeof text.glow === 'number') patch.textGlow = text.glow;
  if (typeof text.speed === 'number') patch.textSpeed = text.speed;
  if (typeof text.fontSize === 'number') patch.textFontSize = text.fontSize;
  if (typeof text.fontWeight === 'number') patch.textFontWeight = text.fontWeight;
  if (typeof text.letterSpacing === 'number') patch.textLetterSpacing = text.letterSpacing;
  if (isRecord(visual.liveControls)) patch.liveControls = visual.liveControls;

  state.applyRemoteSyncState(patch as Parameters<typeof state.applyRemoteSyncState>[0]);
  if (typeof visual.inputSource === 'string' && ['mic', 'music', 'api'].includes(visual.inputSource)) {
    state.setVisualInputSource(visual.inputSource as VisualInputSource);
  }
}

function safeFirebasePath(value: string) {
  return value.replace(/[.#$/[\]]/g, '-');
}

function applyVisualCommand(command: ControlCommand) {
  if (command.module && command.module !== 'visual' && command.module !== 'show') return;

  const state = useStore.getState();
  const value = command.value;

  if (command.command === 'setScene' && typeof value === 'string') {
    applyRemoteScene(value);
  } else if (command.command === 'setPreset' && typeof value === 'string') {
    applyRemotePreset(value);
  } else if (command.command === 'setText') {
    if (typeof value === 'string') {
      state.setTextEngine('textInput', value);
    } else if (isRecord(value)) {
      if (typeof value.value === 'string') state.setTextEngine('textInput', value.value);
      if (typeof value.animation === 'string') state.setTextEngine('textAnimStyle', value.animation);
      if (typeof value.reactive === 'number') state.setTextEngine('textReactive', value.reactive);
    }
  } else if (command.command === 'setColors' && isRecord(value)) {
    if (typeof value.base === 'string') state.setColorGrading('baseColor', value.base);
    if (typeof value.secondary === 'string') state.setColorGrading('secondaryColor', value.secondary);
    if (typeof value.accent === 'string') state.setColorGrading('accentColor', value.accent);
    if (typeof value.background === 'string') state.setColorGrading('bgColor', value.background);
  } else if (command.command === 'setFx' && isRecord(value)) {
    if (typeof value.bloomIntensity === 'number') state.setFxControl('bloomIntensity', value.bloomIntensity);
    if (typeof value.rgbSplitAmount === 'number') state.setFxControl('rgbSplitAmount', value.rgbSplitAmount);
    if (typeof value.distortion === 'number') state.setFxControl('distortion', value.distortion);
    if (typeof value.glitchActive === 'boolean') state.setFxControl('glitchActive', value.glitchActive);
    if (typeof value.speed === 'number') state.setPerformanceControl('speed', value.speed);
    if (typeof value.chaos === 'number') state.setPerformanceControl('chaos', value.chaos);
  } else if (command.command === 'setAudioDrive' && typeof value === 'string') {
    applyRemoteAudioDrive(value);
  } else if ((command.command === 'setLiveControls' || command.command === 'setLivePads') && isRecord(value)) {
    applyRemoteLiveControls(readLiveControlsPatch(value));
  } else if (command.command === 'setLivePad' && isRecord(value)) {
    applyRemoteLivePad(value);
  } else if (command.command === 'setFullscreen') {
    state.setIsFullscreen(Boolean(value));
  } else if (command.command === 'setIntensity') {
    const amount = toNumber(value, state.chaos);
    state.setPerformanceControl('chaos', amount);
  }
}

function applyRemoteAudioDrive(value: string) {
  const state = useStore.getState();
  if (!['mic', 'music', 'api', 'hybrid'].includes(value)) return;

  const inputSource = (value === 'hybrid' ? 'api' : value) as VisualInputSource;
  window.dispatchEvent(new CustomEvent('vj:select-input', { detail: inputSource }));
  state.setAudioDriveMode(inputSource as AudioDriveMode);
}

function applyRemoteScene(scene: string) {
  const state = useStore.getState();
  const module = getVisualModule(scene);
  if (module) {
    state.applyPreset(module.presetId);
    state.setCurrentScene(module.id);
    return;
  }
  state.setCurrentScene(scene);
}

function applyRemotePreset(presetOrScene: string) {
  const state = useStore.getState();
  const preset = scenePresetMap[presetOrScene] || getVisualModuleByPreset(presetOrScene)?.presetId || presetOrScene;
  state.applyPreset(preset);
  const scene = getVisualModuleByPreset(preset)?.id;
  if (scene) state.setCurrentScene(scene);
}

function readLiveControlsPatch(value: Record<string, unknown>): Partial<LiveControls> {
  const patch: Partial<LiveControls> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (key === 'selectedLookId' || key === 'selectedSceneId') {
      if (typeof entry === 'string') patch[key] = entry as never;
      continue;
    }
    if (LIVE_CONTROL_NUMERIC_KEYS.includes(key as keyof LiveControls) && typeof entry === 'number' && Number.isFinite(entry)) {
      patch[key as keyof LiveControls] = Math.max(0, Math.min(1, entry)) as never;
    }
  }
  return patch;
}

function applyRemoteLiveControls(patch: Partial<LiveControls>) {
  useStore.setState((state) => {
    return applyLiveControlPatch(state.liveControls, patch);
  });
}

function applyRemoteLivePad(value: Record<string, unknown>) {
  const pad = typeof value.pad === 'string' ? value.pad : '';
  const x = typeof value.x === 'number' ? Math.max(0, Math.min(1, value.x)) : undefined;
  const y = typeof value.y === 'number' ? Math.max(0, Math.min(1, value.y)) : undefined;
  if (x === undefined || y === undefined) return;
  const definition = LIVE_PAD_DEFINITIONS.find((item) => item.id === pad.toLowerCase() || item.title.toLowerCase() === pad.toLowerCase());
  if (!definition) return;
  applyRemoteLiveControls({ [definition.xKey]: x, [definition.yKey]: y } as Partial<LiveControls>);
}
