// Aumenta o limite do body parser para suportar arquivos de áudio grandes (WAV/MP3)
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '50mb',
    },
  },
};

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { name, audioBase64, audioMime = 'audio/mpeg' } = req.body ?? {};

  if (!name || !audioBase64) {
    return res.status(400).json({ error: 'Campos "name" e "audioBase64" são obrigatórios.' });
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: 'ELEVENLABS_API_KEY não configurada no servidor.',
    });
  }

  try {
    const audioBuffer = Buffer.from(audioBase64, 'base64');
    const ext = audioMime.split('/')[1]?.split(';')[0] ?? 'mp3';

    const form = new FormData();
    const blob = new Blob([audioBuffer], { type: audioMime });
    form.append('name', name);
    form.append('files', blob, `reference.${ext}`);

    const response = await fetch('https://api.elevenlabs.io/v1/voices/add', {
      method: 'POST',
      headers: { 'xi-api-key': apiKey },
      body: form,
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('[ElevenLabs Clone Error]', response.status, errText);
      return res.status(response.status).json({ error: `ElevenLabs: ${errText}` });
    }

    const data = await response.json() as any;
    return res.status(200).json({ voiceId: data.voice_id });
  } catch (err: any) {
    console.error('[Clone Error]', err?.message ?? err);
    return res.status(500).json({ error: err?.message ?? 'Falha ao clonar a voz.' });
  }
}
