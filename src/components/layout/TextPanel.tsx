import { useStore } from '@/store/useStore';
import { Type, Save, RotateCcw, Trash2 } from 'lucide-react';
import { t } from '@/lib/i18n';
import { useState, useEffect } from 'react';

const TextSlider = ({ label, value, onChange, min = 0, max = 2, step = 0.01 }: any) => (
  <div className="flex flex-col gap-2 mb-4">
    <div className="flex justify-between text-[10px] uppercase font-bold text-white/40 tracking-widest">
      <span>{label}</span>
      <span className="text-white bg-white/5 px-2 py-0.5 rounded border border-white/5">{value.toFixed(2)}</span>
    </div>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      className="w-full h-1 bg-white/10 rounded-full appearance-none outline-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2 [&::-webkit-slider-thumb]:h-2 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full hover:[&::-webkit-slider-thumb]:scale-150 transition-all cursor-pointer"
    />
  </div>
);

export function TextPanel() {
  const { language, textInput, textAnimStyle, textGlow, textSpeed, textReactive, textColor, textFontSize, textFontWeight, textLetterSpacing, setTextEngine } = useStore();
  const i18n = t[language] as (typeof t)[typeof language] & {
    FONT_SIZE?: string;
    FONT_WEIGHT?: string;
    LETTER_SPACING?: string;
    TEXT_COLOR?: string;
  };
  const [localText, setLocalText] = useState(textInput);

  useEffect(() => {
    setLocalText(textInput);
  }, [textInput]);

  const styles = [
    { id: 'Cinematic', label: i18n.CinematicTitle || 'Cinematic Title' },
    { id: 'Massive', label: i18n.MassiveTypography || 'Massive Typography' },
    { id: 'Glitch', label: i18n.CyberGlitch || 'Cyber Glitch' },
    { id: 'Hologram', label: i18n.HologramText || 'Hologram Text' },
    { id: 'Floating', label: i18n.FloatingWords || 'Floating Words' },
    { id: 'Beat', label: i18n.BeatTypography || 'Beat Sync Text' },
  ];

  const handleApply = () => {
    setTextEngine('textInput', localText);
  };

  const handleReset = () => {
    setLocalText('GAFA');
    setTextEngine('textInput', 'GAFA');
    setTextEngine('textAnimStyle', 'Glitch');
    setTextEngine('textFontSize', 4.6);
    setTextEngine('textFontWeight', 900);
    setTextEngine('textLetterSpacing', 0.02);
    setTextEngine('textColor', '#ffffff');
  };

  const handleClear = () => {
    setLocalText('');
    setTextEngine('textInput', '');
  };

  return (
    <div className="w-full p-6 flex flex-col gap-6">
      <div className="flex items-center gap-3 text-white/80">
        <Type size={16} className="text-purple-400" />
        <span className="text-[10px] font-bold uppercase tracking-widest">{i18n.TEXT_ENGINE || 'AI Reactive Text'}</span>
      </div>
      
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-3">
          <label className="text-[10px] uppercase font-bold text-white/40 tracking-widest">
            {i18n.INPUT_TEXT || 'Drive Visuals via Text'}
          </label>
          <input 
            type="text" 
            value={localText}
            onChange={(e) => {
              setLocalText(e.target.value);
              setTextEngine('textInput', e.target.value);
            }}
            onKeyDown={(e) => e.key === 'Enter' && handleApply()}
            className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-[13px] font-mono text-white outline-none focus:border-purple-500/50 focus:bg-white/5 transition-all shadow-inner placeholder:text-white/20"
            placeholder={i18n.TEXT_INPUT_PLACEHOLDER}
          />
          <div className="flex gap-2">
            <button onClick={handleApply} className="flex-1 flex items-center justify-center gap-2 bg-purple-600/20 hover:bg-purple-600/40 border border-purple-500/30 text-purple-200 text-[10px] py-2 rounded uppercase font-bold tracking-widest transition-all">
              <Save size={12} /> {i18n.BTN_SAVE}
            </button>
            <button onClick={handleReset} className="flex-1 flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 text-[10px] py-2 rounded uppercase font-bold tracking-widest transition-all">
              <RotateCcw size={12} /> {i18n.BTN_RESET}
            </button>
            <button onClick={handleClear} className="flex-1 flex items-center justify-center gap-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 text-[10px] py-2 rounded uppercase font-bold tracking-widest transition-all">
              <Trash2 size={12} /> {i18n.BTN_CLEAR}
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-[10px] uppercase font-bold text-white/40 tracking-widest">
            {i18n.ANIMATION_STYLE || 'Typography Style'}
          </label>
          <div className="relative">
            <select 
              value={textAnimStyle}
              onChange={(e) => setTextEngine('textAnimStyle', e.target.value)}
              className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-[13px] font-mono text-white outline-none focus:border-purple-500/50 focus:bg-white/5 transition-all appearance-none cursor-pointer"
            >
              {styles.map(style => (
                <option key={style.id} value={style.id}>{style.label}</option>
              ))}
            </select>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-white/30 text-[10px]">
              ▼
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <label className="text-[10px] uppercase font-bold text-white/40 tracking-widest">
            {i18n.TEXT_COLOR || 'Text Color'}
          </label>
          <div className="flex items-center gap-3 rounded-lg border border-white/10 bg-black/50 px-4 py-3">
            <input
              type="color"
              value={textColor}
              onChange={(e) => setTextEngine('textColor', e.target.value)}
              className="h-8 w-10 cursor-pointer rounded border border-white/20 bg-transparent p-0"
              aria-label={i18n.TEXT_COLOR || 'Text Color'}
            />
            <input
              type="text"
              value={textColor}
              onChange={(e) => setTextEngine('textColor', e.target.value)}
              className="min-w-0 flex-1 bg-transparent font-mono text-[12px] uppercase text-white outline-none"
            />
          </div>
        </div>

        <div className="pt-2">
          <TextSlider 
            label={i18n.FONT_SIZE || 'Font Size'}
            value={textFontSize}
            onChange={(v: number) => setTextEngine('textFontSize', v)}
            min={1}
            max={12}
            step={0.1}
          />
          <div className="flex flex-col gap-2 mb-4">
            <div className="flex justify-between text-[10px] uppercase font-bold text-white/40 tracking-widest">
              <span>{i18n.FONT_WEIGHT || 'Font Weight'}</span>
              <span className="text-white bg-white/5 px-2 py-0.5 rounded border border-white/5">{textFontWeight}</span>
            </div>
            <select
              value={textFontWeight}
              onChange={(e) => setTextEngine('textFontWeight', Number(e.target.value))}
              className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-[13px] font-mono text-white outline-none focus:border-purple-500/50 focus:bg-white/5 transition-all cursor-pointer"
            >
              <option value={400}>400</option>
              <option value={500}>500</option>
              <option value={600}>600</option>
              <option value={700}>700</option>
              <option value={800}>800</option>
              <option value={900}>900</option>
            </select>
          </div>
          <TextSlider 
            label={i18n.LETTER_SPACING || 'Letter Spacing'}
            value={textLetterSpacing}
            onChange={(v: number) => setTextEngine('textLetterSpacing', v)}
            min={-0.5}
            max={0.5}
            step={0.01}
          />
          <TextSlider 
            label={i18n.GLOW_AMOUNT || "Glow Intensity"} 
            value={textGlow} 
            onChange={(v: number) => setTextEngine('textGlow', v)} 
            max={5} 
          />
          <TextSlider 
            label={i18n.MOTION_SPEED || "Motion Speed"} 
            value={textSpeed} 
            onChange={(v: number) => setTextEngine('textSpeed', v)} 
            max={3} 
          />
          <TextSlider 
            label={i18n.REACTIVE_INTENSITY || "Reactive Intensity"} 
            value={textReactive} 
            onChange={(v: number) => setTextEngine('textReactive', v)} 
            max={3} 
          />
        </div>
      </div>
    </div>
  );
}
