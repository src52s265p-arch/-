import React, { useRef, useMemo, useState, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { EffectComposer, Bloom, Glitch, ChromaticAberration } from '@react-three/postprocessing';
import { GlitchMode, BlendFunction } from 'postprocessing';
import * as THREE from 'three';
import { getAudioDriveSnapshot, getMusicDriveFrame } from '@/lib/audioDrive';
import { useStore } from '@/store/useStore';
import { getVisualModule } from '@/visuals/registry';
import { BlueFontScene } from './BlueFontScene';
import { LayeredStageScene } from './LayeredStageScene';
import { PurpleScene } from './PurpleScene';
import { VideoFlowScene } from './VideoFlowScene';

const REACTIVE_AUDIO_FRAME_MS = 1000 / 60;
let reactiveAudioCache:
  | { frame: number; mode: string; autoVjEnabled: boolean; snapshot: ReturnType<typeof getAudioDriveSnapshot> }
  | null = null;

function getReactiveAudio() {
  const { audioDriveMode, autoVjEnabled } = useStore.getState();
  const now = typeof performance === 'undefined' ? Date.now() : performance.now();
  const frame = Math.floor(now / REACTIVE_AUDIO_FRAME_MS);
  if (
    reactiveAudioCache &&
    reactiveAudioCache.frame === frame &&
    reactiveAudioCache.mode === audioDriveMode &&
    reactiveAudioCache.autoVjEnabled === autoVjEnabled
  ) {
    return reactiveAudioCache.snapshot;
  }

  const audio = getAudioDriveSnapshot(audioDriveMode);
  const motionAmount = autoVjEnabled ? 0.9 : 0;
  const beatAmount = autoVjEnabled ? 0.75 : 0;

  const snapshot = {
    ...audio,
    volume: audio.volume * motionAmount,
    subBass: audio.subBass * motionAmount,
    bass: audio.bass * motionAmount,
    lowMid: audio.lowMid * motionAmount,
    mid: audio.mid * motionAmount,
    highMid: audio.highMid * motionAmount,
    treble: audio.treble * motionAmount,
    energy: audio.energy * motionAmount,
    beat: audio.beat * beatAmount,
    spectralCentroid: audio.spectralCentroid * motionAmount,
    spectralFlux: audio.spectralFlux * motionAmount,
    transient: audio.transient * motionAmount,
    dynamicRange: audio.dynamicRange * motionAmount,
  };
  reactiveAudioCache = { frame, mode: audioDriveMode, autoVjEnabled, snapshot };
  return snapshot;
}

const audioMutationFragment = `
  uniform float uTime;
  uniform float uEnergy;
  uniform float uBass;
  uniform float uMid;
  uniform float uTreble;
  uniform float uBeat;
  uniform float uHit;
  uniform float uSceneId;
  uniform float uLeftBass;
  uniform float uRightRhythm;
  uniform float uTopTreble;
  uniform float uBottomWave;
  uniform float uCenterVolume;
  uniform float uDensity;
  uniform float uMood;
  uniform float uPeak;
  uniform float uBuild;
  uniform float uRelease;
  uniform float uBreath;
  uniform float uSway;
  uniform float uPhrase;
  uniform float uGravity;
  uniform float uFlux;
  uniform float uTransient;
  uniform float uCentroid;
  uniform float uDynamicRange;
  uniform vec3 uBaseColor;
  uniform vec3 uSecondaryColor;
  uniform vec3 uAccentColor;
  uniform vec3 uBackgroundColor;
  varying vec2 vUv;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }

  mat2 rot(float a) {
    float s = sin(a);
    float c = cos(a);
    return mat2(c, -s, s, c);
  }

  float capsule(vec2 p, vec2 a, vec2 b, float r) {
    vec2 pa = p - a;
    vec2 ba = b - a;
    float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    return length(pa - ba * h) - r;
  }

  float luma(vec3 c) {
    return dot(c, vec3(0.2126, 0.7152, 0.0722));
  }

  vec3 softStageTone(vec3 c, float depth, float lift) {
    vec3 coolMist = mix(vec3(0.018, 0.034, 0.055), uBackgroundColor, 0.58);
    vec3 warmMist = mix(vec3(0.48, 0.34, 0.22), uAccentColor, 0.22);
    vec3 energyFog = mix(uBaseColor, uSecondaryColor, 0.48);
    float glowStep = smoothstep(0.22, 0.72, lift);
    float peakStep = smoothstep(0.68, 1.0, lift);
    vec3 tone = mix(coolMist, c, 0.58 + depth * 0.28);
    tone = mix(tone, energyFog, glowStep * 0.22);
    tone = mix(tone, warmMist, uMood * 0.08 + peakStep * 0.08);
    vec3 pearledPeak = mix(vec3(0.62, 0.69, 0.74), uAccentColor, 0.16);
    tone = mix(tone, pearledPeak, peakStep * 0.18);
    tone = tone / (tone + vec3(0.42));
    float lum = luma(tone);
    tone = mix(vec3(lum), tone, 1.12);
    return clamp(tone, vec3(0.0), vec3(0.84));
  }

  vec3 metallicRamp(float shade, float lift, vec3 energyColor) {
    vec3 deep = mix(vec3(0.018, 0.026, 0.04), uBackgroundColor, 0.62);
    vec3 graphite = mix(vec3(0.12, 0.16, 0.19), uBaseColor, 0.28);
    vec3 blueSteel = mix(vec3(0.24, 0.34, 0.43), uSecondaryColor, 0.34);
    vec3 softSilver = mix(vec3(0.58, 0.66, 0.72), uAccentColor, 0.12);
    vec3 tone = mix(deep, graphite, smoothstep(0.0, 0.42, shade));
    tone = mix(tone, blueSteel, smoothstep(0.18, 0.72, shade + lift * 0.24));
    tone = mix(tone, energyColor, clamp(0.12 + lift * 0.26 + uCentroid * 0.13, 0.0, 0.42));
    tone = mix(tone, softSilver, smoothstep(0.62, 1.24, shade + lift * 0.42) * 0.72);
    tone = mix(tone, uAccentColor, clamp(lift * 0.14 + uTopTreble * 0.08, 0.0, 0.24));
    return softStageTone(tone, shade, lift);
  }

  void main() {
    vec2 p = vUv * 2.0 - 1.0;
    p.x *= 1.62;
    float bodyBreath = sin(uTime * (0.28 + uBreath * 0.28) + uPhrase * 6.283) * (0.018 + uBreath * 0.035);
    p.x += sin(p.y * 1.25 + uTime * (0.18 + uSway * 0.28) + uPhrase * 3.1) * (0.018 + uSway * 0.045);
    p.y += bodyBreath - uGravity * 0.045 * smoothstep(-0.2, -1.0, p.y);

    float scene = floor(uSceneId + 0.5);
    float hit = clamp(uHit, 0.0, 1.0);
    float slow = uTime * (0.11 + uEnergy * 0.04 + uBuild * 0.045);
    vec3 energyColor = mix(uBaseColor, uSecondaryColor, clamp(0.18 + uCentroid * 0.82, 0.0, 1.0));

    float leftZone = smoothstep(0.85, -1.42, p.x);
    float rightZone = smoothstep(-0.28, 1.48, p.x);
    float topZone = smoothstep(-0.04, 0.92, p.y);
    float bottomZone = smoothstep(0.18, -0.94, p.y);
    float centerZone = smoothstep(0.95, 0.04, length(p * vec2(0.82, 1.18)));
    float travellingWave = smoothstep(0.08, 0.0, abs(sin((p.y + 1.0) * 5.4 - uTime * (0.34 + uBottomWave * 1.3) + p.x * 1.15)));
    float spatialLift = clamp(
      leftZone * uLeftBass * 0.34 +
      rightZone * uRightRhythm * 0.32 +
      topZone * uTopTreble * 0.28 +
      bottomZone * uBottomWave * (0.2 + travellingWave * 0.38) +
      centerZone * uCenterVolume * 0.35,
      0.0,
      1.0
    );

    vec3 color = vec3(0.0);
    float alpha = 0.0;

    for (int i = 0; i < 9; i++) {
      float fi = float(i);
      vec2 seed = vec2(hash(vec2(fi, 2.3)), hash(vec2(fi, 9.1)));
      vec2 center = vec2(seed.x * 3.0 - 1.5, seed.y * 1.72 - 0.86);
      float entrance = fract(uPhrase + seed.x * 0.72 + seed.y * 0.31 + fi * 0.071);
      float delayedResponse = smoothstep(0.08, 0.72, entrance) * (1.0 - smoothstep(0.82, 1.0, entrance));
      float followerResponse = mix(0.48, 1.12, delayedResponse);
      float bandPick = mod(fi + scene, 3.0);
      float band = bandPick < 0.5 ? uBass : (bandPick < 1.5 ? uMid : uTreble);
      float zoneDrive = clamp(
        smoothstep(0.65, -1.35, center.x) * uLeftBass +
        smoothstep(-0.35, 1.35, center.x) * uRightRhythm +
        smoothstep(-0.1, 0.9, center.y) * uTopTreble +
        smoothstep(0.1, -0.9, center.y) * uBottomWave +
        smoothstep(0.9, 0.02, length(center)) * uCenterVolume,
        0.0,
        1.45
      );
      float localImpact = clamp(
        hit * (0.12 + band * 0.3) * followerResponse +
        zoneDrive * (0.16 + seed.x * 0.16) +
        uBuild * (0.07 + delayedResponse * 0.1) +
        uRelease * delayedResponse * (0.18 + band * 0.2) +
        uEnergy * 0.07,
        0.0,
        1.0
      );
      float holdScale = 1.0 + localImpact * (0.1 + uBass * 0.14) + uBreath * 0.035 * sin(uTime * 0.55 + fi);

      if (scene < 0.5) {
        center += vec2(sin(slow * 2.0 + fi), cos(slow * 1.7 + fi * 1.4)) * (0.07 + uSway * 0.04);
      } else if (scene < 1.5) {
        center += vec2(sin(slow + fi * 0.8), cos(slow * 1.3 + fi)) * (0.14 + uBass * 0.04 + uBuild * 0.06);
      } else if (scene < 2.5) {
        float a = fi * 0.72 + slow * (0.78 + uRightRhythm * 0.32) + delayedResponse * uRelease * 0.85;
        center = vec2(cos(a) * (0.36 + seed.x), sin(a) * (0.18 + seed.y * 0.6));
      } else if (scene < 3.5) {
        center.y = -0.72 + seed.y * 1.44;
        center.x += sin(slow * 2.4 + fi) * (0.14 + uMid * 0.09 + delayedResponse * uRelease * 0.1);
      } else if (scene < 4.5) {
        center += vec2(sin(slow * 1.1 + fi), sin(slow * 1.35 + fi * 1.7)) * (0.1 + uBreath * 0.05 + uGravity * 0.03);
      } else {
        center.y += sin(center.x * 2.6 + slow * 2.2) * (0.18 + uSway * 0.08);
      }

      vec2 q = (p - center) / holdScale;
      q *= rot((seed.x - 0.5) * 2.8 + sin(slow + fi) * 0.32);

      float body;
      if (scene < 1.5) {
        body = smoothstep(0.38 + localImpact * 0.1, 0.04, length(q * vec2(0.72, 1.2)));
      } else if (scene < 2.5) {
        body = smoothstep(0.045, 0.0, abs(length(q) - (0.24 + seed.x * 0.18 + localImpact * 0.08)));
      } else if (scene < 3.5) {
        body = smoothstep(0.028 + uMid * 0.01, 0.0, abs(capsule(q, vec2(-0.62, 0.0), vec2(0.62, 0.0), 0.016 + localImpact * 0.012)));
      } else if (scene < 4.5) {
        float rings = sin(length(q * vec2(1.35, 0.82)) * (19.0 + seed.x * 9.0) - uTime * (0.8 + uBass * 1.8));
        body = smoothstep(0.94 - localImpact * 0.1, 1.0, rings) * smoothstep(0.92, 0.05, length(q));
      } else {
        body = smoothstep(0.035, 0.0, abs(sin((q.x * 4.0 + q.y * 2.4) + slow * 5.0))) * smoothstep(0.75, 0.05, length(q));
      }

      float edge = smoothstep(0.045, 0.0, abs(length(q * vec2(0.72, 1.2)) - (0.22 + localImpact * 0.08)));
      float ripple = smoothstep(0.035, 0.0, abs(sin(length(q) * (18.0 + seed.x * 18.0) - uTime * (0.82 + band * 1.55) - delayedResponse * uRelease * 2.4)));
      ripple *= smoothstep(0.92, 0.05, length(q)) * (0.12 + uBass * 0.3 + uBeat * 0.22 + uRelease * delayedResponse * 0.22);
      float grain = noise(q * (12.0 + seed.x * 12.0) + uTime * 0.08);
      float textureFlow = noise(q * (5.0 + uDensity * 9.0) + vec2(uTime * (0.06 + uMood * 0.14), -uTime * 0.05));
      float highlight = clamp(body * (0.14 + localImpact * 0.26 + zoneDrive * 0.1 + uBuild * 0.08) + edge * 0.42 + ripple * 0.28 + grain * body * 0.12 + textureFlow * body * uTopTreble * 0.12 + uRelease * delayedResponse * edge * 0.18, 0.0, 0.86);

      vec3 mat = metallicRamp(body + edge * 0.85 + grain * 0.14 + zoneDrive * 0.08, highlight, energyColor);
      color += mat * (body * 0.22 + edge * 0.46 + ripple * 0.34 + textureFlow * body * 0.08 + uBuild * body * 0.045);
      alpha += body * 0.09 + edge * 0.24 + ripple * 0.14 + delayedResponse * uRelease * edge * 0.055;
    }

    float trackNoise = noise(p * (2.5 + scene) + vec2(uTime * 0.06, -uTime * 0.05));
    float track = smoothstep(0.93, 1.0, sin(p.x * (4.0 + scene * 1.1 + uDensity * 1.2) + p.y * 2.1 + trackNoise * 1.4 + uTime * (0.2 + uRightRhythm * 0.24 + uBuild * 0.12)));
    vec3 trackColor = metallicRamp(trackNoise + spatialLift * 0.22, 0.16 + uTopTreble * 0.18 + spatialLift * 0.24, energyColor);
    color += trackColor * track * (0.018 + uEnergy * 0.026 + spatialLift * 0.05);
    alpha += track * (0.024 + uEnergy * 0.026 + spatialLift * 0.045);

    vec3 regionWash = softStageTone(mix(uBackgroundColor, mix(energyColor, uAccentColor, 0.2), 0.16 + uMood * 0.22), spatialLift, uPeak + uBuild * 0.25);
    color += regionWash * spatialLift * (0.022 + uPeak * 0.028 + uBuild * 0.024);
    alpha += spatialLift * (0.028 + uBuild * 0.02);

    color = softStageTone(color, spatialLift, uPeak + uRelease * 0.35);
    alpha = clamp(alpha * (0.66 + uEnergy * 0.18 + uPeak * 0.08 + uBuild * 0.13), 0.0, 0.64);
    gl_FragColor = vec4(color, alpha);
  }
`;

const getSceneAudioProfile = (scene: string) => {
  if (scene === 'Liquid') return 1;
  if (scene === 'Topology') return 2;
  if (scene === 'Pulse') return 3;
  if (scene === 'Void') return 4;
  if (scene === 'Dumbar') return 5;
  return 0;
};

function AudioMutationOverlay({ sceneOverride }: { sceneOverride?: string }) {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const impactRef = useRef(0);
  const holdRef = useRef(0);
  const spatialRef = useRef({
    leftBass: 0,
    rightRhythm: 0,
    topTreble: 0,
    bottomWave: 0,
    centerVolume: 0,
    density: 0,
    mood: 0,
    peak: 0,
    build: 0,
    release: 0,
    breath: 0,
    sway: 0,
    phrase: 0,
    gravity: 0,
  });
  const baseColor = useStore((state) => state.baseColor);
  const secondaryColor = useStore((state) => state.secondaryColor);
  const accentColor = useStore((state) => state.accentColor);
  const bgColor = useStore((state) => state.bgColor);
  const currentScene = useStore((state) => state.currentScene);
  const scene = sceneOverride || currentScene;
  const disabled = scene === 'Void' || scene === 'Topology' || scene === 'Pulse';

  useFrame((state) => {
    if (disabled || !matRef.current) return;
    const { volume, subBass, bass, lowMid, mid, highMid, treble, beat, energy, spectralFlux, transient, spectralCentroid, dynamicRange } = getReactiveAudio();
    const uniforms = matRef.current.uniforms;
    const incomingHit = Math.max(beat, transient * 0.8, spectralFlux * 0.55, bass * 0.45);
    impactRef.current = Math.max(incomingHit, impactRef.current * 0.9);
    holdRef.current += (impactRef.current - holdRef.current) * (incomingHit > holdRef.current ? 0.18 : 0.055);
    const lowEnergy = Math.max(subBass * 0.9, bass);
    const rhythmDensity = Math.max(beat * 0.74, spectralFlux * 0.85, transient * 0.72, mid * 0.38);
    const detailEnergy = Math.max(treble, highMid * 0.82, spectralCentroid * 0.42);
    const bodyEnergy = Math.max(volume, energy * 0.85);
    const spaceWave = Math.max(dynamicRange * 0.55, lowMid * 0.48, spectralFlux * 0.38);
    const peak = Math.max(incomingHit, bodyEnergy * 0.5);
    const mood = Math.max(0, Math.min(1, spectralCentroid * 0.58 + dynamicRange * 0.22 + detailEnergy * 0.2));
    const density = Math.max(0, Math.min(1, spectralFlux * 0.6 + transient * 0.25 + mid * 0.22 + highMid * 0.18));
    const macroEnergy = Math.max(0, Math.min(1, bodyEnergy * 0.34 + rhythmDensity * 0.28 + lowEnergy * 0.22 + mood * 0.16));
    const breath = Math.max(0, Math.min(1, lowEnergy * 0.46 + bodyEnergy * 0.34 + dynamicRange * 0.2));
    const sway = Math.max(0, Math.min(1, mid * 0.42 + lowMid * 0.25 + rhythmDensity * 0.24 + spectralFlux * 0.12));
    const gravity = Math.max(0, Math.min(1, subBass * 0.62 + bass * 0.28 + beat * 0.1));
    const spatial = spatialRef.current;
    spatial.leftBass += (lowEnergy - spatial.leftBass) * (lowEnergy > spatial.leftBass ? 0.16 : 0.045);
    spatial.rightRhythm += (rhythmDensity - spatial.rightRhythm) * (rhythmDensity > spatial.rightRhythm ? 0.2 : 0.06);
    spatial.topTreble += (detailEnergy - spatial.topTreble) * (detailEnergy > spatial.topTreble ? 0.18 : 0.075);
    spatial.bottomWave += (spaceWave - spatial.bottomWave) * (spaceWave > spatial.bottomWave ? 0.11 : 0.04);
    spatial.centerVolume += (bodyEnergy - spatial.centerVolume) * (bodyEnergy > spatial.centerVolume ? 0.13 : 0.05);
    spatial.density += (density - spatial.density) * 0.12;
    spatial.mood += (mood - spatial.mood) * 0.055;
    spatial.peak = Math.max(peak, spatial.peak * 0.88);
    spatial.build += (macroEnergy - spatial.build) * (macroEnergy > spatial.build ? 0.025 : 0.007);
    spatial.release = Math.max(peak * (0.55 + spatial.build * 0.45), spatial.release * 0.9);
    spatial.breath += (breath - spatial.breath) * (breath > spatial.breath ? 0.085 : 0.028);
    spatial.sway += (sway - spatial.sway) * (sway > spatial.sway ? 0.07 : 0.035);
    spatial.gravity += (gravity - spatial.gravity) * (gravity > spatial.gravity ? 0.1 : 0.026);
    spatial.phrase = (spatial.phrase + 0.0018 + spatial.density * 0.0035 + spatial.build * 0.0022 + spatial.release * 0.0025) % 1;
    uniforms.uTime.value = state.clock.elapsedTime;
    uniforms.uEnergy.value += (energy - uniforms.uEnergy.value) * 0.12;
    uniforms.uBass.value += (bass - uniforms.uBass.value) * 0.16;
    uniforms.uMid.value += (Math.max(mid, lowMid) - uniforms.uMid.value) * 0.14;
    uniforms.uTreble.value += (Math.max(treble, highMid) - uniforms.uTreble.value) * 0.18;
    uniforms.uBeat.value += (beat - uniforms.uBeat.value) * 0.18;
    uniforms.uHit.value = holdRef.current;
    uniforms.uSceneId.value = getSceneAudioProfile(scene);
    uniforms.uLeftBass.value = spatial.leftBass;
    uniforms.uRightRhythm.value = spatial.rightRhythm;
    uniforms.uTopTreble.value = spatial.topTreble;
    uniforms.uBottomWave.value = spatial.bottomWave;
    uniforms.uCenterVolume.value = spatial.centerVolume;
    uniforms.uDensity.value = spatial.density;
    uniforms.uMood.value = spatial.mood;
    uniforms.uPeak.value = spatial.peak;
    uniforms.uBuild.value = spatial.build;
    uniforms.uRelease.value = spatial.release;
    uniforms.uBreath.value = spatial.breath;
    uniforms.uSway.value = spatial.sway;
    uniforms.uPhrase.value = spatial.phrase;
    uniforms.uGravity.value = spatial.gravity;
    uniforms.uFlux.value += (spectralFlux - uniforms.uFlux.value) * 0.25;
    uniforms.uTransient.value += (transient - uniforms.uTransient.value) * 0.34;
    uniforms.uCentroid.value += (spectralCentroid - uniforms.uCentroid.value) * 0.16;
    uniforms.uDynamicRange.value += (dynamicRange - uniforms.uDynamicRange.value) * 0.14;
    uniforms.uBaseColor.value.set(baseColor);
    uniforms.uSecondaryColor.value.set(secondaryColor);
    uniforms.uAccentColor.value.set(accentColor);
    uniforms.uBackgroundColor.value.set(bgColor);
  });

  if (disabled) return null;

  return (
    <mesh position={[0, 0, 2.8]} renderOrder={50}>
      <planeGeometry args={[22, 12]} />
      <shaderMaterial
        ref={matRef}
        vertexShader="varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }"
        fragmentShader={audioMutationFragment}
        uniforms={{
          uTime: { value: 0 },
          uEnergy: { value: 0 },
          uBass: { value: 0 },
          uMid: { value: 0 },
          uTreble: { value: 0 },
          uBeat: { value: 0 },
          uHit: { value: 0 },
          uSceneId: { value: getSceneAudioProfile(scene) },
          uLeftBass: { value: 0 },
          uRightRhythm: { value: 0 },
          uTopTreble: { value: 0 },
          uBottomWave: { value: 0 },
          uCenterVolume: { value: 0 },
          uDensity: { value: 0 },
          uMood: { value: 0 },
          uPeak: { value: 0 },
          uBuild: { value: 0 },
          uRelease: { value: 0 },
          uBreath: { value: 0 },
          uSway: { value: 0 },
          uPhrase: { value: 0 },
          uGravity: { value: 0 },
          uFlux: { value: 0 },
          uTransient: { value: 0 },
          uCentroid: { value: 0 },
          uDynamicRange: { value: 0 },
          uBaseColor: { value: new THREE.Color(baseColor) },
          uSecondaryColor: { value: new THREE.Color(secondaryColor) },
          uAccentColor: { value: new THREE.Color(accentColor) },
          uBackgroundColor: { value: new THREE.Color(bgColor) },
        }}
        transparent
        depthTest={false}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}

// === WEBCAM HOOK ===
function useWebcamTexture() {
  const [video] = useState(() => {
    const v = document.createElement('video');
    v.crossOrigin = 'Anonymous';
    v.playsInline = true;
    v.muted = true;
    return v;
  });
  const [texture] = useState(() => {
    const tex = new THREE.VideoTexture(video);
    tex.generateMipmaps = false;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    return tex;
  });

  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } })
      .then((stream) => {
        video.srcObject = stream;
        video.play().catch((e) => {
          if (e.name !== 'AbortError') console.warn('Error playing video', e);
        });
      }).catch(err => console.log('Camera access denied or unavailable', err));
    return () => {
      const stream = video.srcObject as MediaStream;
      stream?.getTracks().forEach(t => t.stop());
    };
  }, [video]);

  return texture;
}

