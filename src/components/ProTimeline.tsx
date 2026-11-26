import React, { useRef, useState, useMemo, useCallback } from 'react';
import {
  Play,
  Pause,
  Scissors,
  ZoomIn,
  ZoomOut,
  Plus,
  Music,
  Type,
  Smile,
  ArrowLeftRight,
  Film,
  Image as ImageIcon,
  Layers,
  Sparkles,
} from 'lucide-react';
import {
  ComputedClipSpan,
  ClipTransitionType,
  EditorStickerLayer,
  EditorTextLayer,
  EditorOverlayLayer,
  EditorMaskShape,
} from '../utils/proEditorEngine';

interface ProTimelineProps {
  spans: ComputedClipSpan[];
  totalDuration: number;
  playheadTime: number;
  isPlaying: boolean;
  selectedClipId: string | null;
  zoomLevel: number; // 1..4
  audioLabel: string;
  hasAttachedMusic: boolean;
  audioStartOffset?: number;
  audioFadeIn?: number;
  audioFadeOut?: number;
  textLayer: EditorTextLayer;
  stickers: EditorStickerLayer[];
  overlays?: EditorOverlayLayer[];
  activeMaskShape?: EditorMaskShape;
  onTogglePlay: () => void;
  onScrub: (timeSec: number) => void;
  onSelectClip: (clipId: string) => void;
  onSplitAtPlayhead: () => void;
  onTrimClip: (clipId: string, nextTrimStart: number, nextTrimEnd: number) => void;
  onZoomChange: (nextZoom: number) => void;
  onAddClipClick: () => void;
  onOpenTransitionForClip: (clipId: string) => void;
  onFocusTrackTool: (tool: 'music' | 'text' | 'stickers' | 'overlay' | 'mask') => void;
  onAudioBarClick?: () => void;
}

