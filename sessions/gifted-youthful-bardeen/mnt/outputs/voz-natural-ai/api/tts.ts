import { GoogleGenAI, Modality } from "@google/genai";

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
