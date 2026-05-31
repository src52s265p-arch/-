import { useStore } from '@/store/useStore';
import { Monitor } from 'lucide-react';
import { t } from '@/lib/i18n';
import { getVisualDescription, getVisualLabel } from '@/lib/visualLabels';
import { visualModules } from '@/visuals/registry';

export function PresetPanel() {
  const { applyPreset, currentScene, language } = useStore();
  const strings = t[language];
  
  const presets = visualModules.map((module) => ({
    id: module.presetId,
    name: getVisualLabel(language, module.id),
    desc: getVisualDescription(language, module.id, module.description),
    scene: module.defaultLook.currentScene,
  }));

  return (
    <div className="w-full p-6 flex flex-col gap-6">
      <div className="flex items-center gap-3 text-white/80">
        <Monitor size={16} className="text-[#a0a0ff]" />
        <span className="text-[11px] font-bold uppercase tracking-widest text-[#e0e0e0]">{strings.VISUAL_TEMPLATES || 'Visual Templates'}</span>
      </div>
      
      <div className="flex flex-col gap-3">
        {presets.map((preset, index) => {
          const isActive = currentScene === preset.scene;
          return (
            <button
              type="button"
              key={preset.id}
              onClick={() => applyPreset(preset.id)}
              className={`flex flex-col items-start p-4 rounded-xl transition-all duration-300 pointer-events-auto ${
                isActive
                  ? 'bg-white text-black shadow-[0_4px_30px_rgba(255,255,255,0.15)] scale-[1.02]'
                  : 'bg-[#151515] hover:bg-[#222222] text-white border border-[#2a2a2a]'
              }`}
            >
              <span className={`text-[13px] font-bold tracking-wide ${
                 isActive ? 'text-black' : 'text-[#ffffff]'
              }`}>{index + 1}. {preset.name}</span>
              <span className={`text-[11px] mt-1.5 text-left ${
                 isActive ? 'text-[#666666]' : 'text-[#666666]'
              }`}>{preset.desc}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
