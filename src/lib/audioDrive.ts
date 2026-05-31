import { audioEngine } from './AudioEngine';

export type AudioDriveMode = 'mic' | 'music' | 'api' | 'low' | 'mid' | 'high';

export interface AudioDriveSnapshot {
  volume: number;
  subBass: number;
  bass: number;
  lowMid: number;
  mid: number;
  highMid: number;
  treble: number;
  energy: number;
  beat: number;
  spectralCentroid: number;
  spectralFlux: number;
  transient: number;
  dynamicRange: number;
}

export type MusicTransportState = 'stopped' | 'playing' | 'paused';

export interface MusicLayerDrive {
  drums: number;
  bassline: number;
  melody: number;
  theme: number;
  fx: number;
  experimental: number;
}

export interface MusicDriveFrame {
  level: number;
  rms: number;
  peak: number;
  beat: number;
  activeStep: number;
  stepProgress: number;
  bpm: number;
  styleEnergy: number;
  styleId: string;
  activePreset: string;
  transport: MusicTransportState;
  masterLevel: number;
  slotLevels: number[];
  slotActivity: number[];
  slotIds: string[];
  slotNames: string[];
  slotCategories: string[];
  frequencyBands: number[];
  layers: MusicLayerDrive;
  updatedAt: number;
}

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const FRAME_MS = 1000 / 60;

const snapshotCache = new Map<AudioDriveMode, { frame: number; snapshot: AudioDriveSnapshot }>();
const getFrameIndex = () => {
  const now = typeof performance === 'undefined' ? Date.now() : performance.now();
  return Math.floor(now / FRAME_MS);
};
const clearSnapshotCache = () => snapshotCache.clear();

const createEmptyMusicDriveFrame = (): MusicDriveFrame => ({
  level: 0,
  rms: 0,
  peak: 0,
  beat: 0,
  activeStep: 0,
  stepProgress: 0,
  bpm: 120,
  styleEnergy: 0,
  styleId: '',
  activePreset: '',
  transport: 'stopped',
  masterLevel: 0,
  slotLevels: [],
  slotActivity: [],
  slotIds: [],
  slotNames: [],
  slotCategories: [],
  frequencyBands: [],
  layers: {
    drums: 0,
    bassline: 0,
    melody: 0,
    theme: 0,
    fx: 0,
    experimental: 0,
  },
  updatedAt: 0,
});

let musicProjectSnapshot: AudioDriveSnapshot = {
  volume: 0,
  subBass: 0,
  bass: 0,
  lowMid: 0,
  mid: 0,
  highMid: 0,
  treble: 0,
  energy: 0,
  beat: 0,
  spectralCentroid: 0,
  spectralFlux: 0,
  transient: 0,
  dynamicRange: 0,
};
let musicProjectLastUpdate = 0;

let remoteAudioEnabled = false;
let remoteAudioLastUpdate = 0;
let remoteImpulse = 0;
let remoteImpulseLastUpdate = 0;
let remoteAudioSnapshot: AudioDriveSnapshot = {
  volume: 0,
  subBass: 0,
  bass: 0,
  lowMid: 0,
  mid: 0,
  highMid: 0,
  treble: 0,
  energy: 0,
  beat: 0,
  spectralCentroid: 0,
  spectralFlux: 0,
  transient: 0,
  dynamicRange: 0,
};
let remoteMusicDriveFrame: MusicDriveFrame = createEmptyMusicDriveFrame();

export function setMusicProjectSnapshot(next: Partial<AudioDriveSnapshot>) {
  clearSnapshotCache();
  musicProjectLastUpdate = typeof performance === 'undefined' ? Date.now() : performance.now();
  musicProjectSnapshot = {
    ...musicProjectSnapshot,
    ...next,
  };
}

export function setRemoteAudioEnabled(enabled: boolean) {
  clearSnapshotCache();
  remoteAudioEnabled = enabled;
  const now = typeof performance === 'undefined' ? Date.now() : performance.now();
  remoteAudioLastUpdate = now;
  remoteImpulseLastUpdate = now;
  if (!enabled && audioEngine.activeSourceType === 'api') {
    audioEngine.stopCurrentAudioSource();
  }
}