// === SCENES ===

// 1. VOID SCENE (liquid chrome organism / cybernetic immersive space)
const voidVertex = `
  uniform float uTime;
  uniform float uSubBass;
  uniform float uBass;
  uniform float uMid;
  uniform float uBeat;
  attribute float aSeed;
  varying float vHue;
  varying float vDepth;
  varying vec2 vUv;

  float hash(float n) {
    return fract(sin(n) * 43758.5453123);
  }

  void main() {
    vUv = uv;
    vec3 p = position;
    float id = aSeed;
    float drift = uTime * (0.08 + hash(id) * 0.12);
    p.x += sin(drift + position.z * 0.18) * (0.25 + uBass * 0.9);
    p.y += cos(drift * 1.25 + position.x * 0.2) * (0.18 + uMid * 0.45);
    p.z += sin(drift * 0.65 + position.y * 0.22) * (0.38 + uSubBass * 0.9);

    float depthPulse = 1.0 + uBeat * 0.18 + uSubBass * 0.12;
    p.xy *= depthPulse;

    vHue = hash(id * 2.17);
    vDepth = smoothstep(-18.0, 18.0, p.z);
    vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
    float nearBoost = smoothstep(0.0, 1.0, vDepth);
    gl_PointSize = (34.0 + 150.0 * hash(id * 4.31) + 82.0 * uBeat) * (1.0 / -mvPosition.z) * (0.8 + nearBoost * 0.75);
    gl_Position = projectionMatrix * mvPosition;
  }
`;
const voidFragment = `
  uniform vec3 uColor;
  uniform vec3 uSecondaryColor;
  uniform float uEnergy;
  uniform float uBeat;
  varying float vHue;
  varying float vDepth;

  void main() {
    vec2 cxy = 2.0 * gl_PointCoord - 1.0;
    float r = length(cxy);
    if(r > 1.0) discard;

    float core = smoothstep(0.42, 0.0, r);
    float ring = smoothstep(0.72, 0.52, r) * smoothstep(0.28, 0.52, r);
    float mesh = (sin(cxy.x * 42.0 + vHue * 8.0) * sin(cxy.y * 37.0 - vHue * 5.0)) * 0.5 + 0.5;
    float highlight = pow(max(0.0, 1.0 - distance(cxy, vec2(-0.28, 0.32)) * 2.0), 5.5);
    float shade = smoothstep(1.0, 0.15, r);

    vec3 steel = vec3(0.30, 0.34, 0.38);
    vec3 graphite = vec3(0.015, 0.018, 0.024);
    vec3 chrome = mix(graphite, steel, shade);
    chrome += vec3(0.9, 1.0, 1.0) * highlight * 0.55;
    chrome += mix(uColor, uSecondaryColor, vHue) * (ring * (0.22 + mesh * 0.18) + core * 0.05);

    float ripple = smoothstep(0.035, 0.0, abs(fract(r * 5.5 - uBeat * 0.4 - vHue) - 0.5));
    float alpha = core * 0.22 + ring * 0.34 + ripple * ring * 0.16 + highlight * 0.22;
    alpha *= 0.34 + uEnergy * 0.16 + uBeat * 0.1;
    alpha *= 0.42 + vDepth * 0.34;
    gl_FragColor = vec4(chrome, alpha);
  }
`;

const darkSpaceStageFragment = `
  uniform float uTime;
  uniform float uBass;
  uniform float uMid;
  uniform float uTreble;
  uniform float uEnergy;
  uniform float uBeat;
  uniform vec3 uColor;
  uniform vec3 uSecondaryColor;
  varying vec2 vUv;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }

  float lineField(vec2 uv, float scale, float offset) {
    vec2 warped = uv * scale;
    float horizontal = abs(fract(warped.y + sin(uv.x * 5.0 + uTime * 0.35 + offset) * 0.08) - 0.5);
    float vertical = abs(fract(warped.x + sin(uv.y * 4.0 - uTime * 0.22 + offset) * 0.06) - 0.5);
    return smoothstep(0.028, 0.0, min(horizontal, vertical));
  }

  float softOval(vec2 uv, vec2 center, vec2 radius, float angle) {
    float s = sin(angle);
    float c = cos(angle);
    mat2 r = mat2(c, -s, s, c);
    vec2 p = r * (uv - center);
    return length(p / radius);
  }

  float perspectiveFloor(vec2 p, float audio) {
    float y = p.y + 1.18;
    if (y <= 0.02) return 0.0;
    float z = 1.0 / y;
    vec2 guv = vec2(p.x * z * 1.15, z * 0.68 - uTime * (0.18 + audio * 0.24));
    float gx = abs(fract(guv.x * 1.9) - 0.5);
    float gy = abs(fract(guv.y * 1.35) - 0.5);
    float line = smoothstep(0.035, 0.0, min(gx / z, gy / z));
    return line * smoothstep(6.0, 0.35, z) * smoothstep(-0.08, -0.82, p.y);
  }

  float perspectiveWall(vec2 p, float offset) {
    vec2 q = p;
    q.y += sin(q.x * 2.8 + uTime * 0.18 + offset) * 0.04;
    float vertical = abs(fract((q.x / max(0.38, 1.45 - q.y)) * 4.4 + offset) - 0.5);
    float horizontal = abs(fract((q.y + 0.22) * 4.2 + sin(q.x * 2.4 + uTime * 0.16) * 0.12) - 0.5);
    float line = smoothstep(0.028, 0.0, min(vertical, horizontal));
    return line * smoothstep(-0.55, 0.28, q.y) * smoothstep(1.25, -0.08, q.y);
  }

  float organicLine(vec2 p, float y, float amp, float freq, float phase) {
    float wave = y + sin(p.x * freq + phase + uTime * 0.08) * amp + sin(p.x * (freq * 0.42) - phase) * amp * 0.65;
    return smoothstep(0.022, 0.0, abs(p.y - wave));
  }

  float metaballField(vec2 uv, float audio) {
    float field = 0.0;
    for (int i = 0; i < 24; i++) {
      float fi = float(i);
      vec2 seed = vec2(fi * 13.71, fi * 19.37);
      vec2 center = vec2(hash(seed), hash(seed + 4.2));
      center += vec2(
        sin(uTime * (0.035 + hash(seed) * 0.045) + fi),
        cos(uTime * (0.04 + hash(seed + 7.0) * 0.04) + fi * 1.3)
      ) * (0.08 + audio * 0.04);
      vec2 d = uv - center;
      float radius = 0.035 + hash(seed + 2.0) * 0.11;
      field += radius * radius / max(dot(d, d), 0.0018);
    }
    return field;
  }

  void main() {
    vec2 uv = vUv;
    vec2 p = uv * 2.0 - 1.0;
    p.x *= 1.7;

    float t = uTime * 0.12;
    float n1 = noise(uv * 1.7 + vec2(t, -t * 0.72));
    float n2 = noise(uv * 4.4 + vec2(-t * 1.2, t * 0.9));
    vec2 driftUv = uv + vec2(n1 - 0.5, n2 - 0.5) * (0.09 + uBass * 0.055);
    vec2 stageP = p;

    vec3 peach = vec3(1.0, 0.54, 0.42);
    vec3 lemon = vec3(1.0, 0.94, 0.16);
    vec3 rose = vec3(1.0, 0.28, 0.86);
    vec3 cyan = vec3(0.15, 0.96, 1.0);
    vec3 green = vec3(0.18, 1.0, 0.34);
    vec3 violet = vec3(0.55, 0.24, 1.0);
    vec3 coral = vec3(1.0, 0.18, 0.06);

    float liquidField = metaballField(driftUv, uEnergy);
    vec3 paper = mix(vec3(0.96, 0.72, 0.68), vec3(0.88, 0.86, 0.48), smoothstep(-0.9, 0.8, stageP.x));
    paper = mix(paper, vec3(0.72, 0.94, 0.78), smoothstep(0.25, 0.95, sin(stageP.x * 1.6 - stageP.y * 0.8 + n1)));
    vec3 col = paper * 0.82;
    vec3 wash = mix(peach, lemon, smoothstep(-0.82, 0.95, stageP.x + n1 * 0.7));
    wash = mix(wash, rose, smoothstep(0.2, 0.88, sin((driftUv.x + driftUv.y) * 2.7 + uTime * 0.12)) * 0.5);
    wash = mix(wash, cyan, smoothstep(0.62, 0.96, sin(driftUv.y * 5.6 - uTime * 0.2 + n2 * 1.4)) * 0.44);
    wash = mix(wash, green, smoothstep(0.74, 0.98, sin(driftUv.x * 6.2 + uTime * 0.14)) * 0.35);
    float liquidMask = smoothstep(0.72, 2.9, liquidField);
    float liquidCore = smoothstep(2.2, 8.0, liquidField);
    vec3 liquidColor = mix(rose, cyan, smoothstep(0.25, 0.95, sin(liquidField * 0.42 + uTime * 0.12)));
    liquidColor = mix(liquidColor, lemon, smoothstep(1.1, 4.8, liquidField) * 0.42);
    wash = mix(wash, liquidColor, liquidMask * 0.34);
    float veilAlpha = 0.42 + uEnergy * 0.08;
    col = mix(col, wash, veilAlpha);
    col += liquidColor * liquidCore * (0.05 + uBass * 0.04);

    float floorGrid = perspectiveFloor(stageP, uEnergy);
    float wallGrid = perspectiveWall(stageP, 0.0);
    float rearGrid = perspectiveWall(stageP * vec2(0.82, 1.08) + vec2(0.03, 0.08), 1.7);
    float softGrid = lineField(driftUv + vec2(n1, n2) * 0.06, 5.0, 0.0);
    float fineGrid = lineField(driftUv + vec2(n2, n1) * 0.04, 10.5, 2.7);
    vec3 lineColor = mix(violet, cyan, 0.42 + uTreble * 0.45);
    col += lineColor * wallGrid * (0.08 + uTreble * 0.05);
    col += mix(cyan, lemon, 0.45) * floorGrid * (0.08 + uBass * 0.04);
    col += rose * rearGrid * 0.04;
    col += lineColor * softGrid * (0.05 + uEnergy * 0.04);
    col += vec3(1.0, 0.32, 0.0) * fineGrid * 0.025;

    float organicLines = 0.0;
    organicLines += organicLine(stageP, -0.62, 0.035, 3.2, 0.2);
    organicLines += organicLine(stageP, -0.32, 0.03, 3.7, 1.6);
    organicLines += organicLine(stageP, -0.02, 0.032, 2.8, 3.1);
    organicLines += organicLine(stageP, 0.28, 0.026, 3.3, 4.6);
    organicLines += organicLine(vec2(stageP.y, stageP.x), -0.58, 0.028, 2.6, 0.9);
    organicLines += organicLine(vec2(stageP.y, stageP.x), 0.42, 0.026, 3.1, 2.2);
    col = mix(col, vec3(0.78, 0.13, 0.48), clamp(organicLines * 0.32, 0.0, 0.42));

    float curtain1 = smoothstep(0.035, 0.0, abs(sin(stageP.x * 1.2 + stageP.y * 2.8 + uTime * 0.16 + n1 * 1.8)));
    float curtain2 = smoothstep(0.04, 0.0, abs(sin(stageP.x * -1.65 + stageP.y * 2.15 - uTime * 0.14 + n2 * 1.7)));
    float gauze = (curtain1 * 0.16 + curtain2 * 0.12) * smoothstep(-1.1, 0.75, stageP.y);
    col += mix(rose, cyan, 0.55 + 0.35 * sin(uTime * 0.18)) * gauze * (0.22 + uEnergy * 0.12);

    for (int i = 0; i < 32; i++) {
      float fi = float(i);
      vec2 seed = vec2(fi * 17.13, fi * 9.41);
      float layer = hash(seed + 11.0);
      vec2 center = vec2(hash(seed), hash(seed + 3.7));
      center.x += (layer - 0.5) * 0.18;
      center.y = mix(center.y, center.y * 0.72 + 0.1, layer);
      float parallax = mix(0.035, 0.11, layer);
      center += vec2(
        sin(uTime * (0.06 + hash(seed) * 0.06) + fi * 1.7),
        cos(uTime * (0.05 + hash(seed + 8.0) * 0.05) + fi)
      ) * parallax;
      float breathe = 1.0 + sin(uTime * (0.34 + layer * 0.25) + fi) * (0.08 + uBeat * 0.18);
      vec2 radius = vec2(0.05 + hash(seed + 1.0) * 0.15, 0.038 + hash(seed + 2.0) * 0.12) * breathe * mix(0.72, 1.48, layer);
      float d = softOval(driftUv, center, radius, uTime * (0.035 + layer * 0.06) + fi);
      float shell = smoothstep(1.16, 0.86, d) * smoothstep(0.45, 0.78, d);
      float ripple = smoothstep(0.032, 0.0, abs(fract(d * (4.2 + layer * 3.5) - uTime * (0.11 + layer * 0.12)) - 0.5));
      float glow = smoothstep(3.2, 0.36, d) * mix(0.12, 0.32, layer);
      float core = smoothstep(0.32, 0.0, d);
      float hatch = (sin((driftUv.x + center.y) * (70.0 + layer * 70.0)) * sin((driftUv.y + center.x) * (65.0 + layer * 60.0))) * 0.5 + 0.5;
      vec3 orbCol = mix(coral, violet, hash(seed + 4.0));
      orbCol = mix(orbCol, cyan, smoothstep(0.45, 0.9, hash(seed + 5.0)));
      orbCol = mix(orbCol, uColor, 0.18);
      col += orbCol * (glow * 0.46 + shell * (0.34 + hatch * 0.26) + ripple * shell * 0.18 + core * (0.16 + uBeat * 0.22));
      col = mix(col, vec3(0.04, 0.055, 0.03), core * step(0.76, hash(seed + 6.0)) * 0.5);
    }

    float beamA = pow(max(0.0, 1.0 - abs(stageP.x * 0.44 + stageP.y * 0.22)), 3.2);
    float beamB = pow(max(0.0, 1.0 - abs(stageP.x * -0.52 + stageP.y * 0.18)), 3.4);
    float rearHalo = smoothstep(0.72, 0.04, length(stageP * vec2(0.72, 1.2) - vec2(0.0, 0.12)));
    float floorGlow = smoothstep(-0.12, -1.0, stageP.y);
    col += mix(uColor, uSecondaryColor, 0.55) * beamA * (0.04 + uBeat * 0.05);
    col += mix(lemon, rose, 0.34) * beamB * (0.04 + uMid * 0.04);
    col += vec3(1.0, 0.78, 0.18) * floorGlow * (0.035 + uBass * 0.035);
    col += mix(rose, cyan, 0.35) * rearHalo * (0.04 + uEnergy * 0.06);
    col += wash * 0.04;

    float grain = hash(floor(driftUv * vec2(420.0, 260.0)) + floor(uTime * 5.0));
    col = mix(col, col + (grain - 0.5) * 0.18, 0.38);
    col = clamp(col, vec3(0.0), vec3(1.0));
    col = pow(max(col, vec3(0.0)), vec3(1.03));

    gl_FragColor = vec4(col, 1.0);
  }
`;

