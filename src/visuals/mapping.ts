import type {
  VisualModuleAudioState,
  VisualModuleLiveControls,
  VisualModuleLiveParams,
} from './types';
import type { AudioDriveSnapshot, MusicDriveFrame } from '@/lib/audioDrive';

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

interface AudioMapProfile {
  beat?: number;
  bass?: number;
  mid?: number;
  treble?: number;
  transient?: number;
  energy?: number;
  drums?: number;
  bassline?: number;
  melody?: number;
  theme?: number;
  fx?: number;
  experimental?: number;
}

interface LiveMapProfile {
  motion?: number;
  impact?: number;
  warmth?: number;
  saturation?: number;
  brightness?: number;
  rhythmTightness?: number;
  punch?: number;
  detail?: number;
  variation?: number;
  structureScale?: number;
  structureWarp?: number;
  atmosphereGlow?: number;
  atmosphereDepth?: number;
  bloomBoost?: number;
  distortionBoost?: number;
  rgbSplitBoost?: number;
  chaosBoost?: number;
}

export function createAudioMapper(profile: AudioMapProfile = {}) {
  return (audio: AudioDriveSnapshot, music: MusicDriveFrame): VisualModuleAudioState => {
    const semanticSeed = [
      music.styleId,
      music.activePreset,
      music.transport,
      music.slotIds.join(','),
      music.slotNames.join(','),
      music.slotCategories.join(','),
      Math.round(music.bpm),
    ].join(':');

    return {
      level: clamp01(Math.max(music.level, audio.volume) * (profile.energy ?? 1)),
      beat: clamp01(Math.max(music.beat, audio.beat) * (profile.beat ?? 1)),
      bass: clamp01(Math.max(audio.subBass, audio.bass, music.layers.bassline) * (profile.bass ?? 1)),
      mid: clamp01(Math.max(audio.lowMid, audio.mid, music.layers.melody) * (profile.mid ?? 1)),
      treble: clamp01(Math.max(audio.highMid, audio.treble, music.layers.fx) * (profile.treble ?? 1)),
      transient: clamp01(Math.max(audio.transient, audio.spectralFlux, music.beat) * (profile.transient ?? 1)),
      energy: clamp01(Math.max(music.styleEnergy, music.level, audio.energy) * (profile.energy ?? 1)),
      stepProgress: music.stepProgress,
      activeStep: music.activeStep,
      bpm: music.bpm,
      semanticSeed,
      layers: {
        drums: clamp01(Math.max(music.layers.drums, audio.beat, audio.transient) * (profile.drums ?? 1)),
        bassline: clamp01(Math.max(music.layers.bassline, audio.bass, audio.subBass) * (profile.bassline ?? 1)),
        melody: clamp01(Math.max(music.layers.melody, audio.mid, audio.lowMid) * (profile.melody ?? 1)),
        theme: clamp01(Math.max(music.layers.theme, music.styleEnergy, audio.energy) * (profile.theme ?? 1)),
        fx: clamp01(Math.max(music.layers.fx, audio.treble, audio.spectralFlux) * (profile.fx ?? 1)),
        experimental: clamp01(Math.max(music.layers.experimental, audio.spectralCentroid, audio.dynamicRange) * (profile.experimental ?? 1)),
      },
    };
  };
}

export function createLiveMapper(profile: LiveMapProfile = {}) {
  return (live: VisualModuleLiveControls): VisualModuleLiveParams => ({
    motion: 0.5 + live.energyX * (profile.motion ?? 1.35),
    impact: 0.55 + live.energyY * (profile.impact ?? 1.25),
    warmth: clamp01(live.colorX * (profile.warmth ?? 1)),
    saturation: 0.65 + live.colorY * (profile.saturation ?? 1.55),
    brightness: 0.76 + live.colorY * (profile.brightness ?? 0.62),
    rhythmTightness: 0.18 + live.rhythmX * (profile.rhythmTightness ?? 0.82),
    punch: 0.62 + live.rhythmY * (profile.punch ?? 1.38),
    detail: 0.55 + live.textureX * (profile.detail ?? 1.35),
    variation: 0.52 + live.textureY * (profile.variation ?? 1.45),
    structureScale: 0.62 + live.structureX * (profile.structureScale ?? 1.24),
    structureWarp: 0.48 + live.structureY * (profile.structureWarp ?? 1.42),
    atmosphereGlow: 0.42 + live.atmosphereX * (profile.atmosphereGlow ?? 1.7),
    atmosphereDepth: 0.35 + live.atmosphereY * (profile.atmosphereDepth ?? 1.45),
    bloomBoost: live.atmosphereX * (profile.bloomBoost ?? 0.42) + live.energyY * 0.18,
    distortionBoost: live.textureX * (profile.distortionBoost ?? 0.34) + live.structureY * 0.12,
    rgbSplitBoost: live.textureY * (profile.rgbSplitBoost ?? 0.018) + live.atmosphereX * 0.004,
    chaosBoost: live.textureY * (profile.chaosBoost ?? 0.72) + live.structureY * 0.22,
  });
}