export function setRemoteAudioSnapshot(next: Partial<AudioDriveSnapshot>, syncedSignal = 0) {
  clearSnapshotCache();
  const now = typeof performance === 'undefined' ? Date.now() : performance.now();
  remoteAudioLastUpdate = now;
  const screenImpact = clamp01((syncedSignal - 0.22) * 1.35);
  const incomingImpact = clamp01(Math.max(
    next.beat ?? 0,
    (next.transient ?? 0) * 0.95,
    (next.spectralFlux ?? 0) * 0.88,
    (next.energy ?? 0) * 0.72,
    (next.volume ?? 0) * 0.65,
    screenImpact,
  ));
  if (incomingImpact > remoteImpulse * 0.72) {
    remoteImpulse = Math.max(remoteImpulse * 0.35, incomingImpact);
    remoteImpulseLastUpdate = now;
  }
  remoteAudioSnapshot = {
    volume: Math.max(remoteAudioSnapshot.volume * 0.35, next.volume ?? remoteAudioSnapshot.volume),
    subBass: Math.max(remoteAudioSnapshot.subBass * 0.35, next.subBass ?? remoteAudioSnapshot.subBass),
    bass: Math.max(remoteAudioSnapshot.bass * 0.35, next.bass ?? remoteAudioSnapshot.bass),
    lowMid: Math.max(remoteAudioSnapshot.lowMid * 0.35, next.lowMid ?? remoteAudioSnapshot.lowMid),
    mid: Math.max(remoteAudioSnapshot.mid * 0.35, next.mid ?? remoteAudioSnapshot.mid),
    highMid: Math.max(remoteAudioSnapshot.highMid * 0.35, next.highMid ?? remoteAudioSnapshot.highMid),
    treble: Math.max(remoteAudioSnapshot.treble * 0.35, next.treble ?? remoteAudioSnapshot.treble),
    energy: Math.max(remoteAudioSnapshot.energy * 0.35, next.energy ?? remoteAudioSnapshot.energy),
    beat: Math.max(remoteAudioSnapshot.beat * 0.18, next.beat ?? remoteAudioSnapshot.beat),
    spectralCentroid: next.spectralCentroid ?? remoteAudioSnapshot.spectralCentroid,
    spectralFlux: Math.max(remoteAudioSnapshot.spectralFlux * 0.18, next.spectralFlux ?? remoteAudioSnapshot.spectralFlux),
    transient: Math.max(remoteAudioSnapshot.transient * 0.18, next.transient ?? remoteAudioSnapshot.transient),
    dynamicRange: Math.max(remoteAudioSnapshot.dynamicRange * 0.35, next.dynamicRange ?? remoteAudioSnapshot.dynamicRange),
  };
  audioEngine.setExternalSnapshot(remoteAudioSnapshot);
}

export function setRemoteMusicDriveFrame(next: Partial<MusicDriveFrame>) {
  const now = typeof performance === 'undefined' ? Date.now() : performance.now();
  remoteMusicDriveFrame = {
    ...remoteMusicDriveFrame,
    ...next,
    layers: {
      ...remoteMusicDriveFrame.layers,
      ...next.layers,
    },
    slotLevels: next.slotLevels ? [...next.slotLevels] : remoteMusicDriveFrame.slotLevels,
    slotActivity: next.slotActivity ? [...next.slotActivity] : remoteMusicDriveFrame.slotActivity,
    slotIds: next.slotIds ? [...next.slotIds] : remoteMusicDriveFrame.slotIds,
    slotNames: next.slotNames ? [...next.slotNames] : remoteMusicDriveFrame.slotNames,
    slotCategories: next.slotCategories ? [...next.slotCategories] : remoteMusicDriveFrame.slotCategories,
    frequencyBands: next.frequencyBands ? [...next.frequencyBands] : remoteMusicDriveFrame.frequencyBands,
    updatedAt: now,
  };
}

