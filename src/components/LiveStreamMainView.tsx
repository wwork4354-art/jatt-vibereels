import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Radio,
  Users,
  Heart,
  Send,
  Gift,
  Volume2,
  VolumeX,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  Flame,
  Wand2,
  ArrowLeft,
  Camera,
  CameraOff,
  Mic,
  MicOff,
  RefreshCw,
  UserPlus,
  UserCheck,
  UserMinus,
  Power,
  Sparkles,
  Hand,
  X,
  Clock,
  Eye,
  Gem,
  ShieldCheck,
  Wifi,
  Play,
  Languages,
  Captions,
  ArrowLeftRight,
} from 'lucide-react';
import { UserAccount, FeedTab } from '../types';
import { useRamSaverMode, getIsRamSaverMode } from '../lib/ramSaverMode';
import { soundEngine } from '../utils/soundEngine';
import { sanitizeInputLive, sanitizeSafeUrl, sanitizeText, sanitizeUsername } from '../utils/security';
import {
  acquireLiveCameraStream,
  CoHostDecisionEvent,
  CoHostRequestEvent,
  createEventId,
  createLivePeerId,
  getFilterPreset,
  LIVE_FILTERS,
  LiveBroadcastState,
  LiveChatEvent,
  LiveFilterId,
  LiveGiftEvent,
  LivePresenceMember,
  LiveReactionEvent,
  LiveReactionType,
  LiveRoomRealtimeClient,
  LiveSpeechCaptionEvent,
  LiveTransportMode,
  LiveWebRtcMesh,
  stopMediaStream,
} from '../utils/liveRealtimeClient';
import {
  createSpeechRecognitionInstance,
  getTranslatorLanguage,
  isSpeechRecognitionSupported,
  speakTranslatedVoice,
  SpeechRecognitionLike,
  stopTranslatedVoice,
  translateLiveText,
  TRANSLATOR_LANGUAGES,
  TranslatorLangCode,
} from '../utils/liveTranslator';

interface LiveStreamMainViewProps {
  currentUser: UserAccount | null;
  onSelectTab: (tab: FeedTab) => void;
  onShowToast: (msg: string) => void;
  isMuted: boolean;
  onToggleMute: () => void;
}

interface FeaturedWatchChannel {
  id: string;
  hostName: string;
  hostHandle: string;
  hostAvatar: string;
  title: string;
  category: string;
  videoUrl: string;
  gradientBg: string;
}

interface FloatingReactionItem {
  id: string;
  emoji: string;
  x: number;
  size: number;
  color: string;
}

interface ActiveGiftBanner {
  id: string;
  sender: string;
  giftName: string;
  giftIcon: string;
  diamonds: number;
}

interface LiveSummaryStats {
  title: string;
  durationSeconds: number;
  peakViewers: number;
  totalLikes: number;
  totalGifts: number;
  totalDiamonds: number;
}

interface LiveSubtitleEntry {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: 'host' | 'cohost' | 'viewer';
  sourceLang: TranslatorLangCode;
  targetLang: TranslatorLangCode;
  originalText: string;
  translatedText: string;
  isFinal: boolean;
  timestamp: number;
}

const FEATURED_WATCH_ROOMS: FeaturedWatchChannel[] = [
  {
    id: 'room-jatt-main',
    hostName: 'Jatt VibeReels Stage',
    hostHandle: 'jatt_vibereels',
    hostAvatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=DJVibe&backgroundColor=ec4899',
    title: 'Global Creator Stage · Tap "Go Live" to broadcast or join chat live!',
    category: 'Creator Stage',
    videoUrl: 'https://upload.wikimedia.org/wikipedia/commons/a/a8/Berlin-KarnevalderKulturen2023-1-Asio.webm',
    gradientBg: 'from-pink-950 via-purple-950 to-neutral-950',
  },
  {
    id: 'room-cosmic-lounge',
    hostName: 'Cosmic Beats Lounge',
    hostHandle: 'cosmic_stage',
    hostAvatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=StellaCosmic&backgroundColor=6366f1',
    title: 'Chill Late-Night Vibes & Live Q&A Room',
    category: 'Music & Chill',
    videoUrl:
      'https://upload.wikimedia.org/wikipedia/commons/4/47/Astrophysics_Holiday_Vertical_Video_%28SVS14800_-_Fermi_YuleLog_Rotate_Reel%29.webm',
    gradientBg: 'from-blue-950 via-indigo-950 to-neutral-950',
  },
  {
    id: 'room-nature-zen',
    hostName: 'Nature Sanctuary Cam',
    hostHandle: 'wild_sanctuary',
    hostAvatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=WildBird&backgroundColor=10b981',
    title: 'Ambient Live Feed · Real-time Interactive Chat & Reactions',
    category: 'Ambient Live',
    videoUrl: 'https://upload.wikimedia.org/wikipedia/commons/c/c5/Blue_and_yellow_macaw_eating_a_peanut.webm',
    gradientBg: 'from-emerald-950 via-teal-950 to-neutral-950',
  },
];

const GIFTS_CATALOG = [
  { id: 'g-rose', name: 'Rose', icon: '🌹', diamonds: 1 },
  { id: 'g-heart', name: 'Neon Heart', icon: '💖', diamonds: 10 },
  { id: 'g-rocket', name: 'Cosmic Rocket', icon: '🚀', diamonds: 100 },
  { id: 'g-galaxy', name: 'Galaxy Portal', icon: '🌌', diamonds: 500 },
  { id: 'g-crown', name: 'Royal Crown', icon: '👑', diamonds: 1000 },
  { id: 'g-lion', name: 'Golden Lion', icon: '🦁', diamonds: 5000 },
];

