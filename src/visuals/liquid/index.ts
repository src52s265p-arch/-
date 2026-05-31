import type { VisualModuleDefinition } from '../types';
import { createAudioMapper, createLiveMapper } from '../mapping';

export const liquidModule: VisualModuleDefinition = {
  id: 'Liquid',
  label: 'Liquid Dream',
  liveLabel: 'Liquid',
  presetId: 'Liquid Dream',
  description: 'Organic merging SDF fluid',
  renderMode: 'r3f',
  defaultLook: {
    currentScene: 'Liquid',
    baseColor: '#b026ff',
    secondaryColor: '#00ccff',
    bloomIntensity: 1.5,
    textAnimStyle: 'Floating',
  },
  mapAudioToVisualState: createAudioMapper({ bass: 1.12, mid: 1.18, energy: 1.1, melody: 1.22, theme: 1.12, experimental: 1.18 }),
  mapLiveControlsToParams: createLiveMapper({ motion: 1.22, impact: 0.95, saturation: 1.65, brightness: 0.55, detail: 1.5, variation: 1.25, structureScale: 1.18, structureWarp: 1.72, atmosphereGlow: 1.36, atmosphereDepth: 1.58, distortionBoost: 0.28 }),
};
