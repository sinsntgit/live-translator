// Runs on the audio rendering thread (AudioWorkletGlobalScope), which lacks
// the DOM lib types the rest of the app is compiled against — plain JS
// (rather than .ts) sidesteps that, and also avoids Vite/mime-db mapping a
// `.ts` asset URL to the `video/mp2t` MIME type instead of JavaScript.
//
// Replaces the deprecated ScriptProcessorNode approach from the reference
// prototype (see README "Audio pipeline" architecture note): low-pass
// filters, downsamples to 16kHz mono, converts to PCM16LE, and posts each
// chunk plus a live RMS level back to the main thread.

const CHUNK_SIZE = 4096;
const TARGET_SAMPLE_RATE = 16000;
// Below the 8kHz Nyquist of the 16kHz target, so linear-interpolation
// decimation afterwards doesn't fold higher frequencies back down as
// aliasing noise — that noise otherwise erodes exactly the consonant/accent
// detail speech recognition (and human listeners) rely on.
const LOWPASS_CUTOFF_HZ = 7200;
const LOWPASS_Q = Math.SQRT1_2; // Butterworth (maximally flat passband)

// RBJ Audio EQ Cookbook low-pass biquad, run per-sample with persistent
// state across process() calls so there's no discontinuity at chunk
// boundaries (the previous implementation decimated each 4096-sample chunk
// independently with no filtering at all).
function makeLowpass(rate, cutoffHz, q) {
  const w0 = (2 * Math.PI * cutoffHz) / rate;
  const alpha = Math.sin(w0) / (2 * q);
  const cosw0 = Math.cos(w0);
  const a0 = 1 + alpha;
  return {
    b0: ((1 - cosw0) / 2) / a0,
    b1: (1 - cosw0) / a0,
    b2: ((1 - cosw0) / 2) / a0,
    a1: (-2 * cosw0) / a0,
    a2: (1 - alpha) / a0,
    x1: 0,
    x2: 0,
    y1: 0,
    y2: 0
  };
}

function lowpassStep(f, sample) {
  const y = f.b0 * sample + f.b1 * f.x1 + f.b2 * f.x2 - f.a1 * f.y1 - f.a2 * f.y2;
  f.x2 = f.x1;
  f.x1 = sample;
  f.y2 = f.y1;
  f.y1 = y;
  return y;
}

function downsample(float32, inRate, outRate) {
  if (inRate === outRate) return float32;
  const ratio = inRate / outRate;
  const outLen = Math.round(float32.length / ratio);
  const out = new Float32Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const idx = i * ratio;
    const i0 = Math.floor(idx);
    const i1 = Math.min(i0 + 1, float32.length - 1);
    const frac = idx - i0;
    out[i] = float32[i0] * (1 - frac) + float32[i1] * frac;
  }
  return out;
}

function floatTo16BitPCM(float32) {
  const out = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
}

class PcmWorkletProcessor extends AudioWorkletProcessor {
  buffer = [];
  // Only needed when we're actually decimating (native rate > 16kHz).
  lowpass = sampleRate > TARGET_SAMPLE_RATE ? makeLowpass(sampleRate, LOWPASS_CUTOFF_HZ, LOWPASS_Q) : null;

  process(inputs) {
    const channel = inputs[0] && inputs[0][0];
    if (channel) {
      for (let i = 0; i < channel.length; i++) {
        this.buffer.push(this.lowpass ? lowpassStep(this.lowpass, channel[i]) : channel[i]);
      }
      while (this.buffer.length >= CHUNK_SIZE) {
        this.emit(this.buffer.splice(0, CHUNK_SIZE));
      }
    }
    return true;
  }

  emit(chunk) {
    const filtered = Float32Array.from(chunk);
    const down = downsample(filtered, sampleRate, TARGET_SAMPLE_RATE);
    const pcm = floatTo16BitPCM(down);
    let sum = 0;
    for (let i = 0; i < filtered.length; i++) sum += filtered[i] * filtered[i];
    const level = Math.min(1, Math.sqrt(sum / filtered.length) * 6);
    this.port.postMessage({ pcm: pcm.buffer, level }, [pcm.buffer]);
  }
}

registerProcessor('pcm-worklet-processor', PcmWorkletProcessor);