function formatDuration(totalSeconds: number): string {
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export const LiveStreamMainView: React.FC<LiveStreamMainViewProps> = ({
  currentUser,
  onSelectTab,
  onShowToast,
  isMuted,
  onToggleMute,
}) => {
  const { isRamSaverMode } = useRamSaverMode();

  // Stable Peer ID for this session
  const peerIdRef = useRef<string>(createLivePeerId());
  const selfPeerId = peerIdRef.current;

  // Room Switcher Selection (can be either an active live creator `live_*` or a Featured Watch Room)
  const [selectedRoomId, setSelectedRoomId] = useState<string>(FEATURED_WATCH_ROOMS[0].id);

  // Real-time connection & room state
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'reconnecting'>('connecting');
  const [transportMode, setTransportMode] = useState<LiveTransportMode>('broadcast');
  const [presenceMembers, setPresenceMembers] = useState<LivePresenceMember[]>([]);

  // Registry of all active live broadcasts discovered via `supabase.channel('live-rooms')` Presence & broadcast state
  const [liveBroadcasts, setLiveBroadcasts] = useState<Record<string, LiveBroadcastState>>({});
  const [needsWatchTap, setNeedsWatchTap] = useState(false);

  // Local Creator "Go Live" Setup & Broadcast State
  const [isSetupModalOpen, setIsSetupModalOpen] = useState(false);
  const [isRequestingCamera, setIsRequestingCamera] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [streamTitleInput, setStreamTitleInput] = useState('');
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [micEnabled, setMicEnabled] = useState(true);
  const [selectedFilter, setSelectedFilter] = useState<LiveFilterId>('beauty');
  const [resolutionLabel, setResolutionLabel] = useState('720p · 30fps');
  const [showFilterStrip, setShowFilterStrip] = useState(false);

  // Whether THIS user is currently live as Host or Co-Host
  const [isHostingLive, setIsHostingLive] = useState(false);
  const [isCoHostingLive, setIsCoHostingLive] = useState(false);
  const [broadcastStartedAt, setBroadcastStartedAt] = useState<number>(0);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);

  // Live Summary Modal (shown after clicking End Live)
  const [liveSummary, setLiveSummary] = useState<LiveSummaryStats | null>(null);

  // Co-Host Requests & Active Co-Host Tracking
  const [coHostRequests, setCoHostRequests] = useState<CoHostRequestEvent[]>([]);
  const [hasPendingCoHostRequest, setHasPendingCoHostRequest] = useState(false);

  // Real-time Chat, Likes, Gifts, Reactions
  const [chatMessages, setChatMessages] = useState<LiveChatEvent[]>([
    {
      id: 'sys-welcome',
      roomId: FEATURED_WATCH_ROOMS[0].id,
      senderId: 'system',
      user: 'Jatt VibeReels Live',
      username: 'system',
      avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=JattLiveSys',
      text: 'Welcome to real-time LIVE chat! Tap "Go Live" or switch stages with < >.',
      timestamp: Date.now(),
      isSystem: true,
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isGiftTrayOpen, setIsGiftTrayOpen] = useState(false);
  const [floatingReactions, setFloatingReactions] = useState<FloatingReactionItem[]>([]);
  const [activeGiftBanner, setActiveGiftBanner] = useState<ActiveGiftBanner | null>(null);

  // Telemetry stats tracked accurately from real events
  const [totalLikes, setTotalLikes] = useState(0);
  const [totalGifts, setTotalGifts] = useState(0);
  const [totalDiamonds, setTotalDiamonds] = useState(0);
  const [peakViewers, setPeakViewers] = useState(1);
  const [isFollowingHost, setIsFollowingHost] = useState(false);

  // Media Streams & Video Refs
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});

  // Live AI 13-Language Voice & Subtitle Translator State
  const [isTranslatorPanelOpen, setIsTranslatorPanelOpen] = useState(false);
  const [isTranslatorEnabled, setIsTranslatorEnabled] = useState(true);
  const [spokenLang, setSpokenLang] = useState<TranslatorLangCode>('pa-IN');
  const [listenLang, setListenLang] = useState<TranslatorLangCode>('en-US');
  const [voiceDubbingEnabled, setVoiceDubbingEnabled] = useState(true);
  const [hearSelfPreview, setHearSelfPreview] = useState(false);
  const [isSpeechCapturing, setIsSpeechCapturing] = useState(false);
  const [speechStatusMsg, setSpeechStatusMsg] = useState<string>('');
  const [manualTranslateInput, setManualTranslateInput] = useState('');
  const [activeSubtitles, setActiveSubtitles] = useState<LiveSubtitleEntry[]>([]);

  const localStreamRef = useRef<MediaStream | null>(null);
  const setupPreviewVideoRef = useRef<HTMLVideoElement | null>(null);
  const hostVideoRef = useRef<HTMLVideoElement | null>(null);
  const coHostVideoRef = useRef<HTMLVideoElement | null>(null);
  const stageFallbackVideoRef = useRef<HTMLVideoElement | null>(null);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  const clientRef = useRef<LiveRoomRealtimeClient | null>(null);
  const rtcMeshRef = useRef<LiveWebRtcMesh | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const interimCaptionIdRef = useRef<string>(createEventId('cap'));
  const isSpeakingTtsRef = useRef(false);

  // Refs synced for callbacks without stale closures
  const isHostingRef = useRef(false);
  const isCoHostingRef = useRef(false);
  const selectedRoomIdRef = useRef<string>(selectedRoomId);
  const liveBroadcastsRef = useRef<Record<string, LiveBroadcastState>>(liveBroadcasts);
  const activeBroadcastRef = useRef<LiveBroadcastState | null>(null);
  const coHostRequestsRef = useRef<CoHostRequestEvent[]>([]);
  const isTranslatorEnabledRef = useRef(isTranslatorEnabled);
  const spokenLangRef = useRef(spokenLang);
  const listenLangRef = useRef(listenLang);
  const voiceDubbingEnabledRef = useRef(voiceDubbingEnabled);
  const hearSelfPreviewRef = useRef(hearSelfPreview);
  const isSpeechCapturingRef = useRef(isSpeechCapturing);
  const isMutedRef = useRef(isMuted);

  isHostingRef.current = isHostingLive;
  isCoHostingRef.current = isCoHostingLive;
  selectedRoomIdRef.current = selectedRoomId;
  liveBroadcastsRef.current = liveBroadcasts;
  activeBroadcastRef.current = liveBroadcasts[selectedRoomId] || null;
  coHostRequestsRef.current = coHostRequests;
  isTranslatorEnabledRef.current = isTranslatorEnabled;
  spokenLangRef.current = spokenLang;
  listenLangRef.current = listenLang;
  voiceDubbingEnabledRef.current = voiceDubbingEnabled;
  hearSelfPreviewRef.current = hearSelfPreview;
  isSpeechCapturingRef.current = isSpeechCapturing;
  isMutedRef.current = isMuted;

  const selfName = useMemo(
    () => sanitizeText(currentUser?.name || 'Jatt Creator', 60) || 'Jatt Creator',
    [currentUser?.name]
  );
  const selfUsername = useMemo(
    () => sanitizeUsername(currentUser?.username || 'jatt_creator', 40) || 'jatt_creator',
    [currentUser?.username]
  );
  const selfAvatar = useMemo(
    () =>
      sanitizeSafeUrl(currentUser?.avatar || '') ||
      `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(selfUsername)}&backgroundColor=ec4899`,
    [currentUser?.avatar, selfUsername]
  );

  // Effective active broadcast & selected fallback watch room
  const effectiveBroadcast = liveBroadcasts[selectedRoomId] || null;
  const selectedWatchRoom = useMemo(
    () => FEATURED_WATCH_ROOMS.find((r) => r.id === selectedRoomId) || FEATURED_WATCH_ROOMS[0],
    [selectedRoomId]
  );

  // Unified room switcher entries: Active live creator broadcasts first, then Featured Stages
  const roomSwitcherEntries = useMemo(() => {
    const activeEntries = (Object.values(liveBroadcasts) as LiveBroadcastState[])
      .filter((b) => b.isLive)
      .sort((a, b) => {
        if (a.hostPeerId === selfPeerId) return -1;
        if (b.hostPeerId === selfPeerId) return 1;
        return (b.startedAt || 0) - (a.startedAt || 0);
      })
      .map((b) => ({
        id: b.roomId,
        label: b.hostName,
        isLive: true,
      }));

    const featuredEntries = FEATURED_WATCH_ROOMS.map((r) => ({
      id: r.id,
      label: r.hostName,
      isLive: false,
    }));

    return [...activeEntries, ...featuredEntries];
  }, [liveBroadcasts, selfPeerId]);

  const currentRoomId = effectiveBroadcast?.isLive ? effectiveBroadcast.roomId : selectedWatchRoom.id;
  const currentRoomIdRef = useRef<string>(currentRoomId);
  currentRoomIdRef.current = currentRoomId;

  // Compute real connected viewer count from Presence
  const activeViewerCount = useMemo(() => {
    const unique = new Map<string, LivePresenceMember>();
    presenceMembers.forEach((m) => unique.set(m.peerId, m));
    return Math.max(1, unique.size);
  }, [presenceMembers]);

  // Update peak viewers whenever real presence count increases
  useEffect(() => {
    if (activeViewerCount > peakViewers) {
      setPeakViewers(activeViewerCount);
    }
  }, [activeViewerCount, peakViewers]);

  // Spawn visual floating reaction particle (capped tightly in 3GB RAM Saver mode)
  const spawnFloatingReaction = useCallback((type: LiveReactionType) => {
    const config: Record<LiveReactionType, { emoji: string; color: string }> = {
      heart: { emoji: '❤️', color: '#f43f5e' },
      fire: { emoji: '🔥', color: '#f97316' },
      wave: { emoji: '👋', color: '#38bdf8' },
    };
    const chosen = config[type];
    const item: FloatingReactionItem = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      emoji: chosen.emoji,
      color: chosen.color,
      x: Math.random() * 88 - 44,
      size: Math.floor(Math.random() * 10) + 22,
    };

    const maxReactions = getIsRamSaverMode() ? 14 : 28;
    setFloatingReactions((prev) => [...prev.slice(-maxReactions), item]);
    window.setTimeout(() => {
      setFloatingReactions((prev) => prev.filter((r) => r.id !== item.id));
    }, 2300);
  }, []);

  const upsertSubtitleEntry = useCallback((entry: LiveSubtitleEntry) => {
    setActiveSubtitles((prev) => {
      const idx = prev.findIndex((s) => s.id === entry.id);
      if (idx !== -1) {
        const next = [...prev];
        next[idx] = entry;
        return next;
      }
      return [...prev.slice(-2), entry];
    });
  }, []);

  // Build snapshot of our active broadcast state when hosting
  const buildCurrentBroadcastState = useCallback(
    (overrides?: Partial<LiveBroadcastState>): LiveBroadcastState => ({
      roomId: activeBroadcastRef.current?.roomId || `live_${selfPeerId}`,
      hostPeerId: selfPeerId,
      hostName: selfName,
      hostHandle: selfUsername,
      hostAvatar: selfAvatar,
      title:
        sanitizeText(streamTitleInput, 120) ||
        `${selfName} is LIVE on Jatt VibeReels!`,
      isLive: true,
      filter: selectedFilter,
      resolutionLabel,
      cameraEnabled,
      micEnabled,
      facingMode,
      coHost: activeBroadcastRef.current?.coHost || null,
      startedAt: broadcastStartedAt || Date.now(),
      totalLikes,
      totalDiamonds,
      ...overrides,
    }),
    [
      broadcastStartedAt,
      cameraEnabled,
      facingMode,
      micEnabled,
      resolutionLabel,
      selectedFilter,
      selfAvatar,
      selfName,
      selfPeerId,
      selfUsername,
      streamTitleInput,
      totalDiamonds,
      totalLikes,
    ]
  );

  // Initialize LiveRoomRealtimeClient (`supabase.channel('live-rooms')`) & WebRTC Mesh
  useEffect(() => {
    const signalReadyToBroadcast = (clientInstance: LiveRoomRealtimeClient, state: LiveBroadcastState) => {
      if (!state.isLive || state.hostPeerId === selfPeerId) return;
      clientInstance.sendRtcSignal({
        id: createEventId('ready'),
        roomId: state.roomId,
        fromPeerId: selfPeerId,
        toPeerId: state.hostPeerId,
        kind: 'ready',
        role: isCoHostingRef.current ? 'cohost' : 'viewer',
      });
      if (state.coHost && state.coHost.peerId !== selfPeerId) {
        clientInstance.sendRtcSignal({
          id: createEventId('ready'),
          roomId: state.roomId,
          fromPeerId: selfPeerId,
          toPeerId: state.coHost.peerId,
          kind: 'ready',
          role: 'viewer',
        });
      }
    };

    const client = new LiveRoomRealtimeClient({
      peerId: selfPeerId,
      roomId: FEATURED_WATCH_ROOMS[0].id,
      profile: {
        name: selfName,
        username: selfUsername,
        avatar: selfAvatar,
      },
      handlers: {
        onStatusChange: (status, mode) => {
          setConnectionStatus(status);
          setTransportMode(mode);
        },
        onPresenceChange: (members) => {
          setPresenceMembers(members);

          // Discover active remote live broadcasts synced via Presence
          const liveFromPresence = new Map<string, LiveBroadcastState>();
          const presentHostIds = new Set<string>();
          members.forEach((m) => {
            if (m.peerId !== selfPeerId) {
              presentHostIds.add(m.peerId);
            }
            if (m.peerId !== selfPeerId && m.activeBroadcast?.isLive) {
              liveFromPresence.set(m.activeBroadcast.roomId, m.activeBroadcast);
            }
          });

          setLiveBroadcasts((prev) => {
            const next: Record<string, LiveBroadcastState> = { ...prev };
            // Retain self broadcast if hosting
            Object.entries(prev).forEach(([rId, b]) => {
              if (b.hostPeerId !== selfPeerId) {
                // Prune remote hosts who disconnected from Presence or turned off activeBroadcast
                const stillLiveInPresence = liveFromPresence.has(rId);
                const hostStillInMembersButNotLive = presentHostIds.has(b.hostPeerId) && !stillLiveInPresence;
                const hostLeftPresence = members.length > 0 && !presentHostIds.has(b.hostPeerId);
                if (hostStillInMembersButNotLive || hostLeftPresence) {
                  delete next[rId];
                }
              }
            });
            liveFromPresence.forEach((b, rId) => {
              next[rId] = b;
            });
            return next;
          });

          // If viewer is on a featured watch room and a remote live broadcast is present, tune in automatically
          if (!isHostingRef.current && !isCoHostingRef.current && liveFromPresence.size > 0) {
            const firstRemote = Array.from(liveFromPresence.values())[0];
            if (!liveBroadcastsRef.current[selectedRoomIdRef.current]) {
              setSelectedRoomId(firstRemote.roomId);
              signalReadyToBroadcast(client, firstRemote);
            } else if (liveFromPresence.has(selectedRoomIdRef.current)) {
              const watched = liveFromPresence.get(selectedRoomIdRef.current)!;
              signalReadyToBroadcast(client, watched);
            }
          }
        },
        onChatMessage: (msg) => {
          setChatMessages((prev) => {
            if (prev.some((m) => m.id === msg.id)) return prev;
            return [...prev.slice(-50), msg];
          });
        },
        onReaction: (reaction) => {
          setTotalLikes((c) => c + 1);
          spawnFloatingReaction(reaction.type);
        },
        onGift: (gift) => {
          setTotalGifts((c) => c + 1);
          setTotalDiamonds((d) => d + gift.diamonds);
          setActiveGiftBanner({
            id: gift.id,
            sender: gift.senderName,
            giftName: gift.giftName,
            giftIcon: gift.giftIcon,
            diamonds: gift.diamonds,
          });
          const burstCount = getIsRamSaverMode() ? 3 : 6;
          for (let i = 0; i < burstCount; i++) {
            window.setTimeout(() => spawnFloatingReaction('heart'), i * 95);
          }
          window.setTimeout(() => {
            setActiveGiftBanner((curr) => (curr?.id === gift.id ? null : curr));
          }, 3400);
        },
        onBroadcastState: (state) => {
          if (state.hostPeerId === selfPeerId) return;

          setLiveBroadcasts((prev) => {
            if (!state.isLive) {
              const next = { ...prev };
              delete next[state.roomId];
              return next;
            }
            return { ...prev, [state.roomId]: state };
          });

          // Auto-select incoming live broadcast if not already hosting or watching another live room
          if (state.isLive && !isHostingRef.current && !isCoHostingRef.current) {
            if (!liveBroadcastsRef.current[selectedRoomIdRef.current]) {
              setSelectedRoomId(state.roomId);
            }
            if (selectedRoomIdRef.current === state.roomId || !liveBroadcastsRef.current[selectedRoomIdRef.current]) {
              setTotalLikes((prev) => Math.max(prev, state.totalLikes || 0));
              setTotalDiamonds((prev) => Math.max(prev, state.totalDiamonds || 0));
              signalReadyToBroadcast(client, state);
            }
          }
        },
        onBroadcastEnded: (roomId, hostPeerId) => {
          setRemoteStreams((prev) => {
            if (!prev[hostPeerId]) return prev;
            const next = { ...prev };
            delete next[hostPeerId];
            return next;
          });
          rtcMeshRef.current?.closePeer(hostPeerId);

          setLiveBroadcasts((prev) => {
            const next = { ...prev };
            if (roomId && next[roomId]) {
              delete next[roomId];
            } else {
              Object.entries(next).forEach(([k, v]) => {
                if (v.hostPeerId === hostPeerId) delete next[k];
              });
            }
            return next;
          });

          if (selectedRoomIdRef.current === roomId) {
            setSelectedRoomId(FEATURED_WATCH_ROOMS[0].id);
            setIsCoHostingLive((wasCoHost) => {
              if (wasCoHost) {
                stopMediaStream(localStreamRef.current);
                localStreamRef.current = null;
                setLocalStream(null);
              }
              return false;
            });
            onShowToast('The host ended this Live broadcast.');
          }
        },
        onCoHostRequest: (req) => {
          if (!isHostingRef.current) return;
          setCoHostRequests((prev) => {
            if (prev.some((r) => r.peerId === req.peerId)) return prev;
            return [...prev, req];
          });
          soundEngine.playCommentSound();
          onShowToast(`${req.name} requested to join as Co-Host!`);
        },
        onCoHostDecision: async (decision) => {
          if (decision.targetPeerId !== selfPeerId) return;
          setHasPendingCoHostRequest(false);

          if (!decision.accepted) {
            onShowToast('Host declined your Co-Host request.');
            return;
          }

          // Accepted! Acquire viewer's own camera & mic (capped at 720p 30fps) and join split-screen via WebRTC
          onShowToast('Co-Host request accepted! Starting your camera...');
          try {
            const acquired = await acquireLiveCameraStream({
              facingMode: 'user',
              audioEnabled: true,
            });
            stopMediaStream(localStreamRef.current);
            localStreamRef.current = acquired.stream;
            setLocalStream(acquired.stream);
            setFacingMode('user');
            setCameraEnabled(true);
            setMicEnabled(acquired.hasAudio);
            setResolutionLabel(acquired.resolutionLabel);
            setIsCoHostingLive(true);
            client.setRole('cohost');
            rtcMeshRef.current?.setLocalStream(acquired.stream);

            // Initiate WebRTC offer to host
            await rtcMeshRef.current?.initiateCall(decision.hostPeerId);
          } catch (err) {
            const msg = err instanceof Error ? err.message : 'Camera permission needed to co-host.';
            onShowToast(msg);
          }
        },
        onCoHostLeave: (roomId, coHostPeerId) => {
          setRemoteStreams((prev) => {
            if (!prev[coHostPeerId]) return prev;
            const next = { ...prev };
            delete next[coHostPeerId];
            return next;
          });
          rtcMeshRef.current?.closePeer(coHostPeerId);

          if (coHostPeerId === selfPeerId) {
            stopMediaStream(localStreamRef.current);
            localStreamRef.current = null;
            setLocalStream(null);
            setIsCoHostingLive(false);
            client.setRole('viewer');
            onShowToast('You left the Co-Host split screen.');
          } else {
            setLiveBroadcasts((prev) => {
              const existing = prev[roomId];
              if (!existing) return prev;
              return {
                ...prev,
                [roomId]: { ...existing, coHost: null },
              };
            });
            onShowToast('Co-Host left the split screen.');
          }
        },
        onRtcSignal: (signal) => {
          rtcMeshRef.current?.handleSignal(signal);
        },
        onSpeechCaption: async (caption) => {
          if (!isTranslatorEnabledRef.current) return;
          if (caption.roomId !== currentRoomIdRef.current) return;
          if (caption.senderId === selfPeerId) return;

          const sourceLang = getTranslatorLanguage(caption.sourceLang).code;
          const targetLang = listenLangRef.current;

          let translated = caption.originalText;
          if (caption.senderTargetLang === targetLang && caption.senderTranslatedText) {
            translated = caption.senderTranslatedText;
          } else if (sourceLang !== targetLang) {
            translated = await translateLiveText(caption.originalText, sourceLang, targetLang);
          }

          upsertSubtitleEntry({
            id: caption.id,
            senderId: caption.senderId,
            senderName: caption.senderName,
            senderRole: caption.senderRole,
            sourceLang,
            targetLang,
            originalText: caption.originalText,
            translatedText: translated,
            isFinal: caption.isFinal,
            timestamp: Date.now(),
          });

          if (caption.isFinal && voiceDubbingEnabledRef.current && !isMutedRef.current) {
            speakTranslatedVoice(translated, targetLang, {
              onStart: () => {
                isSpeakingTtsRef.current = true;
              },
              onEnd: () => {
                isSpeakingTtsRef.current = false;
              },
            });
          }
        },
        onSyncRequested: (requesterPeerId) => {
          if (isHostingRef.current && activeBroadcastRef.current) {
            client.publishBroadcastState(activeBroadcastRef.current);
            if (localStreamRef.current) {
              rtcMeshRef.current?.initiateCall(requesterPeerId);
            }
          }
        },
      },
    });

    const rtcMesh = new LiveWebRtcMesh({
      selfPeerId,
      roomId: FEATURED_WATCH_ROOMS[0].id,
      maxBitrateBps: getIsRamSaverMode() ? 700_000 : 1_100_000,
      sendSignal: (sig) => client.sendRtcSignal(sig),
      onRemoteStream: (remotePeerId, stream) => {
        setRemoteStreams((prev) => ({
          ...prev,
          [remotePeerId]: stream,
        }));
      },
      onPeerClosed: (remotePeerId) => {
        setRemoteStreams((prev) => {
          if (!prev[remotePeerId]) return prev;
          const next = { ...prev };
          delete next[remotePeerId];
          return next;
        });
      },
    });

    clientRef.current = client;
    rtcMeshRef.current = rtcMesh;
    client.connect();

    return () => {
      if (hostVideoRef.current) hostVideoRef.current.srcObject = null;
      if (coHostVideoRef.current) coHostVideoRef.current.srcObject = null;
      stopMediaStream(localStreamRef.current);
      localStreamRef.current = null;
      stopTranslatedVoice();
      rtcMesh.closeAll();
      client.disconnect();
      clientRef.current = null;
      rtcMeshRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selfPeerId]);

  // Keep client room ID synced
  useEffect(() => {
    clientRef.current?.setRoomId(currentRoomId);
    rtcMeshRef.current?.setRoomId(currentRoomId);
  }, [currentRoomId]);

  // Live broadcast duration timer (real elapsed seconds from Date.now())
  useEffect(() => {
    if (!isHostingLive || !broadcastStartedAt) {
      setElapsedSeconds(0);
      return;
    }
    const tick = () => {
      setElapsedSeconds(Math.max(0, Math.floor((Date.now() - broadcastStartedAt) / 1000)));
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [broadcastStartedAt, isHostingLive]);

  // Attach MediaStreams to video elements cleanly with mobile autoplay fallback & RAM-safe cleanup
  useEffect(() => {
    if (setupPreviewVideoRef.current && localStream) {
      setupPreviewVideoRef.current.srcObject = localStream;
      setupPreviewVideoRef.current.play().catch(() => {});
    }
  }, [isSetupModalOpen, localStream]);

  const hostStreamToShow = useMemo(() => {
    if (isHostingLive) return localStream;
    if (effectiveBroadcast?.isLive) {
      return remoteStreams[effectiveBroadcast.hostPeerId] || null;
    }
    return null;
  }, [effectiveBroadcast, isHostingLive, localStream, remoteStreams]);

  const coHostInfo = effectiveBroadcast?.coHost || null;
  const coHostStreamToShow = useMemo(() => {
    if (!coHostInfo) return null;
    if (coHostInfo.peerId === selfPeerId && isCoHostingLive) {
      return localStream;
    }
    return remoteStreams[coHostInfo.peerId] || null;
  }, [coHostInfo, isCoHostingLive, localStream, remoteStreams, selfPeerId]);

  useEffect(() => {
    const el = hostVideoRef.current;
    if (!el) return;
    if (!hostStreamToShow) {
      el.srcObject = null;
      return;
    }
    if (el.srcObject !== hostStreamToShow) {
      el.srcObject = hostStreamToShow;
    }
    el.muted = isHostingLive ? true : isMuted;
    el.play().catch(() => {
      // Mobile browser blocked unmuted autoplay -> play muted cleanly and offer Watch Live tap
      el.muted = true;
      el.play().catch(() => {});
      if (!isHostingLive) {
        setNeedsWatchTap(true);
      }
    });
  }, [hostStreamToShow, isHostingLive, isMuted, coHostInfo]);

  useEffect(() => {
    const el = coHostVideoRef.current;
    if (!el) return;
    if (!coHostStreamToShow) {
      el.srcObject = null;
      return;
    }
    if (el.srcObject !== coHostStreamToShow) {
      el.srcObject = coHostStreamToShow;
    }
    const isSelfCoHost = isCoHostingLive && coHostInfo?.peerId === selfPeerId;
    el.muted = isSelfCoHost ? true : isMuted;
    el.play().catch(() => {
      el.muted = true;
      el.play().catch(() => {});
      if (!isSelfCoHost) {
        setNeedsWatchTap(true);
      }
    });
  }, [coHostStreamToShow, isCoHostingLive, coHostInfo, isMuted, selfPeerId]);

  useEffect(() => {
    if (stageFallbackVideoRef.current && !hostStreamToShow && !effectiveBroadcast?.isLive) {
      stageFallbackVideoRef.current.muted = isMuted;
      stageFallbackVideoRef.current.play().catch(() => {});
    }
  }, [selectedRoomId, effectiveBroadcast?.isLive, hostStreamToShow, isMuted]);

  // Switch cleanly between live creator rooms and featured stages
  const handleSelectRoomById = useCallback(
    (nextRoomId: string) => {
      setSelectedRoomId(nextRoomId);
      setNeedsWatchTap(false);
      const targetBroadcast = liveBroadcastsRef.current[nextRoomId];
      if (targetBroadcast?.isLive && targetBroadcast.hostPeerId !== selfPeerId) {
        setTotalLikes((prev) => Math.max(prev, targetBroadcast.totalLikes || 0));
        setTotalDiamonds((prev) => Math.max(prev, targetBroadcast.totalDiamonds || 0));
        clientRef.current?.sendRtcSignal({
          id: createEventId('ready'),
          roomId: targetBroadcast.roomId,
          fromPeerId: selfPeerId,
          toPeerId: targetBroadcast.hostPeerId,
          kind: 'ready',
          role: 'viewer',
        });
      }
    },
    [selfPeerId]
  );

  const handleCycleRoom = useCallback(
    (direction: -1 | 1) => {
      if (roomSwitcherEntries.length <= 1 || isHostingLive) return;
      const idx = roomSwitcherEntries.findIndex((r) => r.id === selectedRoomId);
      const safeIdx = idx === -1 ? 0 : idx;
      const nextIdx = (safeIdx + direction + roomSwitcherEntries.length) % roomSwitcherEntries.length;
      handleSelectRoomById(roomSwitcherEntries[nextIdx].id);
    },
    [handleSelectRoomById, isHostingLive, roomSwitcherEntries, selectedRoomId]
  );

  // Explicit "Watch Live" action: initiates/refreshes WebRTC link & unlocks audio playback on user gesture
  const handleWatchLive = useCallback(() => {
    if (!effectiveBroadcast?.isLive || isHostingLive) return;
    setNeedsWatchTap(false);

    if (isMuted) {
      onToggleMute();
    }

    clientRef.current?.requestSync();
    clientRef.current?.sendRtcSignal({
      id: createEventId('ready'),
      roomId: effectiveBroadcast.roomId,
      fromPeerId: selfPeerId,
      toPeerId: effectiveBroadcast.hostPeerId,
      kind: 'ready',
      role: isCoHostingLive ? 'cohost' : 'viewer',
    });

    if (effectiveBroadcast.coHost && effectiveBroadcast.coHost.peerId !== selfPeerId) {
      clientRef.current?.sendRtcSignal({
        id: createEventId('ready'),
        roomId: effectiveBroadcast.roomId,
        fromPeerId: selfPeerId,
        toPeerId: effectiveBroadcast.coHost.peerId,
        kind: 'ready',
        role: 'viewer',
      });
    }

    if (hostVideoRef.current) {
      hostVideoRef.current.muted = false;
      hostVideoRef.current.play().catch(() => {});
    }
    if (coHostVideoRef.current && !(isCoHostingLive && coHostInfo?.peerId === selfPeerId)) {
      coHostVideoRef.current.muted = false;
      coHostVideoRef.current.play().catch(() => {});
    }

    onShowToast(
      hostStreamToShow
        ? `Watching ${effectiveBroadcast.hostName} LIVE!`
        : `Connecting to ${effectiveBroadcast.hostName}'s live camera...`
    );
  }, [
    coHostInfo?.peerId,
    effectiveBroadcast,
    hostStreamToShow,
    isCoHostingLive,
    isHostingLive,
    isMuted,
    onShowToast,
    onToggleMute,
    selfPeerId,
  ]);

  // Auto-scroll chat panel
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages]);

  // =========================================================================
  // Go Live / Camera / Mic / Filter Actions
  // =========================================================================

  const requestDevicePreview = useCallback(async (targetFacing: 'user' | 'environment') => {
    setIsRequestingCamera(true);
    setCameraError(null);
    try {
      const acquired = await acquireLiveCameraStream({
        facingMode: targetFacing,
        audioEnabled: true,
      });
      stopMediaStream(localStreamRef.current);
      localStreamRef.current = acquired.stream;
      setLocalStream(acquired.stream);
      setResolutionLabel(acquired.resolutionLabel);
      setCameraEnabled(acquired.hasVideo);
      setMicEnabled(acquired.hasAudio);
      rtcMeshRef.current?.setLocalStream(acquired.stream);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to open camera & microphone.';
      setCameraError(msg);
      onShowToast(msg);
    } finally {
      setIsRequestingCamera(false);
    }
  }, [onShowToast]);

  const handleOpenGoLiveSetup = () => {
    setLiveSummary(null);
    setStreamTitleInput((prev) => prev || `${selfName}'s Live Vibes`);
    setIsSetupModalOpen(true);
    requestDevicePreview(facingMode);
  };

  const handleCancelSetup = () => {
    setIsSetupModalOpen(false);
    if (!isHostingLive && !isCoHostingLive) {
      stopMediaStream(localStreamRef.current);
      localStreamRef.current = null;
      setLocalStream(null);
    }
  };

  const handleStartBroadcast = () => {
    if (!localStreamRef.current) {
      onShowToast('Please allow camera access before going live.');
      return;
    }

    const now = Date.now();
    const cleanTitle =
      sanitizeText(streamTitleInput, 120) || `${selfName} is LIVE on Jatt VibeReels!`;
    const roomId = `live_${selfPeerId}`;

    const initialState: LiveBroadcastState = {
      roomId,
      hostPeerId: selfPeerId,
      hostName: selfName,
      hostHandle: selfUsername,
      hostAvatar: selfAvatar,
      title: cleanTitle,
      isLive: true,
      filter: selectedFilter,
      resolutionLabel,
      cameraEnabled,
      micEnabled,
      facingMode,
      coHost: null,
      startedAt: now,
      totalLikes: 0,
      totalDiamonds: 0,
    };

    setTotalLikes(0);
    setTotalGifts(0);
    setTotalDiamonds(0);
    setPeakViewers(activeViewerCount);
    setCoHostRequests([]);
    setBroadcastStartedAt(now);
    setIsHostingLive(true);
    setIsSetupModalOpen(false);
    setSelectedRoomId(roomId);
    setLiveBroadcasts((prev) => ({ ...prev, [roomId]: initialState }));
    activeBroadcastRef.current = initialState;

    clientRef.current?.setRoomId(roomId);
    clientRef.current?.setRole('host');
    rtcMeshRef.current?.setRoomId(roomId);
    rtcMeshRef.current?.setLocalStream(localStreamRef.current);
    clientRef.current?.publishBroadcastState(initialState);

    // Connect WebRTC to all other connected peers on `live-rooms` immediately
    presenceMembers.forEach((m) => {
      if (m.peerId !== selfPeerId) {
        rtcMeshRef.current?.initiateCall(m.peerId);
      }
    });

    const sysMsg: LiveChatEvent = {
      id: createEventId('sys'),
      roomId,
      senderId: 'system',
      user: 'Live Studio',
      username: 'system',
      avatar: selfAvatar,
      text: `${selfName} started a live broadcast: "${cleanTitle}"`,
      timestamp: now,
      isSystem: true,
    };
    setChatMessages((prev) => [...prev.slice(-50), sysMsg]);
    clientRef.current?.sendChatMessage(sysMsg);

    soundEngine.playLiveStartSound();
    onShowToast('You are LIVE now (720p · 30fps)!');
  };

  const handleSwapCamera = async () => {
    const nextFacing: 'user' | 'environment' = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(nextFacing);

    try {
      const acquired = await acquireLiveCameraStream({
        facingMode: nextFacing,
        audioEnabled: true,
      });

      // Preserve current mute state
      acquired.stream.getAudioTracks().forEach((t) => {
        t.enabled = micEnabled;
      });
      acquired.stream.getVideoTracks().forEach((t) => {
        t.enabled = cameraEnabled;
      });

      stopMediaStream(localStreamRef.current);
      localStreamRef.current = acquired.stream;
      setLocalStream(acquired.stream);
      setResolutionLabel(acquired.resolutionLabel);
      rtcMeshRef.current?.setLocalStream(acquired.stream);

      if (isHostingLive && activeBroadcastRef.current) {
        const updated = buildCurrentBroadcastState({
          facingMode: nextFacing,
          resolutionLabel: acquired.resolutionLabel,
        });
        setLiveBroadcasts((prev) => ({ ...prev, [updated.roomId]: updated }));
        clientRef.current?.publishBroadcastState(updated);
      }
      onShowToast(nextFacing === 'environment' ? 'Switched to Back Camera' : 'Switched to Front Camera');
    } catch {
      onShowToast('Unable to switch camera on this device.');
    }
  };

  const handleToggleMic = () => {
    const nextMic = !micEnabled;
    setMicEnabled(nextMic);
    localStreamRef.current?.getAudioTracks().forEach((t) => {
      t.enabled = nextMic;
    });

    if (isHostingLive && activeBroadcastRef.current) {
      const updated = buildCurrentBroadcastState({ micEnabled: nextMic });
      setLiveBroadcasts((prev) => ({ ...prev, [updated.roomId]: updated }));
      clientRef.current?.publishBroadcastState(updated);
    } else if (isCoHostingLive && activeBroadcastRef.current?.coHost) {
      const updated: LiveBroadcastState = {
        ...activeBroadcastRef.current,
        coHost: {
          ...activeBroadcastRef.current.coHost,
          micEnabled: nextMic,
        },
      };
      setLiveBroadcasts((prev) => ({ ...prev, [updated.roomId]: updated }));
      clientRef.current?.publishBroadcastState(updated);
    }
    onShowToast(nextMic ? 'Microphone On' : 'Microphone Muted');
  };

  const handleToggleCamera = () => {
    const nextCam = !cameraEnabled;
    setCameraEnabled(nextCam);
    localStreamRef.current?.getVideoTracks().forEach((t) => {
      t.enabled = nextCam;
    });

    if (isHostingLive && activeBroadcastRef.current) {
      const updated = buildCurrentBroadcastState({ cameraEnabled: nextCam });
      setLiveBroadcasts((prev) => ({ ...prev, [updated.roomId]: updated }));
      clientRef.current?.publishBroadcastState(updated);
    } else if (isCoHostingLive && activeBroadcastRef.current?.coHost) {
      const updated: LiveBroadcastState = {
        ...activeBroadcastRef.current,
        coHost: {
          ...activeBroadcastRef.current.coHost,
          cameraEnabled: nextCam,
        },
      };
      setLiveBroadcasts((prev) => ({ ...prev, [updated.roomId]: updated }));
      clientRef.current?.publishBroadcastState(updated);
    }
    onShowToast(nextCam ? 'Camera On' : 'Camera Paused');
  };

  const handleSelectFilter = (filterId: LiveFilterId) => {
    setSelectedFilter(filterId);
    if (isHostingLive && activeBroadcastRef.current) {
      const updated = buildCurrentBroadcastState({ filter: filterId });
      setLiveBroadcasts((prev) => ({ ...prev, [updated.roomId]: updated }));
      clientRef.current?.publishBroadcastState(updated);
    }
  };

  const handleEndLiveBroadcast = () => {
    const roomId = activeBroadcastRef.current?.roomId || currentRoomId;
    const duration = broadcastStartedAt
      ? Math.max(1, Math.floor((Date.now() - broadcastStartedAt) / 1000))
      : elapsedSeconds;

    setLiveSummary({
      title: activeBroadcastRef.current?.title || `${selfName}'s Live Stream`,
      durationSeconds: duration,
      peakViewers: Math.max(peakViewers, activeViewerCount),
      totalLikes,
      totalGifts,
      totalDiamonds,
    });

    clientRef.current?.endBroadcast(roomId);
    clientRef.current?.setRole('viewer');
    rtcMeshRef.current?.closeAll();

    if (hostVideoRef.current) hostVideoRef.current.srcObject = null;
    if (coHostVideoRef.current) coHostVideoRef.current.srcObject = null;
    stopMediaStream(localStreamRef.current);
    localStreamRef.current = null;
    setLocalStream(null);
    setRemoteStreams({});
    setIsHostingLive(false);
    setLiveBroadcasts((prev) => {
      const next = { ...prev };
      delete next[roomId];
      return next;
    });
    setSelectedRoomId(FEATURED_WATCH_ROOMS[0].id);
    activeBroadcastRef.current = null;
    setCoHostRequests([]);
    setBroadcastStartedAt(0);
    setShowFilterStrip(false);
    setIsSpeechCapturing(false);
    stopTranslatedVoice();
    onShowToast('Live broadcast ended.');
  };

  // =========================================================================
  // Viewer "Request to Join" & Host Accept/Decline Co-Host Flow
  // =========================================================================

  const handleRequestJoinCoHost = () => {
    if (!effectiveBroadcast?.isLive) {
      onShowToast('Start a Live broadcast first or wait for a live host to join.');
      return;
    }
    if (hasPendingCoHostRequest) {
      setHasPendingCoHostRequest(false);
      onShowToast('Co-Host request cancelled.');
      return;
    }

    const req: CoHostRequestEvent = {
      id: createEventId('coreq'),
      roomId: effectiveBroadcast.roomId,
      peerId: selfPeerId,
      name: selfName,
      handle: selfUsername,
      avatar: selfAvatar,
      requestedAt: Date.now(),
    };
    setHasPendingCoHostRequest(true);
    clientRef.current?.sendCoHostRequest(req);
    onShowToast('Co-Host request sent to host!');
  };

  const handleRespondCoHostRequest = (req: CoHostRequestEvent, accepted: boolean) => {
    setCoHostRequests((prev) => prev.filter((r) => r.peerId !== req.peerId));

    const decision: CoHostDecisionEvent = {
      id: createEventId('codec'),
      requestId: req.id,
      roomId: req.roomId,
      targetPeerId: req.peerId,
      hostPeerId: selfPeerId,
      accepted,
      timestamp: Date.now(),
    };
    clientRef.current?.sendCoHostDecision(decision);

    if (accepted && activeBroadcastRef.current) {
      const updated = buildCurrentBroadcastState({
        coHost: {
          peerId: req.peerId,
          name: req.name,
          handle: req.handle,
          avatar: req.avatar,
          micEnabled: true,
          cameraEnabled: true,
          facingMode: 'user',
        },
      });
      setLiveBroadcasts((prev) => ({ ...prev, [updated.roomId]: updated }));
      clientRef.current?.publishBroadcastState(updated);
      onShowToast(`${req.name} is joining Split-Screen!`);
    } else {
      onShowToast(`Declined ${req.name}'s request.`);
    }
  };

  const handleLeaveOrRemoveCoHost = () => {
    if (!effectiveBroadcast) return;
    const targetCoHostPeerId = isCoHostingLive
      ? selfPeerId
      : effectiveBroadcast.coHost?.peerId || '';
    if (!targetCoHostPeerId) return;

    clientRef.current?.sendCoHostLeave(effectiveBroadcast.roomId, targetCoHostPeerId);

    if (isCoHostingLive) {
      stopMediaStream(localStreamRef.current);
      localStreamRef.current = null;
      setLocalStream(null);
      setIsCoHostingLive(false);
      clientRef.current?.setRole('viewer');
      rtcMeshRef.current?.closeAll();
      onShowToast('Left Co-Host split screen.');
    } else if (isHostingLive && activeBroadcastRef.current) {
      const updated = buildCurrentBroadcastState({ coHost: null });
      setLiveBroadcasts((prev) => ({ ...prev, [updated.roomId]: updated }));
      clientRef.current?.publishBroadcastState(updated);
      rtcMeshRef.current?.closePeer(targetCoHostPeerId);
      onShowToast('Removed Co-Host from split screen.');
    }
  };

  // =========================================================================
  // Real-Time Chat, Reactions (Heart / Fire / Wave) & Gifts
  // =========================================================================

  const handleSendComment = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanText = sanitizeText(inputText, 280);
    if (!cleanText) return;

    const badge = isHostingLive
      ? 'Host'
      : isCoHostingLive
      ? 'Co-Host'
      : currentUser?.role === 'admin'
      ? 'Admin'
      : currentUser?.role === 'creator'
      ? 'Creator'
      : undefined;

    const msg: LiveChatEvent = {
      id: createEventId('chat'),
      roomId: currentRoomId,
      senderId: selfPeerId,
      user: selfName,
      username: selfUsername,
      avatar: selfAvatar,
      text: cleanText,
      timestamp: Date.now(),
      isHost: isHostingLive,
      isCoHost: isCoHostingLive,
      badge,
    };

    setChatMessages((prev) => [...prev.slice(-80), msg]);
    clientRef.current?.sendChatMessage(msg);
    setInputText('');
    soundEngine.playCommentSound();
  };

  const handleSendReaction = (type: LiveReactionType) => {
    soundEngine.playLikeSound();
    spawnFloatingReaction(type);
    setTotalLikes((c) => c + 1);

    const reactionEvt: LiveReactionEvent = {
      id: createEventId('react'),
      roomId: currentRoomId,
      senderId: selfPeerId,
      senderName: selfName,
      type,
      timestamp: Date.now(),
    };
    clientRef.current?.sendReaction(reactionEvt);
  };

  const handleSendGift = (gift: (typeof GIFTS_CATALOG)[0]) => {
    soundEngine.playGiftSound();

    const giftEvt: LiveGiftEvent = {
      id: createEventId('gift'),
      roomId: currentRoomId,
      senderId: selfPeerId,
      senderName: selfName,
      senderUsername: selfUsername,
      senderAvatar: selfAvatar,
      giftId: gift.id,
      giftName: gift.name,
      giftIcon: gift.icon,
      diamonds: gift.diamonds,
      timestamp: Date.now(),
    };

    setTotalGifts((c) => c + 1);
    setTotalDiamonds((d) => d + gift.diamonds);
    setActiveGiftBanner({
      id: giftEvt.id,
      sender: selfName,
      giftName: gift.name,
      giftIcon: gift.icon,
      diamonds: gift.diamonds,
    });

    const giftChatMsg: LiveChatEvent = {
      id: createEventId('gchat'),
      roomId: currentRoomId,
      senderId: selfPeerId,
      user: selfName,
      username: selfUsername,
      avatar: selfAvatar,
      text: `sent ${gift.name} ${gift.icon} (+${gift.diamonds} 💎)`,
      timestamp: Date.now(),
      isGift: true,
      giftIcon: gift.icon,
      giftName: gift.name,
      diamonds: gift.diamonds,
    };

    setChatMessages((prev) => [...prev.slice(-80), giftChatMsg]);
    clientRef.current?.sendGift(giftEvt);
    clientRef.current?.sendChatMessage(giftChatMsg);

    for (let i = 0; i < 6; i++) {
      window.setTimeout(() => spawnFloatingReaction('heart'), i * 95);
    }

    onShowToast(`Sent ${gift.name} ${gift.icon}!`);
    window.setTimeout(() => {
      setActiveGiftBanner((curr) => (curr?.id === giftEvt.id ? null : curr));
    }, 3400);
  };

  // =========================================================================
  // Live 13-Language Voice Recognition, Translation & Voice Dubbing
  // =========================================================================

  // Expire subtitle lines cleanly after ~9s
  useEffect(() => {
    if (activeSubtitles.length === 0) return;
    const timer = window.setInterval(() => {
      const now = Date.now();
      setActiveSubtitles((prev) => prev.filter((s) => now - s.timestamp < 9000));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [activeSubtitles.length]);

  const dispatchTranslatedSpeech = useCallback(
    async (
      rawPhrase: string,
      isFinal: boolean,
      options?: { speakLocalRegardless?: boolean }
    ) => {
      const clean = sanitizeText(rawPhrase, 280);
      if (!clean) return;

      const src = spokenLangRef.current;
      const tgt = listenLangRef.current;
      const role: 'host' | 'cohost' | 'viewer' = isHostingRef.current
        ? 'host'
        : isCoHostingRef.current
        ? 'cohost'
        : 'viewer';

      const captionId = isFinal
        ? interimCaptionIdRef.current
        : interimCaptionIdRef.current;

      const translated = isFinal || src === tgt
        ? await translateLiveText(clean, src, tgt)
        : clean;

      const payload: LiveSpeechCaptionEvent = {
        id: captionId,
        roomId: currentRoomIdRef.current,
        senderId: selfPeerId,
        senderName: selfName,
        senderRole: role,
        sourceLang: src,
        originalText: clean,
        senderTargetLang: tgt,
        senderTranslatedText: translated,
        isFinal,
        timestamp: Date.now(),
      };

      upsertSubtitleEntry({
        id: captionId,
        senderId: selfPeerId,
        senderName: selfName,
        senderRole: role,
        sourceLang: src,
        targetLang: tgt,
        originalText: clean,
        translatedText: translated,
        isFinal,
        timestamp: Date.now(),
      });

      clientRef.current?.sendSpeechCaption(payload);

      if (isFinal) {
        interimCaptionIdRef.current = createEventId('cap');
        const shouldSpeakSelf =
          voiceDubbingEnabledRef.current &&
          !isMutedRef.current &&
          (hearSelfPreviewRef.current || Boolean(options?.speakLocalRegardless));
        if (shouldSpeakSelf) {
          speakTranslatedVoice(translated, tgt, {
            onStart: () => {
              isSpeakingTtsRef.current = true;
            },
            onEnd: () => {
              isSpeakingTtsRef.current = false;
            },
          });
        }
      }
    },
    [selfName, selfPeerId, upsertSubtitleEntry]
  );

  // Manage live SpeechRecognition loop when user activates Voice Mic Translate
  useEffect(() => {
    if (!isSpeechCapturing) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.onend = null;
          recognitionRef.current.stop();
        } catch {
          // ignore stop race
        }
        recognitionRef.current = null;
      }
      setSpeechStatusMsg('');
      return;
    }

    if (!isSpeechRecognitionSupported()) {
      setIsSpeechCapturing(false);
      setSpeechStatusMsg('Voice mic recognition is unsupported here — use Quick Translate below.');
      onShowToast('Browser voice mic unavailable. Use the Quick Translate box!');
      return;
    }

    let cancelled = false;
    let restartTimer: number | null = null;
    let lastInterimSentAt = 0;

    const rec = createSpeechRecognitionInstance(spokenLang);
    if (!rec) {
      setIsSpeechCapturing(false);
      return;
    }
    recognitionRef.current = rec;
    const srcDef = getTranslatorLanguage(spokenLang);
    setSpeechStatusMsg(`Listening in ${srcDef.label} (${srcDef.code})...`);

    rec.onresult = (ev) => {
      if (cancelled || isSpeakingTtsRef.current) return;
      let finalChunk = '';
      let interimChunk = '';
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const res = ev.results[i];
        const piece = res?.[0]?.transcript || '';
        if (res.isFinal) {
          finalChunk += piece + ' ';
        } else {
          interimChunk += piece;
        }
      }

      if (finalChunk.trim()) {
        void dispatchTranslatedSpeech(finalChunk.trim(), true);
      } else if (interimChunk.trim()) {
        const now = Date.now();
        if (now - lastInterimSentAt >= 550) {
          lastInterimSentAt = now;
          void dispatchTranslatedSpeech(interimChunk.trim(), false);
        }
      }
    };

    rec.onerror = (ev) => {
      if (cancelled) return;
      if (
        ev.error === 'not-allowed' ||
        ev.error === 'service-not-allowed' ||
        ev.error === 'audio-capture'
      ) {
        cancelled = true;
        setIsSpeechCapturing(false);
        setSpeechStatusMsg('Microphone permission required for live voice translation.');
        onShowToast('Allow microphone permission to use Live Voice Translator.');
      }
    };

    rec.onend = () => {
      if (cancelled || !isSpeechCapturingRef.current) return;
      restartTimer = window.setTimeout(() => {
        if (cancelled || !isSpeechCapturingRef.current) return;
        try {
          rec.start();
        } catch {
          // ignore already-started errors
        }
      }, 260);
    };

    try {
      rec.start();
    } catch {
      setSpeechStatusMsg('Tap Voice Mic again to start listening.');
    }

    return () => {
      cancelled = true;
      if (restartTimer) window.clearTimeout(restartTimer);
      try {
        rec.onend = null;
        rec.onresult = null;
        rec.onerror = null;
        rec.abort();
      } catch {
        // ignore
      }
      if (recognitionRef.current === rec) {
        recognitionRef.current = null;
      }
    };
  }, [dispatchTranslatedSpeech, isSpeechCapturing, onShowToast, spokenLang]);

  const handleToggleSpeechCapture = () => {
    if (!isTranslatorEnabled) {
      setIsTranslatorEnabled(true);
    }
    if (!isSpeechCapturing && !isSpeechRecognitionSupported()) {
      setIsTranslatorPanelOpen(true);
      setSpeechStatusMsg('Voice mic unsupported in this browser — use Quick Translate below.');
      onShowToast('Use the Quick Translate input inside Live AI Translator.');
      return;
    }
    const next = !isSpeechCapturing;
    setIsSpeechCapturing(next);
    const srcDef = getTranslatorLanguage(spokenLang);
    const tgtDef = getTranslatorLanguage(listenLang);
    onShowToast(
      next
        ? `Live AI Translator ON: ${srcDef.label} → ${tgtDef.label}`
        : 'Live Voice Capture paused'
    );
  };

  const handleSwapTranslatorLangs = () => {
    const prevSpoken = spokenLang;
    const prevListen = listenLang;
    setSpokenLang(prevListen);
    setListenLang(prevSpoken);
    const nextSrc = getTranslatorLanguage(prevListen);
    const nextTgt = getTranslatorLanguage(prevSpoken);
    onShowToast(`Swapped: Speaking ${nextSrc.label} → Translating to ${nextTgt.label}`);
  };

  const handleSendManualVoiceTranslate = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = sanitizeText(manualTranslateInput, 280);
    if (!clean) return;
    setManualTranslateInput('');
    if (!isTranslatorEnabled) setIsTranslatorEnabled(true);
    void dispatchTranslatedSpeech(clean, true, { speakLocalRegardless: true });
  };

  // Determine displayed host metadata
  const displayedHostName = effectiveBroadcast?.isLive
    ? effectiveBroadcast.hostName
    : selectedWatchRoom.hostName;
  const displayedHostHandle = effectiveBroadcast?.isLive
    ? effectiveBroadcast.hostHandle
    : selectedWatchRoom.hostHandle;
  const displayedHostAvatar = effectiveBroadcast?.isLive
    ? effectiveBroadcast.hostAvatar
    : selectedWatchRoom.hostAvatar;
  const displayedTitle = effectiveBroadcast?.isLive
    ? effectiveBroadcast.title
    : selectedWatchRoom.title;

  const activeHostFilterPreset = getFilterPreset(
    isHostingLive ? selectedFilter : effectiveBroadcast?.filter
  );
  const isSplitScreenActive = Boolean(effectiveBroadcast?.isLive && coHostInfo);
  const spokenLangDef = getTranslatorLanguage(spokenLang);
  const listenLangDef = getTranslatorLanguage(listenLang);

  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-black overflow-hidden relative select-none">
      {/* ========================================================= */}
      {/* TOP LIVE TAB HEADER: Compact Back, Room, Go Live, AI Lang */}
      {/* ========================================================= */}
      <div className="w-full max-w-5xl px-2 sm:px-3 py-1 flex items-center justify-between gap-1.5 z-30 shrink-0">
        <button
          type="button"
          onClick={() => onSelectTab('foryou')}
          className="min-h-[32px] flex items-center gap-1 px-2 py-1 rounded-lg bg-neutral-900/90 hover:bg-neutral-800 text-neutral-200 hover:text-white border border-neutral-700/80 text-[11px] font-bold transition-all shadow-sm active:scale-95 shrink-0"
        >
          <ArrowLeft className="w-3 h-3 text-pink-400" />
          <span className="hidden sm:inline">Back to Reels</span>
          <span className="sm:hidden">Back</span>
        </button>

        {/* Room Indicator / Stage Switcher (`< Jatt VibeReels Stage >`) */}
        <div
          className={`flex items-center gap-1 bg-neutral-900/85 px-2 py-1 rounded-full border border-neutral-800 ${
            isRamSaverMode ? '' : 'backdrop-blur-md'
          } min-w-0`}
        >
          {!isHostingLive && roomSwitcherEntries.length > 1 && (
            <button
              type="button"
              onClick={() => handleCycleRoom(-1)}
              className="p-0.5 text-neutral-400 hover:text-white transition-colors"
              title="Previous Live Room / Stage"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
          )}
          <span className="text-[11px] font-bold text-white flex items-center gap-1 truncate">
            <Radio
              className={`w-3 h-3 shrink-0 ${
                effectiveBroadcast?.isLive ? 'text-rose-500 animate-pulse' : 'text-pink-400'
              }`}
            />
            <span className="truncate max-w-[96px] sm:max-w-[180px]">{displayedHostName}</span>
            {effectiveBroadcast?.isLive && (
              <span className="px-1 py-0.2 rounded bg-rose-600 text-white text-[8px] font-black uppercase tracking-wider shrink-0">
                LIVE
              </span>
            )}
          </span>
          {!isHostingLive && roomSwitcherEntries.length > 1 && (
            <button
              type="button"
              onClick={() => handleCycleRoom(1)}
              className="p-0.5 text-neutral-400 hover:text-white transition-colors"
              title="Next Live Room / Stage"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Right Header Actions: Go Live / End Live + Compact Translator + Sound */}
        <div className="flex items-center gap-1 shrink-0">
          {!isHostingLive ? (
            <button
              type="button"
              onClick={handleOpenGoLiveSetup}
              className="min-h-[32px] flex items-center gap-1 px-2.5 py-1 rounded-lg bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white text-[11px] font-black tracking-wide shadow-md shadow-rose-600/30 active:scale-95 transition-all"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
              <Camera className="w-3 h-3" />
              <span>Go Live</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleEndLiveBroadcast}
              className="min-h-[32px] flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-black shadow-md shadow-rose-600/30 active:scale-95 transition-all"
            >
              <Power className="w-3 h-3" />
              <span>End</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsTranslatorPanelOpen((open) => !open)}
            className={`min-h-[32px] flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold border transition-all active:scale-95 ${
              isSpeechCapturing
                ? 'bg-cyan-500/25 text-cyan-200 border-cyan-400/60 shadow-sm shadow-cyan-500/20'
                : isTranslatorPanelOpen
                ? 'bg-purple-600/30 text-purple-200 border-purple-400/50'
                : 'bg-neutral-900 text-neutral-200 border-neutral-800 hover:bg-neutral-800'
            }`}
            title="Live 13-Language Voice & Subtitle Translator"
          >
            <Languages className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span className="hidden md:inline">AI Translator</span>
            <span className="text-[9px] font-black text-cyan-300">
              {spokenLangDef.shortTag}↔{listenLangDef.shortTag}
            </span>
          </button>

          <button
            type="button"
            onClick={onToggleMute}
            className={`min-h-[32px] flex items-center justify-center px-2 py-1 rounded-lg text-[11px] font-bold border transition-all ${
              isMuted
                ? 'bg-neutral-900 text-neutral-400 border-neutral-800'
                : 'bg-pink-600/20 text-pink-400 border-pink-500/40'
            }`}
            title={isMuted ? 'Unmute audio' : 'Mute audio'}
          >
            {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* MAIN FULL-SCREEN LIVE STAGE CONTAINER */}
      {/* ========================================================= */}
      <div className="relative w-full h-[calc(100%-42px)] sm:max-w-5xl max-h-[860px] rounded-xl sm:rounded-3xl overflow-hidden bg-neutral-950 border border-neutral-800/80 shadow-2xl flex flex-col justify-between">
        {/* VIDEO / CAMERA VIEWPORT LAYER */}
        <div className="absolute inset-0 z-0 bg-neutral-950 flex flex-col overflow-hidden">
          {isSplitScreenActive && coHostInfo ? (
            /* DUAL CAMERA SPLIT-SCREEN VIEW (HOST + CO-HOST) */
            <div className="w-full h-full flex flex-col sm:flex-row divide-y-2 sm:divide-y-0 sm:divide-x-2 divide-neutral-900 relative">
              {/* HOST HALF */}
              <div className="relative flex-1 h-full overflow-hidden flex items-center justify-center bg-gradient-to-b from-purple-950/60 to-black">
                {hostStreamToShow && (isHostingLive ? cameraEnabled : effectiveBroadcast?.cameraEnabled !== false) ? (
                  <video
                    ref={hostVideoRef}
                    autoPlay
                    playsInline
                    muted={isHostingLive || isMuted}
                    className={`w-full h-full object-cover transition-all duration-300 ${activeHostFilterPreset.cssClass} ${
                      (isHostingLive ? facingMode : effectiveBroadcast?.facingMode) === 'user'
                        ? 'scale-x-[-1]'
                        : ''
                    }`}
                  />
                ) : (
                  <div className="flex flex-col items-center gap-2 p-4 text-center">
                    <img
                      src={displayedHostAvatar}
                      alt={displayedHostName}
                      loading="lazy"
                      decoding="async"
                      className="w-20 h-20 rounded-full object-cover border-2 border-pink-500 shadow-xl"
                      referrerPolicy="no-referrer"
                    />
                    <p className="text-xs font-bold text-white">{displayedHostName}</p>
                    <p className="text-[11px] text-neutral-400">
                      {effectiveBroadcast?.cameraEnabled === false ? 'Camera Paused' : 'Connecting video stream...'}
                    </p>
                  </div>
                )}

                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-black/50 pointer-events-none" />

                <div className="absolute top-16 left-3 z-20 flex items-center gap-1.5 bg-black/80 px-2.5 py-1 rounded-full border border-pink-500/40">
                  <span className="w-2 h-2 rounded-full bg-pink-500 animate-pulse" />
                  <span className="text-[11px] font-bold text-white">{displayedHostName}</span>
                  <span className="text-[9px] uppercase font-black text-pink-300 bg-pink-500/20 px-1.5 py-0.5 rounded-sm">
                    Host
                  </span>
                  {effectiveBroadcast?.micEnabled === false && (
                    <MicOff className="w-3 h-3 text-rose-400" />
                  )}
                </div>
              </div>

              {/* CO-HOST HALF */}
              <div className="relative flex-1 h-full overflow-hidden flex items-center justify-center bg-gradient-to-b from-cyan-950/60 to-black">
                {coHostStreamToShow && (isCoHostingLive ? cameraEnabled : coHostInfo.cameraEnabled !== false) ? (
                  <video
                    ref={coHostVideoRef}
                    autoPlay
                    playsInline
                    muted={(isCoHostingLive && coHostInfo.peerId === selfPeerId) || isMuted}
                    className={`w-full h-full object-cover transition-all duration-300 ${
                      (isCoHostingLive && coHostInfo.peerId === selfPeerId ? facingMode : coHostInfo.facingMode) ===
                      'user'
                        ? 'scale-x-[-1]'
                        : ''
                    }`}
                  />
                ) : (
                  <div className="flex flex-col items-center gap-2 p-4 text-center">
                    <img
                      src={coHostInfo.avatar}
                      alt={coHostInfo.name}
                      loading="lazy"
                      decoding="async"
                      className="w-20 h-20 rounded-full object-cover border-2 border-cyan-400 shadow-xl"
                      referrerPolicy="no-referrer"
                    />
                    <p className="text-xs font-bold text-white">{coHostInfo.name}</p>
                    <p className="text-[11px] text-cyan-300">Connecting Co-Host WebRTC feed...</p>
                  </div>
                )}

                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-black/50 pointer-events-none" />

                <div className="absolute top-16 right-3 z-20 flex items-center gap-1.5 bg-black/80 px-2.5 py-1 rounded-full border border-cyan-500/40">
                  <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                  <span className="text-[11px] font-bold text-white">{coHostInfo.name}</span>
                  <span className="text-[9px] uppercase font-black text-cyan-300 bg-cyan-500/20 px-1.5 py-0.5 rounded-sm">
                    Co-Host
                  </span>
                  {coHostInfo.micEnabled === false && <MicOff className="w-3 h-3 text-rose-400" />}
                </div>
              </div>
            </div>
          ) : effectiveBroadcast?.isLive ? (
            /* FULL-SCREEN REAL LIVE BROADCAST (HOST CAMERA OR VIEWER RECEIVING WEBRTC) */
            <div className="relative w-full h-full overflow-hidden flex items-center justify-center bg-black">
              {hostStreamToShow && (isHostingLive ? cameraEnabled : effectiveBroadcast.cameraEnabled !== false) ? (
                <video
                  ref={hostVideoRef}
                  autoPlay
                  playsInline
                  muted={isHostingLive || isMuted}
                  className={`w-full h-full object-cover transition-all duration-300 ${activeHostFilterPreset.cssClass} ${
                    (isHostingLive ? facingMode : effectiveBroadcast.facingMode) === 'user'
                      ? 'scale-x-[-1]'
                      : ''
                  }`}
                />
              ) : (
                <div className="relative z-10 flex flex-col items-center gap-3 p-6 text-center">
                  <img
                    src={displayedHostAvatar}
                    alt={displayedHostName}
                    loading="lazy"
                    decoding="async"
                    className="w-24 h-24 rounded-full object-cover border-4 border-pink-500 shadow-2xl"
                    referrerPolicy="no-referrer"
                  />
                  <div>
                    <p className="text-base font-bold text-white">{displayedHostName}</p>
                    <p className="text-xs text-neutral-400 mt-1">
                      {effectiveBroadcast.cameraEnabled === false
                        ? 'Host paused their camera (audio still live)'
                        : 'Live stream active · Connecting WebRTC video (720p 30fps)...'}
                    </p>
                  </div>
                  {!isHostingLive && effectiveBroadcast.cameraEnabled !== false && (
                    <button
                      type="button"
                      onClick={handleWatchLive}
                      className="mt-1 min-h-[42px] px-5 py-2 rounded-full bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white text-xs font-black tracking-wide shadow-lg shadow-rose-600/30 active:scale-95 transition-all flex items-center gap-2"
                    >
                      <Play className="w-4 h-4 fill-white" />
                      <span>Watch Live Stream</span>
                    </button>
                  )}
                </div>
              )}
              {!isHostingLive && hostStreamToShow && needsWatchTap && (
                <button
                  type="button"
                  onClick={handleWatchLive}
                  className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 min-h-[44px] px-5 py-2.5 rounded-full bg-rose-600/95 hover:bg-rose-500 text-white text-xs font-black shadow-2xl border border-white/25 flex items-center gap-2 active:scale-95 transition-all"
                >
                  <Volume2 className="w-4 h-4" />
                  <span>Watch Live with Audio</span>
                </button>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/55 pointer-events-none" />
            </div>
          ) : (
            /* FEATURED LIVE STAGE WHEN NO CREATOR IS CURRENTLY BROADCASTING */
            <div className="relative w-full h-full overflow-hidden flex items-center justify-center">
              <video
                ref={stageFallbackVideoRef}
                src={selectedWatchRoom.videoUrl}
                preload="metadata"
                loop
                autoPlay
                playsInline
                muted={isMuted}
                className="w-full h-full object-cover opacity-85"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-black/60 pointer-events-none" />
            </div>
          )}
        </div>

        {/* ========================================================= */}
        {/* TOP OVERLAY BAR: Compact Host Pill, LIVE & Viewers        */}
        {/* ========================================================= */}
        <div className="relative z-20 p-2 sm:p-3 bg-gradient-to-b from-black/75 via-black/30 to-transparent flex flex-col gap-1 pointer-events-auto">
          <div className="flex items-center justify-between gap-1.5 flex-wrap">
            {/* Compact Host Card */}
            <div className="flex items-center gap-1.5 bg-black/80 p-0.5 pr-2 rounded-full border border-white/15">
              <img
                src={displayedHostAvatar}
                alt={displayedHostName}
                loading="lazy"
                decoding="async"
                className="w-7 h-7 rounded-full object-cover border border-pink-500 shrink-0"
                referrerPolicy="no-referrer"
              />
              <div className="min-w-0">
                <div className="flex items-center gap-1">
                  <p className="text-[11px] font-bold text-white truncate max-w-[96px] sm:max-w-[160px] leading-tight">
                    {displayedHostName}
                  </p>
                  <CheckCircle className="w-2.5 h-2.5 text-pink-400 shrink-0" />
                </div>
                <div className="flex items-center gap-1 text-[9px] text-neutral-300 leading-tight">
                  <span className="text-amber-400 font-bold">💎 {totalDiamonds.toLocaleString()}</span>
                  <span className="hidden sm:inline">·</span>
                  <span className="hidden sm:inline text-neutral-400 truncate">@{displayedHostHandle}</span>
                </div>
              </div>

              {!isHostingLive && (
                <button
                  type="button"
                  onClick={() => {
                    setIsFollowingHost(!isFollowingHost);
                    onShowToast(
                      isFollowingHost ? 'Unfollowed host' : `Following ${displayedHostName}!`
                    );
                  }}
                  className={`ml-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold transition-all ${
                    isFollowingHost
                      ? 'bg-neutral-800 text-neutral-300 border border-neutral-700'
                      : 'bg-pink-600 hover:bg-pink-500 text-white shadow-sm shadow-pink-600/30'
                  }`}
                >
                  {isFollowingHost ? 'Following' : '+ Follow'}
                </button>
              )}
            </div>

            {/* Right Status Badges: Compact LIVE Timer + Viewer Count */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {effectiveBroadcast?.isLive && (
                <div className="hidden sm:flex items-center gap-1 px-2 py-1 rounded-full bg-black/80 border border-white/15 text-[10px] font-semibold text-emerald-300">
                  <Wifi className="w-2.5 h-2.5" />
                  <span>{effectiveBroadcast.resolutionLabel}</span>
                </div>
              )}

              <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-rose-950/85 border border-rose-500/45 text-white shadow-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
                <span className="text-[10px] font-black uppercase tracking-wider text-rose-300">
                  {effectiveBroadcast?.isLive ? 'LIVE' : 'STAGE'}
                </span>
                {isHostingLive && (
                  <>
                    <span className="text-neutral-500 text-[10px]">|</span>
                    <span className="text-[10px] font-bold tabular-nums text-white">
                      {formatDuration(elapsedSeconds)}
                    </span>
                  </>
                )}
                <span className="text-neutral-500 text-[10px]">|</span>
                <Users className="w-3 h-3 text-neutral-200" />
                <span className="text-[10px] font-bold tabular-nums" title="Live connected users">
                  {activeViewerCount}
                </span>
              </div>
            </div>
          </div>

          {/* Compact Stream Title + Sync Pill */}
          <div className="flex items-center justify-between gap-1.5 flex-wrap">
            <div className="inline-flex items-center gap-1.5 bg-black/75 border border-white/10 px-2 py-0.5 rounded-full text-[10px] text-neutral-100 max-w-full">
              <Sparkles className="w-2.5 h-2.5 text-pink-400 shrink-0" />
              <span className="truncate font-semibold max-w-[180px] sm:max-w-[300px]">{displayedTitle}</span>
            </div>

            <div className="hidden sm:inline-flex items-center gap-1 bg-black/75 border border-white/10 px-2 py-0.5 rounded-full text-[9px] font-semibold text-neutral-300">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  connectionStatus === 'connected' ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'
                }`}
              />
              <span>
                {transportMode === 'supabase' ? 'Supabase live-rooms' : 'live-rooms Sync'} ·{' '}
                {connectionStatus === 'connected' ? 'Connected' : 'Syncing'}
              </span>
            </div>
          </div>

          {/* ========================================================= */}
          {/* INCOMING CO-HOST REQUESTS BANNER (VISIBLE TO HOST) */}
          {/* ========================================================= */}
          {isHostingLive && coHostRequests.length > 0 && (
            <div className="mt-1 space-y-1.5">
              {coHostRequests.map((req) => (
                <div
                  key={req.id}
                  className="bg-neutral-900/95 border border-cyan-500/50 rounded-2xl p-2.5 flex items-center justify-between gap-3 shadow-xl animate-in slide-in-from-top-3 duration-200"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <img
                      src={req.avatar}
                      alt={req.name}
                      loading="lazy"
                      decoding="async"
                      className="w-9 h-9 rounded-full object-cover border border-cyan-400 shrink-0"
                      referrerPolicy="no-referrer"
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-white truncate">
                        {req.name} wants to Co-Host
                      </p>
                      <p className="text-[11px] text-cyan-300 truncate">
                        @{req.handle} · Split-Screen Dual Camera
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleRespondCoHostRequest(req, true)}
                      className="min-h-[36px] px-3 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black text-xs font-black transition-all active:scale-95 flex items-center gap-1"
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>Accept</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRespondCoHostRequest(req, false)}
                      className="min-h-[36px] px-2.5 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-bold transition-all"
                    >
                      Decline
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ========================================================= */}
        {/* ACTIVE GIFT CELEBRATION BANNER */}
        {/* ========================================================= */}
        {activeGiftBanner && (
          <div className="absolute top-28 left-4 right-4 z-40 pointer-events-none animate-in slide-in-from-top-6 duration-300">
            <div className="p-3.5 bg-gradient-to-r from-pink-600/95 via-purple-600/95 to-amber-500/95 rounded-2xl shadow-2xl border border-white/30 flex items-center justify-between text-white max-w-md mx-auto">
              <div className="flex items-center gap-3">
                <span className="text-3xl animate-bounce">{activeGiftBanner.giftIcon}</span>
                <div>
                  <p className="text-xs font-bold text-neutral-100">{activeGiftBanner.sender} sent</p>
                  <p className="text-sm font-black tracking-tight">{activeGiftBanner.giftName}!</p>
                </div>
              </div>
              <span className="text-xs font-black text-amber-200 drop-shadow-md">
                +{activeGiftBanner.diamonds} 💎
              </span>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* FLOATING REACTIONS (HEART / FIRE / WAVE) */}
        {/* ========================================================= */}
        <div className="absolute bottom-28 right-4 w-28 h-80 pointer-events-none overflow-hidden z-30">
          {floatingReactions.map((item) => (
            <div
              key={item.id}
              style={{
                left: `calc(50% + ${item.x}px)`,
                bottom: '12px',
                color: item.color,
                fontSize: `${item.size}px`,
              }}
              className="absolute animate-float-note-1 font-bold filter drop-shadow-md"
            >
              {item.emoji}
            </div>
          ))}
        </div>

        {/* ========================================================= */}
        {/* COMPACT LIVE 13-LANGUAGE AI TRANSLATOR MINI PANEL         */}
        {/* ========================================================= */}
        {isTranslatorPanelOpen && (
          <div className="relative z-40 mx-2 sm:mx-3 mb-1.5 bg-neutral-950/95 border border-cyan-500/40 rounded-xl p-2 sm:p-2.5 shadow-2xl max-h-[38vh] overflow-y-auto pointer-events-auto">
            <div className="flex items-center justify-between gap-1.5 pb-1.5 border-b border-neutral-800">
              <div className="flex items-center gap-1.5 min-w-0">
                <div className="w-6 h-6 rounded-md bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center shrink-0">
                  <Languages className="w-3.5 h-3.5 text-cyan-300" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-black text-white truncate leading-tight">
                    Live AI Translator (13 Languages)
                  </p>
                  <p className="text-[9px] text-cyan-300 font-semibold truncate leading-tight">
                    Real-time captions &amp; voice dubbing
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    const next = !isTranslatorEnabled;
                    setIsTranslatorEnabled(next);
                    if (!next) {
                      setIsSpeechCapturing(false);
                      stopTranslatedVoice();
                    }
                  }}
                  className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase border transition-all ${
                    isTranslatorEnabled
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                      : 'bg-neutral-800 text-neutral-400 border-neutral-700'
                  }`}
                >
                  {isTranslatorEnabled ? 'Captions On' : 'Off'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsTranslatorPanelOpen(false)}
                  className="w-6 h-6 rounded-md bg-neutral-900 hover:bg-neutral-800 text-neutral-300 flex items-center justify-center"
                  aria-label="Close translator"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Compact Dual Language Pickers + Swap */}
            <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-1.5 pt-1.5">
              <div>
                <label className="block text-[9px] font-bold uppercase tracking-wider text-neutral-400 mb-0.5">
                  Speak
                </label>
                <select
                  value={spokenLang}
                  onChange={(e) => setSpokenLang(e.target.value as TranslatorLangCode)}
                  className="w-full min-h-[30px] bg-neutral-900 border border-neutral-700 rounded-lg px-2 py-1 text-[11px] font-semibold text-white focus:outline-hidden focus:border-cyan-400"
                >
                  {TRANSLATOR_LANGUAGES.map((lang) => (
                    <option key={lang.code} value={lang.code}>
                      {lang.label} ({lang.nativeName})
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={handleSwapTranslatorLangs}
                className="w-7 h-7 rounded-lg bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-cyan-300 flex items-center justify-center shrink-0 active:scale-95 transition-all"
                title="Swap Spoken & Listen Languages"
              >
                <ArrowLeftRight className="w-3 h-3" />
              </button>

              <div>
                <label className="block text-[9px] font-bold uppercase tracking-wider text-neutral-400 mb-0.5">
                  Translate To
                </label>
                <select
                  value={listenLang}
                  onChange={(e) => setListenLang(e.target.value as TranslatorLangCode)}
                  className="w-full min-h-[30px] bg-neutral-900 border border-neutral-700 rounded-lg px-2 py-1 text-[11px] font-semibold text-white focus:outline-hidden focus:border-pink-400"
                >
                  {TRANSLATOR_LANGUAGES.map((lang) => (
                    <option key={lang.code} value={lang.code}>
                      {lang.label} ({lang.nativeName})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Compact Mic Recognition + Voice Dubbing + Self-Preview Toggles */}
            <div className="flex flex-wrap items-center gap-1 pt-1.5">
              <button
                type="button"
                onClick={handleToggleSpeechCapture}
                className={`min-h-[30px] px-2.5 py-1 rounded-lg text-[10px] font-black flex items-center gap-1 border transition-all active:scale-95 ${
                  isSpeechCapturing
                    ? 'bg-rose-600 hover:bg-rose-500 text-white border-rose-400 shadow-sm shadow-rose-600/30'
                    : 'bg-cyan-500 hover:bg-cyan-400 text-black border-cyan-300'
                }`}
              >
                {isSpeechCapturing ? <MicOff className="w-3 h-3" /> : <Mic className="w-3 h-3" />}
                <span>{isSpeechCapturing ? 'Stop Mic' : 'Start Mic'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const next = !voiceDubbingEnabled;
                  setVoiceDubbingEnabled(next);
                  if (!next) stopTranslatedVoice();
                }}
                className={`min-h-[30px] px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 border transition-all ${
                  voiceDubbingEnabled
                    ? 'bg-pink-600/25 text-pink-200 border-pink-500/50'
                    : 'bg-neutral-900 text-neutral-400 border-neutral-800'
                }`}
              >
                {voiceDubbingEnabled ? (
                  <Volume2 className="w-3 h-3 text-pink-400" />
                ) : (
                  <VolumeX className="w-3 h-3" />
                )}
                <span>Dub {voiceDubbingEnabled ? 'On' : 'Off'}</span>
              </button>

              <button
                type="button"
                onClick={() => setHearSelfPreview((v) => !v)}
                className={`min-h-[30px] px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 border transition-all ${
                  hearSelfPreview
                    ? 'bg-purple-600/30 text-purple-200 border-purple-400/50'
                    : 'bg-neutral-900 text-neutral-400 border-neutral-800'
                }`}
                title="Play voice dubbing locally when you speak so you can preview the translation"
              >
                <Captions className="w-3 h-3" />
                <span>Self {hearSelfPreview ? 'On' : 'Off'}</span>
              </button>
            </div>

            {speechStatusMsg && (
              <p className="text-[10px] text-cyan-300 font-semibold mt-1.5 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                <span>{speechStatusMsg}</span>
              </p>
            )}

            {/* Quick Speak & Translate Fallback / Manual Broadcast Input */}
            <form onSubmit={handleSendManualVoiceTranslate} className="mt-1.5 flex items-center gap-1">
              <input
                type="text"
                value={manualTranslateInput}
                onChange={(e) => setManualTranslateInput(sanitizeInputLive(e.target.value, 280))}
                placeholder={`Type in ${spokenLangDef.label} → ${listenLangDef.label}...`}
                className="flex-1 min-h-[30px] bg-neutral-900 text-[11px] text-white placeholder-neutral-500 px-2.5 py-1 rounded-lg border border-neutral-700 focus:outline-hidden focus:border-cyan-400"
              />
              <button
                type="submit"
                disabled={!manualTranslateInput.trim()}
                className="min-h-[30px] px-2.5 py-1 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 disabled:opacity-40 text-white text-[10px] font-black flex items-center gap-1 shrink-0 active:scale-95 transition-all"
              >
                <Volume2 className="w-3 h-3" />
                <span>Speak</span>
              </button>
            </form>
          </div>
        )}

        {/* ========================================================= */}
        {/* COMPACT LIVE TRANSLATED SUBTITLES OVERLAY                 */}
        {/* ========================================================= */}
        {isTranslatorEnabled && activeSubtitles.length > 0 && (
          <div className="relative z-30 px-2 sm:px-3 mb-1 flex flex-col items-center gap-1 pointer-events-none">
            {activeSubtitles.slice(-2).map((sub) => {
              const srcTag = getTranslatorLanguage(sub.sourceLang).shortTag;
              const tgtTag = getTranslatorLanguage(sub.targetLang).shortTag;
              return (
                <div
                  key={sub.id}
                  className="w-full max-w-lg bg-black/75 border border-cyan-400/35 rounded-lg px-2.5 py-1 shadow-lg text-center"
                >
                  <div className="flex items-center justify-center gap-1 text-[9px] font-bold text-cyan-300">
                    <span className="px-1 py-0.2 rounded bg-cyan-500/20 text-cyan-200 uppercase font-black">
                      {srcTag}→{tgtTag}
                    </span>
                    <span className="text-neutral-200">{sub.senderName}</span>
                    {!sub.isFinal && (
                      <span className="text-amber-300 animate-pulse">listening...</span>
                    )}
                  </div>
                  <p className="text-[11px] sm:text-xs font-black text-white leading-tight break-words">
                    {sub.translatedText}
                  </p>
                  {sub.sourceLang !== sub.targetLang && sub.originalText !== sub.translatedText && (
                    <p className="text-[10px] text-neutral-300 italic leading-tight break-words">
                      “{sub.originalText}”
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ========================================================= */}
        {/* COMPACT BOTTOM OVERLAY: CHAT + STUDIO/CO-HOST MINI BAR    */}
        {/* ========================================================= */}
        <div className="relative z-30 p-2 sm:p-3 bg-gradient-to-t from-black/90 via-black/70 to-transparent flex flex-col justify-end pointer-events-auto">
          {/* Active Host / Co-Host Compact Camera & Audio Mini-Bar */}
          {(isHostingLive || isCoHostingLive) && (
            <div className="mb-1.5 flex flex-col gap-1.5">
              {showFilterStrip && isHostingLive && (
                <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-0.5">
                  {LIVE_FILTERS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handleSelectFilter(preset.id)}
                      className={`px-2 py-1 rounded-lg text-[10px] font-bold whitespace-nowrap border transition-all ${
                        selectedFilter === preset.id
                          ? 'bg-pink-600 text-white border-pink-400 shadow-sm'
                          : 'bg-neutral-900/90 text-neutral-300 border-neutral-700 hover:bg-neutral-800'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between gap-1.5 flex-wrap bg-neutral-900/80 border border-neutral-800 rounded-xl p-1.5 backdrop-blur-md">
                <div className="flex items-center gap-1 flex-wrap">
                  <button
                    type="button"
                    onClick={handleToggleMic}
                    className={`min-h-[30px] px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 border transition-all ${
                      micEnabled
                        ? 'bg-neutral-800 text-white border-neutral-700 hover:bg-neutral-700'
                        : 'bg-rose-600/25 text-rose-300 border-rose-500/50'
                    }`}
                  >
                    {micEnabled ? <Mic className="w-3 h-3" /> : <MicOff className="w-3 h-3" />}
                    <span>{micEnabled ? 'Mic' : 'Muted'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleToggleCamera}
                    className={`min-h-[30px] px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 border transition-all ${
                      cameraEnabled
                        ? 'bg-neutral-800 text-white border-neutral-700 hover:bg-neutral-700'
                        : 'bg-rose-600/25 text-rose-300 border-rose-500/50'
                    }`}
                  >
                    {cameraEnabled ? (
                      <Camera className="w-3 h-3" />
                    ) : (
                      <CameraOff className="w-3 h-3" />
                    )}
                    <span>{cameraEnabled ? 'Cam' : 'Off'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleSwapCamera}
                    className="min-h-[30px] px-2 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-white border border-neutral-700 text-[10px] font-bold flex items-center gap-1 transition-all"
                    title="Swap Front / Back Camera"
                  >
                    <RefreshCw className="w-3 h-3 text-cyan-400" />
                    <span>Flip</span>
                  </button>

                  {isHostingLive && (
                    <button
                      type="button"
                      onClick={() => setShowFilterStrip((s) => !s)}
                      className={`min-h-[30px] px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 border transition-all ${
                        showFilterStrip
                          ? 'bg-purple-600/30 text-purple-200 border-purple-500/50'
                          : 'bg-neutral-800 text-neutral-200 border-neutral-700 hover:bg-neutral-700'
                      }`}
                    >
                      <Wand2 className="w-3 h-3 text-purple-400" />
                      <span>{activeHostFilterPreset.label}</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleToggleSpeechCapture}
                    className={`min-h-[30px] px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 border transition-all ${
                      isSpeechCapturing
                        ? 'bg-cyan-500 text-black border-cyan-300 shadow-sm shadow-cyan-500/25'
                        : 'bg-neutral-800 text-cyan-300 border-neutral-700 hover:bg-neutral-700'
                    }`}
                    title="Start or pause live 13-language voice translation"
                  >
                    <Languages className="w-3 h-3" />
                    <span>{isSpeechCapturing ? 'Translating' : 'Voice AI'}</span>
                  </button>
                </div>

                {(isCoHostingLive || (isHostingLive && coHostInfo)) && (
                  <button
                    type="button"
                    onClick={handleLeaveOrRemoveCoHost}
                    className="min-h-[30px] px-2 py-1 rounded-lg bg-rose-600/25 hover:bg-rose-600/40 text-rose-300 border border-rose-500/40 text-[10px] font-bold flex items-center gap-1 transition-all"
                  >
                    <UserMinus className="w-3 h-3" />
                    <span>{isCoHostingLive ? 'Leave' : 'End Co-Host'}</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Compact Chat Feed + Viewer Co-Host Request & Reaction Shortcuts */}
          <div className="flex flex-col sm:flex-row items-end justify-between gap-2 mb-1.5">
            {/* Compact Live Chat Messages */}
            <div className="w-full sm:max-w-md">
              <div
                ref={chatScrollRef}
                className="max-h-24 sm:max-h-32 overflow-y-auto space-y-1 no-scrollbar text-[11px] pr-1.5"
              >
                {chatMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`inline-flex items-start gap-1 p-1 rounded-lg backdrop-blur-xs max-w-[92%] shadow-xs ${
                      msg.isSystem
                        ? 'bg-neutral-900/80 border border-neutral-700/80 text-neutral-300 text-[10px]'
                        : msg.isGift
                        ? 'bg-amber-500/20 border border-amber-500/40 text-amber-200'
                        : msg.isHost
                        ? 'bg-pink-500/25 border border-pink-500/40 text-pink-100'
                        : msg.isCoHost
                        ? 'bg-cyan-500/20 border border-cyan-500/40 text-cyan-100'
                        : 'bg-black/50 border border-white/10 text-neutral-100'
                    }`}
                  >
                    {!msg.isSystem && (
                      <img
                        src={msg.avatar}
                        alt={msg.user}
                        loading="lazy"
                        decoding="async"
                        className="w-4 h-4 rounded-full object-cover shrink-0 mt-0.5"
                        referrerPolicy="no-referrer"
                      />
                    )}
                    <div className="leading-tight">
                      <span className="font-bold text-white text-[10px] mr-1">{msg.user}</span>
                      {msg.badge && (
                        <span
                          className={`text-[8px] uppercase font-black px-1 py-0.2 rounded-xs mr-1 ${
                            msg.badge === 'Host' || msg.badge === 'Admin'
                              ? 'bg-pink-500 text-white'
                              : msg.badge === 'Co-Host'
                              ? 'bg-cyan-500 text-black'
                              : 'bg-amber-500/30 text-amber-200 border border-amber-500/40'
                          }`}
                        >
                          {msg.badge}
                        </span>
                      )}
                      <span className="text-[10px] text-neutral-200 break-words">{msg.text}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right Quick Action Cluster: Compact Watch Live + Request to Join + Reactions */}
            <div className="flex items-center gap-1 flex-wrap">
              {!isHostingLive && !isCoHostingLive && effectiveBroadcast?.isLive && (
                <button
                  type="button"
                  onClick={handleWatchLive}
                  className="min-h-[32px] px-2.5 py-1 rounded-lg bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white text-[11px] font-black flex items-center gap-1 shadow-md shadow-rose-600/25 active:scale-95 transition-all"
                  title="Connect & watch remote host stream live"
                >
                  <Play className="w-3 h-3 fill-white" />
                  <span>Watch</span>
                </button>
              )}

              {!isHostingLive && !isCoHostingLive && (
                <button
                  type="button"
                  onClick={handleRequestJoinCoHost}
                  disabled={!effectiveBroadcast?.isLive || Boolean(effectiveBroadcast?.coHost)}
                  className={`min-h-[32px] px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 border transition-all ${
                    hasPendingCoHostRequest
                      ? 'bg-cyan-500/25 text-cyan-200 border-cyan-400/50'
                      : effectiveBroadcast?.isLive && !effectiveBroadcast?.coHost
                      ? 'bg-cyan-500 hover:bg-cyan-400 text-black border-cyan-400 shadow-md shadow-cyan-500/25'
                      : 'bg-neutral-900/80 text-neutral-400 border-neutral-800 opacity-70 cursor-not-allowed'
                  }`}
                  title={
                    effectiveBroadcast?.isLive
                      ? 'Request to join host split-screen'
                      : 'Available when a host is broadcasting live'
                  }
                >
                  <UserPlus className="w-3 h-3" />
                  <span>
                    {effectiveBroadcast?.coHost
                      ? 'Busy'
                      : hasPendingCoHostRequest
                      ? 'Requested'
                      : 'Join'}
                  </span>
                </button>
              )}

              <button
                type="button"
                onClick={() => handleSendReaction('fire')}
                className="min-h-[32px] min-w-[32px] px-1.5 rounded-lg bg-neutral-900/90 hover:bg-orange-500/25 border border-neutral-700/80 hover:border-orange-500/50 flex items-center justify-center active:scale-125 transition-all"
                title="Send Fire Reaction"
              >
                <Flame className="w-3.5 h-3.5 text-orange-400" />
              </button>

              <button
                type="button"
                onClick={() => handleSendReaction('wave')}
                className="min-h-[32px] min-w-[32px] px-1.5 rounded-lg bg-neutral-900/90 hover:bg-sky-500/25 border border-neutral-700/80 hover:border-sky-500/50 flex items-center justify-center active:scale-125 transition-all"
                title="Send Wave Reaction"
              >
                <Hand className="w-3.5 h-3.5 text-sky-400" />
              </button>
            </div>
          </div>

          {/* Compact Bottom Chat Form + Gift + Heart Reaction */}
          <div className="flex items-center gap-1.5">
            <form onSubmit={handleSendComment} className="flex-1 flex items-center gap-1">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(sanitizeInputLive(e.target.value, 280))}
                placeholder="Say something nice in chat..."
                className="flex-1 min-h-[34px] bg-neutral-900/90 text-[11px] text-white placeholder-neutral-500 px-3 py-1.5 rounded-full border border-neutral-700/80 focus:outline-hidden focus:border-pink-500 transition-colors shadow-inner"
              />
              <button
                type="submit"
                disabled={!inputText.trim()}
                className="w-8 h-8 rounded-full bg-pink-600 disabled:opacity-40 text-white flex items-center justify-center shrink-0 active:scale-95 transition-all shadow-sm shadow-pink-600/30"
                aria-label="Send comment"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>

            <button
              type="button"
              onClick={() => setIsGiftTrayOpen((o) => !o)}
              className="w-8 h-8 rounded-full bg-gradient-to-tr from-amber-500 to-rose-500 hover:from-amber-400 hover:to-rose-400 text-white flex items-center justify-center shadow-md shadow-amber-500/25 active:scale-95 transition-transform shrink-0"
              title="Open Virtual Gifts"
            >
              <Gift className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => handleSendReaction('heart')}
              className="w-8 h-8 rounded-full bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center shadow-md shadow-rose-600/30 active:scale-125 transition-transform shrink-0"
              title="Send Heart Reaction"
            >
              <Heart className="w-4 h-4 fill-white" />
            </button>
          </div>

          {/* Virtual Gifts Tray */}
          {isGiftTrayOpen && (
            <div className="mt-3 bg-neutral-900/95 border border-neutral-800 rounded-2xl p-3 shadow-2xl animate-in slide-in-from-bottom-4 duration-200">
              <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
                <div className="flex items-center gap-2">
                  <Gift className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-bold text-white uppercase tracking-wider">
                    Send Live Gift
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsGiftTrayOpen(false)}
                  className="text-neutral-400 hover:text-white text-xs font-bold px-2 py-1"
                >
                  Close
                </button>
              </div>

              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 pt-2.5">
                {GIFTS_CATALOG.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => handleSendGift(g)}
                    className="p-2.5 bg-neutral-950 hover:bg-neutral-800/80 rounded-xl border border-neutral-800 flex flex-col items-center justify-center gap-1 group active:scale-95 transition-all hover:border-pink-500/50"
                  >
                    <span className="text-2xl group-hover:scale-110 transition-transform">{g.icon}</span>
                    <span className="text-[11px] font-bold text-white truncate max-w-full">
                      {g.name}
                    </span>
                    <span className="text-[10px] text-amber-400 font-semibold">💎 {g.diamonds}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================= */}
      {/* "GO LIVE" PRE-BROADCAST CREATOR STUDIO MODAL */}
      {/* ========================================================= */}
      {isSetupModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="w-full max-w-lg bg-neutral-900 border border-neutral-800 rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="px-5 py-4 border-b border-neutral-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
                <h2 className="text-base font-black text-white tracking-tight">
                  Go Live Studio Setup
                </h2>
              </div>
              <button
                type="button"
                onClick={handleCancelSetup}
                className="w-9 h-9 rounded-full bg-neutral-800 hover:bg-neutral-700 text-neutral-300 flex items-center justify-center"
                aria-label="Close setup"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 sm:p-5 space-y-4">
              {/* Camera Preview Box */}
              <div className="relative aspect-video w-full rounded-2xl overflow-hidden bg-black border border-neutral-800 flex items-center justify-center">
                {localStream && cameraEnabled ? (
                  <video
                    ref={setupPreviewVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className={`w-full h-full object-cover ${getFilterPreset(selectedFilter).cssClass} ${
                      facingMode === 'user' ? 'scale-x-[-1]' : ''
                    }`}
                  />
                ) : (
                  <div className="p-6 text-center space-y-3">
                    <Camera className="w-10 h-10 text-neutral-500 mx-auto" />
                    <p className="text-xs text-neutral-300 font-medium">
                      {isRequestingCamera
                        ? 'Requesting camera & microphone permission...'
                        : cameraError || 'Camera preview is paused'}
                    </p>
                    {cameraError && (
                      <button
                        type="button"
                        onClick={() => requestDevicePreview(facingMode)}
                        className="px-4 py-2 rounded-xl bg-pink-600 hover:bg-pink-500 text-white text-xs font-bold"
                      >
                        Retry Camera Access
                      </button>
                    )}
                  </div>
                )}

                {localStream && (
                  <div className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-full bg-black/70 border border-white/15 text-[11px] font-bold text-emerald-300 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>{resolutionLabel}</span>
                  </div>
                )}

                {/* Quick Preview Controls */}
                <div className="absolute bottom-2.5 right-2.5 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleToggleMic}
                    className={`w-10 h-10 rounded-full flex items-center justify-center border ${
                      micEnabled
                        ? 'bg-black/80 text-white border-white/20'
                        : 'bg-rose-600 text-white border-rose-400'
                    }`}
                    title={micEnabled ? 'Mute Mic' : 'Unmute Mic'}
                  >
                    {micEnabled ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                  </button>
                  <button
                    type="button"
                    onClick={handleToggleCamera}
                    className={`w-10 h-10 rounded-full flex items-center justify-center border ${
                      cameraEnabled
                        ? 'bg-black/80 text-white border-white/20'
                        : 'bg-rose-600 text-white border-rose-400'
                    }`}
                    title={cameraEnabled ? 'Turn Camera Off' : 'Turn Camera On'}
                  >
                    {cameraEnabled ? <Camera className="w-4 h-4" /> : <CameraOff className="w-4 h-4" />}
                  </button>
                  <button
                    type="button"
                    onClick={handleSwapCamera}
                    className="w-10 h-10 rounded-full bg-black/80 text-white border border-white/20 flex items-center justify-center"
                    title="Switch Front / Back Camera"
                  >
                    <RefreshCw className="w-4 h-4 text-cyan-400" />
                  </button>
                </div>
              </div>

              {/* Stream Title Input */}
              <div>
                <label className="block text-xs font-bold text-neutral-300 mb-1.5">
                  Live Stream Title
                </label>
                <input
                  type="text"
                  value={streamTitleInput}
                  onChange={(e) => setStreamTitleInput(sanitizeInputLive(e.target.value, 120))}
                  placeholder="What are you streaming today?"
                  className="w-full min-h-[44px] bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-neutral-500 focus:outline-hidden focus:border-pink-500"
                />
              </div>

              {/* Front / Back & Real-Time Beauty/Color Filter Picker */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-neutral-300 flex items-center gap-1.5">
                    <Wand2 className="w-3.5 h-3.5 text-purple-400" />
                    Live Beauty & Color Filter
                  </span>
                  <span className="text-[11px] text-neutral-400">
                    Camera: {facingMode === 'user' ? 'Front' : 'Back'}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {LIVE_FILTERS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => setSelectedFilter(preset.id)}
                      className={`min-h-[38px] px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                        selectedFilter === preset.id
                          ? 'bg-pink-600/25 text-white border-pink-500 shadow-sm'
                          : 'bg-neutral-950 text-neutral-400 border-neutral-800 hover:text-white'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Start Broadcast CTA */}
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleCancelSetup}
                  className="min-h-[44px] px-4 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleStartBroadcast}
                  disabled={!localStream || isRequestingCamera}
                  className="flex-1 min-h-[44px] px-4 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 disabled:opacity-45 text-white text-sm font-black shadow-lg shadow-rose-600/30 active:scale-[0.99] transition-all flex items-center justify-center gap-2"
                >
                  <Radio className="w-4 h-4" />
                  <span>Start Live Broadcast</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* END LIVE SUMMARY MODAL */}
      {/* ========================================================= */}
      {liveSummary && (
        <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-3xl p-6 shadow-2xl text-center space-y-5 animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-rose-600 to-pink-500 text-white flex items-center justify-center mx-auto shadow-xl shadow-rose-600/30">
              <Radio className="w-8 h-8" />
            </div>

            <div>
              <h3 className="text-xl font-black text-white tracking-tight">Live Broadcast Summary</h3>
              <p className="text-xs text-neutral-400 mt-1 truncate">{liveSummary.title}</p>
            </div>

            <div className="grid grid-cols-2 gap-3 bg-neutral-950 p-4 rounded-2xl border border-neutral-800">
              <div className="p-2.5 rounded-xl bg-neutral-900/70 border border-neutral-800/80">
                <p className="text-[10px] uppercase font-bold text-neutral-400 flex items-center justify-center gap-1">
                  <Clock className="w-3 h-3 text-pink-400" /> Duration
                </p>
                <p className="text-lg font-black text-white tabular-nums mt-0.5">
                  {formatDuration(liveSummary.durationSeconds)}
                </p>
              </div>

              <div className="p-2.5 rounded-xl bg-neutral-900/70 border border-neutral-800/80">
                <p className="text-[10px] uppercase font-bold text-neutral-400 flex items-center justify-center gap-1">
                  <Eye className="w-3 h-3 text-cyan-400" /> Peak Viewers
                </p>
                <p className="text-lg font-black text-cyan-300 tabular-nums mt-0.5">
                  {liveSummary.peakViewers.toLocaleString()}
                </p>
              </div>

              <div className="p-2.5 rounded-xl bg-neutral-900/70 border border-neutral-800/80">
                <p className="text-[10px] uppercase font-bold text-neutral-400 flex items-center justify-center gap-1">
                  <Heart className="w-3 h-3 text-rose-400" /> Total Likes
                </p>
                <p className="text-lg font-black text-rose-400 tabular-nums mt-0.5">
                  {liveSummary.totalLikes.toLocaleString()}
                </p>
              </div>

              <div className="p-2.5 rounded-xl bg-neutral-900/70 border border-neutral-800/80">
                <p className="text-[10px] uppercase font-bold text-neutral-400 flex items-center justify-center gap-1">
                  <Gem className="w-3 h-3 text-amber-400" /> Gifts & Diamonds
                </p>
                <p className="text-lg font-black text-amber-300 tabular-nums mt-0.5">
                  {liveSummary.totalGifts} ({liveSummary.totalDiamonds.toLocaleString()} 💎)
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setLiveSummary(null)}
                className="flex-1 min-h-[44px] py-3 bg-neutral-800 hover:bg-neutral-700 text-white font-bold text-xs rounded-xl transition-all"
              >
                Stay in Live Hub
              </button>
              <button
                type="button"
                onClick={() => {
                  setLiveSummary(null);
                  onSelectTab('foryou');
                }}
                className="flex-1 min-h-[44px] py-3 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-pink-600/25 transition-all"
              >
                Back to Reels Feed
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
