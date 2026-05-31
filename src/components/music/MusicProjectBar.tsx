import React, { useEffect, useRef, useState } from 'react';
import { Link2, Music2, Play, Square, Upload, Volume2, VolumeX } from 'lucide-react';
import { audioEngine } from '@/lib/AudioEngine';
import { useStore } from '@/store/useStore';

type LayerId = 'house' | 'bass' | 'arp' | 'hat' | 'fx';

interface LayerDef {
  id: LayerId;
  name: string;
  color: string;
  band: 'low' | 'mid' | 'high';
  pattern: string;
}

interface MusicPreset {
  id: string;
  name: string;
  enabled: Record<LayerId, boolean>;
  patterns: Record<LayerId, string>;
}

const layers: LayerDef[] = [
  { id: 'house', name: 'House', color: 'bg-red-500', band: 'low', pattern: 'K...K...K...K...' },
  { id: 'bass', name: 'Bass', color: 'bg-blue-500', band: 'low', pattern: 'a.....a.c...a...' },
  { id: 'arp', name: 'Arp', color: 'bg-green-500', band: 'mid', pattern: 'h.j.l.h.j.l.h.j.' },
  { id: 'hat', name: 'Hat', color: 'bg-orange-500', band: 'high', pattern: 'H.H.H.H.H.H.H.H.' },
  { id: 'fx', name: 'Glitch', color: 'bg-fuchsia-500', band: 'high', pattern: 'X.X...X.XX..X...' },
];

const musicPresets: MusicPreset[] = [
  {
    id: 'club',
    name: 'Club',
    enabled: { house: true, bass: true, arp: false, hat: true, fx: false },
    patterns: {
      house: 'K...K...K...K...',
      bass: 'a.....a.c...a...',
      arp: '................',
      hat: 'H.H.H.H.H.H.H.H.',
      fx: '................',
    },
  },
  {
    id: 'melodic',
    name: 'Melodic',
    enabled: { house: true, bass: true, arp: true, hat: true, fx: false },
    patterns: {
      house: 'K...K...K...K...',
      bass: 'a.....a.c...a...',
      arp: 'h.j.l.h.j.l.h.j.',
      hat: '..H...H...H...H.',
      fx: '................',
    },
  },
  {
    id: 'break',
    name: 'Break',
    enabled: { house: true, bass: false, arp: false, hat: true, fx: true },
    patterns: {
      house: 'K...S..K..K.S...',
      bass: '................',
      arp: '................',
      hat: 'HH..H.H...H.H...',
      fx: 'X.X...X.XX..X...',
    },
  },
  {
    id: 'full',
    name: 'Full',
    enabled: { house: true, bass: true, arp: true, hat: true, fx: true },
    patterns: {
      house: 'K.H.S.H.K.H.S.H.',
      bass: 'a.a.....c.e.....',
      arp: 'l.j.h.l.j.h.l.j.',
      hat: 'H.H.H.H.H.H.H.H.',
      fx: 'X...X...Y...X...',
    },
  },
];

const noteMap: Record<string, number> = {
  a: 48,
  e: 55,
  c: 52,
  h: 60,
  j: 64,
  l: 67,
  Y: 72,
};

const getLinkLabel = (value: string) => {
  try {
    return new URL(value).hostname.replace(/^www\./, '');
  } catch {
    return 'Music Link';
  }
};

