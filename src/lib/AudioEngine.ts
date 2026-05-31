export type MicrophoneStatus = 'disconnected' | 'requesting' | 'connected' | 'receiving' | 'low' | 'error';

export interface AudioDebugSnapshot {
  status: MicrophoneStatus;
  message: string;
  contextState: string;
  streamActive: boolean;
  rawRms: number;
  rawVolume: number;
  frequencyDelta: number;
  frequencyChanged: boolean;
  peakFrequencyBin: number;
  sampleRate: number;
  sourceType: 'none' | 'mic' | 'music' | 'api';
}

export class AudioEngine {
  private static instance: AudioEngine;
  
  public context: AudioContext | null = null;
  public analyser: AnalyserNode | null = null;
  public dataArray: Uint8Array<ArrayBuffer> | null = null;
  public timeDataArray: Uint8Array<ArrayBuffer> | null = null;
  public source: MediaStreamAudioSourceNode | null = null;
  public stream: MediaStream | null = null;
  public activeSourceType: 'none' | 'mic' | 'music' | 'api' = 'none';
  private highPass: BiquadFilterNode | null = null;
  private lowPass: BiquadFilterNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private musicInput: GainNode | null = null;
  private musicOutput: GainNode | null = null;
  private musicNodes: AudioNode[] = [];
  
  // Expose analyzed data for Three.js to read synchronously without React state overhead
  public current = {
    volume: 0,
    subBass: 0, // 20-60Hz
    bass: 0,    // 60-250Hz
    lowMid: 0,  // 250-500Hz
    mid: 0,     // 500-2000Hz
    highMid: 0, // 2000-6000Hz
    treble: 0,  // 6000-20000Hz
    energy: 0,
    beat: 0,
    spectralCentroid: 0,
    spectralFlux: 0,
    transient: 0,
    dynamicRange: 0,
  };

  public debug: AudioDebugSnapshot = {
    status: 'disconnected',
    message: 'Microphone is not connected.',
    contextState: 'none',
    streamActive: false,
    rawRms: 0,
    rawVolume: 0,
    frequencyDelta: 0,
    frequencyChanged: false,
    peakFrequencyBin: 0,
    sampleRate: 0,
    sourceType: 'none',
  };

  private beatThreshold = 1.3;
  private energyHistory: number[] = new Array(64).fill(0);
  private energyIndex = 0;
  private adaptivePeak = 0.18;
  private previousBands = {
    subBass: 0,
    bass: 0,
    lowMid: 0,
    mid: 0,
    highMid: 0,
    treble: 0,
  };
  private previousFrequencyFrame: Uint8Array<ArrayBuffer> | null = null;

  private constructor() {}

  public static getInstance(): AudioEngine {
    if (!AudioEngine.instance) {
      AudioEngine.instance = new AudioEngine();
    }
    return AudioEngine.instance;
  }

  public isSimulating: boolean = false;
  private simTime: number = 0;

  private resetCurrent() {
    this.current = {
      volume: 0,
      subBass: 0,
      bass: 0,
      lowMid: 0,
      mid: 0,
      highMid: 0,
      treble: 0,
      energy: 0,
      beat: 0,
      spectralCentroid: 0,
      spectralFlux: 0,
      transient: 0,
      dynamicRange: 0,
    };
    this.energyHistory.fill(0);
    this.energyIndex = 0;
    this.adaptivePeak = 0.18;
    this.previousBands = {
      subBass: 0,
      bass: 0,
      lowMid: 0,
      mid: 0,
      highMid: 0,
      treble: 0,
    };
    this.previousFrequencyFrame = null;
    this.debug.rawRms = 0;
    this.debug.rawVolume = 0;
    this.debug.frequencyDelta = 0;
    this.debug.frequencyChanged = false;
    this.debug.peakFrequencyBin = 0;
  }

  private setDebug(next: Partial<AudioDebugSnapshot>) {
    this.debug = {
      ...this.debug,
      contextState: this.context?.state ?? 'none',
      streamActive: Boolean(this.stream?.getAudioTracks().some((track) => track.readyState === 'live')),
      sampleRate: this.context?.sampleRate ?? 0,
      sourceType: this.activeSourceType,
      ...next,
    };
  }

