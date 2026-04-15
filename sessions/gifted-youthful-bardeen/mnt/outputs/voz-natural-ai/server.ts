/**
 * server.ts — Servidor Express local para desenvolvimento.
 *
 * Replica a mesma lógica da API Route do Vercel (api/tts.ts),
 * permitindo rodar tudo localmente sem precisar do `vercel dev`.
 *
 * Usage:
 *   npm run dev          (inicia Vite + este servidor juntos via concurrently)
 *   npm run dev:api      (somente este servidor, porta 3001)
 */

import express from 'express';
import dotenv from 'dotenv';
import { GoogleGenAI, Modality } from '@google/genai';

dotenv.config({ path: '.env.local' });

const app = express();
app.use(express.json({ limit: '50mb' }));

// ─────────────────────────────────────────────────────────────────────────────
// Prompts emocionais aprimorados — instruções detalhadas para o modelo TTS
// ─────────────────────────────────────────────────────────────────────────────
const EMOTION_PROMPTS: Record<string, string> = {
  neutral: '',

  cheerful:
    'Leia o texto a seguir com voz animada, sorridente e cheia de energia positiva. ' +
    'Como alguém que está genuinamente feliz e quer transmitir boa disposição. ' +
    'Use entonação ascendente e ritmo leve: ',

  excited:
    'Leia com empolgação intensa e euforia. A voz deve soar acelerada, com ênfase ' +
    'exagerada nas palavras-chave, como alguém que acabou de receber uma notícia incrível. ' +
    'Variações de tom marcadas, ritmo rápido e energia contagiante: ',

  calm:
    'Leia de forma profundamente serena e pausada, como uma meditação guiada. ' +
    'Voz suave, respiração calma entre as frases, ritmo lento e tranquilizador, ' +
    'sem qualquer pressa ou tensão: ',

  sad:
    'Leia com voz carregada de tristeza e melancolia. Tom baixo, pausas lentas, ' +
    'como alguém que está contendo as lágrimas e carrega um peso emocional profundo. ' +
    'Evite qualquer leveza — cada palavra deve soar pesada e sentida: ',

  angry:
    'Leia com raiva intensa e contida. Voz tensa e firme, articulação forte e cortante, ' +
    'como alguém que perdeu a paciência mas ainda tenta se controlar. ' +
    'Ritmo incisivo, ênfase dura nas consoantes: ',

  whispering:
    'Leia em sussurro íntimo e suave, como se estivesse contando um segredo muito importante ' +
    'ao ouvido de alguém. Voz muito baixa, próxima, quase inaudível, com pausas discretas ' +
    'e ar de confidencialidade: ',

  dramatic:
    'Leia de forma teatral, grandiosamente impactante, como um narrador de trailer de cinema. ' +
    'Use pausas dramáticas longas antes das palavras-chave, variações extremas de volume e tom, ' +
    'como se cada frase fosse a mais importante já dita: ',

  serious:
    'Leia com tom completamente sério, firme e autoritário. Sem qualquer traço de leveza, ' +
    'sorriso ou descontração. Como um comunicado formal importante, um juiz lendo uma sentença ' +
    'ou um general dando uma ordem: ',

  sarcastic:
    'Leia com ironia e sarcasmo evidente. Prolongue certas palavras, use entonação descendente ' +
    'no final das frases, como alguém que claramente não acredita no que está dizendo. ' +
    'Pausas estratégicas para dar ênfase ao tom irônico: ',
};

// ─────────────────────────────────────────────────────────────────────────────
// Gemini TTS
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/tts', async (req, res) => {
  const { text, voice = 'Charon', emotion = 'neutral' } = req.body ?? {};

  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return res.status(400).json({ error: 'O campo "text" é obrigatório.' });
  }

  if (text.length > 5000) {
    return res.status(400).json({ error: 'Texto muito longo. Máximo: 5000 caracteres.' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: 'GEMINI_API_KEY não encontrada. Crie o arquivo .env.local com a chave.',
    });
  }

  const prefix = EMOTION_PROMPTS[emotion] ?? '';
  const prompt = prefix ? `${prefix}${text}` : text;

  try {
    const ai = new GoogleGenAI({ apiKey });

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-preview-tts',
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voice },
          },
        },
      },
    });

    const base64Audio =
      response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

    if (!base64Audio) {
      return res.status(500).json({ error: 'Nenhum dado de áudio recebido da API.' });
    }

    res.json({ audio: base64Audio });
  } catch (err: any) {
    console.error('[TTS Error]', err?.message ?? err);
    res.status(500).json({ error: err?.message ?? 'Falha ao gerar o áudio.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ElevenLabs — Clonagem de Voz
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/elevenlabs/clone', async (req, res) => {
  const { name, audioBase64, audioMime = 'audio/mpeg' } = req.body ?? {};

  if (!name || !audioBase64) {
    return res.status(400).json({ error: 'Campos "name" e "audioBase64" são obrigatórios.' });
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: 'ELEVENLABS_API_KEY não encontrada. Adicione-a ao arquivo .env.local.',
    });
  }

  try {
    // Decode base64 to buffer
    const audioBuffer = Buffer.from(audioBase64, 'base64');

    // Build multipart form data
    const { FormData, Blob } = await import('node:buffer').catch(
      () => import('buffer'),
    ) as any;

    // Use global FormData (Node 18+) or fallback
    const form = new (globalThis.FormData ?? FormData)();
    const ext = audioMime.split('/')[1] ?? 'mp3';
    const blob = new (globalThis.Blob ?? Blob)([audioBuffer], { type: audioMime });
    form.append('name', name);
    form.append('files', blob, `reference.${ext}`);

    const response = await fetch('https://api.elevenlabs.io/v1/voices/add', {
      method: 'POST',
      headers: { 'xi-api-key': apiKey },
      body: form,
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('[ElevenLabs Clone Error]', errText);
      return res.status(response.status).json({ error: `ElevenLabs: ${errText}` });
    }

    const data = await response.json() as any;
    res.json({ voiceId: data.voice_id });
  } catch (err: any) {
    console.error('[Clone Error]', err?.message ?? err);
    res.status(500).json({ error: err?.message ?? 'Falha ao clonar a voz.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ElevenLabs — TTS com voz clonada
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/elevenlabs/tts', async (req, res) => {
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
      error: 'ELEVENLABS_API_KEY não encontrada. Adicione-a ao arquivo .env.local.',
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
      console.error('[ElevenLabs TTS Error]', errText);
      return res.status(response.status).json({ error: `ElevenLabs: ${errText}` });
    }

    const audioArrayBuffer = await response.arrayBuffer();
    const base64Audio = Buffer.from(audioArrayBuffer).toString('base64');
    res.json({ audio: base64Audio });
  } catch (err: any) {
    console.error('[ElevenLabs TTS Error]', err?.message ?? err);
    res.status(500).json({ error: err?.message ?? 'Falha ao gerar áudio ElevenLabs.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`\n🎙️  API local rodando em http://localhost:${PORT}`);
  console.log(`   Proxy do Vite irá encaminhar /api → localhost:${PORT}\n`);
});