const darkSpaceChromeStageFragment = `
  uniform float uTime;
  uniform float uBass;
  uniform float uMid;
  uniform float uTreble;
  uniform float uEnergy;
  uniform float uBeat;
  uniform vec3 uColor;
  uniform vec3 uSecondaryColor;
  varying vec2 vUv;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 5; i++) {
      v += noise(p) * a;
      p = mat2(1.62, -1.18, 1.18, 1.62) * p + 0.27;
      a *= 0.52;
    }
    return v;
  }

  float sdCapsule(vec2 p, vec2 a, vec2 b, float r) {
    vec2 pa = p - a;
    vec2 ba = b - a;
    float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    return length(pa - ba * h) - r;
  }

  float membrane(vec2 p, float scale, float phase) {
    vec2 q = p * scale;
    q.x += sin(q.y * 1.7 + uTime * 0.18 + phase) * 0.42;
    q.y += sin(q.x * 1.15 - uTime * 0.13 + phase * 1.7) * 0.32;
    float n = fbm(q * 0.46 + vec2(uTime * 0.035, -uTime * 0.025));
    float ridge = abs(sin(q.x * 1.9 + n * 5.8 + phase) + cos(q.y * 1.45 - n * 4.2));
    return smoothstep(1.0, 0.12, ridge);
  }

  float wireGrid(vec2 p, float depth, float warp) {
    vec2 q = p;
    q.x *= 1.0 + depth * 0.8;
    q.y += sin(q.x * 2.2 + uTime * 0.1) * warp;
    float gx = abs(fract(q.x * (4.0 + depth * 5.0)) - 0.5);
    float gy = abs(fract((q.y + depth * 0.35) * (3.2 + depth * 4.0)) - 0.5);
    float line = smoothstep(0.026, 0.0, min(gx, gy) / (1.0 + depth * 1.8));
    return line * smoothstep(1.25, -0.35, abs(q.y));
  }

  float energyPath(vec2 p, float offset) {
    float y = sin(p.x * 1.75 + offset + uTime * 0.22) * 0.32;
    y += sin(p.x * 4.1 - offset * 1.4 - uTime * 0.11) * 0.09;
    float d = abs(p.y - y);
    float core = smoothstep(0.022, 0.0, d);
    float aura = smoothstep(0.24, 0.0, d) * 0.28;
    return core + aura;
  }

  float liquidSheet(vec2 p, float pull) {
    vec2 q = p;
    q.x += sin(q.y * 2.0 + uTime * 0.16) * (0.18 + pull * 0.15);
    q.y += sin(q.x * 1.35 - uTime * 0.13) * (0.14 + pull * 0.1);
    float capsule = sdCapsule(q, vec2(-1.55, -1.05), vec2(1.55, 1.02), 1.05 + pull * 0.18);
    float sidePull = sdCapsule(q, vec2(-1.95, 0.84), vec2(1.95, -0.8), 0.38 + pull * 0.12);
    float container = smoothstep(2.35, 0.18, length(q * vec2(0.64, 0.92)));
    float mass = smoothstep(0.34, -0.22, capsule);
    mass += smoothstep(0.22, -0.08, sidePull) * 0.55;
    mass = max(mass, container * 0.76);
    return clamp(mass, 0.0, 1.0);
  }

  float foldBand(vec2 p, float phase, float audio) {
    vec2 q = p;
    q.x += sin(q.y * 1.8 + phase + uTime * 0.12) * (0.2 + audio * 0.1);
    float wave = sin(q.x * 2.35 + phase + uTime * 0.22) * 0.32;
    wave += sin(q.x * 5.7 - phase - uTime * 0.15) * 0.075;
    float d = abs(q.y - wave);
    return smoothstep(0.22, 0.0, d);
  }

  float metallicRipple(vec2 p, vec2 center, vec2 stretch, float spacing, float width, float phase) {
    vec2 d = (p - center) * stretch;
    float r = length(d);
    float wave = abs(sin(r * spacing - uTime * (0.95 + phase * 0.12) - phase));
    float band = smoothstep(width, 0.0, wave);
    float fade = smoothstep(2.05, 0.12, r) * smoothstep(0.02, 0.38, r);
    return band * fade;
  }

  float rippleCells(vec2 p, vec2 center, vec2 stretch, float spacing, float phase) {
    vec2 d = (p - center) * stretch;
    float r = length(d);
    float angle = atan(d.y, d.x);
    float rings = smoothstep(0.095, 0.0, abs(sin(r * spacing - uTime * 0.72 - phase)));
    float cuts = smoothstep(0.58, 1.0, sin(angle * 18.0 + r * 6.2 + phase + uTime * 0.16) * 0.5 + 0.5);
    float oval = smoothstep(2.0, 0.08, r);
    return rings * cuts * oval;
  }

  void main() {
    vec2 uv = vUv;
    vec2 p = uv * 2.0 - 1.0;
    p.x *= 1.72;

    float breathe = sin(uTime * 0.32) * 0.5 + 0.5;
    float slowPulse = sin(uTime * 0.11 + fbm(p * 0.42) * 2.8) * 0.5 + 0.5;
    float audioBreath = breathe * 0.22 + slowPulse * 0.12 + uBass * 0.42 + uMid * 0.12 + uBeat * 0.22;
    vec2 warp = vec2(
      fbm(p * (0.86 + uBass * 0.22) + vec2(uTime * 0.036, -uTime * 0.014)),
      fbm(p * (1.08 + uMid * 0.18) + vec2(-uTime * 0.018, uTime * 0.03))
    ) - 0.5;
    vec2 q = p + warp * (0.42 + audioBreath * 0.72);
    q.x += sin(p.y * 3.4 + uTime * 0.19) * (0.05 + uBass * 0.08);
    q.y += sin(p.x * 2.6 - uTime * 0.15) * (0.045 + uMid * 0.06);

    vec2 rippleP = q;
    rippleP.y *= 1.18;
    rippleP.x += rippleP.y * 0.18;
    float rippleA = metallicRipple(rippleP, vec2(-0.82, -0.52), vec2(1.0, 1.42), 19.0 + uTreble * 4.0, 0.08, 0.4);
    float rippleB = metallicRipple(rippleP, vec2(0.38, -0.88), vec2(0.88, 1.6), 15.5 + uMid * 3.0, 0.075, 2.2);
    float rippleC = metallicRipple(rippleP, vec2(0.06, 0.18), vec2(1.18, 1.22), 23.0 + uBass * 5.0, 0.068, 4.7);
    float cellsA = rippleCells(rippleP, vec2(-0.58, -0.48), vec2(1.05, 1.5), 22.0 + uTreble * 2.0, 0.6);
    float cellsB = rippleCells(rippleP, vec2(0.48, -0.86), vec2(0.92, 1.72), 18.0 + uMid * 3.0, 3.2);
    float rippleField = clamp(rippleA * 0.64 + rippleB * 0.5 + rippleC * 0.42 + cellsA * 0.55 + cellsB * 0.38, 0.0, 1.0);
    q += normalize(vec2(
      sin(rippleP.y * 16.0 + uTime * 0.8),
      cos(rippleP.x * 13.0 - uTime * 0.65)
    )) * rippleField * (0.035 + uBass * 0.025);

    vec3 ink = vec3(0.004, 0.005, 0.007);
    vec3 deepBlue = vec3(0.012, 0.017, 0.026);
    vec3 graphite = vec3(0.006, 0.008, 0.011);
    vec3 mercury = vec3(0.46, 0.50, 0.54);
    vec3 coldWhite = vec3(0.94, 0.98, 1.0);
    vec3 cyan = normalize(uColor + vec3(0.0, 0.18, 0.22)) * 0.34;
    vec3 magenta = normalize(uSecondaryColor + vec3(0.16, 0.0, 0.08)) * 0.26;

    float rear = smoothstep(1.45, 0.0, length(p * vec2(0.58, 0.9)));
    float abyss = smoothstep(1.9, 0.2, length(p * vec2(0.8, 1.05)));
    vec3 col = mix(ink, deepBlue, rear * 0.3);
    col *= 0.34 + abyss * 0.42;

    float sheet = liquidSheet(q, audioBreath);
    float membraneA = membrane(q + vec2(-0.18, 0.06), 1.45 + uBass * 0.18, 0.0);
    float membraneB = membrane(q * vec2(0.72, 1.12) + vec2(0.28, -0.12), 2.05 + uMid * 0.26, 2.4);
    float membraneC = membrane(q * vec2(1.1, 0.84) + vec2(-0.42, 0.18), 2.65 + uTreble * 0.22, 4.8);
    float folds = foldBand(q, 0.2, audioBreath) * 0.42 + foldBand(q.yx * vec2(0.88, 1.12), 3.1, audioBreath) * 0.24;
    float body = clamp(sheet * 1.05 + membraneA * 0.22 + membraneB * 0.18 + membraneC * 0.12 + folds * 0.18 + rippleField * 0.5, 0.0, 1.0);
    float bodySoft = smoothstep(0.02, 0.62, body);
    float edgeTension = smoothstep(0.12, 0.0, abs(sheet - 0.48));

    vec2 normal = vec2(
      fbm(q * (3.0 + uBass * 0.7) + 0.9) - fbm(q * (3.0 + uBass * 0.7) - 0.9),
      fbm(q.yx * (3.1 + uMid * 0.55) + 1.7) - fbm(q.yx * (3.1 + uMid * 0.55) - 1.7)
    );
    normal += vec2(
      rippleA - rippleB + cellsA * 0.5,
      rippleC - rippleA * 0.45 + cellsB * 0.42
    ) * (0.8 + uBass * 0.5);
    float nlen = length(normal) + 0.001;
    normal /= nlen;
    vec2 lightA = normalize(vec2(-0.44, 0.72));
    vec2 lightB = normalize(vec2(0.62, -0.18));
    float specA = pow(max(0.0, dot(normal, lightA)), 4.2);
    float specB = pow(max(0.0, dot(normal, lightB)), 28.0);
    float rim = pow(1.0 - smoothstep(0.08, 1.35 + uBass * 0.18, length(q * vec2(0.66, 1.05))), 2.0);
    float longReflection = smoothstep(0.18, 0.0, abs(sin(q.x * 1.05 + q.y * 2.65 + fbm(q * 0.82) * 3.2 + uTime * 0.12)));
    float bladeReflection = smoothstep(0.055, 0.0, abs(sin(q.x * -2.1 + q.y * 3.8 + fbm(q * 1.4) * 4.5 - uTime * 0.16)));
    float blackFold = smoothstep(0.16, 0.0, abs(sin(q.x * 1.8 - q.y * 2.4 + fbm(q * 1.1) * 5.0 + 1.3)));
    float ringHighlight = smoothstep(0.16, 0.72, rippleField);

    vec3 chrome = graphite;
    chrome = mix(chrome, mercury, bodySoft * (0.62 + sheet * 0.18));
    chrome = mix(chrome, vec3(0.005, 0.006, 0.008), edgeTension * 0.72);
    chrome = mix(chrome, vec3(0.0, 0.0, 0.0), blackFold * bodySoft * 0.56);
    chrome += coldWhite * specA * (0.28 + body * 0.32 + uBass * 0.12);
    chrome += coldWhite * specB * (0.42 + uTreble * 0.34 + uBeat * 0.14);
    chrome += coldWhite * longReflection * bodySoft * (0.26 + uMid * 0.12);
    chrome += coldWhite * bladeReflection * bodySoft * (0.5 + uTreble * 0.18);
    chrome += coldWhite * ringHighlight * (0.18 + uTreble * 0.12 + uBeat * 0.16);
    chrome += cyan * specB * 0.035;
    chrome += cyan * rippleField * 0.035;
    chrome += magenta * rim * bodySoft * 0.028;
    chrome -= vec3(0.25) * edgeTension * (0.35 + uBass * 0.25);
    col = mix(col, chrome, bodySoft * 0.92);

    float nearGrid = wireGrid(q + vec2(0.0, 0.18), 0.55, 0.08);
    float farGrid = wireGrid(q * vec2(0.78, 1.18) + vec2(0.1, -0.1), 1.2, 0.045);
    col += coldWhite * farGrid * 0.012 * (1.0 - sheet * 0.6);
    col += mix(coldWhite, cyan, 0.2) * nearGrid * (0.014 + uTreble * 0.012) * (1.0 - sheet * 0.48);

    float pathA = energyPath(q * vec2(0.88, 1.0) + vec2(-0.22, 0.08), 0.2);
    float pathB = energyPath(q * vec2(1.05, 1.18) + vec2(0.16, -0.34), 2.8);
    float pathC = energyPath(vec2(q.y * 0.78, q.x * 0.72) + vec2(0.12, 0.08), 5.4);
    float flow = pathA * 0.65 + pathB * 0.5 + pathC * 0.34;
    col += mix(coldWhite, cyan, 0.24 + 0.12 * sin(uTime * 0.18)) * flow * (0.02 + uEnergy * 0.026 + uTreble * 0.02);
    col += mix(vec3(1.0, 0.24, 0.08), cyan, smoothstep(-0.75, 0.65, rippleP.x)) * rippleField * (0.022 + uEnergy * 0.018);

    for (int i = 0; i < 30; i++) {
      float fi = float(i);
      vec2 seed = vec2(fi * 23.31, fi * 9.77);
      vec2 c = vec2(hash(seed), hash(seed + 3.0)) * 2.0 - 1.0;
      c.x *= 1.72;
      float z = hash(seed + 8.0);
      c += vec2(
        sin(uTime * (0.045 + z * 0.035) + fi * 1.2),
        cos(uTime * (0.04 + z * 0.03) + fi * 1.7)
      ) * (0.08 + z * 0.18);
      float radius = 0.035 + z * 0.09 + uBass * 0.025;
      float d = length((q - c) / vec2(1.0 + z * 0.8, 0.72 + z * 0.35));
      float orb = smoothstep(radius * 2.9, 0.0, d);
      float shell = smoothstep(radius * 1.45, radius * 0.92, d) * smoothstep(radius * 0.28, radius * 0.92, d);
      float glint = pow(max(0.0, 1.0 - distance((q - c) / max(radius, 0.02), vec2(-0.35, 0.28)) * 0.86), 8.0);
      vec3 orbCol = mix(graphite, mercury, orb * 0.62);
      orbCol += coldWhite * glint * 0.32;
      orbCol += mix(cyan, magenta, hash(seed + 5.0)) * shell * 0.08;
      col = mix(col, orbCol, orb * (0.06 + z * 0.08) * (0.55 + uEnergy * 0.35));
      col += mix(cyan, magenta, z) * shell * 0.014;
    }

    for (int i = 0; i < 7; i++) {
      float fi = float(i);
      float d = sdCapsule(
        q,
        vec2(-1.65 + fi * 0.42, -0.92 + sin(fi) * 0.18),
        vec2(-1.0 + fi * 0.5, 0.92 + cos(fi * 1.4) * 0.18),
        0.012 + 0.008 * sin(fi + uTime * 0.2)
      );
      float tendon = smoothstep(0.08, 0.0, abs(d));
      col += mix(cyan, magenta, fract(fi * 0.37)) * tendon * (0.018 + uTreble * 0.012);
    }

    float leak = smoothstep(0.98, 0.45, abs(q.x + sin(q.y * 2.0 + uTime * 0.12) * 0.24)) * smoothstep(1.05, -0.2, abs(q.y));
    leak *= smoothstep(0.68, 1.0, fbm(q * 2.1 - uTime * 0.025));
    leak += edgeTension * smoothstep(0.55, 1.0, fbm(q * 3.6 + uTime * 0.04)) * 0.45;
    col += mix(cyan, magenta, 0.5 + 0.5 * sin(q.y * 2.0 + uTime * 0.2)) * leak * (0.032 + uEnergy * 0.025);

    float scan = sin((uv.y + warp.x * 0.02) * 900.0) * 0.002;
    float grain = hash(floor(uv * vec2(540.0, 320.0)) + floor(uTime * 8.0));
    col += scan + (grain - 0.5) * 0.006;

    col = clamp(col, vec3(0.0), vec3(1.12));
    col = pow(col, vec3(0.92));

    gl_FragColor = vec4(col, 1.0);
  }
`;

const pastelRippleStageFragment = `
  uniform float uTime;
  uniform float uBass;
  uniform float uMid;
  uniform float uTreble;
  uniform float uEnergy;
  uniform float uBeat;
  varying vec2 vUv;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }

  float arcBand(vec2 p, vec2 center, vec2 stretch, float spacing, float width, float phase) {
    vec2 d = (p - center) * stretch;
    float r = length(d);
    float a = atan(d.y, d.x);
    float ring = smoothstep(width, 0.0, abs(sin(r * spacing - phase - uTime * (0.16 + uBass * 0.18))));
    float broken = smoothstep(0.2, 0.94, sin(a * 9.5 + r * 2.4 + phase + sin(uTime * 0.13) * 0.6) * 0.5 + 0.5);
    float taper = smoothstep(2.25, 0.1, r) * smoothstep(0.02, 0.32, r);
    return ring * broken * taper;
  }

  float capsuleCell(vec2 p, vec2 center, float angle, vec2 size) {
    float s = sin(angle);
    float c = cos(angle);
    mat2 rot = mat2(c, -s, s, c);
    vec2 q = rot * (p - center);
    vec2 b = abs(q) - size;
    float d = length(max(b, 0.0)) + min(max(b.x, b.y), 0.0);
    return smoothstep(0.035, 0.0, abs(d));
  }

  vec3 palette(float h) {
    vec3 pink = vec3(1.0, 0.48, 0.73);
    vec3 lemon = vec3(1.0, 0.96, 0.40);
    vec3 cyan = vec3(0.30, 0.88, 1.0);
    vec3 lavender = vec3(0.78, 0.62, 1.0);
    vec3 coral = vec3(1.0, 0.34, 0.14);
    vec3 col = mix(pink, lemon, smoothstep(0.08, 0.34, h));
    col = mix(col, cyan, smoothstep(0.32, 0.56, h));
    col = mix(col, lavender, smoothstep(0.54, 0.76, h));
    col = mix(col, coral, smoothstep(0.74, 1.0, h));
    return col;
  }

  void main() {
    vec2 uv = vUv;
    vec2 p = uv * 2.0 - 1.0;
    p.x *= 0.82;

    float paperNoise = noise(uv * 360.0 + floor(uTime * 2.0));
    float softNoise = noise(uv * 8.0 + vec2(uTime * 0.025, -uTime * 0.018));
    vec3 paper = mix(vec3(0.98, 0.84, 0.87), vec3(0.96, 0.90, 0.80), smoothstep(0.0, 1.0, uv.y));
    paper = mix(paper, vec3(0.90, 0.96, 0.96), smoothstep(0.15, 0.95, softNoise) * 0.24);
    paper += (paperNoise - 0.5) * 0.24;

    vec2 waveP = p;
    waveP.x += sin(p.y * 2.0 + uTime * 0.09) * (0.05 + uBass * 0.035);
    waveP.y += sin(p.x * 2.4 - uTime * 0.08) * (0.04 + uMid * 0.025);

    float a1 = arcBand(waveP, vec2(-0.42, -0.86), vec2(0.84, 1.42), 21.0, 0.078, 0.4);
    float a2 = arcBand(waveP, vec2(0.16, -0.78), vec2(0.9, 1.38), 18.0, 0.075, 2.1);
    float a3 = arcBand(waveP, vec2(-0.18, 0.2), vec2(0.74, 1.2), 19.5, 0.07, 4.2);
    float a4 = arcBand(waveP, vec2(0.52, 0.1), vec2(0.82, 1.3), 17.0, 0.065, 5.7);

    vec3 col = paper;
    col = mix(col, palette(0.12), a1 * 0.62);
    col = mix(col, palette(0.32), a2 * 0.58);
    col = mix(col, palette(0.56), a3 * 0.55);
    col = mix(col, palette(0.74), a4 * 0.5);

    for (int i = 0; i < 92; i++) {
      float fi = float(i);
      float row = floor(fi / 12.0);
      float colId = mod(fi, 12.0);
      vec2 cellBase = vec2(-0.68 + colId * 0.125, -0.48 + row * 0.15);
      cellBase.x += sin(row * 0.7) * 0.08;
      cellBase.y += sin(colId * 0.45) * 0.04;
      vec2 center = cellBase + vec2(sin(uTime * 0.07 + fi) * 0.012, cos(uTime * 0.06 + fi * 1.2) * 0.01);
      float arcWarp = length((center - vec2(-0.25, -0.72)) * vec2(0.7, 1.2));
      center.x += sin(arcWarp * 4.0) * 0.16;
      center.y += cos(arcWarp * 3.2) * 0.08;
      float cell = capsuleCell(waveP, center, -0.08 + arcWarp * 0.22, vec2(0.04 + hash(vec2(fi, 2.0)) * 0.035, 0.018 + hash(vec2(fi, 5.0)) * 0.012));
      float h = fract(fi * 0.137 + row * 0.08);
      vec3 cellCol = palette(h);
      col = mix(col, cellCol, cell * (0.48 + hash(vec2(fi, 9.0)) * 0.3));
    }

    float veilPink = smoothstep(0.1, 0.9, sin((uv.x * 1.8 + uv.y * 2.4 + softNoise) * 2.2) * 0.5 + 0.5);
    float veilCyan = smoothstep(0.35, 1.0, sin((uv.x * -2.3 + uv.y * 1.6 - softNoise) * 2.6) * 0.5 + 0.5);
    col = mix(col, vec3(1.0, 0.67, 0.83), veilPink * 0.16);
    col = mix(col, vec3(0.68, 0.96, 1.0), veilCyan * 0.12);

    float paperBorder = smoothstep(0.0, 0.035, uv.x) * smoothstep(0.0, 0.035, uv.y) * smoothstep(0.0, 0.035, 1.0 - uv.x) * smoothstep(0.0, 0.035, 1.0 - uv.y);
    col = mix(vec3(0.985, 0.955, 0.92), col, paperBorder);
    col = clamp(col, vec3(0.0), vec3(1.0));
    gl_FragColor = vec4(col, 1.0);
  }
`;

const waterCausticStageFragment = `
  uniform float uTime;
  uniform float uBass;
  uniform float uMid;
  uniform float uTreble;
  uniform float uEnergy;
  uniform float uBeat;
  uniform vec3 uColor;
  uniform vec3 uSecondaryColor;
  uniform vec3 uAccentColor;
  uniform vec3 uBgColor;
  varying vec2 vUv;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 5; i++) {
      v += noise(p) * a;
      p = mat2(1.48, -1.18, 1.18, 1.48) * p + 0.31;
      a *= 0.52;
    }
    return v;
  }

  float causticLayer(vec2 p, float scale, float phase, float width) {
    vec2 q = p * scale;
    q.x += sin(q.y * 0.72 + uTime * (0.28 + phase * 0.02)) * (0.55 + uBass * 0.16);
    q.y += cos(q.x * 0.62 - uTime * (0.24 + phase * 0.025)) * (0.45 + uMid * 0.12);

    float l1 = abs(sin(q.x + sin(q.y * 0.72 + phase) * 1.8));
    float l2 = abs(sin(q.y * 0.92 + cos(q.x * 0.64 - phase) * 1.55));
    float l3 = abs(sin((q.x + q.y) * 0.62 + sin(q.x * 0.46 + uTime * 0.18) * 1.6));
    float web = 1.0 - min(min(l1, l2), l3);
    web = pow(max(web, 0.0), 5.8);
    return smoothstep(width, 1.0, web);
  }

  float softBlob(vec2 p, vec2 center, vec2 radius, float phase) {
    vec2 q = (p - center) / radius;
    q.x += sin(q.y * 2.4 + uTime * 0.22 + phase) * 0.08;
    q.y += cos(q.x * 2.0 - uTime * 0.18 + phase) * 0.06;
    return smoothstep(1.0, 0.12, length(q));
  }

  void main() {
    vec2 uv = clamp(vUv, vec2(-0.04), vec2(1.04));
    vec2 p = uv * 2.0 - 1.0;
    p.x *= 0.72;

    float slow = uTime * 0.12;
    vec2 drift = vec2(
      fbm(p * 1.05 + vec2(slow, -slow * 0.6)),
      fbm(p * 1.18 + vec2(-slow * 0.7, slow))
    ) - 0.5;
    vec2 waterP = p + drift * (0.32 + uBass * 0.15);
    waterP.x += sin(p.y * 3.2 + uTime * 0.26) * (0.045 + uBass * 0.035);
    waterP.y += cos(p.x * 2.7 - uTime * 0.22) * (0.04 + uMid * 0.03);

    vec3 deep = mix(vec3(0.015, 0.18, 0.30), uBgColor, 0.62);
    vec3 blue = mix(vec3(0.02, 0.42, 0.62), uColor, 0.5);
    vec3 aqua = mix(vec3(0.0, 0.76, 0.82), uSecondaryColor, 0.48);
    vec3 mint = mix(vec3(0.72, 1.0, 0.86), uAccentColor, 0.5);
    vec3 foam = mix(vec3(0.92, 1.0, 0.97), uAccentColor, 0.26);

    float depth = smoothstep(-1.1, 0.95, p.y);
    float volume = fbm(waterP * 1.7 + vec2(uTime * 0.03, -uTime * 0.02));
    vec3 col = mix(deep, blue, 0.48 + depth * 0.24 + volume * 0.22);
    col = mix(col, aqua, smoothstep(0.48, 0.98, volume) * 0.28);

    float ca1 = causticLayer(waterP + vec2(0.0, uTime * 0.018), 7.0, 0.3, 0.18);
    float ca2 = causticLayer(waterP * vec2(1.22, 0.88) + vec2(0.18, -0.08), 10.5, 2.7, 0.22);
    float ca3 = causticLayer(waterP * vec2(0.72, 1.3) - vec2(0.15, 0.12), 5.2, 5.1, 0.16);
    float caustic = clamp(ca1 * 0.74 + ca2 * 0.55 + ca3 * 0.36, 0.0, 1.0);

    float broadWave = smoothstep(0.82, 0.0, abs(sin(waterP.x * 3.0 + waterP.y * 1.2 + uTime * 0.36)));
    float softSheen = smoothstep(0.55, 1.0, fbm(waterP * 2.4 - uTime * 0.04));
    col += aqua * broadWave * 0.08;
    col += mint * caustic * (0.42 + uTreble * 0.12 + uBeat * 0.08);
    col += foam * pow(caustic, 2.1) * (0.3 + uEnergy * 0.16);
    col = mix(col, mix(uSecondaryColor, aqua, 0.55), softSheen * 0.2);

    for (int i = 0; i < 18; i++) {
      float fi = float(i);
      vec2 seed = vec2(fi * 17.3, fi * 9.1);
      vec2 center = vec2(hash(seed), hash(seed + 2.0)) * 2.0 - 1.0;
      center.x *= 0.72;
      center += vec2(sin(uTime * (0.04 + hash(seed) * 0.05) + fi), cos(uTime * (0.05 + hash(seed + 3.0) * 0.04) + fi)) * 0.08;
      float b = softBlob(waterP, center, vec2(0.055 + hash(seed + 5.0) * 0.06, 0.035 + hash(seed + 8.0) * 0.045), fi);
      float rim = smoothstep(0.18, 0.0, abs(b - 0.42));
      col += foam * rim * 0.045;
      col = mix(col, deep * 0.75, b * 0.035);
    }

    float sparkle = 0.0;
    for (int i = 0; i < 12; i++) {
      float fi = float(i);
      vec2 seed = vec2(fi * 29.4, fi * 13.7);
      vec2 sp = vec2(hash(seed), hash(seed + 4.0));
      sp += vec2(sin(uTime * 0.08 + fi), cos(uTime * 0.06 + fi * 1.4)) * 0.025;
      float d = distance(uv, sp);
      sparkle += smoothstep(0.018, 0.0, d) * smoothstep(0.22, 1.0, sin(uTime * 1.2 + fi) * 0.5 + 0.5);
    }
    col += foam * sparkle * (0.35 + uTreble * 0.2);

    float edgeLight = smoothstep(1.7, 0.12, length(p * vec2(0.82, 1.02)));
    vec3 edgeFill = mix(uBgColor, uColor, 0.42);
    float edgeGuard = smoothstep(0.0, 0.08, vUv.x) * smoothstep(0.0, 0.08, vUv.y) * smoothstep(0.0, 0.08, 1.0 - vUv.x) * smoothstep(0.0, 0.08, 1.0 - vUv.y);
    col = mix(edgeFill, col, 0.78 + edgeLight * 0.22);
    col = mix(edgeFill, col, max(0.35, edgeGuard));
    col = clamp(col, vec3(0.0), vec3(1.0));
    col = pow(col, vec3(0.92));
    gl_FragColor = vec4(col, 1.0);
  }
`;

