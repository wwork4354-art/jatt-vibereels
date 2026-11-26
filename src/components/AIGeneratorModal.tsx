import React, { useState, useRef } from 'react';
import {
  X,
  Sparkles,
  Image as ImageIcon,
  Video as VideoIcon,
  Download,
  Sliders,
  Send,
  Upload,
  Trash2,
  Loader2,
  Wand2,
  AlertCircle,
  RotateCcw,
} from 'lucide-react';
import { soundEngine } from '../utils/soundEngine';

export type AIGenerationMode = 'image' | 'video';

interface AIGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenInEditor?: (file: File) => void;
  onPostMedia?: (file: File) => void;
  onShowToast?: (msg: string) => void;
}

const IMAGE_PROMPT_IDEAS = [
  'Neon cyber Punjabi street at night with glowing signage and rain reflections, 8k cinematic',
  'Luxury golden hour portrait in mustard fields wearing classic aviator shades, shallow DOF',
  'Futuristic supercar drifting past glowing billboards in Tokyo rain, ultra sharp photography',
  'Minimalist studio product shot on obsidian marble with volumetric rim lighting',
];

const VIDEO_PROMPT_IDEAS = [
  'Slow-motion cinematic drone glide over misty green mountains at sunrise, golden rays',
  'Neon-lit sports car accelerating down a wet downtown avenue, sparks and reflections',
  'Bhangra dancer performing energetic spins on a concert stage with confetti and volumetric spotlights',
  'Ocean waves crashing against dramatic basalt cliffs in 4K slow motion, moody cinema look',
];

async function dataUrlToFile(dataUrl: string, filename: string, fallbackMime: string): Promise<File> {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  const mime = blob.type || fallbackMime;
  return new File([blob], filename, { type: mime });
}

function readFileAsBase64(file: File): Promise<{ base64: string; mimeType: string; previewUrl: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const commaIdx = result.indexOf(',');
      if (commaIdx === -1) {
        reject(new Error('Invalid file encoding'));
        return;
      }
      resolve({
        base64: result.slice(commaIdx + 1),
        mimeType: file.type || 'image/jpeg',
        previewUrl: result,
      });
    };
    reader.onerror = () => reject(new Error('Could not read reference image'));
    reader.readAsDataURL(file);
  });
}

