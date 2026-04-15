import { upload } from '@vercel/blob/client';

// Em produção aponta para o Railway; em dev é vazio (Vite proxy cuida)
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — import.meta.env é injetado pelo Vite em runtime
const API_BASE: string = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_URL) ?? '';

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
  const response = await fetch(`${API_BASE}/api/tts`, {
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
  audioFile: File;
  signal?: AbortSignal;
}

/**
 * Faz upload do áudio direto do browser → Vercel Blob,
 * depois chama o backend com a URL (sem limite de tamanho).
 */
export async function cloneVoice({
  name,
  audioFile,
  signal,
}: CloneVoiceOptions): Promise<ClonedVoice> {

  // Upload direto browser → Vercel Blob (sem passar pelo backend)
  const blob = await upload(audioFile.name, audioFile, {
    access: 'public',
    handleUploadUrl: `${API_BASE}/api/elevenlabs/upload-token`,
  });

  // Envia só a URL (pequena) para o backend clonar no ElevenLabs
  const response = await fetch(`${API_BASE}/api/elevenlabs/clone`, {
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

export async function generateSpeechElevenLabs({
  text,
  voiceId,
  signal,
}: ElevenLabsTTSOptions): Promise<string> {
  const response = await fetch(`${API_BASE}/api/elevenlabs/tts`, {
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
