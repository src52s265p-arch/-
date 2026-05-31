import { useStore } from '@/store/useStore';
import { Zap } from 'lucide-react';
import { t } from '@/lib/i18n';
import { getAudioDriveSnapshot } from '@/lib/audioDrive';
import { useEffect, useState } from 'react';

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const Slider = ({ label, value, displayValue, onChange, min = 0, max = 2, step = 0.01, reactive = false }: any) => {
  const shownValue = clamp(displayValue ?? value, min, max);

  return (
    <div className="mb-4 flex flex-col gap-2">
      <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-white/40">
        <span>{label}</span>
        <span
          className={`rounded border px-2 py-0.5 text-white ${
            reactive ? 'border-yellow-300/40 bg-yellow-300/15 shadow-[0_0_14px_rgba(250,204,21,0.18)]' : 'border-white/5 bg-white/5'
          }`}
        >
          {shownValue.toFixed(2)}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={shownValue}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className={`h-1 w-full cursor-pointer appearance-none rounded-full outline-none transition-all [&::-webkit-slider-thumb]:h-2 [&::-webkit-slider-thumb]:w-2 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full hover:[&::-webkit-slider-thumb]:scale-150 ${
          reactive
            ? 'bg-yellow-300/30 [&::-webkit-slider-thumb]:bg-yellow-200 [&::-webkit-slider-thumb]:shadow-[0_0_14px_rgba(250,204,21,0.9)]'
            : 'bg-white/10 [&::-webkit-slider-thumb]:bg-white'
        }`}
      />
    </div>
  );
};

const Toggle = ({ label, active, onToggle }: any) => (
  <div className="flex justify-between items-center mb-4">
    <span className="text-[10px] uppercase font-bold text-white/40 tracking-widest">{label}</span>
    <button 
      onClick={onToggle}
      className={`w-10 h-5 rounded-full relative transition-colors duration-300 ${active ? 'bg-yellow-500' : 'bg-white/10'}`}
    >
      <div className={`w-3 h-3 bg-white rounded-full absolute top-1 transition-transform duration-300 ${active ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  </div>
);

export function FxPanel() {
  const {
    audioDriveMode,
    audioFxReactive,
    autoVjEnabled,
    bloomIntensity,
    distortion,
    rgbSplitAmount,
    glitchActive,
    setAutoVjControl,
    setFxControl,
    language
  } = useStore();
  const i18n = t[language];
  const [liveFx, setLiveFx] = useState({
    bloom: bloomIntensity,
    split: rgbSplitAmount,
    distortion,
    glitch: glitchActive,
  });

  useEffect(() => {
    let frame = 0;
    let lastUpdate = 0;
    const live = {
      bloom: liveFx.bloom,
      split: liveFx.split,
      distortion: liveFx.distortion,
    };

    const update = () => {
      const now = performance.now();
      if (now - lastUpdate < 80) {
        frame = requestAnimationFrame(update);
        return;
      }
      lastUpdate = now;

      const { energy, beat, bass, subBass, mid, treble } = getAudioDriveSnapshot(audioDriveMode);
      const enabled = autoVjEnabled && audioFxReactive;
      const targetBloom = bloomIntensity + (enabled ? energy * 1.05 + beat * 2.4 + treble * 0.5 : 0);
      const targetSplit = rgbSplitAmount + (enabled ? bass * 0.016 + subBass * 0.014 + beat * 0.028 + distortion * 0.006 : 0);
      const targetDistortion = distortion + (enabled ? subBass * 0.52 + bass * 0.28 + mid * 0.16 + beat * 0.38 : 0);

      live.bloom += (targetBloom - live.bloom) * 0.14;
      live.split += (targetSplit - live.split) * 0.22;
      live.distortion += (targetDistortion - live.distortion) * 0.16;

      setLiveFx({
        bloom: live.bloom,
        split: live.split,
        distortion: live.distortion,
        glitch: glitchActive || (enabled && (beat > 0.65 || treble > 0.58 || bass > 0.72)),
      });
      frame = requestAnimationFrame(update);
    };

    update();
    return () => cancelAnimationFrame(frame);
  }, [audioDriveMode, audioFxReactive, autoVjEnabled, bloomIntensity, distortion, rgbSplitAmount, glitchActive]);

  const reactiveActive = autoVjEnabled && audioFxReactive;

  return (
    <div className="w-full p-6 flex flex-col gap-6">
      <div className="flex items-center gap-3 text-white/80">
        <Zap size={16} className="text-yellow-400" />
        <span className="text-[10px] font-bold uppercase tracking-widest">{i18n.FX_STACK || 'Post Processing'}</span>
      </div>
      
      <div className="pt-2">
        <button
          onClick={() => setAutoVjControl('audioFxReactive', !audioFxReactive)}
          className={`mb-5 flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left transition-colors ${
            audioFxReactive
              ? 'border-yellow-400/50 bg-yellow-400 text-black'
              : 'border-white/10 bg-white/5 text-white/50 hover:bg-white/10'
          }`}
        >
          <span className="min-w-0">
            <span className="block text-[10px] font-bold uppercase tracking-widest">{i18n.AUDIO_REACTIVE_FX || 'Audio Reactive FX'}</span>
            <span className={`mt-1 block text-[9px] leading-snug ${audioFxReactive ? 'text-black/60' : 'text-white/35'}`}>
              {i18n.AUDIO_REACTIVE_FX_HINT || 'Music or microphone drives this FX stack in real time.'}
            </span>
          </span>
          <span className="shrink-0 text-[10px] font-black uppercase tracking-wider">{audioFxReactive ? (i18n.ON || 'ON') : (i18n.OFF || 'OFF')}</span>
        </button>
        <Slider 
          label={i18n.BLOOM_INTENSITY || 'Bloom Intensity'}
          value={bloomIntensity} 
          displayValue={liveFx.bloom}
          onChange={(v: number) => setFxControl('bloomIntensity', v)} 
          max={5} 
          reactive={reactiveActive}
        />
        <Slider 
          label={i18n.RGB_SPLIT || 'RGB Split'}
          value={rgbSplitAmount} 
          displayValue={liveFx.split}
          onChange={(v: number) => setFxControl('rgbSplitAmount', v)} 
          max={0.05} 
          step={0.001}
          reactive={reactiveActive}
        />
        <Slider 
          label={i18n.DISTORTION || 'Lens Distortion'}
          value={distortion} 
          displayValue={liveFx.distortion}
          onChange={(v: number) => setFxControl('distortion', v)} 
          max={2} 
          reactive={reactiveActive}
        />
        <Toggle 
          label={i18n.DIGITAL_GLITCH || 'Digital Glitch'}
          active={liveFx.glitch}
          onToggle={() => setFxControl('glitchActive', !glitchActive)}
        />
      </div>
    </div>
  );
}
