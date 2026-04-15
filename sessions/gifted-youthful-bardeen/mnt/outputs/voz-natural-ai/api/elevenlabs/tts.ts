export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { text, voiceId } = req.body ?? {};

  if (!text || !voiceId) {
    return res.status(400).json({ error: 'Campos "text" e "voiceId" são obrigatórios.' });
  }

  if (text.length > 5000) {
    return res.status(400).json({ error: 'Texto muito longo. Máximo: 5000 caracteres.' });
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: 'ELEVENLABS_API_KEY não configurada no servidor.',
    });
  }

  try {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
          'Accept': 'audio/mpeg',
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_multilingual_v2',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.8,
            style: 0.3,
            use_speaker_boost: true,
          },
        }),
      },
    );

    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).json({ error: `ElevenLabs: ${errText}` });
    }

    const audioArrayBuffer = await response.arrayBuffer();
    const base64Audio = Buffer.from(audioArrayBuffer).toString('base64');
    return res.status(200).json({ audio: base64Audio });
  } catch (err: any) {
    console.error('[ElevenLabs TTS Error]', err?.message ?? err);
    return res.status(500).json({ error: err?.message ?? 'Falha ao gerar áudio ElevenLabs.' });
  }
}
