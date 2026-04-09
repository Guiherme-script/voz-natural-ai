export type VoiceName =
  | 'Puck' | 'Charon' | 'Kore' | 'Fenrir' | 'Zephyr'
  | 'Aoede' | 'Achird' | 'Algenib' | 'Orus' | 'Sulafat'
  | 'Schedar' | 'Rasalgethi' | 'Leda' | 'Vindemiatrix';

export interface TTSOptions {
  text: string;
  voice?: VoiceName;
  emotion?: string;
}

export async function generateSpeech({
  text,
  voice = 'Charon',
  emotion = 'neutral',
}: TTSOptions): Promise<string> {
  const response = await fetch('/api/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, voice, emotion }),
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
