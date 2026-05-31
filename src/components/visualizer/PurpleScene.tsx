import { useEffect, useRef, useState } from 'react';
import { getAudioDriveSnapshot } from '@/lib/audioDrive';
import { useStore } from '@/store/useStore';

const vertexShaderSource = `
  attribute vec2 position;
  varying vec2 v_uv;

  void main() {
    v_uv = position * 0.5 + 0.5;
    gl_Position = vec4(position, 0.0, 1.0);
  }
`;

const fragmentShaderSource = `
  precision highp float;
  varying vec2 v_uv;

  uniform vec2 u_resolution;
  uniform float u_time;
  uniform float u_bass;
  uniform float u_mid;
  uniform float u_treble;
  uniform float u_bass_phase;
  uniform float u_treble_phase;
  uniform vec3 u_primary_color;
  uniform vec3 u_secondary_color;
  uniform vec3 u_accent_color;
  uniform float u_brightness;
  uniform float u_density;
  uniform float u_flow_speed;
  uniform float u_void_size;
  uniform float u_refraction;
  uniform float u_camera_zoom;
  uniform float u_tunnel_speed;
  uniform float u_vortex_wrap;
  uniform float u_sparkle_size;
  uniform float u_sparkle_brightness;

  float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  float noise(vec2 p) {
    vec2 ip = floor(p);
    vec2 fp = fract(p);
    fp = fp * fp * (3.0 - 2.0 * fp);

    float d0 = hash(ip);
    float d1 = hash(ip + vec2(1.0, 0.0));
    float d2 = hash(ip + vec2(0.0, 1.0));
    float d3 = hash(ip + vec2(1.0, 1.0));

    return mix(mix(d0, d1, fp.x), mix(d2, d3, fp.x), fp.y);
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    float shift = 100.0;
    mat2 rot = mat2(cos(0.55), sin(0.55), -sin(0.55), cos(0.55));
    for (int i = 0; i < 5; ++i) {
      v += a * noise(p);
      p = rot * p * 2.0 + shift;
      a *= 0.5;
    }
    return v;
  }

  float drawParticle(vec2 uv, vec2 center, float size) {
    vec2 d = uv - center;
    float dist = length(d);
    return exp(-dist * dist * (10.0 / (size + 0.0001)));
  }

  void main() {
    vec2 uv = (gl_FragCoord.xy / u_resolution.xy) * 2.0 - 1.0;
    uv.x *= u_resolution.x / u_resolution.y;

    if (u_vortex_wrap > 0.0) {
      float angle = atan(uv.y, uv.x);
      float dist = length(uv);
      angle += sin(dist * 2.0 - u_time * 0.5) * u_vortex_wrap * 0.4;
      uv = vec2(cos(angle), sin(angle)) * dist;
    }

    vec2 uv_zoom = uv / (u_camera_zoom + u_bass * 0.12);
    float radius_polar = length(uv_zoom);
    float angle_polar = atan(uv_zoom.y, uv_zoom.x);
    float rotation_offset = u_time * u_flow_speed * 0.22 + u_bass_phase * 0.12;
    float swirled_angle = angle_polar + rotation_offset + sin(radius_polar * 1.5 - u_time * 0.4) * 0.3;
    float density_breath = sin(u_time * 0.15) * 0.08;
    float audio_energy = clamp(u_bass * 0.55 + u_mid * 0.3 + u_treble * 0.15, 0.0, 1.6);
    float audio_density = mix(0.55, 1.85, smoothstep(0.05, 1.15, audio_energy));
    float reactive_density = u_density * (audio_density + density_breath);
    float radial_expansion = sin(radius_polar * 4.0 - u_time * 2.5 - u_bass_phase * 2.0) * (u_bass * 0.3);
    vec2 flow_coord = vec2(cos(swirled_angle), sin(swirled_angle)) * (radius_polar * reactive_density * (1.0 + radial_expansion));

    float dispersion_direction = mod(u_time * u_tunnel_speed * 0.12, 62.83) - u_bass_phase * 0.18;
    flow_coord += vec2(cos(swirled_angle), sin(swirled_angle)) * dispersion_direction;

    vec2 warp1 = vec2(
      fbm(flow_coord + vec2(0.0, u_time * u_flow_speed * 0.08)),
      fbm(flow_coord + vec2(5.2, u_bass_phase * 0.1))
    );

    vec2 warp2 = vec2(
      fbm(flow_coord + 3.0 * warp1 + vec2(1.7, u_time * u_flow_speed * 0.05)),
      fbm(flow_coord + 3.0 * warp1 + vec2(8.3, u_treble_phase * 0.08))
    );

    float n_val = fbm(flow_coord + 4.0 * warp2);
    float base_width = 3.5 / (0.15 + u_void_size + u_bass * 0.55);
    float outward_wave = sin(radius_polar * 6.5 - u_bass_phase * 2.2) * (u_bass * 0.15);
    float river_profile = exp(-abs(radius_polar - 0.4 - outward_wave) * base_width);
    river_profile += exp(-abs(radius_polar - (0.85 + u_bass * 0.35)) * (base_width * 1.6)) * (u_bass * 0.45);

    vec2 hole_coord = vec2(cos(swirled_angle), sin(swirled_angle)) * radius_polar * 2.0;
    hole_coord.y -= u_time * 0.3;
    float hole_noise1 = noise(hole_coord);
    float hole_noise2 = noise(hole_coord * 2.3 + vec2(3.1, u_time * 0.2));
    float combined_holes = smoothstep(0.42, 0.75, (hole_noise1 * 0.6 + hole_noise2 * 0.4));
    float active_river = river_profile * (1.0 - combined_holes * 0.4);

    vec2 eps = vec2(0.025, 0.0);
    float n_x = fbm(flow_coord + 4.0 * warp2 + eps.xy) - n_val;
    float n_y = fbm(flow_coord + 4.0 * warp2 + eps.yx) - n_val;
    vec3 normal = normalize(vec3(n_x * 1.5, n_y * 1.5, 0.08 / (0.1 + u_refraction)));

    vec3 light_direction = normalize(vec3(0.4, 0.5, 1.0));
    vec3 view_direction = vec3(0.0, 0.0, 1.0);
    vec3 reflection = reflect(-light_direction, normal);
    float spec_highlight = pow(max(0.0, dot(reflection, view_direction)), 24.0) * active_river;

    float sparkle_pattern = pow(hash(floor(flow_coord * 15.0)), 18.0) * hash(floor(flow_coord * 9.0 + vec2(10.0)));
    float glittering = sparkle_pattern * (0.1 + u_treble * 1.8) * active_river;

    float particle_layer = 0.0;
    for (int i = 0; i < 4; i++) {
      float fi = float(i);
      float speed_multiplier = 0.55 + fi * 0.22;
      float orbital_angle = u_time * speed_multiplier * 0.65 + fi * 1.57 + u_treble_phase * 0.08;
      float radial_projection = fract(fi * 0.25 + u_time * 0.08 * speed_multiplier) * (1.5 + u_treble * 1.1);
      vec2 offset_p = vec2(cos(orbital_angle), sin(orbital_angle)) * radial_projection;
      float p_size = (u_sparkle_size * 0.01) * (1.0 + u_treble * 0.4);
      particle_layer += drawParticle(uv, offset_p, p_size) * (0.3 + u_treble * 0.7);
    }

    vec3 neon_primary = u_primary_color * n_val * (1.0 + u_bass * 0.25);
    vec3 neon_secondary = u_secondary_color * (warp1.x * 0.6 + warp2.y * 0.4) * (1.0 + u_mid * 0.2);
    vec3 neon_accent = u_accent_color * warp1.y * 0.8;
    vec3 liquid_stream_color = mix(vec3(0.03, 0.012, 0.055) * (1.0 + u_bass * 0.4), neon_secondary, active_river);
    liquid_stream_color += neon_primary * active_river * 0.75;
    liquid_stream_color += neon_accent * active_river * 0.45;

    vec3 silver_white = vec3(1.2) * spec_highlight * 0.8;
    vec3 golden = vec3(1.0, 0.8, 1.1) * glittering * u_sparkle_brightness * 1.5;
    vec3 color_out = liquid_stream_color + silver_white + golden + (u_accent_color * particle_layer * u_sparkle_brightness * 0.35);

    float vignette = 1.0 - smoothstep(0.4, 1.8, length(uv));
    color_out *= vignette;
    color_out *= u_brightness;

    float random_grain = (hash(gl_FragCoord.xy * 0.03 + vec2(fract(u_time))) - 0.5) * 0.045;
    color_out += random_grain * (0.2 + u_treble * 0.8);

    gl_FragColor = vec4(clamp(color_out, vec3(0.0), vec3(1.0)), 1.0);
  }
`;

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

