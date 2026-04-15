export interface PlaybackHandle {
  promise: Promise<void>;
  stop: () => void;
}

/**
 * Decodes base64 PCM data and plays it using AudioContext.
 * Gemini TTS returns raw PCM at 24000Hz.
 * Returns a handle with { promise, stop } for full playback control.
 */
export function playPCMAudio(
  base64Data: string,
  options: { sampleRate?: number; playbackRate?: number } = {},
): PlaybackHandle {
  const { sampleRate = 24000, playbackRate = 1.0 } = options;

  const binaryString = atob(base64Data);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  // PCM data is 16-bit Little Endian
  const int16Array = new Int16Array(bytes.buffer);
  const float32Array = new Float32Array(int16Array.length);
  for (let i = 0; i < int16Array.length; i++) {
    float32Array[i] = int16Array[i] / 32768;
  }

  const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  const buffer = audioCtx.createBuffer(1, float32Array.length, sampleRate);
  buffer.getChannelData(0).set(float32Array);

  const source = audioCtx.createBufferSource();
  source.buffer = buffer;
  source.playbackRate.value = Math.max(0.25, Math.min(4.0, playbackRate));
  source.connect(audioCtx.destination);
  source.start();

  let finished = false;

  const stop = () => {
    if (!finished) {
      finished = true;
      try { source.stop(); } catch { /* already stopped */ }
      try { audioCtx.close(); } catch { /* already closed */ }
    }
  };

  const promise = new Promise<void>((resolve) => {
    source.onended = () => {
      if (!finished) {
        finished = true;
        try { audioCtx.close(); } catch { /* already closed */ }
      }
      resolve();
    };
  });

  return { promise, stop };
}

/**
 * Plays MP3/encoded audio (e.g., from ElevenLabs) using Web Audio API.
 * Returns a handle with { promise, stop }.
 */
export async function playMP3Audio(
  base64Data: string,
  playbackRate: number = 1.0,
): Promise<PlaybackHandle> {
  const binaryString = atob(base64Data);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  const audioBuffer = await audioCtx.decodeAudioData(bytes.buffer.slice(0));

  const source = audioCtx.createBufferSource();
  source.buffer = audioBuffer;
  source.playbackRate.value = Math.max(0.25, Math.min(4.0, playbackRate));
  source.connect(audioCtx.destination);
  source.start();

  let finished = false;

  const stop = () => {
    if (!finished) {
      finished = true;
      try { source.stop(); } catch { /* already stopped */ }
      try { audioCtx.close(); } catch { /* already closed */ }
    }
  };

  const promise = new Promise<void>((resolve) => {
    source.onended = () => {
      if (!finished) {
        finished = true;
        try { audioCtx.close(); } catch { /* already closed */ }
      }
      resolve();
    };
  });

  return { promise, stop };
}

/**
 * Converts base64 PCM data to a downloadable WAV Blob.
 */
export function pcmToWav(base64Data: string, sampleRate: number = 24000): Blob {
  const binaryString = atob(base64Data);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  const buffer = bytes.buffer;
  const wavHeader = new ArrayBuffer(44);
  const view = new DataView(wavHeader);

  view.setUint32(0, 0x52494646, false); // "RIFF"
  view.setUint32(4, 36 + buffer.byteLength, true);
  view.setUint32(8, 0x57415645, false); // "WAVE"
  view.setUint32(12, 0x666d7420, false); // "fmt "
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  view.setUint32(36, 0x64617461, false); // "data"
  view.setUint32(40, buffer.byteLength, true);

  return new Blob([wavHeader, buffer], { type: 'audio/wav' });
}

/**
 * Converts base64 MP3 to a downloadable Blob.
 */
export function mp3ToBlob(base64Data: string): Blob {
  const binaryString = atob(base64Data);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return new Blob([bytes], { type: 'audio/mpeg' });
}