  private async ensureContext(): Promise<AudioContext> {
    const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextCtor) {
      throw new Error('This browser does not support Web Audio API.');
    }
    if (!this.context || this.context.state === 'closed') {
      this.context = new AudioContextCtor();
    }
    if (this.context.state === 'suspended') {
      await this.context.resume();
    }
    return this.context;
  }

  private createAnalyser(context: AudioContext) {
    this.analyser?.disconnect();
    this.analyser = context.createAnalyser();
    this.analyser.fftSize = 4096;
    this.analyser.smoothingTimeConstant = 0.68;
    this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.timeDataArray = new Uint8Array(this.analyser.fftSize);
  }

  private stopActiveNodes() {
    this.source?.disconnect();
    this.stream?.getTracks().forEach((track) => track.stop());
    this.highPass?.disconnect();
    this.lowPass?.disconnect();
    this.compressor?.disconnect();
    this.musicInput?.disconnect();
    this.musicOutput?.disconnect();
    this.musicNodes.forEach((node) => {
      try {
        if ('stop' in node && typeof (node as any).stop === 'function') {
          (node as any).stop();
        }
      } catch {
        // Node may already be stopped.
      }
      try {
        node.disconnect();
      } catch {
        // Node may already be disconnected.
      }
    });
    this.source = null;
    this.stream = null;
    this.highPass = null;
    this.lowPass = null;
    this.compressor = null;
    this.musicInput = null;
    this.musicOutput = null;
    this.musicNodes = [];
  }

  public stopCurrentAudioSource() {
    this.stopActiveNodes();
    this.analyser?.disconnect();
    this.analyser = null;
    this.dataArray = null;
    this.timeDataArray = null;
    this.activeSourceType = 'none';
    this.isSimulating = false;
    this.resetCurrent();
    this.setDebug({ status: 'disconnected', message: 'Microphone is not connected.' });
  }

  public async initialize(): Promise<void> {
    await this.startMicrophone();
  }

  public async startMicrophone(): Promise<void> {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      throw new Error('This browser does not support microphone capture.');
    }
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (!window.isSecureContext && !isLocalhost) {
      throw new Error('Microphone capture requires localhost or HTTPS.');
    }

    try {
      this.setDebug({ status: 'requesting', message: 'Waiting for microphone permission.' });
      const context = await this.ensureContext();
      this.stopCurrentAudioSource();
      this.setDebug({ status: 'requesting', message: 'Browser permission prompt is open.' });
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
        video: false,
      });
      this.createAnalyser(context);

      this.highPass = context.createBiquadFilter();
      this.highPass.type = 'highpass';
      this.highPass.frequency.value = 55;
      this.highPass.Q.value = 0.7;

      this.lowPass = context.createBiquadFilter();
      this.lowPass.type = 'lowpass';
      this.lowPass.frequency.value = 15500;
      this.lowPass.Q.value = 0.5;

      this.compressor = context.createDynamicsCompressor();
      this.compressor.threshold.value = -42;
      this.compressor.knee.value = 18;
      this.compressor.ratio.value = 3.2;
      this.compressor.attack.value = 0.004;
      this.compressor.release.value = 0.16;
      
      this.stream = stream;
      this.source = context.createMediaStreamSource(stream);
      this.source.connect(this.highPass);
      this.highPass.connect(this.lowPass);
      this.lowPass.connect(this.compressor);
      this.compressor.connect(this.analyser!);
      
      this.activeSourceType = 'mic';
      this.isSimulating = false;
      this.resetCurrent();
      this.setDebug({ status: 'connected', message: 'Microphone is connected. Listening for input.' });
    } catch (err) {
      this.stopCurrentAudioSource();
      this.isSimulating = false;
      this.setDebug({ status: 'error', message: err instanceof Error ? err.message : 'Could not start microphone.' });
      throw err;
    }
  }

  public async startMusicSource(volume = 1): Promise<{ context: AudioContext; input: GainNode; output: GainNode }> {
    const context = await this.ensureContext();
    this.stopCurrentAudioSource();
    this.createAnalyser(context);
    this.musicInput = context.createGain();
    this.musicOutput = context.createGain();
    this.musicInput.gain.value = 1;
    this.musicOutput.gain.value = volume;
    this.musicInput.connect(this.analyser!);
    this.musicInput.connect(this.musicOutput);
    this.musicOutput.connect(context.destination);
    this.activeSourceType = 'music';
    this.isSimulating = false;
    this.resetCurrent();
    this.setDebug({ status: 'disconnected', message: 'Microphone is not connected.' });
    return { context, input: this.musicInput, output: this.musicOutput };
  }

  public async ensureMusicSource(volume = 1): Promise<{ context: AudioContext; input: GainNode; output: GainNode }> {
    if (this.activeSourceType === 'music' && this.musicInput && this.musicOutput && this.context) {
      await this.resume();
      this.musicOutput.gain.value = volume;
      return { context: this.context, input: this.musicInput, output: this.musicOutput };
    }
    return this.startMusicSource(volume);
  }

  public setMusicVolume(volume: number) {
    if (this.musicOutput && this.context) {
      this.musicOutput.gain.setTargetAtTime(volume, this.context.currentTime, 0.03);
    }
  }

  public registerMusicNode(node: AudioNode) {
    this.musicNodes.push(node);
  }

  public setExternalSnapshot(next: Partial<typeof this.current>) {
    if (this.activeSourceType !== 'api') {
      this.stopCurrentAudioSource();
      this.activeSourceType = 'api';
    }
    this.current = {
      volume: Math.max(this.current.volume * 0.45, next.volume ?? 0),
      subBass: Math.max(this.current.subBass * 0.45, next.subBass ?? 0),
      bass: Math.max(this.current.bass * 0.45, next.bass ?? 0),
      lowMid: Math.max(this.current.lowMid * 0.45, next.lowMid ?? 0),
      mid: Math.max(this.current.mid * 0.45, next.mid ?? 0),
      highMid: Math.max(this.current.highMid * 0.45, next.highMid ?? 0),
      treble: Math.max(this.current.treble * 0.45, next.treble ?? 0),
      energy: Math.max(this.current.energy * 0.45, next.energy ?? 0),
      beat: Math.max(this.current.beat * 0.22, next.beat ?? 0),
      spectralCentroid: next.spectralCentroid ?? this.current.spectralCentroid,
      spectralFlux: Math.max(this.current.spectralFlux * 0.22, next.spectralFlux ?? 0),
      transient: Math.max(this.current.transient * 0.22, next.transient ?? 0),
      dynamicRange: Math.max(this.current.dynamicRange * 0.45, next.dynamicRange ?? 0),
    };
  }

  public async resume(): Promise<void> {
    if (this.context?.state === 'suspended') {
      await this.context.resume();
    }
  }

  public stopMicrophone(closeContext = false) {
    this.stopCurrentAudioSource();

    if (closeContext && this.context) {
      void this.context.close();
      this.context = null;
    }
  }

  public hasLiveInput(): boolean {
    return Boolean(this.analyser && this.stream?.getAudioTracks().some((track) => track.readyState === 'live'));
  }

  public update(gain: number = 1.0, config?: { subBassSense: number; bassSense: number; midSense: number; trebleSense: number; noiseGate: number; beatMultiplier: number }): void {
    if (this.isSimulating) {
      this.simTime += 0.016;
      const beat = Math.pow(Math.sin(this.simTime * 4), 2);
      this.current.volume = (0.2 + beat * 0.3) * gain;
      this.current.subBass = beat * 1.5 * gain;
      this.current.bass = beat * 0.8 * gain;
      this.current.lowMid = (Math.sin(this.simTime * 2) * 0.2 + 0.3) * gain;
      this.current.mid = (Math.sin(this.simTime * 4) * 0.2 + 0.3) * gain;
      this.current.highMid = (Math.sin(this.simTime * 6) * 0.1 + 0.2) * gain;
      this.current.treble = (Math.sin(this.simTime * 8) * 0.1 + 0.2) * gain;
      this.current.energy = this.current.volume;
      this.current.beat = beat > 0.8 ? 1 : 0;
      this.current.spectralCentroid = 0.35 + Math.sin(this.simTime * 1.3) * 0.15;
      this.current.spectralFlux = Math.max(0, Math.sin(this.simTime * 7.5)) * 0.6;
      this.current.transient = this.current.beat;
      this.current.dynamicRange = 0.55;
      return;
    }

    if (!this.analyser || !this.dataArray || !this.timeDataArray) return;

    this.analyser.getByteFrequencyData(this.dataArray);
    this.analyser.getByteTimeDomainData(this.timeDataArray);

    const data = this.dataArray;
    const length = data.length; // 1024 bins at 44100Hz = ~21.5Hz per bin
    
    const noiseGate = (config?.noiseGate ?? 0.1) * 255 * 0.75;
    const rmsGate = 0.018 + (config?.noiseGate ?? 0.1) * 0.18;

    // Frequencies approximate mappings:
    // Sub: 20-60Hz -> bins 1-3
    // Bass: 60-250Hz -> bins 3-12
    // LowMid: 250-500Hz -> bins 12-24
    // Mid: 500-2000Hz -> bins 24-93
    // HighMid: 2000-6000Hz -> bins 93-280
    // Treble: 6000-20000Hz -> bins 280+

    let vSum = 0, subSum = 0, bSum = 0, lmSum = 0, mSum = 0, hmSum = 0, tSum = 0;
    let weightedFrequencySum = 0;
    let audibleSum = 0;
    let peakFrequencyBin = 0;
    let peakFrequencyValue = 0;
    let frequencyDeltaSum = 0;
    const needsDebugFrequency = this.activeSourceType === 'mic';

    for (let i = 0; i < length; i++) {
      let val = data[i];
      if (needsDebugFrequency && val > peakFrequencyValue) {
        peakFrequencyValue = val;
        peakFrequencyBin = i;
      }
      if (needsDebugFrequency && this.previousFrequencyFrame) {
        frequencyDeltaSum += Math.abs(data[i] - this.previousFrequencyFrame[i]);
      }
      if (val < noiseGate) val = 0;
      vSum += val;
      const normalizedFrequency = i / Math.max(1, length - 1);
      weightedFrequencySum += val * normalizedFrequency;
      audibleSum += val;

      if (i >= 1 && i < 3) subSum += val;
      else if (i >= 3 && i < 12) bSum += val;
      else if (i >= 12 && i < 24) lmSum += val;
      else if (i >= 24 && i < 93) mSum += val;
      else if (i >= 93 && i < 280) hmSum += val;
      else if (i >= 280) tSum += val;
    }
    if (needsDebugFrequency) {
      if (!this.previousFrequencyFrame || this.previousFrequencyFrame.length !== data.length) {
        this.previousFrequencyFrame = new Uint8Array(data.length);
      }
      this.previousFrequencyFrame.set(data);
    }
    const frequencyDelta = needsDebugFrequency ? frequencyDeltaSum / length / 255 : 0;

    const subSense = config?.subBassSense ?? 1.0;
    const bassSense = config?.bassSense ?? 1.0;
    const midSense = config?.midSense ?? 1.0;
    const trebSense = config?.trebleSense ?? 1.0;
    const bm = config?.beatMultiplier ?? 1.0;

    let rmsSum = 0;
    for (let i = 0; i < this.timeDataArray.length; i++) {
      const centered = (this.timeDataArray[i] - 128) / 128;
      rmsSum += centered * centered;
    }
    const rms = Math.sqrt(rmsSum / this.timeDataArray.length);
    const gatedRms = Math.max(0, rms - rmsGate);

    const freqVolume = (vSum / length / 255) * gain;
    const rawVolume = Math.max(freqVolume * 2.6, gatedRms * 5.5) * gain;
    const ungatedRawVolume = Math.max(freqVolume * 2.6, rms * 5.5) * gain;
    this.adaptivePeak = Math.max(rawVolume, this.adaptivePeak * 0.996, 0.16);
    const volume = Math.min(1, Math.pow(rawVolume / (this.adaptivePeak + 0.001), 0.95));

    const subRaw = (subSum / 2 / 255) * gain * subSense;
    const bassRaw = (bSum / 9 / 255) * gain * bassSense;
    const lowMidRaw = (lmSum / 12 / 255) * gain * midSense;
    const midRaw = (mSum / 69 / 255) * gain * midSense;
    const highMidRaw = (hmSum / 187 / 255) * gain * trebSense;
    const trebleRaw = (tSum / (length - 280) / 255) * gain * trebSense;

    const boostBand = (value: number, floorShare = 0.12) => (
      Math.min(1, Math.pow(Math.max(value * 3.1, volume * floorShare), 0.95))
    );

    const targetBands = {
      subBass: boostBand(subRaw, 0.12),
      bass: boostBand(bassRaw, 0.14),
      lowMid: boostBand(lowMidRaw, 0.1),
      mid: boostBand(midRaw, 0.09),
      highMid: boostBand(highMidRaw, 0.07),
      treble: boostBand(trebleRaw, 0.06),
    };

    const positiveBandChange =
      Math.max(0, targetBands.subBass - this.previousBands.subBass) * 0.9 +
      Math.max(0, targetBands.bass - this.previousBands.bass) * 1.1 +
      Math.max(0, targetBands.lowMid - this.previousBands.lowMid) * 0.85 +
      Math.max(0, targetBands.mid - this.previousBands.mid) * 0.75 +
      Math.max(0, targetBands.highMid - this.previousBands.highMid) * 0.7 +
      Math.max(0, targetBands.treble - this.previousBands.treble) * 0.9;

    this.previousBands = targetBands;

    this.current.volume += (volume - this.current.volume) * 0.22;
    this.current.subBass += (targetBands.subBass - this.current.subBass) * 0.22;
    this.current.bass += (targetBands.bass - this.current.bass) * 0.22;
    this.current.lowMid += (targetBands.lowMid - this.current.lowMid) * 0.2;
    this.current.mid += (targetBands.mid - this.current.mid) * 0.2;
    this.current.highMid += (targetBands.highMid - this.current.highMid) * 0.18;
    this.current.treble += (targetBands.treble - this.current.treble) * 0.18;

    const spectralCentroid = audibleSum > 0 ? weightedFrequencySum / audibleSum : 0;
    const lowEnergy = this.current.subBass + this.current.bass;
    const highEnergy = this.current.highMid + this.current.treble;
    const dynamicRange = Math.min(1, Math.max(0, Math.abs(highEnergy - lowEnergy) * 0.55 + Math.min(1, rms * 4.5) * 0.25));
    const spectralFlux = Math.min(1, positiveBandChange * 0.78);
    const transient = Math.min(1.35, spectralFlux * 0.85 + Math.max(0, volume - this.current.energy) * 2.2);

    this.current.spectralCentroid += (spectralCentroid - this.current.spectralCentroid) * 0.18;
    this.current.spectralFlux += (spectralFlux - this.current.spectralFlux) * 0.38;
    this.current.transient += (transient - this.current.transient) * 0.45;
    this.current.dynamicRange += (dynamicRange - this.current.dynamicRange) * 0.16;

    // Advanced Energy & Beat Detection
    const instantaneousEnergy = this.current.volume;
    this.energyHistory[this.energyIndex] = instantaneousEnergy;
    this.energyIndex = (this.energyIndex + 1) % this.energyHistory.length;

    let localEnergyAverage = 0;
    for (let i = 0; i < this.energyHistory.length; i++) {
        localEnergyAverage += this.energyHistory[i];
    }
    localEnergyAverage /= this.energyHistory.length;

    this.current.energy += (instantaneousEnergy - this.current.energy) * 0.22;

    // Beat Detection (Sudden peak in energy compared to local average)
    const ratio = instantaneousEnergy / (localEnergyAverage + 0.001);
    if ((ratio > 1.55 && instantaneousEnergy > 0.14) || this.current.transient > 0.72) {
        this.current.beat = Math.min(1.6, ratio * bm * 0.75);
    } else {
        this.current.beat *= 0.62;
    }

    if (this.activeSourceType === 'mic') {
      const receiving = ungatedRawVolume > 0.04 || frequencyDelta > 0.006;
      this.setDebug({
        status: receiving ? 'receiving' : 'low',
        message: receiving ? 'Receiving microphone signal.' : 'Input volume is too low.',
        rawRms: rms,
        rawVolume: ungatedRawVolume,
        frequencyDelta,
        frequencyChanged: frequencyDelta > 0.006,
        peakFrequencyBin,
      });
    }
  }

  public getDebugSnapshot(): AudioDebugSnapshot {
    return { ...this.debug };
  }

  public destroy() {
    this.stopCurrentAudioSource();
    if (this.context) {
      void this.context.close();
      this.context = null;
    }
  }
}

export const audioEngine = AudioEngine.getInstance();
