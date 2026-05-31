import { useStore } from '@/store/useStore';
import { LayoutGrid } from 'lucide-react';
import { t } from '@/lib/i18n';
import { getVisualLabel } from '@/lib/visualLabels';
import { visualModules } from '@/visuals/registry';

const scenesConfig = visualModules.map((module) => ({ id: module.id }));

export function ScenePanel() {
  const { currentScene, setCurrentScene, language } = useStore();
  const strings = t[language];

  return (
    <div className="w-full p-6 flex flex-col gap-6">
      <div className="flex items-center gap-3 text-white/80">
        <LayoutGrid size={16} className="text-blue-400" />
        <span className="text-[10px] font-bold uppercase tracking-widest">{strings.ACTIVE_ARCHITECTURE || 'Active Architecture'}</span>
      </div>
      
      <div className="grid grid-cols-2 gap-3">
        {scenesConfig.map((scene) => (
          <button
            key={scene.id}
            onClick={() => setCurrentScene(scene.id)}
            className={`py-3 px-2 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all duration-300 border ${
              currentScene === scene.id
                ? "bg-white text-black border-white shadow-[0_0_20px_rgba(255,255,255,0.2)]"
                : "bg-white/5 text-white/50 border-white/5 hover:bg-white/10 hover:text-white"
            }`}
          >
            {strings.SCENES?.[scene.id] || getVisualLabel(language, scene.id)}
          </button>
        ))}
      </div>
    </div>
  );
}