const darkSpaceBlackStageFragment = `
  uniform float uTime;
  uniform float uBass;
  uniform float uMid;
  uniform float uTreble;
  uniform float uEnergy;
  uniform float uBeat;
  varying vec2 vUv;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  void main() {
    vec2 uv = vUv;
    vec2 p = uv * 2.0 - 1.0;
    float vignette = smoothstep(1.45, 0.18, length(p * vec2(0.82, 1.0)));
    float grain = hash(floor(uv * vec2(960.0, 540.0)) + floor(uTime * (18.0 + uTreble * 40.0)));
    float scan = sin(uv.y * 1080.0 + uTime * (8.0 + uMid * 18.0)) * 0.5 + 0.5;
    float pulse = (uBass * 0.006 + uBeat * 0.012) * vignette;
    vec3 col = vec3(0.0);
    col += vec3(0.003, 0.004, 0.005) * vignette * (0.18 + uEnergy * 0.32);
    col += vec3(0.004, 0.008, 0.010) * step(0.988 - uTreble * 0.02, grain) * (0.08 + uTreble * 0.2);
    col += vec3(scan * 0.003) * (0.05 + uEnergy * 0.08);
    col += vec3(pulse);
    gl_FragColor = vec4(col, 1.0);
  }
`;

function drawTextWithLetterSpacing(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, letterSpacing: number) {
  if (letterSpacing === 0) {
    ctx.fillText(text, x, y);
    return;
  }

  const previousAlign = ctx.textAlign;
  ctx.textAlign = 'left';

  const characters = Array.from(text);
  let totalWidth = -letterSpacing;
  for (const char of characters) {
    totalWidth += ctx.measureText(char).width + letterSpacing;
  }

  let currentX = x - totalWidth / 2;
  for (const char of characters) {
    ctx.fillText(char, currentX, y);
    currentX += ctx.measureText(char).width + letterSpacing;
  }

  ctx.textAlign = previousAlign;
}

function useTextTexture(text: string, fontSize: number, letterSpacing: number, fontWeight: number) {
  const canvas = useMemo(() => document.createElement('canvas'), []);
  const texture = useMemo(() => new THREE.CanvasTexture(canvas), [canvas]);

  useEffect(() => {
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, 1024, 512);

    // Give it a more aggressive visual look
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, 1024, 512);
    
    // Draw the "action" style long horizontal streak trails
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.font = `italic ${fontWeight} ${Math.round(fontSize * 56)}px Inter, system-ui, "SF Pro Text", "Helvetica Neue", "PingFang SC", "Microsoft YaHei", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Draw multiple strokes spreading outwards
    const trailCount = 30;
    for (let i = 0; i < trailCount; i++) {
      const offsetX = Math.pow(i, 1.4) * 8.0;
      ctx.globalAlpha = Math.max(0.0, 1.0 - (i / trailCount));
      drawTextWithLetterSpacing(ctx, text, 512 - offsetX, 280, letterSpacing);
      drawTextWithLetterSpacing(ctx, text, 512 + offsetX, 280, letterSpacing);
    }
    ctx.globalAlpha = 1.0;

    // Draw the core glitchy fill text
    ctx.fillStyle = 'white';
    ctx.font = `italic ${fontWeight} ${Math.round(fontSize * 64)}px Inter, system-ui, "SF Pro Text", "Helvetica Neue", "PingFang SC", "Microsoft YaHei", sans-serif`;
    drawTextWithLetterSpacing(ctx, text, 512, 280, letterSpacing);

    // Apply minor smearing horizontally on the basic form to bake in some motion blur
    ctx.globalAlpha = 0.3;
    drawTextWithLetterSpacing(ctx, text, 512 - 20, 280, letterSpacing);
    drawTextWithLetterSpacing(ctx, text, 512 + 20, 280, letterSpacing);
    ctx.globalAlpha = 1.0;

    texture.needsUpdate = true;
  }, [text, fontSize, letterSpacing, fontWeight, canvas, texture]);

  return texture;
}

const cyberFragment = `
  uniform float uTime;
  uniform float uBass;
  uniform float uEnergy;
  uniform vec3 uColor;
  uniform sampler2D tText;
  varying vec2 vUv;

  float hash(float n) { return fract(sin(n) * 43758.5453123); }
  float hash2(vec2 p) {
      return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
  }
  
  // 3D grid function
  float drawGrid(vec2 uv, float tilt, float pan) {
      uv.y -= tilt;
      if (uv.y < 0.0) return 0.0; // above horizon
      float z = 1.0 / uv.y;
      vec2 gridUv = vec2(uv.x * z + pan, z - uTime * 3.0);
      float gridX = abs(fract(gridUv.x * 5.0) - 0.5);
      float gridY = abs(fract(gridUv.y * 5.0) - 0.5);
      float lineX = smoothstep(0.08, 0.0, gridX / z * 1.5);
      float lineY = smoothstep(0.08, 0.0, gridY / z * 1.5);
      float line = max(lineX, lineY);
      return line * exp(-z * 0.08); // fade with depth
  }

  void main() {
    vec2 p = vUv;
    
    // Global Block Glitch Displacement
    float sliceY = floor(p.y * 40.0); 
    float offset = hash(sliceY + floor(uTime * 15.0)) * 2.0 - 1.0;
    
    float applyM = step(0.85 - uEnergy*0.5 - uBass*0.3, hash(sliceY * 12.3 + floor(uTime * 8.0)));
    float displacement = offset * 0.2 * applyM * (1.0 + uBass * 1.5);
    
    vec2 pos = p * 2.0 - 1.0;
    
    // Apply glitch directly to global screen coordinates
    pos.x += displacement;
    pos.x += sin(pos.y * 15.0 + uTime * 10.0) * 0.008 * (uEnergy + uBass);

    // Floor & Ceiling Grid
    float floorGrid = drawGrid(pos, -0.3, 0.0);
    float ceilGrid = drawGrid(-pos, -0.3, sin(uTime)*0.5); 
    
    // Add pulsing background elements
    vec3 stageColor = uColor * (0.02 + floorGrid * 0.6 + ceilGrid * 0.3) * (1.0 + uBass * 2.0);
    
    // Distant neon lasers
    float laserId = floor(pos.x * 20.0 + uTime * 2.0);
    float laser = step(0.95, hash(laserId)) * step(0.5, pos.y);
    stageColor += laser * uColor * (0.2 + uEnergy * 0.8) * exp(-abs(pos.y) * 2.0);
    
    vec2 textUv = p;
    textUv.x += displacement;
    textUv.x += sin(textUv.y * 30.0 + uTime * 10.0) * 0.008 * (uEnergy + uBass);
    
    vec4 tex = texture2D(tText, textUv);
    float mask = tex.r;

    // Glitchy RGB split
    float rMask = texture2D(tText, textUv + vec2(0.025 + uBass*0.06, 0.0)).r;
    float bMask = texture2D(tText, textUv - vec2(0.025 + uBass*0.06, 0.0)).r;
    
    // Glow mask for text
    float glowMask = 0.0;
    float gw = 0.01 + uBass * 0.02;
    glowMask += texture2D(tText, textUv + vec2(gw, gw)).r;
    glowMask += texture2D(tText, textUv + vec2(-gw, -gw)).r;
    glowMask += texture2D(tText, textUv + vec2(gw, -gw)).r;
    glowMask += texture2D(tText, textUv + vec2(-gw, gw)).r;
    glowMask += texture2D(tText, textUv + vec2(gw*2.0, 0.0)).r;
    glowMask += texture2D(tText, textUv + vec2(-gw*2.0, 0.0)).r;
    glowMask /= 6.0;
    glowMask = smoothstep(0.1, 0.6, glowMask); 
    
    vec3 glowColor = uColor; // Preset base color
    
    vec3 finalCol = stageColor;
    
    // Add text and glow
    if (glowMask > 0.05) {
       finalCol = mix(finalCol, glowColor * (1.5 + uBass * 3.0), glowMask);
    }

    // Text Inner fill (scanlines)
    float stripe = step(0.5, fract(textUv.y * 60.0 - uTime * 15.0));
    vec3 textFill = mix(vec3(0.0, 0.0, 0.1), vec3(0.9, 1.0, 1.0), stripe);
    
    if (mask > 0.5) {
       finalCol = mix(glowColor, textFill, 0.85); 
    }

    // Chromatic aberration fringes for the glitch
    if (applyM > 0.0 && rMask > 0.5 && mask < 0.5) finalCol += vec3(1.0, 0.1, 0.4); 
    if (applyM > 0.0 && bMask > 0.5 && mask < 0.5) finalCol += vec3(0.1, 0.5, 1.0); 
    
    // Global aberration on the stage when glitch happens
    if (applyM > 0.0) {
        float bFloor = drawGrid(pos - vec2(0.05, 0.0), -0.3, 0.0);
        float rFloor = drawGrid(pos + vec2(0.05, 0.0), -0.3, 0.0);
        finalCol += vec3(rFloor * 0.5, 0.0, bFloor * 0.5) * uColor;
    }

    // Global VFX: Screen static & Scanlines
    float screenScanline = sin(pos.y * 800.0) * 0.05 + 0.95;
    finalCol *= screenScanline;
    
    float noise = hash2(pos + uTime * 10.0) - 0.5;
    finalCol += noise * 0.1 * (1.0 + uEnergy * 2.0);

    // Hard clip color
    finalCol = min(finalCol, 1.5);

    gl_FragColor = vec4(finalCol, 1.0);
  }
`;

function VoidScene() {
  const speed = useStore((state) => state.speed);
  const stageMatRef = useRef<THREE.ShaderMaterial>(null);

  useFrame((state) => {
    if(!stageMatRef.current) return;
    const { bass, mid, treble, energy, beat } = getReactiveAudio();
    
    stageMatRef.current.uniforms.uTime.value = state.clock.elapsedTime * speed;
    stageMatRef.current.uniforms.uBass.value = bass;
    stageMatRef.current.uniforms.uMid.value = mid;
    stageMatRef.current.uniforms.uTreble.value = treble;
    stageMatRef.current.uniforms.uEnergy.value = energy;
    stageMatRef.current.uniforms.uBeat.value = beat;
  });

  return (
    <group>
      <mesh position={[0, 0, -9]}>
        <planeGeometry args={[42, 28]} />
        <shaderMaterial
          ref={stageMatRef}
          vertexShader="varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }"
          fragmentShader={darkSpaceBlackStageFragment}
          uniforms={{
            uTime: { value: 0 },
            uBass: { value: 0 },
            uMid: { value: 0 },
            uTreble: { value: 0 },
            uEnergy: { value: 0 },
            uBeat: { value: 0 },
          }}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

// 2. LIQUID SCENE (Ultra smooth fbm flows)
const liquidFragment = `
  uniform float uTime;
  uniform float uBass;
  uniform float uLowMid;
  uniform float uEnergy;
  uniform vec3 uBaseColor;
  uniform vec3 uSecondaryColor;
  uniform vec3 uAccentColor;
  uniform vec3 uBgColor;
  varying vec2 vUv;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }
  
  float smin(float a, float b, float k) {
    float h = clamp( 0.5+0.5*(b-a)/k, 0.0, 1.0 );
    return mix( b, a, h ) - k*h*(1.0-h);
  }
  
  float sdCircle(vec2 p, float r) { return length(p) - r; }
  
  float sdBox(vec2 p, vec2 b) {
    vec2 d = abs(p)-b;
    return length(max(d,0.0)) + min(max(d.x,d.y),0.0);
  }
  
  mat2 rot(float a) { float s = sin(a), c = cos(a); return mat2(c, -s, s, c); }

  float waveBand(vec2 p, float offset, float amp, float freq, float phase, float width) {
    float y = offset
      + sin(p.x * freq + phase) * amp
      + sin(p.x * (freq * 0.48) - phase * 0.76) * amp * 0.55
      + sin(p.x * (freq * 1.9) + phase * 0.35) * amp * 0.16;
    return abs(p.y - y) - width;
  }

  void main() {
    vec2 p = vUv * 2.0 - 1.0;
    p.x *= 1.5; // aspect ratio approximation

    float t = uTime * (0.62 + uEnergy * 0.18);
    float pulse = 0.5 + 0.5 * sin(t * 1.55 + uBass * 1.6);
    float grit = noise(p * 5.0 + vec2(t * 0.35, -t * 0.24));

    // Acid-fluid displacement: keeps the original palette, but gives the edge more restless motion.
    p += vec2(
      sin(p.y * 4.2 + t * 1.45) + sin((p.x + p.y) * 3.1 - t * 0.9),
      cos(p.x * 3.4 - t * 1.1) + sin((p.x - p.y) * 2.8 + t * 1.35)
    ) * (0.02 + uEnergy * 0.035);
    p += (grit - 0.5) * (0.018 + uLowMid * 0.024);

    float d = 100.0;

    // Long liquid ribbons, tuned for acid-neon wave motion.
    d = smin(d, waveBand(p, 0.30, 0.23 + uBass * 0.08, 2.7, t * 1.05, 0.105 + uEnergy * 0.025), 0.19);
    d = smin(d, waveBand(p, -0.42, 0.20 + uLowMid * 0.08, 3.15, -t * 0.92 + 1.6, 0.092 + uBass * 0.03), 0.17);
    d = smin(d, waveBand(p, -0.04, 0.16 + uEnergy * 0.06, 4.4, t * 1.42 + 2.2, 0.048), 0.13);

    // Blob 1: Center pulsing
    d = smin(d, sdCircle(p - vec2(-0.28, -0.18), 0.32 + uBass * 0.13), 0.22);
    
    // Blob 2: Orbiting fast
    vec2 pos2 = vec2(sin(t * 1.5), cos(t * 1.5)) * 0.5;
    d = smin(d, sdCircle(p - pos2, 0.17 + uLowMid * 0.12), 0.22);
    
    // Blob 3: Figure 8
    vec2 pos3 = vec2(sin(t * 0.8) * 0.8, sin(t * 1.6) * 0.4);
    d = smin(d, sdBox((p - pos3) * rot(sin(t) * 0.55), vec2(0.18, 0.24)), 0.28);
    
    // Blob 4: Random drift
    vec2 pos4 = vec2(cos(t * 0.5) * 0.6, sin(t * 0.7) * 0.6);
    d = smin(d, sdCircle(p - pos4, 0.2 + pulse * 0.04), 0.2);

    // Inner Cutout / Negative Space (creates hollow organic shapes like letters)
    float d_hole = sdCircle(p - vec2(sin(t), cos(t*1.2)) * 0.2, 0.14 + uEnergy*0.1);
    d_hole = smin(d_hole, waveBand(p, -0.08, 0.12 + uBass * 0.04, 3.6, -t * 1.2, 0.035), 0.1);
    d = max(d, -d_hole); // subtract hole

    // Rendering
    vec3 bgCol = mix(vec3(0.66, 0.51, 0.55), uBgColor, 0.62);
    
    // Colors for the shapes
    vec3 innerCol = mix(vec3(0.0, 0.0, 0.0), uBaseColor * 0.28, 0.55);
    
    // Stroke / Outlines
    // We want a bright yellow/green core outline, and a purple outer outline
    float outlineWidth = 0.016 + uEnergy * 0.012 + pulse * 0.003;
    
    // Create the contour logic
    float fill = smoothstep(0.0, -0.012, d);             // 1 if inside, 0 if outside
    float edgeDistance = abs(d);
    float strokeCore = 1.0 - smoothstep(0.0, outlineWidth, edgeDistance);
    float strokeHot = 1.0 - smoothstep(outlineWidth * 0.75, outlineWidth * 2.8, edgeDistance);
    float strokeOuter = 1.0 - smoothstep(outlineWidth * 1.8, 0.22 + uBass * 0.08, edgeDistance);
    float ripple = 0.5 + 0.5 * sin(edgeDistance * 36.0 - t * 3.4 + grit * 1.6);
    
    vec3 neonYellow = mix(vec3(0.8, 1.0, 0.0), uAccentColor, 0.62);
    vec3 neonPurple = mix(vec3(0.4, 0.0, 1.0), uSecondaryColor, 0.68);
    
    vec3 col = mix(bgCol, innerCol, fill);
    col += bgCol * (grit - 0.5) * 0.09;
    
    // Add strokes
    col = mix(col, neonPurple, strokeOuter * (0.5 + ripple * 0.1));
    col = mix(col, mix(neonYellow, neonPurple, 0.18), strokeHot * (0.42 + uEnergy * 0.08));
    col = mix(col, neonYellow, strokeCore);
    col += neonPurple * strokeOuter * strokeOuter * (0.16 + uBass * 0.32);
    col += neonYellow * strokeCore * (0.28 + pulse * 0.12);
    col *= 0.99 + sin(vUv.y * 420.0 + t * 1.6) * 0.008;
    
    gl_FragColor = vec4(col, 1.0);
  }
`;

const chromafluxFragment = `
  uniform float uTime;
  uniform float uBass;
  uniform float uLowMid;
  uniform float uEnergy;
  uniform vec3 uBaseColor;
  uniform vec3 uSecondaryColor;
  uniform vec3 uAccentColor;
  uniform vec3 uBgColor;
  varying vec2 vUv;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }
  
  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 5; i++) {
      v += noise(p) * a;
      p = mat2(1.62, -1.18, 1.18, 1.62) * p + 17.3;
      a *= 0.5;
    }
    return v;
  }

  float smin(float a, float b, float k) {
    float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
    return mix(b, a, h) - k * h * (1.0 - h);
  }

  float riverDistance(vec2 p, float t) {
    float x = p.x;
    float center = -0.04
      + sin(x * 1.12 + t * 0.26) * 0.18
      + sin(x * 2.35 - t * 0.18) * 0.09
      + sin(x * 4.9 + t * 0.10) * 0.03;
    float width = 0.25
      + sin(x * 1.65 - t * 0.16) * 0.045
      + sin(x * 4.1 + t * 0.12) * 0.028;
    return abs(p.y - center) - width;
  }

  vec3 heatMap(float x) {
    vec3 violet = vec3(0.20, 0.02, 0.58);
    vec3 blue = vec3(0.03, 0.66, 0.92);
    vec3 cyan = vec3(0.70, 1.00, 0.96);
    vec3 yellow = vec3(1.00, 0.92, 0.02);
    vec3 red = vec3(0.96, 0.05, 0.01);
    vec3 softWhite = vec3(1.00, 0.96, 0.82);

    vec3 c = mix(violet, blue, smoothstep(0.03, 0.22, x));
    c = mix(c, cyan, smoothstep(0.18, 0.42, x));
    c = mix(c, yellow, smoothstep(0.38, 0.62, x));
    c = mix(c, red, smoothstep(0.58, 0.82, x));
    c = mix(c, softWhite, smoothstep(0.88, 1.0, x) * 0.72);
    return c;
  }

  void main() {
    vec2 p = vUv * 2.0 - 1.0;
    p.x *= 1.35;

    float t = uTime * (0.42 + uEnergy * 0.08);
    vec2 flow = vec2(
      fbm(p * 1.5 + vec2(t * 0.18, -t * 0.07)),
      fbm(p * 1.7 + vec2(-t * 0.11, t * 0.16))
    ) - 0.5;
    vec2 q = p + flow * (0.22 + uLowMid * 0.06);
    q.y += sin(p.x * 1.15 + t * 0.2) * 0.04;

    float d = riverDistance(q, t);
    d = smin(d, riverDistance(q + vec2(-0.22, -0.28), t * 0.8) + 0.09, 0.24);

    float river = smoothstep(0.22, -0.045, d);
    float softBody = smoothstep(0.48, -0.02, d);
    float edge = 1.0 - smoothstep(0.0, 0.055 + uEnergy * 0.012, abs(d));
    float outerGlow = 1.0 - smoothstep(0.02, 0.26 + uBass * 0.06, abs(d));

    float contour = sin((d * 23.0) - t * 1.15 + fbm(q * 3.4 - t * 0.2) * 3.1);
    float band = clamp(0.5 + 0.5 * contour, 0.0, 1.0);
    float heat = clamp(
      0.18
      + river * 0.48
      + band * 0.34
      + fbm(q * 2.8 + vec2(0.0, t * 0.28)) * 0.24
      + uBass * 0.12,
      0.0,
      1.0
    );

    float island1 = smoothstep(0.30, 0.0, length(q - vec2(0.08, 0.38)) - (0.18 + uBass * 0.035));
    float island2 = smoothstep(0.24, 0.0, length(q - vec2(0.42, -0.30)) - (0.13 + uLowMid * 0.04));
    float island3 = smoothstep(0.20, 0.0, length(q - vec2(-0.10, -0.72)) - (0.12 + uEnergy * 0.025));
    float hotSpots = max(max(island1, island2), island3) * river;
    float channelCenter = -0.02 + sin(q.x * 1.05 + t * 0.18) * 0.08 + sin(q.x * 2.7 - t * 0.1) * 0.035;
    float whiteChannel = smoothstep(0.30, 0.02, abs(q.y - channelCenter)) * river;
    whiteChannel *= 0.72 + fbm(q * vec2(2.0, 5.8) + vec2(-t * 0.08, t * 0.04)) * 0.28;

    vec3 paper = mix(vec3(0.955, 0.94, 0.935), uBgColor, 0.08);
    float paperNoise = fbm(vUv * 58.0 + t * 0.04);
    vec3 col = paper + (paperNoise - 0.5) * 0.028;

    vec3 thermal = heatMap(heat + hotSpots * 0.28);
    vec3 coolPool = vec3(0.62, 0.96, 0.98);
    thermal = mix(coolPool, thermal, river * 0.78 + edge * 0.22);

    vec3 violetHalo = vec3(0.24, 0.02, 0.58);
    vec3 yellowHalo = vec3(1.0, 0.92, 0.03);
    vec3 redCore = vec3(0.96, 0.04, 0.0);
    vec3 whiteGlint = vec3(1.0, 0.94, 0.76);

    col = mix(col, thermal, softBody * 0.86);
    col = mix(col, vec3(0.955, 0.952, 0.92), whiteChannel * 0.9);
    col = mix(col, violetHalo, outerGlow * (0.34 + band * 0.10));
    col = mix(col, yellowHalo, edge * smoothstep(0.28, 0.62, band) * 0.72);
    col = mix(col, redCore, hotSpots * 0.62);

    float innerRidge = pow(max(0.0, sin((q.y + flow.x * 0.8) * 8.0 - t * 0.75)), 8.0) * river;
    float glint = (innerRidge * 0.28 + edge * 0.18 + hotSpots * 0.18) * (0.72 + uEnergy * 0.22);
    col += whiteGlint * glint;

    vec3 ca = vec3(0.0);
    ca.r = edge * smoothstep(0.42, 0.78, band) * 0.06;
    ca.g = edge * 0.03;
    ca.b = outerGlow * 0.08;
    col += ca;

    col = mix(paper, col, clamp(softBody + outerGlow * 0.58, 0.0, 1.0));
    col = min(col, vec3(0.96, 0.94, 0.88));
    col *= 0.99 + sin(vUv.y * 390.0 + t * 0.45) * 0.006;

    gl_FragColor = vec4(col, 1.0);
  }
