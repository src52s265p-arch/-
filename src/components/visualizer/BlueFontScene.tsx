/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { getAudioDriveSnapshot, type AudioDriveMode } from '@/lib/audioDrive';
import { useStore } from '@/store/useStore';

interface VisualSettings {
  text: string;
  fontFamily: string;
  fontWeight: string;
  fontSize: number;
  distortion: number;
  flowSpeed: number;
  glowIntensity: number;
  colorPreset: 'cyber' | 'toxic' | 'solar' | 'deepspace';
  backgroundColor: string;
  motionBlur: number;
  noiseScale: number;
  enableBeatGlitches: boolean;
}

interface AudioAnalysis {
  volume: number;
  bass: number;
  mid: number;
  high: number;
  beatIntensity: number;
}

// WebGL shaders as raw strings
const VERTEX_SHADER_SRC = `#version 300 es
in vec2 position;
out vec2 v_tex_coords;
void main() {
  v_tex_coords = position * 0.5 + 0.5;
  v_tex_coords.y = 1.0 - v_tex_coords.y; // Flip Y for text texture matching
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const FRAGMENT_SHADER_SRC = `#version 300 es
precision highp float;

in vec2 v_tex_coords;
out vec4 fragColor;

uniform sampler2D u_text_texture;
uniform vec2 u_resolution;
uniform float u_time;

// Control factors
uniform float u_noise_scale_val;
uniform float u_distortion_val;
uniform float u_flow_speed_val;
uniform float u_glow_intensity_val;
uniform int u_color_preset;

// Audio parameters
uniform float u_audio_volume;
uniform float u_audio_bass;
uniform float u_audio_mid;
uniform float u_audio_high;
uniform float u_beat_flash;

// Interaction parameters
uniform vec2 u_mouse;
uniform float u_mouse_influence;

// Simplex 2D noise functions
vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }

float snoise(vec2 v){
  const vec4 C = vec4(0.211324865405187, 0.366025403784439,
           -0.577350269189626, 0.024390243902439);
  vec2 i  = floor(v + dot(v, C.yy) );
  vec2 x0 = v -   i + dot(i, C.xx);
  vec2 i1;
  i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod(i, 289.0);
  vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 ))
  + i.x + vec3(0.0, i1.x, 1.0 ));
  vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy),
    dot(x12.zw,x12.zw)), 0.0);
  m = m*m ;
  m = m*m ;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 a0 = x - floor(x + 0.5);
  vec3 g0 = inversesqrt(h*h + a0*a0);
  m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
  vec3 g;
  g.x  = a0.x  * x0.x  + h.x  * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

float fbm(vec2 p) {
  float value = 0.0;
  float amplitude = 0.5;
  float frequency = 1.0;
  for (int i = 0; i < 3; i++) {
    value += amplitude * snoise(p * frequency);
    p *= 2.0;
    amplitude *= 0.5;
  }
  return value;
}

// Custom dual-octave smooth flow noise for natural, silk-like fluid curves rather than pixelated static
float smooth_flow_noise(vec2 p) {
  float value = 0.0;
  float amplitude = 0.65;
  float frequency = 1.0;
  for (int i = 0; i < 2; i++) {
    value += amplitude * snoise(p * frequency);
    p *= 2.0;
    amplitude *= 0.35;
  }
  return value;
}

vec3 get_preset_color(float t, int preset) {
  // Deep Space (Deep black, Indigo starfield, Electric Space Cyan, Royal Magenta, Starlight Spark)
  if (t < 0.25) {
    return mix(vec3(0.0, 0.01, 0.04), vec3(0.05, 0.05, 0.25), t / 0.25);
  } else if (t < 0.6) {
    return mix(vec3(0.05, 0.05, 0.25), vec3(0.0, 0.75, 0.85), (t - 0.25) / 0.35);
  } else if (t < 0.85) {
    return mix(vec3(0.0, 0.75, 0.85), vec3(0.65, 0.05, 0.95), (t - 0.6) / 0.25);
  } else {
    return mix(vec3(0.65, 0.05, 0.95), vec3(0.95, 0.98, 1.0), (t - 0.85) / 0.15);
  }
}

vec3 get_glow_color(int preset) {
  return vec3(0.0, 1.0, 0.75);                      // Deep Space: Electric Cyan
}

