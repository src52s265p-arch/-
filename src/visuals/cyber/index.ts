import type { VisualModuleDefinition } from '../types';
import { createAudioMapper, createLiveMapper } from '../mapping';

export const cyberModule: VisualModuleDefinition = {
  id: 'Cyber',
  label: 'Cyberpunk',
  liveLabel: 'Cyber',
  presetId: 'Cyberpunk',
  description: 'Neon blue high-glitch scene',
  renderMode: 'r3f',
  defaultLook: {
    currentScene: 'Cyber',
    baseColor: '#00f3ff',
    secondaryColor: '#bf00ff',
    bloomIntensity: 2,
    textAnimStyle: 'Glitch',
  },
  mapAudioToVisualState: createAudioMapper({ beat: 1.18, bass: 1.02, treble: 1.34, transient: 1.24, fx: 1.32, experimental: 1.12 }),
  mapLiveControlsToParams: createLiveMapper({ motion: 1.2, impact: 1.22, saturation: 1.48, detail: 1.22, variation: 1.68, structureScale: 1.7, structureWarp: 1.28, atmosphereGlow: 1.86, atmosphereDepth: 1.25, bloomBoost: 0.55, rgbSplitBoost: 0.03, chaosBoost: 0.88 }),
};
