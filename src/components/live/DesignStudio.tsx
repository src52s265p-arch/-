import { Aperture, Focus, LayoutGrid, Monitor, Music2, SlidersHorizontal, Type, Volume2, Wand2 } from 'lucide-react';
import { useState } from 'react';
import { AudioPanel } from '@/components/layout/AudioPanel';
import { CameraPanel } from '@/components/layout/CameraPanel';
import { ColorPanel } from '@/components/layout/ColorPanel';
import { ControlPanel } from '@/components/layout/ControlPanel';
import { FxPanel } from '@/components/layout/FxPanel';
import { PresetPanel } from '@/components/layout/PresetPanel';
import { ScreenPanel } from '@/components/layout/ScreenPanel';
import { TextPanel } from '@/components/layout/TextPanel';
import { MusicProjectBar } from '@/components/music/MusicProjectBar';
import { Visualizer } from '@/components/visualizer/Visualizer';
import type { AudioDebugSnapshot } from '@/lib/AudioEngine';
import { useStore, type VisualInputSource } from '@/store/useStore';

interface DesignStudioProps {
  initError: string;
  audioDebug: AudioDebugSnapshot;
  micStatusText: string;
  selectInputSource: (source: VisualInputSource) => void;
  toggleFullscreenView: () => void;
}

const navItems = [
  { id: 'Presets', icon: LayoutGrid, label: 'Looks' },
  { id: 'Audio', icon: Volume2, label: 'Audio' },
  { id: 'Text', icon: Type, label: 'Text' },
  { id: 'Camera', icon: Aperture, label: 'Camera' },
  { id: 'Screens', icon: Monitor, label: 'Screens' },
];

const studioCopy = {
  EN: {
    title: 'Design Studio',
    subtitle: 'Backstage look design and advanced routing',
    liveConsole: 'Live Console',
    showApi: 'SHOW API',
    musicDebug: 'MUSIC DEBUG',
    builtInMusicDebug: 'Built-in Music Debug',
    hide: 'Hide',
    showPanel: 'Show Panel',
    sourceLabels: { api: 'API', mic: 'MIC', music: 'MUSIC' },
    fullscreen: 'Fullscreen',
  },
  ZH: {
    title: '设计工作台',
    subtitle: '后台视觉设计与高级路由',
    liveConsole: '演出控制台',
    showApi: '演出 API',
    musicDebug: '音乐调试',
    builtInMusicDebug: '内置音乐调试',
    hide: '隐藏',
    showPanel: '显示面板',
    sourceLabels: { api: 'API', mic: '麦克风', music: '音乐' },
    fullscreen: '全屏',
  },
} as const;

function StudioPanelContent({ activePanel }: { activePanel: string }) {
  switch (activePanel) {
    case 'Audio': return <AudioPanel />;
    case 'Text': return <TextPanel />;
    case 'Camera': return <CameraPanel />;
    case 'Screens': return <ScreenPanel />;
    case 'Presets':
    default: return <PresetPanel />;
  }
}

