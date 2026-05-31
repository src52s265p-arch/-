import type { VisualModuleDefinition } from '../types';
import { createAudioMapper, createLiveMapper } from '../mapping';

export const topologyModule: VisualModuleDefinition = {
  id: 'Topology',
  label: 'Sonic Topology',
  liveLabel: 'Topo',
  presetId: 'Sonic Topology',
  description: 'Liquified contour type',
  renderMode: 'r3f',
  defaultLook: {
    currentScene: 'Topology',
    baseColor: '#ff4f70',
    secondaryColor: '#ff3366',
    accentColor: '#ff7f96',
    bgColor: '#000000',
    bloomIntensity: 1.8,
    distortion: 0.18,
    speed: 1.0,
    chaos: 0.25,
    textAnimStyle: 'Cinematic',
  },
  mapAudioToVisualState: createAudioMapper({ mid: 1.26, treble: 1.12, transient: 1.1, melody: 1.25, fx: 1.14, experimental: 1.3 }),
  mapLiveControlsToParams: createLiveMapper({ motion: 1.0, impact: 1.05, rhythmTightness: 1.05, punch: 1.2, detail: 1.72, variation: 1.16, structureScale: 1.8, structureWarp: 1.68, atmosphereGlow: 0.9, atmosphereDepth: 1.2, distortionBoost: 0.22 }),
};