function formatTimelineClock(sec: number): string {
  const safe = Math.max(0, sec);
  const mins = Math.floor(safe / 60);
  const secs = Math.floor(safe % 60);
  const tenths = Math.floor((safe % 1) * 10);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}.${tenths}`;
}

function shortTransitionLabel(tr: ClipTransitionType): string {
  switch (tr) {
    case 'fade':
      return 'Fade';
    case 'zoom_punch':
      return 'Zoom';
    case 'glitch':
      return 'Glitch';
    case 'swipe':
      return 'Swipe';
    default:
      return '';
  }
}

export const ProTimeline: React.FC<ProTimelineProps> = React.memo(({
  spans,
  totalDuration,
  playheadTime,
  isPlaying,
  selectedClipId,
  zoomLevel,
  audioLabel,
  hasAttachedMusic,
  audioStartOffset = 0,
  audioFadeIn = 0,
  audioFadeOut = 0,
  textLayer,
  stickers,
  overlays = [],
  activeMaskShape = 'none',
  onTogglePlay,
  onScrub,
  onSelectClip,
  onSplitAtPlayhead,
  onTrimClip,
  onZoomChange,
  onAddClipClick,
  onOpenTransitionForClip,
  onFocusTrackTool,
  onAudioBarClick,
}) => {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const trackAreaRef = useRef<HTMLDivElement | null>(null);
  const [isDraggingPlayhead, setIsDraggingPlayhead] = useState(false);

  const pxPerSec = 48 * zoomLevel;
  const labelGutterPx = 68;
  const timelineWidthPx = Math.max(260, Math.ceil(Math.max(4, totalDuration) * pxPerSec));

  const rulerTicks = useMemo(() => {
    const step = zoomLevel >= 2.2 ? 0.5 : zoomLevel >= 1.4 ? 1 : 2;
    const count = Math.ceil(Math.max(4, totalDuration) / step);
    const ticks: number[] = [];
    for (let i = 0; i <= count; i++) {
      ticks.push(Number((i * step).toFixed(1)));
    }
    return ticks;
  }, [totalDuration, zoomLevel]);

  const scrubFromClientX = useCallback(
    (clientX: number) => {
      const area = trackAreaRef.current;
      if (!area) return;
      const rect = area.getBoundingClientRect();
      const xInTimeline = Math.max(0, clientX - rect.left - labelGutterPx);
      const nextTime = Math.max(0, Math.min(totalDuration, xInTimeline / pxPerSec));
      onScrub(nextTime);
    },
    [onScrub, pxPerSec, totalDuration]
  );

  // Trim Handle Dragging
  const startTrimDrag = (
    e: React.PointerEvent,
    span: ComputedClipSpan,
    side: 'left' | 'right'
  ) => {
    e.stopPropagation();
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture?.(e.pointerId);
    const startX = e.clientX;
    const origStart = span.clip.trimStart;
    const origEnd = span.clip.trimEnd;
    const maxSource = span.clip.naturalDuration;
    const minSourceLen = 0.4;

    const handleMove = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      const deltaSourceSec = (dx / pxPerSec) * span.clip.speed;
      if (side === 'left') {
        const nextStart = Math.max(0, Math.min(origEnd - minSourceLen, origStart + deltaSourceSec));
        onTrimClip(span.clip.id, Number(nextStart.toFixed(2)), origEnd);
      } else {
        const nextEnd = Math.min(maxSource, Math.max(origStart + minSourceLen, origEnd + deltaSourceSec));
        onTrimClip(span.clip.id, origStart, Number(nextEnd.toFixed(2)));
      }
    };

    const handleUp = () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', handleUp);
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('pointercancel', handleUp);
  };

  // Playhead Needle Dragging
  const handlePlayheadPointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture?.(e.pointerId);
    setIsDraggingPlayhead(true);
    scrubFromClientX(e.clientX);

    const handleMove = (ev: PointerEvent) => {
      scrubFromClientX(ev.clientX);
    };
    const handleUp = () => {
      setIsDraggingPlayhead(false);
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', handleUp);
    };
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('pointercancel', handleUp);
  };

  // Waveform visual pattern bars for Audio Track
  const waveformBars = useMemo(() => {
    const count = Math.max(24, Math.min(140, Math.floor(timelineWidthPx / 7)));
    return Array.from({ length: count }, (_, idx) => {
      const hPct = 28 + Math.round(62 * Math.abs(Math.sin(idx * 0.65) * Math.cos(idx * 0.23)));
      return hPct;
    });
  }, [timelineWidthPx]);

  const playheadLeftPx = labelGutterPx + Math.min(totalDuration, Math.max(0, playheadTime)) * pxPerSec;

  return (
    <div className="bg-[#0b0b0f] border-t border-neutral-800/90 select-none shrink-0">
      {/* Transport & Timeline Controls Row */}
      <div className="px-3 sm:px-4 py-1.5 border-b border-neutral-800/80 flex items-center justify-between gap-2 bg-[#101016]">
        {/* Left: Play/Pause + Timecode */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onTogglePlay}
            className="min-w-[38px] min-h-[36px] px-2.5 rounded-lg bg-white text-black hover:bg-neutral-200 flex items-center justify-center gap-1 text-xs font-black cursor-pointer active:scale-95 transition-transform"
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5 fill-black" /> : <Play className="w-3.5 h-3.5 fill-black ml-0.5" />}
          </button>
          <span className="text-[11px] font-bold text-neutral-200 tabular-nums tracking-tight">
            {formatTimelineClock(playheadTime)}{' '}
            <span className="text-neutral-500">/ {formatTimelineClock(totalDuration)}</span>
          </span>
        </div>

        {/* Center/Right: One-Tap Split, Zoom -, Zoom +, Add Clip */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onSplitAtPlayhead}
            disabled={spans.length === 0}
            className="min-h-[36px] px-2.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 disabled:opacity-40 border border-neutral-700/80 text-white text-[11px] font-bold flex items-center gap-1.5 cursor-pointer active:scale-95"
            title="Split clip at playhead needle"
          >
            <Scissors className="w-3.5 h-3.5 text-pink-400" />
            <span>Split</span>
          </button>

          <div className="hidden sm:flex items-center bg-neutral-900 border border-neutral-800 rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => onZoomChange(Math.max(1, Number((zoomLevel - 0.5).toFixed(1))))}
              className="w-8 h-8 flex items-center justify-center text-neutral-300 hover:text-white hover:bg-neutral-800 cursor-pointer"
              title="Zoom out timeline"
              aria-label="Zoom out timeline"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="px-1.5 text-[10px] font-bold text-neutral-400 tabular-nums">
              {zoomLevel.toFixed(1)}x
            </span>
            <button
              type="button"
              onClick={() => onZoomChange(Math.min(4, Number((zoomLevel + 0.5).toFixed(1))))}
              className="w-8 h-8 flex items-center justify-center text-neutral-300 hover:text-white hover:bg-neutral-800 cursor-pointer"
              title="Zoom in timeline"
              aria-label="Zoom in timeline"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            type="button"
            onClick={onAddClipClick}
            className="min-h-[36px] px-2.5 rounded-lg bg-gradient-to-r from-pink-600 to-rose-500 hover:brightness-110 text-white text-[11px] font-black flex items-center gap-1 cursor-pointer active:scale-95"
            title="Add video or photo clip"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Clip</span>
          </button>
        </div>
      </div>

      {/* Scrollable Multi-Track Canvas */}
      <div
        ref={scrollerRef}
        className="relative overflow-x-auto overflow-y-hidden no-scrollbar bg-[#09090d]"
      >
        <div
          ref={trackAreaRef}
          style={{ width: `${labelGutterPx + timelineWidthPx + 48}px` }}
          onPointerDown={(e) => {
            if ((e.target as HTMLElement).closest('[data-no-scrub="true"]')) return;
            scrubFromClientX(e.clientX);
          }}
          className="relative py-1.5 space-y-1.5"
        >
          {/* Ruler Track */}
          <div className="relative h-5 flex items-center border-b border-neutral-800/70">
            <div
              style={{ width: `${labelGutterPx}px` }}
              className="sticky left-0 z-20 h-full bg-[#09090d] px-2 flex items-center justify-between text-[9px] font-bold text-neutral-500 uppercase tracking-wider shrink-0"
            >
              <span>Time</span>
              <div className="flex sm:hidden items-center gap-1">
                <button
                  type="button"
                  data-no-scrub="true"
                  onClick={(e) => {
                    e.stopPropagation();
                    onZoomChange(zoomLevel > 1 ? 1 : 2.5);
                  }}
                  className="text-cyan-400 font-black"
                >
                  {zoomLevel.toFixed(0)}x
                </button>
              </div>
            </div>
            <div className="relative flex-1 h-full">
              {rulerTicks.map((tick) => (
                <div
                  key={tick}
                  style={{ left: `${tick * pxPerSec}px` }}
                  className="absolute top-0 bottom-0 flex flex-col justify-end pointer-events-none"
                >
                  <span className="text-[9px] font-semibold text-neutral-500 tabular-nums -translate-x-1/2 pl-2">
                    {tick}s
                  </span>
                  <span className="w-px h-1.5 bg-neutral-700" />
                </div>
              ))}
            </div>
          </div>

          {/* Track 1: VIDEO / PHOTO CLIPS */}
          <div className="relative h-12 flex items-center">
            <div
              style={{ width: `${labelGutterPx}px` }}
              className="sticky left-0 z-20 h-full bg-[#09090d]/95 border-r border-neutral-800/80 px-2 flex items-center gap-1 text-[10px] font-bold text-neutral-300 shrink-0"
            >
              <Film className="w-3 h-3 text-cyan-400 shrink-0" />
              <span>Video</span>
            </div>
            <div className="relative h-11 flex items-center">
              {spans.map((span, idx) => {
                const widthPx = Math.max(40, span.effectiveDuration * pxPerSec);
                const selected = span.clip.id === selectedClipId;
                const isLast = idx === spans.length - 1;
                const trLabel = shortTransitionLabel(span.clip.transitionAfter);

                return (
                  <React.Fragment key={span.clip.id}>
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectClip(span.clip.id);
                      }}
                      style={{ width: `${widthPx}px` }}
                      className={`relative h-10 rounded-lg overflow-hidden flex items-center justify-between px-2.5 cursor-pointer transition-colors shrink-0 ${
                        selected
                          ? 'bg-gradient-to-r from-cyan-950/90 via-neutral-900 to-pink-950/90 border-2 border-white shadow-md z-10'
                          : 'bg-neutral-900 border border-neutral-700/80 hover:border-neutral-500'
                      }`}
                    >
                      {/* Left Trim Handle */}
                      {selected && (
                        <div
                          data-no-scrub="true"
                          onPointerDown={(e) => startTrimDrag(e, span, 'left')}
                          className="absolute left-0 top-0 bottom-0 w-3.5 bg-white text-black flex items-center justify-center cursor-ew-resize z-20 touch-none"
                          title="Drag to trim clip start"
                        >
                          <span className="w-0.5 h-4 bg-neutral-800 rounded-full" />
                        </div>
                      )}

                      <div className="flex items-center gap-1.5 min-w-0 px-2 pointer-events-none">
                        {span.clip.mediaType === 'image' ? (
                          <ImageIcon className="w-3 h-3 text-cyan-400 shrink-0" />
                        ) : (
                          <Film className="w-3 h-3 text-pink-400 shrink-0" />
                        )}
                        <span className="text-[10px] font-bold text-white truncate">
                          Clip {idx + 1}
                        </span>
                        {span.clip.speed !== 1 && (
                          <span className="text-[9px] font-black text-amber-300 tabular-nums shrink-0">
                            {span.clip.speed}x
                          </span>
                        )}
                      </div>
                      <span className="text-[9px] font-semibold text-neutral-400 tabular-nums pr-1.5 pointer-events-none shrink-0">
                        {span.effectiveDuration.toFixed(1)}s
                      </span>

                      {/* Right Trim Handle */}
                      {selected && (
                        <div
                          data-no-scrub="true"
                          onPointerDown={(e) => startTrimDrag(e, span, 'right')}
                          className="absolute right-0 top-0 bottom-0 w-3.5 bg-white text-black flex items-center justify-center cursor-ew-resize z-20 touch-none"
                          title="Drag to trim clip end"
                        >
                          <span className="w-0.5 h-4 bg-neutral-800 rounded-full" />
                        </div>
                      )}
                    </div>

                    {/* Transition Join Button between clips */}
                    {!isLast && (
                      <button
                        type="button"
                        data-no-scrub="true"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenTransitionForClip(span.clip.id);
                        }}
                        className={`-mx-2 z-20 min-w-[26px] h-7 px-1 rounded-md border flex items-center justify-center gap-0.5 text-[9px] font-black cursor-pointer shrink-0 transition-all ${
                          span.clip.transitionAfter !== 'none'
                            ? 'bg-pink-600 border-pink-300 text-white shadow-sm'
                            : 'bg-neutral-950 border-neutral-600 text-neutral-300 hover:border-white'
                        }`}
                        title="Edit clip transition"
                      >
                        <ArrowLeftRight className="w-2.5 h-2.5" />
                        {trLabel && <span className="hidden sm:inline">{trLabel}</span>}
                      </button>
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>

          {/* Track 2: AUDIO / MUSIC */}
          <div className="relative h-9 flex items-center">
            <div
              style={{ width: `${labelGutterPx}px` }}
              className="sticky left-0 z-20 h-full bg-[#09090d]/95 border-r border-neutral-800/80 px-2 flex items-center gap-1 text-[10px] font-bold text-neutral-300 shrink-0"
            >
              <Music className="w-3 h-3 text-emerald-400 shrink-0" />
              <span>Audio</span>
            </div>
            <button
              type="button"
              data-no-scrub="true"
              onClick={(e) => {
                e.stopPropagation();
                if (onAudioBarClick) {
                  onAudioBarClick();
                } else {
                  onFocusTrackTool('music');
                }
              }}
              style={{ width: `${Math.max(180, totalDuration * pxPerSec)}px` }}
              className={`relative z-20 h-8 rounded-lg border px-2.5 flex items-center justify-between gap-2 overflow-hidden cursor-pointer transition-colors text-left ${
                hasAttachedMusic
                  ? 'bg-emerald-950/60 border-emerald-500/45 hover:border-emerald-400'
                  : 'bg-neutral-900/70 border-neutral-800 hover:border-pink-500/50'
              }`}
            >
              {/* Waveform visual strip */}
              <div className="absolute inset-0 flex items-center gap-0.5 px-1 opacity-30 pointer-events-none">
                {waveformBars.map((hPct, i) => (
                  <span
                    key={i}
                    style={{ height: `${hPct}%` }}
                    className={`w-1 rounded-full shrink-0 ${
                      hasAttachedMusic ? 'bg-emerald-400' : 'bg-cyan-400'
                    }`}
                  />
                ))}
              </div>
              <span className="relative z-10 text-[10px] font-bold text-white truncate">
                {audioLabel}
              </span>
              {hasAttachedMusic ? (
                <div className="relative z-10 flex items-center gap-1 shrink-0">
                  {audioStartOffset > 0 && (
                    <span className="px-1.5 py-0.5 rounded bg-black/60 text-emerald-300 text-[9px] font-black tabular-nums">
                      @{audioStartOffset.toFixed(1)}s
                    </span>
                  )}
                  {(audioFadeIn > 0 || audioFadeOut > 0) && (
                    <span className="px-1.5 py-0.5 rounded bg-black/60 text-cyan-300 text-[9px] font-black">
                      Fade
                    </span>
                  )}
                  <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-200 text-[9px] font-bold">
                    Trim
                  </span>
                </div>
              ) : (
                <span className="relative z-10 text-[9px] font-black text-pink-300 shrink-0">
                  + Sounds
                </span>
              )}
            </button>
          </div>

          {/* Track 3: TEXT & STICKERS */}
          <div className="relative h-8 flex items-center">
            <div
              style={{ width: `${labelGutterPx}px` }}
              className="sticky left-0 z-20 h-full bg-[#09090d]/95 border-r border-neutral-800/80 px-2 flex items-center gap-1 text-[10px] font-bold text-neutral-300 shrink-0"
            >
              <Type className="w-3 h-3 text-amber-400 shrink-0" />
              <span>Layers</span>
            </div>
            <div className="relative z-20 flex items-center gap-1.5 h-7">
              <button
                type="button"
                data-no-scrub="true"
                onClick={(e) => {
                  e.stopPropagation();
                  onFocusTrackTool('text');
                }}
                style={{
                  width: `${Math.max(108, Math.min(totalDuration * pxPerSec, totalDuration * pxPerSec * 0.6))}px`,
                }}
                className={`h-7 rounded-md border px-2 flex items-center gap-1 text-[10px] font-bold truncate cursor-pointer active:scale-95 transition-all ${
                  textLayer.text.trim()
                    ? 'bg-amber-500/20 border-amber-400/50 text-amber-200 hover:border-amber-300'
                    : 'bg-neutral-900/80 border-neutral-700 text-neutral-200 hover:text-white hover:border-pink-500/60'
                }`}
              >
                <Type className="w-3 h-3 shrink-0 text-amber-400" />
                <span className="truncate">
                  {textLayer.text.trim() ? `"${textLayer.text.trim()}"` : '+ Add Caption'}
                </span>
              </button>

              <button
                type="button"
                data-no-scrub="true"
                onClick={(e) => {
                  e.stopPropagation();
                  onFocusTrackTool('stickers');
                }}
                className={`h-7 rounded-md border px-2.5 flex items-center gap-1 text-[10px] font-bold cursor-pointer shrink-0 active:scale-95 transition-all ${
                  stickers.length > 0
                    ? 'bg-pink-500/20 border-pink-400/50 text-pink-200 hover:border-pink-300'
                    : 'bg-neutral-900/80 border-neutral-700 text-neutral-200 hover:text-white hover:border-pink-500/60'
                }`}
              >
                <Smile className="w-3 h-3 shrink-0 text-pink-400" />
                <span>
                  {stickers.length > 0
                    ? `${stickers.length} Sticker${stickers.length > 1 ? 's' : ''}`
                    : '+ Sticker'}
                </span>
              </button>

              <button
                type="button"
                data-no-scrub="true"
                onClick={(e) => {
                  e.stopPropagation();
                  onFocusTrackTool('overlay');
                }}
                className={`h-7 rounded-md border px-2.5 flex items-center gap-1 text-[10px] font-bold cursor-pointer shrink-0 active:scale-95 transition-all ${
                  overlays.length > 0
                    ? 'bg-cyan-500/20 border-cyan-400/50 text-cyan-200 hover:border-cyan-300'
                    : 'bg-neutral-900/80 border-neutral-700 text-neutral-200 hover:text-white hover:border-cyan-500/60'
                }`}
              >
                <Layers className="w-3 h-3 shrink-0 text-cyan-400" />
                <span>
                  {overlays.length > 0
                    ? `${overlays.length} Overlay${overlays.length > 1 ? 's' : ''}`
                    : '+ Overlay'}
                </span>
              </button>

              <button
                type="button"
                data-no-scrub="true"
                onClick={(e) => {
                  e.stopPropagation();
                  onFocusTrackTool('mask');
                }}
                className={`h-7 rounded-md border px-2.5 flex items-center gap-1 text-[10px] font-bold cursor-pointer shrink-0 active:scale-95 transition-all ${
                  activeMaskShape !== 'none'
                    ? 'bg-purple-500/25 border-purple-400/60 text-purple-200 hover:border-purple-300'
                    : 'bg-neutral-900/80 border-neutral-700 text-neutral-200 hover:text-white hover:border-purple-500/60'
                }`}
              >
                <Sparkles className="w-3 h-3 shrink-0 text-purple-400" />
                <span className="capitalize">
                  {activeMaskShape !== 'none' ? `Mask: ${activeMaskShape}` : '+ Mask'}
                </span>
              </button>
            </div>
          </div>

          {/* Draggable Playhead Needle (top handle captures pointer; vertical stem does not block clicks below) */}
          <div
            style={{ left: `${playheadLeftPx}px` }}
            className={`absolute top-0 bottom-0 -translate-x-1/2 w-5 z-30 flex flex-col items-center pointer-events-none ${
              isDraggingPlayhead ? 'scale-x-105' : ''
            }`}
          >
            <div
              data-no-scrub="true"
              onPointerDown={handlePlayheadPointerDown}
              className="w-6 h-5 flex items-start justify-center cursor-ew-resize touch-none pointer-events-auto"
              title="Drag playhead needle"
            >
              <div className="w-3.5 h-3.5 rounded-sm bg-white border border-cyan-400 shadow-md rotate-45 -mt-0.5 shrink-0" />
            </div>
            <div className="w-0.5 flex-1 bg-white shadow-[0_0_8px_rgba(34,211,238,0.85)] pointer-events-none" />
          </div>
        </div>
      </div>
    </div>
  );
});
