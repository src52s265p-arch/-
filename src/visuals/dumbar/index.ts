import type { VisualModuleDefinition } from '../types';
import { createAudioMapper, createLiveMapper } from '../mapping';

export const dumbarModule: VisualModuleDefinition = {
  id: 'Dumbar',
  label: 'Grey Glass Blocks',
  liveLabel: 'Glass',
  presetId: 'Dumbar Base',
  description: 'Refractive tiles distorting text',
  renderMode: 'r3f',
  defaultLook: {
    currentScene: 'Dumbar',
    baseColor: '#d8d8d8',
    secondaryColor: '#5f5f5f',
    bgColor: '#050505',
    bloomIntensity: 1.15,
    rgbSplitAmount: 0,
    distortion: 0.03,
    glitchActive: false,
    speed: 1.0,
    chaos: 0.42,
    contrast: 1.24,
    saturation: 1.08,
    brightness: 0.96,
    musicCameraEnabled: true,
    audioFxReactive: true,
  },
  mapAudioToVisualState: createAudioMapper({ beat: 1.05, bass: 1.22, transient: 1.08, energy: 1.04, drums: 1.08, bassline: 1.22 }),
  mapLiveControlsToParams: createLiveMapper({ motion: 0.92, impact: 1.18, saturation: 0.85, brightness: 0.45, detail: 1.08, variation: 1.38, structureScale: 1.52, structureWarp: 1.42, atmosphereGlow: 1.18, atmosphereDepth: 1.72, distortionBoost: 0.18, chaosBoost: 0.55 }),
};