float get_blurred_alpha(vec2 uv, float radius) {
  float sum = 0.0;
  sum += texture(u_text_texture, uv).r * 4.0;
  sum += texture(u_text_texture, uv + vec2(-radius, 0.0)).r * 2.0;
  sum += texture(u_text_texture, uv + vec2(radius, 0.0)).r * 2.0;
  sum += texture(u_text_texture, uv + vec2(0.0, -radius)).r * 2.0;
  sum += texture(u_text_texture, uv + vec2(0.0, radius)).r * 2.0;
  
  sum += texture(u_text_texture, uv + vec2(-radius, -radius)).r;
  sum += texture(u_text_texture, uv + vec2(radius, -radius)).r;
  sum += texture(u_text_texture, uv + vec2(-radius, radius)).r;
  sum += texture(u_text_texture, uv + vec2(radius, radius)).r;
  return sum / 16.0;
}


// A pseudo-random hash generator
float hash(float n) { return fract(sin(n) * 43758.5453123); }

// Procedural non-uniform stutter time generator with pauses and sudden leaps
float get_glitchy_time(float raw_time) {
  // Base linear time
  float t = raw_time;
  
  // Stair-steps (for stutters / pauses / staccato stops)
  float stair_time = floor(raw_time * 2.5) * 0.4 + smoothstep(0.0, 0.4, fract(raw_time * 2.5)) * 0.4;
  
  // High-velocity acceleration sweeps
  float sweep_time = raw_time * 3.5 + sin(raw_time * 8.0) * 1.5;
  
  // Sample low-frequency simplex noise as a continuous random selector
  float select_noise = snoise(vec2(raw_time * 0.28, 77.2)) * 0.5 + 0.5;
  
  // Select which timing phase is current: 
  // - under 0.4: standard smooth fluid motion
  // - 0.4 to 0.72: stutter steps / pauses
  // - above 0.72: high speed bursts of motion
  float resulting_time = t;
  if (select_noise > 0.4 && select_noise <= 0.72) {
    resulting_time = mix(t, stair_time, (select_noise - 0.4) / 0.32);
  } else if (select_noise > 0.72) {
    resulting_time = mix(stair_time, sweep_time, (select_noise - 0.72) / 0.28);
  }
  
  return resulting_time;
}