`;

function LiquidScene() {
  const speed = useStore((state) => state.speed);
  const baseColor = useStore((state) => state.baseColor);
  const secondaryColor = useStore((state) => state.secondaryColor);
  const accentColor = useStore((state) => state.accentColor);
  const bgColor = useStore((state) => state.bgColor);
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const liquidTimeRef = useRef(0);
  const liquidSpeedRef = useRef(0.16);
  const liquidSurgeRef = useRef(0);
  
  useFrame((_, delta) => {
    if(!materialRef.current) return;
    const { volume, bass, lowMid, energy, beat, treble } = getReactiveAudio();
    const spectralFlux = Math.max(treble, beat * 0.5);
    const transient = beat;
    const audioLift = volume * 0.36 + energy * 0.42 + bass * 0.55 + lowMid * 0.22;
    const targetSurge = beat * 0.95 + transient * 0.62 + spectralFlux * 0.42;
    liquidSurgeRef.current += (targetSurge - liquidSurgeRef.current) * 0.065;

    const targetSpeed = 0.11 + audioLift + liquidSurgeRef.current;
    const follow = targetSpeed > liquidSpeedRef.current ? 0.055 : 0.03;
    liquidSpeedRef.current += (targetSpeed - liquidSpeedRef.current) * follow;
    liquidTimeRef.current += delta * liquidSpeedRef.current * Math.max(0.25, speed);

    const uniforms = materialRef.current.uniforms;
    uniforms.uTime.value = liquidTimeRef.current;
    uniforms.uBass.value += (bass - uniforms.uBass.value) * 0.075;
    uniforms.uLowMid.value += (lowMid - uniforms.uLowMid.value) * 0.07;
    uniforms.uEnergy.value += (energy - uniforms.uEnergy.value) * 0.06;
    uniforms.uBaseColor.value.set(baseColor);
    uniforms.uSecondaryColor.value.set(secondaryColor);
    uniforms.uAccentColor.value.set(accentColor);
    uniforms.uBgColor.value.set(bgColor);
  });

  return (
    <mesh position={[0,0,-2]} scale={[40, 20, 1]}>
      <planeGeometry args={[1, 1]} />
      <shaderMaterial 
        ref={materialRef}
        vertexShader="varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }"
        fragmentShader={liquidFragment}
        uniforms={{
          uTime: { value: 0 },
          uBass: { value: 0 },
          uLowMid: { value: 0 },
          uEnergy: { value: 0 },
          uBaseColor: { value: new THREE.Color(baseColor) },
          uSecondaryColor: { value: new THREE.Color(secondaryColor) },
          uAccentColor: { value: new THREE.Color(accentColor) },
          uBgColor: { value: new THREE.Color(bgColor) },
        }}
        depthWrite={false}
      />
    </mesh>
  );
}

function ChromaScene() {
  const speed = useStore((state) => state.speed);
  const baseColor = useStore((state) => state.baseColor);
  const secondaryColor = useStore((state) => state.secondaryColor);
  const accentColor = useStore((state) => state.accentColor);
  const bgColor = useStore((state) => state.bgColor);
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const chromaTimeRef = useRef(0);
  const chromaSpeedRef = useRef(0.12);
  const chromaSurgeRef = useRef(0);

  useFrame((_, delta) => {
    if(!materialRef.current) return;
    const { volume, bass, lowMid, energy, beat, treble } = getReactiveAudio();
    const spectralFlux = Math.max(treble, beat * 0.4);
    const audioLift = volume * 0.18 + energy * 0.22 + bass * 0.28 + lowMid * 0.12;
    const targetSurge = beat * 0.32 + spectralFlux * 0.14;
    chromaSurgeRef.current += (targetSurge - chromaSurgeRef.current) * 0.035;

    const targetSpeed = 0.07 + audioLift + chromaSurgeRef.current;
    chromaSpeedRef.current += (targetSpeed - chromaSpeedRef.current) * 0.03;
    chromaTimeRef.current += delta * chromaSpeedRef.current * Math.max(0.2, speed);

    const uniforms = materialRef.current.uniforms;
    uniforms.uTime.value = chromaTimeRef.current;
    uniforms.uBass.value += (bass - uniforms.uBass.value) * 0.055;
    uniforms.uLowMid.value += (lowMid - uniforms.uLowMid.value) * 0.05;
    uniforms.uEnergy.value += (energy - uniforms.uEnergy.value) * 0.045;
    uniforms.uBaseColor.value.set(baseColor);
    uniforms.uSecondaryColor.value.set(secondaryColor);
    uniforms.uAccentColor.value.set(accentColor);
    uniforms.uBgColor.value.set(bgColor);
  });

  return (
    <mesh position={[0,0,-2]} scale={[40, 20, 1]}>
      <planeGeometry args={[1, 1]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader="varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }"
        fragmentShader={chromafluxFragment}
        uniforms={{
          uTime: { value: 0 },
          uBass: { value: 0 },
          uLowMid: { value: 0 },
          uEnergy: { value: 0 },
          uBaseColor: { value: new THREE.Color(baseColor) },
          uSecondaryColor: { value: new THREE.Color(secondaryColor) },
          uAccentColor: { value: new THREE.Color(accentColor) },
          uBgColor: { value: new THREE.Color(bgColor) },
        }}
        depthWrite={false}
      />
    </mesh>
  );
}

// 3. CYBER GRID (Perspective lines and glitching geometry)
function CyberScene() {
  const speed = useStore((state) => state.speed);
  const baseColor = useStore((state) => state.baseColor);
  const textInput = useStore((state) => state.textInput);
  const textFontSize = useStore((state) => state.textFontSize);
  const textLetterSpacing = useStore((state) => state.textLetterSpacing);
  const textFontWeight = useStore((state) => state.textFontWeight);
  const matRef = useRef<THREE.ShaderMaterial>(null);
  
  const textTexture = useTextTexture(textInput, textFontSize, textLetterSpacing, textFontWeight);
  
  useFrame((state) => {
    if(!matRef.current) return;
    const { bass, energy } = getReactiveAudio();
    matRef.current.uniforms.uTime.value = state.clock.elapsedTime * speed;
    matRef.current.uniforms.uBass.value = bass;
    matRef.current.uniforms.uEnergy.value = energy;
    matRef.current.uniforms.uColor.value.set(baseColor);
    matRef.current.uniforms.tText.value = textTexture;
  });

  return (
    <mesh position={[0,0,-1]}>
      <planeGeometry args={[24, 12]} />
      <shaderMaterial 
        ref={matRef}
        vertexShader="varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }"
        fragmentShader={cyberFragment}
        uniforms={{
          uTime: { value: 0 },
          uBass: { value: 0 },
          uEnergy: { value: 0 },
          uColor: { value: new THREE.Color() },
          tText: { value: null }
        }}
        transparent={false}
        depthWrite={false}
      />
    </mesh>
  );
}

// Dynamic Type / Sonic Topology scene adapted for the VJ stage.
const topologyFragment = `
  uniform float uTime;
  uniform sampler2D uTexture;
  uniform float uThickness;
  uniform float uAmplitude;
  uniform float uSpeed;
  uniform float uAudio;
  uniform float uLiquify;
  uniform vec3 uColor1;
  uniform vec3 uColor2;
  uniform float uFrequency;
  uniform float uAspect;
  varying vec2 vUv;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y) * 2.0 - 1.0;
  }

  void main() {
    vec2 uv = vUv;
    vec2 center = (uv - 0.5) * vec2(uAspect, 1.0);
    float currentSpeed = uSpeed + uAudio * 2.0;
    float currentAmp = uAmplitude + uAudio * 0.2;

    float liquifyScale = 1.2 + uLiquify * 5.5;
    float t = uTime * currentSpeed;
    float noiseX = noise(uv * liquifyScale + vec2(t * 0.22, -t * 0.17));
    float noiseY = noise(uv * liquifyScale + vec2(19.7 - t * 0.15, 11.3 + t * 0.2));
    vec2 distortedUV = uv + vec2(noiseX, noiseY) * currentAmp;

    float d = texture2D(uTexture, distortedUV).r;
    float bgNoise = max(0.0, noise(uv * 2.1 + uTime * 0.08));
    vec3 bg = uColor2 * bgNoise * (0.025 + uAudio * 0.18);

    if (d < 0.005) {
      float dust = step(0.988, hash(floor(uv * vec2(180.0, 95.0)) + floor(uTime * 6.0)));
      gl_FragColor = vec4(bg + dust * uColor2 * 0.05 * uAudio, 1.0);
      return;
    }

    float rings = fract(d * uFrequency - t * 1.8);
    float width = uThickness * 0.5;
    float lineAlpha = smoothstep(0.5 - width - 0.055, 0.5 - width, rings)
                    - smoothstep(0.5 + width, 0.5 + width + 0.055, rings);
    float mask = smoothstep(0.01, 0.16, d);
    float edge = smoothstep(0.02, 0.25, d) * (1.0 - smoothstep(0.72, 1.0, d));
    lineAlpha *= mask;

    vec3 contour = mix(uColor2 * 0.88, uColor2, clamp(uAudio * 1.4 + (1.0 - d), 0.0, 1.0));
    vec3 glow = uColor2 * mask * d * clamp(0.25 + uAudio, 0.25, 1.0) * 0.55;
    vec3 finalColor = bg + contour * lineAlpha + glow;

    finalColor += uColor2 * edge * 0.08 * (0.5 + uAudio);
    finalColor *= smoothstep(1.45, 0.25, length(center));
    finalColor *= 0.96 + sin(vUv.y * 900.0) * 0.04;

    gl_FragColor = vec4(finalColor, 1.0);
  }
`;

function useTopologyTexture(text: string, blurIntensity: number) {
  const canvas = useMemo(() => document.createElement('canvas'), []);
  const texture = useMemo(() => {
    const tex = new THREE.CanvasTexture(canvas);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.generateMipmaps = false;
    return tex;
  }, [canvas]);

  useEffect(() => {
    canvas.width = 2048;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const displayText = text.toUpperCase();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.filter = `blur(${Math.max(1, blurIntensity * 80)}px)`;

    let fontSize = 520;
    do {
      ctx.font = `900 ${fontSize}px Inter, Arial Black, system-ui, sans-serif`;
      fontSize -= 16;
    } while (ctx.measureText(displayText).width > canvas.width * 1.22 && fontSize > 160);

    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.scale(1.28, 1.0);
    ctx.transform(1, 0, -0.2, 1, 0, 0);
    ctx.fillText(displayText, 0, 0);

    texture.needsUpdate = true;
  }, [text, blurIntensity, canvas, texture]);

  return texture;
}

function TopologyScene() {
  const speed = useStore((state) => state.speed);
  const chaos = useStore((state) => state.chaos);
  const distortion = useStore((state) => state.distortion);
  const textInput = useStore((state) => state.textInput);
  const baseColor = useStore((state) => state.baseColor);
  const secondaryColor = useStore((state) => state.secondaryColor);
  const bloomIntensity = useStore((state) => state.bloomIntensity);
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const texture = useTopologyTexture(textInput, 0.35 + distortion * 0.25);
  const { size } = useThree();

  useFrame((state, delta) => {
    if (!materialRef.current) return;
    const { energy, beat, bass, treble } = getReactiveAudio();
    const audio = Math.min(1.35, energy * 0.85 + beat * 0.65 + bass * 0.35 + treble * 0.2);
    const uniforms = materialRef.current.uniforms;
    uniforms.uTime.value += delta;
    uniforms.uTexture.value = texture;
    uniforms.uAudio.value += (audio - uniforms.uAudio.value) * 0.12;
    uniforms.uThickness.value = 0.1 + Math.min(0.28, bloomIntensity * 0.025 + beat * 0.08);
    uniforms.uAmplitude.value = 0.08 + distortion * 0.28 + chaos * 0.16;
    uniforms.uSpeed.value = 0.65 + speed * 0.75;
    uniforms.uLiquify.value = 0.42 + chaos * 0.55 + bass * 0.2;
    uniforms.uFrequency.value = 18 + chaos * 18 + treble * 8;
    uniforms.uAspect.value = size.width / Math.max(size.height, 1);
    uniforms.uColor1.value.set(baseColor);
    uniforms.uColor2.value.set(secondaryColor);
  });

  return (
    <mesh position={[0, 0, -1]}>
      <planeGeometry args={[24, 12]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader="varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }"
        fragmentShader={topologyFragment}
        uniforms={{
          uTime: { value: 0 },
          uTexture: { value: texture },
          uThickness: { value: 0.15 },
          uAmplitude: { value: 0.12 },
          uSpeed: { value: 1 },
          uAudio: { value: 0 },
          uLiquify: { value: 0.5 },
          uColor1: { value: new THREE.Color(baseColor) },
          uColor2: { value: new THREE.Color(secondaryColor) },
          uFrequency: { value: 20 },
          uAspect: { value: size.width / Math.max(size.height, 1) },
        }}
        transparent={false}
        depthWrite={false}
      />
    </mesh>
  );
}

// 4. PULSE SCENE (Aggressive Bass Stage)
const pulseFragment = `
  uniform float uTime;
  uniform float uBass;
  uniform float uBeat;
  uniform float uTreble;
  uniform float uEnergy;
  uniform float uAspect;
  uniform vec3 uColor;
  uniform vec3 uSecondaryColor;
  uniform vec3 uAccentColor;
  uniform vec3 uBgColor;
  varying vec2 vUv;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 5; i++) {
      v += noise(p) * a;
      p = mat2(1.62, -1.07, 1.07, 1.62) * p + 13.7;
      a *= 0.52;
    }
    return v;
  }

  float softBlob(vec2 p, vec2 c, vec2 r, float wobble) {
    vec2 q = (p - c) / r;
    float n = fbm(q * 1.6 + vec2(uTime * 0.08, -uTime * 0.05));
    q.x += (n - 0.5) * wobble;
    q.y += (fbm(q.yx * 2.1 - uTime * 0.06) - 0.5) * wobble * 0.75;
    return smoothstep(1.05, 0.34, length(q));
  }

  float box(vec2 p, vec2 b) {
    vec2 d = abs(p) - b;
    return 1.0 - smoothstep(0.0, 0.018, length(max(d, 0.0)) + min(max(d.x, d.y), 0.0));
  }

  float segment(vec2 p, vec2 a, vec2 b, float width) {
    vec2 pa = p - a;
    vec2 ba = b - a;
    float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    return 1.0 - smoothstep(width, width * 2.8, length(pa - ba * h));
  }

  float shard(vec2 p, vec2 c, vec2 s, float angle) {
    float sn = sin(angle);
    float cs = cos(angle);
    vec2 q = mat2(cs, -sn, sn, cs) * (p - c);
    float body = box(q, s);
    float cutA = smoothstep(-s.x * 0.9, s.x * 0.65, q.x + q.y * 0.42);
    float cutB = 1.0 - smoothstep(s.x * 0.25, s.x * 1.12, q.x - q.y * 0.36);
    return body * cutA * cutB;
  }

  float glitchRun(vec2 p, float y, float width, float seed) {
    float wave = y + sin(p.x * 7.0 + uTime * (0.8 + seed)) * 0.035;
    float line = 1.0 - smoothstep(width, width * 3.0, abs(p.y - wave));
    float cells = step(0.52, hash(floor(vec2((p.x + uTime * (0.55 + seed * 0.2)) * 42.0, seed * 23.0))));
    float gate = smoothstep(-1.05, -0.42, p.x) * (1.0 - smoothstep(0.42, 1.18, p.x));
    return line * cells * gate;
  }

  void main() {
    vec2 p = vUv * 2.0 - 1.0;
    p.x *= uAspect;
    p += vec2(sin(uTime * 1.7) * 0.025, cos(uTime * 1.2) * 0.015) * (uBeat + uBass);

    float drift = sin(uTime * 0.18) * 0.18;
    float field = 0.0;
    field += softBlob(p, vec2(-0.95 + drift, 0.18), vec2(0.34, 0.18), 0.42);
    field += softBlob(p, vec2(-0.38 + drift * 0.4, -0.04), vec2(0.50, 0.20), 0.5);
    field += softBlob(p, vec2(0.28 - drift * 0.35, 0.09), vec2(0.44, 0.19), 0.44);
    field += softBlob(p, vec2(0.92 - drift * 0.65, -0.02), vec2(0.30, 0.17), 0.38);
    field += softBlob(p, vec2(-0.78 - drift * 0.45, -0.44), vec2(0.17, 0.10), 0.34);
    field = clamp(field, 0.0, 1.4);

    float tearMask = smoothstep(0.2, 0.82, fbm(p * vec2(2.2, 7.8) + vec2(uTime * 0.12, -uTime * 0.07)));
    field *= mix(0.48, 1.0, tearMask);

    float aura = smoothstep(0.08, 0.78, field);
    float core = smoothstep(0.66, 1.15, field);
    float torn = fbm(p * vec2(3.4, 8.5) + vec2(uTime * 0.18, -uTime * 0.08));
    float brokenCore = core * smoothstep(0.18, 0.82, torn + uBass * 0.22);

    vec3 amber = vec3(0.95, 0.46, 0.16);
    vec3 gold = vec3(1.0, 0.66, 0.28);
    vec3 red = vec3(1.0, 0.02, 0.0);
    vec3 hotRed = vec3(1.0, 0.0, 0.0);
    vec3 ember = vec3(1.0, 0.20, 0.08);
    vec3 warmGlint = vec3(1.0, 0.46, 0.16);

    vec3 col = vec3(0.0);
    col += amber * aura * (0.18 + uEnergy * 0.08);
    col += gold * core * (0.18 + uBass * 0.12);

    float edge = smoothstep(0.22, 0.52, field) - smoothstep(0.64, 0.98, field);
    float redEdge = edge * (0.65 + uBeat * 0.75);
    col += red * redEdge * 0.62;

    float runs = 0.0;
    runs += glitchRun(p, 0.19, 0.006 + uTreble * 0.004, 1.0);
    runs += glitchRun(p, 0.04, 0.005 + uBass * 0.005, 2.7);
    runs += glitchRun(p, -0.12, 0.005, 4.4);
    runs += glitchRun(p, -0.31, 0.004, 6.1);
    runs *= smoothstep(0.38, 0.92, field + fbm(p * 1.5) * 0.22);
    col += hotRed * runs * (0.46 + uBass * 0.52);
    col += gold * runs * 0.08;

    float micro = 0.0;
    for (int i = 0; i < 4; i++) {
      float fi = float(i);
      vec2 c = vec2(hash(vec2(fi, 1.7)) * 2.35 - 1.18, hash(vec2(fi, 9.1)) * 0.92 - 0.46);
      c.x += sin(uTime * (0.18 + hash(vec2(fi, 4.0)) * 0.3) + fi) * 0.18;
      float len = 0.025 + hash(vec2(fi, 2.3)) * 0.09;
      float on = step(0.48, hash(floor(vec2(fi * 4.3, uTime * (5.0 + uBeat * 8.0)))));
      micro += segment(p, c - vec2(len, 0.0), c + vec2(len, 0.0), 0.004 + hash(vec2(fi, 3.1)) * 0.004) * on;
    }
    col += mix(gold, red, 0.68) * micro * (0.03 + aura * 0.18);

    float metal = 0.0;
    metal += shard(p, vec2(-0.82 + drift * 0.2, 0.18), vec2(0.16, 0.045), -0.18);
    metal += shard(p, vec2(-0.24 - drift * 0.2, -0.18), vec2(0.20, 0.038), 0.08);
    metal += shard(p, vec2(0.30 + drift * 0.15, 0.16), vec2(0.17, 0.04), -0.1);
    metal += shard(p, vec2(0.78 - drift * 0.2, -0.05), vec2(0.18, 0.07), 0.23);
    metal += shard(p, vec2(-0.55, -0.42), vec2(0.10, 0.035), -0.22);
    metal += shard(p, vec2(0.04 + drift * 0.08, -0.02), vec2(0.14, 0.032), 0.18);
    float metalMask = clamp(metal, 0.0, 1.0);
    float bevel = smoothstep(0.2, 0.96, fbm(p * 14.0 + uTime * 0.25));
    col += red * metalMask * (0.42 + uBeat * 0.22);
    col += mix(ember * 0.42, warmGlint * 0.7, bevel) * metalMask * (0.34 + uTreble * 0.12);
    col += red * smoothstep(0.0, 0.7, metal) * 0.18;

    float flash = uBeat * step(0.72, hash(vec2(floor(uTime * 14.0), 91.0)));
    col += warmGlint * flash * aura * 0.035;
    col += red * flash * edge * 0.22;

    float grain = hash(vUv * vec2(760.0, 430.0) + floor(uTime * 28.0)) - 0.5;
    col += grain * (0.022 + uBass * 0.035);
    float scan = 0.965 + sin(vUv.y * 720.0 + uTime * 14.0) * 0.025;
    col *= scan;

    col = pow(max(col, vec3(0.0)), vec3(0.82));

    gl_FragColor = vec4(col, 1.0);
  }
