/**
 * Gera um token para o browser fazer upload direto ao Vercel Blob Storage.
 * Isso evita o limite de 4.5MB do Vercel nas funções serverless.
 */
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';

export default async function handler(req: any, res: any) {
  const body = req.body as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (_pathname: string) => ({
        allowedContentTypes: [
          'audio/mpeg',
          'audio/mp3',
          'audio/wav',
          'audio/x-wav',
          'audio/mp4',
          'audio/ogg',
          'audio/webm',
          'audio/m4a',
          'audio/x-m4a',
        ],
        maximumSizeInBytes: 100 * 1024 * 1024, // 100 MB
      }),
      onUploadCompleted: async ({ blob }: { blob: { url: string } }) => {
        console.log('[Blob Upload Complete]', blob.url);
      },
    });

    return res.json(jsonResponse);
  } catch (err: any) {
    console.error('[Upload Token Error]', err?.message ?? err);
    return res.status(400).json({ error: err?.message ?? 'Falha ao gerar token de upload.' });
  }
}