void main() {
  vec2 uv = v_tex_coords;
  vec2 aspect = vec2(u_resolution.x / u_resolution.y, 1.0);

  // Calculate master glitch selector from simplex noise + audio triggers
  float noise_val = snoise(vec2(u_time * 0.65, 341.6)) * 0.5 + 0.5;
  // A threshold above which horizontal block shifts and high-intensity jitter triggers (periodic spikes)
  float glitch_active = smoothstep(0.58, 0.88, noise_val) * 1.6;
  
  // Make it extremely sensitive to live music high-energy beats
  glitch_active += u_beat_flash * 1.25 + step(0.85, u_audio_bass) * u_audio_bass * 0.6;
  glitch_active = clamp(glitch_active, 0.0, 3.0);

  // 1. Horizontal Slicing misalignment (错位/拉开)
  // Divide screen into 36 horizontal scan-lines
  float block_id = floor(uv.y * 36.0);
  // Give each block a unique shift value over time
  float block_shift = snoise(vec2(block_id * 1.3, u_time * 22.0));
  // Randomly decide if a block shifts (e.g. 45% chance when glitch is active)
  float is_slice_shifted = step(0.55, snoise(vec2(block_id * 3.14, floor(u_time * 8.0))));
  float slice_offset = block_shift * 0.048 * is_slice_shifted * glitch_active * (0.4 + u_distortion_val);

  // 2. High frequency horizontal & vertical coordinate Jitter/Shake (震动)
  float h_jitter = snoise(vec2(u_time * 180.0, 11.2)) * 0.009 * glitch_active;
  float v_jitter = snoise(vec2(u_time * 180.0, 95.8)) * 0.004 * glitch_active;

  // 3. Broad gradual unstable drift & pull
  float drift_x = snoise(vec2(u_time * 1.8, 127.1)) * 0.016 * glitch_active;

  // Apply all displacement and instabilities onto base coordinate glitch_uv
  vec2 glitch_uv = uv;
  glitch_uv.x += slice_offset + h_jitter + drift_x;
  glitch_uv.y += v_jitter;

  // Compute non-uniform chronological flow speed using our glitchy timeline
  float glitchy_time = get_glitchy_time(u_time);
  float dynamic_time = glitchy_time * u_flow_speed_val * 0.3 + u_audio_mid * 2.2;

  // Stretched dual-coordinate mapping on displaced base coordinates
  vec2 fluid_noise_uv = vec2(glitch_uv.x * 12.0, glitch_uv.y * 38.0) * u_noise_scale_val * 0.022;

  // Animate the flow lines dynamically using unpredictable velocity steps
  float flow_x = dynamic_time * 0.9;
  float flow_y = dynamic_time * 0.2;

  float n_x = smooth_flow_noise(fluid_noise_uv + vec2(flow_x, flow_y));
  float n_y = smooth_flow_noise(fluid_noise_uv * 1.3 - vec2(flow_x * 0.8, -flow_y * 1.5) + vec2(8.2));

  // Compute pointer/finger ripple displacement
  float dist_to_mouse = distance(glitch_uv * aspect, u_mouse * aspect);
  float mouse_ripple = 0.0;
  if (dist_to_mouse < 0.4) {
    float wave = sin(dist_to_mouse * 32.0 - u_time * 12.0);
    float attenuation = smoothstep(0.4, 0.0, dist_to_mouse) * u_mouse_influence;
    mouse_ripple = wave * attenuation * 0.045;
  }

  // Sample undistorted texture first to establish smart text core protection
  float undistorted_mask = texture(u_text_texture, glitch_uv).r;
  
  // Readability anchor: Dampen distortion inside the text core, while letting borders perform wide fluid melting sweeps
  // Under active glitch stress, decrease the core buffer to let the whole text bend and tear more deconstructively!
  float read_buffer = mix(0.12, 0.02, clamp(glitch_active * 0.5, 0.0, 1.0));
  float core_distortion_dampen = mix(1.0, 0.15, smoothstep(read_buffer, 0.78, undistorted_mask));

  // Set distortion bounds
  float distortion_intensity = u_distortion_val * 0.038;
  // Sound waves trigger physical swell expansion
  distortion_intensity += u_beat_flash * 0.06 * u_distortion_val;
  distortion_intensity *= (1.0 + u_audio_bass * 1.5) * core_distortion_dampen;

  vec2 uv_displaced = glitch_uv + vec2(n_x, n_y) * distortion_intensity;
  
  // Warp coordinates outward from cursor
  if (u_mouse_influence > 0.01 && dist_to_mouse > 0.001) {
    vec2 to_mouse = normalize(glitch_uv * aspect - u_mouse * aspect) / aspect;
    uv_displaced += to_mouse * mouse_ripple;
  }

  // --- Chromatic Aberration GLITCH Section (Dynamic Chromatic Pull-Apart) ---
  float ca_shift = (0.002 + 0.014 * u_beat_flash + 0.016 * glitch_active) * (u_distortion_val * 0.6);
  float mask_r = texture(u_text_texture, uv_displaced - vec2(ca_shift, 0.0)).r;
  float mask_g = texture(u_text_texture, uv_displaced).r;
  float mask_b = texture(u_text_texture, uv_displaced + vec2(ca_shift, 0.0)).r;
  
  float core_alpha = max(max(mask_r, mask_g), mask_b);

  // Calculate outline glows with WebGL blurring
  float glow_rad = 0.002 + 0.008 * u_glow_intensity_val * 0.1 + u_audio_bass * 0.01;
  float alpha_blurred = get_blurred_alpha(uv_displaced, glow_rad);

  // --- Signal Interference Dynamic Residuals / Afterimages (动态残影) ---
  // Multiple wide pulling tap points that create trailing copies that separate (拉开)
  float pull_apart_shift = (0.01 + 0.075 * glitch_active) * (0.5 + u_distortion_val * 0.5);
  vec2 trail_uv_left = uv_displaced - vec2(pull_apart_shift, pull_apart_shift * 0.12);
  vec2 trail_uv_right = uv_displaced + vec2(pull_apart_shift * 1.15, -pull_apart_shift * 0.08);
  
  float trail_left = texture(u_text_texture, trail_uv_left).r;
  float trail_right = texture(u_text_texture, trail_uv_right).r;

  // Deep space trail glitch colors
  vec3 trail_color_left = vec3(0.1, 0.8, 0.9) * 0.65;   // Ice cyan
  vec3 trail_color_right = vec3(0.9, 0.1, 0.8) * 0.65;   // Purple magenta

  // Compose the residual ghosts
  vec3 ghost_trails_rgb = (trail_left * trail_color_left + trail_right * trail_color_right) * 0.7;

  // --- Super Premium Metallic Specular Environment Highlight Map ---
  float flow_coord = uv_displaced.x * 4.5 - dynamic_time * 1.2;
  
  // High contrast reflections resembling liquid silver/mercury ripples rolling across the screen
  float shine1 = sin(flow_coord + n_x * 4.4) * 0.5 + 0.5;
  float shine2 = cos(-uv_displaced.y * 4.8 - flow_coord * 0.6 + n_y * 3.0) * 0.5 + 0.5;
  
  float height_val = mix(shine1, shine2, 0.55);

  // Exponent peaks for highly polished chrome specular accents
  float spec1 = pow(shine1, 8.0);
  float spec2 = pow(shine2, 10.0);
  float spec_total = (spec1 * 0.6 + spec2 * 0.4) * (0.65 + u_audio_volume * 1.35);

  vec3 text_color_base = get_preset_color(height_val, u_color_preset);
  vec3 glow_color = get_glow_color(u_color_preset);

  // Define tailored specular highlight color hues for Deep Space (Cyan/Cobalt)
  vec3 spec_color = vec3(0.85, 0.95, 1.0); // Cyan electric cobalt

  // Combine baseline shift with chrome reflections
  vec3 metal_color = text_color_base + spec_color * spec_total * 0.85;

  // Soft out glow zone
  float outer_glow_factor = smoothstep(0.01, 0.45, alpha_blurred) * (1.0 - smoothstep(0.12, 0.38, core_alpha));
  vec3 outer_glow = glow_color * outer_glow_factor * (u_glow_intensity_val * 0.38 + u_audio_bass * 2.0);

  // Inner outline glowing border band
  float edge_outline_mask = smoothstep(0.03, 0.15, core_alpha) * (1.0 - smoothstep(0.40, 0.65, core_alpha));
  vec3 edge_outline = glow_color * edge_outline_mask * (1.2 + u_audio_high * 1.2);

  // Compile final pixel layers
  vec3 interior_color = mix(metal_color, glow_color, edge_outline_mask * 0.45);
  
  if (ca_shift > 0.003) {
    interior_color.r += mask_r * 0.20;
    interior_color.g += mask_g * 0.06;
    interior_color.b += mask_b * 0.30;
  }

  vec3 final_text_layer = interior_color * smoothstep(0.15, 0.28, core_alpha);
  vec3 rgb = final_text_layer + edge_outline * 0.9 + outer_glow * 0.85;

  // Overlay the signal residuals with high-frequency interference flicker (analog noise line ripple)
  float line_noise = step(0.96, fract(uv_displaced.y * 30.0 + u_time * 15.0)) * 0.12 * glitch_active;
  rgb += ghost_trails_rgb * clamp(1.0 + line_noise, 0.0, 1.5);

  fragColor = vec4(rgb, 1.0);
}
`;

interface Props {
  settings: VisualSettings;
  audioDriveMode: AudioDriveMode;
  autoVjEnabled: boolean;
  isFullScreen: boolean;
}

type UniformLocations = Record<
  | 'u_resolution'
  | 'u_time'
  | 'u_noise_scale_val'
  | 'u_distortion_val'
  | 'u_flow_speed_val'
  | 'u_glow_intensity_val'
  | 'u_color_preset'
  | 'u_audio_volume'
  | 'u_audio_bass'
  | 'u_audio_mid'
  | 'u_audio_high'
  | 'u_beat_flash'
  | 'u_mouse'
  | 'u_mouse_influence'
  | 'u_text_texture',
  WebGLUniformLocation | null
>;

const defaultAudioAnalysis: AudioAnalysis = {
  volume: 0,
  bass: 0,
  mid: 0,
  high: 0,
  beatIntensity: 0,
};

const BlueFontCanvas: React.FC<Props> = ({ settings, audioDriveMode, autoVjEnabled, isFullScreen }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const displayCanvasRef = useRef<HTMLCanvasElement>(null);

  // Offscreen canvas elements
  const webglCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const textCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Interactive mouse touch states
  const mouseState = useRef({
    x: 0.5,
    y: 0.5,
    targetX: 0.5,
    targetY: 0.5,
    influence: 0.0,
    targetInfluence: 0.0,
  });

  // WebGL references
  const glRef = useRef<WebGL2RenderingContext | null>(null);
  const programRef = useRef<WebGLProgram | null>(null);
  const positionBufferRef = useRef<WebGLBuffer | null>(null);
  const textTextureRef = useRef<WebGLTexture | null>(null);
  const displayCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const uniformLocationsRef = useRef<UniformLocations | null>(null);
  const timeRef = useRef<number>(0);
  const animationFrameRef = useRef<number | null>(null);
  const textureNeedsUpdateRef = useRef<boolean>(true);

  const settingsRef = useRef(settings);
  const audioDriveModeRef = useRef(audioDriveMode);
  const autoVjEnabledRef = useRef(autoVjEnabled);
  const audioAnalysisRef = useRef<AudioAnalysis>(defaultAudioAnalysis);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    audioDriveModeRef.current = audioDriveMode;
  }, [audioDriveMode]);

  useEffect(() => {
    autoVjEnabledRef.current = autoVjEnabled;
  }, [autoVjEnabled]);

  // Track dimensions
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const dimensionsRef = useRef(dimensions);

  // Update text texture when visual changes occur
  useEffect(() => {
    textureNeedsUpdateRef.current = true;
  }, [settings.text, settings.fontFamily, settings.fontWeight, settings.fontSize]);

  // Handle ResizeObserver for responsive fluid scaling
  useEffect(() => {
    if (!containerRef.current) return;
    
    const resizeObserver = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0) return;
      const { width, height } = entries[0].contentRect;
      
      // Enforce minimum size boundary and set
      const w = Math.max(200, Math.floor(width));
      const h = Math.max(150, Math.floor(height));
      setDimensions((current) => {
        if (current.width === w && current.height === h) return current;
        textureNeedsUpdateRef.current = true;
        return { width: w, height: h };
      });
    });

    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  // Update Canvas internal pixel sizes
  useEffect(() => {
    dimensionsRef.current = dimensions;
    const displayCanvas = displayCanvasRef.current;
    if (!displayCanvas) return;

    displayCanvas.width = dimensions.width;
    displayCanvas.height = dimensions.height;
    displayCtxRef.current = displayCanvas.getContext('2d');

    // Set up offscreen canvases matching dimensions
    if (!webglCanvasRef.current) {
      webglCanvasRef.current = document.createElement('canvas');
    }
    webglCanvasRef.current.width = dimensions.width;
    webglCanvasRef.current.height = dimensions.height;

    if (!textCanvasRef.current) {
      textCanvasRef.current = document.createElement('canvas');
    }
    // Render text canvas with high sampling resolution for absolute crispness
    textCanvasRef.current.width = dimensions.width;
    textCanvasRef.current.height = dimensions.height;

    // Initialize WebGL on size change
    initWebGL();
    textureNeedsUpdateRef.current = true;
  }, [dimensions]);

  // WebGL system initializer
  const initWebGL = () => {
    const glCanvas = webglCanvasRef.current;
    if (!glCanvas) return;

    const gl = glCanvas.getContext('webgl2', {
      premultipliedAlpha: false,
      alpha: false,
      antialias: true,
      powerPreference: 'high-performance'
    });

    if (!gl) {
      console.error('WebGL2 not supported, performance might be impacted');
      return;
    }

    if (glRef.current && programRef.current && uniformLocationsRef.current) {
      return;
    }

    glRef.current = gl;

    // Compile Vertex Shader
    const vs = gl.createShader(gl.VERTEX_SHADER);
    if (!vs) return;
    gl.shaderSource(vs, VERTEX_SHADER_SRC);
    gl.compileShader(vs);
    if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) {
      console.error('Vertex shader compile error:', gl.getShaderInfoLog(vs));
      return;
    }

    // Compile Fragment Shader
    const fs = gl.createShader(gl.FRAGMENT_SHADER);
    if (!fs) return;
    gl.shaderSource(fs, FRAGMENT_SHADER_SRC);
    gl.compileShader(fs);
    if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
      console.error('Fragment shader compile error:', gl.getShaderInfoLog(fs));
      return;
    }

    // Create program
    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('WebGL program linking failed:', gl.getProgramInfoLog(program));
      return;
    }
    gl.deleteShader(vs);
    gl.deleteShader(fs);

    programRef.current = program;
    gl.useProgram(program);

    // Setup coordinates quad [-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1] - filling viewport
    const positionLocation = gl.getAttribLocation(program, 'position');
    const positionBuffer = gl.createBuffer();
    positionBufferRef.current = positionBuffer;
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([
        -1.0, -1.0,
         1.0, -1.0,
        -1.0,  1.0,
        -1.0,  1.0,
         1.0, -1.0,
         1.0,  1.0,
      ]),
      gl.STATIC_DRAW
    );
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    // Setup Text Texture
    if (textTextureRef.current) {
      gl.deleteTexture(textTextureRef.current);
    }
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    textTextureRef.current = texture;
    uniformLocationsRef.current = {
      u_resolution: gl.getUniformLocation(program, 'u_resolution'),
      u_time: gl.getUniformLocation(program, 'u_time'),
      u_noise_scale_val: gl.getUniformLocation(program, 'u_noise_scale_val'),
      u_distortion_val: gl.getUniformLocation(program, 'u_distortion_val'),
      u_flow_speed_val: gl.getUniformLocation(program, 'u_flow_speed_val'),
      u_glow_intensity_val: gl.getUniformLocation(program, 'u_glow_intensity_val'),
      u_color_preset: gl.getUniformLocation(program, 'u_color_preset'),
      u_audio_volume: gl.getUniformLocation(program, 'u_audio_volume'),
      u_audio_bass: gl.getUniformLocation(program, 'u_audio_bass'),
      u_audio_mid: gl.getUniformLocation(program, 'u_audio_mid'),
      u_audio_high: gl.getUniformLocation(program, 'u_audio_high'),
      u_beat_flash: gl.getUniformLocation(program, 'u_beat_flash'),
      u_mouse: gl.getUniformLocation(program, 'u_mouse'),
      u_mouse_influence: gl.getUniformLocation(program, 'u_mouse_influence'),
      u_text_texture: gl.getUniformLocation(program, 'u_text_texture'),
    };
  };

  // Render text onto the crisp 2D offscreen canvas
  const renderTextToTexture = () => {
    const textCanvas = textCanvasRef.current;
    if (!textCanvas) return;

    const ctx = textCanvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = textCanvas;

    // Draw background pure black
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, width, height);

    const currentSettings = settingsRef.current;

    // Dynamic Font Scaling and Parsing
    const lines = currentSettings.text.split('\n');
    const maxLineLength = Math.max(...lines.map(line => line.length));
    
    // Scale font size based on text size percentage and canvas boundaries
    const sizeMultiplier = currentSettings.fontSize / 100;
    const baseWidthSize = (width / Math.max(1, maxLineLength)) * 1.15 * sizeMultiplier;
    const baseHeightSize = (height / Math.max(1, lines.length)) * 0.6 * sizeMultiplier;
    
    const size = Math.floor(Math.min(baseWidthSize, baseHeightSize, 220));

    // Choose font family styles
    ctx.font = `${currentSettings.fontWeight} ${size}px ${currentSettings.fontFamily}`;
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowBlur = 0; // shader handles bloom glowing

    // Distribute multi-line heights evenly
    const lineHeight = size * 1.15;
    const totalHeight = lineHeight * (lines.length - 1);
    const startY = height / 2 - totalHeight / 2;

    lines.forEach((line, index) => {
      const y = startY + index * lineHeight;
      ctx.fillText(line, width / 2, y);
    });

    // Upload canvas to WebGL texture buffer
    const gl = glRef.current;
    if (gl && textTextureRef.current) {
      gl.bindTexture(gl.TEXTURE_2D, textTextureRef.current);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, textCanvas);
    }
  };

  // Main rendering animation loop
  useEffect(() => {
    let lastTime = performance.now();

    const loop = (now: number) => {
      animationFrameRef.current = requestAnimationFrame(loop);

      const gl = glRef.current;
      const program = programRef.current;
      const displayCanvas = displayCanvasRef.current;
      const webglCanvas = webglCanvasRef.current;
      const displayCtx = displayCtxRef.current;
      const uniforms = uniformLocationsRef.current;

      if (!gl || !program || !displayCanvas || !webglCanvas || !displayCtx || !uniforms) return;

      const elapsed = (now - lastTime) / 1000;
      lastTime = now;

      const currentSettings = settingsRef.current;
      const audio = getAudioDriveSnapshot(audioDriveModeRef.current);
      const motionAmount = autoVjEnabledRef.current ? 1 : 0.35;
      audioAnalysisRef.current = {
        volume: audio.volume * motionAmount,
        bass: Math.max(audio.subBass, audio.bass) * motionAmount,
        mid: Math.max(audio.lowMid, audio.mid, audio.highMid) * motionAmount,
        high: audio.treble * motionAmount,
        beatIntensity: Math.max(audio.beat, audio.transient * 0.85, audio.spectralFlux * 0.7) * motionAmount,
      };
      const currentAudio = audioAnalysisRef.current;

      // Update shader clock timeline
      // Clock speeds up when user raises speed, or on intense audio frequencies!
      const speedMultiplier = currentSettings.flowSpeed * 0.2;
      const musicInfluence = currentAudio.mid * 1.5;
      timeRef.current += elapsed * (speedMultiplier + musicInfluence);

      // Perform text re-render if text or canvas resizing occurred
      if (textureNeedsUpdateRef.current) {
        renderTextToTexture();
        textureNeedsUpdateRef.current = false;
      }

      const dims = dimensionsRef.current;

      // 1. Render in WebGL offscreen
      gl.viewport(0, 0, dims.width, dims.height);
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);

      gl.useProgram(program);

      // Interpolate pointer interactions smoothly
      const mouse = mouseState.current;
      mouse.influence += (mouse.targetInfluence - mouse.influence) * 0.1;
      mouse.x += (mouse.targetX - mouse.x) * 0.15;
      mouse.y += (mouse.targetY - mouse.y) * 0.15;

      // Set Shader Uniform values
      gl.uniform2f(uniforms.u_resolution, dims.width, dims.height);
      gl.uniform1f(uniforms.u_time, timeRef.current);
      
      gl.uniform1f(uniforms.u_noise_scale_val, currentSettings.noiseScale);
      gl.uniform1f(uniforms.u_distortion_val, currentSettings.distortion);
      gl.uniform1f(uniforms.u_flow_speed_val, currentSettings.flowSpeed);
      gl.uniform1f(uniforms.u_glow_intensity_val, currentSettings.glowIntensity);
      
      let presetIndex = 0;
      if (currentSettings.colorPreset === 'cyber') presetIndex = 1;
      if (currentSettings.colorPreset === 'toxic') presetIndex = 2;
      if (currentSettings.colorPreset === 'solar') presetIndex = 3;
      if (currentSettings.colorPreset === 'deepspace') presetIndex = 4;
      gl.uniform1i(uniforms.u_color_preset, presetIndex);

      // Bind Audio uniform buffers
      gl.uniform1f(uniforms.u_audio_volume, currentAudio.volume);
      gl.uniform1f(uniforms.u_audio_bass, currentAudio.bass);
      gl.uniform1f(uniforms.u_audio_mid, currentAudio.mid);
      gl.uniform1f(uniforms.u_audio_high, currentAudio.high);
      gl.uniform1f(uniforms.u_beat_flash, currentSettings.enableBeatGlitches ? currentAudio.beatIntensity : 0.0);

      // Bind Pointer interaction coordinates
      gl.uniform2f(uniforms.u_mouse, mouse.x, mouse.y);
      gl.uniform1f(uniforms.u_mouse_influence, mouse.influence);

      // Bind Texture Unit 0
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, textTextureRef.current);
      gl.uniform1i(uniforms.u_text_texture, 0);

      // Draw Screen Quad
      gl.drawArrays(gl.TRIANGLES, 0, 6);

      // 2. Perform 2D Trails Composition onto Visible Canvas 2D
      // Clear background with semi-transparent clear color to composite motion blur trials.
      const trailAlpha = 1.0 - (currentSettings.motionBlur / 10) * 0.92;
      displayCtx.fillStyle = currentSettings.backgroundColor || '#000000';
      displayCtx.globalCompositeOperation = 'source-over';
      displayCtx.globalAlpha = trailAlpha;
      displayCtx.fillRect(0, 0, dims.width, dims.height);
      displayCtx.globalAlpha = 1.0;
      displayCtx.drawImage(webglCanvas, 0, 0);
    };

    animationFrameRef.current = requestAnimationFrame(loop);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      const gl = glRef.current;
      if (gl) {
        if (positionBufferRef.current) gl.deleteBuffer(positionBufferRef.current);
        if (textTextureRef.current) gl.deleteTexture(textTextureRef.current);
        if (programRef.current) gl.deleteProgram(programRef.current);
      }
      glRef.current = null;
      programRef.current = null;
      positionBufferRef.current = null;
      textTextureRef.current = null;
      uniformLocationsRef.current = null;
    };
  }, []);

  // Handle Touch or Mouse moves to feed ripples
  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = displayCanvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;

    const mouse = mouseState.current;
    mouse.targetX = x;
    mouse.targetY = y;
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    
    const canvas = displayCanvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;

    const mouse = mouseState.current;
    mouse.targetX = x;
    mouse.targetY = y;
    mouse.targetInfluence = 1.0;
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.releasePointerCapture(e.pointerId);
    mouseState.current.targetInfluence = 0.0;
  };

  return (
    <div
      ref={containerRef}
      id="vj-visualizer-container"
      className="relative w-full h-full flex items-center justify-center overflow-hidden"
      style={{ backgroundColor: settings.backgroundColor }}
    >
      <canvas
        ref={displayCanvasRef}
        id="vj-display-canvas"
        className="w-full h-full block cursor-crosshair touch-none select-none transition-transform duration-300"
        onPointerMove={handlePointerMove}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
      />

      {/* Decorative center guidelines in full screen to establish clean grid framing (optional subtly) */}
      {isFullScreen && (
        <div id="vj-screen-vibe" className="absolute top-4 left-4 z-40 pointer-events-none select-none">
          <div className="flex items-center gap-2 text-[10px] text-zinc-500 font-mono tracking-widest uppercase">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>VJ STATE // {settings.colorPreset.toUpperCase()} LIVE FEED</span>
          </div>
        </div>
      )}
    </div>
  );
};

export function BlueFontScene() {
  const {
    audioDriveMode,
    autoVjEnabled,
    bgColor,
    chaos,
    distortion,
    speed,
    textFontSize,
    textFontWeight,
    textGlow,
    textInput,
  } = useStore();

  const settings = useMemo<VisualSettings>(() => ({
    text: textInput.trim() || 'BLUE\nFONT',
    fontFamily: 'Inter, "SF Pro Display", "Helvetica Neue", "PingFang SC", "Microsoft YaHei", sans-serif',
    fontWeight: String(textFontWeight),
    fontSize: Math.max(46, Math.min(130, textFontSize * 18)),
    distortion: Math.max(1.4, Math.min(9.8, 4.2 + distortion * 7.5 + chaos * 2.2)),
    flowSpeed: Math.max(1.2, Math.min(8.5, 3.4 * speed + chaos * 2.4)),
    glowIntensity: Math.max(2.4, Math.min(9.8, 4.6 + textGlow * 1.4)),
    colorPreset: 'deepspace',
    backgroundColor: bgColor || '#000000',
    motionBlur: Math.max(2.2, Math.min(8.8, 4.4 + chaos * 2.4)),
    noiseScale: Math.max(2.2, Math.min(8.8, 3.8 + chaos * 3.2)),
    enableBeatGlitches: autoVjEnabled,
  }), [autoVjEnabled, bgColor, chaos, distortion, speed, textFontSize, textFontWeight, textGlow, textInput]);

  return (
    <BlueFontCanvas
      settings={settings}
      audioDriveMode={audioDriveMode}
      autoVjEnabled={autoVjEnabled}
      isFullScreen={false}
    />
  );
}