const hexToRgb = (hex: string): [number, number, number] => {
  const cleaned = hex.replace('#', '');
  const r = Number.parseInt(cleaned.substring(0, 2), 16) / 255;
  const g = Number.parseInt(cleaned.substring(2, 4), 16) / 255;
  const b = Number.parseInt(cleaned.substring(4, 6), 16) / 255;
  return [Number.isFinite(r) ? r : 1, Number.isFinite(g) ? g : 1, Number.isFinite(b) ? b : 1];
};

const blendRgb = (a: [number, number, number], b: [number, number, number], amount: number): [number, number, number] => [
  a[0] + (b[0] - a[0]) * amount,
  a[1] + (b[1] - a[1]) * amount,
  a[2] + (b[2] - a[2]) * amount,
];

const compileShader = (gl: WebGLRenderingContext, source: string, type: number) => {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error('Purple shader compilation error:', gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
};

export function PurpleScene() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const timeRef = useRef(0);
  const phaseRef = useRef({ bass: 0, treble: 0 });
  const [shaderError, setShaderError] = useState<string | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const gl = canvas.getContext('webgl', { antialias: true, alpha: false, powerPreference: 'high-performance' });
    if (!gl) {
      setShaderError('WebGL is not available for the Purple visual.');
      return undefined;
    }

    const vertexShader = compileShader(gl, vertexShaderSource, gl.VERTEX_SHADER);
    const fragmentShader = compileShader(gl, fragmentShaderSource, gl.FRAGMENT_SHADER);
    if (!vertexShader || !fragmentShader) {
      setShaderError('Purple shader failed to compile.');
      return undefined;
    }

    const program = gl.createProgram();
    if (!program) return undefined;
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      setShaderError(`Purple shader failed to link: ${gl.getProgramInfoLog(program)}`);
      return undefined;
    }

    const vertices = new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]);
    const vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    const positionLocation = gl.getAttribLocation(program, 'position');
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
    gl.clearColor(0, 0, 0, 1);

    const uniformCache = new Map<string, WebGLUniformLocation | null>();
    const uniform = (name: string) => {
      if (!uniformCache.has(name)) uniformCache.set(name, gl.getUniformLocation(program, name));
      return uniformCache.get(name);
    };
    const setFloat = (name: string, value: number) => {
      const location = uniform(name);
      if (location) gl.uniform1f(location, value);
    };
    const setVec2 = (name: string, x: number, y: number) => {
      const location = uniform(name);
      if (location) gl.uniform2f(location, x, y);
    };
    const setVec3 = (name: string, rgb: [number, number, number]) => {
      const location = uniform(name);
      if (location) gl.uniform3f(location, rgb[0], rgb[1], rgb[2]);
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const isScreenOutput = window.location.pathname.startsWith('/screen/');
      const dprLimit = isScreenOutput ? 1.75 : 1.35;
      const dpr = Math.min(dprLimit, window.devicePixelRatio || 1);
      const width = Math.max(1, Math.floor(rect.width * dpr));
      const height = Math.max(1, Math.floor(rect.height * dpr));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        gl.viewport(0, 0, width, height);
      }
    };

    let lastTimestamp = performance.now();
    const render = (timestamp: number) => {
      const delta = Math.min((timestamp - lastTimestamp) / 1000, 0.05);
      lastTimestamp = timestamp;
      timeRef.current += delta;
      resize();

      const store = useStore.getState();
      const liveControls = store.liveControls;
      const audio = getAudioDriveSnapshot(store.audioDriveMode);
      const live = store.autoVjEnabled ? 1 : 0.35;
      const energyDrive = 0.82 + liveControls.energyY * 0.88;
      const rhythmTightness = 0.72 + liveControls.rhythmX * 0.72;
      const punch = 0.72 + liveControls.rhythmY * 1.12;
      const bass = Math.min(1.8, Math.max(audio.bass, audio.subBass) * energyDrive * live);
      const mid = Math.min(1.6, Math.max(audio.mid, audio.lowMid) * (0.78 + liveControls.textureX * 0.42) * live);
      const treble = Math.min(1.8, Math.max(audio.treble, audio.highMid) * (0.9 + liveControls.textureY * 0.55 + liveControls.atmosphereX * 0.28) * live);
      phaseRef.current.bass += delta * (0.48 + bass * 4.2 * punch + audio.beat * 2.4 * rhythmTightness);
      phaseRef.current.treble += delta * (0.9 + treble * 5.0 + audio.transient * 3.0 * punch);

      const coolPrimary = hexToRgb(store.baseColor || '#ffffff');
      const coolSecondary = hexToRgb(store.secondaryColor || '#0a0a1f');
      const coolAccent = hexToRgb(store.accentColor || '#00e1ff');
      const warmMix = clamp01(liveControls.colorX) * 0.24;
      const colorLift = 0.86 + liveControls.colorY * 0.28;
      const primary = blendRgb(coolPrimary, [1.0, 0.76, 0.92], warmMix).map((channel) => channel * colorLift) as [number, number, number];
      const secondary = blendRgb(coolSecondary, [0.14, 0.06, 0.2], warmMix * 0.6);
      const accent = blendRgb(coolAccent, [0.78, 0.34, 1.0], warmMix);

      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(program);
      setVec2('u_resolution', canvas.width, canvas.height);
      setFloat('u_time', timeRef.current);
      setFloat('u_bass', bass);
      setFloat('u_mid', mid);
      setFloat('u_treble', treble);
      setFloat('u_bass_phase', phaseRef.current.bass);
      setFloat('u_treble_phase', phaseRef.current.treble);
      setVec3('u_primary_color', primary);
      setVec3('u_secondary_color', secondary);
      setVec3('u_accent_color', accent);
      setFloat('u_brightness', 0.92 + liveControls.colorY * 0.18 + liveControls.atmosphereX * 0.22 + Math.min(0.42, audio.energy * 0.22 + audio.beat * 0.16));
      setFloat('u_density', 0.92 + liveControls.textureX * 1.35 + liveControls.energyY * 0.42);
      setFloat('u_flow_speed', 0.5 + liveControls.energyX * 0.82 + store.speed * 0.18);
      setFloat('u_void_size', 1.26 - liveControls.structureX * 0.52 + (1 - liveControls.energyY) * 0.24);
      setFloat('u_refraction', 2.0 + liveControls.atmosphereY * 3.6 + liveControls.structureY * 1.1);
      setFloat('u_camera_zoom', 0.72 + Math.sin(timeRef.current * 0.13) * 0.035 - bass * 0.045 + (liveControls.atmosphereY - 0.5) * 0.08);
      setFloat('u_tunnel_speed', 0.78 + liveControls.energyX * 0.94 + liveControls.rhythmX * 0.28);
      setFloat('u_vortex_wrap', 0.32 + liveControls.structureY * 1.55 + liveControls.textureY * 0.45 + audio.spectralFlux * 0.28);
      setFloat('u_sparkle_size', 0.9 + liveControls.textureX * 0.86 + treble * 0.5);
      setFloat('u_sparkle_brightness', 0.9 + liveControls.atmosphereX * 1.1 + liveControls.textureY * 0.55 + treble * 1.2 + audio.transient * 0.6);

      gl.drawArrays(gl.TRIANGLES, 0, 6);
      frameRef.current = requestAnimationFrame(render);
    };

    setShaderError(null);
    frameRef.current = requestAnimationFrame(render);

    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      if (vertexBuffer) gl.deleteBuffer(vertexBuffer);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
      gl.deleteProgram(program);
    };
  }, []);

  if (shaderError) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-black px-6 text-center text-xs font-bold uppercase tracking-widest text-fuchsia-200">
        {shaderError}
      </div>
    );
  }

  return <canvas ref={canvasRef} className="absolute inset-0 block h-full w-full bg-black" aria-label="Purple visual template" />;
}
