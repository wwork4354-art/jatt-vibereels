import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Plus,
  X,
  ChevronLeft,
  ChevronRight,
  Camera,
  Trash2,
  Clock,
  Volume2,
  VolumeX,
  Pause,
  Play,
  MessageCircle,
  Sparkles,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { LiveStoryItem, DirectSnapRecipient } from '../types';
import { isStoryActive } from '../lib/liveSnapService';
import { normalizeCreatorUsername } from '../lib/supabaseService';
import { optimizeThumbnailUrl } from '../utils/imageOptimize';

interface LiveStoriesBarProps {
  stories: LiveStoryItem[];
  currentUserId: string;
  currentUsername: string;
  currentAvatar: string;
  onAddStory: () => void;
  onStoryViewed: (storyId: string) => void;
  onDeleteStory: (storyId: string) => void;
  onReplyWithSnap: (recipient: DirectSnapRecipient) => void;
  onOpenDirectSnaps?: () => void;
  unreadDirectSnapsCount?: number;
  isExpanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  externalDragOffsetPx?: number | null;
}

interface StoryGroup {
  key: string;
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  items: LiveStoryItem[];
  hasUnviewed: boolean;
  isOwn: boolean;
}

function formatTimeAgo(iso: string): string {
  const diffMs = Math.max(0, Date.now() - new Date(iso).getTime());
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ago`;
}

function formatHoursLeft(expiresAt: string): string {
  const leftMs = Math.max(0, new Date(expiresAt).getTime() - Date.now());
  const hrs = Math.ceil(leftMs / (60 * 60 * 1000));
  if (hrs <= 1) {
    const mins = Math.max(1, Math.ceil(leftMs / 60000));
    return `${mins}m left`;
  }
  return `${hrs}h left`;
}

const LiveStoriesBarComponent: React.FC<LiveStoriesBarProps> = ({
  stories,
  currentUserId,
  currentUsername,
  currentAvatar,
  onAddStory,
  onStoryViewed,
  onDeleteStory,
  onReplyWithSnap,
  onOpenDirectSnaps,
  unreadDirectSnapsCount = 0,
  isExpanded: controlledExpanded,
  onExpandedChange,
  externalDragOffsetPx = null,
}) => {
  const [internalExpanded, setInternalExpanded] = useState(false);
  const isExpanded = controlledExpanded !== undefined ? controlledExpanded : internalExpanded;
  const setExpanded = useCallback(
    (next: boolean) => {
      if (onExpandedChange) {
        onExpandedChange(next);
      } else {
        setInternalExpanded(next);
      }
    },
    [onExpandedChange]
  );

  // Local drag state when user grabs the top pill or expanded drawer directly
  const [localDragPx, setLocalDragPx] = useState<number | null>(null);
  const drawerRef = useRef<HTMLDivElement | null>(null);
  const drawerDragRef = useRef<{
    active: boolean;
    mode: 'open' | 'close';
    startY: number;
    startX: number;
    currentDeltaY: number;
    moved: boolean;
  } | null>(null);

  const [viewerGroupIdx, setViewerGroupIdx] = useState<number | null>(null);
  const [viewerItemIdx, setViewerItemIdx] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [imageProgress, setImageProgress] = useState(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const ownCleanUsername = normalizeCreatorUsername(currentUsername);

  const groups = useMemo<StoryGroup[]>(() => {
    const now = Date.now();
    const active = stories.filter((s) => isStoryActive(s, now));
    const map = new Map<string, StoryGroup>();

    for (const s of active) {
      const clean = normalizeCreatorUsername(s.username) || s.userId || s.id;
      const isOwn =
        s.userId === currentUserId ||
        (Boolean(ownCleanUsername) && normalizeCreatorUsername(s.username) === ownCleanUsername);
      const hasViewed = (s.viewedByIds || []).includes(currentUserId);

      const existing = map.get(clean);
      if (existing) {
        existing.items.push(s);
        if (!hasViewed) existing.hasUnviewed = true;
      } else {
        map.set(clean, {
          key: clean,
          userId: s.userId,
          username: s.username,
          displayName: s.displayName || s.username,
          avatarUrl: s.avatarUrl,
          items: [s],
          hasUnviewed: !hasViewed,
          isOwn,
        });
      }
    }

    const arr = Array.from(map.values()).map((g) => ({
      ...g,
      // Play oldest-to-newest inside a story stack
      items: [...g.items].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      ),
    }));

    return arr.sort((a, b) => {
      if (a.isOwn !== b.isOwn) return a.isOwn ? -1 : 1;
      if (a.hasUnviewed !== b.hasUnviewed) return a.hasUnviewed ? -1 : 1;
      const aLatest = a.items[a.items.length - 1]?.createdAt || '';
      const bLatest = b.items[b.items.length - 1]?.createdAt || '';
      return new Date(bLatest).getTime() - new Date(aLatest).getTime();
    });
  }, [stories, currentUserId, ownCleanUsername]);

  const activeGroup = viewerGroupIdx !== null ? groups[viewerGroupIdx] || null : null;
  const activeStory = activeGroup ? activeGroup.items[viewerItemIdx] || null : null;

  // Mark story viewed when opened
  useEffect(() => {
    if (!activeStory) return;
    if (!(activeStory.viewedByIds || []).includes(currentUserId)) {
      onStoryViewed(activeStory.id);
    }
  }, [activeStory, currentUserId, onStoryViewed]);

  const handleNext = useCallback(() => {
    if (viewerGroupIdx === null || !activeGroup) return;
    if (viewerItemIdx + 1 < activeGroup.items.length) {
      setViewerItemIdx(viewerItemIdx + 1);
      setImageProgress(0);
    } else if (viewerGroupIdx + 1 < groups.length) {
      setViewerGroupIdx(viewerGroupIdx + 1);
      setViewerItemIdx(0);
      setImageProgress(0);
    } else {
      setViewerGroupIdx(null);
      setViewerItemIdx(0);
    }
  }, [viewerGroupIdx, activeGroup, viewerItemIdx, groups.length]);

  const handlePrev = () => {
    if (viewerGroupIdx === null || !activeGroup) return;
    if (viewerItemIdx > 0) {
      setViewerItemIdx(viewerItemIdx - 1);
      setImageProgress(0);
    } else if (viewerGroupIdx > 0) {
      const prevGroup = groups[viewerGroupIdx - 1];
      setViewerGroupIdx(viewerGroupIdx - 1);
      setViewerItemIdx(Math.max(0, prevGroup.items.length - 1));
      setImageProgress(0);
    }
  };

  // Auto-advance timer for photo stories (5s)
  useEffect(() => {
    if (!activeStory || activeStory.mediaType !== 'image' || isPaused) return;
    setImageProgress(0);
    const start = Date.now();
    const duration = 5000;
    const interval = window.setInterval(() => {
      const elapsed = Date.now() - start;
      const pct = Math.min(100, (elapsed / duration) * 100);
      setImageProgress(pct);
      if (elapsed >= duration) {
        window.clearInterval(interval);
        handleNext();
      }
    }, 60);
    return () => window.clearInterval(interval);
  }, [activeStory?.id, activeStory?.mediaType, isPaused, handleNext]);

  // Sync video pause/play
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid || !activeStory || activeStory.mediaType !== 'video') return;
    if (isPaused) {
      vid.pause();
    } else {
      void vid.play().catch(() => {});
    }
  }, [isPaused, activeStory]);

  const openGroup = (idx: number) => {
    setViewerGroupIdx(idx);
    setViewerItemIdx(0);
    setImageProgress(0);
    setIsPaused(false);
  };

  // Drag-down handler on the collapsed pull-down handle pill (touch + mouse)
  const beginPillDrag = (clientY: number, clientX: number) => {
    drawerDragRef.current = {
      active: true,
      mode: 'open',
      startY: clientY,
      startX: clientX,
      currentDeltaY: 0,
      moved: false,
    };
  };

  // Swipe/drag-up handler on the expanded stories drawer (touch + mouse)
  const beginDrawerDrag = (clientY: number, clientX: number) => {
    if (!isExpanded) return;
    drawerDragRef.current = {
      active: true,
      mode: 'close',
      startY: clientY,
      startX: clientX,
      currentDeltaY: 0,
      moved: false,
    };
  };

  const moveDrawerDrag = useCallback((clientY: number, clientX: number) => {
    const drag = drawerDragRef.current;
    if (!drag || !drag.active) return;
    const dy = clientY - drag.startY;
    const dx = clientX - drag.startX;

    // Ignore horizontal swipes while scrolling through story rings inside the bar
    if (!drag.moved && Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) {
      drawerDragRef.current = null;
      setLocalDragPx(null);
      return;
    }

    if (Math.abs(dy) > 4) {
      drag.moved = true;
    }

    if (drag.mode === 'open') {
      const clamped = Math.max(0, Math.min(110, dy));
      drag.currentDeltaY = clamped;
      if (clamped > 4) setLocalDragPx(clamped);
    } else {
      const clamped = Math.min(0, Math.max(-110, dy));
      drag.currentDeltaY = clamped;
      if (clamped < -4) setLocalDragPx(clamped);
    }
  }, []);

  const endDrawerDrag = useCallback(() => {
    const drag = drawerDragRef.current;
    if (!drag) return;
    drawerDragRef.current = null;
    setLocalDragPx(null);

    if (!drag.moved) {
      // Tap on the collapsed pill opens the drawer
      if (drag.mode === 'open') {
        setExpanded(true);
      }
      return;
    }

    if (drag.mode === 'open') {
      setExpanded(drag.currentDeltaY >= 26);
    } else {
      if (drag.currentDeltaY <= -24) {
        setExpanded(false);
      }
    }
  }, [setExpanded]);

  // Global mouse move/up listeners only while actively mouse-dragging pill/drawer
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!drawerDragRef.current?.active) return;
      moveDrawerDrag(e.clientY, e.clientX);
    };
    const handleMouseUp = () => {
      if (!drawerDragRef.current?.active) return;
      endDrawerDrag();
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [moveDrawerDrag, endDrawerDrag]);

  const activeDragPx = localDragPx !== null ? localDragPx : externalDragOffsetPx;
  const isActivelyDragging = activeDragPx !== null && activeDragPx !== 0;

  // Compute GPU-accelerated translate3d for spring open/close + live rubber-band drag tracking
  const drawerTransform = useMemo(() => {
    if (activeDragPx !== null && activeDragPx !== 0) {
      if (isExpanded) {
        // Dragging upward from expanded (0 -> -100%)
        const y = Math.min(0, activeDragPx);
        return `translate3d(0, ${y}px, 0)`;
      }
      // Dragging downward from collapsed (-100% + activeDragPx)
      const drawerHeight = drawerRef.current?.offsetHeight || 104;
      const offset = Math.min(0, activeDragPx - drawerHeight);
      return `translate3d(0, ${offset}px, 0)`;
    }
    return isExpanded ? 'translate3d(0, 0, 0)' : 'translate3d(0, -108%, 0)';
  }, [activeDragPx, isExpanded]);

  const showPullHandle = !isExpanded && (activeDragPx === null || activeDragPx < 16);
  const hasUnviewedStories = groups.some((g) => g.hasUnviewed);
  const totalStoriesOrSnaps = groups.length + unreadDirectSnapsCount;

  return (
    <>
      {/* Subtle top pull-down handle / pill indicator when Live Stories Bar is collapsed */}
      <div
        className={`absolute top-1.5 left-1/2 -translate-x-1/2 z-30 transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          showPullHandle
            ? 'opacity-100 translate-y-0 pointer-events-auto'
            : 'opacity-0 -translate-y-2 pointer-events-none'
        }`}
      >
        <button
          type="button"
          onTouchStart={(e) => {
            e.stopPropagation();
            if (e.touches.length === 1) {
              beginPillDrag(e.touches[0].clientY, e.touches[0].clientX);
            }
          }}
          onTouchMove={(e) => {
            e.stopPropagation();
            if (e.touches.length === 1) {
              moveDrawerDrag(e.touches[0].clientY, e.touches[0].clientX);
            }
          }}
          onTouchEnd={(e) => {
            e.stopPropagation();
            endDrawerDrag();
          }}
          onTouchCancel={(e) => {
            e.stopPropagation();
            endDrawerDrag();
          }}
          onMouseDown={(e) => {
            e.stopPropagation();
            if (e.button !== 0) return;
            e.preventDefault();
            beginPillDrag(e.clientY, e.clientX);
          }}
          onWheel={(e) => {
            e.stopPropagation();
            if (e.deltaY < -10) {
              setExpanded(true);
            }
          }}
          className="group touch-none select-none flex flex-col items-center gap-0.5 px-3 py-1 rounded-full bg-neutral-950/90 hover:bg-neutral-900 border border-white/15 shadow-lg shadow-black/40 cursor-grab active:cursor-grabbing active:scale-95 transition-transform"
          title="Swipe down or tap to open Live Snaps & 24h Stories"
          aria-label="Open Live Snaps bar"
        >
          <span className="w-6 h-0.5 rounded-full bg-white/35 group-hover:bg-pink-400/80 transition-colors" />
          <span className="flex items-center gap-1.5 text-[10px] font-bold tracking-wide text-neutral-200">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                unreadDirectSnapsCount > 0 || hasUnviewedStories
                  ? 'bg-pink-500 animate-pulse shadow-[0_0_6px_rgba(236,72,153,0.9)]'
                  : 'bg-amber-400/80'
              }`}
            />
            <span>Live Snaps</span>
            {totalStoriesOrSnaps > 0 && (
              <span className="px-1 py-0 rounded-full bg-pink-600/85 text-white text-[9px] font-black leading-tight tabular-nums">
                {totalStoriesOrSnaps}
              </span>
            )}
            <ChevronDown className="w-3 h-3 text-neutral-400 group-hover:text-white group-hover:translate-y-0.5 transition-all" />
          </span>
        </button>
      </div>

      {/* Collapsible Spring-Animated 24-Hour Live Stories Overlay Drawer */}
      <div
        ref={drawerRef}
        onTouchStart={(e) => {
          e.stopPropagation();
          if (e.touches.length === 1) {
            beginDrawerDrag(e.touches[0].clientY, e.touches[0].clientX);
          }
        }}
        onTouchMove={(e) => {
          e.stopPropagation();
          if (e.touches.length === 1) {
            moveDrawerDrag(e.touches[0].clientY, e.touches[0].clientX);
          }
        }}
        onTouchEnd={(e) => {
          e.stopPropagation();
          endDrawerDrag();
        }}
        onTouchCancel={(e) => {
          e.stopPropagation();
          endDrawerDrag();
        }}
        onMouseDown={(e) => {
          e.stopPropagation();
          // Allow dragging from non-button whitespace or grabber bar
          if (e.button !== 0 || (e.target as HTMLElement).closest('button')) return;
          beginDrawerDrag(e.clientY, e.clientX);
        }}
        onWheel={(e) => {
          e.stopPropagation();
          if (isExpanded && e.deltaY > 15) {
            setExpanded(false);
          }
        }}
        style={{
          transform: drawerTransform,
          transition: isActivelyDragging
            ? 'none'
            : 'transform 340ms cubic-bezier(0.22, 1.15, 0.36, 1)',
        }}
        aria-hidden={!isExpanded && !isActivelyDragging}
        className={`absolute top-0 inset-x-0 z-30 bg-neutral-950/95 border-b border-neutral-800/90 shadow-2xl shadow-black/70 ${
          isExpanded || isActivelyDragging ? 'pointer-events-auto' : 'pointer-events-none'
        }`}
      >
        <div className="w-full px-3 pt-2 pb-1.5 flex items-center gap-3 overflow-x-auto no-scrollbar">
          {/* Add Live Story Tile */}
          <button
            type="button"
            onClick={onAddStory}
            className="shrink-0 flex flex-col items-center gap-1 group cursor-pointer focus:outline-hidden"
            title="Shoot a 24-Hour Live Story Snap"
          >
            <div className="relative w-12 h-12 rounded-full p-[2px] bg-gradient-to-tr from-pink-600 via-rose-500 to-amber-400 shadow-md shadow-pink-500/20 group-active:scale-95 transition-transform">
              <img
                src={optimizeThumbnailUrl(currentAvatar, 'grid')}
                alt="Add Story"
                loading="lazy"
                decoding="async"
                className="w-full h-full rounded-full object-cover bg-neutral-900 border-2 border-neutral-950"
                referrerPolicy="no-referrer"
              />
              <span className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-gradient-to-tr from-pink-500 to-cyan-400 text-white border-2 border-neutral-950 flex items-center justify-center shadow-sm">
                <Plus className="w-3 h-3 stroke-[3]" />
              </span>
            </div>
            <span className="text-[10px] font-bold text-neutral-200 max-w-[58px] truncate">
              Live Snap
            </span>
          </button>

          {/* Direct Snaps Quick Pill when inbox has unread snaps */}
          {onOpenDirectSnaps && unreadDirectSnapsCount > 0 && (
            <button
              type="button"
              onClick={onOpenDirectSnaps}
              className="shrink-0 flex flex-col items-center gap-1 cursor-pointer group"
              title="Open Direct Chat & Live Snaps"
            >
              <div className="w-12 h-12 rounded-full p-[2px] bg-gradient-to-tr from-cyan-400 via-pink-500 to-amber-400 animate-pulse">
                <div className="w-full h-full rounded-full bg-neutral-900 border-2 border-neutral-950 flex items-center justify-center text-pink-400 relative">
                  <MessageCircle className="w-5 h-5" />
                  <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-pink-600 text-white text-[9px] font-black flex items-center justify-center">
                    {unreadDirectSnapsCount}
                  </span>
                </div>
              </div>
              <span className="text-[10px] font-black text-pink-400 max-w-[58px] truncate">
                New Snap
              </span>
            </button>
          )}

          {/* Active 24-Hour Story Rings */}
          {groups.length === 0 ? (
            <div className="flex items-center gap-2 pl-1 text-[11px] text-neutral-400">
              <Sparkles className="w-3.5 h-3.5 text-pink-400 shrink-0" />
              <span className="whitespace-nowrap">
                Tap <strong className="text-white">Live Snap</strong> to post a 24h story!
              </span>
            </div>
          ) : (
            groups.map((group, idx) => (
              <button
                key={group.key}
                type="button"
                onClick={() => openGroup(idx)}
                className="shrink-0 flex flex-col items-center gap-1 group cursor-pointer focus:outline-hidden"
                title={`Watch ${group.displayName}'s 24h Live Story (${formatHoursLeft(
                  group.items[group.items.length - 1].expiresAt
                )})`}
              >
                <div
                  className={`relative w-12 h-12 rounded-full p-[2.5px] transition-transform group-active:scale-95 ${
                    group.hasUnviewed
                      ? 'bg-gradient-to-tr from-amber-400 via-pink-500 to-fuchsia-600 shadow-lg shadow-pink-500/30'
                      : 'bg-neutral-700'
                  }`}
                >
                  <img
                    src={optimizeThumbnailUrl(group.avatarUrl, 'grid')}
                    alt={group.displayName}
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full rounded-full object-cover bg-neutral-900 border-2 border-neutral-950"
                    referrerPolicy="no-referrer"
                  />
                  {group.hasUnviewed && (
                    <span className="absolute -top-0.5 -right-0.5 px-1 rounded-full bg-pink-600 text-[8px] font-black text-white border border-neutral-950">
                      24h
                    </span>
                  )}
                </div>
                <span
                  className={`text-[10px] max-w-[60px] truncate ${
                    group.hasUnviewed ? 'font-bold text-white' : 'font-medium text-neutral-400'
                  }`}
                >
                  {group.isOwn ? 'Your Story' : group.displayName}
                </span>
              </button>
            ))
          )}
        </div>

        {/* Bottom Swipe-Up Grabber Bar & Quick Collapse Button */}
        <div
          onTouchStart={(e) => {
            if (e.touches.length === 1) {
              beginDrawerDrag(e.touches[0].clientY, e.touches[0].clientX);
            }
          }}
          onMouseDown={(e) => {
            if (e.button !== 0) return;
            e.preventDefault();
            beginDrawerDrag(e.clientY, e.clientX);
          }}
          onClick={() => setExpanded(false)}
          className="w-full py-1 flex items-center justify-center gap-1.5 cursor-pointer hover:bg-white/5 transition-colors touch-none select-none"
          title="Swipe up or click to hide Live Snaps"
        >
          <span className="w-9 h-1 rounded-full bg-white/25" />
          <ChevronUp className="w-3 h-3 text-neutral-400" />
        </div>
      </div>

      {/* Fullscreen 24-Hour Live Story Viewer */}
      {activeGroup && activeStory && (
        <div className="fixed inset-0 z-55 bg-black flex items-center justify-center select-none animate-in fade-in duration-150">
          <div className="relative w-full h-full sm:max-w-md sm:max-h-[820px] sm:rounded-3xl overflow-hidden bg-neutral-950 border-0 sm:border sm:border-neutral-800 flex flex-col">
            {/* Progress segments */}
            <div className="absolute top-2.5 left-3 right-3 z-30 flex items-center gap-1">
              {activeGroup.items.map((item, idx) => {
                const isDone = idx < viewerItemIdx;
                const isCurrent = idx === viewerItemIdx;
                const fillWidth = isDone
                  ? '100%'
                  : isCurrent
                  ? activeStory.mediaType === 'image'
                    ? `${imageProgress}%`
                    : '100%'
                  : '0%';
                return (
                  <div
                    key={item.id}
                    className="flex-1 h-1 rounded-full bg-white/25 overflow-hidden"
                  >
                    <div
                      className={`h-full bg-white transition-all ${
                        isCurrent && activeStory.mediaType === 'video' ? 'animate-pulse' : ''
                      }`}
                      style={{ width: fillWidth }}
                    />
                  </div>
                );
              })}
            </div>

            {/* Top Creator Info + Controls */}
            <div className="absolute top-6 left-3 right-3 z-30 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <img
                  src={activeGroup.avatarUrl}
                  alt={activeGroup.displayName}
                  loading="lazy"
                  decoding="async"
                  className="w-9 h-9 rounded-full object-cover border border-pink-400 shrink-0"
                  referrerPolicy="no-referrer"
                />
                <div className="min-w-0 drop-shadow-md">
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs font-black text-white truncate">
                      {activeGroup.displayName}
                    </p>
                    <span className="text-[10px] text-neutral-300">
                      {formatTimeAgo(activeStory.createdAt)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] text-amber-300 font-bold">
                    <Clock className="w-2.5 h-2.5" />
                    <span>{formatHoursLeft(activeStory.expiresAt)}</span>
                    {activeStory.filterName && activeStory.filterName !== 'Natural' && (
                      <span className="text-cyan-300">· {activeStory.filterName}</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsPaused((p) => !p)}
                  className="w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center border border-white/15 cursor-pointer"
                  title={isPaused ? 'Play' : 'Pause'}
                >
                  {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                </button>
                {activeStory.mediaType === 'video' && (
                  <button
                    type="button"
                    onClick={() => setIsMuted((m) => !m)}
                    className="w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center border border-white/15 cursor-pointer"
                    title={isMuted ? 'Unmute' : 'Mute'}
                  >
                    {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                  </button>
                )}
                {activeGroup.isOwn && (
                  <button
                    type="button"
                    onClick={() => {
                      const delId = activeStory.id;
                      onDeleteStory(delId);
                      if (activeGroup.items.length <= 1) {
                        setViewerGroupIdx(null);
                      } else {
                        handleNext();
                      }
                    }}
                    className="w-8 h-8 rounded-full bg-red-600/80 text-white flex items-center justify-center border border-red-400/50 cursor-pointer"
                    title="Delete Story"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setViewerGroupIdx(null)}
                  className="w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center border border-white/15 cursor-pointer"
                  title="Close Story"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Story Media */}
            <div className="flex-1 w-full h-full bg-black flex items-center justify-center relative">
              {activeStory.mediaType === 'image' ? (
                <img
                  src={activeStory.mediaUrl}
                  alt={activeStory.caption || 'Live Story'}
                  loading="lazy"
                  decoding="async"
                  className="w-full h-full object-cover"
                />
              ) : (
                <video
                  ref={videoRef}
                  key={activeStory.id}
                  src={activeStory.mediaUrl}
                  autoPlay
                  playsInline
                  muted={isMuted}
                  onEnded={handleNext}
                  className="w-full h-full object-cover"
                />
              )}

              {/* Left / Right Tap Zones */}
              <button
                type="button"
                onClick={handlePrev}
                className="absolute inset-y-16 left-0 w-1/3 z-20 flex items-center justify-start pl-2 opacity-0 hover:opacity-100 transition-opacity cursor-pointer"
                aria-label="Previous story"
              >
                <span className="w-8 h-8 rounded-full bg-black/55 text-white flex items-center justify-center">
                  <ChevronLeft className="w-5 h-5" />
                </span>
              </button>
              <button
                type="button"
                onClick={handleNext}
                className="absolute inset-y-16 right-0 w-1/3 z-20 flex items-center justify-end pr-2 opacity-0 hover:opacity-100 transition-opacity cursor-pointer"
                aria-label="Next story"
              >
                <span className="w-8 h-8 rounded-full bg-black/55 text-white flex items-center justify-center">
                  <ChevronRight className="w-5 h-5" />
                </span>
              </button>
            </div>

            {/* Bottom Caption + Reply with Live Snap CTA */}
            <div className="absolute bottom-0 inset-x-0 z-30 p-4 bg-gradient-to-t from-black/95 via-black/75 to-transparent space-y-2.5">
              {activeStory.caption && (
                <p className="text-xs sm:text-sm font-semibold text-white text-center drop-shadow-sm">
                  {activeStory.caption}
                </p>
              )}

              <div className="flex items-center justify-center gap-2">
                {!activeGroup.isOwn ? (
                  <button
                    type="button"
                    onClick={() => {
                      const recipient: DirectSnapRecipient = {
                        id: activeGroup.userId || activeGroup.username,
                        name: activeGroup.displayName,
                        username: activeGroup.username,
                        avatar: activeGroup.avatarUrl,
                      };
                      setViewerGroupIdx(null);
                      onReplyWithSnap(recipient);
                    }}
                    className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-400 via-pink-500 to-fuchsia-600 text-white font-black text-xs flex items-center justify-center gap-2 shadow-lg cursor-pointer active:scale-98"
                  >
                    <Camera className="w-4 h-4" />
                    <span>Reply to @{activeGroup.username} with Live Snap</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setViewerGroupIdx(null);
                      onAddStory();
                    }}
                    className="w-full py-2.5 px-4 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-pink-500/40 text-pink-300 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Camera className="w-4 h-4" />
                    <span>Add Another Live Story Snap</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export const LiveStoriesBar = React.memo(LiveStoriesBarComponent);
