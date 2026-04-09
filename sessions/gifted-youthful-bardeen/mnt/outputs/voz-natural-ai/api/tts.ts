import { GoogleGenAI, Modality } from "@google/genai";

const EMOTION_PROMPTS: Record<string, string> = {
  neutral: '',
  cheerful: 'Leia com entusiasmo e alegria: ',
  sad: 'Leia com tristeza e melancolia: ',
  excited: 'Leia com grande animação e energia: ',
  whispering: 'Leia em um sussurro suave e discreto: ',
  angry: 'Leia com raiva e intensidade: ',
  calm: 'Leia com calma e serenidade: ',
  dramatic: 'Leia de forma dramática e impactante: ',
};

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { text, voice = 'Charon', emotion = 'neutral' } = req.body ?? {};

  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return res.status(400).json({ error: 'O campo "text" é obrigatório.' });
  }

  if (text.length > 5000) {
    return res.status(400).json({ error: 'Texto muito longo. Máximo: 5000 caracteres.' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Chave de API não configurada no servidor.' });
  }

  const prefix = EMOTION_PROMPTS[emotion] ?? '';
  const prompt = prefix ? `${prefix}${text}` : text;

  try {
    const ai = new GoogleGenAI({ apiKey });

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
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

    return res.status(200).json({ audio: base64Audio });
  } catch (err: any) {
    console.error('[TTS API Error]', err);
    return res.status(500).json({ error: err.message ?? 'Falha ao gerar o áudio.' });
  }
}
