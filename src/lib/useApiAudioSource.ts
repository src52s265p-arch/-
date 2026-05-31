import { useEffect, useRef } from 'react';
import { FIREBASE_DATABASE_URL, SHOW_BACKEND_URL, SHOW_CONTROL_TOKEN, SHOW_ID, SHOW_TRANSPORT, SHOW_WS_URL } from '@/lib/runtimeConfig';
import {
  setRemoteAudioEnabled,
  setRemoteAudioSnapshot,
  setRemoteMusicDriveFrame,
  type AudioDriveSnapshot,
  type MusicDriveFrame,
  type MusicLayerDrive,
  type MusicTransportState,
} from '@/lib/audioDrive';

const API_ENDPOINT = `${SHOW_BACKEND_URL}/api/audio-summary`;
const FALLBACK_POLL_INTERVAL_MS = 500;
const FALLBACK_STALE_MS = 250;
const FALLBACK_BACKOFF_MAX_MS = 10_000;
const WS_RECONNECT_MAX_MS = 15_000;

const wsUrl = SHOW_WS_URL;
const controlToken = SHOW_CONTROL_TOKEN;
const databaseUrl = FIREBASE_DATABASE_URL;
const showId = SHOW_ID;

export function useApiAudioSource(enabled: boolean) {
  const intervalRef = useRef<number | null>(null);
  const reconnectRef = useRef<number | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const lastUpdateAtRef = useRef<number>(0);
  const nextFallbackAtRef = useRef<number>(0);
  const fallbackFailureCountRef = useRef<number>(0);
  const lastFallbackWarnAtRef = useRef<number>(0);
  const wsFailureCountRef = useRef<number>(0);
  const clientIdRef = useRef(`vj-audio-drive-${createIdFragment()}`);

  useEffect(() => {
    let disposed = false;

    if (!enabled || !controlToken.trim()) {
      disposed = true;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (reconnectRef.current) {
        clearTimeout(reconnectRef.current);
        reconnectRef.current = null;
      }
      socketRef.current?.close();
      socketRef.current = null;
      setRemoteAudioEnabled(false);
      return;
    }

    setRemoteAudioEnabled(true);
    lastUpdateAtRef.current = performance.now();

    const fetchAudioData = async () => {
      const now = performance.now();
      if (now < nextFallbackAtRef.current) {
        return;
      }
      if (now - lastUpdateAtRef.current < FALLBACK_STALE_MS) {
        return;
      }

      try {
        const data = shouldReadFirebaseAudio() ? await fetchFirebaseAudioState() : await fetchBackendAudioSummary();
        const frame = parseMixerAudioFrame(data);
        if (!frame) return;

        setRemoteAudioSnapshot(frame.snapshot, frame.syncedSignal);
        if (frame.musicFrame) setRemoteMusicDriveFrame(frame.musicFrame);
        lastUpdateAtRef.current = now;
        fallbackFailureCountRef.current = 0;
        nextFallbackAtRef.current = 0;
      } catch (error) {
        fallbackFailureCountRef.current += 1;
        nextFallbackAtRef.current = now + Math.min(FALLBACK_BACKOFF_MAX_MS, 500 * 2 ** fallbackFailureCountRef.current);
        if (now - lastFallbackWarnAtRef.current > FALLBACK_BACKOFF_MAX_MS) {
          lastFallbackWarnAtRef.current = now;
          console.warn('Failed to fetch audio data from API:', error);
        }
      }
    };

    const connectAudioStream = () => {
      if (disposed) return;
      if (!isUsableWebSocketUrl(wsUrl)) return;

      const socket = new WebSocket(`${wsUrl}${wsUrl.includes('?') ? '&' : '?'}token=${encodeURIComponent(controlToken)}`);
      socketRef.current = socket;

      socket.addEventListener('open', () => {
        wsFailureCountRef.current = 0;
        socket.send(JSON.stringify({
          type: 'client.hello',
          clientId: clientIdRef.current,
          module: 'visual',
          role: 'audio-drive',
          token: controlToken,
          capabilities: ['mixer.audioFrame', 'audio.drive'],
        }));
      });

      socket.addEventListener('message', (event) => {
        const parsed = parseWebSocketPayload(event.data);
        if (!parsed) return;

        const frame = parseMixerAudioFrame(parsed);
        if (!frame) return;

        setRemoteAudioSnapshot(frame.snapshot, frame.syncedSignal);
        if (frame.musicFrame) setRemoteMusicDriveFrame(frame.musicFrame);
        lastUpdateAtRef.current = performance.now();
      });

      socket.addEventListener('close', () => {
        if (disposed) return;
        if (reconnectRef.current) {
          clearTimeout(reconnectRef.current);
        }
        wsFailureCountRef.current += 1;
        const reconnectDelay = Math.min(WS_RECONNECT_MAX_MS, 1200 * 2 ** Math.min(4, wsFailureCountRef.current - 1));
        reconnectRef.current = window.setTimeout(() => {
          if (!disposed) {
            connectAudioStream();
          }
        }, reconnectDelay);
      });

      socket.addEventListener('error', () => {
        socket.close();
      });
    };

    // Set up polling interval
    intervalRef.current = window.setInterval(() => {
      void fetchAudioData();
    }, FALLBACK_POLL_INTERVAL_MS);

    connectAudioStream();

    return () => {
      disposed = true;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (reconnectRef.current) {
        clearTimeout(reconnectRef.current);
        reconnectRef.current = null;
      }
      socketRef.current?.close();
      socketRef.current = null;
      setRemoteAudioEnabled(false);
    };
  }, [enabled]);
}