export function DesignStudio({ initError, audioDebug, micStatusText, selectInputSource, toggleFullscreenView }: DesignStudioProps) {
  const activeLeftPanel = useStore((state) => state.activeLeftPanel);
  const audioReady = useStore((state) => state.audioReady);
  const currentScene = useStore((state) => state.currentScene);
  const language = useStore((state) => state.language);
  const musicPanelOpen = useStore((state) => state.musicPanelOpen);
  const setActiveLeftPanel = useStore((state) => state.setActiveLeftPanel);
  const setLanguage = useStore((state) => state.setLanguage);
  const setLiveMode = useStore((state) => state.setLiveMode);
  const setMusicPanelOpen = useStore((state) => state.setMusicPanelOpen);
  const visualInputSource = useStore((state) => state.visualInputSource);
  const [mobileControlsOpen, setMobileControlsOpen] = useState(false);
  const copy = studioCopy[language];

  return (
    <div className="flex h-[100dvh] min-h-[100svh] flex-col overflow-hidden bg-[#050505] text-white">
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-white/10 px-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-7 w-7 items-center justify-center rounded bg-white text-black">
            <Wand2 size={15} />
          </div>
          <div className="min-w-0">
            <div className="truncate text-[11px] font-black uppercase tracking-widest">{copy.title}</div>
            <div className="hidden text-[9px] font-bold uppercase tracking-widest text-white/35 sm:block">{copy.subtitle}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-white/55 md:flex">
            <span className={`h-1.5 w-1.5 rounded-full ${visualInputSource === 'mic' && !audioReady ? 'bg-yellow-300' : 'bg-emerald-400'}`} />
            {visualInputSource === 'mic' ? micStatusText : visualInputSource === 'api' ? copy.showApi : copy.musicDebug}
          </div>
          <button
            type="button"
            onClick={() => setLiveMode(true)}
            className="h-9 rounded-md bg-cyan-300 px-3 text-[10px] font-black uppercase tracking-widest text-black"
          >
            {copy.liveConsole}
          </button>
          <button
            type="button"
            onClick={() => setLanguage(language === 'EN' ? 'ZH' : 'EN')}
            className="h-9 rounded-md border border-white/10 bg-white/5 px-3 text-[10px] font-black uppercase tracking-widest text-white/60 hover:bg-white hover:text-black"
          >
            {language}
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <nav className="hidden w-16 shrink-0 flex-col items-center gap-3 border-r border-white/10 bg-[#070708] py-4 md:flex">
          {navItems.map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveLeftPanel(id)}
              title={label}
              className={`flex h-10 w-10 items-center justify-center rounded-md transition-colors ${
                activeLeftPanel === id ? 'bg-white text-black' : 'text-white/40 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Icon size={18} />
            </button>
          ))}
        </nav>

        <aside className="hidden w-[320px] shrink-0 overflow-y-auto border-r border-white/10 bg-[#0a0a0c] md:block">
          <StudioPanelContent activePanel={activeLeftPanel} />
        </aside>

        <main className="flex min-w-0 flex-1 flex-col bg-black">
          {visualInputSource === 'music' && (
            musicPanelOpen ? (
              <div className="relative shrink-0">
                <MusicProjectBar />
                <button
                  type="button"
                  onClick={() => setMusicPanelOpen(false)}
                  className="absolute right-3 top-3 z-20 rounded border border-white/10 bg-black/70 px-2 py-1 text-[9px] font-black uppercase tracking-widest text-white/55 hover:bg-white hover:text-black"
                >
                  {copy.hide}
                </button>
              </div>
            ) : (
              <div className="flex h-11 shrink-0 items-center justify-between border-b border-white/10 bg-[#08080a] px-4">
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-white/45">
                  <Music2 size={14} className="text-emerald-300" />
                  {copy.builtInMusicDebug}
                </div>
                <button
                  type="button"
                  onClick={() => setMusicPanelOpen(true)}
                  className="rounded bg-emerald-300 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-black"
                >
                  {copy.showPanel}
                </button>
              </div>
            )
          )}

          <div className="relative min-h-0 flex-1">
            <Visualizer />
            {initError && visualInputSource === 'mic' && (
              <div className="absolute left-4 top-4 z-50 rounded border border-red-400/30 bg-red-500/20 px-3 py-2 text-xs font-bold text-red-100">
                {initError}
              </div>
            )}
            {visualInputSource === 'mic' && !initError && (
              <div className="absolute left-4 top-4 z-50 min-w-[240px] rounded border border-white/10 bg-black/65 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-white/70 backdrop-blur-md">
                <div className="flex items-center justify-between gap-3">
                  <span>{micStatusText}</span>
                  <span className="text-white/40">ctx {audioDebug.contextState}</span>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 font-mono normal-case tracking-normal text-white/45">
                  <span>raw {audioDebug.rawVolume.toFixed(3)}</span>
                  <span>rms {audioDebug.rawRms.toFixed(3)}</span>
                  <span>delta {audioDebug.frequencyDelta.toFixed(3)}</span>
                  <span>bin {audioDebug.peakFrequencyBin}</span>
                </div>
              </div>
            )}
            <div className="absolute bottom-4 left-4 z-40 hidden rounded border border-white/10 bg-black/60 p-1 md:flex">
              {(['api', 'mic', 'music'] as const).map((source) => (
                <button
                  key={source}
                  type="button"
                  onClick={() => selectInputSource(source)}
                  className={`h-8 rounded px-3 text-[10px] font-black uppercase tracking-widest ${
                    visualInputSource === source ? 'bg-white text-black' : 'text-white/45 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  {copy.sourceLabels[source]}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={toggleFullscreenView}
              className="absolute bottom-4 right-4 z-40 flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white backdrop-blur-md hover:bg-white hover:text-black"
              title={`${copy.fullscreen} ${currentScene}`}
            >
              <Focus size={20} />
            </button>
          </div>
        </main>

        <aside className="hidden w-[360px] shrink-0 overflow-y-auto border-l border-white/10 bg-[#0a0a0c] xl:block">
          <ColorPanel />
          <div className="h-px bg-white/5" />
          <FxPanel />
          <div className="h-px bg-white/5" />
          <ControlPanel />
        </aside>
      </div>

      <button
        type="button"
        onClick={() => setMobileControlsOpen((open) => !open)}
        className="fixed bottom-4 left-1/2 z-50 flex min-h-11 -translate-x-1/2 items-center gap-2 rounded-full bg-white px-5 text-[11px] font-black uppercase tracking-widest text-black md:hidden"
      >
        <SlidersHorizontal size={16} />
        Studio Panels
      </button>
      {mobileControlsOpen && (
        <div className="fixed inset-x-0 bottom-0 z-40 max-h-[82dvh] overflow-y-auto rounded-t-xl border-t border-white/15 bg-[#08080a] p-3 md:hidden">
          <div className="mb-3 flex gap-2 overflow-x-auto">
            {navItems.map(({ id, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setActiveLeftPanel(id)}
                className={`flex h-11 min-w-11 items-center justify-center rounded-md border ${
                  activeLeftPanel === id ? 'border-white bg-white text-black' : 'border-white/10 bg-white/5 text-white/55'
                }`}
              >
                <Icon size={18} />
              </button>
            ))}
          </div>
          <StudioPanelContent activePanel={activeLeftPanel} />
        </div>
      )}
    </div>
  );
}