`;

function PulseScene() {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const baseColor = useStore((state) => state.baseColor);
  const secondaryColor = useStore((state) => state.secondaryColor);
  const accentColor = useStore((state) => state.accentColor);
  const bgColor = useStore((state) => state.bgColor);
  const { size } = useThree();

  useFrame((state) => {
    if(!matRef.current) return;
    const { bass, treble, beat, energy } = getReactiveAudio();
    matRef.current.uniforms.uTime.value = state.clock.elapsedTime;
    matRef.current.uniforms.uBass.value = bass;
    matRef.current.uniforms.uBeat.value = beat;
    matRef.current.uniforms.uTreble.value = treble;
    matRef.current.uniforms.uEnergy.value = energy;
    matRef.current.uniforms.uAspect.value = size.width / Math.max(size.height, 1);
    matRef.current.uniforms.uColor.value.set(baseColor);
    matRef.current.uniforms.uSecondaryColor.value.set(secondaryColor);
    matRef.current.uniforms.uAccentColor.value.set(accentColor);
    matRef.current.uniforms.uBgColor.value.set(bgColor);
  });

  return (
    <mesh position={[0,0,-12]}>
      <planeGeometry args={[90, 54]} />
      <shaderMaterial 
        ref={matRef}
        vertexShader="varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }"
        fragmentShader={pulseFragment}
        uniforms={{
          uTime: { value: 0 },
          uBass: { value: 0 },
          uBeat: { value: 0 },
          uTreble: { value: 0 },
          uEnergy: { value: 0 },
          uAspect: { value: size.width / Math.max(size.height, 1) },
          uColor: { value: new THREE.Color(baseColor) },
          uSecondaryColor: { value: new THREE.Color(secondaryColor) },
          uAccentColor: { value: new THREE.Color(accentColor) },
          uBgColor: { value: new THREE.Color(bgColor) },
        }}
        transparent
        depthWrite={false}
      />
    </mesh>
  );
}

const glassTextVertex = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const glassTextFragment = `
  uniform sampler2D uText;
  uniform float uTime;
  uniform float uEnergy;
  uniform float uBeat;
  uniform float uBass;
  uniform float uChaos;
  uniform float uFlowTime;
  uniform float uPaintTime;
  uniform vec2 uGlassMotion;
  varying vec2 vUv;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }

  vec4 sampleText(vec2 uv) {
    vec4 tex = texture2D(uText, uv);
    return vec4(vec3(tex.r), max(tex.a, tex.r));
  }

  void main() {
    vec2 uv = vUv;
    vec2 motionUv = uv + uGlassMotion * (0.018 + uBass * 0.018 + uBeat * 0.012);
    vec2 aspectUv = vec2(motionUv.x, motionUv.y * 1.18);
    vec2 grid = vec2(11.0, 7.0);
    vec2 tile = floor(aspectUv * grid);
    vec2 cell = fract(aspectUv * grid);
    vec2 center = cell - 0.5;

    float id = hash(tile);
    float id2 = hash(tile + 19.37);
    float id3 = hash(tile + 51.91);
    float t = uTime * (0.35 + id * 0.22);
    vec2 tileMotion = vec2(
      sin(uTime * (0.7 + id * 0.4) + id2 * 6.283),
      cos(uTime * (0.62 + id3 * 0.38) - id * 6.283)
    ) * (uEnergy * 0.055 + uBass * 0.045 + uBeat * 0.035);
    center += tileMotion;
    float roundedBox = max(abs(center.x), abs(center.y));
    float edge = smoothstep(0.49, 0.43, roundedBox);
    float border = 1.0 - smoothstep(0.42, 0.49, roundedBox);

    float swirl = sin(center.x * (7.0 + id * 10.0) + t + id2 * 6.283)
                * cos(center.y * (8.0 + id3 * 9.0) - t * 1.3);
    float localNoise = noise(tile * 1.7 + cell * (2.0 + id * 3.0) + uTime * 0.06);
    vec2 lens = normalize(center + 0.001) * (0.018 + id * 0.045);
    lens += vec2(swirl, localNoise - 0.5) * (0.035 + uEnergy * 0.06 + uBass * 0.05);
    lens += center * (0.05 + id2 * 0.09 + uBeat * 0.06);

    vec2 seamWarp = vec2(
      sin(tile.y * 1.73 + uTime * 0.2),
      cos(tile.x * 1.47 - uTime * 0.16)
    ) * (0.008 + uChaos * 0.018);
    vec2 refractedUv = uv + (lens + seamWarp) * edge;
    vec4 textBehind = sampleText(refractedUv);
    vec4 textGhost = sampleText(uv + vec2(localNoise - 0.5, swirl) * 0.012);

    vec3 bg = vec3(0.018, 0.018, 0.02);
    vec3 textColor = vec3(0.82, 0.82, 0.8) * textBehind.a;
    textColor += vec3(0.24) * textGhost.a * (1.0 - edge);

    float grey = mix(0.2, 0.76, id);
    grey += (localNoise - 0.5) * 0.18;
    grey += uEnergy * 0.08 + uBeat * 0.08;
    vec3 glass = vec3(grey);

    float innerShade = smoothstep(0.0, 0.55, length(center));
    float whiteCore = smoothstep(0.45, 0.02, length(center * vec2(1.05, 0.86)));
    float highlight = smoothstep(0.055, 0.0, abs(center.x - 0.18 - id * 0.18))
                    + smoothstep(0.055, 0.0, abs(center.y - 0.28 + id2 * 0.16));
    highlight *= 0.16 + id3 * 0.26;

    vec3 neonA = 0.5 + 0.5 * cos(vec3(0.0, 2.1, 4.2) + uFlowTime * 1.2 + id * 6.283);
    vec3 neonB = 0.5 + 0.5 * cos(vec3(3.1, 0.8, 5.4) + uTime * 2.0 - id2 * 6.283 + swirl * 2.5);
    vec3 neon = mix(neonA, neonB, 0.45 + 0.35 * sin(uTime + id3 * 6.283));

    vec2 paintUv = center * (2.4 + id * 2.2);
    paintUv += vec2(
      sin(uPaintTime * (0.42 + id * 0.18) + id2 * 6.283),
      cos(uPaintTime * (0.34 + id3 * 0.2) - id * 6.283)
    );
    float paintA = noise(paintUv + vec2(uPaintTime * 0.18, -uPaintTime * 0.11));
    float paintB = noise(paintUv * 1.9 + vec2(-uPaintTime * 0.09, uPaintTime * 0.16) + tile * 0.23);
    float paintMask = smoothstep(0.32, 0.86, paintA * 0.68 + paintB * 0.5);
    paintMask *= smoothstep(0.52, 0.12, length(center));
    vec3 paintColor = 0.5 + 0.5 * cos(vec3(0.2, 2.4, 4.7) + paintA * 5.8 + paintB * 2.4 + id * 6.283);

    float edgeGlow = smoothstep(0.24, 0.5, roundedBox) * edge;
    float gapX = min(cell.x, 1.0 - cell.x);
    float gapY = min(cell.y, 1.0 - cell.y);
    float seamDistance = min(gapX, gapY);
    float seam = smoothstep(0.025, 0.0, seamDistance);
    float verticalSeam = smoothstep(0.026, 0.0, gapX);
    float horizontalSeam = smoothstep(0.026, 0.0, gapY);
    float verticalFlow = smoothstep(0.12, 0.0, abs(fract(cell.y * 3.2 + tile.x * 0.13 - uFlowTime * (0.85 + id * 0.8)) - 0.5));
    float horizontalFlow = smoothstep(0.12, 0.0, abs(fract(cell.x * 3.2 + tile.y * 0.17 + uFlowTime * (0.72 + id2 * 0.9)) - 0.5));
    float seamFlow = max(verticalSeam * verticalFlow, horizontalSeam * horizontalFlow);
    float seamSpark = seam * smoothstep(0.7, 1.0, noise(tile * 2.1 + vec2(uFlowTime * 0.8, -uFlowTime * 0.55)));

    vec3 col = bg;
    col += textColor * (0.55 + edge * 0.85);
    col = mix(col, glass, 0.34 * edge);
    col += paintColor * paintMask * edge * (0.18 + uEnergy * 0.16);
    col = mix(col, vec3(1.0), whiteCore * 0.42 * edge);
    col += neon * edgeGlow * 0.12;
    col += neon * seamFlow * (0.92 + uBeat * 0.75);
    col += vec3(1.0) * seamFlow * 0.32;
    col += neon * seamSpark * (0.24 + uEnergy * 0.5);
    col += vec3(0.18) * innerShade * edge;
    col += vec3(0.55) * highlight * edge;
    col -= vec3(0.12) * seam;
    col += vec3(0.18) * border * edge;

    gl_FragColor = vec4(col, 1.0);
  }
`;

const foregroundRippleTextFragment = `
  uniform sampler2D uText;
  uniform float uTime;
  uniform float uEnergy;
  uniform float uBeat;
  uniform vec3 uTextColor;
  varying vec2 vUv;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
  }

  void main() {
    vec2 uv = vUv;
    vec2 center = uv - 0.5;
    float wave = sin((uv.y * 18.0 + center.x * 4.0) - uTime * (2.4 + uEnergy * 2.2));
    float ripple = sin(length(center * vec2(1.45, 0.9)) * 42.0 - uTime * (4.0 + uBeat * 3.0));
    float slice = floor(uv.y * 42.0);
    float jitter = (hash(vec2(slice, floor(uTime * 16.0))) - 0.5) * 0.018 * (0.35 + uEnergy + uBeat);
    vec2 scanUv = uv + vec2((wave * 0.012 + ripple * 0.008 + jitter), 0.0);

    vec4 text = texture2D(uText, scanUv);
    float mask = max(text.r, text.a);
    float scanLine = smoothstep(0.0, 0.04, abs(fract(uv.y * 18.0 - uTime * (0.9 + uEnergy)) - 0.5));
    float edgeNoise = hash(floor(uv * vec2(420.0, 210.0)) + floor(uTime * 8.0));
    float grain = step(0.965 - uEnergy * 0.04, edgeNoise);

    vec3 uvA = vec3(uv.x, uv.y, uv.x);
    vec3 uvB = vec3(uv.y, uv.x, uv.y);
    vec3 neonA = 0.5 + 0.5 * cos(vec3(0.0, 2.2, 4.4) + uTime * 1.8 + uvA * vec3(8.0, 5.0, 7.0));
    vec3 neonB = 0.5 + 0.5 * cos(vec3(3.1, 0.7, 5.2) - uTime * 1.25 + ripple * 2.2 + uvB * vec3(6.0, 9.0, 4.0));
    vec3 neon = mix(neonA, neonB, 0.45 + 0.35 * wave);
    neon = mix(uTextColor, neon, 0.62);
    vec3 hotCore = mix(uTextColor, neon, 0.72);
    vec3 core = hotCore * mask * (0.9 + uEnergy * 0.24);
    vec3 glow = neon * mask * (0.42 + uEnergy * 0.55 + uBeat * 0.55);
    vec3 scan = mix(vec3(1.0), neon, 0.82) * mask * (1.0 - scanLine) * 0.55;
    vec3 col = core + glow + scan + neon * grain * mask * 0.45;
    float alpha = clamp(mask * (0.7 + uEnergy * 0.28) + grain * mask * 0.25, 0.0, 1.0);

    gl_FragColor = vec4(col, alpha);
  }
`;

function RandomGlassBlocksScene() {
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const foregroundTextRef = useRef<THREE.ShaderMaterial>(null);
  const flowTimeRef = useRef(0);
  const paintTimeRef = useRef(0);
  const mouseMotionRef = useRef(new THREE.Vector2(0, 0));
  const textInput = useStore((state) => state.textInput);
  const textColor = useStore((state) => state.textColor);
  const textFontSize = useStore((state) => state.textFontSize);
  const textLetterSpacing = useStore((state) => state.textLetterSpacing);
  const textFontWeight = useStore((state) => state.textFontWeight);
  const speed = useStore((state) => state.speed);
  const chaos = useStore((state) => state.chaos);
  const displayText = textInput.trim().toUpperCase();
  const textTexture = useCleanTextTexture(displayText, false, textFontSize * 1.25, textLetterSpacing, textFontWeight);

  useFrame((state, delta) => {
    if (!materialRef.current) return;
    const { energy, beat, bass } = getReactiveAudio();
    const uniforms = materialRef.current.uniforms;
    const tempoDrive = 0.8 + energy * 4.2 + bass * 2.8 + beat * 7.5;
    flowTimeRef.current += delta * tempoDrive * Math.max(0.35, speed);
    paintTimeRef.current += delta * (0.55 + energy * 0.7 + bass * 0.45) * Math.max(0.35, speed);

    uniforms.uText.value = textTexture;
    uniforms.uTime.value = state.clock.elapsedTime * speed;
    uniforms.uFlowTime.value = flowTimeRef.current;
    uniforms.uPaintTime.value = paintTimeRef.current;
    uniforms.uEnergy.value += (energy - uniforms.uEnergy.value) * 0.12;
    uniforms.uBeat.value += (beat - uniforms.uBeat.value) * 0.2;
    uniforms.uBass.value += (bass - uniforms.uBass.value) * 0.14;
    uniforms.uChaos.value = chaos;
    mouseMotionRef.current.lerp(state.pointer, 0.08);
    const performanceAmount = 0.75 + chaos * 0.35;
    const mouseAmount = 0.75 + chaos * 0.25;
    uniforms.uGlassMotion.value.set(
      mouseMotionRef.current.x * mouseAmount + Math.sin(state.clock.elapsedTime * 0.9 * speed) * (0.22 + bass * 0.5 + beat * 0.35) * performanceAmount,
      mouseMotionRef.current.y * mouseAmount + Math.cos(state.clock.elapsedTime * 0.72 * speed) * (0.18 + energy * 0.45 + beat * 0.28) * performanceAmount
    );

    if (foregroundTextRef.current) {
      foregroundTextRef.current.uniforms.uText.value = textTexture;
      foregroundTextRef.current.uniforms.uTime.value = state.clock.elapsedTime * speed;
      foregroundTextRef.current.uniforms.uEnergy.value += (energy - foregroundTextRef.current.uniforms.uEnergy.value) * 0.14;
      foregroundTextRef.current.uniforms.uBeat.value += (beat - foregroundTextRef.current.uniforms.uBeat.value) * 0.22;
      foregroundTextRef.current.uniforms.uTextColor.value.set(textColor);
    }
  });

  return (
    <group>
      <mesh position={[0, 0, -1]}>
        <planeGeometry args={[24, 13]} />
        <shaderMaterial
          ref={materialRef}
          vertexShader={glassTextVertex}
          fragmentShader={glassTextFragment}
          uniforms={{
            uText: { value: textTexture },
            uTime: { value: 0 },
            uEnergy: { value: 0 },
            uBeat: { value: 0 },
            uBass: { value: 0 },
            uChaos: { value: chaos },
            uFlowTime: { value: 0 },
            uPaintTime: { value: 0 },
            uGlassMotion: { value: new THREE.Vector2(0, 0) },
          }}
          depthWrite={false}
        />
      </mesh>
      <mesh position={[0, 0, 1.2]}>
        <planeGeometry args={[18, 9]} />
        <shaderMaterial
          ref={foregroundTextRef}
          vertexShader={glassTextVertex}
          fragmentShader={foregroundRippleTextFragment}
          uniforms={{
            uText: { value: textTexture },
            uTime: { value: 0 },
            uEnergy: { value: 0 },
            uBeat: { value: 0 },
            uTextColor: { value: new THREE.Color(textColor) },
          }}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  );
}

// === ROUTER ===
function SceneRouter({ sceneOverride }: { sceneOverride?: string }) {
  const currentScene = useStore((state) => state.currentScene);
  const scene = sceneOverride || currentScene;
  const moduleId = getVisualModule(scene)?.id ?? scene;
  switch(moduleId) {
    case 'Layered Stage': return null;
    case 'Blue Font': return null;
    case 'Purple': return null;
    case 'Cyber': return <CyberScene />;
    case 'Topology': return <TopologyScene />;
    case 'Liquid': return <LiquidScene />;
    case 'Chromaflux': return <ChromaScene />;
    case 'Pulse': return <PulseScene />;
    case 'Void': return <VoidScene />;
    case 'Dumbar': return <RandomGlassBlocksScene />;
    default: return <VoidScene />;
  }
}

function useCleanTextTexture(text: string, isDumbar: boolean = false, fontSize: number = 5, letterSpacing: number = -0.1, fontWeight: number = 900) {
  const canvas = useMemo(() => document.createElement('canvas'), []);
  const texture = useMemo(() => new THREE.CanvasTexture(canvas), [canvas]);

  const drawTextWithLetterSpacing = (ctx: CanvasRenderingContext2D, text: string, x: number, y: number, letterSpacing: number) => {
    if (letterSpacing === 0) {
      ctx.fillText(text, x, y);
      return;
    }

    const previousAlign = ctx.textAlign;
    ctx.textAlign = 'left';

    const characters = Array.from(text);
    let totalWidth = -letterSpacing;
    for (const char of characters) {
      totalWidth += ctx.measureText(char).width + letterSpacing;
    }

    let currentX = x - totalWidth / 2;
    for (const char of characters) {
      ctx.fillText(char, currentX, y);
      currentX += ctx.measureText(char).width + letterSpacing;
    }

    ctx.textAlign = previousAlign;
  };

  useEffect(() => {
    // High res for crisp text
    canvas.width = 2048;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, 2048, 1024);

    ctx.fillStyle = 'rgba(255,255,255,1.0)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `${fontWeight} ${Math.round(fontSize * 96)}px Inter, system-ui, "SF Pro Text", "Helvetica Neue", "PingFang SC", "Microsoft YaHei", sans-serif`;

    if (isDumbar) {
      // Dumbar style: transparent background, crisp white text on transparent.
      drawTextWithLetterSpacing(ctx, text, 1024, 512, letterSpacing);
    } else {
      drawTextWithLetterSpacing(ctx, text, 1024, 512, letterSpacing);
    }

    texture.needsUpdate = true;
  }, [text, canvas, texture, isDumbar, fontSize, letterSpacing, fontWeight]);

  return texture;
}

function useDarkSpaceTextTexture(text: string, fontSize: number, letterSpacing: number, fontWeight: number) {
  const canvas = useMemo(() => document.createElement('canvas'), []);
  const texture = useMemo(() => {
    const tex = new THREE.CanvasTexture(canvas);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.generateMipmaps = false;
    return tex;
  }, [canvas]);

  useEffect(() => {
    canvas.width = 2048;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const displayText = text.trim().toUpperCase();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!displayText) {
      texture.needsUpdate = true;
      return;
    }

    let fontPx = Math.round(fontSize * 112);
    const family = 'Inter, Arial Black, Impact, system-ui, "SF Pro Text", "Helvetica Neue", "PingFang SC", "Microsoft YaHei", sans-serif';
    const chars = Array.from(displayText);
    const spacingPx = letterSpacing * fontSize * 24;

    const measure = () => {
      ctx.font = `italic ${fontWeight} ${fontPx}px ${family}`;
      return chars.reduce((sum, char, index) => sum + ctx.measureText(char).width + (index === chars.length - 1 ? 0 : spacingPx), 0);
    };

    while (measure() > canvas.width * 0.9 && fontPx > 110) {
      fontPx -= 14;
    }

    ctx.font = `italic ${fontWeight} ${fontPx}px ${family}`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.lineJoin = 'round';
    ctx.miterLimit = 2;

    const totalWidth = measure();
    let x = (canvas.width - totalWidth) / 2;
    const y = canvas.height * 0.53;

    chars.forEach((char, index) => {
      const width = ctx.measureText(char).width;
      const id = chars.length <= 1 ? 0.5 : index / Math.max(1, chars.length - 1);
      const red = Math.round(36 + id * 208);
      const green = Math.round(255 - id * 156);
      const blue = Math.round(130 + (index % 3) * 42);

      ctx.save();
      ctx.translate(x + width / 2, y);
      ctx.transform(1, 0, -0.18, 1, 0, 0);
      ctx.translate(-(x + width / 2), -y);
      ctx.lineWidth = Math.max(10, fontPx * 0.032);
      ctx.strokeStyle = `rgba(${red}, ${green}, ${blue}, 0.92)`;
      ctx.strokeText(char, x, y);
      ctx.fillStyle = `rgba(${red}, ${green}, ${blue}, 1)`;
      ctx.fillText(char, x, y);
      ctx.restore();

      x += width + spacingPx;
    });

    texture.needsUpdate = true;
  }, [text, fontSize, letterSpacing, fontWeight, canvas, texture]);

  return texture;
}

const chromeTextFragment = `
  uniform sampler2D tText;
  uniform float uTime;
  uniform float uEnergy;
  uniform float uSubBass;
  uniform float uBass;
  uniform float uLowMid;
  uniform float uMid;
  uniform float uHighMid;
  uniform float uTreble;
  uniform float uBeat;
  uniform float uFlux;
  uniform float uTransient;
  uniform float uGlow;
  varying vec2 vUv;

  vec4 textAt(vec2 uv) {
    if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return vec4(0.0);
    return texture2D(tText, uv);
  }

  float maskAt(vec2 uv) {
    vec4 tex = texture2D(tText, uv);
    return tex.a;
  }

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(41.3, 289.7))) * 43758.5453);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 2; i++) {
      v += noise(p) * a;
      p = mat2(1.62, -1.13, 1.13, 1.62) * p + 3.17;
      a *= 0.52;
    }
    return v;
  }

  vec2 liquidDisplace(vec2 uv, float id, float localMask) {
    vec2 p = uv - 0.5;
    float letterPhase = id * 19.73;
    float low = max(uSubBass, uBass);
    float midDrive = max(uMid, uLowMid);
    float high = max(uTreble, uHighMid);
    float breath = 1.0 + low * (0.018 + 0.018 * sin(letterPhase)) + uBeat * 0.012;
    p *= breath;

    float band = floor(uv.y * (34.0 + midDrive * 42.0));
    float bandGate = step(0.56 - midDrive * 0.24 - uFlux * 0.18, hash(vec2(band, floor(uTime * (15.0 + midDrive * 18.0)) + id * 31.0)));
    float bandShift = (hash(vec2(band * 1.7 + id * 11.0, floor(uTime * 18.0))) - 0.5)
      * (0.018 + midDrive * 0.09 + uTransient * 0.06)
      * bandGate;

    vec2 nUv = uv * vec2(6.0, 3.4) + vec2(id * 7.1, -id * 3.7);
    float flowA = noise(nUv + vec2(uTime * (0.08 + low * 0.1), -uTime * 0.05));
    float flowB = noise(nUv.yx * 1.35 + vec2(-uTime * 0.07, uTime * (0.06 + midDrive * 0.12)));
    vec2 flow = vec2(flowA - 0.5, flowB - 0.5) * (0.018 + low * 0.06 + midDrive * 0.04);

    float edgeBuzz = (hash(floor(uv * vec2(220.0, 96.0)) + floor(uTime * (34.0 + high * 64.0)) + id) - 0.5)
      * high * (0.012 + uTransient * 0.018);

    return p + 0.5 + flow + vec2(bandShift + edgeBuzz * localMask, edgeBuzz * 0.16);
  }

  void main() {
    vec2 uv = vUv;
    float fallbackId = fract(floor(uv.x * 18.0) * 0.071);
    float probeMask = maskAt(uv);
    float probeId = mix(fallbackId, textAt(uv).r, step(0.01, probeMask));
    vec2 warpedUv = liquidDisplace(uv, probeId, probeMask);

    vec4 tex = textAt(warpedUv);
    float id = mix(probeId, tex.r, step(0.01, tex.a));

    float px = 1.0 / 2048.0;
    float py = 1.0 / 1024.0;
    float split = (0.006 + uTreble * 0.034 + uHighMid * 0.026 + uTransient * 0.032) * (0.75 + uGlow * 0.05);
    float slice = floor(warpedUv.y * (42.0 + uMid * 54.0));
    float slicePhase = hash(vec2(slice + id * 17.0, floor(uTime * (20.0 + uFlux * 24.0))));
    float sliceKick = (slicePhase - 0.5) * (0.012 + uMid * 0.05 + uFlux * 0.05);
    vec2 redUv = warpedUv + vec2(split + sliceKick, 0.0);
    vec2 blueUv = warpedUv - vec2(split * 1.15 - sliceKick, 0.0);

    float m = tex.a;
    float rMask = textAt(redUv).a;
    float bMask = textAt(blueUv).a;

    float nearA = 0.0;
    nearA = max(nearA, maskAt(warpedUv + vec2(px * 8.0, 0.0)));
    nearA = max(nearA, maskAt(warpedUv - vec2(px * 8.0, 0.0)));
    nearA = max(nearA, maskAt(warpedUv + vec2(0.0, py * 8.0)));
    nearA = max(nearA, maskAt(warpedUv - vec2(0.0, py * 8.0)));
    nearA = max(nearA, maskAt(warpedUv + vec2(px * 18.0, py * 9.0)));
    nearA = max(nearA, maskAt(warpedUv - vec2(px * 18.0, py * 9.0)));

    float farA = 0.0;
    farA = max(farA, maskAt(warpedUv + vec2(px * 34.0, py * 18.0)));
    farA = max(farA, maskAt(warpedUv - vec2(px * 34.0, py * 18.0)));
    farA = max(farA, maskAt(warpedUv + vec2(px * 54.0, -py * 20.0)));

    float edge = clamp(nearA - m, 0.0, 1.0);
    float aura = clamp(farA - nearA, 0.0, 1.0);
    float alpha = clamp(m + edge * 0.96 + aura * (0.48 + uGlow * 0.03) + max(rMask, bMask) * 0.18, 0.0, 1.0);
    if (alpha < 0.01) discard;

    float n1 = fbm(warpedUv * 11.0 + vec2(uTime * (0.16 + uBass * 0.18), id * 6.0));
    float n2 = fbm(warpedUv * vec2(28.0, 10.0) - vec2(uTime * 0.22, -id * 4.2));
    float liquid = sin((warpedUv.x + n1 * 0.22 + id * 0.2) * (34.0 + uBass * 20.0) + uTime * (1.1 + uLowMid)) * 0.5 + 0.5;
    float contour = smoothstep(0.36, 0.92, abs(sin((warpedUv.x * 1.4 + warpedUv.y * 2.8 + n2 * 0.9 + id) * (15.0 + uMid * 8.0))));
    float bevel = clamp(
      maskAt(warpedUv - vec2(px * 10.0, -py * 10.0)) -
      maskAt(warpedUv + vec2(px * 10.0, -py * 10.0)),
      -1.0,
      1.0
    );
    float highlight = pow(max(0.0, 0.52 + bevel * 0.82 + liquid * 0.24), 3.2);
    float digitalCell = step(0.84 - uTreble * 0.18, hash(floor(warpedUv * vec2(118.0, 44.0)) + vec2(id * 41.0, floor(uTime * (10.0 + uTreble * 28.0)))));
    float digitalCut = smoothstep(0.11, 0.0, abs(fract(warpedUv.y * (24.0 + uMid * 36.0) + id * 4.0 - uTime * (0.8 + uFlux * 2.4)) - 0.5));
    float edgeSpark = step(0.92 - uTreble * 0.2 - uTransient * 0.24, hash(floor(warpedUv * vec2(360.0, 170.0)) + floor(uTime * 42.0) + id * 13.0));

    vec3 blackChrome = vec3(0.008, 0.009, 0.011);
    vec3 graphite = vec3(0.045, 0.048, 0.052);
    vec3 silver = vec3(0.58, 0.64, 0.66);
    vec3 whiteHot = vec3(0.98, 1.0, 1.0);
    vec3 redCore = vec3(1.0, 0.06, 0.0);
    vec3 ember = vec3(1.0, 0.38, 0.02);
    vec3 cyan = vec3(0.18, 0.92, 1.0);
    vec3 blue = vec3(0.0, 0.22, 1.0);

    vec3 metal = mix(graphite, silver, m * (0.26 + liquid * 0.34));
    metal = mix(metal, redCore, m * (0.52 + liquid * 0.32));
    metal = mix(metal, ember, m * contour * 0.28);
    metal = mix(metal, blackChrome, edge * (0.5 + n2 * 0.35));
    metal += whiteHot * highlight * m * (0.22 + uTreble * 0.2 + uBeat * 0.12);
    metal += cyan * edge * (0.62 + uTreble * 0.34 + digitalCut * 0.28);
    metal += cyan * aura * (0.32 + uGlow * 0.06 + uEnergy * 0.3);
    metal += whiteHot * digitalCell * m * (0.18 + uTreble * 0.32);
    metal += cyan * edgeSpark * edge * (0.28 + uTreble * 0.55);

    vec3 rgbSplit = redCore * max(0.0, rMask - m) * (0.9 + uTreble * 1.4)
      + blue * max(0.0, bMask - m) * (0.8 + uHighMid * 1.2)
      + cyan * max(rMask, bMask) * aura * 0.28;

    float scan = 0.92 + sin(vUv.y * 1180.0 + uTime * (12.0 + uTreble * 22.0)) * (0.035 + uTreble * 0.035);
    vec3 col = (metal + rgbSplit) * scan;
    col += vec3(hash(floor(vUv * vec2(900.0, 500.0)) + floor(uTime * 28.0)) - 0.5) * (0.012 + uTreble * 0.025);
    col = clamp(pow(max(col, vec3(0.0)), vec3(0.88)), vec3(0.0), vec3(1.35));

    gl_FragColor = vec4(col, alpha * 0.98);
  }