async function fetchBackendAudioSummary() {
  const response = await fetch(API_ENDPOINT, { headers: { 'x-control-token': controlToken } });
  if (!response.ok) throw new Error(`API responded with ${response.status}`);
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) throw new Error(`API responded with ${contentType || 'non-json content'}`);
  return response.json();
}

async function fetchFirebaseAudioState() {
  const audio = await fetchFirebaseJson(`shows/${safePath(showId)}/state/modules/audio`);
  const activeSourceId = isRecord(audio) && typeof audio.activeSourceId === 'string' ? audio.activeSourceId : '';
  if (!activeSourceId) return audio;
  const activeSource = await fetchFirebaseJson(`shows/${safePath(showId)}/state/audioSources/${safePath(activeSourceId)}`);
  return activeSource || audio;
}

async function fetchFirebaseJson(path: string) {
  const response = await fetch(firebaseJsonUrl(path));
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Firebase ${path} failed: ${response.status}`);
  return response.json();
}

function shouldReadFirebaseAudio() {
  if (!databaseUrl) return false;
  if (SHOW_TRANSPORT === 'firebase') return true;
  if (SHOW_TRANSPORT === 'websocket' || SHOW_TRANSPORT === 'cloudflare') return !isUsableWebSocketUrl(wsUrl);
  return !isUsableWebSocketUrl(wsUrl);
}

function firebaseJsonUrl(path: string) {
  return `${databaseUrl}/${path}.json`;
}

function safePath(value: string) {
  return value.replace(/[.#$/[\]]/g, '-');
}

function isUsableWebSocketUrl(value: string) {
  if (!value) return false;
  try {
    const url = new URL(value);
    if (!['ws:', 'wss:'].includes(url.protocol)) return false;
    if (window.location.protocol === 'https:' && url.protocol !== 'wss:') return false;
    return true;
  } catch {
    return false;
  }
}

function createIdFragment() {
  const uuid = globalThis.crypto?.randomUUID?.();
  return uuid ? uuid.slice(0, 8) : Math.random().toString(36).slice(2, 10);
}

/**
 * Normalize values to 0-1 range
 */
function normalizeValue(value: unknown, fallback: number = 0): number {
  if (typeof value !== 'number') return fallback;
  return Math.max(0, Math.min(1, value));
}

function parseWebSocketPayload(data: unknown): unknown | null {
  if (typeof data === 'string') {
    try {
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  return data;
}

function parseMixerAudioFrame(raw: unknown): { snapshot: Partial<AudioDriveSnapshot>; syncedSignal: number; musicFrame?: Partial<MusicDriveFrame> } | null {
  const source = findAudioFrameSource(raw);
  if (!source) return null;

  if (looksLikeMixerAudioFrame(source)) {
    const bands = extractFrequencyBands(source.frequencyBands);
    const level = normalizeValue(source.level);
    const rms = normalizeValue(source.rms);
    const peak = normalizeValue(source.peak);
    const beatValue = typeof source.beat === 'number' ? normalizeValue(source.beat) : source.speaking ? 1 : 0;

    const snapshot = {
      volume: level,
      subBass: averageBands(bands, 0, 0),
      bass: averageBands(bands, 1, 2),
      lowMid: averageBands(bands, 3, 5),
      mid: averageBands(bands, 6, 8),
      highMid: averageBands(bands, 9, 11),
      treble: averageBands(bands, 12, 15),
      energy: rms,
      beat: normalizeValue(beatValue),
      spectralCentroid: averageBands(bands, 0, 15),
      spectralFlux: peak,
      transient: Math.max(0, peak - rms),
      dynamicRange: Math.min(1, peak / (rms || 0.01)),
    };

    return {
      snapshot: {
        ...snapshot,
      },
      syncedSignal: level,
      musicFrame: buildMusicDriveFrame(source, bands, snapshot),
    };
  }

  const snapshot = {
    volume: normalizeValue(source.volume),
    subBass: normalizeValue(source.subBass),
    bass: normalizeValue(source.bass),
    lowMid: normalizeValue(source.lowMid),
    mid: normalizeValue(source.mid),
    highMid: normalizeValue(source.highMid),
    treble: normalizeValue(source.treble),
    energy: normalizeValue(source.energy),
    beat: normalizeValue(source.beat),
    spectralCentroid: normalizeValue(source.spectralCentroid),
    spectralFlux: normalizeValue(source.spectralFlux),
    transient: normalizeValue(source.transient),
    dynamicRange: normalizeValue(source.dynamicRange),
  };

  return {
    snapshot,
    syncedSignal: normalizeValue(source.syncedSignal ?? source.syncedScreenSignal ?? source.signal ?? source.syncSignal ?? 0),
  };
}

function buildMusicDriveFrame(
  source: Record<string, unknown>,
  frequencyBands: number[],
  snapshot: AudioDriveSnapshot,
): Partial<MusicDriveFrame> {
  const slotLevels = extractNumberList(source.slotLevels);
  const slotActivity = extractNumberList(source.slotActivity);
  const slotCategories = extractStringList(source.slotCategories ?? source.categories);
  const slotIds = extractStringList(source.slotIds);
  const slotNames = extractStringList(source.slotNames);
  const layers = deriveMusicLayers(snapshot, slotLevels, slotActivity, slotCategories, normalizeValue(source.styleEnergy));

  return {
    level: snapshot.volume,
    rms: snapshot.energy,
    peak: snapshot.spectralFlux,
    beat: snapshot.beat,
    activeStep: readBoundedNumber(source.activeStep, 0, 63, 0),
    stepProgress: normalizeValue(source.stepProgress),
    bpm: readBoundedNumber(source.bpm, 20, 260, 120),
    styleEnergy: normalizeValue(source.styleEnergy, snapshot.energy),
    styleId: typeof source.styleId === 'string' ? source.styleId : '',
    activePreset: typeof source.activePreset === 'string' ? source.activePreset : '',
    transport: readTransport(source.transport),
    masterLevel: normalizeValue(source.masterLevel, snapshot.volume),
    slotLevels,
    slotActivity,
    slotIds,
    slotNames,
    slotCategories,
    frequencyBands,
    layers,
  };
}

function deriveMusicLayers(
  snapshot: AudioDriveSnapshot,
  slotLevels: number[],
  slotActivity: number[],
  slotCategories: string[],
  styleEnergy: number,
): MusicLayerDrive {
  const knownLayout = ['beat', 'effect', 'bass', 'theme', 'theme', 'melody', 'experimental'];
  const categories = slotCategories.length ? slotCategories : knownLayout;
  const categoryDrive = (targets: string[], fallbackIndexes: number[]) => {
    let total = 0;
    let count = 0;
    categories.forEach((category, index) => {
      if (!targets.includes(category)) return;
      total += Math.max(slotLevels[index] ?? 0, slotActivity[index] ?? 0);
      count += 1;
    });
    if (count > 0) return normalizeValue(total / count);
    return averageList(fallbackIndexes.map((index) => Math.max(slotLevels[index] ?? 0, slotActivity[index] ?? 0)));
  };
  const transient = Math.max(snapshot.beat, snapshot.transient);

  return {
    drums: normalizeValue(Math.max(transient, categoryDrive(['beat'], [0]), snapshot.spectralFlux * 0.72)),
    bassline: normalizeValue(Math.max(snapshot.subBass, snapshot.bass, categoryDrive(['bass'], [2]))),
    melody: normalizeValue(Math.max(snapshot.mid, snapshot.highMid, categoryDrive(['melody'], [5]))),
    theme: normalizeValue(Math.max(snapshot.energy, styleEnergy, categoryDrive(['theme'], [3, 4]) * 0.95)),
    fx: normalizeValue(Math.max(snapshot.treble, snapshot.spectralFlux, categoryDrive(['effect'], [1]))),
    experimental: normalizeValue(Math.max(snapshot.dynamicRange * 0.45, snapshot.spectralCentroid, categoryDrive(['experimental', 'custom'], [6]))),
  };
}

function readTransport(value: unknown): MusicTransportState {
  return value === 'playing' || value === 'paused' || value === 'stopped' ? value : 'playing';
}

function readBoundedNumber(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, value));
}

function extractNumberList(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => normalizeValue(entry));
}

function extractStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => typeof entry === 'string' ? entry : '').filter(Boolean);
}

function averageList(values: number[]): number {
  if (!values.length) return 0;
  return normalizeValue(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function findAudioFrameSource(value: unknown, depth = 0): Record<string, unknown> | null {
  if (!isRecord(value) || depth > 3) return null;

  if (isMixerAudioFrameEnvelope(value)) {
    for (const key of ['payload', 'data', 'frame', 'audioFrame'] as const) {
      const nested = value[key];
      if (isRecord(nested)) {
        return findAudioFrameSource(nested, depth + 1) ?? nested;
      }
    }
    return value;
  }

  if (looksLikeAudioSnapshot(value)) {
    return value;
  }

  for (const key of ['payload', 'data', 'frame', 'audioFrame'] as const) {
    const nested = value[key];
    if (isRecord(nested)) {
      const source = findAudioFrameSource(nested, depth + 1);
      if (source) return source;
    }
  }

  return null;
}

function isMixerAudioFrameEnvelope(value: Record<string, unknown>) {
  return value.type === 'mixer.audioFrame' || value.event === 'mixer.audioFrame' || value.topic === 'mixer.audioFrame';
}

function looksLikeMixerAudioFrame(value: Record<string, unknown>) {
  return (
    isMixerAudioFrameEnvelope(value) ||
    typeof value.level === 'number' ||
    typeof value.rms === 'number' ||
    typeof value.peak === 'number' ||
    typeof value.speaking === 'boolean' ||
    value.frequencyBands !== undefined
  );
}

function looksLikeAudioSnapshot(value: Record<string, unknown>) {
  return [
    'volume',
    'subBass',
    'bass',
    'lowMid',
    'mid',
    'highMid',
    'treble',
    'energy',
    'beat',
    'spectralCentroid',
    'spectralFlux',
    'transient',
    'dynamicRange',
  ].some((key) => typeof value[key] === 'number');
}

function extractFrequencyBands(value: unknown): number[] {
  if (Array.isArray(value)) {
    return value.map((entry) => normalizeValue(entry));
  }

  if (!isRecord(value)) return [];

  if (typeof value.length === 'number') {
    const arrayLike = value as unknown as ArrayLike<unknown>;
    const bands: number[] = [];
    for (let index = 0; index < arrayLike.length; index += 1) {
      const entry = arrayLike[index];
      if (typeof entry === 'number') {
        bands.push(normalizeValue(entry));
      }
    }
    if (bands.length) return bands;
  }

  return Object.entries(value)
    .map(([key, entry]) => ({ index: Number(key), entry }))
    .filter(({ index, entry }) => Number.isInteger(index) && index >= 0 && typeof entry === 'number')
    .sort((left, right) => left.index - right.index)
    .map(({ entry }) => normalizeValue(entry));
}

function averageBands(bands: number[], start: number, end: number): number {
  const selected = bands.slice(start, end + 1);
  if (!selected.length) return 0;
  const total = selected.reduce((sum, value) => sum + value, 0);
  return normalizeValue(total / selected.length);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
