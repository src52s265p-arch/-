import type { VisualModuleDefinition } from '../types';
import { createAudioMapper, createLiveMapper } from '../mapping';

export const voidModule: VisualModuleDefinition = {
  id: 'Void',
  label: 'Dark Space',
  liveLabel: 'Void',
  presetId: 'Dark Space',
  description: 'Monochrome void and sparse glitch',
  renderMode: 'r3f',
  defaultLook: {
    currentScene: 'Void',
    baseColor: '#ff1600',
    secondaryColor: '#28e6ff',
    accentColor: '#ffffff',
    bgColor: '#000000',
    bloomIntensity: 1.35,
    rgbSplitAmount: 0,
    distortion: 0.08,
    glitchActive: true,
    speed: 1.12,
    chaos: 0.62,
    textInput: 'play',
    textColor: '#ffffff',
    textFontSize: 5.4,
    textFontWeight: 900,
    textLetterSpacing: -0.08,
    textAnimStyle: 'Glitch',
  },
  mapAudioToVisualState: createAudioMapper({ beat: 1.16, bass: 0.95, mid: 1.02, treble: 1.28, transient: 1.42, fx: 1.34, experimental: 1.28 }),
  mapLiveControlsToParams: createLiveMapper({ motion: 0.9, impact: 1.28, rhythmTightness: 1.0, punch: 1.34, detail: 1.2, variation: 1.75, structureScale: 1.4, structureWarp: 1.62, atmosphereGlow: 1.95, atmosphereDepth: 1.65, bloomBoost: 0.32, rgbSplitBoost: 0.026, chaosBoost: 0.9 }),
};
