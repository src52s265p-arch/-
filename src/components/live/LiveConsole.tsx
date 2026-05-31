import { useCallback, useEffect, useMemo, useState } from 'react';
import { Maximize2, Radio, RotateCcw, Save, Sparkles, Trash2, Waves } from 'lucide-react';
import { Visualizer } from '@/components/visualizer/Visualizer';
import { getAudioDriveSnapshot } from '@/lib/audioDrive';
import type { AudioDebugSnapshot } from '@/lib/AudioEngine';
import { applyLiveControlPatch, getLivePadPatch, LIVE_PAD_DEFINITIONS } from '@/lib/liveControls';
import { getScreenSceneLabel } from '@/lib/screenText';
import { getVisualDescription } from '@/lib/visualLabels';
import { useStore, type VisualInputSource } from '@/store/useStore';
import { liveVisualModules } from '@/visuals/registry';
import { LivePad } from './LivePad';

interface LiveConsoleProps {
  audioReady: boolean;
  audioDebug: AudioDebugSnapshot;
  initError: string;
  micStatusText: string;
  selectInputSource: (source: VisualInputSource) => void;
  toggleFullscreenView: () => void;
}

const liveCopy = {
  EN: {
    title: 'Nexus.VJ Live Console',
    subtitle: 'Home is performance. Studio is design.',
    studio: 'Studio',
    language: 'EN',
    lookBrowser: 'Look Browser',
    factoryReset: 'Factory Reset',
    lookMemory: 'Look Memory',
    save: 'Save',
    delete: 'Delete',
    memoryEmpty: 'Save Studio or Live looks here, then recall them during performance.',
    liveMonitor: 'Live Monitor',
    fullscreen: 'Fullscreen',
    signalPanel: 'Signal Panel',
    showApi: 'Show API',
    mic: 'Mic',
    debug: 'Debug',
    musicDebug: 'Music Debug',
    showApiLink: 'SHOW API / DJ LINK',
    outputScreen: 'Output Screen',
    enabled: 'Enabled',
    muted: 'Muted',
    disable: 'Disable',
    enable: 'Enable',
    liveSwitches: 'Live Switches',
    autoFollow: 'Auto Follow',
    audioFx: 'Audio FX',
    cameraMotion: 'Camera Motion',
    hint: 'Pads shape the look without breaking audio follow. Deep color, FX, camera, text and routing controls stay in Studio.',
    meters: { level: 'Level', bass: 'Bass', beat: 'Beat' },
    padTitles: {
      energy: ['Energy Pad', 'motion / impact', 'Motion', 'Impact'],
      rhythm: ['Rhythm Pad', 'follow / punch', 'Follow', 'Punch'],
      color: ['Color Pad', 'palette / light', 'Palette', 'Light'],
      structure: ['Structure Pad', 'scale / composition', 'Scale', 'Shape'],
      texture: ['Texture Pad', 'detail / disruption', 'Detail', 'Break'],
      atmosphere: ['Atmosphere Pad', 'glow / camera depth', 'Glow', 'Depth'],
    },
    descriptions: {
      'Layered Stage': 'Low-cost layered DJ-reactive stage',
      Purple: 'Liquid holographic purple stream',
      'Blue Font': 'Liquid chrome blue typography',
      Pulse: 'Aggressive bass pulse and glitch',
      Liquid: 'Organic merging SDF fluid',
      Topology: 'Liquified contour type',
      Chromaflux: 'Thermal liquid river',
      Dumbar: 'Refractive tiles distorting text',
      Void: 'Monochrome void and sparse glitch',
      Cyber: 'Neon blue high-glitch scene',
    },
  },
  ZH: {
    title: 'Nexus.VJ 演出主控',
    subtitle: '首页用于演出，Studio 用于幕后设计。',
    studio: '幕后设计',
    language: '中',
    lookBrowser: '视觉方案',
    factoryReset: '恢复出厂',
    lookMemory: '视觉记忆',
    save: '保存',
    delete: '删除',
    memoryEmpty: '在 Studio 或 Live 调好后保存到这里，演出时可快速召回。',
    liveMonitor: '实时监看',
    fullscreen: '全屏',
    signalPanel: '信号面板',
    showApi: 'Show API',
    mic: '麦克风',
    debug: '调试',
    musicDebug: '音乐调试',
    showApiLink: 'SHOW API / DJ 链路',
    outputScreen: '输出屏幕',
    enabled: '已启用',
    muted: '已静音',
    disable: '关闭',
    enable: '启用',
    liveSwitches: '演出开关',
    autoFollow: '自动跟随',
    audioFx: '音频特效',
    cameraMotion: '镜头运动',
    hint: 'Pads 用于现场塑形，不破坏音源自动跟随。深度颜色、特效、镜头、文字和路由仍放在 Studio。',
    meters: { level: '电平', bass: '低频', beat: '节拍' },
    padTitles: {
      energy: ['能量 Pad', '运动 / 冲击', '运动', '冲击'],
      rhythm: ['节奏 Pad', '跟随 / 拳感', '跟随', '冲击'],
      color: ['色彩 Pad', '色盘 / 光感', '色盘', '光感'],
      structure: ['结构 Pad', '尺度 / 构图', '尺度', '形态'],
      texture: ['质感 Pad', '细节 / 破碎', '细节', '破碎'],
      atmosphere: ['氛围 Pad', '辉光 / 景深', '辉光', '深度'],
    },
    descriptions: {
      'Layered Stage': '低成本分层 DJ 响应舞台',
      Purple: '液态全息紫色流',
      'Blue Font': '蓝色液态金属文字',
      Pulse: '强烈低频脉冲与故障',
      Liquid: '有机融合 SDF 流体',
      Topology: '液化等高线文字',
      Chromaflux: '热成像液态水道',
      Dumbar: '折射砖块扭曲文字',
      Void: '单色虚空与稀疏故障',
      Cyber: '霓虹蓝高故障场景',
    },
  },
} as const;