const pulse = (time: number, rate: number) => {
  const wave = Math.sin(time * rate);
  return Math.pow(Math.max(0, wave), 2.2);
};

const withLiveIdleFloor = (snapshot: AudioDriveSnapshot, mode: AudioDriveMode): AudioDriveSnapshot => {
  if (mode !== 'mic' && mode !== 'music' && mode !== 'api') return snapshot;

  const signal =
    snapshot.volume +
    snapshot.subBass +
    snapshot.bass +
    snapshot.lowMid +
    snapshot.mid +
    snapshot.highMid +
    snapshot.treble +
    snapshot.energy;

  if (signal > 0.08) return snapshot;

  const time = typeof performance === 'undefined' ? Date.now() * 0.001 : performance.now() * 0.001;
  const slow = 0.5 + 0.5 * Math.sin(time * 0.72);
  const drift = 0.5 + 0.5 * Math.sin(time * 1.17 + 1.4);
  const sourceLift = mode === 'mic' ? 1.0 : mode === 'api' ? 0.85 : 0.95;

  return {
    volume: Math.max(snapshot.volume, (0.055 + slow * 0.018) * sourceLift),
    subBass: Math.max(snapshot.subBass, 0.025 * sourceLift),
    bass: Math.max(snapshot.bass, (0.036 + slow * 0.014) * sourceLift),
    lowMid: Math.max(snapshot.lowMid, (0.034 + drift * 0.012) * sourceLift),
    mid: Math.max(snapshot.mid, (0.038 + drift * 0.012) * sourceLift),
    highMid: Math.max(snapshot.highMid, 0.026 * sourceLift),
    treble: Math.max(snapshot.treble, 0.022 * sourceLift),
    energy: Math.max(snapshot.energy, (0.058 + slow * 0.02) * sourceLift),
    beat: snapshot.beat,
    spectralCentroid: Math.max(snapshot.spectralCentroid, 0.28 + drift * 0.08),
    spectralFlux: Math.max(snapshot.spectralFlux, 0.026 + slow * 0.012),
    transient: snapshot.transient,
    dynamicRange: Math.max(snapshot.dynamicRange, 0.24 + drift * 0.08),
  };
};

export function getAudioDriveSnapshot(mode: AudioDriveMode): AudioDriveSnapshot {
  const frame = getFrameIndex();
  const cached = snapshotCache.get(mode);
  if (cached?.frame === frame) return cached.snapshot;

  let snapshot: AudioDriveSnapshot;

  if (mode === 'mic' || mode === 'music' || mode === 'api') {
    snapshot = withLiveIdleFloor({ ...audioEngine.current }, mode);
    snapshotCache.set(mode, { frame, snapshot });
    return snapshot;
  }

  const time = typeof performance === 'undefined' ? Date.now() * 0.001 : performance.now() * 0.001;
  const slowPulse = pulse(time, 3.2);
  const mediumPulse = pulse(time, 5.5);
  const fastPulse = pulse(time, 9.5);

  if (mode === 'low') {
    snapshot = {
      volume: 0.35 + slowPulse * 0.55,
      subBass: 0.55 + slowPulse * 0.45,
      bass: 0.5 + slowPulse * 0.45,
      lowMid: 0.12 + slowPulse * 0.12,
      mid: 0.08,
      highMid: 0.03,
      treble: 0.02,
      energy: 0.45 + slowPulse * 0.4,
      beat: slowPulse > 0.86 ? 1.05 : 0,
      spectralCentroid: 0.18 + slowPulse * 0.08,
      spectralFlux: slowPulse > 0.78 ? 0.48 : 0.08,
      transient: slowPulse > 0.88 ? 0.72 : 0.06,
      dynamicRange: 0.62 + slowPulse * 0.18,
    };
    snapshotCache.set(mode, { frame, snapshot });
    return snapshot;
  }

  if (mode === 'mid') {
    snapshot = {
      volume: 0.3 + mediumPulse * 0.42,
      subBass: 0.04,
      bass: 0.1 + mediumPulse * 0.08,
      lowMid: 0.42 + mediumPulse * 0.35,
      mid: 0.5 + mediumPulse * 0.38,
      highMid: 0.22 + mediumPulse * 0.18,
      treble: 0.08,
      energy: 0.34 + mediumPulse * 0.34,
      beat: mediumPulse > 0.9 ? 0.65 : 0,
      spectralCentroid: 0.38 + mediumPulse * 0.16,
      spectralFlux: mediumPulse > 0.72 ? 0.42 : 0.12,
      transient: mediumPulse > 0.88 ? 0.58 : 0.08,
      dynamicRange: 0.42 + mediumPulse * 0.22,
    };
    snapshotCache.set(mode, { frame, snapshot });
    return snapshot;
  }

  snapshot = {
    volume: 0.24 + fastPulse * 0.34,
    subBass: 0.02,
    bass: 0.04,
    lowMid: 0.08,
    mid: 0.18 + fastPulse * 0.12,
    highMid: 0.45 + fastPulse * 0.4,
    treble: 0.52 + fastPulse * 0.42,
    energy: 0.26 + fastPulse * 0.3,
    beat: clamp01(fastPulse * 0.5),
    spectralCentroid: 0.68 + fastPulse * 0.22,
    spectralFlux: 0.18 + fastPulse * 0.58,
    transient: fastPulse > 0.82 ? 0.72 : fastPulse * 0.32,
    dynamicRange: 0.28 + fastPulse * 0.34,
  };
  snapshotCache.set(mode, { frame, snapshot });
  return snapshot;
}

