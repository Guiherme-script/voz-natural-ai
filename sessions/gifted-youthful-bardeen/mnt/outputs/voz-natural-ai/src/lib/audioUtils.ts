/**
 * Decodes base64 PCM data and plays it using AudioContext.
 * Gemini TTS returns raw PCM at 24000Hz.
 */
export async function playPCMAudio(base64Data: string, sampleRate: number = 24000) {
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
    // Convert Int16 to Float32 [-1.0, 1.0]
    float32Array[i] = int16Array[i] / 32768;
  }

  const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  const buffer = audioCtx.createBuffer(1, float32Array.length, sampleRate);
  buffer.getChannelData(0).set(float32Array);

  const source = audioCtx.createBufferSource();
  source.buffer = buffer;
  source.connect(audioCtx.destination);
  source.start();

  return new Promise<void>((resolve) => {
    source.onended = () => {
      audioCtx.close();
      resolve();
    };
  });
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

  // RIFF identifier
  view.setUint32(0, 0x52494646, false); // "RIFF"
  // file length
  view.setUint32(4, 36 + buffer.byteLength, true);
  // RIFF type
  view.setUint32(8, 0x57415645, false); // "WAVE"
  // format chunk identifier
  view.setUint32(12, 0x666d7420, false); // "fmt "
  // format chunk length
  view.setUint32(16, 16, true);
  // sample format (raw PCM)
  view.setUint16(20, 1, true);
  // channel count
  view.setUint16(22, 1, true);
  // sample rate
  view.setUint32(24, sampleRate, true);
  // byte rate (sample rate * block align)
  view.setUint32(28, sampleRate * 2, true);
  // block align (channel count * bytes per sample)
  view.setUint16(32, 2, true);
  // bits per sample
  view.setUint16(34, 16, true);
  // data chunk identifier
  view.setUint32(36, 0x64617461, false); // "data"
  // data chunk length
  view.setUint32(40, buffer.byteLength, true);

  return new Blob([wavHeader, buffer], { type: 'audio/wav' });
}
