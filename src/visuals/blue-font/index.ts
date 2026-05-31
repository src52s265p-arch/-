import type { VisualModuleDefinition } from '../types';
import { createAudioMapper, createLiveMapper } from '../mapping';

export const blueFontModule: VisualModuleDefinition = {
  id: 'Blue Font',
  label: 'Blue Font',
  liveLabel: 'Type',
  presetId: 'Blue Font',
  description: 'Liquid chrome blue typography',
  renderMode: 'blue-font',
  defaultLook: {
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
    textAnimStyle: 'Glitch',
  },
  mapAudioToVisualState: createAudioMapper({ beat: 1.12, bass: 0.95, mid: 1.16, treble: 1.25, transient: 1.25, fx: 1.22 }),
  mapLiveControlsToParams: createLiveMapper({ motion: 1.18, impact: 1.05, saturation: 1.35, brightness: 0.5, detail: 1.42, variation: 1.62, structureScale: 1.55, structureWarp: 1.24, atmosphereGlow: 1.75, atmosphereDepth: 0.8, rgbSplitBoost: 0.024 }),
};
