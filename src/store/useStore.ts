import { create } from 'zustand';
import type { AudioDriveMode } from '../lib/audioDrive';
import { SHOW_SCREEN_IDS } from '../lib/screenRoutes';
import { getPresetLook, getVisualModule } from '../visuals/registry';

export type VisualInputSource = 'mic' | 'music' | 'api';
export type OutputMode = 'mirror' | 'solo' | 'split';
export type ScreenTransitionStyle = 'crossfade' | 'scan' | 'strobe' | 'cut';
export type OutputDeviceType = 'stage' | 'projector' | 'led' | 'tablet' | 'phone';

export interface VisualScreen {
  id: string;
  name: string;
  device: OutputDeviceType;
  scene: string;
  enabled: boolean;
}

export interface VisualMemory {
  id: string;
  name: string;
  currentScene: string;
  baseColor: string;
  secondaryColor: string;
  accentColor: string;
  bgColor: string;
  bloomIntensity: number;
  rgbSplitAmount: number;
  distortion: number;
  glitchActive: boolean;
  speed: number;
  chaos: number;
  textInput: string;
  textAnimStyle: string;
  textGlow: number;
  textSpeed: number;
  textReactive: number;
  textColor: string;
}

export interface LiveControls {
  energyX: number;
  energyY: number;
  colorX: number;
  colorY: number;
  rhythmX: number;
  rhythmY: number;
  structureX: number;
  structureY: number;
  textureX: number;
  textureY: number;
  atmosphereX: number;
  atmosphereY: number;
  selectedLookId: string;
  selectedSceneId: string;
}

interface VisualizerState {
  audioReady: boolean;
  setAudioReady: (ready: boolean) => void;
  visualInputSource: VisualInputSource;
  musicPanelOpen: boolean;
  setVisualInputSource: (source: VisualInputSource) => void;
  setMusicPanelOpen: (open: boolean) => void;
  
  // Language
  language: 'EN' | 'ZH';
  setLanguage: (lang: 'EN' | 'ZH') => void;
  
  // Audio Controls
  inputGain: number;
  bassReact: number;
  midReact: number;
  trebReact: number;
  setAudioControl: (key: 'inputGain' | 'bassReact' | 'midReact' | 'trebReact', value: number) => void;

  // FX Controls
  bloomIntensity: number;
  bloomThreshold: number;
  glitchActive: boolean;
  rgbSplitAmount: number;
  distortion: number;
  setFxControl: (key: 'bloomIntensity' | 'bloomThreshold' | 'glitchActive' | 'rgbSplitAmount' | 'distortion', value: number | boolean) => void;

  // Performance Controls
  speed: number;
  chaos: number;
  setPerformanceControl: (key: 'speed' | 'chaos', value: number) => void;
  
  // Scene
  currentScene: string;
  setCurrentScene: (scene: string) => void;

  // Text Engine
  textInput: string;
  textAnimStyle: string;
  textGlow: number;
  textSpeed: number;
  textReactive: number;
  textColor: string;
  textFontSize: number;
  textFontWeight: number;
  textLetterSpacing: number;
  setTextEngine: (key: 'textInput' | 'textAnimStyle' | 'textGlow' | 'textSpeed' | 'textReactive' | 'textColor' | 'textFontSize' | 'textFontWeight' | 'textLetterSpacing', value: string | number) => void;

  // Enhancements
  baseColor: string;
  secondaryColor: string;
  accentColor: string;
  bgColor: string;
  saturation: number;
  contrast: number;
  brightness: number;
  gamma: number;
  exposure: number;
  setColorGrading: (key: Extract<keyof VisualizerState, 'baseColor' | 'secondaryColor' | 'accentColor' | 'bgColor' | 'saturation' | 'contrast' | 'brightness' | 'gamma' | 'exposure'>, value: string | number) => void;