export function LiveConsole({ audioReady, audioDebug, initError, micStatusText, selectInputSource, toggleFullscreenView }: LiveConsoleProps) {
  const activeScreenId = useStore((state) => state.activeScreenId);
  const applyPreset = useStore((state) => state.applyPreset);
  const applyVisualMemory = useStore((state) => state.applyVisualMemory);
  const autoVjEnabled = useStore((state) => state.autoVjEnabled);
  const audioFxReactive = useStore((state) => state.audioFxReactive);
  const currentScene = useStore((state) => state.currentScene);
  const deleteVisualMemory = useStore((state) => state.deleteVisualMemory);
  const language = useStore((state) => state.language);
  const liveControls = useStore((state) => state.liveControls);
  const musicCameraEnabled = useStore((state) => state.musicCameraEnabled);
  const resetCurrentLook = useStore((state) => state.resetCurrentLook);
  const saveVisualMemory = useStore((state) => state.saveVisualMemory);
  const setAutoVjControl = useStore((state) => state.setAutoVjControl);
  const setLanguage = useStore((state) => state.setLanguage);
  const setLiveControls = useStore((state) => state.setLiveControls);
  const setLiveMode = useStore((state) => state.setLiveMode);
  const setScreenEnabled = useStore((state) => state.setScreenEnabled);
  const visualInputSource = useStore((state) => state.visualInputSource);
  const visualMemories = useStore((state) => state.visualMemories);
  const visualScreens = useStore((state) => state.visualScreens);
  const [meters, setMeters] = useState({ volume: 0, bass: 0, beat: 0 });
  const activeScreen = visualScreens.find((screen) => screen.id === activeScreenId) || visualScreens[0];
  const copy = liveCopy[language];

  useEffect(() => {
    const timer = window.setInterval(() => {
      const audio = getAudioDriveSnapshot(useStore.getState().audioDriveMode);
      setMeters({
        volume: Math.min(1, audio.volume * 1.8),
        bass: Math.min(1, Math.max(audio.subBass, audio.bass, audio.lowMid) * 1.9),
        beat: Math.min(1, Math.max(audio.beat, audio.transient)),
      });
    }, 120);
    return () => window.clearInterval(timer);
  }, []);

  const sourceOptions = useMemo(() => [
    { source: 'api' as const, label: copy.showApi },
    { source: 'mic' as const, label: copy.mic },
    { source: 'music' as const, label: copy.debug },
  ], [copy.debug, copy.mic, copy.showApi]);

  const chooseLook = useCallback((presetId: string) => {
    applyPreset(presetId);
    setLiveControls({ selectedLookId: presetId });
  }, [applyPreset, setLiveControls]);

  const updatePad = useCallback((padId: string, x: number, y: number) => {
    const pad = LIVE_PAD_DEFINITIONS.find((item) => item.id === padId);
    if (!pad) return;
    const patch = getLivePadPatch(pad, x, y);
    useStore.setState((state) => applyLiveControlPatch(state.liveControls, patch));
  }, []);

  const signalLabel = visualInputSource === 'mic'
    ? micStatusText
    : visualInputSource === 'api'
      ? copy.showApiLink
      : copy.musicDebug;

  const resetLook = useCallback(() => {
    resetCurrentLook();
  }, [resetCurrentLook]);

  const toggleItems = [
    { key: 'autoVjEnabled' as const, label: copy.autoFollow, active: autoVjEnabled },
    { key: 'audioFxReactive' as const, label: copy.audioFx, active: audioFxReactive },
    { key: 'musicCameraEnabled' as const, label: copy.cameraMotion, active: musicCameraEnabled },
  ];

  return (
    <div className="flex h-[100dvh] min-h-[100svh] flex-col overflow-hidden bg-[#050506] text-white">
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-white/10 px-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-7 w-7 items-center justify-center rounded bg-white text-black">
            <Sparkles size={15} />
          </div>
          <div className="min-w-0">
            <div className="truncate text-[11px] font-black uppercase tracking-widest">{copy.title}</div>
            <div className="hidden text-[9px] font-bold uppercase tracking-widest text-white/35 sm:block">{copy.subtitle}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-white/55 md:flex">
            <span className={`h-1.5 w-1.5 rounded-full ${visualInputSource === 'mic' && !audioReady ? 'bg-yellow-300' : 'bg-emerald-400'}`} />
            {signalLabel}
          </div>
          <button
            type="button"
            onClick={() => setLiveMode(false)}
            className="h-9 rounded-md border border-white/10 bg-white/5 px-3 text-[10px] font-black uppercase tracking-widest text-white/65 hover:bg-white hover:text-black"
          >
            {copy.studio}
          </button>
          <button
            type="button"
            onClick={() => setLanguage(language === 'EN' ? 'ZH' : 'EN')}
            className="h-9 rounded-md border border-white/10 bg-white/5 px-3 text-[10px] font-black uppercase tracking-widest text-white/60 hover:bg-white hover:text-black"
          >
            {copy.language}
          </button>
        </div>
      </header>

      <main className="grid flex-1 min-h-0 gap-4 overflow-hidden p-4 lg:grid-cols-[minmax(240px,320px)_minmax(360px,600px)_minmax(320px,1fr)]">
        <section className="min-h-0 overflow-y-auto rounded-lg border border-white/10 bg-[#0a0a0d] p-4">
          <div className="mb-4 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-white/70">
            <Waves size={15} className="text-cyan-300" />
            {copy.lookBrowser}
            <button
              type="button"
              onClick={resetLook}
              className="ml-auto flex h-8 items-center gap-1.5 rounded border border-white/10 bg-white/5 px-2 text-[9px] font-black uppercase tracking-widest text-white/55 hover:bg-white hover:text-black"
              title={copy.factoryReset}
            >
              <RotateCcw size={12} />
              {copy.factoryReset}
            </button>
          </div>
          <div className="grid gap-2">
            {liveVisualModules.map((module) => (
              <button
                key={module.id}
                type="button"
                onClick={() => chooseLook(module.presetId)}
                className={`rounded-md border p-3 text-left transition-colors ${
                  currentScene === module.id
                    ? 'border-white bg-white text-black'
                    : 'border-white/10 bg-white/[0.04] text-white/70 hover:bg-white/10 hover:text-white'
                }`}
              >
                <div className="text-[11px] font-black uppercase tracking-widest">{getScreenSceneLabel(language, module.id)}</div>
                <div className={`mt-1 text-[10px] leading-snug ${currentScene === module.id ? 'text-black/55' : 'text-white/35'}`}>
                  {copy.descriptions[module.id as keyof typeof copy.descriptions] || getVisualDescription(language, module.id, module.description)}
                </div>
              </button>
            ))}
          </div>

          <div className="mt-5 border-t border-white/10 pt-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-white/55">{copy.lookMemory}</span>
              <button
                type="button"
                onClick={saveVisualMemory}
                className="flex h-8 items-center gap-1.5 rounded bg-white px-2 text-[10px] font-black uppercase tracking-widest text-black"
              >
                <Save size={13} />
                {copy.save}
              </button>
            </div>
            <div className="grid gap-2">
              {visualMemories.length === 0 ? (
                <div className="rounded border border-dashed border-white/10 p-3 text-[10px] leading-relaxed text-white/35">
                  {copy.memoryEmpty}
                </div>
              ) : visualMemories.slice(0, 6).map((memory, index) => (
                <div
                  key={memory.id}
                  className="flex items-stretch overflow-hidden rounded border border-white/10 bg-white/[0.04]"
                >
                  <button
                    type="button"
                    onClick={() => applyVisualMemory(memory.id)}
                    className="min-w-0 flex-1 px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-white/60 hover:bg-white hover:text-black"
                  >
                    {index + 1}. {memory.name} / {getScreenSceneLabel(language, memory.currentScene)}
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteVisualMemory(memory.id)}
                    className="flex w-10 items-center justify-center border-l border-white/10 text-white/35 hover:bg-red-500/20 hover:text-red-200"
                    title={copy.delete}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="flex min-h-0 flex-col items-center justify-center gap-3 overflow-hidden rounded-lg border border-white/10 bg-[#09090b] p-4">
          <div className="flex w-full max-w-[600px] items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[10px] font-black uppercase tracking-widest text-white/45">{copy.liveMonitor}</div>
              <div className="truncate text-[12px] font-black uppercase tracking-widest text-white">{getScreenSceneLabel(language, currentScene)}</div>
            </div>
            <button
              type="button"
              onClick={toggleFullscreenView}
              className="flex h-9 items-center gap-2 rounded-md bg-white px-3 text-[10px] font-black uppercase tracking-widest text-black"
            >
              <Maximize2 size={14} />
              {copy.fullscreen}
            </button>
          </div>
          <div className="relative w-full max-w-[600px] overflow-hidden rounded-lg border border-white/10 bg-black shadow-[0_24px_80px_rgba(0,0,0,0.5)] aspect-video">
            <Visualizer />
            {initError && visualInputSource === 'mic' && (
              <div className="absolute left-3 top-3 z-50 rounded border border-red-400/30 bg-red-500/20 px-3 py-2 text-[11px] font-bold text-red-100">
                {initError}
              </div>
            )}
          </div>
          <div className="grid w-full max-w-[600px] grid-cols-3 gap-2">
            {[
              [copy.meters.level, meters.volume],
              [copy.meters.bass, meters.bass],
              [copy.meters.beat, meters.beat],
            ].map(([label, value]) => (
              <div key={label as string} className="rounded-md border border-white/10 bg-white/[0.035] p-2">
                <div className="mb-1 text-[9px] font-black uppercase tracking-widest text-white/35">{label as string}</div>
                <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full bg-cyan-300" style={{ width: `${Math.max(3, (value as number) * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="min-h-0 overflow-y-auto rounded-lg border border-white/10 bg-[#0a0a0d] p-4">
          <div className="mb-4 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-white/70">
            <Radio size={15} className="text-emerald-300" />
            {copy.signalPanel}
          </div>
          <div className="grid grid-cols-3 gap-2">
            {sourceOptions.map((option) => (
              <button
                key={option.source}
                type="button"
                onClick={() => selectInputSource(option.source)}
                className={`h-10 rounded-md border text-[10px] font-black uppercase tracking-widest transition-colors ${
                  visualInputSource === option.source
                    ? 'border-emerald-300 bg-emerald-300 text-black'
                    : 'border-white/10 bg-white/[0.04] text-white/50 hover:bg-white/10 hover:text-white'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="mt-4 rounded-md border border-white/10 bg-white/[0.035] p-3">
            <div className="mb-2 flex items-center justify-between text-[10px] font-black uppercase tracking-widest">
              <span className="text-white/50">{copy.outputScreen}</span>
              <span className={activeScreen?.enabled ? 'text-emerald-300' : 'text-red-300'}>{activeScreen?.enabled ? copy.enabled : copy.muted}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-black">{activeScreen?.name || activeScreenId}</div>
                <div className="text-[10px] uppercase tracking-widest text-white/35">{activeScreen?.device || 'stage'} / {activeScreenId}</div>
              </div>
              {activeScreen && (
                <button
                  type="button"
                  onClick={() => setScreenEnabled(activeScreen.id, !activeScreen.enabled)}
                  className="rounded bg-white/10 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-white/65 hover:bg-white hover:text-black"
                >
                  {activeScreen.enabled ? copy.disable : copy.enable}
                </button>
              )}
            </div>
          </div>

          <div className="mt-4 rounded-md border border-white/10 bg-white/[0.035] p-3">
            <div className="mb-3 text-[10px] font-black uppercase tracking-widest text-white/50">{copy.liveSwitches}</div>
            <div className="grid grid-cols-3 gap-2">
              {toggleItems.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setAutoVjControl(item.key, !item.active)}
                  className={`min-h-10 rounded-md border px-2 text-[9px] font-black uppercase tracking-widest transition-colors ${
                    item.active
                      ? 'border-cyan-300 bg-cyan-300 text-black'
                      : 'border-white/10 bg-white/[0.04] text-white/45 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            {LIVE_PAD_DEFINITIONS.map((pad) => (
              (() => {
                const padCopy = copy.padTitles[pad.id];
                return (
                  <LivePad
                    key={pad.id}
                    title={padCopy[0]}
                    subtitle={padCopy[1]}
                    x={Number(liveControls[pad.xKey])}
                    y={Number(liveControls[pad.yKey])}
                    accent={pad.accent}
                    xLabel={padCopy[2]}
                    yLabel={padCopy[3]}
                    onChange={(x, y) => updatePad(pad.id, x, y)}
                  />
                );
              })()
            ))}
          </div>

          <div className="mt-4 rounded-md border border-white/10 bg-white/[0.035] p-3 text-[10px] leading-relaxed text-white/38">
            {copy.hint}
          </div>
        </section>
      </main>
    </div>
  );
}
