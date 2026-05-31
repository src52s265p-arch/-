import type { LiveControls } from '@/store/useStore';

export type LivePadId = 'energy' | 'rhythm' | 'color' | 'structure' | 'texture' | 'atmosphere';

export interface LivePadDefinition {
  id: LivePadId;
  title: string;
  subtitle: string;
  xKey: keyof LiveControls;
  yKey: keyof LiveControls;
  accent: string;
  xLabel: string;
  yLabel: string;
}

export const LIVE_PAD_DEFINITIONS: LivePadDefinition[] = [
  {
    id: 'energy',
    title: 'Energy Pad',
    subtitle: 'motion / impact',
    xKey: 'energyX',
    yKey: 'energyY',
    accent: '#22d3ee',
    xLabel: 'Motion',
    yLabel: 'Impact',
  },
  {
    id: 'rhythm',
    title: 'Rhythm Pad',
    subtitle: 'follow / punch',
    xKey: 'rhythmX',
    yKey: 'rhythmY',
    accent: '#a3e635',
    xLabel: 'Follow',
    yLabel: 'Punch',
  },
  {
    id: 'color',
    title: 'Color Pad',
    subtitle: 'palette / light',
    xKey: 'colorX',
    yKey: 'colorY',
    accent: '#f59e0b',
    xLabel: 'Palette',
    yLabel: 'Light',
  },
  {
    id: 'structure',
    title: 'Structure Pad',
    subtitle: 'scale / composition',
    xKey: 'structureX',
    yKey: 'structureY',
    accent: '#818cf8',
    xLabel: 'Scale',
    yLabel: 'Shape',
  },
  {
    id: 'texture',
    title: 'Texture Pad',
    subtitle: 'detail / disruption',
    xKey: 'textureX',
    yKey: 'textureY',
    accent: '#f472b6',
    xLabel: 'Detail',
    yLabel: 'Break',
  },
  {
    id: 'atmosphere',
    title: 'Atmosphere Pad',
    subtitle: 'glow / camera depth',
    xKey: 'atmosphereX',
    yKey: 'atmosphereY',
    accent: '#38bdf8',
    xLabel: 'Glow',
    yLabel: 'Depth',
  },
];

export const LIVE_CONTROL_NUMERIC_KEYS = LIVE_PAD_DEFINITIONS.flatMap((pad) => [pad.xKey, pad.yKey]);

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const mix = (from: number, to: number, amount: number) => Math.round(from + (to - from) * amount);
const toHex = (value: number) => value.toString(16).padStart(2, '0');
const colorFromRgb = (rgb: [number, number, number]) => `#${toHex(rgb[0])}${toHex(rgb[1])}${toHex(rgb[2])}`;
const mixColor = (from: [number, number, number], to: [number, number, number], amount: number) => colorFromRgb([
  mix(from[0], to[0], amount),
  mix(from[1], to[1], amount),
  mix(from[2], to[2], amount),
]);

export function getLivePadPatch(pad: LivePadDefinition, x: number, y: number): Partial<LiveControls> {
  return {
    [pad.xKey]: clamp01(x),
    [pad.yKey]: clamp01(y),
  } as Partial<LiveControls>;
}

export function deriveLiveControlState(liveControls: LiveControls) {
  const colorWarmth = liveControls.colorX;
  const colorLight = liveControls.colorY;
  const structureScale = liveControls.structureX;
  const structureShape = liveControls.structureY;
  const textureDetail = liveControls.textureX;
  const textureBreak = liveControls.textureY;
  const glow = liveControls.atmosphereX;
  const depth = liveControls.atmosphereY;

  return {
    speed: 0.38 + liveControls.energyX * 1.72 + depth * 0.38,
    chaos: liveControls.energyY * 1.05 + structureShape * 0.36 + textureBreak * 0.54,
    transitionEnergy: 0.16 + liveControls.energyY * 0.42 + liveControls.rhythmY * 0.32 + glow * 0.22,
    baseColor: mixColor([0, 195, 255], [255, 92, 38], colorWarmth),
    secondaryColor: mixColor([139, 92, 255], [255, 226, 82], colorWarmth),
    saturation: 0.68 + colorLight * 1.45 + glow * 0.28,
    brightness: 0.78 + colorLight * 0.48 + glow * 0.25,
    exposure: 0.82 + glow * 1.1,
    bloomIntensity: 0.72 + glow * 1.85 + liveControls.energyY * 0.36,
    bloomThreshold: 0.14 + (1 - glow) * 0.32,
    autoVjSensitivity: 0.42 + liveControls.rhythmX * 1.42,
    beatMultiplier: 0.68 + liveControls.rhythmY * 2.15,
    musicCameraAmount: 0.24 + depth * 1.02,
    distortion: textureDetail * 0.22 + textureBreak * 0.32 + structureShape * 0.18,
    rgbSplitAmount: textureBreak * 0.018 + glow * 0.006,
    glitchActive: textureBreak > 0.68 || (glow > 0.82 && liveControls.energyY > 0.62),
    textGlow: 0.65 + glow * 1.85,
    textSpeed: 0.72 + liveControls.energyX * 0.7 + liveControls.rhythmX * 0.42,
    textReactive: 0.55 + liveControls.rhythmY * 1.35,
    textFontSize: 3.8 + structureScale * 2.2,
    textLetterSpacing: -0.06 + structureShape * 0.16,
  };
}

export function applyLiveControlPatch(current: LiveControls, patch: Partial<LiveControls>) {
  const liveControls = { ...current, ...patch };
  return {
    liveControls,
    ...deriveLiveControlState(liveControls),
  };
}