  // Audio Advanced
  subBassSense: number;
  bassSense: number;
  midSense: number;
  trebleSense: number;
  noiseGate: number;
  beatMultiplier: number;
  setAudioParam: (key: Extract<keyof VisualizerState, 'subBassSense' | 'bassSense' | 'midSense' | 'trebleSense' | 'noiseGate' | 'beatMultiplier'>, value: number) => void;

  isFullscreen: boolean;
  setIsFullscreen: (val: boolean) => void;
  liveMode: boolean;
  setLiveMode: (val: boolean) => void;
  liveControls: LiveControls;
  setLiveControl: (key: keyof LiveControls, value: number | string) => void;
  setLiveControls: (values: Partial<LiveControls>) => void;
  activeLeftPanel: string;
  setActiveLeftPanel: (panel: string) => void;
  applyPreset: (presetId: string) => void;

  // Auto VJ
  autoVjEnabled: boolean;
  memoryRecallEnabled: boolean;
  musicCameraEnabled: boolean;
  audioFxReactive: boolean;
  autoVjSensitivity: number;
  musicCameraAmount: number;
  transitionEnergy: number;
  audioDriveMode: AudioDriveMode;
  visualMemories: VisualMemory[];
  visualScreens: VisualScreen[];
  activeScreenId: string;
  outputMode: OutputMode;
  screenTransitionStyle: ScreenTransitionStyle;
  screenTransitionAmount: number;
  screenAudioReactive: boolean;
  syncedScreenSignal: number;
  setAutoVjControl: (key: 'autoVjEnabled' | 'memoryRecallEnabled' | 'musicCameraEnabled' | 'audioFxReactive', value: boolean) => void;
  setAutoVjAmount: (key: 'autoVjSensitivity' | 'musicCameraAmount' | 'transitionEnergy', value: number) => void;
  setAudioDriveMode: (mode: AudioDriveMode) => void;
  setActiveScreen: (id: string) => void;
  setScreenScene: (id: string, scene: string) => void;
  setScreenEnabled: (id: string, enabled: boolean) => void;
  setScreenControl: (key: 'outputMode' | 'screenTransitionStyle' | 'screenTransitionAmount' | 'screenAudioReactive', value: string | number | boolean) => void;
  setSyncedScreenSignal: (value: number) => void;
  applyRemoteSyncState: (state: Partial<VisualizerState>) => void;
  saveVisualMemory: () => void;
  applyVisualMemory: (id: string) => void;
  deleteVisualMemory: (id: string) => void;
  resetCurrentLook: () => void;
}

const createMemorySnapshot = (state: VisualizerState, name: string): VisualMemory => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  name,
  currentScene: state.currentScene,
  baseColor: state.baseColor,
  secondaryColor: state.secondaryColor,
  accentColor: state.accentColor,
  bgColor: state.bgColor,
  bloomIntensity: state.bloomIntensity,
  rgbSplitAmount: state.rgbSplitAmount,
  distortion: state.distortion,
  glitchActive: state.glitchActive,
  speed: state.speed,
  chaos: state.chaos,
  textInput: state.textInput,
  textAnimStyle: state.textAnimStyle,
  textGlow: state.textGlow,
  textSpeed: state.textSpeed,
  textReactive: state.textReactive,
  textColor: state.textColor,
});

const applyMemoryState = (memory: VisualMemory) => ({
  currentScene: memory.currentScene,
  baseColor: memory.baseColor,
  secondaryColor: memory.secondaryColor,
  accentColor: memory.accentColor,
  bgColor: memory.bgColor,
  bloomIntensity: memory.bloomIntensity,
  rgbSplitAmount: memory.rgbSplitAmount,
  distortion: memory.distortion,
  glitchActive: memory.glitchActive,
  speed: memory.speed,
  chaos: memory.chaos,
  textInput: memory.textInput,
  textAnimStyle: memory.textAnimStyle,
  textGlow: memory.textGlow,
  textSpeed: memory.textSpeed,
  textReactive: memory.textReactive,
  textColor: memory.textColor,
});

const MEMORY_STORAGE_KEY = 'neonpulse.visualMemories';
const VISUAL_SETTINGS_STORAGE_KEY = 'neonpulse.visualSettings';

