import type { AudioSourceMode } from '@live-translator/shared';
import workletUrl from './pcm-worklet-processor.js?url';

export interface AudioCaptureCallbacks {
  onPcmFrame: (chunk: ArrayBuffer) => void;
  onLevel: (level: number) => void;
}

export interface AudioCaptureOptions {
  mode: AudioSourceMode;
  deviceId?: string;
  noiseSuppression?: boolean;
  /** Object URL of a user-picked recording (file mode). */
  fileUrl?: string;
  /** Electron desktopCapturer source id (system mode). */
  captureSourceId?: string;
}

/**
 * Owns the Web Audio graph for one session: mic / recorded file / system
 * (Teams, Webex, ...) audio in, PCM16LE 16kHz mono frames out via an
 * AudioWorklet (see pcm-worklet-processor.ts).
 */
export class AudioCapture {
  private ctx: AudioContext | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private sourceNode: MediaStreamAudioSourceNode | MediaElementAudioSourceNode | null = null;
  private silentGain: GainNode | null = null;
  private stream: MediaStream | null = null;
  private mediaEl: HTMLAudioElement | null = null;

  async start(options: AudioCaptureOptions, callbacks: AudioCaptureCallbacks): Promise<void> {
    const AudioCtx = window.AudioContext;
    const ctx = new AudioCtx();
    this.ctx = ctx;
    await ctx.audioWorklet.addModule(workletUrl);

    let source: MediaStreamAudioSourceNode | MediaElementAudioSourceNode;

    if (options.mode === 'mic') {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: options.deviceId ? { exact: options.deviceId } : undefined,
          noiseSuppression: options.noiseSuppression ?? true,
          echoCancellation: true
        }
      });
      this.stream = stream;
      source = ctx.createMediaStreamSource(stream);
    } else if (options.mode === 'file') {
      if (!options.fileUrl) throw new Error('Choose a recorded meeting file first.');
      const el = new Audio(options.fileUrl);
      el.crossOrigin = 'anonymous';
      this.mediaEl = el;
      source = ctx.createMediaElementSource(el);
      source.connect(ctx.destination);
      await el.play();
    } else {
      if (!options.captureSourceId) throw new Error('Choose a window or screen to capture audio from.');
      await window.electronBridge.selectCaptureSource(options.captureSourceId);
      const display = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true
      } as DisplayMediaStreamOptions);
      display.getVideoTracks().forEach((t) => t.stop());
      const audioOnly = new MediaStream(display.getAudioTracks());
      if (audioOnly.getAudioTracks().length === 0) {
        throw new Error('The selected source has no audio track to capture.');
      }
      this.stream = audioOnly;
      source = ctx.createMediaStreamSource(audioOnly);
    }

    this.sourceNode = source;

    const workletNode = new AudioWorkletNode(ctx, 'pcm-worklet-processor');
    workletNode.port.onmessage = (ev: MessageEvent<{ pcm: ArrayBuffer; level: number }>) => {
      callbacks.onPcmFrame(ev.data.pcm);
      callbacks.onLevel(ev.data.level);
    };
    this.workletNode = workletNode;

    const silentGain = ctx.createGain();
    silentGain.gain.value = 0;
    this.silentGain = silentGain;

    source.connect(workletNode);
    workletNode.connect(silentGain);
    silentGain.connect(ctx.destination);
  }

  stop(): void {
    if (this.workletNode) {
      this.workletNode.port.onmessage = null;
      try {
        this.workletNode.disconnect();
      } catch {
        /* ignore */
      }
      this.workletNode = null;
    }
    if (this.sourceNode) {
      try {
        this.sourceNode.disconnect();
      } catch {
        /* ignore */
      }
      this.sourceNode = null;
    }
    if (this.silentGain) {
      try {
        this.silentGain.disconnect();
      } catch {
        /* ignore */
      }
      this.silentGain = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
    if (this.mediaEl) {
      this.mediaEl.pause();
      this.mediaEl = null;
    }
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }
  }
}
