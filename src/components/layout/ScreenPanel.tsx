import { useEffect, useState } from 'react';
import { Check, Monitor, Power, Projector, Smartphone, Sparkles, Tablet } from 'lucide-react';
import { getAudioDriveSnapshot } from '@/lib/audioDrive';
import { getScreenSceneLabel, screenText } from '@/lib/screenText';
import { useStore, type OutputDeviceType, type OutputMode, type ScreenTransitionStyle } from '@/store/useStore';
import { visualModules } from '@/visuals/registry';

const deviceIcon: Record<OutputDeviceType, typeof Monitor> = {
  stage: Monitor,
  projector: Projector,
  led: Monitor,
  tablet: Tablet,
  phone: Smartphone,
};

const scenes = visualModules.map((module) => module.id);
const outputModes: OutputMode[] = ['mirror', 'solo', 'split'];
const transitionStyles: ScreenTransitionStyle[] = ['crossfade', 'scan', 'strobe', 'cut'];

const Level = ({ label, value }: { label: string; value: number }) => (
  <div className="flex flex-col gap-2">
    <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest">
      <span className="text-white/45">{label}</span>
      <span className="text-white/60">{Math.round(value * 100)}</span>
    </div>
    <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
      <div className="h-full rounded-full bg-cyan-300 transition-[width] duration-75" style={{ width: `${Math.max(2, Math.min(100, value * 100))}%` }} />
    </div>
  </div>
);

