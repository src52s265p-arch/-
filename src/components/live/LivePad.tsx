import React, { memo, useRef } from 'react';

interface LivePadProps {
  title: string;
  subtitle: string;
  x: number;
  y: number;
  accent: string;
  xLabel: string;
  yLabel: string;
  onChange: (x: number, y: number) => void;
}

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

export const LivePad = memo(function LivePad({ title, subtitle, x, y, accent, xLabel, yLabel, onChange }: LivePadProps) {
  const ref = useRef<HTMLDivElement>(null);

  const updateFromPointer = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const nextX = clamp01((event.clientX - rect.left) / rect.width);
    const nextY = clamp01(1 - ((event.clientY - rect.top) / rect.height));
    onChange(nextX, nextY);
  };

  return (
    <div className="rounded-lg border border-white/10 bg-[#0d0d10] p-3">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] font-black uppercase tracking-widest text-white">{title}</div>
          <div className="mt-1 text-[10px] leading-snug text-white/38">{subtitle}</div>
        </div>
        <div className="font-mono text-[9px] text-white/35">{x.toFixed(2)} / {y.toFixed(2)}</div>
      </div>
      <div
        ref={ref}
        role="slider"
        aria-label={title}
        tabIndex={0}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          updateFromPointer(event);
        }}
        onPointerMove={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) updateFromPointer(event);
        }}
        className="relative aspect-[1.25] touch-none overflow-hidden rounded-md border border-white/10 bg-black cursor-crosshair"
      >
        <div className="absolute inset-0 opacity-70" style={{ background: `radial-gradient(circle at ${x * 100}% ${(1 - y) * 100}%, ${accent}44, transparent 56%)` }} />
        <div className="absolute left-1/2 top-0 h-full w-px bg-white/10" />
        <div className="absolute left-0 top-1/2 h-px w-full bg-white/10" />
        <div
          className="absolute h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_18px_rgba(255,255,255,0.55)]"
          style={{ left: `${x * 100}%`, top: `${(1 - y) * 100}%`, background: accent }}
        />
        <div className="absolute bottom-2 left-2 text-[8px] font-bold uppercase tracking-widest text-white/35">{xLabel}</div>
        <div className="absolute right-2 top-2 text-[8px] font-bold uppercase tracking-widest text-white/35">{yLabel}</div>
      </div>
    </div>
  );
});