type StoredVisualSettings = Partial<Pick<
  VisualizerState,
  'baseColor' | 'secondaryColor' | 'accentColor' | 'bgColor' | 'saturation' | 'contrast' | 'brightness' | 'gamma' | 'exposure'
>>;

const defaultScreens: VisualScreen[] = SHOW_SCREEN_IDS.map((id, index) => ({
  id,
  name: `Show Screen ${id}`,
  device: index === 0 ? 'stage' : 'led',
  scene: index === 0 ? 'Layered Stage' : index % 4 === 1 ? 'Topology' : index % 4 === 2 ? 'Pulse' : 'Liquid',
  enabled: true,
}));

const loadStoredMemories = (): VisualMemory[] => {
  if (typeof window === 'undefined') return [];

  try {
    const raw = window.localStorage.getItem(MEMORY_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const persistMemories = (memories: VisualMemory[]) => {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(MEMORY_STORAGE_KEY, JSON.stringify(memories));
  } catch {
    // If storage is unavailable, the in-memory session still works.
  }
};

const loadStoredVisualSettings = (): StoredVisualSettings => {
  if (typeof window === 'undefined') return {};

  try {
    const raw = window.localStorage.getItem(VISUAL_SETTINGS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const persistVisualSettings = (settings: StoredVisualSettings) => {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(VISUAL_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Keep the live session working if local storage is unavailable.
  }
};

const storedVisualSettings = loadStoredVisualSettings();

const defaultLiveControls: LiveControls = {
  energyX: 0.5,
  energyY: 0.35,
  colorX: 0.45,
  colorY: 0.58,
  rhythmX: 0.62,
  rhythmY: 0.55,
  structureX: 0.48,
  structureY: 0.42,
  textureX: 0.38,
  textureY: 0.32,
  atmosphereX: 0.52,
  atmosphereY: 0.44,
  selectedLookId: 'Video Flow',
  selectedSceneId: 'Video Flow',
};

export const useStore = create<VisualizerState>((set) => ({
  audioReady: false,
  setAudioReady: (ready) => set({ audioReady: ready }),
  visualInputSource: 'api',
  musicPanelOpen: false,
  setVisualInputSource: (source) => set({
    visualInputSource: source,
    musicPanelOpen: source === 'music',
    audioDriveMode: source,
    autoVjEnabled: true,
    musicCameraEnabled: source !== 'mic',
  }),
  setMusicPanelOpen: (open) => set({ musicPanelOpen: open }),

  // Language
  language: 'EN',
  setLanguage: (lang) => set({ language: lang }),

  // Audio Defaults
  inputGain: 1.0,
  bassReact: 1.5,
  midReact: 1.0,
  trebReact: 1.2,
  setAudioControl: (key, value) => set({ [key]: value }),

  // FX Defaults
  bloomIntensity: 1.5,
  bloomThreshold: 0.2,
  glitchActive: false,
  rgbSplitAmount: 0.005,
  distortion: 0.0,
  setFxControl: (key, value) => set({ [key]: value }),

  // Performance Defaults
  speed: 1.0,
  chaos: 0.0,
  setPerformanceControl: (key, value) => set({ [key]: value }),

  // Scene
  currentScene: 'Video Flow',
  setCurrentScene: (scene) => set({ currentScene: scene }),

  // Text Engine Defaults
  textInput: '',
  textAnimStyle: 'Glitch',
  textGlow: 1.0,
  textSpeed: 1.0,
  textReactive: 1.0,
  textColor: '#ffffff',
  textFontSize: 4.6,
  textFontWeight: 900,
  textLetterSpacing: 0.02,
  setTextEngine: (key, value) => set({ [key]: value }),

  baseColor: storedVisualSettings.baseColor ?? '#00f3ff',
  secondaryColor: storedVisualSettings.secondaryColor ?? '#bf00ff',
  accentColor: storedVisualSettings.accentColor ?? '#ffffff',
  bgColor: storedVisualSettings.bgColor ?? '#030008',
  saturation: storedVisualSettings.saturation ?? 1.0,
  contrast: storedVisualSettings.contrast ?? 1.0,
  brightness: storedVisualSettings.brightness ?? 1.0,
  gamma: storedVisualSettings.gamma ?? 1.0,
  exposure: storedVisualSettings.exposure ?? 1.2,
  setColorGrading: (key, value) => set((state) => {
    const nextSettings = {
      baseColor: state.baseColor,
      secondaryColor: state.secondaryColor,
      accentColor: state.accentColor,
      bgColor: state.bgColor,
      saturation: state.saturation,
      contrast: state.contrast,
      brightness: state.brightness,
      gamma: state.gamma,
      exposure: state.exposure,
      [key]: value,
    };
    persistVisualSettings(nextSettings);
    return { [key]: value } as Partial<VisualizerState>;
  }),

  subBassSense: 1.0,
  bassSense: 1.0,
  midSense: 1.0,
  trebleSense: 1.0,
  noiseGate: 0.03,
  beatMultiplier: 1.0,
  setAudioParam: (key, value) => set({ [key]: value }),

  isFullscreen: false,
  setIsFullscreen: (val) => set({ isFullscreen: val }),
  liveMode: true,
  setLiveMode: (val) => set({ liveMode: val }),
  liveControls: defaultLiveControls,
  setLiveControl: (key, value) => set((state) => ({
    liveControls: {
      ...state.liveControls,
      [key]: value,
    },
  })),
  setLiveControls: (values) => set((state) => ({
    liveControls: {
      ...state.liveControls,
      ...values,
    },
  })),
  activeLeftPanel: 'Presets',
  setActiveLeftPanel: (panel) => set({ activeLeftPanel: panel }),
  autoVjEnabled: true,
  memoryRecallEnabled: true,
  musicCameraEnabled: true,
  audioFxReactive: true,
  autoVjSensitivity: 1.0,
  musicCameraAmount: 0.8,
  transitionEnergy: 0.45,
  audioDriveMode: 'api',
  visualMemories: loadStoredMemories(),
  visualScreens: defaultScreens,
  activeScreenId: 'A1',
  outputMode: 'mirror',
  screenTransitionStyle: 'crossfade',
  screenTransitionAmount: 0.65,
  screenAudioReactive: true,
  syncedScreenSignal: 0,
  setAutoVjControl: (key, value) => set({ [key]: value }),
  setAutoVjAmount: (key, value) => set({ [key]: value }),
  setAudioDriveMode: (mode) => set({ audioDriveMode: mode }),
  setActiveScreen: (id) => set((state) => {
    const screen = state.visualScreens.find((item) => item.id === id);
    return screen ? { activeScreenId: id, currentScene: screen.scene } : {};
  }),
  setScreenScene: (id, scene) => set((state) => ({
    visualScreens: state.visualScreens.map((screen) => (
      screen.id === id ? { ...screen, scene, enabled: true } : screen
    )),
    currentScene: state.activeScreenId === id ? scene : state.currentScene,
  })),
  setScreenEnabled: (id, enabled) => set((state) => ({
    visualScreens: state.visualScreens.map((screen) => (
      screen.id === id ? { ...screen, enabled } : screen
    )),
  })),
  setScreenControl: (key, value) => set({ [key]: value } as Partial<VisualizerState>),
  setSyncedScreenSignal: (value) => set((state) => (
    Math.abs(state.syncedScreenSignal - value) < 0.01 ? {} : { syncedScreenSignal: value }
  )),
  applyRemoteSyncState: (state) => set((current) => ({
    activeScreenId: state.activeScreenId ?? current.activeScreenId,
    visualScreens: state.visualScreens ?? current.visualScreens,
    outputMode: state.outputMode ?? current.outputMode,
    screenTransitionStyle: state.screenTransitionStyle ?? current.screenTransitionStyle,
    screenTransitionAmount: state.screenTransitionAmount ?? current.screenTransitionAmount,
    screenAudioReactive: state.screenAudioReactive ?? current.screenAudioReactive,
    syncedScreenSignal: state.syncedScreenSignal ?? current.syncedScreenSignal,
    currentScene: state.currentScene ?? current.currentScene,
    baseColor: state.baseColor ?? current.baseColor,
    secondaryColor: state.secondaryColor ?? current.secondaryColor,
    accentColor: state.accentColor ?? current.accentColor,
    bgColor: state.bgColor ?? current.bgColor,
    bloomIntensity: state.bloomIntensity ?? current.bloomIntensity,
    bloomThreshold: state.bloomThreshold ?? current.bloomThreshold,
    glitchActive: state.glitchActive ?? current.glitchActive,
    rgbSplitAmount: state.rgbSplitAmount ?? current.rgbSplitAmount,
    distortion: state.distortion ?? current.distortion,
    speed: state.speed ?? current.speed,
    chaos: state.chaos ?? current.chaos,
    saturation: state.saturation ?? current.saturation,
    contrast: state.contrast ?? current.contrast,
    brightness: state.brightness ?? current.brightness,
    gamma: state.gamma ?? current.gamma,
    exposure: state.exposure ?? current.exposure,
    textInput: state.textInput ?? current.textInput,
    textAnimStyle: state.textAnimStyle ?? current.textAnimStyle,
    textGlow: state.textGlow ?? current.textGlow,
    textSpeed: state.textSpeed ?? current.textSpeed,
    textReactive: state.textReactive ?? current.textReactive,
    textFontSize: state.textFontSize ?? current.textFontSize,
    textFontWeight: state.textFontWeight ?? current.textFontWeight,
    textLetterSpacing: state.textLetterSpacing ?? current.textLetterSpacing,
    autoVjEnabled: state.autoVjEnabled ?? current.autoVjEnabled,
    audioFxReactive: state.audioFxReactive ?? current.audioFxReactive,
    musicCameraEnabled: state.musicCameraEnabled ?? current.musicCameraEnabled,
    musicCameraAmount: state.musicCameraAmount ?? current.musicCameraAmount,
    transitionEnergy: state.transitionEnergy ?? current.transitionEnergy,
    audioDriveMode: state.audioDriveMode ?? current.audioDriveMode,
    liveControls: state.liveControls ? { ...current.liveControls, ...state.liveControls } : current.liveControls,
  })),
  saveVisualMemory: () => set((state) => {
    const memory = createMemorySnapshot(state, `Memory ${Math.min(state.visualMemories.length + 1, 8)}`);
    const visualMemories = [memory, ...state.visualMemories].slice(0, 8);
    persistMemories(visualMemories);
    return { visualMemories };
  }),
  applyVisualMemory: (id) => set((state) => {
    const memory = state.visualMemories.find((item) => item.id === id);
    return memory ? applyMemoryState(memory) : {};
  }),
  deleteVisualMemory: (id) => set((state) => {
    const visualMemories = state.visualMemories.filter((item) => item.id !== id);
    persistMemories(visualMemories);
    return { visualMemories };
  }),
  resetCurrentLook: () => set((state) => {
    const module = getVisualModule(state.currentScene);
    if (!module) return {};
    return {
      ...module.defaultLook,
      liveControls: {
        ...defaultLiveControls,
        selectedLookId: module.presetId,
        selectedSceneId: module.defaultLook.currentScene,
      },
    };
  }),
  applyPreset: (presetId) => {
    const look = getPresetLook(presetId);
    if (look) {
      set((state) => ({
        ...look,
        liveControls: {
          ...state.liveControls,
          selectedLookId: presetId,
          selectedSceneId: look.currentScene,
        },
      }));
      return;
    }
    switch(presetId) {
       case 'Layered Stage':
          set({
            currentScene: 'Layered Stage',
            visualInputSource: 'api',
            audioDriveMode: 'api',
            baseColor: '#00c3ff',
            secondaryColor: '#ff4f70',
            accentColor: '#ffffff',
            bgColor: '#020204',
            bloomIntensity: 0.9,
            rgbSplitAmount: 0,
            distortion: 0,
            glitchActive: false,
            speed: 1,
            chaos: 0.24,
            musicCameraEnabled: true,
            audioFxReactive: true
          });
          break;
       case 'Cyberpunk':
          set({ currentScene: 'Cyber', baseColor: '#00f3ff', secondaryColor: '#bf00ff', bloomIntensity: 2, textAnimStyle: 'Glitch' });
          break;
       case 'Liquid Dream':
          set({ currentScene: 'Liquid', baseColor: '#b026ff', secondaryColor: '#00ccff', bloomIntensity: 1.5, textAnimStyle: 'Floating' });
          break;
       case 'Chromaflux':
          set({
            currentScene: 'Chromaflux',
            baseColor: '#f00018',
            secondaryColor: '#3b0b96',
            accentColor: '#fff03a',
            bgColor: '#f2efec',
            bloomIntensity: 0.82,
            bloomThreshold: 0.5,
            rgbSplitAmount: 0.004,
            distortion: 0.14,
            speed: 0.62,
            chaos: 0.26,
            textAnimStyle: 'Floating'
          });
          break;
       case 'Sonic Topology':
          set({ currentScene: 'Topology', baseColor: '#ff4f70', secondaryColor: '#ff3366', accentColor: '#ff7f96', bgColor: '#000000', bloomIntensity: 1.8, distortion: 0.18, speed: 1.0, chaos: 0.25, textAnimStyle: 'Cinematic' });
          break;
       case 'Neon Pulse':
          set({
            currentScene: 'Pulse',
            baseColor: '#ff1600',
            secondaryColor: '#ff7a18',
            accentColor: '#ffffff',
            bgColor: '#020000',
            glitchActive: true,
            bloomIntensity: 2.45,
            rgbSplitAmount: 0.012,
            distortion: 0.42,
            speed: 1.35,
            chaos: 0.78,
            textInput: 'GAFA',
            textColor: '#ffffff',
            textFontSize: 4.6,
            textFontWeight: 900,
            textLetterSpacing: 0.02,
            textAnimStyle: 'Glitch'
          });
          break;
       case 'Dark Space':
          set({
            currentScene: 'Void',
            baseColor: '#ff1600',
            secondaryColor: '#28e6ff',
            accentColor: '#ffffff',
            bgColor: '#000000',
            bloomIntensity: 1.35,
            rgbSplitAmount: 0.0,
            distortion: 0.08,
            glitchActive: true,
            speed: 1.12,
            chaos: 0.62,
            textInput: 'play',
            textColor: '#ffffff',
            textFontSize: 5.4,
            textFontWeight: 900,
            textLetterSpacing: -0.08,
            textAnimStyle: 'Glitch'
          });
          break;
       case 'Blue Font':
          set({
            currentScene: 'Blue Font',
            baseColor: '#00c3ff',
            secondaryColor: '#8b5cff',
            accentColor: '#ffffff',
            bgColor: '#000713',
            bloomIntensity: 1.8,
            rgbSplitAmount: 0.007,
            distortion: 0.32,
            glitchActive: true,
            speed: 1.18,
            chaos: 0.54,
            textInput: 'BLUE\nFONT',
            textColor: '#dff8ff',
            textFontSize: 5.2,
            textFontWeight: 900,
            textLetterSpacing: -0.02,
            textAnimStyle: 'Glitch'
          });
          break;
       case 'Dumbar Base':
          set({ currentScene: 'Dumbar', baseColor: '#d8d8d8', secondaryColor: '#5f5f5f', bgColor: '#050505', bloomIntensity: 1.15, rgbSplitAmount: 0.0, distortion: 0.03, glitchActive: false, speed: 1.0, chaos: 0.42, contrast: 1.24, saturation: 1.08, brightness: 0.96, musicCameraEnabled: true, audioFxReactive: true });
          break;
    }
  }
}));
