import express, { type Request, type Response } from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import process from 'node:process';
import { GoogleGenAI } from '@google/genai';

const PORT = Number(process.env.PORT) || 3000;
const DIST_DIR = path.resolve(import.meta.dirname, 'dist');
const INDEX_HTML_PATH = path.resolve(import.meta.dirname, 'index.html');

type ImageAspectRatio = '1:1' | '3:4' | '4:3' | '9:16' | '16:9';
type VideoAspectRatio = '16:9' | '9:16';
type VideoResolution = '360p' | '720p' | '1080p';

const ALLOWED_IMAGE_RATIOS: Set<ImageAspectRatio> = new Set(['1:1', '3:4', '4:3', '9:16', '16:9']);
const ALLOWED_VIDEO_RATIOS: Set<VideoAspectRatio> = new Set(['16:9', '9:16']);
const ALLOWED_VIDEO_RES: Set<VideoResolution> = new Set(['360p', '720p', '1080p']);

function createGeminiClient(): GoogleGenAI | null {
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function extractErrorDetails(err: unknown): { status: number; message: string } {
  const raw = err instanceof Error ? err.message : String(err || 'AI generation failed');
  const statusMatch = raw.match(/\b(400|401|402|403|404|429|500|503|504)\b/);
  const parsedStatus = statusMatch ? Number(statusMatch[1]) : 500;

  if (/PERMISSION_DENIED|API_KEY_INVALID|API key not valid/i.test(raw)) {
    return {
      status: 403,
      message:
        'A billing-enabled Gemini API key is required in Settings > Secrets for AI Image and Video generation.',
    };
  }
  if (/RESOURCE_EXHAUSTED|quota|429/i.test(raw)) {
    return {
      status: 429,
      message:
        'AI generation quota reached or paid tier required. Upgrade or attach a billing-enabled GEMINI_API_KEY in Settings > Secrets.',
    };
  }
  if (/NOT_FOUND|404/i.test(raw)) {
    return {
      status: 404,
      message: raw,
    };
  }
  return {
    status: parsedStatus >= 400 && parsedStatus < 600 ? parsedStatus : 500,
    message: raw,
  };
}

async function startServer() {
  const app = express();
  const httpServer = http.createServer(app);
  app.use(express.json({ limit: '25mb' }));

  app.get('/api/health', (_req: Request, res: Response) => {
    const keyConfigured = Boolean(createGeminiClient());
    res.json({ ok: true, geminiConfigured: keyConfigured });
  });

  const RENTAL_KEY_HASHES = new Set<string>([
    'fc74381319eee9a045043749920a9ca7c8def524bee9e6749eb23ff7fc2d1a93', // JATT-NOV26-PRO
    'edcbd48e8b2cfacd1efb56f4ba1f147e747a37f6915203d858afec37e8fdf059', // JATT-DEC26-PRO
    'e5b820633d7883534ce39d35e6631996896c375a2ae12412b8c6ce481683222a', // JATT-JAN27-PRO
    'e4dceda24c479deca51d896c0528ab17475c977af18d6ecea28890d2d5e21b6f', // JATT-FEB27-PRO
    '02898be5b3d145a77819161f082d18b2b5c583e021fe3f0a2da3edda359bf694', // JATT-MAR27-PRO
    'b13195e97eb15616073dd44c5cd040820453208334ca62b89d39a46e7f430188', // JATT-APR27-PRO
    '0b60581622f78572fc83b883473f2b62c321fa1484b5788eb7fa0918a255f903', // JATT-MAY27-PRO
    '115acc615791c294a73f520c16ca4c6156c9aaa28b9ff24a00c520320ec7d996', // JATT-JUN27-PRO
    'acc60a18a01a1b1489afc0eb02f407a60ccd5536f02ae25f0651edf7f2ed061e', // JATT-JUL27-PRO
    '654ca6361aede47c878e8aa8717b1adfec50a6ba2b342c4e83a60be4f153e0d9', // JATT-AUG27-PRO
    '47db9815dbc486e7024d00275fa46097dd7c3a6f361a01d5b02afc74e9ebcd44', // JATT-SEP27-PRO
    'dd6d205c8657e5caebb840eab8b2ce6790c536fc1d319e631dfa89334bff640c', // JATT-OCT27-PRO
    'a1a3277357b1171b74cbe792addfe3449416e9148cc83d66819a5e4c77fef33f', // JATT-NOV27-PRO
    '2b901f52ca3358c24f3369a00fd43120298149cb0048ccc194b9e0c5fbedb735', // JATT-DEC27-PRO
  ]);

  // Authoritative server clock endpoint to prevent client date/time rollback tampering
  app.get('/api/license/time', (_req: Request, res: Response) => {
    const now = Date.now();
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.json({
      ok: true,
      serverTimeMs: now,
      serverDateUtc: new Date(now).toISOString().slice(0, 10),
    });
  });

  // Server-side renewal activation key verification (+30 days unlock from server time)
  app.post('/api/license/verify-key', (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    const rawKey = typeof req.body?.key === 'string' ? req.body.key.trim().toUpperCase() : '';
    if (!rawKey || rawKey.length < 6 || rawKey.length > 64) {
      res.status(400).json({ valid: false, error: 'Please enter a valid renewal activation key.' });
      return;
    }

    const inputDigest = crypto
      .createHash('sha256')
      .update(`jatt_rental_key_v1:${rawKey}`)
      .digest('hex');

    let isMatch = false;
    const inputBuf = Buffer.from(inputDigest, 'utf8');
    for (const allowedHex of RENTAL_KEY_HASHES) {
      const allowedBuf = Buffer.from(allowedHex, 'utf8');
      if (inputBuf.length === allowedBuf.length && crypto.timingSafeEqual(inputBuf, allowedBuf)) {
        isMatch = true;
        break;
      }
    }

    const envKey = (process.env.RENTAL_ACTIVATION_KEY || '').trim().toUpperCase();
    if (!isMatch && envKey) {
      const envDigest = crypto
        .createHash('sha256')
        .update(`jatt_rental_key_v1:${envKey}`)
        .digest('hex');
      const envBuf = Buffer.from(envDigest, 'utf8');
      if (inputBuf.length === envBuf.length && crypto.timingSafeEqual(inputBuf, envBuf)) {
        isMatch = true;
      }
    }

    if (!isMatch) {
      res.status(403).json({
        valid: false,
        error: 'Invalid or unrecognized Renewal Activation Key.',
      });
      return;
    }

    const nowMs = Date.now();
    const unlockUntilMs = nowMs + 30 * 86_400_000;
    const unlockedUntilDate = new Date(unlockUntilMs).toISOString().slice(0, 10);

    res.json({
      valid: true,
      serverTimeMs: nowMs,
      unlockedUntilDate,
      keyFingerprint: inputDigest.slice(0, 16),
    });
  });

  // Dual-Mode AI Endpoint 1: AI Image Generation & Editing
  app.post('/api/ai/generate-image', async (req: Request, res: Response) => {
    try {
      const ai = createGeminiClient();
      if (!ai) {
        res.status(403).json({
          error:
            'Gemini API key is not configured. Please attach a billing-enabled GEMINI_API_KEY in Settings > Secrets.',
        });
        return;
      }

      const body = req.body as {
        prompt?: string;
        aspectRatio?: string;
        quality?: 'standard' | 'pro';
        referenceImageBase64?: string;
        referenceMimeType?: string;
      };

      const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
      if (!prompt) {
        res.status(400).json({ error: 'Please enter a prompt to generate an image.' });
        return;
      }

      const aspectRatio: ImageAspectRatio = ALLOWED_IMAGE_RATIOS.has(
        body.aspectRatio as ImageAspectRatio
      )
        ? (body.aspectRatio as ImageAspectRatio)
        : '9:16';

      const useProModel = body.quality === 'pro';
      const model = useProModel ? 'gemini-nano-banana-2.1' : 'gemini-3.1-flash-lite-image';

      const parts: Array<
        { text: string } | { inlineData: { data: string; mimeType: string } }
      > = [];

      if (
        typeof body.referenceImageBase64 === 'string' &&
        body.referenceImageBase64.trim().length > 0
      ) {
        parts.push({
          inlineData: {
            data: body.referenceImageBase64.trim(),
            mimeType:
              typeof body.referenceMimeType === 'string' && body.referenceMimeType
                ? body.referenceMimeType
                : 'image/jpeg',
          },
        });
      }

      parts.push({ text: prompt });

      const response = await ai.models.generateContent({
        model,
        contents: { parts },
        config: {
          imageConfig: {
            aspectRatio,
            ...(useProModel ? { imageSize: '2K' } : {}),
          },
        },
      });

      let imageDataUrl = '';
      let mimeType = 'image/png';
      const captionChunks: string[] = [];

      const candidateParts = response.candidates?.[0]?.content?.parts ?? [];
      for (const part of candidateParts) {
        if (part.inlineData?.data && !imageDataUrl) {
          mimeType = part.inlineData.mimeType || 'image/png';
          imageDataUrl = `data:${mimeType};base64,${part.inlineData.data}`;
        } else if (part.text) {
          captionChunks.push(part.text);
        }
      }

      if (!imageDataUrl) {
        res.status(502).json({
          error:
            captionChunks.join(' ').trim() ||
            'Model did not return an image. Please try adjusting your prompt.',
        });
        return;
      }

      res.json({
        imageDataUrl,
        mimeType,
        captionText: captionChunks.join(' ').trim(),
        aspectRatio,
        model,
      });
    } catch (err) {
      const details = extractErrorDetails(err);
      console.error('[AI Image Error]', details.message);
      res.status(details.status).json({ error: details.message });
    }
  });

  // Dual-Mode AI Endpoint 2: AI Video Generation via Gemini Interactions API (gemini-omni-1.2-flash)
  app.post('/api/ai/generate-video', async (req: Request, res: Response) => {
    try {
      const ai = createGeminiClient();
      if (!ai) {
        res.status(403).json({
          error:
            'Gemini API key is not configured. Please attach a billing-enabled GEMINI_API_KEY in Settings > Secrets.',
        });
        return;
      }

      const body = req.body as {
        prompt?: string;
        aspectRatio?: string;
        duration?: string;
        resolution?: string;
        startImageBase64?: string;
        startImageMimeType?: string;
      };

      const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
      if (!prompt) {
        res.status(400).json({ error: 'Please enter a prompt to generate a video.' });
        return;
      }

      const aspectRatio: VideoAspectRatio = ALLOWED_VIDEO_RATIOS.has(
        body.aspectRatio as VideoAspectRatio
      )
        ? (body.aspectRatio as VideoAspectRatio)
        : '9:16';

      const parsedSecs = Number.parseInt(String(body.duration || '6').replace(/[^0-9]/g, ''), 10);
      const clampedSecs = Number.isFinite(parsedSecs)
        ? Math.max(3, Math.min(10, parsedSecs))
        : 6;
      const durationStr = `${clampedSecs}s`;

      const resolution: VideoResolution = ALLOWED_VIDEO_RES.has(
        body.resolution as VideoResolution
      )
        ? (body.resolution as VideoResolution)
        : '720p';

      const hasStartImage =
        typeof body.startImageBase64 === 'string' && body.startImageBase64.trim().length > 0;

      const inputPayload = hasStartImage
        ? [
            {
              type: 'image' as const,
              mime_type:
                typeof body.startImageMimeType === 'string' && body.startImageMimeType
                  ? body.startImageMimeType
                  : 'image/jpeg',
              data: body.startImageBase64!.trim(),
            },
            {
              type: 'text' as const,
              text: prompt,
            },
          ]
        : prompt;

      const interaction = await ai.interactions.create(
        {
          model: 'gemini-omni-1.2-flash',
          input: inputPayload,
          background: false,
          store: false,
          stream: false,
          response_format: {
            type: 'video',
            aspect_ratio: aspectRatio,
            duration: durationStr,
            resolution,
          },
        } as Parameters<typeof ai.interactions.create>[0],
        { timeout: 300_000 }
      );

      const typedInteraction = interaction as unknown as {
        output_video?: { data?: string; mime_type?: string };
        outputs?: Array<{ type?: string; data?: string; mime_type?: string }>;
      };

      const directVideo = typedInteraction.output_video;
      const fallbackVideo = typedInteraction.outputs?.find(
        (o) => o.type === 'video' && typeof o.data === 'string'
      );
      const videoPart = directVideo?.data ? directVideo : fallbackVideo;

      if (!videoPart?.data) {
        res.status(502).json({
          error: 'Video model completed without video output. Please try a simpler prompt.',
        });
        return;
      }

      const mimeType = videoPart.mime_type || 'video/mp4';
      const videoDataUrl = `data:${mimeType};base64,${videoPart.data}`;

      res.json({
        videoDataUrl,
        mimeType,
        aspectRatio,
        duration: durationStr,
        resolution,
        model: 'gemini-omni-1.2-flash',
      });
    } catch (err) {
      const details = extractErrorDetails(err);
      console.error('[AI Video Error]', details.message);
      res.status(details.status).json({ error: details.message });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const isHmrDisabled = process.env.DISABLE_HMR === 'true';
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: isHmrDisabled ? false : { server: httpServer },
        ws: isHmrDisabled ? false : { server: httpServer },
      },
      plugins: isHmrDisabled
        ? [
            {
              name: 'disable-vite-client-ws-when-hmr-off',
              transform(code, id) {
                if (id.includes('/@vite/client') || id.endsWith('vite/dist/client/client.mjs')) {
                  return code.replace(
                    /const createWebSocketModuleRunnerTransport\s*=\s*\(options\)\s*=>\s*\{[\s\S]*?send\(data\)\s*\{\s*ws\.send\(JSON\.stringify\(data\)\);\s*\}\s*\};\s*\};/,
                    'const createWebSocketModuleRunnerTransport = () => ({ async connect() {}, disconnect() {}, send() {} });'
                  );
                }
                return null;
              },
            },
          ]
        : [],
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(DIST_DIR, { maxAge: '7d' }));
    app.use((req: Request, res: Response) => {
      if (req.path.startsWith('/api/')) {
        res.status(404).json({ error: 'API route not found' });
        return;
      }
      const prodIndex = path.join(DIST_DIR, 'index.html');
      const targetHtml = fs.existsSync(prodIndex) ? prodIndex : INDEX_HTML_PATH;
      res.sendFile(targetHtml);
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Jatt VibeReels server running on http://0.0.0.0:${PORT}`);
  });
}

void startServer();
