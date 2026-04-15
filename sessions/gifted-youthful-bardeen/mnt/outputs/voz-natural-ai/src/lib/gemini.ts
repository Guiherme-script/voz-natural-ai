import { upload } from '@vercel/blob/client';

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
  if (!audio) throw new Error('Resposta inválida do servidor.');
  return audio;
}

// ── ElevenLabs ─────────────────────────────────────────────────────────────

export interface ClonedVoice {
  id: string;
  name: string;
  createdAt: number;
}

export interface CloneVoiceOptions {
  name: string;
  audioFile: File;           // agora recebe o File diretamente
  signal?: AbortSignal;
}

/**
 * Faz upload do áudio direto do browser → Vercel Blob,
 * depois chama nosso backend com a URL do blob (sem limite de tamanho).
 */
export async function cloneVoice({
  name,
  audioFile,
  signal,
}: CloneVoiceOptions): Promise<ClonedVoice> {

  // 1. Upload direto do browser para o Vercel Blob (sem passar pelo backend)
  const blob = await upload(audioFile.name, audioFile, {
    access: 'public',
    handleUploadUrl: '/api/elevenlabs/upload-token',
  });

  // 2. Envia só a URL (pequena) para o backend que chama o ElevenLabs
  const response = await fetch('/api/elevenlabs/clone', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name,
      blobUrl: blob.url,
      audioMime: audioFile.type || 'audio/mpeg',
    }),
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

/** Gera áudio usando uma voz clonada no ElevenLabs. Retorna base64 MP3. */
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