export function ScreenPanel() {
  const {
    activeScreenId,
    audioDriveMode,
    outputMode,
    screenAudioReactive,
    screenTransitionAmount,
    screenTransitionStyle,
    setActiveScreen,
    setScreenControl,
    setScreenEnabled,
    setScreenScene,
    visualScreens,
    language,
  } = useStore();
  const labels = screenText[language];
  const [drive, setDrive] = useState({ energy: 0, beat: 0 });
  const [networkOrigin, setNetworkOrigin] = useState('');
  const activeScreen = visualScreens.find((screen) => screen.id === activeScreenId) || visualScreens[0];
  const origin = networkOrigin || (typeof window === 'undefined' ? '' : window.location.origin);

  useEffect(() => {
    let frame = 0;
    let lastUpdate = 0;

    const update = () => {
      const now = performance.now();
      if (now - lastUpdate >= 100) {
        lastUpdate = now;
        const audio = getAudioDriveSnapshot(audioDriveMode);
        setDrive({
          energy: Math.min(1, audio.energy * 1.5 + audio.spectralFlux * 0.4),
          beat: Math.min(1, audio.beat + audio.transient * 0.35),
        });
      }
      frame = requestAnimationFrame(update);
    };

    update();
    return () => cancelAnimationFrame(frame);
  }, [audioDriveMode]);

  useEffect(() => {
    fetch('/api/network')
      .then((response) => response.json())
      .then((data) => {
        if (Array.isArray(data.addresses) && data.addresses.length > 0) {
          setNetworkOrigin(data.addresses[0]);
        }
      })
      .catch(() => {
        setNetworkOrigin('');
      });
  }, []);

  return (
    <div className="w-full p-6 flex flex-col gap-5">
      <div className="flex items-center justify-between text-white/80">
        <div className="flex items-center gap-3">
          <Monitor size={16} className="text-cyan-300" />
          <span className="text-[10px] font-bold uppercase tracking-widest">{labels.screenRouter}</span>
        </div>
        <span className="text-[10px] font-mono text-white/40">{visualScreens.filter((screen) => screen.enabled).length}/{visualScreens.length}</span>
      </div>

      <div className="grid grid-cols-1 gap-2">
        {visualScreens.map((screen) => {
          const Icon = deviceIcon[screen.device];
          const isActive = screen.id === activeScreenId;

          return (
            <button
              key={screen.id}
              type="button"
              onClick={() => setActiveScreen(screen.id)}
              className={`flex items-center gap-3 rounded-lg border px-3 py-3 text-left transition-all ${
                isActive
                  ? 'border-cyan-300 bg-cyan-300 text-black shadow-[0_0_24px_rgba(103,232,249,0.16)]'
                  : 'border-white/10 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Icon size={16} className="shrink-0" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[11px] font-bold uppercase tracking-widest">{screen.name}</span>
                <span className={`mt-1 block text-[10px] ${isActive ? 'text-black/60' : 'text-white/35'}`}>{getScreenSceneLabel(language, screen.scene)}</span>
              </span>
              <span
                role="switch"
                aria-checked={screen.enabled}
                onClick={(event) => {
                  event.stopPropagation();
                  setScreenEnabled(screen.id, !screen.enabled);
                }}
                className={`relative h-5 w-10 rounded-full transition-colors ${screen.enabled ? 'bg-black/80' : 'bg-white/15'}`}
              >
                <span className={`absolute top-1 h-3 w-3 rounded-full bg-white transition-transform ${screen.enabled ? 'translate-x-6' : 'translate-x-1'}`} />
              </span>
            </button>
          );
        })}
      </div>

      <div className="rounded-lg border border-cyan-300/20 bg-cyan-300/10 p-3">
        <div className="text-[10px] font-bold uppercase tracking-widest text-cyan-100">{labels.deviceUrl}</div>
        <div className="mt-2 break-all font-mono text-[10px] leading-relaxed text-cyan-100/70">
          {origin}/screen/{activeScreen?.id}
        </div>
      </div>

      <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-widest text-white/70">{labels.effectOn} {activeScreen?.name}</span>
          <Sparkles size={14} className="text-cyan-300" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          {scenes.map((scene) => (
            <button
              key={scene}
              type="button"
              onClick={() => setScreenScene(activeScreen.id, scene)}
              className={`h-9 rounded-lg border text-[10px] font-bold uppercase tracking-wider transition-colors ${
                activeScreen?.scene === scene
                  ? 'border-white bg-white text-black'
                  : 'border-white/10 bg-black/30 text-white/45 hover:bg-white/10 hover:text-white'
              }`}
            >
              {activeScreen?.scene === scene && <Check size={11} className="mr-1 inline" />}
              {getScreenSceneLabel(language, scene)}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <span className="text-[10px] font-bold uppercase tracking-widest text-white/45">{labels.outputMode}</span>
        <div className="grid grid-cols-3 gap-2">
          {outputModes.map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setScreenControl('outputMode', mode)}
              className={`h-9 rounded-lg border text-[10px] font-bold uppercase tracking-wider transition-colors ${
                outputMode === mode
                  ? 'border-cyan-300 bg-cyan-300 text-black'
                  : 'border-white/10 bg-white/5 text-white/45 hover:bg-white/10 hover:text-white'
              }`}
            >
              {labels.modes[mode]}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <span className="text-[10px] font-bold uppercase tracking-widest text-white/45">{labels.transitionStyle}</span>
        <div className="grid grid-cols-2 gap-2">
          {transitionStyles.map((style) => (
            <button
              key={style}
              type="button"
              onClick={() => setScreenControl('screenTransitionStyle', style)}
              className={`h-9 rounded-lg border text-[10px] font-bold uppercase tracking-wider transition-colors ${
                screenTransitionStyle === style
                  ? 'border-cyan-300 bg-cyan-300 text-black'
                  : 'border-white/10 bg-white/5 text-white/45 hover:bg-white/10 hover:text-white'
              }`}
            >
              {labels.transitions[style]}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-white/10 bg-black/30 p-4">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-widest text-white/45">{labels.musicLink}</span>
          <button
            type="button"
            onClick={() => setScreenControl('screenAudioReactive', !screenAudioReactive)}
            className={`flex h-7 items-center gap-2 rounded-lg px-3 text-[10px] font-bold uppercase tracking-wider transition-colors ${
              screenAudioReactive ? 'bg-cyan-300 text-black' : 'bg-white/10 text-white/45'
            }`}
          >
            <Power size={12} />
            {screenAudioReactive ? labels.on : labels.off}
          </button>
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest">
            <span className="text-white/45">{labels.transitionAmount}</span>
            <span className="text-white/60">{screenTransitionAmount.toFixed(2)}</span>
          </div>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={screenTransitionAmount}
            onChange={(event) => setScreenControl('screenTransitionAmount', Number(event.target.value))}
            className="w-full h-1 bg-white/10 rounded-full appearance-none outline-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-cyan-300 [&::-webkit-slider-thumb]:rounded-full"
          />
        </div>
        <Level label={labels.musicEnergy} value={drive.energy} />
        <Level label={labels.beatTrigger} value={drive.beat} />
      </div>
    </div>
  );
}
