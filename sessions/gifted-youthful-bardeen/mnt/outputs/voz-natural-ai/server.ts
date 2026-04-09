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
app.use(express.json());

const EMOTION_PROMPTS: Record<string, string> = {
  neutral:    '',
  cheerful:   'Leia com entusiasmo e alegria: ',
  sad:        'Leia com tristeza e melancolia: ',
  excited:    'Leia com grande animação e energia: ',
  whispering: 'Leia em um sussurro suave e discreto: ',
  angry:      'Leia com raiva e intensidade: ',
  calm:       'Leia com calma e serenidade: ',
  dramatic:   'Leia de forma dramática e impactante: ',
};

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

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`\n🎙️  API local rodando em http://localhost:${PORT}`);
  console.log(`   Proxy do Vite irá encaminhar /api → localhost:${PORT}\n`);
});
