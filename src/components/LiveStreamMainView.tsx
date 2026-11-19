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
} from 'lucide-react';
import { UserAccount, FeedTab } from '../types';
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
  LiveTransportMode,
  LiveWebRtcMesh,
  stopMediaStream,
} from '../utils/liveRealtimeClient';

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
  // Stable Peer ID for this session
  const peerIdRef = useRef<string>(createLivePeerId());
  const selfPeerId = peerIdRef.current;

  // Watch room selector (when no creator broadcast is overriding, or switching stages)
  const [channelIndex, setChannelIndex] = useState(0);
  const selectedWatchRoom = FEATURED_WATCH_ROOMS[channelIndex];

  // Real-time connection & room state
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'reconnecting'>('connecting');
  const [transportMode, setTransportMode] = useState<LiveTransportMode>('broadcast');
  const [presenceMembers, setPresenceMembers] = useState<LivePresenceMember[]>([]);

  // Active Remote Broadcast State (when watching another host live in `live-room`)
  const [activeBroadcast, setActiveBroadcast] = useState<LiveBroadcastState | null>(null);

  // Local Creator "Go Live" Setup & Broadcast State
  const [isSetupModalOpen, setIsSetupModalOpen] = useState(false);
  const [isRequestingCamera, setIsRequestingCamera] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [streamTitleInput, setStreamTitleInput] = useState('');
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [micEnabled, setMicEnabled] = useState(true);
  const [selectedFilter, setSelectedFilter] = useState<LiveFilterId>('beauty');
  const [resolutionLabel, setResolutionLabel] = useState('1080p HD');
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
      roomId: selectedWatchRoom.id,
      senderId: 'system',
      user: 'Jatt VibeReels Live',
      username: 'system',
      avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=JattLiveSys',
      text: 'Welcome to real-time LIVE chat! Say hello or tap a reaction.',
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

  const localStreamRef = useRef<MediaStream | null>(null);
  const setupPreviewVideoRef = useRef<HTMLVideoElement | null>(null);
  const hostVideoRef = useRef<HTMLVideoElement | null>(null);
  const coHostVideoRef = useRef<HTMLVideoElement | null>(null);
  const stageFallbackVideoRef = useRef<HTMLVideoElement | null>(null);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  const clientRef = useRef<LiveRoomRealtimeClient | null>(null);
  const rtcMeshRef = useRef<LiveWebRtcMesh | null>(null);

  // Refs synced for callbacks without stale closures
  const isHostingRef = useRef(false);
  const activeBroadcastRef = useRef<LiveBroadcastState | null>(null);
  const coHostRequestsRef = useRef<CoHostRequestEvent[]>([]);
  isHostingRef.current = isHostingLive;
  activeBroadcastRef.current = activeBroadcast;
  coHostRequestsRef.current = coHostRequests;

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

  // Current room ID: if a real live broadcast is active, join/host that room ID, otherwise selected stage
  const currentRoomId = activeBroadcast?.isLive ? activeBroadcast.roomId : selectedWatchRoom.id;

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

  // Spawn visual floating reaction particle
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

    setFloatingReactions((prev) => [...prev.slice(-28), item]);
    window.setTimeout(() => {
      setFloatingReactions((prev) => prev.filter((r) => r.id !== item.id));
    }, 2300);
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

  // Initialize LiveRoomRealtimeClient & WebRTC Mesh
  useEffect(() => {
    const client = new LiveRoomRealtimeClient({
      peerId: selfPeerId,
      roomId: selectedWatchRoom.id,
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
        },
        onChatMessage: (msg) => {
          setChatMessages((prev) => {
            if (prev.some((m) => m.id === msg.id)) return prev;
            return [...prev.slice(-80), msg];
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
          for (let i = 0; i < 6; i++) {
            window.setTimeout(() => spawnFloatingReaction('heart'), i * 95);
          }
          window.setTimeout(() => {
            setActiveGiftBanner((curr) => (curr?.id === gift.id ? null : curr));
          }, 3400);
        },
        onBroadcastState: (state) => {
          if (state.hostPeerId === selfPeerId) return;
          setActiveBroadcast(state);
          setTotalLikes((prev) => Math.max(prev, state.totalLikes || 0));
          setTotalDiamonds((prev) => Math.max(prev, state.totalDiamonds || 0));

          // Signal readiness to host via WebRTC if we aren't already receiving their stream
          if (state.isLive) {
            client.sendRtcSignal({
              id: createEventId('ready'),
              roomId: state.roomId,
              fromPeerId: selfPeerId,
              toPeerId: state.hostPeerId,
              kind: 'ready',
              role: 'viewer',
            });
            if (state.coHost && state.coHost.peerId !== selfPeerId) {
              client.sendRtcSignal({
                id: createEventId('ready'),
                roomId: state.roomId,
                fromPeerId: selfPeerId,
                toPeerId: state.coHost.peerId,
                kind: 'ready',
                role: 'viewer',
              });
            }
          }
        },
        onBroadcastEnded: (_roomId, hostPeerId) => {
          setRemoteStreams((prev) => {
            const next = { ...prev };
            delete next[hostPeerId];
            return next;
          });
          setActiveBroadcast((curr) => {
            if (!curr || curr.hostPeerId !== hostPeerId) return curr;
            return null;
          });
          setIsCoHostingLive((wasCoHost) => {
            if (wasCoHost) {
              stopMediaStream(localStreamRef.current);
              localStreamRef.current = null;
              setLocalStream(null);
            }
            return false;
          });
          onShowToast('The host ended this Live broadcast.');
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

          // Accepted! Acquire viewer's own camera & mic and join split-screen via WebRTC
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
            setIsCoHostingLive(true);
            client.setRole('cohost');
            rtcMeshRef.current?.setLocalStream(acquired.stream);

            // Initiate WebRTC offer to host (and any ready viewers)
            await rtcMeshRef.current?.initiateCall(decision.hostPeerId);
          } catch (err) {
            const msg = err instanceof Error ? err.message : 'Camera permission needed to co-host.';
            onShowToast(msg);
          }
        },
        onCoHostLeave: (_roomId, coHostPeerId) => {
          setRemoteStreams((prev) => {
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
            setActiveBroadcast((curr) => (curr ? { ...curr, coHost: null } : null));
            onShowToast('Co-Host left the split screen.');
          }
        },
        onRtcSignal: (signal) => {
          rtcMeshRef.current?.handleSignal(signal);
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
      roomId: selectedWatchRoom.id,
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
      stopMediaStream(localStreamRef.current);
      localStreamRef.current = null;
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

  // Attach MediaStreams to video elements cleanly
  useEffect(() => {
    if (setupPreviewVideoRef.current && localStream) {
      setupPreviewVideoRef.current.srcObject = localStream;
      setupPreviewVideoRef.current.play().catch(() => {});
    }
  }, [isSetupModalOpen, localStream]);

  const effectiveBroadcast = activeBroadcast;
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
    if (hostVideoRef.current && hostStreamToShow) {
      hostVideoRef.current.srcObject = hostStreamToShow;
      hostVideoRef.current.muted = isHostingLive ? true : isMuted;
      hostVideoRef.current.play().catch(() => {});
    }
  }, [hostStreamToShow, isHostingLive, isMuted, coHostInfo]);

  useEffect(() => {
    if (coHostVideoRef.current && coHostStreamToShow) {
      coHostVideoRef.current.srcObject = coHostStreamToShow;
      coHostVideoRef.current.muted = isCoHostingLive && coHostInfo?.peerId === selfPeerId ? true : isMuted;
      coHostVideoRef.current.play().catch(() => {});
    }
  }, [coHostStreamToShow, isCoHostingLive, coHostInfo, isMuted, selfPeerId]);

  useEffect(() => {
    if (stageFallbackVideoRef.current && !hostStreamToShow && !effectiveBroadcast?.isLive) {
      stageFallbackVideoRef.current.muted = isMuted;
      stageFallbackVideoRef.current.play().catch(() => {});
    }
  }, [channelIndex, effectiveBroadcast?.isLive, hostStreamToShow, isMuted]);

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
    setActiveBroadcast(initialState);
    activeBroadcastRef.current = initialState;

    clientRef.current?.setRoomId(roomId);
    clientRef.current?.setRole('host');
    rtcMeshRef.current?.setRoomId(roomId);
    rtcMeshRef.current?.setLocalStream(localStreamRef.current);
    clientRef.current?.publishBroadcastState(initialState);

    // Connect WebRTC to any peers already watching in the room
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
    setChatMessages((prev) => [...prev.slice(-60), sysMsg]);
    clientRef.current?.sendChatMessage(sysMsg);

    soundEngine.playLiveStartSound();
    onShowToast('You are LIVE now!');
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
        const updated = buildCurrentBroadcastState({ facingMode: nextFacing, resolutionLabel: acquired.resolutionLabel });
        setActiveBroadcast(updated);
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
      setActiveBroadcast(updated);
      clientRef.current?.publishBroadcastState(updated);
    } else if (isCoHostingLive && activeBroadcastRef.current?.coHost) {
      const updated: LiveBroadcastState = {
        ...activeBroadcastRef.current,
        coHost: {
          ...activeBroadcastRef.current.coHost,
          micEnabled: nextMic,
        },
      };
      setActiveBroadcast(updated);
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
      setActiveBroadcast(updated);
      clientRef.current?.publishBroadcastState(updated);
    } else if (isCoHostingLive && activeBroadcastRef.current?.coHost) {
      const updated: LiveBroadcastState = {
        ...activeBroadcastRef.current,
        coHost: {
          ...activeBroadcastRef.current.coHost,
          cameraEnabled: nextCam,
        },
      };
      setActiveBroadcast(updated);
      clientRef.current?.publishBroadcastState(updated);
    }
    onShowToast(nextCam ? 'Camera On' : 'Camera Paused');
  };

  const handleSelectFilter = (filterId: LiveFilterId) => {
    setSelectedFilter(filterId);
    if (isHostingLive && activeBroadcastRef.current) {
      const updated = buildCurrentBroadcastState({ filter: filterId });
      setActiveBroadcast(updated);
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

    stopMediaStream(localStreamRef.current);
    localStreamRef.current = null;
    setLocalStream(null);
    setRemoteStreams({});
    setIsHostingLive(false);
    setActiveBroadcast(null);
    activeBroadcastRef.current = null;
    setCoHostRequests([]);
    setBroadcastStartedAt(0);
    setShowFilterStrip(false);
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
      setActiveBroadcast(updated);
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
      setActiveBroadcast(updated);
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

  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-black overflow-hidden relative select-none">
      {/* ========================================================= */}
      {/* TOP LIVE TAB HEADER: Back, Channel/Room, Prominent Go Live */}
      {/* ========================================================= */}
      <div className="w-full max-w-5xl px-3 sm:px-4 py-2 flex items-center justify-between gap-2 z-30 shrink-0">
        <button
          type="button"
          onClick={() => onSelectTab('foryou')}
          className="min-h-[40px] flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-900/90 hover:bg-neutral-800 text-neutral-200 hover:text-white border border-neutral-700/80 text-xs font-bold transition-all shadow-md active:scale-95 shrink-0"
        >
          <ArrowLeft className="w-3.5 h-3.5 text-pink-400" />
          <span className="hidden sm:inline">Back to Reels</span>
          <span className="sm:hidden">Back</span>
        </button>

        {/* Room Indicator / Stage Switcher */}
        <div className="flex items-center gap-1.5 bg-neutral-900/85 px-2.5 py-1.5 rounded-full border border-neutral-800 backdrop-blur-md min-w-0">
          {!effectiveBroadcast?.isLive && (
            <button
              type="button"
              onClick={() =>
                setChannelIndex((prev) => (prev - 1 + FEATURED_WATCH_ROOMS.length) % FEATURED_WATCH_ROOMS.length)
              }
              className="p-1 text-neutral-400 hover:text-white transition-colors"
              title="Previous Stage"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}
          <span className="text-xs font-bold text-white flex items-center gap-1.5 truncate">
            <Radio className="w-3.5 h-3.5 text-rose-500 animate-pulse shrink-0" />
            <span className="truncate max-w-[120px] sm:max-w-[200px]">{displayedHostName}</span>
          </span>
          {!effectiveBroadcast?.isLive && (
            <button
              type="button"
              onClick={() => setChannelIndex((prev) => (prev + 1) % FEATURED_WATCH_ROOMS.length)}
              className="p-1 text-neutral-400 hover:text-white transition-colors"
              title="Next Stage"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Right Header Actions: Go Live / End Live + Sound */}
        <div className="flex items-center gap-2 shrink-0">
          {!isHostingLive ? (
            <button
              type="button"
              onClick={handleOpenGoLiveSetup}
              className="min-h-[40px] flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white text-xs font-black tracking-wide shadow-lg shadow-rose-600/30 active:scale-95 transition-all"
            >
              <span className="w-2 h-2 rounded-full bg-white animate-ping" />
              <Camera className="w-3.5 h-3.5" />
              <span>Go Live</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleEndLiveBroadcast}
              className="min-h-[40px] flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black shadow-lg shadow-rose-600/30 active:scale-95 transition-all"
            >
              <Power className="w-3.5 h-3.5" />
              <span>End Live</span>
            </button>
          )}

          <button
            type="button"
            onClick={onToggleMute}
            className={`min-h-[40px] flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
              isMuted
                ? 'bg-neutral-900 text-neutral-400 border-neutral-800'
                : 'bg-pink-600/20 text-pink-400 border-pink-500/40'
            }`}
            title={isMuted ? 'Unmute audio' : 'Mute audio'}
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* MAIN FULL-SCREEN LIVE STAGE CONTAINER */}
      {/* ========================================================= */}
      <div className="relative w-full h-[calc(100%-56px)] sm:max-w-5xl max-h-[850px] rounded-2xl sm:rounded-3xl overflow-hidden bg-neutral-950 border border-neutral-800/80 shadow-2xl flex flex-col justify-between">
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

                <div className="absolute top-16 left-3 z-20 flex items-center gap-1.5 bg-black/65 backdrop-blur-md px-2.5 py-1 rounded-full border border-pink-500/40">
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
                      className="w-20 h-20 rounded-full object-cover border-2 border-cyan-400 shadow-xl"
                      referrerPolicy="no-referrer"
                    />
                    <p className="text-xs font-bold text-white">{coHostInfo.name}</p>
                    <p className="text-[11px] text-cyan-300">Connecting Co-Host WebRTC feed...</p>
                  </div>
                )}

                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-black/50 pointer-events-none" />

                <div className="absolute top-16 right-3 z-20 flex items-center gap-1.5 bg-black/65 backdrop-blur-md px-2.5 py-1 rounded-full border border-cyan-500/40">
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
                    className="w-24 h-24 rounded-full object-cover border-4 border-pink-500 shadow-2xl"
                    referrerPolicy="no-referrer"
                  />
                  <div>
                    <p className="text-base font-bold text-white">{displayedHostName}</p>
                    <p className="text-xs text-neutral-400 mt-1">
                      {effectiveBroadcast.cameraEnabled === false
                        ? 'Host paused their camera (audio still live)'
                        : 'Connecting real-time WebRTC video stream...'}
                    </p>
                  </div>
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/55 pointer-events-none" />
            </div>
          ) : (
            /* FEATURED LIVE STAGE WHEN NO CREATOR IS CURRENTLY BROADCASTING */
            <div className="relative w-full h-full overflow-hidden flex items-center justify-center">
              <video
                ref={stageFallbackVideoRef}
                src={selectedWatchRoom.videoUrl}
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
        {/* TOP OVERLAY BAR: Host Pill, Stream Title, LIVE & Viewers  */}
        {/* ========================================================= */}
        <div className="relative z-20 p-3 sm:p-4 bg-gradient-to-b from-black/85 via-black/40 to-transparent flex flex-col gap-2 pointer-events-auto">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            {/* Host Card */}
            <div className="flex items-center gap-2 bg-black/65 backdrop-blur-md p-1 pr-3 rounded-full border border-white/15">
              <img
                src={displayedHostAvatar}
                alt={displayedHostName}
                className="w-9 h-9 rounded-full object-cover border-2 border-pink-500 shrink-0"
                referrerPolicy="no-referrer"
              />
              <div className="min-w-0">
                <div className="flex items-center gap-1">
                  <p className="text-xs font-bold text-white truncate max-w-[110px] sm:max-w-[170px]">
                    {displayedHostName}
                  </p>
                  <CheckCircle className="w-3 h-3 text-pink-400 shrink-0" />
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-neutral-300">
                  <span className="text-amber-400 font-bold">💎 {totalDiamonds.toLocaleString()}</span>
                  <span>·</span>
                  <span className="text-neutral-400 truncate">@{displayedHostHandle}</span>
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
                  className={`ml-1 px-2.5 py-1 rounded-full text-xs font-bold transition-all ${
                    isFollowingHost
                      ? 'bg-neutral-800 text-neutral-300 border border-neutral-700'
                      : 'bg-pink-600 hover:bg-pink-500 text-white shadow-md shadow-pink-600/30'
                  }`}
                >
                  {isFollowingHost ? 'Following' : '+ Follow'}
                </button>
              )}
            </div>

            {/* Right Status Badges: Real LIVE Timer + Viewer Count + Quality */}
            <div className="flex items-center gap-2 flex-wrap">
              {effectiveBroadcast?.isLive && (
                <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-black/65 border border-white/15 text-[11px] font-semibold text-emerald-300 backdrop-blur-md">
                  <Wifi className="w-3 h-3" />
                  <span>{effectiveBroadcast.resolutionLabel}</span>
                </div>
              )}

              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-rose-600/25 border border-rose-500/45 text-white backdrop-blur-md shadow-sm">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                <span className="text-xs font-black uppercase tracking-wider text-rose-300">
                  {effectiveBroadcast?.isLive ? 'LIVE' : 'STAGE'}
                </span>
                {isHostingLive && (
                  <>
                    <span className="text-neutral-500">|</span>
                    <span className="text-xs font-bold tabular-nums text-white">
                      {formatDuration(elapsedSeconds)}
                    </span>
                  </>
                )}
                <span className="text-neutral-500">|</span>
                <Users className="w-3.5 h-3.5 text-neutral-200" />
                <span className="text-xs font-bold tabular-nums" title="Live connected users">
                  {activeViewerCount}
                </span>
              </div>
            </div>
          </div>

          {/* Stream Title + Sync Channel Status Pill */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="inline-flex items-center gap-2 bg-black/60 border border-white/10 px-3 py-1 rounded-full backdrop-blur-md text-xs text-neutral-100 max-w-full">
              <Sparkles className="w-3.5 h-3.5 text-pink-400 shrink-0" />
              <span className="truncate font-semibold">{displayedTitle}</span>
            </div>

            <div className="inline-flex items-center gap-1.5 bg-black/60 border border-white/10 px-2.5 py-1 rounded-full text-[10px] font-semibold text-neutral-300 backdrop-blur-md">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  connectionStatus === 'connected' ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'
                }`}
              />
              <span>
                {transportMode === 'supabase' ? 'Supabase Realtime' : 'Live Room Sync'} ·{' '}
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
                  className="bg-neutral-900/95 border border-cyan-500/50 rounded-2xl p-2.5 flex items-center justify-between gap-3 shadow-xl backdrop-blur-md animate-in slide-in-from-top-3 duration-200"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <img
                      src={req.avatar}
                      alt={req.name}
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
            <div className="p-3.5 bg-gradient-to-r from-pink-600/95 via-purple-600/95 to-amber-500/95 rounded-2xl shadow-2xl border border-white/30 backdrop-blur-md flex items-center justify-between text-white max-w-md mx-auto">
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
        {/* BOTTOM OVERLAY: REAL-TIME CHAT + STUDIO/CO-HOST CONTROLS  */}
        {/* ========================================================= */}
        <div className="relative z-30 p-3 sm:p-4 bg-gradient-to-t from-black via-black/85 to-transparent flex flex-col justify-end pointer-events-auto">
          {/* Active Host / Co-Host Camera & Audio Controls Toolbar */}
          {(isHostingLive || isCoHostingLive) && (
            <div className="mb-2.5 flex flex-col gap-2">
              {showFilterStrip && isHostingLive && (
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
                  {LIVE_FILTERS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handleSelectFilter(preset.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap border transition-all ${
                        selectedFilter === preset.id
                          ? 'bg-pink-600 text-white border-pink-400 shadow-md'
                          : 'bg-neutral-900/90 text-neutral-300 border-neutral-700 hover:bg-neutral-800'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between gap-2 flex-wrap bg-neutral-900/85 border border-neutral-800 rounded-2xl p-2 backdrop-blur-md">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={handleToggleMic}
                    className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-all ${
                      micEnabled
                        ? 'bg-neutral-800 text-white border-neutral-700 hover:bg-neutral-700'
                        : 'bg-rose-600/25 text-rose-300 border-rose-500/50'
                    }`}
                  >
                    {micEnabled ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5" />}
                    <span>{micEnabled ? 'Mic On' : 'Muted'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleToggleCamera}
                    className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-all ${
                      cameraEnabled
                        ? 'bg-neutral-800 text-white border-neutral-700 hover:bg-neutral-700'
                        : 'bg-rose-600/25 text-rose-300 border-rose-500/50'
                    }`}
                  >
                    {cameraEnabled ? (
                      <Camera className="w-3.5 h-3.5" />
                    ) : (
                      <CameraOff className="w-3.5 h-3.5" />
                    )}
                    <span>{cameraEnabled ? 'Cam On' : 'Cam Off'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleSwapCamera}
                    className="min-h-[38px] px-3 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white border border-neutral-700 text-xs font-bold flex items-center gap-1.5 transition-all"
                    title="Swap Front / Back Camera"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Swap Cam</span>
                  </button>

                  {isHostingLive && (
                    <button
                      type="button"
                      onClick={() => setShowFilterStrip((s) => !s)}
                      className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-all ${
                        showFilterStrip
                          ? 'bg-purple-600/30 text-purple-200 border-purple-500/50'
                          : 'bg-neutral-800 text-neutral-200 border-neutral-700 hover:bg-neutral-700'
                      }`}
                    >
                      <Wand2 className="w-3.5 h-3.5 text-purple-400" />
                      <span>{activeHostFilterPreset.label}</span>
                    </button>
                  )}
                </div>

                {(isCoHostingLive || (isHostingLive && coHostInfo)) && (
                  <button
                    type="button"
                    onClick={handleLeaveOrRemoveCoHost}
                    className="min-h-[38px] px-3 py-1.5 rounded-xl bg-rose-600/25 hover:bg-rose-600/40 text-rose-300 border border-rose-500/40 text-xs font-bold flex items-center gap-1.5 transition-all"
                  >
                    <UserMinus className="w-3.5 h-3.5" />
                    <span>{isCoHostingLive ? 'Leave Split-Screen' : 'End Co-Host'}</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Chat Feed + Viewer Co-Host Request & Reaction Shortcuts */}
          <div className="flex flex-col sm:flex-row items-end justify-between gap-3 mb-2.5">
            {/* Live Chat Messages */}
            <div className="w-full sm:max-w-md">
              <div
                ref={chatScrollRef}
                className="max-h-40 sm:max-h-48 overflow-y-auto space-y-1.5 no-scrollbar text-xs pr-2"
              >
                {chatMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`inline-flex items-start gap-1.5 p-1.5 rounded-xl backdrop-blur-xs max-w-[95%] shadow-xs ${
                      msg.isSystem
                        ? 'bg-neutral-900/85 border border-neutral-700/80 text-neutral-300 text-[11px]'
                        : msg.isGift
                        ? 'bg-amber-500/20 border border-amber-500/40 text-amber-200'
                        : msg.isHost
                        ? 'bg-pink-500/25 border border-pink-500/40 text-pink-100'
                        : msg.isCoHost
                        ? 'bg-cyan-500/20 border border-cyan-500/40 text-cyan-100'
                        : 'bg-black/55 border border-white/10 text-neutral-100'
                    }`}
                  >
                    {!msg.isSystem && (
                      <img
                        src={msg.avatar}
                        alt={msg.user}
                        loading="lazy"
                        decoding="async"
                        className="w-5 h-5 rounded-full object-cover shrink-0 mt-0.5"
                        referrerPolicy="no-referrer"
                      />
                    )}
                    <div className="leading-snug">
                      <span className="font-bold text-white text-[11px] mr-1.5">{msg.user}</span>
                      {msg.badge && (
                        <span
                          className={`text-[9px] uppercase font-black px-1.5 py-0.5 rounded-xs mr-1.5 ${
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
                      <span className="text-[11px] text-neutral-200 break-words">{msg.text}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right Quick Action Cluster: Request to Join + Heart/Fire/Wave Reactions */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {!isHostingLive && !isCoHostingLive && (
                <button
                  type="button"
                  onClick={handleRequestJoinCoHost}
                  disabled={!effectiveBroadcast?.isLive || Boolean(effectiveBroadcast?.coHost)}
                  className={`min-h-[40px] px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-all ${
                    hasPendingCoHostRequest
                      ? 'bg-cyan-500/25 text-cyan-200 border-cyan-400/50'
                      : effectiveBroadcast?.isLive && !effectiveBroadcast?.coHost
                      ? 'bg-cyan-500 hover:bg-cyan-400 text-black border-cyan-400 shadow-lg shadow-cyan-500/25'
                      : 'bg-neutral-900/80 text-neutral-400 border-neutral-800 opacity-70 cursor-not-allowed'
                  }`}
                  title={
                    effectiveBroadcast?.isLive
                      ? 'Request to join host split-screen'
                      : 'Available when a host is broadcasting live'
                  }
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>
                    {effectiveBroadcast?.coHost
                      ? 'Co-Host Busy'
                      : hasPendingCoHostRequest
                      ? 'Requested...'
                      : 'Request to Join'}
                  </span>
                </button>
              )}

              <button
                type="button"
                onClick={() => handleSendReaction('fire')}
                className="min-h-[40px] min-w-[40px] px-2.5 rounded-xl bg-neutral-900/90 hover:bg-orange-500/25 border border-neutral-700/80 hover:border-orange-500/50 text-sm flex items-center justify-center active:scale-125 transition-all"
                title="Send Fire Reaction"
              >
                <Flame className="w-4 h-4 text-orange-400" />
              </button>

              <button
                type="button"
                onClick={() => handleSendReaction('wave')}
                className="min-h-[40px] min-w-[40px] px-2.5 rounded-xl bg-neutral-900/90 hover:bg-sky-500/25 border border-neutral-700/80 hover:border-sky-500/50 text-sm flex items-center justify-center active:scale-125 transition-all"
                title="Send Wave Reaction"
              >
                <Hand className="w-4 h-4 text-sky-400" />
              </button>
            </div>
          </div>

          {/* Bottom Chat Form + Gift + Heart Reaction */}
          <div className="flex items-center gap-2">
            <form onSubmit={handleSendComment} className="flex-1 flex items-center gap-1.5">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(sanitizeInputLive(e.target.value, 280))}
                placeholder="Say something nice in chat..."
                className="flex-1 min-h-[44px] bg-neutral-900/90 text-xs text-white placeholder-neutral-500 px-4 py-2.5 rounded-full border border-neutral-700/80 focus:outline-hidden focus:border-pink-500 transition-colors shadow-inner"
              />
              <button
                type="submit"
                disabled={!inputText.trim()}
                className="w-11 h-11 rounded-full bg-pink-600 disabled:opacity-40 text-white flex items-center justify-center shrink-0 active:scale-95 transition-all shadow-md shadow-pink-600/30"
                aria-label="Send comment"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>

            <button
              type="button"
              onClick={() => setIsGiftTrayOpen((o) => !o)}
              className="w-11 h-11 rounded-full bg-gradient-to-tr from-amber-500 to-rose-500 hover:from-amber-400 hover:to-rose-400 text-white flex items-center justify-center shadow-lg shadow-amber-500/25 active:scale-95 transition-transform shrink-0"
              title="Open Virtual Gifts"
            >
              <Gift className="w-5 h-5" />
            </button>

            <button
              type="button"
              onClick={() => handleSendReaction('heart')}
              className="w-11 h-11 rounded-full bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center shadow-lg shadow-rose-600/30 active:scale-125 transition-transform shrink-0"
              title="Send Heart Reaction"
            >
              <Heart className="w-5 h-5 fill-white" />
            </button>
          </div>

          {/* Virtual Gifts Tray */}
          {isGiftTrayOpen && (
            <div className="mt-3 bg-neutral-900/95 border border-neutral-800 rounded-2xl p-3 shadow-2xl backdrop-blur-md animate-in slide-in-from-bottom-4 duration-200">
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
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
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
                    className={`w-10 h-10 rounded-full flex items-center justify-center border backdrop-blur-md ${
                      micEnabled
                        ? 'bg-black/70 text-white border-white/20'
                        : 'bg-rose-600 text-white border-rose-400'
                    }`}
                    title={micEnabled ? 'Mute Mic' : 'Unmute Mic'}
                  >
                    {micEnabled ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                  </button>
                  <button
                    type="button"
                    onClick={handleToggleCamera}
                    className={`w-10 h-10 rounded-full flex items-center justify-center border backdrop-blur-md ${
                      cameraEnabled
                        ? 'bg-black/70 text-white border-white/20'
                        : 'bg-rose-600 text-white border-rose-400'
                    }`}
                    title={cameraEnabled ? 'Turn Camera Off' : 'Turn Camera On'}
                  >
                    {cameraEnabled ? <Camera className="w-4 h-4" /> : <CameraOff className="w-4 h-4" />}
                  </button>
                  <button
                    type="button"
                    onClick={handleSwapCamera}
                    className="w-10 h-10 rounded-full bg-black/70 text-white border border-white/20 flex items-center justify-center backdrop-blur-md"
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
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
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
