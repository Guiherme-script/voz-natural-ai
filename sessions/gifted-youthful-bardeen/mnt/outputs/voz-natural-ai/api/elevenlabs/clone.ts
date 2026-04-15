import { del } from '@vercel/blob';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Agora recebe a URL do Vercel Blob (não mais base64)
  const { name, blobUrl, audioMime = 'audio/mpeg' } = req.body ?? {};

  if (!name || !blobUrl) {
    return res.status(400).json({ error: 'Campos "name" e "blobUrl" são obrigatórios.' });
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: 'ELEVENLABS_API_KEY não configurada no servidor.',
    });
  }

  try {
    // Baixa o arquivo de áudio do Vercel Blob (sem limite de tamanho)
    const audioResponse = await fetch(blobUrl);
    if (!audioResponse.ok) {
      throw new Error(`Falha ao baixar o áudio do blob: ${audioResponse.status}`);
    }
    const audioBuffer = Buffer.from(await audioResponse.arrayBuffer());

    const ext = audioMime.split('/')[1]?.split(';')[0]?.replace('x-', '') ?? 'mp3';

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

    // Apaga o áudio temporário do blob após clonar
    try { await del(blobUrl); } catch { /* não crítico */ }

    return res.status(200).json({ voiceId: data.voice_id });
  } catch (err: any) {
    console.error('[Clone Error]', err?.message ?? err);
    return res.status(500).json({ error: err?.message ?? 'Falha ao clonar a voz.' });
  }
}
