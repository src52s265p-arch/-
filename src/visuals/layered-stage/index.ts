import type { VisualModuleDefinition } from '../types';
import { createAudioMapper, createLiveMapper } from '../mapping';

export const layeredStageModule: VisualModuleDefinition = {
  id: 'Layered Stage',
  label: 'Live Layered Stage',
  liveLabel: 'Layered',
  presetId: 'Layered Stage',
  description: 'Low-cost layered DJ-reactive stage',
  renderMode: 'canvas-2d',
  defaultLook: {
    currentScene: 'Layered Stage',
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
    audioFxReactive: true,
  },
  mapAudioToVisualState: createAudioMapper({ drums: 1.2, bassline: 1.12, melody: 1.05, theme: 1.1, fx: 1.08, experimental: 1.14 }),
  mapLiveControlsToParams: createLiveMapper({ motion: 1.05, impact: 1.22, rhythmTightness: 0.82, punch: 1.35, detail: 1.28, variation: 1.45, structureScale: 1.35, structureWarp: 1.5, atmosphereGlow: 1.2, atmosphereDepth: 1.1 }),
};
