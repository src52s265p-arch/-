import React, { useRef, useState, useEffect } from 'react';
import { useStore } from '@/store/useStore';
import { BrainCircuit, Move, Orbit, Power, Save, Wand2 } from 'lucide-react';
import { t } from '@/lib/i18n';
import { getAudioDriveSnapshot } from '@/lib/audioDrive';
import { audioEngine } from '@/lib/AudioEngine';
import type { AudioDebugSnapshot } from '@/lib/AudioEngine';

const audioDebugChanged = (a: AudioDebugSnapshot, b: AudioDebugSnapshot) => (
  a.status !== b.status ||
  a.contextState !== b.contextState ||
  a.streamActive !== b.streamActive ||
  a.sourceType !== b.sourceType ||
  Math.abs(a.rawRms - b.rawRms) > 0.008 ||
  Math.abs(a.rawVolume - b.rawVolume) > 0.008 ||
  Math.abs(a.frequencyDelta - b.frequencyDelta) > 0.004 ||
  a.frequencyChanged !== b.frequencyChanged ||
  a.peakFrequencyBin !== b.peakFrequencyBin
);

const Toggle = ({ label, active, onToggle }: any) => (
  <div className="flex justify-between items-center gap-4">
    <span className="text-[10px] uppercase font-bold text-white/45 tracking-widest leading-tight">{label}</span>
    <button
      onClick={onToggle}
      className={`w-10 h-5 rounded-full relative transition-colors duration-300 shrink-0 ${active ? 'bg-orange-400' : 'bg-white/10'}`}
    >
      <div className={`w-3 h-3 bg-white rounded-full absolute top-1 transition-transform duration-300 ${active ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  </div>
);

const MicMeter = ({ label, value, active }: { label: string; value: number; active?: boolean }) => (
  <div className="flex flex-col gap-2">
    <div className="flex items-center justify-between text-[10px] uppercase font-bold tracking-widest">
      <span className="text-white/45">{label}</span>
      <span className={active ? 'text-orange-300' : 'text-white/45'}>{active ? 'LIVE' : Math.round(value * 100)}</span>
    </div>
    <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
      <div
        className={`h-full rounded-full transition-[width] duration-75 ${active ? 'bg-orange-300' : 'bg-white'}`}
        style={{ width: `${Math.max(2, Math.min(100, value * 100))}%` }}
      />
    </div>
  </div>
);

export function ControlPanel() {
  const {
    autoVjEnabled,
    audioDriveMode,
    musicCameraEnabled,
    visualInputSource,
    musicPanelOpen,
    visualMemories,
    setAutoVjControl,
    setMusicPanelOpen,
    saveVisualMemory,
    applyVisualMemory,
    setPerformanceControl,
    language
  } = useStore();
  const i18n = t[language];
  const padRef = useRef<HTMLDivElement>(null);
  const [padPos, setPadPos] = useState({ x: 0.5, y: 0.5 }); // Initialize to center
  const [isDragging, setIsDragging] = useState(false);
  const [micLevels, setMicLevels] = useState({ volume: 0, bass: 0, beat: 0 });
  const [audioDebug, setAudioDebug] = useState<AudioDebugSnapshot>(() => audioEngine.getDebugSnapshot());
  const micLevelsRef = useRef(micLevels);
  const audioDebugRef = useRef(audioDebug);

  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true);
    updatePad(e);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (isDragging) updatePad(e);
  };

  const handlePointerUp = () => {
    setIsDragging(false);
  };

  const updatePad = (e: React.PointerEvent) => {
    if (!padRef.current) return;
    const rect = padRef.current.getBoundingClientRect();
    let x = (e.clientX - rect.left) / rect.width;
    let y = 1.0 - ((e.clientY - rect.top) / rect.height); // Invert Y so up is 1.0

    // Clamp
    x = Math.max(0, Math.min(1, x));
    y = Math.max(0, Math.min(1, y));

    setPadPos({ x, y });
    setPerformanceControl('speed', 0.25 + x * 2.25); // Map X to glass/scene motion speed
    setPerformanceControl('chaos', y * 2.0); // Map Y to chaos
  };

  useEffect(() => {
    window.addEventListener('pointerup', handlePointerUp);
    return () => window.removeEventListener('pointerup', handlePointerUp);
  }, []);

  useEffect(() => {
    let animationFrameId = 0;
    let lastUpdate = 0;

    const updateMicLevels = () => {
      const now = performance.now();
      if (now - lastUpdate >= 100) {
        lastUpdate = now;
        const { volume, bass, subBass, mid, highMid, treble, beat } = getAudioDriveSnapshot(audioDriveMode);
        const nextLevels = {
          volume: Math.min(1, volume * 2.5),
          bass: Math.min(1, Math.max(bass, subBass, mid, highMid, treble) * 2.2),
          beat: Math.min(1, beat),
        };
        if (
          Math.abs(nextLevels.volume - micLevelsRef.current.volume) > 0.015 ||
          Math.abs(nextLevels.bass - micLevelsRef.current.bass) > 0.015 ||
          Math.abs(nextLevels.beat - micLevelsRef.current.beat) > 0.015
        ) {
          micLevelsRef.current = nextLevels;
          setMicLevels(nextLevels);
        }
        const nextDebug = audioEngine.getDebugSnapshot();
        if (audioDebugChanged(audioDebugRef.current, nextDebug)) {
          audioDebugRef.current = nextDebug;
          setAudioDebug(nextDebug);
        }
      }
      animationFrameId = requestAnimationFrame(updateMicLevels);
    };

    updateMicLevels();
    return () => cancelAnimationFrame(animationFrameId);
  }, [audioDriveMode]);

  const selectVisualInput = (source: 'mic' | 'music' | 'api') => {
    window.dispatchEvent(new CustomEvent('vj:select-input', { detail: source }));
  };

  const micStatusLabel = (() => {
    if (visualInputSource !== 'mic') return '未连接 / Not connected';
    if (audioDebug.status === 'requesting') return '等待授权 / Waiting permission';
    if (audioDebug.status === 'connected') return '麦克风已连接 / Connected';
    if (audioDebug.status === 'receiving') return '正在接收声音 / Receiving';
    if (audioDebug.status === 'low') return '输入音量过低 / Low input';
    if (audioDebug.status === 'error') return '错误 / Error';
    return '未连接 / Not connected';
  })();

  return (
    <div className="w-full p-6 flex flex-col gap-4">
      <div className="flex items-center justify-between text-white/80">
        <div className="flex items-center gap-3">
           <Move size={16} className="text-orange-400" />
           <span className="text-[10px] font-bold uppercase tracking-widest">{i18n.PERFORMANCE_PAD}</span>
        </div>
        <span className="text-[10px] font-mono text-white/40">X:{padPos.x.toFixed(2)} Y:{padPos.y.toFixed(2)}</span>
      </div>
      
      <div 
        ref={padRef}
        className="relative w-full aspect-square bg-[#030205] border border-white/10 rounded-xl cursor-crosshair touch-none overflow-hidden hover:border-white/30 transition-colors shadow-inner"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
      >
        {/* Grid lines and background */}
        <div className="absolute inset-0 bg-[radial-gradient(circle,rgba(255,255,255,0.05)_0%,transparent_70%)]"></div>
        <div className="absolute h-px w-full bg-white/5 top-1/2"></div>
        <div className="absolute w-px h-full bg-white/5 left-1/2"></div>
        
        {/* Cursor */}
        <div 
          className="absolute w-6 h-6 -ml-3 -mt-3 pointer-events-none transition-all duration-75"
          style={{ 
            left: `${padPos.x * 100}%`, 
            top: `${(1 - padPos.y) * 100}%` 
          }}
        >
          <div className="absolute inset-0 border-2 border-white rounded-full opacity-80 shadow-[0_0_10px_rgba(255,255,255,0.8)]" />
        </div>
        <div className="absolute bottom-3 left-3 text-[9px] text-white/30 uppercase max-w-full font-bold tracking-widest pointer-events-none break-keep w-32">{i18n.PAD_INFO}</div>
      </div>

      <div className="mt-2 flex flex-col gap-4 border-t border-white/10 pt-5">
        <div className="flex items-center gap-3 text-white/80">
          <Wand2 size={15} className="text-orange-300" />
          <span className="text-[10px] font-bold uppercase tracking-widest">{i18n.AUDIO_MORPH_ENGINE || 'Audio Morph Engine'}</span>
        </div>

        <button
          onClick={() => setAutoVjControl('autoVjEnabled', !autoVjEnabled)}
          className={`flex items-center justify-between gap-4 rounded-lg border px-4 py-3 text-left transition-all ${
            autoVjEnabled
              ? 'border-orange-400/60 bg-orange-400 text-black shadow-[0_0_24px_rgba(251,146,60,0.18)]'
              : 'border-white/10 bg-white/5 text-white/60 hover:bg-white/10'
          }`}
        >
          <span className="flex min-w-0 items-center gap-3">
            <Power size={15} className="shrink-0" />
            <span className="min-w-0">
              <span className="block text-[11px] font-bold uppercase tracking-widest">{i18n.MUSIC_DYNAMICS_LINK || 'Music Dynamics Link'}</span>
              <span className={`mt-1 block text-[9px] leading-snug ${autoVjEnabled ? 'text-black/60' : 'text-white/35'}`}>
                {i18n.MUSIC_DYNAMICS_HINT || 'Sound strength and beat drive the current visual motion.'}
              </span>
            </span>
          </span>
          <span className="shrink-0 text-[10px] font-black uppercase tracking-wider">{autoVjEnabled ? (i18n.ON || 'ON') : (i18n.OFF || 'OFF')}</span>
        </button>

        <Toggle
          label={i18n.ORBIT_CAMERA_WITH_MUSIC || 'Orbit camera with music'}
          active={musicCameraEnabled}
          onToggle={() => setAutoVjControl('musicCameraEnabled', !musicCameraEnabled)}
        />

        <div className="flex flex-col gap-2">
          <span className="text-[10px] font-bold uppercase tracking-widest text-white/45">
            {language === 'ZH' ? '视觉输入源' : 'Visual Input Source'}
          </span>
          <div className="grid grid-cols-3 gap-2">
            {[
              { source: 'mic' as const, label: language === 'ZH' ? '麦克风' : 'Mic' },
              { source: 'music' as const, label: language === 'ZH' ? '音乐调试' : 'Music Debug' },
              { source: 'api' as const, label: language === 'ZH' ? '演出 API' : 'Show API' },
            ].map((option) => (
              <button
                key={option.source}
                onClick={() => selectVisualInput(option.source)}
                className={`h-11 md:h-9 rounded-lg border text-[10px] font-bold uppercase tracking-wider transition-colors ${
                  visualInputSource === option.source
                    ? 'border-orange-300 bg-orange-300 text-black'
                    : 'border-white/10 bg-white/5 text-white/45 hover:bg-white/10 hover:text-white'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          {visualInputSource === 'music' && (
            <button
              type="button"
              onClick={() => setMusicPanelOpen(!musicPanelOpen)}
              className="h-11 md:h-8 rounded-lg border border-emerald-300/30 bg-emerald-300/10 text-[10px] font-bold uppercase tracking-widest text-emerald-100 hover:bg-emerald-300 hover:text-black"
            >
              {musicPanelOpen
                ? (language === 'ZH' ? '隐藏音乐面板' : 'Hide Music Panel')
                : (language === 'ZH' ? '显示音乐面板' : 'Show Music Panel')}
            </button>
          )}
        </div>

        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
          <div className="mb-4 flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-widest text-white/75">
              {visualInputSource === 'api'
                ? (language === 'ZH' ? '演出 API 控制' : 'Show API Control')
                : audioDriveMode === 'mic'
                  ? (i18n.LIVE_MIC_INPUT || 'Live Mic Input')
                  : (i18n.AUDIO_DRIVE_SOURCE || 'Drive Source')}
            </span>
            <span className={`h-2 w-2 rounded-full ${autoVjEnabled ? 'bg-orange-300 shadow-[0_0_12px_rgba(253,186,116,0.9)]' : 'bg-white/20'}`} />
          </div>
          <div className="flex flex-col gap-3">
            <MicMeter label={i18n.DRIVE_LEVEL || 'Drive Level'} value={micLevels.volume} />
            <MicMeter label={i18n.DRIVE_BAND_ENERGY || 'Band Energy'} value={micLevels.bass} />
            <MicMeter label={i18n.DRIVE_PULSE || 'Pulse'} value={micLevels.beat} active={micLevels.beat > 0.1} />
          </div>
          <div className="mt-4 rounded-md border border-white/10 bg-black/35 p-3">
            <div className="mb-2 flex items-center justify-between gap-2 text-[9px] font-black uppercase tracking-widest">
              <span className="text-white/55">{language === 'ZH' ? '麦克风调试' : 'Mic Debug'}</span>
              <span className={audioDebug.status === 'receiving' ? 'text-emerald-300' : audioDebug.status === 'error' ? 'text-red-300' : 'text-yellow-200'}>
                {micStatusLabel}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 font-mono text-[10px] text-white/45">
              <span>raw {audioDebug.rawVolume.toFixed(3)}</span>
              <span>rms {audioDebug.rawRms.toFixed(3)}</span>
              <span>delta {audioDebug.frequencyDelta.toFixed(3)}</span>
              <span>bin {audioDebug.peakFrequencyBin}</span>
              <span>ctx {audioDebug.contextState}</span>
              <span>stream {audioDebug.streamActive ? 'live' : 'off'}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-2 flex flex-col gap-3 border-t border-white/10 pt-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 text-white/80">
            <BrainCircuit size={15} className="text-cyan-300" />
            <span className="text-[10px] font-bold uppercase tracking-widest">{i18n.VISUAL_MEMORY || 'Visual Memory'}</span>
          </div>
          <button
            onClick={saveVisualMemory}
            className="h-8 w-8 rounded-lg bg-white text-black flex items-center justify-center hover:scale-105 transition-transform"
            title={i18n.SAVE_CURRENT_VISUAL_STATE || 'Save current visual state'}
          >
            <Save size={14} />
          </button>
        </div>

        {visualMemories.length === 0 ? (
          <div className="text-[10px] leading-relaxed text-white/35 border border-dashed border-white/10 rounded-lg p-3">
            {i18n.VISUAL_MEMORY_EMPTY || 'Save a look after tuning scene, colors and FX. Memories are recalled manually, so music keeps the current visual identity.'}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {visualMemories.map((memory, index) => (
              <button
                key={memory.id}
                onClick={() => applyVisualMemory(memory.id)}
                className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-left hover:bg-white hover:text-black transition-colors"
              >
                <Orbit size={13} className="shrink-0" />
                <span className="min-w-0 truncate text-[10px] font-bold uppercase tracking-wider">
                  {index + 1}. {memory.currentScene}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
