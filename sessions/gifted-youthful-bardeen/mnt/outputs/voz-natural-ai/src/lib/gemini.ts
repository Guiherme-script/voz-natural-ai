export type VoiceName =
  | 'Puck' | 'Charon' | 'Kore' | 'Fenrir' | 'Zephyr'
  | 'Aoede' | 'Achird' | 'Algenib' | 'Orus' | 'Sulafat'
  | 'Schedar' | 'Rasalgethi' | 'Leda' | 'Vindemiatrix';

export interface TTSOptions {
  text: string;
  voice?: VoiceName;
  emotion?: string;
  signal?: AbortSignal;
}

export async function generateSpeech({
  text,
  voice = 'Charon',
  emotion = 'neutral',
  signal,
}: TTSOptions): Promise<string> {
  const response = await fetch('/api/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, voice, emotion }),
    signal,
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error ?? `Erro HTTP ${response.status}`);
  }

  const { audio } = await response.json();

  if (!audio) {
    throw new Error('Resposta inválida do servidor.');
  }

  return audio;
}

// ── ElevenLabs ─────────────────────────────────────────────────────────────

export interface CloneVoiceOptions {
  name: string;
  audioBase64: string;
  audioMime?: string;
  signal?: AbortSignal;
}

export interface ClonedVoice {
  id: string;
  name: string;
  createdAt: number;
}

/** Sends an audio reference to our server, which clones it via ElevenLabs. */
export async function cloneVoice({
  name,
  audioBase64,
  audioMime = 'audio/mpeg',
  signal,
}: CloneVoiceOptions): Promise<ClonedVoice> {
  const response = await fetch('/api/elevenlabs/clone', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, audioBase64, audioMime }),
    signal,
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error ?? `Erro ao clonar voz (HTTP ${response.status})`);
  }

  const { voiceId } = await response.json();
  return { id: voiceId, name, createdAt: Date.now() };
}

export interface ElevenLabsTTSOptions {
  text: string;
  voiceId: string;
  signal?: AbortSignal;
}

/** Generates speech using a cloned ElevenLabs voice. Returns base64 MP3. */
export async function generateSpeechElevenLabs({
  text,
  voiceId,
  signal,
}: ElevenLabsTTSOptions): Promise<string> {
  const response = await fetch('/api/elevenlabs/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, voiceId }),
    signal,
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error ?? `Erro ElevenLabs (HTTP ${response.status})`);
  }

  const { audio } = await response.json();
  if (!audio) throw new Error('Resposta inválida do servidor ElevenLabs.');
  return audio;
}