`;

// === CINEMATIC TYPOGRAPHY ===
function VisualText({ sceneOverride }: { sceneOverride?: string }) {
  const textRef = useRef<THREE.Mesh>(null);
  const chromeMatRef = useRef<THREE.ShaderMaterial>(null);
  const currentScene = useStore((state) => state.currentScene);
  const textInput = useStore((state) => state.textInput);
  const textAnimStyle = useStore((state) => state.textAnimStyle);
  const textGlow = useStore((state) => state.textGlow);
  const textSpeed = useStore((state) => state.textSpeed);
  const textReactive = useStore((state) => state.textReactive);
  const textColor = useStore((state) => state.textColor);
  const textFontSize = useStore((state) => state.textFontSize);
  const textLetterSpacing = useStore((state) => state.textLetterSpacing);
  const textFontWeight = useStore((state) => state.textFontWeight);
  const scene = sceneOverride || currentScene;

  const displayText = textInput.toUpperCase();
  const cleanTex = useCleanTextTexture(displayText, false, textFontSize, textLetterSpacing, textFontWeight);
  const darkSpaceTex = useDarkSpaceTextTexture(displayText, textFontSize, textLetterSpacing, textFontWeight);
  const tex = scene === 'Void' ? darkSpaceTex : cleanTex;

  useFrame((state) => {
    if(!textRef.current) return;
    const { subBass, bass, lowMid, mid, highMid, treble, beat, energy, spectralFlux, transient } = getReactiveAudio();
    const t = state.clock.elapsedTime * textSpeed;
    const react = bass * textReactive + (beat * 0.5 * textReactive);

    if (scene === 'Void') {
      textRef.current.scale.set(1.02, 1.0, 1);
      textRef.current.position.set(0, 0, 1.2);
      textRef.current.rotation.set(0, 0, 0);
      if (chromeMatRef.current) {
        chromeMatRef.current.uniforms.uTime.value = state.clock.elapsedTime;
        chromeMatRef.current.uniforms.uEnergy.value += (energy - chromeMatRef.current.uniforms.uEnergy.value) * 0.12;
        chromeMatRef.current.uniforms.uSubBass.value += (subBass - chromeMatRef.current.uniforms.uSubBass.value) * 0.12;
        chromeMatRef.current.uniforms.uBass.value = bass;
        chromeMatRef.current.uniforms.uLowMid.value += (lowMid - chromeMatRef.current.uniforms.uLowMid.value) * 0.14;
        chromeMatRef.current.uniforms.uMid.value += (mid - chromeMatRef.current.uniforms.uMid.value) * 0.16;
        chromeMatRef.current.uniforms.uHighMid.value += (highMid - chromeMatRef.current.uniforms.uHighMid.value) * 0.18;
        chromeMatRef.current.uniforms.uTreble.value = treble;
        chromeMatRef.current.uniforms.uBeat.value = beat;
        chromeMatRef.current.uniforms.uFlux.value += (spectralFlux - chromeMatRef.current.uniforms.uFlux.value) * 0.22;
        chromeMatRef.current.uniforms.uTransient.value += (transient - chromeMatRef.current.uniforms.uTransient.value) * 0.28;
        chromeMatRef.current.uniforms.uGlow.value = textGlow;
        chromeMatRef.current.uniforms.tText.value = tex;
      }
      return;
    }

    if(textAnimStyle === 'Cinematic') {
      textRef.current.scale.setScalar(1 + react * 0.2);
      textRef.current.position.y = Math.sin(t) * 0.2;
      textRef.current.rotation.set(0,0,0);
    } else if (textAnimStyle === 'Glitch') {
      textRef.current.scale.setScalar(1 + react * 0.34);
      textRef.current.rotation.set(0,0,0);
      textRef.current.position.x = Math.sin(t * 5.1) * react * 0.08 + Math.sin(t * 1.7) * beat * 0.05;
      textRef.current.position.y = Math.cos(t * 3.3) * react * 0.035;
    } else if (textAnimStyle === 'Beat') {
      textRef.current.scale.setScalar(1.5 + (react * 0.72) + (beat * 0.32));
      textRef.current.position.set(0, Math.sin(t * 1.4) * react * 0.08, 1 + bass * 0.72);
      textRef.current.rotation.z = Math.sin(t * 3.2) * 0.025 * beat;
    } else if (textAnimStyle === 'Floating') {
      textRef.current.rotation.z = Math.sin(t * 0.5) * 0.1;
      textRef.current.position.y = Math.sin(t) * 0.5;
      textRef.current.scale.setScalar(1 + (react * 0.1));
    } else if (textAnimStyle === 'Massive') {
      textRef.current.scale.setScalar(4 + react * 2.5);
      textRef.current.position.z = -2 + (beat * 2.0);
      textRef.current.rotation.set(0,0,0);
    } else {
      textRef.current.scale.setScalar(1 + react * 0.5);
    }
    
    // Adjust material properties dynamically if needed
    const mat = textRef.current.material as THREE.MeshBasicMaterial;
    if(mat && mat.color) {
       mat.color.set(textColor);
       mat.color.multiplyScalar(Math.min(1.35, 0.82 + textGlow * 0.16 + beat * 0.24));
    }
  });

  if(!textInput.trim() || scene === 'Void' || scene === 'Dumbar' || scene === 'Topology' || scene === 'Pulse') return null;

  if (scene === 'Void') {
    return (
      <mesh ref={textRef} position={[0, 0, 1.2]}>
        <planeGeometry args={[20.5, 8.2]} />
        <shaderMaterial
          ref={chromeMatRef}
          vertexShader="varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }"
          fragmentShader={chromeTextFragment}
          uniforms={{
            tText: { value: tex },
            uTime: { value: 0 },
            uEnergy: { value: 0 },
            uSubBass: { value: 0 },
            uBass: { value: 0 },
            uLowMid: { value: 0 },
            uMid: { value: 0 },
            uHighMid: { value: 0 },
            uTreble: { value: 0 },
            uBeat: { value: 0 },
            uFlux: { value: 0 },
            uTransient: { value: 0 },
            uGlow: { value: textGlow },
          }}
          transparent
          depthWrite={false}
          blending={THREE.NormalBlending}
        />
      </mesh>
    );
  }

  return (
    <mesh ref={textRef} position={[0, 0, 2.2]} renderOrder={60}>
      <planeGeometry args={[20, 10]} />
      <meshBasicMaterial 
        map={tex} 
        color={textColor}
        transparent 
        opacity={0.92} 
        depthWrite={false}
        depthTest={false}
        blending={scene === 'Pulse' || scene === 'Cyber' ? THREE.AdditiveBlending : THREE.NormalBlending}
      />
    </mesh>
  );
}

// === HIGH-END POST PROCESSING ===
function PostProcessing({ reduced = false }: { reduced?: boolean }) {
  const audioDriveMode = useStore((state) => state.audioDriveMode);
  const audioFxReactive = useStore((state) => state.audioFxReactive);
  const autoVjEnabled = useStore((state) => state.autoVjEnabled);
  const bloomIntensity = useStore((state) => state.bloomIntensity);
  const rgbSplitAmount = useStore((state) => state.rgbSplitAmount);
  const distortion = useStore((state) => state.distortion);
  const glitchActive = useStore((state) => state.glitchActive);
  const currentScene = useStore((state) => state.currentScene);
  const [dynamicBloom, setDynamicBloom] = useState(bloomIntensity);
  const [dynamicSplit, setDynamicSplit] = useState(rgbSplitAmount);
  const [dynamicDistortion, setDynamicDistortion] = useState(distortion);
  const [dynamicGlitch, setDynamicGlitch] = useState(false);
  const lastUpdateRef = useRef(0);
  const dynamicRef = useRef({ bloom: bloomIntensity, split: rgbSplitAmount, distortion, glitch: false });
  const renderedRef = useRef({ bloom: bloomIntensity, split: rgbSplitAmount, distortion, glitch: false });
  const chromaticOffset = useMemo(() => new THREE.Vector2(), []);

  useFrame((state) => {
    const now = state.clock.elapsedTime;
    if (now - lastUpdateRef.current < 1 / (reduced ? 12 : 20)) return;
    lastUpdateRef.current = now;

    const { energy, beat, bass, subBass, mid, treble, highMid, spectralFlux, transient, spectralCentroid, dynamicRange } = getAudioDriveSnapshot(audioDriveMode);
    const isDarkSpace = currentScene === 'Void';
    const isNeonPulse = currentScene === 'Pulse';
    const morph = autoVjEnabled && audioFxReactive ? 1 : 0;
    
    const pulseBloom = 0.85 + (energy * 0.24 + beat * 0.36 + transient * 0.22) * morph;
    const darkBloom = 0.45 + (energy * 0.18 + beat * 0.22 + treble * 0.16 + transient * 0.2) * morph;
    const targetBloom = isDarkSpace ? darkBloom : isNeonPulse ? pulseBloom : Math.min(
      1.18,
      bloomIntensity * 0.52 + (energy * 0.08 + beat * 0.08 + treble * 0.05 + spectralFlux * 0.055 + transient * 0.05) * morph
    );
    const pulseSplit = 0.0025 + (beat * 0.002 + spectralFlux * 0.002) * morph;
    const targetSplit = isDarkSpace ? 0 : isNeonPulse ? pulseSplit : Math.min(
      0.006,
      rgbSplitAmount * 0.45 + (bass * 0.0008 + subBass * 0.0007 + beat * 0.0008 + highMid * 0.0009 + spectralCentroid * 0.001 + spectralFlux * 0.001) * morph
    );
    const targetDistortion = isDarkSpace ? 0 : Math.min(
      0.11,
      distortion * 0.7 + (subBass * 0.035 + bass * 0.024 + mid * 0.022 + dynamicRange * 0.03 + spectralFlux * 0.03 + beat * 0.022) * morph
    );
    const targetGlitch = !isDarkSpace && glitchActive;

    const next = {
      bloom: dynamicRef.current.bloom + (targetBloom - dynamicRef.current.bloom) * (reduced ? 0.16 : 0.1),
      split: dynamicRef.current.split + (targetSplit - dynamicRef.current.split) * (reduced ? 0.28 : 0.2),
      distortion: dynamicRef.current.distortion + (targetDistortion - dynamicRef.current.distortion) * (reduced ? 0.2 : 0.16),
      glitch: reduced ? false : targetGlitch,
    };

    if (Math.abs(next.bloom - renderedRef.current.bloom) > 0.012) {
      renderedRef.current.bloom = next.bloom;
      setDynamicBloom(next.bloom);
    }
    if (Math.abs(next.split - renderedRef.current.split) > 0.00012) {
      renderedRef.current.split = next.split;
      setDynamicSplit(next.split);
    }
    if (Math.abs(next.distortion - renderedRef.current.distortion) > 0.003) {
      renderedRef.current.distortion = next.distortion;
      setDynamicDistortion(next.distortion);
    }
    if (next.glitch !== renderedRef.current.glitch) {
      renderedRef.current.glitch = next.glitch;
      setDynamicGlitch(next.glitch);
    }
    dynamicRef.current = next;
  });

  chromaticOffset.set(
    reduced ? dynamicSplit * 0.45 : dynamicSplit * 0.58,
    reduced ? dynamicSplit * 0.45 : dynamicSplit * 0.58
  );

  return (
    <EffectComposer multisampling={0}>
      {currentScene !== 'Void' && !reduced && (
        <Bloom 
          luminanceThreshold={0.58} 
          luminanceSmoothing={0.96} 
          intensity={dynamicBloom * 0.72} 
          mipmapBlur
        />
      )}
      {dynamicGlitch && (
        <Glitch 
          delay={new THREE.Vector2(0.15, 0.8)} 
          duration={new THREE.Vector2(0.06, 0.22)} 
          strength={new THREE.Vector2(0.18 + dynamicDistortion * 0.3, 0.55 + dynamicDistortion * 0.6)} 
          mode={GlitchMode.SPORADIC}
          ratio={0.85}
        />
      )}
      <ChromaticAberration offset={chromaticOffset} />
    </EffectComposer>
  );
}

function MusicCameraRig() {
  const { camera } = useThree();
  const audioDriveMode = useStore((state) => state.audioDriveMode);
  const currentScene = useStore((state) => state.currentScene);
  const musicCameraEnabled = useStore((state) => state.musicCameraEnabled);
  const speed = useStore((state) => state.speed);
  const chaos = useStore((state) => state.chaos);
  const lookTarget = useMemo(() => new THREE.Vector3(), []);
  const targetPosition = useMemo(() => new THREE.Vector3(0, 0, 5), []);

  useFrame((state) => {
    if (currentScene === 'Pulse') {
      camera.position.lerp(targetPosition.set(0, 0, 5), 0.16);
      camera.lookAt(0, 0, 0);
      if (camera instanceof THREE.PerspectiveCamera) {
        camera.fov += (60 - camera.fov) * 0.12;
        camera.updateProjectionMatrix();
      }
      return;
    }

    const { bass, subBass, mid, treble, beat, energy } = getAudioDriveSnapshot(audioDriveMode);
    const amount = musicCameraEnabled ? 0.8 : 0;
    const time = state.clock.elapsedTime * (0.2 + speed * 0.18);
    const orbit = time + bass * 1.8 * amount + treble * 0.8 * amount;
    const radius = 5 + subBass * 2.8 * amount + beat * 0.9 * amount;
    const lift = Math.sin(time * 1.7) * (0.35 + mid * 1.2) * amount;

    targetPosition.set(
      Math.sin(orbit) * (0.35 + chaos * 0.22) * amount,
      lift,
      radius + Math.cos(orbit * 0.7) * 0.75 * amount
    );

    camera.position.lerp(targetPosition, 0.055);
    lookTarget.set(
      Math.sin(time * 1.3) * treble * 0.55 * amount,
      Math.cos(time * 1.1) * mid * 0.45 * amount,
      beat * 0.18 * amount
    );
    camera.lookAt(lookTarget);

    if (camera instanceof THREE.PerspectiveCamera) {
      const nextFov = 60 + energy * 8 * amount + beat * 4 * amount;
      camera.fov += (nextFov - camera.fov) * 0.08;
      camera.updateProjectionMatrix();
    }
  });

  return null;
}

function AudioMorphTone() {
  const { scene } = useThree();
  const audioDriveMode = useStore((state) => state.audioDriveMode);
  const autoVjEnabled = useStore((state) => state.autoVjEnabled);
  const bgColor = useStore((state) => state.bgColor);
  const baseColor = useStore((state) => state.baseColor);
  const secondaryColor = useStore((state) => state.secondaryColor);
  const currentScene = useStore((state) => state.currentScene);
  const quietColor = useMemo(() => new THREE.Color(), []);
  const pulseColor = useMemo(() => new THREE.Color(), []);
  const targetColor = useMemo(() => new THREE.Color(), []);

  useFrame(() => {
    if (currentScene === 'Void') {
      scene.background = quietColor.set('#000000').clone();
      return;
    }

    quietColor.set(bgColor);

    if (!autoVjEnabled) {
      scene.background = quietColor;
      return;
    }

    const { bass, treble, energy, beat } = getAudioDriveSnapshot(audioDriveMode);
    pulseColor.set(treble > bass ? secondaryColor : baseColor);
    targetColor.copy(quietColor).lerp(pulseColor, Math.min(0.11, energy * 0.045 + beat * 0.022));
    scene.background = targetColor.clone();
  });

  return null;
}

function PulseEnergyOverlay({ sceneOverride }: { sceneOverride?: string }) {
  const currentScene = useStore((state) => state.currentScene);
  const textInput = useStore((state) => state.textInput);
  const textAnimStyle = useStore((state) => state.textAnimStyle);
  const textFontSize = useStore((state) => state.textFontSize);
  const textFontWeight = useStore((state) => state.textFontWeight);
  const textLetterSpacing = useStore((state) => state.textLetterSpacing);
  const textGlow = useStore((state) => state.textGlow);
  const textSpeed = useStore((state) => state.textSpeed);
  const textColor = useStore((state) => state.textColor);
  const scene = sceneOverride || currentScene;
  if (scene !== 'Pulse') return null;

  const trimmedText = textInput.trim();
  if (!trimmedText) return null;

  const displayText = trimmedText.toUpperCase();
  const normalizedStyle = ['Cinematic', 'Massive', 'Glitch', 'Hologram', 'Floating', 'Beat'].includes(textAnimStyle)
    ? textAnimStyle.toLowerCase()
    : 'glitch';
  const textLengthScale = Math.max(0.72, Math.min(1, 5 / Math.max(displayText.length, 1)));
  const titleStyle = {
    '--pulse-title-size': `${Math.max(36, Math.min(224, textFontSize * 30 * textLengthScale))}px`,
    '--pulse-title-weight': textFontWeight,
    '--pulse-title-spacing': `${textLetterSpacing}em`,
    '--pulse-title-speed': `${Math.max(0.35, 1.45 / Math.max(textSpeed, 0.2))}s`,
    '--pulse-title-glow': `${Math.max(10, Math.min(72, 12 + textGlow * 11))}px`,
    '--pulse-title-color': textColor,
  } as React.CSSProperties;

  const fragments = Array.from({ length: 22 }, (_, index) => {
    const style = {
      '--x': `${(index * 37) % 100}%`,
      '--y': `${22 + ((index * 19) % 52)}%`,
      '--w': `${24 + ((index * 13) % 86)}px`,
      '--d': `${(index % 7) * -0.31}s`,
      '--a': `${-14 + ((index * 23) % 28)}deg`,
    } as React.CSSProperties;

    return <i key={index} className="pulse-energy-fragment" style={style} />;
  });

  const plates = Array.from({ length: 9 }, (_, index) => {
    const style = {
      '--px': `${8 + ((index * 23) % 82)}%`,
      '--py': `${34 + ((index * 17) % 30)}%`,
      '--pw': `${42 + ((index * 29) % 118)}px`,
      '--ph': `${16 + ((index * 11) % 44)}px`,
      '--pa': `${-22 + ((index * 31) % 44)}deg`,
      '--pd': `${(index % 5) * -0.37}s`,
    } as React.CSSProperties;

    return <i key={index} className="pulse-energy-plate" style={style} />;
  });

  const trails = Array.from({ length: 8 }, (_, index) => {
    const style = {
      '--ty': `${26 + index * 6}%`,
      '--td': `${index * -0.42}s`,
      '--tw': `${34 + ((index * 17) % 42)}%`,
    } as React.CSSProperties;

    return <i key={index} className="pulse-energy-trail" style={style} />;
  });

  return (
    <div className="pulse-energy-overlay" aria-hidden="true">
      <div className="pulse-energy-haze" />
      <div className="pulse-energy-band" />
      {trails}
      {plates}
      {fragments}
      <div
        className={`pulse-energy-title pulse-energy-title--${normalizedStyle}`}
        data-text={displayText}
        style={titleStyle}
      >
        <span>{displayText}</span>
      </div>
      <div className="pulse-energy-scan" />
      <div className="pulse-energy-noise" />
    </div>
  );
}

function DarkSpaceTextOverlay({ sceneOverride }: { sceneOverride?: string }) {
  const currentScene = useStore((state) => state.currentScene);
  const textInput = useStore((state) => state.textInput);
  const textFontSize = useStore((state) => state.textFontSize);
  const textFontWeight = useStore((state) => state.textFontWeight);
  const textLetterSpacing = useStore((state) => state.textLetterSpacing);
  const textGlow = useStore((state) => state.textGlow);
  const textSpeed = useStore((state) => state.textSpeed);
  const scene = sceneOverride || currentScene;
  const rootRef = useRef<HTMLDivElement>(null);
  const displayText = textInput.trim().toUpperCase();
  const characters = Array.from(displayText);
  const slices = [0, 1, 2, 3, 4, 5, 6];
  const particles = Array.from({ length: 34 }, (_, index) => index);
  const tears = Array.from({ length: 9 }, (_, index) => index);
  const motionRef = useRef({
    burst: 0,
    shock: 0,
    tear: 0,
    lastHit: 0,
    focus: 0.5,
    direction: 1,
  });

  useEffect(() => {
    let frame = 0;
    const tick = () => {
      const root = rootRef.current;
      if (root) {
        const { subBass, bass, lowMid, mid, highMid, treble, beat, energy, spectralFlux, transient } = getReactiveAudio();
        const now = performance.now() / 1000;
        const motion = motionRef.current;
        const attack = Math.max(beat * 1.5, transient * 1.35, spectralFlux * 1.05, bass * 0.68, highMid * 0.48);
        const unstableIdleHit = now - motion.lastHit > 0.72 && Math.random() > 0.982;
        const triggerWindow = 0.12 + Math.random() * 0.12;
        if ((attack > 0.32 || unstableIdleHit || (spectralFlux > 0.22 && Math.random() > 0.88)) && now - motion.lastHit > triggerWindow) {
          const hit = Math.min(1.8, Math.max(attack, unstableIdleHit ? 0.34 + Math.random() * 0.38 : 0) + Math.random() * 0.62);
          motion.burst = Math.max(motion.burst, hit);
          motion.shock = Math.max(motion.shock, hit * (0.72 + Math.random() * 0.42));
          motion.tear = Math.max(motion.tear, hit * (0.8 + Math.random() * 0.55));
          motion.focus = Math.random();
          motion.direction = Math.random() > 0.5 ? 1 : -1;
          motion.lastHit = now;
        }
        motion.burst *= 0.82;
        motion.shock *= 0.74;
        motion.tear *= 0.78;

        const burst = motion.burst;
        const shock = motion.shock;
        const tear = motion.tear;
        const liveEnergy = Math.max(0.08, energy, bass * 0.55, spectralFlux * 0.52);
        const drift = Math.sin(now * 0.23) * 0.5 + Math.sin(now * 0.41 + 1.7) * 0.5;
        const twitch = Math.sin(now * 18.0 + motion.focus * 9.0) * shock;

        root.style.setProperty('--ds-time', now.toFixed(3));
        root.style.setProperty('--ds-sub', subBass.toFixed(3));
        root.style.setProperty('--ds-bass', bass.toFixed(3));
        root.style.setProperty('--ds-lowmid', lowMid.toFixed(3));
        root.style.setProperty('--ds-mid', mid.toFixed(3));
        root.style.setProperty('--ds-highmid', highMid.toFixed(3));
        root.style.setProperty('--ds-treble', treble.toFixed(3));
        root.style.setProperty('--ds-beat', beat.toFixed(3));
        root.style.setProperty('--ds-energy', energy.toFixed(3));
        root.style.setProperty('--ds-flux', spectralFlux.toFixed(3));
        root.style.setProperty('--ds-transient', transient.toFixed(3));
        root.style.setProperty('--ds-burst', burst.toFixed(3));
        root.style.setProperty('--ds-shock', shock.toFixed(3));
        root.style.setProperty('--ds-tear', tear.toFixed(3));

        const word = root.querySelector<HTMLElement>('.dark-space-word');
        if (word) {
          const jumpX = drift * 18 + twitch * 34 + motion.direction * burst * 58;
          const jumpY = Math.sin(now * 0.31 + 2.6) * 10 * liveEnergy - burst * 28 + shock * 46;
          const scaleX = 1 + bass * 0.09 + beat * 0.05 + burst * 0.24;
          const scaleY = 1 + subBass * 0.07 + shock * 0.18 - tear * 0.035;
          const skew = -9 - lowMid * 16 + motion.direction * shock * 18 + Math.sin(now * 1.7) * 4 * liveEnergy;
          const rotate = motion.direction * shock * 2.8 + drift * 1.4;
          word.style.transform = `translate3d(${jumpX.toFixed(2)}px, ${jumpY.toFixed(2)}px, 0) scale(${scaleX.toFixed(3)}, ${scaleY.toFixed(3)}) skewX(${skew.toFixed(2)}deg) rotate(${rotate.toFixed(2)}deg)`;
          word.style.filter = `contrast(${1.35 + energy * 0.7 + burst * 0.7}) saturate(${1.28 + treble * 1.6 + shock * 0.7}) brightness(${1 + burst * 0.42 + shock * 0.35}) drop-shadow(0 0 ${22 + textGlow * 12 + burst * 42}px rgba(36,230,255,0.78)) drop-shadow(0 0 ${18 + textGlow * 10 + shock * 52}px rgba(255,20,0,0.9))`;
        }

        root.querySelectorAll<HTMLElement>('.dark-space-char').forEach((element) => {
          const index = Number(element.dataset.index || 0);
          const seed = Number(element.dataset.seed || 0);
          const region = characters.length <= 1 ? 0.5 : index / (characters.length - 1);
          const centerPull = 1 - Math.min(1, Math.abs(region - motion.focus) * 2.8);
          const leftDrift = (1 - region) * (Math.sin(now * (0.33 + seed * 0.12) + index) * 34 * (0.3 + bass));
          const centerTwitch = centerPull * (Math.sin(now * (19 + seed * 11) + index * 3.7) * (58 * mid + 120 * shock));
          const rightBuzz = region * (Math.sin(now * (42 + seed * 28)) * (22 * highMid + 42 * treble));
          const explosion = (region - motion.focus) * (burst * 260 + transient * 90);
          const dx = leftDrift + centerTwitch + rightBuzz + explosion + motion.direction * tear * (seed - 0.5) * 170;
          const dy = Math.cos(now * (0.8 + seed) + index) * bass * 24 + Math.sin(now * (11 + seed * 6)) * highMid * 22 + (seed - 0.5) * burst * 130;
          const sx = 1 + shock * centerPull * 0.42 + spectralFlux * seed * 0.16;
          const sy = 1 + subBass * (0.08 + seed * 0.08) + burst * (0.06 + centerPull * 0.18);
          const skew = (seed - 0.5) * mid * 38 + motion.direction * tear * centerPull * 34;
          const rotate = (seed - 0.5) * shock * 16 + Math.sin(now * 4.2 + index) * spectralFlux * 8;
          element.style.transform = `translate3d(${dx.toFixed(2)}px, ${dy.toFixed(2)}px, 0) scale(${sx.toFixed(3)}, ${sy.toFixed(3)}) skewX(${skew.toFixed(2)}deg) rotate(${rotate.toFixed(2)}deg)`;
        });

        root.querySelectorAll<HTMLElement>('.dark-space-slice').forEach((element) => {
          const sliceIndex = Number(element.dataset.slice || 0);
          const seed = Number(element.dataset.seed || 0);
          const row = sliceIndex - 3;
          const snap = Math.sin(now * (9 + seed * 21) + row * 1.9);
          const tearPush = row * tear * 36 + (seed - 0.5) * (mid * 170 + transient * 220 + shock * 260);
          const dx = tearPush + snap * (spectralFlux * 90 + highMid * 58) + motion.direction * burst * row * 34;
          const dy = Math.cos(now * (7 + seed * 13) + sliceIndex) * (treble * 10 + shock * 18);
          const skew = (seed - 0.5) * 54 * Math.max(mid, highMid) + row * shock * 5;
          const scaleX = 1 + Math.abs(row) * tear * 0.12 + spectralFlux * 0.35;
          element.style.transform = `translate3d(${dx.toFixed(2)}px, ${dy.toFixed(2)}px, 0) skewX(${skew.toFixed(2)}deg) scaleX(${scaleX.toFixed(3)})`;
          element.style.opacity = String(Math.min(1, 0.16 + mid * 0.8 + spectralFlux * 0.72 + transient * 0.42 + shock * 0.5));
        });

        root.querySelectorAll<HTMLElement>('.dark-space-char-red').forEach((element) => {
          element.style.transform = `translate3d(${-8 - treble * 52 - transient * 44 - shock * 64}px, ${motion.direction * shock * 10}px, 0)`;
          element.style.opacity = String(Math.min(1, 0.28 + treble * 0.95 + transient * 0.9 + shock * 0.65));
        });

        root.querySelectorAll<HTMLElement>('.dark-space-char-blue').forEach((element) => {
          element.style.transform = `translate3d(${8 + highMid * 48 + treble * 36 + shock * 56}px, ${-motion.direction * shock * 12}px, 0)`;
          element.style.opacity = String(Math.min(1, 0.26 + treble * 0.88 + highMid * 0.62 + shock * 0.58));
        });

        root.querySelectorAll<HTMLElement>('.dark-space-tear').forEach((element) => {
          const index = Number(element.dataset.index || 0);
          const seed = Number(element.dataset.seed || 0);
          const y = 14 + ((index * 11 + Math.floor(now * (2 + seed * 5))) % 72);
          const x = -20 + seed * 58 + Math.sin(now * (0.7 + seed) + index) * 10;
          const width = 22 + seed * 42 + tear * 32;
          element.style.top = `${y}%`;
          element.style.left = `${x}%`;
          element.style.width = `${width}%`;
          element.style.opacity = String(Math.min(0.9, tear * (0.18 + seed * 0.72) + spectralFlux * 0.22));
          element.style.transform = `translateX(${motion.direction * tear * (80 + seed * 180)}px) skewX(${-18 + seed * 36}deg)`;
        });

        root.querySelectorAll<HTMLElement>('.dark-space-particle').forEach((element) => {
          const index = Number(element.dataset.index || 0);
          const seed = Number(element.dataset.seed || 0);
          const angle = seed * Math.PI * 2 + now * (0.4 + seed);
          const radius = 18 + seed * 42 + burst * 280 + spectralFlux * 80;
          const x = Math.cos(angle) * radius + Math.sin(now * (2.0 + seed)) * highMid * 60;
          const y = Math.sin(angle * 0.8 + index) * radius * 0.42 + Math.cos(now * (3.1 + seed)) * bass * 44;
          const scale = 0.35 + seed * 0.9 + burst * 1.4;
          element.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0) scale(${scale.toFixed(2)})`;
          element.style.opacity = String(Math.min(0.82, 0.05 + burst * 0.52 + spectralFlux * 0.28 + treble * seed * 0.22));
        });
      }
      frame = requestAnimationFrame(tick);
    };

    tick();
    return () => cancelAnimationFrame(frame);
  }, [characters.length, textGlow]);

  const textLengthScale = Math.max(0.46, Math.min(1, 8 / Math.max(characters.length, 1)));
  const titleStyle = {
    '--ds-size': `${Math.max(58, Math.min(220, textFontSize * 34 * textLengthScale))}px`,
    '--ds-weight': textFontWeight,
    '--ds-spacing': `${textLetterSpacing}em`,
    '--ds-glow': `${Math.max(12, Math.min(86, 18 + textGlow * 11))}px`,
    '--ds-speed': Math.max(0.35, textSpeed),
  } as React.CSSProperties;

  if (scene !== 'Void' || !displayText) return null;

  return (
    <div ref={rootRef} className="dark-space-typography" style={titleStyle} aria-hidden="true">
      <div className="dark-space-word">
        {characters.map((char, charIndex) => {
          const charStyle = {
            '--char-index': charIndex,
            '--char-seed': ((charIndex * 37) % 19) / 19,
          } as React.CSSProperties;

          return (
            <span
              key={`${char}-${charIndex}`}
              className="dark-space-char"
              data-char={char}
              data-index={charIndex}
              data-seed={((charIndex * 37) % 19) / 19}
              style={charStyle}
            >
              {slices.map((sliceIndex) => {
                const sliceStyle = {
                  '--slice-index': sliceIndex,
                  '--slice-top': `${sliceIndex * (100 / slices.length)}%`,
                  '--slice-bottom': `${100 - (sliceIndex + 1) * (100 / slices.length)}%`,
                  '--slice-seed': ((sliceIndex * 23 + charIndex * 11) % 17) / 17,
                } as React.CSSProperties;

                return (
                  <span
                    key={sliceIndex}
                    className="dark-space-slice"
                    data-slice={sliceIndex}
                    data-seed={((sliceIndex * 23 + charIndex * 11) % 17) / 17}
                    style={sliceStyle}
                  >
                    {char}
                  </span>
                );
              })}
              <span className="dark-space-char-core">{char}</span>
              <span className="dark-space-char-red">{char}</span>
              <span className="dark-space-char-blue">{char}</span>
            </span>
          );
        })}
      </div>
      <div className="dark-space-tear-field">
        {tears.map((index) => (
          <i
            key={index}
            className="dark-space-tear"
            data-index={index}
            data-seed={((index * 29) % 23) / 23}
          />
        ))}
      </div>
      <div className="dark-space-particle-field">
        {particles.map((index) => (
          <i
            key={index}
            className="dark-space-particle"
            data-index={index}
            data-seed={((index * 41) % 31) / 31}
          />
        ))}
      </div>
      <div className="dark-space-scan" />
      <div className="dark-space-noise" />
    </div>
  );
}