export const AIGeneratorModal: React.FC<AIGeneratorModalProps> = ({
  isOpen,
  onClose,
  onOpenInEditor,
  onPostMedia,
  onShowToast,
}) => {
  const [mode, setMode] = useState<AIGenerationMode>('image');
  const [prompt, setPrompt] = useState('');

  // Image Options
  const [imageAspectRatio, setImageAspectRatio] = useState<'9:16' | '16:9' | '1:1' | '3:4'>('9:16');
  const [imageQuality, setImageQuality] = useState<'standard' | 'pro'>('standard');

  // Video Options
  const [videoAspectRatio, setVideoAspectRatio] = useState<'9:16' | '16:9'>('9:16');
  const [videoDuration, setVideoDuration] = useState<'5s' | '8s' | '10s'>('5s');
  const [videoResolution, setVideoResolution] = useState<'720p' | '1080p'>('720p');

  // Shared Reference Image (Image Edit / Image-to-Video)
  const [refImage, setRefImage] = useState<{
    base64: string;
    mimeType: string;
    previewUrl: string;
    name: string;
  } | null>(null);

  // Generation State & Results
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [generatedImage, setGeneratedImage] = useState<{
    dataUrl: string;
    mimeType: string;
    captionText?: string;
    aspectRatio: string;
    prompt: string;
  } | null>(null);
  const [generatedVideo, setGeneratedVideo] = useState<{
    dataUrl: string;
    mimeType: string;
    duration: string;
    aspectRatio: string;
    resolution: string;
    prompt: string;
  } | null>(null);

  const refInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const handleModeSwitch = (nextMode: AIGenerationMode) => {
    setMode(nextMode);
    setErrorMessage('');
  };

  const handlePickReferenceImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      onShowToast?.('Please pick a JPG, PNG, or WebP image.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      onShowToast?.('Reference image must be under 10 MB.');
      return;
    }
    try {
      const encoded = await readFileAsBase64(file);
      setRefImage({ ...encoded, name: file.name });
      onShowToast?.(
        mode === 'image'
          ? 'Reference photo attached for AI Image remix!'
          : 'Start frame attached for Image-to-Video!'
      );
    } catch {
      onShowToast?.('Could not read image file.');
    }
  };

  const handleGenerate = async () => {
    const cleanPrompt = prompt.trim();
    if (!cleanPrompt) {
      setErrorMessage(
        mode === 'image'
          ? 'Describe the AI image you want to create.'
          : 'Describe the AI video scene you want to create.'
      );
      return;
    }

    setErrorMessage('');
    setIsGenerating(true);

    try {
      if (mode === 'image') {
        const res = await fetch('/api/ai/generate-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: cleanPrompt,
            aspectRatio: imageAspectRatio,
            quality: imageQuality,
            referenceImageBase64: refImage?.base64,
            referenceMimeType: refImage?.mimeType,
          }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          imageDataUrl?: string;
          mimeType?: string;
          captionText?: string;
          aspectRatio?: string;
          error?: string;
        };

        if (!res.ok || !data.imageDataUrl) {
          throw new Error(data.error || `Image generation failed (${res.status})`);
        }

        setGeneratedImage({
          dataUrl: data.imageDataUrl,
          mimeType: data.mimeType || 'image/png',
          captionText: data.captionText,
          aspectRatio: data.aspectRatio || imageAspectRatio,
          prompt: cleanPrompt,
        });
        soundEngine.playDownloadComplete();
        onShowToast?.('AI Image generated!');
      } else {
        const res = await fetch('/api/ai/generate-video', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: cleanPrompt,
            aspectRatio: videoAspectRatio,
            duration: videoDuration,
            resolution: videoResolution,
            startImageBase64: refImage?.base64,
            startImageMimeType: refImage?.mimeType,
          }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          videoDataUrl?: string;
          mimeType?: string;
          duration?: string;
          aspectRatio?: string;
          resolution?: string;
          error?: string;
        };

        if (!res.ok || !data.videoDataUrl) {
          throw new Error(data.error || `Video generation failed (${res.status})`);
        }

        setGeneratedVideo({
          dataUrl: data.videoDataUrl,
          mimeType: data.mimeType || 'video/mp4',
          duration: data.duration || videoDuration,
          aspectRatio: data.aspectRatio || videoAspectRatio,
          resolution: data.resolution || videoResolution,
          prompt: cleanPrompt,
        });
        soundEngine.playDownloadComplete();
        onShowToast?.('AI Video generated!');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Generation request failed.';
      setErrorMessage(msg);
      onShowToast?.('AI generation did not complete.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadActiveResult = () => {
    if (mode === 'image' && generatedImage) {
      const ext = generatedImage.mimeType.includes('jpeg') ? 'jpg' : 'png';
      const a = document.createElement('a');
      a.href = generatedImage.dataUrl;
      a.download = `jatt-ai-image-${Date.now()}.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      soundEngine.playDownloadComplete();
      onShowToast?.('AI Image downloaded!');
    } else if (mode === 'video' && generatedVideo) {
      const ext = generatedVideo.mimeType.includes('webm') ? 'webm' : 'mp4';
      const a = document.createElement('a');
      a.href = generatedVideo.dataUrl;
      a.download = `jatt-ai-video-${Date.now()}.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      soundEngine.playDownloadComplete();
      onShowToast?.('AI Video downloaded!');
    }
  };

  const handleSendToEditorOrPost = async (action: 'editor' | 'post') => {
    try {
      if (mode === 'image' && generatedImage) {
        const ext = generatedImage.mimeType.includes('jpeg') ? 'jpg' : 'png';
        const file = await dataUrlToFile(
          generatedImage.dataUrl,
          `jatt-ai-image-${Date.now()}.${ext}`,
          generatedImage.mimeType
        );
        onClose();
        if (action === 'editor') onOpenInEditor?.(file);
        else onPostMedia?.(file);
      } else if (mode === 'video' && generatedVideo) {
        const ext = generatedVideo.mimeType.includes('webm') ? 'webm' : 'mp4';
        const file = await dataUrlToFile(
          generatedVideo.dataUrl,
          `jatt-ai-video-${Date.now()}.${ext}`,
          generatedVideo.mimeType
        );
        onClose();
        if (action === 'editor') onOpenInEditor?.(file);
        else onPostMedia?.(file);
      }
    } catch {
      onShowToast?.('Could not prepare generated media.');
    }
  };

  const activeResultExists = mode === 'image' ? Boolean(generatedImage) : Boolean(generatedVideo);
  const promptIdeas = mode === 'image' ? IMAGE_PROMPT_IDEAS : VIDEO_PROMPT_IDEAS;

  return (
    <div
      className="fixed inset-0 z-55 bg-black/90 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-hidden"
      onClick={onClose}
    >
      <input
        ref={refInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => void handlePickReferenceImage(e)}
      />

      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-4xl max-h-[94vh] bg-[#0a0a10] border border-neutral-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden text-white"
      >
        {/* Top Header + Clear Dual-Mode Toggle */}
        <header className="shrink-0 px-4 sm:px-6 py-3.5 border-b border-neutral-800/90 bg-[#0e0e16] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-pink-600 via-purple-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-pink-600/25 shrink-0">
              <Sparkles className="w-4.5 h-4.5 text-white" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-black tracking-tight">
                Jatt AI Studio
              </h2>
              <p className="text-[11px] text-neutral-400">
                Dual-Mode Creator · Generate AI Photos &amp; Cinematic Reels
              </p>
            </div>
          </div>

          {/* Segmented Dual-Mode Switcher: Generate Image vs Generate Video */}
          <div
            role="tablist"
            aria-label="AI Generation Mode"
            className="flex items-center bg-neutral-900 border border-neutral-800 rounded-2xl p-1 gap-1"
          >
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'image'}
              onClick={() => handleModeSwitch('image')}
              className={`min-h-[40px] px-3.5 sm:px-4 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                mode === 'image'
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md shadow-cyan-500/25'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <ImageIcon className="w-4 h-4 shrink-0" />
              <span>Generate Image</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={mode === 'video'}
              onClick={() => handleModeSwitch('video')}
              className={`min-h-[40px] px-3.5 sm:px-4 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                mode === 'video'
                  ? 'bg-gradient-to-r from-pink-600 via-rose-500 to-amber-500 text-white shadow-md shadow-pink-600/25'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <VideoIcon className="w-4 h-4 shrink-0" />
              <span>Generate Video</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="min-w-[40px] min-h-[40px] rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 hover:text-white flex items-center justify-center cursor-pointer"
            aria-label="Close AI Studio"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        {/* Body: Left Prompt Controls / Right Live Result Canvas */}
        <div className="flex-1 min-h-0 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-neutral-800/80">
          {/* Prompt & Controls Column */}
          <div className="lg:col-span-6 p-4 sm:p-5 space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black uppercase tracking-wider text-neutral-300">
                  {mode === 'image' ? 'Image Prompt' : 'Video Scene Prompt'}
                </label>
                {prompt && (
                  <button
                    type="button"
                    onClick={() => setPrompt('')}
                    className="text-[11px] font-bold text-neutral-400 hover:text-white cursor-pointer flex items-center gap-1"
                  >
                    <RotateCcw className="w-3 h-3" /> Clear
                  </button>
                )}
              </div>
              <textarea
                rows={4}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={
                  mode === 'image'
                    ? 'e.g. Ultra-sharp cinematic portrait in Lahore neon streets at dusk, golden rim light...'
                    : 'e.g. Drone orbit around a sleek matte-black sports car drifting through neon rain in slow motion...'
                }
                className="w-full rounded-2xl bg-neutral-900/90 border border-neutral-800 focus:border-pink-500 p-3.5 text-sm text-white placeholder-neutral-500 focus:outline-hidden resize-none"
              />
            </div>

            {/* Quick Prompt Starters */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                Try a Creative Prompt
              </span>
              <div className="flex flex-wrap gap-1.5">
                {promptIdeas.map((idea) => (
                  <button
                    key={idea}
                    type="button"
                    onClick={() => setPrompt(idea)}
                    className="px-2.5 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 hover:border-pink-500/45 text-[11px] text-neutral-300 hover:text-white text-left line-clamp-1 max-w-full cursor-pointer transition-colors"
                  >
                    {idea}
                  </button>
                ))}
              </div>
            </div>

            {/* Mode-Specific Controls */}
            {mode === 'image' ? (
              <div className="space-y-3 bg-neutral-900/60 border border-neutral-800 rounded-2xl p-3.5">
                <div className="space-y-1.5">
                  <span className="text-[11px] font-bold text-neutral-300 block">
                    Aspect Ratio
                  </span>
                  <div className="grid grid-cols-4 gap-1.5">
                    {(['9:16', '16:9', '1:1', '3:4'] as const).map((ratio) => (
                      <button
                        key={ratio}
                        type="button"
                        onClick={() => setImageAspectRatio(ratio)}
                        className={`min-h-[38px] rounded-xl border text-xs font-black cursor-pointer tabular-nums ${
                          imageAspectRatio === ratio
                            ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200'
                            : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-white'
                        }`}
                      >
                        {ratio}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <span className="text-[11px] font-bold text-neutral-300 block">
                    Render Quality
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setImageQuality('standard')}
                      className={`min-h-[40px] rounded-xl border text-xs font-bold cursor-pointer ${
                        imageQuality === 'standard'
                          ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200'
                          : 'bg-neutral-950 border-neutral-800 text-neutral-400'
                      }`}
                    >
                      Fast Flash HD
                    </button>
                    <button
                      type="button"
                      onClick={() => setImageQuality('pro')}
                      className={`min-h-[40px] rounded-xl border text-xs font-bold cursor-pointer ${
                        imageQuality === 'pro'
                          ? 'bg-pink-600/20 border-pink-400 text-pink-200'
                          : 'bg-neutral-950 border-neutral-800 text-neutral-400'
                      }`}
                    >
                      Ultra 2K Pro
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3 bg-neutral-900/60 border border-neutral-800 rounded-2xl p-3.5">
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-bold text-neutral-300 block">
                      Video Framing
                    </span>
                    <div className="grid grid-cols-2 gap-1.5">
                      {(['9:16', '16:9'] as const).map((ratio) => (
                        <button
                          key={ratio}
                          type="button"
                          onClick={() => setVideoAspectRatio(ratio)}
                          className={`min-h-[38px] rounded-xl border text-xs font-black cursor-pointer tabular-nums ${
                            videoAspectRatio === ratio
                              ? 'bg-pink-600/20 border-pink-400 text-pink-200'
                              : 'bg-neutral-950 border-neutral-800 text-neutral-400'
                          }`}
                        >
                          {ratio}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <span className="text-[11px] font-bold text-neutral-300 block">
                      Resolution
                    </span>
                    <div className="grid grid-cols-2 gap-1.5">
                      {(['720p', '1080p'] as const).map((res) => (
                        <button
                          key={res}
                          type="button"
                          onClick={() => setVideoResolution(res)}
                          className={`min-h-[38px] rounded-xl border text-xs font-black cursor-pointer ${
                            videoResolution === res
                              ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                              : 'bg-neutral-950 border-neutral-800 text-neutral-400'
                          }`}
                        >
                          {res}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <span className="text-[11px] font-bold text-neutral-300 block">
                    Clip Duration
                  </span>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(['5s', '8s', '10s'] as const).map((dur) => (
                      <button
                        key={dur}
                        type="button"
                        onClick={() => setVideoDuration(dur)}
                        className={`min-h-[38px] rounded-xl border text-xs font-black cursor-pointer tabular-nums ${
                          videoDuration === dur
                            ? 'bg-pink-600/20 border-pink-400 text-pink-200'
                            : 'bg-neutral-950 border-neutral-800 text-neutral-400'
                        }`}
                      >
                        {dur}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Optional Reference Photo / Start Frame */}
            <div className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-neutral-900/60 border border-neutral-800">
              {refImage ? (
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <img
                    src={refImage.previewUrl}
                    alt="Reference"
                    className="w-11 h-11 rounded-xl object-cover border border-neutral-700 shrink-0"
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white truncate">{refImage.name}</p>
                    <p className="text-[10px] text-cyan-300">
                      {mode === 'image' ? 'Image remix reference' : 'Video start frame'}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="min-w-0">
                  <p className="text-xs font-bold text-neutral-200">
                    {mode === 'image'
                      ? 'Optional Reference Image (Remix)'
                      : 'Optional Starting Frame (Image-to-Video)'}
                  </p>
                  <p className="text-[10px] text-neutral-400">
                    Upload a photo to restyle or animate with motion
                  </p>
                </div>
              )}

              {refImage ? (
                <button
                  type="button"
                  onClick={() => setRefImage(null)}
                  className="min-h-[38px] px-3 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 text-xs font-bold flex items-center gap-1 cursor-pointer shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Remove</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => refInputRef.current?.click()}
                  className="min-h-[38px] px-3 rounded-xl bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-xs font-bold text-white flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                  <Upload className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Attach Photo</span>
                </button>
              )}
            </div>

            {errorMessage && (
              <div className="p-3 rounded-2xl bg-rose-500/15 border border-rose-500/40 text-xs text-rose-200 flex items-start gap-2 leading-relaxed">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            <button
              type="button"
              disabled={isGenerating}
              onClick={() => void handleGenerate()}
              className={`w-full min-h-[48px] rounded-2xl font-black text-sm text-white flex items-center justify-center gap-2 shadow-xl active:scale-99 transition-all cursor-pointer disabled:opacity-60 ${
                mode === 'image'
                  ? 'bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 shadow-cyan-500/25'
                  : 'bg-gradient-to-r from-pink-600 via-rose-500 to-amber-500 shadow-pink-600/25'
              }`}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4.5 h-4.5 animate-spin" />
                  <span>
                    {mode === 'image' ? 'Generating crisp AI Image...' : 'Rendering AI Video (may take ~1–2 min)...'}
                  </span>
                </>
              ) : (
                <>
                  <Wand2 className="w-4.5 h-4.5" />
                  <span>{mode === 'image' ? 'Generate Image' : 'Generate Video'}</span>
                </>
              )}
            </button>
          </div>

          {/* Live Preview & Download Column */}
          <div className="lg:col-span-6 p-4 sm:p-5 bg-[#07070b] flex flex-col justify-between gap-4 min-h-[320px]">
            <div className="flex-1 flex flex-col items-center justify-center rounded-2xl border border-neutral-800/90 bg-black overflow-hidden relative p-2 min-h-[260px]">
              {isGenerating ? (
                <div className="flex flex-col items-center justify-center text-center gap-3 p-6">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-pink-600/25 to-cyan-500/25 border border-pink-500/40 flex items-center justify-center">
                    <Loader2 className="w-7 h-7 text-pink-400 animate-spin" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-black text-white">
                      {mode === 'image' ? 'Creating Your Image' : 'Generating Your Video'}
                    </p>
                    <p className="text-xs text-neutral-400 max-w-xs">
                      {mode === 'image'
                        ? 'Crafting high-definition detail and lighting...'
                        : 'Synthesizing smooth temporal frames & cinema lighting...'}
                    </p>
                  </div>
                </div>
              ) : mode === 'image' && generatedImage ? (
                <img
                  src={generatedImage.dataUrl}
                  alt={generatedImage.prompt}
                  className="max-h-[420px] w-auto max-w-full rounded-xl object-contain"
                />
              ) : mode === 'video' && generatedVideo ? (
                <video
                  src={generatedVideo.dataUrl}
                  controls
                  autoPlay
                  loop
                  playsInline
                  className="max-h-[420px] w-auto max-w-full rounded-xl bg-black"
                />
              ) : (
                <div className="flex flex-col items-center justify-center text-center gap-2.5 p-6 max-w-xs">
                  <div className="w-14 h-14 rounded-2xl bg-neutral-900 border border-neutral-800 flex items-center justify-center text-neutral-400">
                    {mode === 'image' ? (
                      <ImageIcon className="w-6 h-6 text-cyan-400" />
                    ) : (
                      <VideoIcon className="w-6 h-6 text-pink-400" />
                    )}
                  </div>
                  <p className="text-sm font-black text-white">
                    {mode === 'image' ? 'AI Image Canvas Ready' : 'AI Video Stage Ready'}
                  </p>
                  <p className="text-xs text-neutral-400 leading-relaxed">
                    {mode === 'image'
                      ? 'Switch between Generate Image and Generate Video above, write a prompt, and download or edit right in Jatt Pro Studio.'
                      : 'Generate vertical 9:16 Reels or 16:9 widescreen clips from text or a starting photo.'}
                  </p>
                </div>
              )}
            </div>

            {activeResultExists && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={handleDownloadActiveResult}
                  className="min-h-[44px] px-3 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-cyan-500/45 text-cyan-300 text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>{mode === 'image' ? 'Download Image' : 'Download Video'}</span>
                </button>

                {onOpenInEditor && (
                  <button
                    type="button"
                    onClick={() => void handleSendToEditorOrPost('editor')}
                    className="min-h-[44px] px-3 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/45 text-purple-200 text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Sliders className="w-4 h-4" />
                    <span>Edit in Studio</span>
                  </button>
                )}

                {onPostMedia && (
                  <button
                    type="button"
                    onClick={() => void handleSendToEditorOrPost('post')}
                    className="min-h-[44px] px-3 rounded-xl bg-gradient-to-r from-pink-600 to-rose-500 hover:brightness-110 text-white text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Send className="w-4 h-4" />
                    <span>Post to Reels</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
