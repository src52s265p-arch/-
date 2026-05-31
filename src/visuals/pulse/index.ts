import type { VisualModuleDefinition } from '../types';
import { createAudioMapper, createLiveMapper } from '../mapping';

export const pulseModule: VisualModuleDefinition = {
  id: 'Pulse',
  label: 'Neon Pulse',
  liveLabel: 'Pulse',
  presetId: 'Neon Pulse',
  description: 'Aggressive bass pulse and glitch',
  renderMode: 'r3f',
  defaultLook: {
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
    textAnimStyle: 'Glitch',
  },
  mapAudioToVisualState: createAudioMapper({ beat: 1.35, bass: 1.28, transient: 1.24, energy: 1.16, drums: 1.25, fx: 1.18 }),
  mapLiveControlsToParams: createLiveMapper({ motion: 1.45, impact: 1.55, rhythmTightness: 0.95, punch: 1.62, structureScale: 1.08, structureWarp: 1.35, variation: 1.5, atmosphereGlow: 2.05, atmosphereDepth: 0.75, bloomBoost: 0.62, distortionBoost: 0.48 }),
};
