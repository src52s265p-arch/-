import type { AudioDriveSnapshot, MusicDriveFrame } from '@/lib/audioDrive';

export type VisualSceneId =
  | 'Layered Stage'
  | 'Video Flow'
  | 'Purple'
  | 'Blue Font'
  | 'Pulse'
  | 'Liquid'
  | 'Topology'
  | 'Chromaflux'
  | 'Dumbar'
  | 'Void'
  | 'Cyber';

export interface VisualLookDefaults {
  currentScene: VisualSceneId;
  baseColor: string;
  secondaryColor: string;
  accentColor?: string;
  bgColor?: string;
  bloomIntensity?: number;
  bloomThreshold?: number;
  rgbSplitAmount?: number;
  distortion?: number;
  glitchActive?: boolean;
  speed?: number;
  chaos?: number;
  textInput?: string;
  textColor?: string;
  textFontSize?: number;
  textFontWeight?: number;
  textLetterSpacing?: number;
  textAnimStyle?: string;
  musicCameraEnabled?: boolean;
  audioFxReactive?: boolean;
  saturation?: number;
  contrast?: number;
  brightness?: number;
}

export interface VisualModuleLiveControls {
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
}

export interface VisualModuleAudioState {
  level: number;
  beat: number;
  bass: number;
  mid: number;
  treble: number;
  transient: number;
  energy: number;
  stepProgress: number;
  activeStep: number;
  bpm: number;
  semanticSeed: string;
  layers: {
    drums: number;
    bassline: number;
    melody: number;
    theme: number;
    fx: number;
    experimental: number;
  };
}

export interface VisualModuleLiveParams {
  motion: number;
  impact: number;
  warmth: number;
  saturation: number;
  brightness: number;
  rhythmTightness: number;
  punch: number;
  detail: number;
  variation: number;
  structureScale: number;
  structureWarp: number;
  atmosphereGlow: number;
  atmosphereDepth: number;
  bloomBoost: number;
  distortionBoost: number;
  rgbSplitBoost: number;
  chaosBoost: number;
}

export interface VisualModuleDefinition {
  id: VisualSceneId;
  label: string;
  liveLabel: string;
  presetId: string;
  description: string;
  renderMode: 'canvas-2d' | 'blue-font' | 'webgl-2d' | 'r3f';
  defaultLook: VisualLookDefaults;
  mapAudioToVisualState: (audio: AudioDriveSnapshot, music: MusicDriveFrame) => VisualModuleAudioState;
  mapLiveControlsToParams: (live: VisualModuleLiveControls) => VisualModuleLiveParams;
}