const makeNoiseBuffer = (ctx: AudioContext, duration: number) => {
  const buffer = ctx.createBuffer(1, Math.max(1, Math.floor(ctx.sampleRate * duration)), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
};

const playKick = (ctx: AudioContext, out: AudioNode) => {
  const time = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(120, time);
  osc.frequency.exponentialRampToValueAtTime(38, time + 0.35);
  filter.type = 'lowpass';
  filter.frequency.value = 420;
  gain.gain.setValueAtTime(0.85, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.38);
  osc.connect(filter);
  filter.connect(gain);
  gain.connect(out);
  osc.start(time);
  osc.stop(time + 0.4);
};

const playHat = (ctx: AudioContext, out: AudioNode) => {
  const time = ctx.currentTime;
  const source = ctx.createBufferSource();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();
  source.buffer = makeNoiseBuffer(ctx, 0.04);
  filter.type = 'highpass';
  filter.frequency.value = 7000;
  gain.gain.setValueAtTime(0.18, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.045);
  source.connect(filter);
  filter.connect(gain);
  gain.connect(out);
  source.start(time);
};

const playSnare = (ctx: AudioContext, out: AudioNode) => {
  const time = ctx.currentTime;
  const source = ctx.createBufferSource();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();
  source.buffer = makeNoiseBuffer(ctx, 0.14);
  filter.type = 'bandpass';
  filter.frequency.value = 1800;
  filter.Q.value = 1.6;
  gain.gain.setValueAtTime(0.34, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.14);
  source.connect(filter);
  filter.connect(gain);
  gain.connect(out);
  source.start(time);
};

const playBass = (ctx: AudioContext, out: AudioNode, note: number) => {
  const time = ctx.currentTime;
  const osc = ctx.createOscillator();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();
  const freq = 440 * Math.pow(2, (note - 69) / 12) * 0.5;
  osc.type = 'square';
  osc.frequency.setValueAtTime(freq, time);
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(180, time);
  filter.frequency.exponentialRampToValueAtTime(760, time + 0.08);
  gain.gain.setValueAtTime(0.34, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.22);
  osc.connect(filter);
  filter.connect(gain);
  gain.connect(out);
  osc.start(time);
  osc.stop(time + 0.24);
};

const playArp = (ctx: AudioContext, out: AudioNode, note: number) => {
  const time = ctx.currentTime;
  const osc = ctx.createOscillator();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();
  const freq = 440 * Math.pow(2, (note - 69) / 12);
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(freq, time);
  filter.type = 'lowpass';
  filter.frequency.value = 3200;
  gain.gain.setValueAtTime(0.14, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.18);
  osc.connect(filter);
  filter.connect(gain);
  gain.connect(out);
  osc.start(time);
  osc.stop(time + 0.2);
};

const playGlitch = (ctx: AudioContext, out: AudioNode) => {
  const time = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(600 + Math.random() * 900, time);
  osc.frequency.exponentialRampToValueAtTime(120, time + 0.08);
  gain.gain.setValueAtTime(0.1, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.1);
  osc.connect(gain);
  gain.connect(out);
  osc.start(time);
  osc.stop(time + 0.11);
};

export function MusicProjectBar() {
  const { setAudioDriveMode, setAutoVjControl, setVisualInputSource } = useStore();
  const [isPlaying, setIsPlaying] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [volume, setVolume] = useState(0.85);
  const [activePresetId, setActivePresetId] = useState(musicPresets[1].id);
  const [musicUrl, setMusicUrl] = useState('');
  const [linkStatus, setLinkStatus] = useState('');
  const [linkLoading, setLinkLoading] = useState(false);
  const [uploadedName, setUploadedName] = useState('');
  const [uploadedBuffer, setUploadedBuffer] = useState<AudioBuffer | null>(null);
  const [activeStep, setActiveStep] = useState(0);
  const [enabledLayers, setEnabledLayers] = useState<Record<LayerId, boolean>>({
    house: true,
    bass: true,
    arp: true,
    hat: true,
    fx: false,
  });
  const enabledLayersRef = useRef(enabledLayers);
  const ctxRef = useRef<AudioContext | null>(null);
  const masterRef = useRef<GainNode | null>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const uploadSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const linkedElementSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const linkedAudioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<number | null>(null);
  const stepRef = useRef(0);
  const activePresetRef = useRef(musicPresets[1]);
  const soundEnabledRef = useRef(soundEnabled);
  const volumeRef = useRef(volume);

  const ensureAudio = async () => {
    const { context, input } = await audioEngine.ensureMusicSource(soundEnabledRef.current ? volumeRef.current : 0);
    ctxRef.current = context;
    masterRef.current = input;
    return { ctx: context, master: input };
  };

  const stopUploadedAudio = () => {
    if (uploadSourceRef.current) {
      try {
        uploadSourceRef.current.stop();
      } catch {
        // Already stopped.
      }
      try {
        uploadSourceRef.current.disconnect();
      } catch {
        // Already disconnected by the audio source manager.
      }
      uploadSourceRef.current = null;
    }
    linkedElementSourceRef.current?.disconnect();
    linkedElementSourceRef.current = null;
    if (linkedAudioRef.current) {
      linkedAudioRef.current.pause();
      linkedAudioRef.current.src = '';
      linkedAudioRef.current.load();
      linkedAudioRef.current = null;
    }
  };

  const playUploadedAudio = async (buffer = uploadedBuffer) => {
    if (!buffer) return;
    stop();
    stopUploadedAudio();
    const { ctx, master } = await ensureAudio();

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.connect(master);
    source.start();
    audioEngine.registerMusicNode(source);
    uploadSourceRef.current = source;

    setAudioDriveMode('music');
    setVisualInputSource('music');
    setAutoVjControl('autoVjEnabled', true);
    setIsPlaying(true);
  };

  const playDirectLinkedAudio = async (url: string) => {
    stop();
    stopUploadedAudio();
    const { ctx, master } = await ensureAudio();

    const audio = new Audio(url);
    audio.crossOrigin = 'anonymous';
    audio.loop = true;
    audio.volume = soundEnabledRef.current ? volumeRef.current : 0;
    linkedAudioRef.current = audio;
    const elementSource = ctx.createMediaElementSource(audio);
    elementSource.connect(master);
    linkedElementSourceRef.current = elementSource;
    audioEngine.registerMusicNode(elementSource);

    await audio.play();
    setAudioDriveMode('music');
    setVisualInputSource('music');
    setAutoVjControl('autoVjEnabled', true);
    setIsPlaying(true);
    setUploadedName(getLinkLabel(url));
    setUploadedBuffer(null);
    setLinkStatus('Direct audio');
  };

  const playLinkedAudio = async () => {
    const url = musicUrl.trim();
    if (!url) return;

    setLinkLoading(true);
    setLinkStatus('Loading link');
    try {
      new URL(url);
      const { ctx } = await ensureAudio();
      const response = await fetch(url, { mode: 'cors' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const arrayBuffer = await response.arrayBuffer();
      const decoded = await ctx.decodeAudioData(arrayBuffer.slice(0));
      setUploadedName(getLinkLabel(url));
      setUploadedBuffer(decoded);
      setLinkStatus('Analyzing link');
      await playUploadedAudio(decoded);
    } catch {
      try {
        await playDirectLinkedAudio(url);
      } catch {
        setLinkStatus('Link unavailable');
      }
    } finally {
      setLinkLoading(false);
    }
  };

  const getLayerPattern = (layerId: LayerId) => activePresetRef.current.patterns[layerId] || layers.find((layer) => layer.id === layerId)?.pattern || '................';

  useEffect(() => {
    enabledLayersRef.current = enabledLayers;
  }, [enabledLayers]);

  useEffect(() => {
    const preset = musicPresets.find((item) => item.id === activePresetId) || musicPresets[0];
    activePresetRef.current = preset;
  }, [activePresetId]);

  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
    volumeRef.current = volume;
    if (masterRef.current && ctxRef.current) {
      audioEngine.setMusicVolume(soundEnabled ? volume : 0);
    }
    if (linkedAudioRef.current) linkedAudioRef.current.volume = soundEnabled ? volume : 0;
  }, [soundEnabled, volume]);

  const triggerStep = async () => {
    const { ctx, master } = await ensureAudio();
    const step = stepRef.current;

    layers.forEach((layer) => {
      if (!enabledLayersRef.current[layer.id]) return;
      const token = getLayerPattern(layer.id)[step] || '.';
      if (token === '.') return;

      if (token === 'K') {
        playKick(ctx, master);
      } else if (token === 'S') {
        playSnare(ctx, master);
      } else if (token === 'H') {
        playHat(ctx, master);
      } else if (token === 'X' || token === 'Y') {
        playGlitch(ctx, master);
      } else if (noteMap[token]) {
        if (layer.id === 'bass') {
          playBass(ctx, master, noteMap[token]);
        } else {
          playArp(ctx, master, noteMap[token]);
        }
      }
    });

    setActiveStep(step);
    stepRef.current = (step + 1) % 16;
  };

  const stop = () => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsPlaying(false);
    audioEngine.stopCurrentAudioSource();
  };

  const togglePlay = () => {
    if (isPlaying) {
      stopUploadedAudio();
      stop();
      return;
    }

    if (uploadedBuffer) {
      void playUploadedAudio(uploadedBuffer);
      return;
    }

    if (musicUrl.trim()) {
      void playLinkedAudio();
      return;
    }

    setAudioDriveMode('music');
    setVisualInputSource('music');
    setAutoVjControl('autoVjEnabled', true);
    stepRef.current = 0;
    void triggerStep();
    timerRef.current = window.setInterval(() => void triggerStep(), 125);
    setIsPlaying(true);
  };

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const { ctx } = await ensureAudio();
    const arrayBuffer = await file.arrayBuffer();
    const decoded = await ctx.decodeAudioData(arrayBuffer.slice(0));
    setMusicUrl('');
    setLinkStatus('');
    setUploadedName(file.name);
    setUploadedBuffer(decoded);
    void playUploadedAudio(decoded);
    event.target.value = '';
  };

  const handleLinkSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void playLinkedAudio();
  };

  const applyPreset = (preset: MusicPreset) => {
    setActivePresetId(preset.id);
    activePresetRef.current = preset;
    enabledLayersRef.current = preset.enabled;
    setEnabledLayers(preset.enabled);
    setAudioDriveMode('music');
    setVisualInputSource('music');
    setAutoVjControl('autoVjEnabled', true);
  };

  useEffect(() => {
    const handleStopMusic = () => {
      stopUploadedAudio();
      stop();
    };

    window.addEventListener('vj:stop-music', handleStopMusic);
    return () => window.removeEventListener('vj:stop-music', handleStopMusic);
  }, []);

  useEffect(() => () => {
    stopUploadedAudio();
    stop();
  }, []);

  return (
    <div className="shrink-0 border-b border-white/10 bg-[#050505] px-4 py-3 md:h-[164px]">
      <div className="flex h-full min-w-0 flex-col gap-4 overflow-hidden md:flex-row">
        <div className="flex w-full shrink-0 flex-col gap-3 md:w-44 md:justify-between">
          <div className="flex items-center gap-3 text-white/80">
            <Music2 size={16} className="text-emerald-300" />
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest">Music Project</div>
              <div className="mt-1 text-[9px] uppercase tracking-widest text-white/35">120 BPM Sequencer</div>
            </div>
          </div>
          <button
            onClick={togglePlay}
            className={`flex min-h-11 md:h-10 items-center justify-center gap-2 rounded-lg text-[11px] font-bold uppercase tracking-widest transition-colors ${
              isPlaying ? 'bg-red-500 text-white' : 'bg-emerald-400 text-black'
            }`}
          >
            {isPlaying ? <Square size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
            {isPlaying ? 'Stop' : 'Play'}
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSoundEnabled((value) => !value)}
              className={`flex h-11 w-12 md:h-8 md:w-10 items-center justify-center rounded-lg border transition-colors ${
                soundEnabled ? 'border-emerald-300/40 bg-emerald-300/15 text-emerald-200' : 'border-white/10 bg-white/5 text-white/35'
              }`}
              title={soundEnabled ? 'Sound on' : 'Sound muted'}
            >
              {soundEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={volume}
              onChange={(event) => setVolume(parseFloat(event.target.value))}
              className="h-1 min-w-0 flex-1 cursor-pointer appearance-none rounded-full bg-white/10 outline-none [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
              aria-label="Music volume"
            />
          </div>
          <input ref={uploadInputRef} type="file" accept="audio/*" className="hidden" onChange={handleUpload} />
          <button
            onClick={() => uploadInputRef.current?.click()}
            className="flex min-h-11 md:h-8 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 text-[9px] font-bold uppercase tracking-widest text-white/60 transition-colors hover:bg-white/10 hover:text-white"
            title={uploadedName || 'Upload audio'}
          >
            <Upload size={13} />
            {uploadedName ? 'Loaded' : 'Upload'}
          </button>
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="flex min-w-0 flex-col gap-2 md:flex-row md:items-center">
            <span className="shrink-0 text-[9px] font-bold uppercase tracking-widest text-white/35">Presets</span>
            <div className="grid grid-cols-2 gap-2 md:flex md:items-center">
              {musicPresets.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => applyPreset(preset)}
                  className={`min-h-11 md:h-7 rounded-lg border px-3 text-[9px] font-bold uppercase tracking-widest transition-colors ${
                    activePresetId === preset.id
                      ? 'border-emerald-300 bg-emerald-300 text-black'
                      : 'border-white/10 bg-white/5 text-white/45 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  {preset.name}
                </button>
              ))}
            </div>
            <form onSubmit={handleLinkSubmit} className="flex min-w-0 flex-1 items-center gap-2 md:ml-auto md:min-w-[280px] md:max-w-[430px]">
              <input
                type="url"
                value={musicUrl}
                onChange={(event) => setMusicUrl(event.target.value)}
                placeholder="Paste music link"
                className="min-h-11 md:h-7 min-w-0 flex-1 rounded-lg border border-white/10 bg-black/40 px-3 text-[10px] md:text-[9px] font-bold uppercase tracking-widest text-white/70 outline-none transition-colors placeholder:text-white/25 focus:border-emerald-300/70"
                title={linkStatus || 'Paste direct audio URL'}
              />
              <button
                type="submit"
                disabled={linkLoading || !musicUrl.trim()}
                className="flex h-11 w-11 md:h-7 md:w-9 shrink-0 items-center justify-center rounded-lg border border-emerald-300/30 bg-emerald-300/15 text-emerald-200 transition-colors hover:bg-emerald-300 hover:text-black disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/5 disabled:text-white/25"
                title={linkStatus || 'Play music link'}
              >
                <Link2 size={13} />
              </button>
            </form>
          </div>

          <div className="grid grid-cols-[repeat(16,minmax(0,1fr))] gap-1">
            {Array.from({ length: 16 }).map((_, index) => (
              <div
                key={index}
                className={`h-2 rounded-full ${activeStep === index && isPlaying ? 'bg-emerald-300' : 'bg-white/10'}`}
              />
            ))}
          </div>

          <div className="grid min-w-0 grid-cols-2 gap-2 md:grid-cols-5">
            {layers.map((layer) => (
              <button
                key={layer.id}
                onClick={() => setEnabledLayers((prev) => ({ ...prev, [layer.id]: !prev[layer.id] }))}
                className={`min-h-[92px] md:h-[86px] rounded-lg border p-3 text-left transition-colors ${
                  enabledLayers[layer.id]
                    ? 'border-white/15 bg-white/10 text-white'
                    : 'border-white/5 bg-white/[0.03] text-white/35'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-widest">{layer.name}</span>
                  <span className={`h-2 w-2 rounded-full ${layer.color}`} />
                </div>
                <div className="mt-3 flex h-8 items-end gap-1">
                  {getLayerPattern(layer.id).split('').map((token, index) => (
                    <span
                      key={index}
                      className={`flex-1 rounded-sm ${
                        token !== '.' ? layer.color : 'bg-white/10'
                      } ${activeStep === index && isPlaying ? 'opacity-100' : 'opacity-35'}`}
                      style={{ height: token !== '.' ? '100%' : '28%' }}
                    />
                  ))}
                </div>
                <div className="mt-2 text-[9px] uppercase tracking-widest text-white/35">{layer.band}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
