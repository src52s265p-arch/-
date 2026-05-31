import type { VisualModuleDefinition } from '../types';
import { createAudioMapper, createLiveMapper } from '../mapping';

export const chromafluxModule: VisualModuleDefinition = {
  id: 'Chromaflux',
  label: 'Chromaflux',
  liveLabel: 'Chroma',
  presetId: 'Chromaflux',
  description: 'Thermal liquid river',
  renderMode: 'r3f',
  defaultLook: {
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
    textAnimStyle: 'Floating',
  },
  mapAudioToVisualState: createAudioMapper({ energy: 1.18, bass: 1.05, mid: 1.1, treble: 1.18, theme: 1.18, experimental: 1.35 }),
  mapLiveControlsToParams: createLiveMapper({ motion: 1.08, impact: 1.12, warmth: 1.15, saturation: 1.72, brightness: 0.48, detail: 1.26, variation: 1.54, structureScale: 1.16, structureWarp: 1.58, atmosphereGlow: 1.42, atmosphereDepth: 1.34, distortionBoost: 0.3 }),
};
