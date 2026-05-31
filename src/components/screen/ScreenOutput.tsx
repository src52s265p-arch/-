import { ExternalLink, MonitorOff, Route, Wifi, WifiOff } from 'lucide-react';
import { useEffect, useState } from 'react';
import { INTERACTION_PATCH_EVENT } from '@/components/ShowControlBridge';
import { screenText } from '@/lib/screenText';
import { fetchScreenState, type ScreenPresentation, type ScreenRoute } from '@/lib/screenRoutes';
import { useStore } from '@/store/useStore';
import { Visualizer } from '@/components/visualizer/Visualizer';

export function ScreenOutput({ screenId }: { screenId: string }) {
  const [route, setRoute] = useState<ScreenRoute | null>(null);
  const [presentation, setPresentation] = useState<ScreenPresentation>({
    autoRedirect: true,
    showDebug: false,
    showMenu: false,
  });
  const [routeError, setRouteError] = useState('');
  const { language, visualScreens } = useStore();
  const labels = screenText[language];
  const screen = visualScreens.find((item) => item.id === screenId);
  const connected = !routeError;

  useEffect(() => {
    const controller = new AbortController();
    let timer = 0;

    const loadRoute = async () => {
      try {
        const { routes, presentation } = await fetchScreenState(controller.signal);
        setRoute(routes[screenId] || null);
        setPresentation(presentation);
        setRouteError('');
      } catch (error) {
        if (controller.signal.aborted) return;
        setRouteError(error instanceof Error ? error.message : String(error));
      }
      timer = window.setTimeout(loadRoute, 2000);
    };

    void loadRoute();

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [screenId]);

  useEffect(() => {
    const handleInteractionPatch = (event: Event) => {
      const patch = (event as CustomEvent<Record<string, unknown>>).detail;
      const routes = isRecord(patch.screenRoutes) ? patch.screenRoutes as Record<string, ScreenRoute> : null;
      if (routes) setRoute(routes[screenId] || null);
      if (isRecord(patch.screenPresentation)) {
        const next = patch.screenPresentation;
        setPresentation((current) => ({
          autoRedirect: typeof next.autoRedirect === 'boolean' ? next.autoRedirect : current.autoRedirect,
          showDebug: typeof next.showDebug === 'boolean' ? next.showDebug : current.showDebug,
          showMenu: typeof next.showMenu === 'boolean' ? next.showMenu : current.showMenu,
        }));
      }
    };

    window.addEventListener(INTERACTION_PATCH_EVENT, handleInteractionPatch);
    return () => window.removeEventListener(INTERACTION_PATCH_EVENT, handleInteractionPatch);
  }, [screenId]);

  useEffect(() => {
    if (!route || route.owner === 'vj' || !presentation.autoRedirect) return;
    if (route.owner === 'baofa' && route.url) {
      window.location.replace(route.url);
    }
  }, [presentation.autoRedirect, route]);

  if (!screen) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-black text-white">
        <div className="flex flex-col items-center gap-4 text-center">
          <MonitorOff size={32} className="text-white/40" />
          <div>
            <div className="text-sm font-bold uppercase tracking-widest">{labels.unknownScreen}</div>
            <div className="mt-2 text-xs text-white/40">{screenId}</div>
          </div>
        </div>
      </div>
    );
  }

  if (route && route.owner !== 'vj') {
    const targetUrl = route.owner === 'baofa' ? route.url : null;

    return (
      <div className="flex h-screen w-screen items-center justify-center bg-black text-white">
        <div className="flex max-w-md flex-col items-center gap-4 px-8 text-center">
          <Route size={34} className="text-cyan-200/70" />
          <div>
            <div className="text-sm font-bold uppercase tracking-widest">Screen routed to {route.owner}</div>
            <div className="mt-2 text-xs uppercase tracking-wider text-white/45">{screenId}</div>
          </div>
          {targetUrl && (
            <a
              href={targetUrl}
              className="inline-flex items-center gap-2 rounded-md border border-cyan-200/25 bg-cyan-200/10 px-4 py-2 text-xs font-bold uppercase tracking-widest text-cyan-100 hover:bg-cyan-200 hover:text-black"
            >
              <ExternalLink size={14} />
              Open baofa screen
            </a>
          )}
          {presentation.autoRedirect && targetUrl && (
            <div className="text-[10px] font-bold uppercase tracking-widest text-white/35">Redirecting automatically</div>
          )}
          {presentation.autoRedirect && route.owner === 'baofa' && !targetUrl && (
            <div className="text-[10px] font-bold uppercase tracking-widest text-amber-200/55">Route URL unavailable</div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-screen min-h-screen w-screen overflow-hidden bg-black text-white">
      <Visualizer screenIdOverride={screenId} />
      {(presentation.showMenu || presentation.showDebug || routeError) && (
      <div className="pointer-events-none absolute right-4 top-4 z-40 rounded-lg border border-white/10 bg-black/45 px-3 py-2 backdrop-blur-md">
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest">
          {connected ? <Wifi size={13} className="text-cyan-300" /> : <WifiOff size={13} className="text-red-300" />}
          <span className={connected ? 'text-cyan-200' : 'text-red-200'}>{connected ? labels.synced : labels.waiting}</span>
        </div>
        {presentation.showMenu && <div className="mt-1 text-[10px] uppercase tracking-wider text-white/45">{screen.name}</div>}
        {(presentation.showDebug || routeError) && <div className="mt-1 max-w-40 truncate text-[9px] uppercase tracking-wider text-amber-200/65">{routeError ? 'Route fallback' : `Route ${route?.owner || 'unknown'}`}</div>}
      </div>
      )}
    </div>
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
