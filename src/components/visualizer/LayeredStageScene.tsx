import { useEffect, useRef } from 'react';
import { getAudioDriveSnapshot, getMusicDriveFrame, type AudioDriveMode } from '@/lib/audioDrive';
import { useStore } from '@/store/useStore';
import { layeredStageModule } from '@/visuals/layered-stage';

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const lerp = (from: number, to: number, amount: number) => from + (to - from) * amount;
const TARGET_FRAME_MS = 1000 / 45;

function hexToRgb(hex: string, fallback: [number, number, number]): [number, number, number] {
  const normalized = hex.replace('#', '').trim();
  if (normalized.length !== 6) return fallback;
  const value = Number.parseInt(normalized, 16);
  if (!Number.isFinite(value)) return fallback;
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function rgba(color: [number, number, number], alpha: number) {
  return `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${clamp01(alpha)})`;
}

function hashUnit(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) % 10_000) / 10_000;
}

interface SmoothedLayerState {
  drums: number;
  bassline: number;
  melody: number;
  theme: number;
  fx: number;
  experimental: number;
  beat: number;
  level: number;
  stepProgress: number;
}

export function LayeredStageScene() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef<SmoothedLayerState>({
    drums: 0,
    bassline: 0,
    melody: 0,
    theme: 0,
    fx: 0,
    experimental: 0,
    beat: 0,
    level: 0,
    stepProgress: 0,
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return undefined;

    let animationFrame = 0;
    let frameTimeout = 0;
    let width = 0;
    let height = 0;
    let dpr = 1;
    let lastNow = performance.now();
    let lastPaint = 0;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const nextDpr = Math.min(1, window.devicePixelRatio || 1);
      const nextWidth = Math.max(1, Math.floor(rect.width * nextDpr));
      const nextHeight = Math.max(1, Math.floor(rect.height * nextDpr));
      if (nextWidth === width && nextHeight === height && nextDpr === dpr) return;
      width = nextWidth;
      height = nextHeight;
      dpr = nextDpr;
      canvas.width = width;
      canvas.height = height;
    };

    const drawBackground = (
      theme: number,
      bassline: number,
      level: number,
      time: number,
      base: [number, number, number],
      secondary: [number, number, number],
      bg: [number, number, number],
      styleSeed: number,
    ) => {
      const gradient = ctx.createLinearGradient(0, 0, width, height);
      gradient.addColorStop(0, rgba(bg, 1));
      gradient.addColorStop(0.54, rgba(base, 0.16 + theme * 0.28));
      gradient.addColorStop(1, rgba(secondary, 0.1 + level * 0.22));
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);

      ctx.globalCompositeOperation = 'lighter';
      const waveCount = 3 + Math.floor(styleSeed * 4);
      const spread = 0.72 / Math.max(1, waveCount - 1);
      for (let index = 0; index < waveCount; index += 1) {
        const seedPhase = styleSeed * Math.PI * 2;
        const phase = time * (0.1 + index * 0.025 + styleSeed * 0.04) + index * 1.7 + seedPhase;
        const y = height * (0.14 + index * spread + Math.sin(phase) * (0.035 + styleSeed * 0.025));
        const amplitude = height * (0.05 + bassline * 0.12 + theme * 0.05);
        ctx.beginPath();
        ctx.moveTo(0, y);
        for (let x = 0; x <= width; x += 64) {
          const wave = Math.sin(x * (0.004 + styleSeed * 0.005) + phase) + Math.sin(x * 0.013 - phase * (0.5 + styleSeed * 0.45)) * 0.42;
          ctx.lineTo(x, y + wave * amplitude);
        }
        ctx.lineWidth = Math.max(18, height * (0.025 + level * 0.02));
        ctx.strokeStyle = rgba(index % 2 ? secondary : base, 0.08 + theme * 0.12);
        ctx.stroke();
      }
      ctx.globalCompositeOperation = 'source-over';
    };

    const drawStepGrid = (
      drums: number,
      fx: number,
      activeStep: number,
      progress: number,
      accent: [number, number, number],
    ) => {
      const columns = 16;
      const pad = Math.max(16, width * 0.025);
      const gridWidth = width - pad * 2;
      const cell = gridWidth / columns;
      const y = height - Math.max(34, height * 0.08);

      for (let index = 0; index < columns; index += 1) {
        const active = index === activeStep % columns;
        const pulse = active ? 0.35 + progress * 0.45 + drums * 0.28 : 0.08 + fx * 0.04;
        ctx.fillStyle = rgba(accent, pulse);
        ctx.fillRect(pad + index * cell + 2, y, Math.max(2, cell - 4), active ? 11 + drums * 18 : 4 + fx * 8);
      }
    };

    const drawMidLayer = (
      bassline: number,
      melody: number,
      experimental: number,
      beat: number,
      time: number,
      base: [number, number, number],
      secondary: [number, number, number],
      styleSeed: number,
    ) => {
      const cx = width * 0.5;
      const cy = height * 0.5;
      const radius = Math.min(width, height) * (0.19 + bassline * 0.12 + beat * 0.04);
      const lobeCount = 3 + Math.floor(styleSeed * 5);
      const rippleCount = 10 + Math.floor(styleSeed * 14);

      ctx.globalCompositeOperation = 'lighter';
      for (let ring = 0; ring < 3; ring += 1) {
        ctx.beginPath();
        const points = 96;
        for (let index = 0; index <= points; index += 1) {
          const angle = (index / points) * Math.PI * 2;
          const wobble = Math.sin(angle * (lobeCount + ring) + time * (0.62 + melody + styleSeed * 0.4)) * (12 + melody * 42);
          const spike = Math.sin(angle * rippleCount - time * (2.1 + styleSeed * 1.7)) * experimental * 22;
          const r = radius + ring * 34 + wobble + spike;
          const x = cx + Math.cos(angle) * r;
          const y = cy + Math.sin(angle) * r * (0.58 + bassline * 0.1);
          if (index === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.lineWidth = 1.5 + ring * 1.2 + beat * 5;
        ctx.strokeStyle = rgba(ring % 2 ? secondary : base, 0.18 + melody * 0.18 + beat * 0.08);
        ctx.stroke();
      }
      ctx.globalCompositeOperation = 'source-over';
    };

    const drawForeground = (
      drums: number,
      fx: number,
      level: number,
      time: number,
      accent: [number, number, number],
      styleSeed: number,
    ) => {
      ctx.globalCompositeOperation = 'lighter';
      const bars = 7 + Math.floor(styleSeed * 8);
      for (let index = 0; index < bars; index += 1) {
        const x = width * (0.18 + (index / (bars - 1)) * 0.64);
        const phase = time * (1.2 + fx * 1.6 + styleSeed * 0.8) + index * (0.52 + styleSeed * 0.48);
        const h = height * (0.08 + level * 0.18 + Math.max(0, Math.sin(phase)) * fx * 0.14);
        ctx.fillStyle = rgba(accent, 0.08 + drums * 0.24 + fx * 0.16);
        const lean = Math.sin(styleSeed * Math.PI * 2) * width * 0.012;
        ctx.beginPath();
        ctx.moveTo(x - 2 - lean, height * 0.5 - h * 0.5);
        ctx.lineTo(x + 2 - lean, height * 0.5 - h * 0.5);
        ctx.lineTo(x + 2 + lean, height * 0.5 + h * 0.5);
        ctx.lineTo(x - 2 + lean, height * 0.5 + h * 0.5);
        ctx.closePath();
        ctx.fill();
      }

      if (drums > 0.25) {
        ctx.fillStyle = rgba(accent, Math.min(0.16, drums * 0.18));
        ctx.fillRect(0, 0, width, height);
      }
      ctx.globalCompositeOperation = 'source-over';
    };

    const scheduleNextFrame = (delay = 0) => {
      if (delay > 0) {
        frameTimeout = window.setTimeout(() => {
          animationFrame = requestAnimationFrame(render);
        }, delay);
        return;
      }
      animationFrame = requestAnimationFrame(render);
    };

    const render = (now: number) => {
      if (document.hidden) {
        lastNow = now;
        scheduleNextFrame(250);
        return;
      }
      if (now - lastPaint < TARGET_FRAME_MS) {
        scheduleNextFrame(TARGET_FRAME_MS - (now - lastPaint));
        return;
      }
      lastPaint = now;
      resize();
      const delta = Math.min(80, now - lastNow);
      lastNow = now;
      const time = now * 0.001;
      const store = useStore.getState();
      const audioMode = store.audioDriveMode as AudioDriveMode;
      const audio = getAudioDriveSnapshot(audioMode);
      const music = getMusicDriveFrame(audioMode);
      const live = store.liveControls;
      const moduleAudio = layeredStageModule.mapAudioToVisualState(audio, music);
      const moduleLive = layeredStageModule.mapLiveControlsToParams(live);
      const liveSeed = [
        Math.round(live.colorX * 12),
        Math.round(live.structureX * 16),
        Math.round(live.structureY * 16),
        Math.round(live.textureX * 16),
        Math.round(live.textureY * 16),
        Math.round(live.atmosphereX * 12),
        Math.round(live.atmosphereY * 12),
      ].join('.');
      const styleSeed = hashUnit([
        moduleAudio.semanticSeed,
        liveSeed,
      ].join(':'));
      const target = moduleAudio.layers;
      const smoothing = 1 - Math.pow(0.001 / moduleLive.rhythmTightness, delta / 1000);
      const current = stateRef.current;

      current.drums = lerp(current.drums, clamp01(target.drums * moduleLive.punch), smoothing);
      current.bassline = lerp(current.bassline, clamp01(target.bassline * moduleLive.impact), smoothing);
      current.melody = lerp(current.melody, clamp01(target.melody * moduleLive.detail * moduleLive.structureScale), smoothing);
      current.theme = lerp(current.theme, clamp01(target.theme * moduleLive.brightness * moduleLive.atmosphereGlow), smoothing);
      current.fx = lerp(current.fx, clamp01(target.fx * moduleLive.variation * moduleLive.atmosphereGlow), smoothing);
      current.experimental = lerp(current.experimental, clamp01(target.experimental * moduleLive.variation * moduleLive.structureWarp), smoothing);
      current.beat = lerp(current.beat, clamp01(moduleAudio.beat * moduleLive.punch), smoothing);
      current.level = lerp(current.level, clamp01(moduleAudio.level * moduleLive.motion * moduleLive.atmosphereDepth), smoothing);
      current.stepProgress = moduleAudio.stepProgress;

      const base = hexToRgb(store.baseColor, [0, 195, 255]);
      const secondary = hexToRgb(store.secondaryColor, [255, 79, 112]);
      const accent = hexToRgb(store.accentColor, [255, 255, 255]);
      const bg = hexToRgb(store.bgColor, [0, 0, 0]);
      const animatedTime = time * moduleLive.motion;

      drawBackground(current.theme, current.bassline, current.level, animatedTime, base, secondary, bg, styleSeed);
      drawMidLayer(current.bassline, current.melody, current.experimental, current.beat, animatedTime, base, secondary, styleSeed);
      drawForeground(current.drums, current.fx, current.level, animatedTime, accent, styleSeed);
      drawStepGrid(current.drums, current.fx, moduleAudio.activeStep, current.stepProgress, accent);

      scheduleNextFrame(Math.max(0, TARGET_FRAME_MS - (performance.now() - now)));
    };

    resize();
    scheduleNextFrame();
    window.addEventListener('resize', resize);

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationFrame);
      window.clearTimeout(frameTimeout);
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 h-full w-full bg-black" />;
}