export function getMusicDriveFrame(mode: AudioDriveMode): MusicDriveFrame {
  const now = typeof performance === 'undefined' ? Date.now() : performance.now();
  const age = now - remoteMusicDriveFrame.updatedAt;

  if ((mode === 'api' || mode === 'music' || mode === 'mic') && remoteMusicDriveFrame.updatedAt > 0 && age < 2_500) {
    const decay = age < 120 ? 1 : Math.max(0.25, 1 - (age - 120) / 2_380);
    return {
      ...remoteMusicDriveFrame,
      level: remoteMusicDriveFrame.level * decay,
      rms: remoteMusicDriveFrame.rms * decay,
      peak: remoteMusicDriveFrame.peak * decay,
      beat: remoteMusicDriveFrame.beat * decay,
      styleEnergy: remoteMusicDriveFrame.styleEnergy * decay,
      masterLevel: remoteMusicDriveFrame.masterLevel * decay,
      layers: {
        drums: remoteMusicDriveFrame.layers.drums * decay,
        bassline: remoteMusicDriveFrame.layers.bassline * decay,
        melody: remoteMusicDriveFrame.layers.melody * decay,
        theme: remoteMusicDriveFrame.layers.theme * decay,
        fx: remoteMusicDriveFrame.layers.fx * decay,
        experimental: remoteMusicDriveFrame.layers.experimental * decay,
      },
    };
  }

  const audio = getAudioDriveSnapshot(mode);
  const time = typeof performance === 'undefined' ? Date.now() * 0.001 : performance.now() * 0.001;
  const step = Math.floor(time * 8) % 16;
  const progress = (time * 8) % 1;

  return {
    ...createEmptyMusicDriveFrame(),
    level: audio.volume,
    rms: audio.energy,
    peak: Math.max(audio.beat, audio.transient, audio.spectralFlux),
    beat: audio.beat,
    activeStep: step,
    stepProgress: progress,
    bpm: 120,
    styleEnergy: audio.energy,
    transport: 'playing',
    masterLevel: audio.volume,
    layers: {
      drums: Math.max(audio.beat, audio.transient),
      bassline: Math.max(audio.subBass, audio.bass),
      melody: Math.max(audio.mid, audio.highMid),
      theme: audio.energy,
      fx: Math.max(audio.treble, audio.spectralFlux),
      experimental: Math.max(audio.dynamicRange * 0.5, audio.spectralCentroid),
    },
    updatedAt: now,
  };
}
