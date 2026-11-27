import React, { useRef, useState } from 'react';
import {
  Captions,
  Megaphone,
  Wand2,
  Eraser,
  Volume2,
  VolumeX,
  Crop,
  Sparkles,
  Diamond,
  Zap,
  Mic,
  MicOff,
  Plus,
  Trash2,
  Copy,
  Image as ImageIcon,
  RotateCcw,
} from 'lucide-react';
import {
  AnimationConfig,
  BgRemovalConfig,
  ClipAnimPreset,
  CropAspectPreset,
  CropConfig,
  DEFAULT_BG_REMOVAL_CONFIG,
  DEFAULT_CROP_CONFIG,
  EnhanceConfig,
  KeyframeMarker,
  SubtitleSegment,
  TickerConfig,
  VISUAL_EFFECT_PRESETS,
  VisualEffectConfig,
} from '../utils/proEditorEngine';
import { sanitizeInputLive } from '../utils/security';

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}
interface SpeechRecognitionResultLike {
  isFinal: boolean;
  [index: number]: SpeechRecognitionAlternativeLike;
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}
interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((ev: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

const ANIM_PRESETS: { id: ClipAnimPreset; label: string }[] = [
  { id: 'none', label: 'None' },
  { id: 'fade', label: 'Fade' },
  { id: 'slide_up', label: 'Slide Up' },
  { id: 'slide_down', label: 'Slide Down' },
  { id: 'zoom_in', label: 'Zoom In' },
  { id: 'zoom_out', label: 'Zoom Out' },
  { id: 'pop', label: 'Pop' },
  { id: 'spin', label: 'Spin' },
];

const CROP_ASPECTS: { id: CropAspectPreset; label: string; sub: string }[] = [
  { id: '9:16', label: '9:16 Reels', sub: 'Vertical Full' },
  { id: '16:9', label: '16:9 YouTube', sub: 'Widescreen' },
  { id: '1:1', label: '1:1 Square', sub: 'Feed Post' },
  { id: 'freeform', label: 'Freeform', sub: 'Custom Box' },
];

const BG_COLOR_SWATCHES = ['#0f172a', '#050507', '#ffffff', '#e11d48', '#2563eb', '#16a34a', '#9333ea'];
const KEY_COLOR_SWATCHES = ['#00d24d', '#00ff00', '#0066ff', '#ffffff', '#111111'];

export interface StudioProToolPanelsProps {
  activeTool: string;
  playheadTime: number;
  totalDuration: number;
  hasVideoInTimeline: boolean;
  hasAttachedMusic: boolean;
  exportResolution: '1080p' | '4k';
  onSetExportResolution: (res: '1080p' | '4k') => void;
  // Captions
  captions: SubtitleSegment[];
  onSetCaptions: React.Dispatch<React.SetStateAction<SubtitleSegment[]>>;
  // Ticker
  ticker: TickerConfig;
  onSetTicker: React.Dispatch<React.SetStateAction<TickerConfig>>;
  // Visual Effects
  visualEffect: VisualEffectConfig;
  onSetVisualEffect: React.Dispatch<React.SetStateAction<VisualEffectConfig>>;
  // BG Remove
  bgRemoval: BgRemovalConfig;
  onSetBgRemoval: React.Dispatch<React.SetStateAction<BgRemovalConfig>>;
  onPickBgReplacementImage: (file: File) => void;
  // Volume
  originalVolume: number;
  bgAudioVolume: number;
  onSetOriginalVolume: (v: number) => void;
  onSetBgAudioVolume: (v: number) => void;
  onOpenMusicDrawer: () => void;
  // Crop
  cropConfig: CropConfig;
  onSetCropConfig: React.Dispatch<React.SetStateAction<CropConfig>>;
  // Animation
  clipAnimation: AnimationConfig;
  onSetClipAnimation: React.Dispatch<React.SetStateAction<AnimationConfig>>;
  textAnimConfig: AnimationConfig;
  onSetTextAnimConfig: (next: AnimationConfig) => void;
  hasActiveText: boolean;
  // Keyframe
  keyframes: KeyframeMarker[];
  onAddOrUpdateKeyframe: (target: 'main' | 'text' | 'overlay') => void;
  onUpdateKeyframe: (id: string, patch: Partial<KeyframeMarker>) => void;
  onDeleteKeyframe: (id: string) => void;
  onScrubTo: (t: number) => void;
  // Enhance
  enhanceConfig: EnhanceConfig;
  onSetEnhanceConfig: React.Dispatch<React.SetStateAction<EnhanceConfig>>;
  onShowToast?: (msg: string) => void;
}

export const StudioProToolPanels: React.FC<StudioProToolPanelsProps> = ({
  activeTool,
  playheadTime,
  totalDuration,
  hasVideoInTimeline,
  hasAttachedMusic,
  exportResolution,
  onSetExportResolution,
  captions,
  onSetCaptions,
  ticker,
  onSetTicker,
  visualEffect,
  onSetVisualEffect,
  bgRemoval,
  onSetBgRemoval,
  onPickBgReplacementImage,
  originalVolume,
  bgAudioVolume,
  onSetOriginalVolume,
  onSetBgAudioVolume,
  onOpenMusicDrawer,
  cropConfig,
  onSetCropConfig,
  clipAnimation,
  onSetClipAnimation,
  textAnimConfig,
  onSetTextAnimConfig,
  hasActiveText,
  keyframes,
  onAddOrUpdateKeyframe,
  onUpdateKeyframe,
  onDeleteKeyframe,
  onScrubTo,
  enhanceConfig,
  onSetEnhanceConfig,
  onShowToast,
}) => {
  const [isListeningMic, setIsListeningMic] = useState(false);
  const [animTarget, setAnimTarget] = useState<'clip' | 'text'>('clip');
  const [kfTarget, setKfTarget] = useState<'main' | 'text' | 'overlay'>('main');
  const [captionStyle, setCaptionStyle] = useState<SubtitleSegment['style']>('karaoke_glow');
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const bgImageInputRef = useRef<HTMLInputElement | null>(null);

  const handleToggleAutoSpeechCaptions = () => {
    if (isListeningMic && recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      setIsListeningMic(false);
      return;
    }

    const win = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionInstance;
      webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
    };
    const SR = win.SpeechRecognition || win.webkitSpeechRecognition;
    if (!SR) {
      onShowToast?.('Speech Recognition unavailable on this browser — add timed subtitle blocks below.');
      return;
    }

    try {
      const recog = new SR();
      recog.continuous = true;
      recog.interimResults = false;
      recog.lang = 'en-US';
      let cursorTime = Number(playheadTime.toFixed(1));

      recog.onresult = (ev) => {
        for (let i = ev.resultIndex; i < ev.results.length; i++) {
          const res = ev.results[i];
          if (res.isFinal) {
            const spoken = sanitizeInputLive(res[0]?.transcript || '', 90).trim();
            if (spoken) {
              const startT = Math.min(Math.max(0, totalDuration - 0.5), cursorTime);
              const dur = Math.max(1.4, Math.min(3.8, spoken.split(/\s+/).length * 0.45));
              const endT = Math.min(Math.max(totalDuration, 4), Number((startT + dur).toFixed(1)));
              cursorTime = endT;
              onSetCaptions((prev) => [
                ...prev,
                {
                  id: `cap-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                  startTime: Number(startT.toFixed(1)),
                  endTime: Number(endT.toFixed(1)),
                  text: spoken,
                  style: captionStyle,
                  yPercent: 80,
                },
              ]);
            }
          }
        }
      };

      recog.onerror = () => {
        setIsListeningMic(false);
        onShowToast?.('Microphone captioning stopped.');
      };
      recog.onend = () => {
        setIsListeningMic(false);
      };

      recognitionRef.current = recog;
      recog.start();
      setIsListeningMic(true);
      onShowToast?.('Listening... Speak now to generate timed Auto-Captions!');
    } catch {
      setIsListeningMic(false);
      onShowToast?.('Could not start Speech Recognition — use manual subtitle blocks below.');
    }
  };

  const handleAddSubtitleBlock = () => {
    const start = Number(Math.max(0, Math.min(totalDuration - 0.5, playheadTime)).toFixed(1));
    const end = Number(Math.min(Math.max(totalDuration, start + 1.5), start + 2.2).toFixed(1));
    onSetCaptions((prev) => [
      ...prev,
      {
        id: `cap-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        startTime: start,
        endTime: end,
        text: prev.length === 0 ? 'Watch till the end!' : `Subtitle #${prev.length + 1}`,
        style: captionStyle,
        yPercent: 80,
      },
    ]);
  };

  const activeAnim = animTarget === 'text' && hasActiveText ? textAnimConfig : clipAnimation;
  const setActiveAnim = (updater: (prev: AnimationConfig) => AnimationConfig) => {
    if (animTarget === 'text' && hasActiveText) {
      onSetTextAnimConfig(updater(textAnimConfig));
    } else {
      onSetClipAnimation(updater);
    }
  };

  const filteredKeyframes = keyframes
    .filter((k) => k.target === kfTarget)
    .sort((a, b) => a.timeSec - b.timeSec);
  const nearestKfAtPlayhead =
    filteredKeyframes.find((k) => Math.abs(k.timeSec - playheadTime) < 0.25) || null;

  return (
    <>
      {/* AUTO-CAPTIONS / SUBTITLES */}
      {activeTool === 'captions' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h4 className="text-xs font-black text-white flex items-center gap-1.5">
                <Captions className="w-3.5 h-3.5 text-emerald-400" />
                <span>Auto-Captions &amp; Subtitles</span>
              </h4>
              <p className="text-[10px] text-neutral-400">
                Voice Speech-to-Text or manual timed subtitle blocks
              </p>
            </div>
            <button
              type="button"
              onClick={handleToggleAutoSpeechCaptions}
              className={`min-h-[38px] px-3 rounded-xl text-[11px] font-black flex items-center gap-1.5 cursor-pointer shrink-0 transition-all ${
                isListeningMic
                  ? 'bg-rose-600 text-white animate-pulse'
                  : 'bg-gradient-to-r from-emerald-500 to-cyan-500 text-black'
              }`}
            >
              {isListeningMic ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
              <span>{isListeningMic ? 'Stop Mic' : 'Voice Auto-Caption'}</span>
            </button>
          </div>

          <div className="grid grid-cols-3 gap-1.5">
            {(
              [
                { id: 'karaoke_glow', label: 'Karaoke Glow' },
                { id: 'clean_pill', label: 'Clean Pill' },
                { id: 'bold_cinema', label: 'Yellow Bold' },
              ] as const
            ).map((st) => (
              <button
                key={st.id}
                type="button"
                onClick={() => {
                  setCaptionStyle(st.id);
                  onSetCaptions((prev) => prev.map((c) => ({ ...c, style: st.id })));
                }}
                className={`min-h-[36px] px-2 rounded-xl border text-[10px] font-bold cursor-pointer ${
                  captionStyle === st.id
                    ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200'
                    : 'bg-neutral-900 border-neutral-800 text-neutral-300'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleAddSubtitleBlock}
              className="flex-1 min-h-[40px] px-3 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-emerald-400" />
              <span>Add Subtitle at {playheadTime.toFixed(1)}s</span>
            </button>
            {captions.length > 0 && (
              <button
                type="button"
                onClick={() => onSetCaptions([])}
                className="min-h-[40px] px-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-bold cursor-pointer"
              >
                Clear All
              </button>
            )}
          </div>

          <div className="space-y-2">
            {captions.map((cap, idx) => (
              <div
                key={cap.id}
                className="bg-neutral-900/80 border border-neutral-800 rounded-xl p-2.5 space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => onScrubTo(cap.startTime)}
                    className="text-[10px] font-black text-emerald-300 tabular-nums cursor-pointer"
                  >
                    #{idx + 1} · {cap.startTime.toFixed(1)}s → {cap.endTime.toFixed(1)}s
                  </button>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() =>
                        onSetCaptions((prev) => [
                          ...prev,
                          { ...cap, id: `cap-dup-${Date.now()}` },
                        ])
                      }
                      className="p-1.5 rounded-lg bg-neutral-800 text-neutral-300 hover:text-white cursor-pointer"
                      title="Duplicate caption"
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        onSetCaptions((prev) => prev.filter((c) => c.id !== cap.id))
                      }
                      className="p-1.5 rounded-lg bg-rose-500/15 text-rose-300 cursor-pointer"
                      title="Delete caption"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
                <input
                  type="text"
                  value={cap.text}
                  onChange={(e) => {
                    const val = sanitizeInputLive(e.target.value, 90);
                    onSetCaptions((prev) =>
                      prev.map((c) => (c.id === cap.id ? { ...c, text: val } : c))
                    );
                  }}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-hidden focus:border-emerald-400"
                />
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-0.5">
                    <span className="text-[9px] text-neutral-400 font-semibold">
                      Start: {cap.startTime.toFixed(1)}s
                    </span>
                    <input
                      type="range"
                      min={0}
                      max={Math.max(0.5, cap.endTime - 0.3)}
                      step={0.1}
                      value={cap.startTime}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        onSetCaptions((prev) =>
                          prev.map((c) => (c.id === cap.id ? { ...c, startTime: v } : c))
                        );
                      }}
                      className="w-full accent-emerald-400 cursor-pointer"
                    />
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[9px] text-neutral-400 font-semibold">
                      End: {cap.endTime.toFixed(1)}s
                    </span>
                    <input
                      type="range"
                      min={cap.startTime + 0.3}
                      max={Math.max(4, totalDuration)}
                      step={0.1}
                      value={cap.endTime}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        onSetCaptions((prev) =>
                          prev.map((c) => (c.id === cap.id ? { ...c, endTime: v } : c))
                        );
                      }}
                      className="w-full accent-cyan-400 cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SCROLLING NEWS / PROMO TICKER BAR */}
      {activeTool === 'ticker' && (
        <div className="space-y-3.5">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h4 className="text-xs font-black text-white flex items-center gap-1.5">
                <Megaphone className="w-3.5 h-3.5 text-rose-400" />
                <span>Scrolling News / Promo Ticker</span>
              </h4>
              <p className="text-[10px] text-neutral-400">
                Continuous marquee banner at top or bottom of your reel
              </p>
            </div>
            <button
              type="button"
              onClick={() => onSetTicker((t) => ({ ...t, enabled: !t.enabled }))}
              className={`min-h-[36px] px-3.5 rounded-xl text-xs font-black cursor-pointer ${
                ticker.enabled
                  ? 'bg-rose-600 text-white'
                  : 'bg-neutral-900 border border-neutral-700 text-neutral-300'
              }`}
            >
              {ticker.enabled ? 'Ticker: ON' : 'Enable Ticker'}
            </button>
          </div>

          <input
            type="text"
            value={ticker.text}
            onChange={(e) =>
              onSetTicker((t) => ({
                ...t,
                enabled: true,
                text: sanitizeInputLive(e.target.value, 160),
              }))
            }
            placeholder="Type scrolling news or promo text..."
            className="w-full bg-neutral-900 border border-neutral-700 focus:border-rose-500 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-hidden"
          />

          <div className="grid grid-cols-2 gap-2">
            {(['top', 'bottom'] as const).map((pos) => (
              <button
                key={pos}
                type="button"
                onClick={() => onSetTicker((t) => ({ ...t, enabled: true, position: pos }))}
                className={`min-h-[40px] rounded-xl border text-xs font-bold capitalize cursor-pointer ${
                  ticker.position === pos
                    ? 'bg-rose-600/25 border-rose-400 text-white'
                    : 'bg-neutral-900 border-neutral-800 text-neutral-400'
                }`}
              >
                {pos} Bar
              </button>
            ))}
          </div>

          <div className="bg-neutral-900/75 border border-neutral-800 rounded-2xl p-3 space-y-2.5">
            <div className="space-y-1">
              <div className="flex justify-between text-[11px]">
                <span className="text-neutral-300 font-semibold">Scroll Speed</span>
                <span className="text-rose-400 font-bold tabular-nums">{ticker.speed.toFixed(1)}x</span>
              </div>
              <input
                type="range"
                min={0.8}
                max={5}
                step={0.2}
                value={ticker.speed}
                onChange={(e) =>
                  onSetTicker((t) => ({ ...t, enabled: true, speed: Number(e.target.value) }))
                }
                className="w-full accent-rose-500 cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between gap-2 pt-1 border-t border-neutral-800">
              <span className="text-[11px] text-neutral-300 font-semibold">Bar Color</span>
              <div className="flex items-center gap-1.5">
                {['#e11d48', '#0284c7', '#111827', '#f59e0b', '#7c3aed', '#16a34a'].map((hex) => (
                  <button
                    key={hex}
                    type="button"
                    onClick={() => onSetTicker((t) => ({ ...t, enabled: true, bgColor: hex }))}
                    style={{ backgroundColor: hex }}
                    className={`w-6 h-6 rounded-full border-2 cursor-pointer ${
                      ticker.bgColor === hex ? 'border-white scale-110' : 'border-neutral-700'
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VISUAL EFFECTS / SHADERS */}
      {activeTool === 'effects' && (
        <div className="space-y-3.5">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-black text-white flex items-center gap-1.5">
              <Wand2 className="w-3.5 h-3.5 text-violet-400" />
              <span>Visual Effects &amp; Shaders</span>
            </h4>
            <span className="text-[11px] font-bold text-violet-300 tabular-nums capitalize">
              {visualEffect.type === 'none' ? 'Off' : `${visualEffect.type.replace('_', ' ')} · ${visualEffect.intensity}%`}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {VISUAL_EFFECT_PRESETS.map((fx) => {
              const active = visualEffect.type === fx.id;
              return (
                <button
                  key={fx.id}
                  type="button"
                  onClick={() =>
                    onSetVisualEffect((prev) => ({
                      type: fx.id,
                      intensity: fx.id === 'none' ? 0 : prev.intensity || 70,
                    }))
                  }
                  className={`p-2.5 rounded-xl border text-left space-y-0.5 cursor-pointer transition-all ${
                    active
                      ? 'bg-violet-600/25 border-violet-400 text-white'
                      : 'bg-neutral-900 border-neutral-800 text-neutral-300 hover:border-neutral-700'
                  }`}
                >
                  <span className="text-xs font-black block">{fx.label}</span>
                  <span className="text-[10px] text-neutral-400 block truncate">{fx.desc}</span>
                </button>
              );
            })}
          </div>

          {visualEffect.type !== 'none' && (
            <div className="bg-neutral-900/75 border border-neutral-800 rounded-2xl p-3 space-y-1">
              <div className="flex justify-between text-[11px]">
                <span className="text-neutral-300 font-semibold">Effect Intensity</span>
                <span className="text-violet-300 font-bold tabular-nums">{visualEffect.intensity}%</span>
              </div>
              <input
                type="range"
                min={10}
                max={100}
                value={visualEffect.intensity}
                onChange={(e) =>
                  onSetVisualEffect((prev) => ({ ...prev, intensity: Number(e.target.value) }))
                }
                className="w-full accent-violet-500 cursor-pointer"
              />
            </div>
          )}
        </div>
      )}

      {/* BACKGROUND REMOVER & CHROMA KEY */}
      {activeTool === 'bg_remove' && (
        <div className="space-y-3.5">
          <input
            ref={bgImageInputRef}
            type="file"
            accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (f) onPickBgReplacementImage(f);
            }}
          />

          <div className="flex items-center justify-between gap-2">
            <div>
              <h4 className="text-xs font-black text-white flex items-center gap-1.5">
                <Eraser className="w-3.5 h-3.5 text-teal-400" />
                <span>BG Remove &amp; Chroma Key</span>
              </h4>
              <p className="text-[10px] text-neutral-400">
                1-click AI subject cutout or Green Screen keyer
              </p>
            </div>
            {bgRemoval.mode !== 'off' && (
              <button
                type="button"
                onClick={() => onSetBgRemoval({ ...DEFAULT_BG_REMOVAL_CONFIG })}
                className="px-2.5 py-1 rounded-lg bg-rose-500/15 text-rose-300 text-[10px] font-bold cursor-pointer"
              >
                Turn Off
              </button>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2">
            {(
              [
                { id: 'off', label: 'Off' },
                { id: 'person_cutout', label: 'AI Cutout' },
                { id: 'chroma_green', label: 'Chroma Key' },
              ] as const
            ).map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => onSetBgRemoval((prev) => ({ ...prev, mode: m.id }))}
                className={`min-h-[42px] px-2 rounded-xl border text-xs font-black cursor-pointer ${
                  bgRemoval.mode === m.id
                    ? 'bg-teal-500/20 border-teal-400 text-teal-200'
                    : 'bg-neutral-900 border-neutral-800 text-neutral-300'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          {bgRemoval.mode !== 'off' && (
            <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl p-3 space-y-3">
              {bgRemoval.mode === 'chroma_green' && (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold text-neutral-300">Key Color</span>
                  <div className="flex items-center gap-1.5">
                    {KEY_COLOR_SWATCHES.map((hex) => (
                      <button
                        key={hex}
                        type="button"
                        onClick={() => onSetBgRemoval((p) => ({ ...p, keyColor: hex }))}
                        style={{ backgroundColor: hex }}
                        className={`w-6 h-6 rounded-full border-2 cursor-pointer ${
                          bgRemoval.keyColor === hex ? 'border-white scale-110' : 'border-neutral-700'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px]">
                    <span className="text-neutral-300 font-semibold">Strength</span>
                    <span className="text-teal-300 font-bold tabular-nums">{bgRemoval.tolerance}%</span>
                  </div>
                  <input
                    type="range"
                    min={10}
                    max={90}
                    value={bgRemoval.tolerance}
                    onChange={(e) =>
                      onSetBgRemoval((p) => ({ ...p, tolerance: Number(e.target.value) }))
                    }
                    className="w-full accent-teal-400 cursor-pointer"
                  />
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px]">
                    <span className="text-neutral-300 font-semibold">Edge Feather</span>
                    <span className="text-cyan-300 font-bold tabular-nums">{bgRemoval.feather}px</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={24}
                    value={bgRemoval.feather}
                    onChange={(e) =>
                      onSetBgRemoval((p) => ({ ...p, feather: Number(e.target.value) }))
                    }
                    className="w-full accent-cyan-400 cursor-pointer"
                  />
                </div>
              </div>

              <div className="space-y-2 pt-1 border-t border-neutral-800">
                <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                  Replace Background With
                </span>
                <div className="grid grid-cols-4 gap-1.5">
                  {(
                    [
                      { id: 'dark', label: 'Studio' },
                      { id: 'blur', label: 'Blur BG' },
                      { id: 'color', label: 'Color' },
                      { id: 'image', label: 'Image' },
                    ] as const
                  ).map((rep) => (
                    <button
                      key={rep.id}
                      type="button"
                      onClick={() => {
                        if (rep.id === 'image') {
                          bgImageInputRef.current?.click();
                        } else {
                          onSetBgRemoval((p) => ({ ...p, replaceMode: rep.id }));
                        }
                      }}
                      className={`min-h-[36px] rounded-xl border text-[10px] font-black cursor-pointer flex items-center justify-center gap-1 ${
                        bgRemoval.replaceMode === rep.id
                          ? 'bg-teal-500/20 border-teal-400 text-teal-200'
                          : 'bg-neutral-950 border-neutral-800 text-neutral-300'
                      }`}
                    >
                      {rep.id === 'image' && <ImageIcon className="w-3 h-3" />}
                      <span>{rep.label}</span>
                    </button>
                  ))}
                </div>

                {bgRemoval.replaceMode === 'color' && (
                  <div className="flex items-center gap-1.5 pt-1">
                    {BG_COLOR_SWATCHES.map((hex) => (
                      <button
                        key={hex}
                        type="button"
                        onClick={() => onSetBgRemoval((p) => ({ ...p, replaceColor: hex }))}
                        style={{ backgroundColor: hex }}
                        className={`w-6 h-6 rounded-full border-2 cursor-pointer ${
                          bgRemoval.replaceColor === hex ? 'border-teal-400 scale-110' : 'border-neutral-700'
                        }`}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* VOLUME CONTROL (0% MUTE TO 200% BOOST) */}
      {activeTool === 'volume' && (
        <div className="space-y-3.5">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h4 className="text-xs font-black text-white flex items-center gap-1.5">
                <Volume2 className="w-3.5 h-3.5 text-cyan-400" />
                <span>Volume &amp; Audio Boost (0% – 200%)</span>
              </h4>
              <p className="text-[10px] text-neutral-400">
                Mute, balance, or boost clip &amp; background music up to 200%
              </p>
            </div>
            <button
              type="button"
              onClick={onOpenMusicDrawer}
              className="px-3 py-1.5 rounded-xl bg-neutral-900 border border-neutral-700 text-pink-300 text-[10px] font-black cursor-pointer"
            >
              {hasAttachedMusic ? 'Change Music' : '+ Add Music'}
            </button>
          </div>

          <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl p-3.5 space-y-4">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-neutral-200 font-bold">Original Video Audio</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onSetOriginalVolume(originalVolume === 0 ? 100 : 0)}
                    className="px-2 py-0.5 rounded bg-neutral-800 text-[10px] font-bold text-neutral-300 cursor-pointer flex items-center gap-1"
                  >
                    <VolumeX className="w-3 h-3" />
                    <span>{originalVolume === 0 ? 'Unmute' : 'Mute'}</span>
                  </button>
                  <span className="text-cyan-300 font-black tabular-nums">
                    {hasVideoInTimeline ? `${originalVolume}%` : 'Photo'}
                  </span>
                </div>
              </div>
              <input
                type="range"
                min={0}
                max={200}
                step={5}
                disabled={!hasVideoInTimeline}
                value={originalVolume}
                onChange={(e) => onSetOriginalVolume(Number(e.target.value))}
                className="w-full accent-cyan-400 cursor-pointer disabled:opacity-40"
              />
            </div>

            <div className="space-y-1.5 pt-2 border-t border-neutral-800">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-neutral-200 font-bold">Background Music Track</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onSetBgAudioVolume(bgAudioVolume === 0 ? 100 : 0)}
                    className="px-2 py-0.5 rounded bg-neutral-800 text-[10px] font-bold text-neutral-300 cursor-pointer flex items-center gap-1"
                  >
                    <VolumeX className="w-3 h-3" />
                    <span>{bgAudioVolume === 0 ? 'Unmute' : 'Mute'}</span>
                  </button>
                  <span className="text-pink-300 font-black tabular-nums">{bgAudioVolume}%</span>
                </div>
              </div>
              <input
                type="range"
                min={0}
                max={200}
                step={5}
                value={bgAudioVolume}
                onChange={(e) => onSetBgAudioVolume(Number(e.target.value))}
                className="w-full accent-pink-500 cursor-pointer"
              />
            </div>
          </div>
        </div>
      )}

      {/* CROP & ASPECT RATIO FRAMING */}
      {activeTool === 'crop' && (
        <div className="space-y-3.5">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-black text-white flex items-center gap-1.5">
              <Crop className="w-3.5 h-3.5 text-amber-400" />
              <span>Crop &amp; Aspect Ratio</span>
            </h4>
            <button
              type="button"
              onClick={() => onSetCropConfig({ ...DEFAULT_CROP_CONFIG })}
              className="text-[10px] font-bold text-neutral-300 hover:text-white flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {CROP_ASPECTS.map((ar) => {
              const active = cropConfig.aspect === ar.id;
              return (
                <button
                  key={ar.id}
                  type="button"
                  onClick={() => onSetCropConfig((c) => ({ ...c, aspect: ar.id }))}
                  className={`p-2 rounded-xl border text-left space-y-0.5 cursor-pointer ${
                    active
                      ? 'bg-amber-500/20 border-amber-400 text-white'
                      : 'bg-neutral-900 border-neutral-800 text-neutral-300'
                  }`}
                >
                  <span className="text-xs font-black block">{ar.label}</span>
                  <span className="text-[10px] text-neutral-400 block">{ar.sub}</span>
                </button>
              );
            })}
          </div>

          <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl p-3 space-y-2.5">
            <div className="space-y-1">
              <div className="flex justify-between text-[11px]">
                <span className="text-neutral-300 font-semibold">Zoom Frame</span>
                <span className="text-amber-300 font-bold tabular-nums">{cropConfig.zoom.toFixed(2)}x</span>
              </div>
              <input
                type="range"
                min={1}
                max={3}
                step={0.05}
                value={cropConfig.zoom}
                onChange={(e) =>
                  onSetCropConfig((c) => ({ ...c, zoom: Number(e.target.value) }))
                }
                className="w-full accent-amber-400 cursor-pointer"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <div className="flex justify-between text-[10px]">
                  <span className="text-neutral-300 font-semibold">Pan X</span>
                  <span className="text-cyan-300 font-bold tabular-nums">{cropConfig.panXPercent}%</span>
                </div>
                <input
                  type="range"
                  min={-40}
                  max={40}
                  value={cropConfig.panXPercent}
                  onChange={(e) =>
                    onSetCropConfig((c) => ({ ...c, panXPercent: Number(e.target.value) }))
                  }
                  className="w-full accent-cyan-400 cursor-pointer"
                />
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-[10px]">
                  <span className="text-neutral-300 font-semibold">Pan Y</span>
                  <span className="text-pink-300 font-bold tabular-nums">{cropConfig.panYPercent}%</span>
                </div>
                <input
                  type="range"
                  min={-40}
                  max={40}
                  value={cropConfig.panYPercent}
                  onChange={(e) =>
                    onSetCropConfig((c) => ({ ...c, panYPercent: Number(e.target.value) }))
                  }
                  className="w-full accent-pink-500 cursor-pointer"
                />
              </div>
            </div>

            {cropConfig.aspect === 'freeform' && (
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-neutral-800">
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px]">
                    <span className="text-neutral-300 font-semibold">Crop Width</span>
                    <span className="text-amber-300 font-bold tabular-nums">
                      {cropConfig.freeRect.w}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={30}
                    max={100}
                    value={cropConfig.freeRect.w}
                    onChange={(e) => {
                      const wVal = Number(e.target.value);
                      onSetCropConfig((c) => ({
                        ...c,
                        freeRect: {
                          ...c.freeRect,
                          w: wVal,
                          x: Math.round((100 - wVal) / 2),
                        },
                      }));
                    }}
                    className="w-full accent-amber-400 cursor-pointer"
                  />
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px]">
                    <span className="text-neutral-300 font-semibold">Crop Height</span>
                    <span className="text-amber-300 font-bold tabular-nums">
                      {cropConfig.freeRect.h}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={30}
                    max={100}
                    value={cropConfig.freeRect.h}
                    onChange={(e) => {
                      const hVal = Number(e.target.value);
                      onSetCropConfig((c) => ({
                        ...c,
                        freeRect: {
                          ...c.freeRect,
                          h: hVal,
                          y: Math.round((100 - hVal) / 2),
                        },
                      }));
                    }}
                    className="w-full accent-amber-400 cursor-pointer"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* IN / OUT / COMBO ANIMATIONS */}
      {activeTool === 'animation' && (
        <div className="space-y-3.5">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-xs font-black text-white flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-pink-400" />
              <span>In, Out &amp; Combo Animations</span>
            </h4>
            {hasActiveText && (
              <div className="flex items-center bg-neutral-900 border border-neutral-800 rounded-xl p-0.5">
                {(['clip', 'text'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setAnimTarget(t)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-black capitalize cursor-pointer ${
                      animTarget === t ? 'bg-pink-600 text-white' : 'text-neutral-400'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2.5">
            <div>
              <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">
                Entrance (In)
              </span>
              <div className="grid grid-cols-4 gap-1.5">
                {ANIM_PRESETS.map((p) => (
                  <button
                    key={`in-${p.id}`}
                    type="button"
                    onClick={() => setActiveAnim((prev) => ({ ...prev, inAnim: p.id }))}
                    className={`min-h-[34px] px-1.5 rounded-lg border text-[10px] font-bold cursor-pointer ${
                      activeAnim.inAnim === p.id
                        ? 'bg-pink-600/25 border-pink-400 text-white'
                        : 'bg-neutral-900 border-neutral-800 text-neutral-300'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">
                Exit (Out)
              </span>
              <div className="grid grid-cols-4 gap-1.5">
                {ANIM_PRESETS.map((p) => (
                  <button
                    key={`out-${p.id}`}
                    type="button"
                    onClick={() => setActiveAnim((prev) => ({ ...prev, outAnim: p.id }))}
                    className={`min-h-[34px] px-1.5 rounded-lg border text-[10px] font-bold cursor-pointer ${
                      activeAnim.outAnim === p.id
                        ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200'
                        : 'bg-neutral-900 border-neutral-800 text-neutral-300'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">
                Combo Loop
              </span>
              <div className="grid grid-cols-4 gap-1.5">
                {ANIM_PRESETS.slice(0, 6).map((p) => (
                  <button
                    key={`combo-${p.id}`}
                    type="button"
                    onClick={() => setActiveAnim((prev) => ({ ...prev, comboAnim: p.id }))}
                    className={`min-h-[34px] px-1.5 rounded-lg border text-[10px] font-bold cursor-pointer ${
                      activeAnim.comboAnim === p.id
                        ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                        : 'bg-neutral-900 border-neutral-800 text-neutral-300'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-neutral-900/75 border border-neutral-800 rounded-xl p-2.5 space-y-1">
              <div className="flex justify-between text-[11px]">
                <span className="text-neutral-300 font-semibold">Animation Speed / Duration</span>
                <span className="text-pink-300 font-bold tabular-nums">{activeAnim.durationSec.toFixed(1)}s</span>
              </div>
              <input
                type="range"
                min={0.3}
                max={2.0}
                step={0.1}
                value={activeAnim.durationSec}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setActiveAnim((prev) => ({ ...prev, durationSec: v }));
                }}
                className="w-full accent-pink-500 cursor-pointer"
              />
            </div>
          </div>
        </div>
      )}

      {/* TIMELINE KEYFRAMES */}
      {activeTool === 'keyframe' && (
        <div className="space-y-3.5">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h4 className="text-xs font-black text-white flex items-center gap-1.5">
                <Diamond className="w-3.5 h-3.5 text-amber-400" />
                <span>Keyframe Animator</span>
              </h4>
              <p className="text-[10px] text-neutral-400">
                Add diamond ◆ markers to animate X/Y, Zoom, Rotation &amp; Opacity
              </p>
            </div>
            <button
              type="button"
              onClick={() => onAddOrUpdateKeyframe(kfTarget)}
              className="min-h-[38px] px-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-black text-[11px] font-black flex items-center gap-1 cursor-pointer shrink-0"
            >
              <Diamond className="w-3.5 h-3.5 fill-black" />
              <span>{nearestKfAtPlayhead ? 'Update ◆' : '+ Add ◆'}</span>
            </button>
          </div>

          <div className="grid grid-cols-3 gap-1.5 bg-neutral-900 p-1 rounded-xl border border-neutral-800">
            {(
              [
                { id: 'main', label: 'Main Clip' },
                { id: 'text', label: 'Text Layer' },
                { id: 'overlay', label: 'Overlay PIP' },
              ] as const
            ).map((tgt) => (
              <button
                key={tgt.id}
                type="button"
                onClick={() => setKfTarget(tgt.id)}
                className={`min-h-[34px] rounded-lg text-[10px] font-black cursor-pointer ${
                  kfTarget === tgt.id ? 'bg-amber-400 text-black' : 'text-neutral-300'
                }`}
              >
                {tgt.label}
              </button>
            ))}
          </div>

          {nearestKfAtPlayhead ? (
            <div className="bg-neutral-900/80 border border-amber-500/40 rounded-2xl p-3 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-amber-300 tabular-nums">
                  Editing ◆ @ {nearestKfAtPlayhead.timeSec.toFixed(1)}s
                </span>
                <button
                  type="button"
                  onClick={() => onDeleteKeyframe(nearestKfAtPlayhead.id)}
                  className="px-2 py-1 rounded-lg bg-rose-500/15 text-rose-300 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Delete ◆</span>
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <span className="text-[10px] text-neutral-300">
                    X Position ({nearestKfAtPlayhead.xPercent}%)
                  </span>
                  <input
                    type="range"
                    min={10}
                    max={90}
                    value={nearestKfAtPlayhead.xPercent}
                    onChange={(e) =>
                      onUpdateKeyframe(nearestKfAtPlayhead.id, { xPercent: Number(e.target.value) })
                    }
                    className="w-full accent-amber-400 cursor-pointer"
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] text-neutral-300">
                    Y Position ({nearestKfAtPlayhead.yPercent}%)
                  </span>
                  <input
                    type="range"
                    min={10}
                    max={90}
                    value={nearestKfAtPlayhead.yPercent}
                    onChange={(e) =>
                      onUpdateKeyframe(nearestKfAtPlayhead.id, { yPercent: Number(e.target.value) })
                    }
                    className="w-full accent-amber-400 cursor-pointer"
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] text-neutral-300">
                    Scale / Zoom ({nearestKfAtPlayhead.scale.toFixed(2)}x)
                  </span>
                  <input
                    type="range"
                    min={0.4}
                    max={2.4}
                    step={0.05}
                    value={nearestKfAtPlayhead.scale}
                    onChange={(e) =>
                      onUpdateKeyframe(nearestKfAtPlayhead.id, { scale: Number(e.target.value) })
                    }
                    className="w-full accent-cyan-400 cursor-pointer"
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] text-neutral-300">
                    Rotation ({nearestKfAtPlayhead.rotationDeg}°)
                  </span>
                  <input
                    type="range"
                    min={-180}
                    max={180}
                    value={nearestKfAtPlayhead.rotationDeg}
                    onChange={(e) =>
                      onUpdateKeyframe(nearestKfAtPlayhead.id, {
                        rotationDeg: Number(e.target.value),
                      })
                    }
                    className="w-full accent-pink-500 cursor-pointer"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <span className="text-[10px] text-neutral-300">
                  Opacity ({nearestKfAtPlayhead.opacity}%)
                </span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={nearestKfAtPlayhead.opacity}
                  onChange={(e) =>
                    onUpdateKeyframe(nearestKfAtPlayhead.id, { opacity: Number(e.target.value) })
                  }
                  className="w-full accent-emerald-400 cursor-pointer"
                />
              </div>
            </div>
          ) : (
            <div className="rounded-xl bg-neutral-900/70 border border-neutral-800 p-3 text-xs text-neutral-400">
              Scrub playhead to any timestamp and tap <strong className="text-amber-300">+ Add ◆</strong> to set keyframe points (2+ keyframes smoothly animate motion).
            </div>
          )}

          {filteredKeyframes.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {filteredKeyframes.map((kf) => (
                <button
                  key={kf.id}
                  type="button"
                  onClick={() => onScrubTo(kf.timeSec)}
                  className={`px-2.5 py-1 rounded-lg border text-[10px] font-black tabular-nums cursor-pointer flex items-center gap-1 ${
                    nearestKfAtPlayhead?.id === kf.id
                      ? 'bg-amber-400 text-black border-amber-300'
                      : 'bg-neutral-900 border-neutral-700 text-amber-300'
                  }`}
                >
                  <span>◆ {kf.timeSec.toFixed(1)}s</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ENHANCE 4K / FULL HD CLARITY */}
      {activeTool === 'enhance' && (
        <div className="space-y-3.5">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h4 className="text-xs font-black text-white flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-cyan-400" />
                <span>Enhance 4K / Full HD Quality</span>
              </h4>
              <p className="text-[10px] text-neutral-400">
                Crisp edge sharpening, clarity boost &amp; 60fps export resolution
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                onSetEnhanceConfig((e) => ({ ...e, enabled: !e.enabled }))
              }
              className={`min-h-[36px] px-3.5 rounded-xl text-xs font-black cursor-pointer ${
                enhanceConfig.enabled
                  ? 'bg-cyan-400 text-black'
                  : 'bg-neutral-900 border border-neutral-700 text-neutral-300'
              }`}
            >
              {enhanceConfig.enabled ? 'Enhance: ON' : 'Enable Enhance'}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {(
              [
                { id: '1080p', label: '1080p Full HD', sub: 'Fast 60fps Export' },
                { id: '4k', label: '4K Ultra HD', sub: '2160p Master Quality' },
              ] as const
            ).map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => onSetExportResolution(r.id)}
                className={`p-3 rounded-xl border text-left space-y-0.5 cursor-pointer ${
                  exportResolution === r.id
                    ? 'bg-cyan-500/20 border-cyan-400 text-white'
                    : 'bg-neutral-900 border-neutral-800 text-neutral-300'
                }`}
              >
                <span className="text-xs font-black block">{r.label}</span>
                <span className="text-[10px] text-neutral-400 block">{r.sub}</span>
              </button>
            ))}
          </div>

          <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl p-3 space-y-3">
            <div className="space-y-1">
              <div className="flex justify-between text-[11px]">
                <span className="text-neutral-300 font-semibold">HD Edge Sharpening</span>
                <span className="text-cyan-300 font-bold tabular-nums">{enhanceConfig.sharpness}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={enhanceConfig.sharpness}
                onChange={(e) =>
                  onSetEnhanceConfig((c) => ({
                    ...c,
                    enabled: true,
                    sharpness: Number(e.target.value),
                  }))
                }
                className="w-full accent-cyan-400 cursor-pointer"
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-[11px]">
                <span className="text-neutral-300 font-semibold">Clarity &amp; Contrast Boost</span>
                <span className="text-pink-300 font-bold tabular-nums">{enhanceConfig.clarity}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={enhanceConfig.clarity}
                onChange={(e) =>
                  onSetEnhanceConfig((c) => ({
                    ...c,
                    enabled: true,
                    clarity: Number(e.target.value),
                  }))
                }
                className="w-full accent-pink-500 cursor-pointer"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
};