function VisualizerInner({ screenIdOverride }: { screenIdOverride?: string } = {}) {
  const activeScreenId = useStore((state) => state.activeScreenId);
  const audioDriveMode = useStore((state) => state.audioDriveMode);
  const autoVjEnabled = useStore((state) => state.autoVjEnabled);
  const bgColor = useStore((state) => state.bgColor);
  const brightness = useStore((state) => state.brightness);
  const contrast = useStore((state) => state.contrast);
  const currentScene = useStore((state) => state.currentScene);
  const outputMode = useStore((state) => state.outputMode);
  const saturation = useStore((state) => state.saturation);
  const screenTransitionStyle = useStore((state) => state.screenTransitionStyle);
  const syncedScreenSignal = useStore((state) => state.syncedScreenSignal);
  const visualScreens = useStore((state) => state.visualScreens);
  const containerRef = useRef<HTMLDivElement>(null);
  const isScreenOutput = Boolean(screenIdOverride);
  const effectiveScreenId = screenIdOverride || activeScreenId;
  const activeScreen = visualScreens.find((screen) => screen.id === effectiveScreenId) || visualScreens[0];
  const sceneOverride = isScreenOutput
    ? (outputMode === 'mirror' ? currentScene : activeScreen?.scene)
    : currentScene;
  const visualModule = getVisualModule(sceneOverride);
  const effectiveScene = visualModule?.id ?? sceneOverride;
  const displaySignal = syncedScreenSignal;
  const canvasDpr = useMemo<[number, number]>(() => {
    const pixelRatio = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1;
    return isScreenOutput ? [0.7, Math.min(1, pixelRatio)] : [0.9, Math.min(1.5, Math.max(1, pixelRatio))];
  }, [isScreenOutput]);
  const deviceAspectClass = activeScreen?.device === 'phone'
    ? 'inset-x-[36%] inset-y-[8%]'
    : activeScreen?.device === 'tablet'
      ? 'inset-x-[20%] inset-y-[10%]'
      : activeScreen?.device === 'projector'
        ? 'inset-x-[8%] inset-y-[12%]'
        : 'inset-4';

  useEffect(() => {
    let frame = 0;
    let lastUpdate = 0;
    let lastFilter = '';
    const updateFilter = () => {
      const now = performance.now();
      if (containerRef.current && now - lastUpdate >= 50) {
        lastUpdate = now;
        let audioContrast = 0;
        let audioBrightness = 0;
        let audioSaturation = 0;

        if (autoVjEnabled) {
          const audio = getAudioDriveSnapshot(audioDriveMode);
          const music = getMusicDriveFrame(audioDriveMode);
          const sceneModule = getVisualModule(sceneOverride);
          const moduleAudio = sceneModule?.mapAudioToVisualState(audio, music);
          const moduleLive = sceneModule?.mapLiveControlsToParams(useStore.getState().liveControls);
          const energyDrive = moduleAudio?.energy ?? audio.energy;
          const beatDrive = moduleAudio?.beat ?? audio.beat;
          const bassDrive = moduleAudio?.bass ?? audio.bass;
          const trebleDrive = moduleAudio?.treble ?? audio.treble;
          const transientDrive = moduleAudio?.transient ?? audio.transient;
          const impact = moduleLive?.impact ?? 1;
          const punch = moduleLive?.punch ?? 1;
          const saturationLift = moduleLive ? Math.max(0, moduleLive.saturation - 1) * 0.035 : audio.spectralCentroid * 0.044;
          audioContrast = Math.min(0.1, energyDrive * 0.032 * impact + beatDrive * 0.014 * punch + audio.spectralFlux * 0.022);
          audioBrightness = Math.min(0.045, bassDrive * 0.012 * impact + beatDrive * 0.008 * punch + transientDrive * 0.012);
          audioSaturation = Math.min(0.2, trebleDrive * 0.06 + energyDrive * 0.032 + saturationLift);
        }

        const nextFilter = `contrast(${(contrast + audioContrast).toFixed(4)}) brightness(${(brightness + audioBrightness).toFixed(4)}) saturate(${(saturation + audioSaturation).toFixed(4)})`;
        if (nextFilter !== lastFilter) {
          lastFilter = nextFilter;
          containerRef.current.style.filter = nextFilter;
        }
      }
      frame = requestAnimationFrame(updateFilter);
    };

    updateFilter();
    return () => cancelAnimationFrame(frame);
  }, [audioDriveMode, autoVjEnabled, brightness, contrast, saturation, sceneOverride]);
  
  return (
    <div 
      ref={containerRef}
      className="absolute inset-0 h-full min-h-0 w-full overflow-hidden"
      style={{ filter: `contrast(${contrast}) brightness(${brightness}) saturate(${saturation})` }}
    >
      {effectiveScene === 'Video Flow' ? (
        <VideoFlowScene />
      ) : effectiveScene === 'Layered Stage' ? (
        <LayeredStageScene />
      ) : effectiveScene === 'Blue Font' ? (
        <BlueFontScene />
      ) : effectiveScene === 'Purple' ? (
        <PurpleScene />
      ) : (
        <Canvas
          className="screen-canvas !absolute !inset-0 !h-full !w-full"
          style={{ width: '100%', height: '100%' }}
          camera={{ position: [0, 0, 5], fov: 60 }}
          dpr={canvasDpr}
          gl={{ antialias: !isScreenOutput, alpha: false, powerPreference: 'high-performance' }}
          onCreated={({ gl }) => {
            gl.toneMapping = THREE.ACESFilmicToneMapping;
            gl.toneMappingExposure = 0.82;
          }}
        >
          <color attach="background" args={[bgColor]} />
          <AudioMorphTone />
          <MusicCameraRig />
          <SceneRouter sceneOverride={effectiveScene} />
          <AudioMutationOverlay sceneOverride={effectiveScene} />
          <PostProcessing reduced={isScreenOutput} />
        </Canvas>
      )}
      {isScreenOutput && !activeScreen?.enabled && (
        <div className="absolute inset-0 z-20 bg-black/70" />
      )}
      {isScreenOutput && (
        <div className="pointer-events-none absolute inset-0 z-30">
          <div
            className={`absolute ${deviceAspectClass} rounded-lg border transition-all duration-150 ${
              screenTransitionStyle === 'strobe' && displaySignal > 0.55
                ? 'border-white bg-white/10'
                : 'border-cyan-300/55'
            }`}
            style={{
              boxShadow: `0 0 ${18 + displaySignal * 72}px rgba(103,232,249,${0.12 + displaySignal * 0.22}) inset, 0 0 ${12 + displaySignal * 48}px rgba(103,232,249,${0.12 + displaySignal * 0.18})`,
              opacity: screenTransitionStyle === 'cut' ? 1 : 0.58 + displaySignal * 0.34,
              transform: screenTransitionStyle === 'scan' ? `translateX(${Math.sin(displaySignal * Math.PI * 2) * 8}px)` : undefined,
            }}
          >
            <div
              className="absolute left-0 top-0 h-full w-full rounded-lg"
              style={{
                background: screenTransitionStyle === 'scan'
                  ? `linear-gradient(90deg, transparent ${Math.max(0, displaySignal * 100 - 12)}%, rgba(103,232,249,0.28) ${displaySignal * 100}%, transparent ${Math.min(100, displaySignal * 100 + 12)}%)`
                  : screenTransitionStyle === 'crossfade'
                    ? `rgba(103,232,249,${displaySignal * 0.08})`
                    : 'transparent',
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export const Visualizer = React.memo(VisualizerInner);
