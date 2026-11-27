import { RealtimeChannel } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { sanitizeSafeUrl, sanitizeText, sanitizeUsername } from './security';

export type LiveFilterId = 'original' | 'beauty' | 'golden' | 'studio' | 'neon' | 'noir';

export interface LiveFilterPreset {
  id: LiveFilterId;
  label: string;
  cssClass: string;
  badgeColor: string;
}

export const LIVE_FILTERS: LiveFilterPreset[] = [
  {
    id: 'original',
    label: 'Natural',
    cssClass: '',
    badgeColor: 'text-neutral-200',
  },
  {
    id: 'beauty',
    label: 'Beauty Soft',
    cssClass: 'brightness-105 contrast-[0.98] saturate-110',
    badgeColor: 'text-pink-300',
  },
  {
    id: 'golden',
    label: 'Golden Glow',
    cssClass: 'sepia-[0.18] contrast-105 saturate-135 brightness-105',
    badgeColor: 'text-amber-300',
  },
  {
    id: 'studio',
    label: 'Studio Crisp',
    cssClass: 'contrast-115 saturate-125 brightness-105',
    badgeColor: 'text-cyan-300',
  },
  {
    id: 'neon',
    label: 'Neon Cyber',
    cssClass: 'contrast-125 saturate-150 hue-rotate-[18deg]',
    badgeColor: 'text-purple-300',
  },
  {
    id: 'noir',
    label: 'B&W Noir',
    cssClass: 'grayscale contrast-125 brightness-105',
    badgeColor: 'text-neutral-300',
  },
];

export function getFilterPreset(id?: LiveFilterId): LiveFilterPreset {
  return LIVE_FILTERS.find((f) => f.id === id) || LIVE_FILTERS[0];
}

export type LiveReactionType = 'heart' | 'fire' | 'wave';

export interface LivePresenceMember {
  peerId: string;
  name: string;
  username: string;
  avatar: string;
  role: 'host' | 'cohost' | 'viewer';
  roomId: string;
  joinedAt: number;
  lastSeen: number;
  activeBroadcast?: LiveBroadcastState | null;
}

export interface LiveChatEvent {
  id: string;
  roomId: string;
  senderId: string;
  user: string;
  username: string;
  avatar: string;
  text: string;
  timestamp: number;
  isHost?: boolean;
  isCoHost?: boolean;
  isGift?: boolean;
  isSystem?: boolean;
  giftIcon?: string;
  giftName?: string;
  diamonds?: number;
  badge?: string;
}

export interface LiveReactionEvent {
  id: string;
  roomId: string;
  senderId: string;
  senderName: string;
  type: LiveReactionType;
  timestamp: number;
}

export interface LiveGiftEvent {
  id: string;
  roomId: string;
  senderId: string;
  senderName: string;
  senderUsername: string;
  senderAvatar: string;
  giftId: string;
  giftName: string;
  giftIcon: string;
  diamonds: number;
  timestamp: number;
}

export interface LiveCoHostInfo {
  peerId: string;
  name: string;
  handle: string;
  avatar: string;
  micEnabled: boolean;
  cameraEnabled: boolean;
  facingMode: 'user' | 'environment';
}

export interface LiveBroadcastState {
  roomId: string;
  hostPeerId: string;
  hostName: string;
  hostHandle: string;
  hostAvatar: string;
  title: string;
  isLive: boolean;
  filter: LiveFilterId;
  resolutionLabel: string;
  cameraEnabled: boolean;
  micEnabled: boolean;
  facingMode: 'user' | 'environment';
  coHost: LiveCoHostInfo | null;
  startedAt: number;
  totalLikes: number;
  totalDiamonds: number;
}

export interface CoHostRequestEvent {
  id: string;
  roomId: string;
  peerId: string;
  name: string;
  handle: string;
  avatar: string;
  requestedAt: number;
}

export interface CoHostDecisionEvent {
  id: string;
  requestId: string;
  roomId: string;
  targetPeerId: string;
  hostPeerId: string;
  accepted: boolean;
  timestamp: number;
}

export interface RtcSignalPayload {
  id: string;
  roomId: string;
  fromPeerId: string;
  toPeerId: string;
  kind: 'ready' | 'offer' | 'answer' | 'ice' | 'bye';
  sdp?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
  role?: 'host' | 'cohost' | 'viewer';
}

export interface LiveSpeechCaptionEvent {
  id: string;
  roomId: string;
  senderId: string;
  senderName: string;
  senderRole: 'host' | 'cohost' | 'viewer';
  sourceLang: string;
  originalText: string;
  senderTargetLang?: string;
  senderTranslatedText?: string;
  isFinal: boolean;
  timestamp: number;
}

export type LiveTransportMode = 'supabase' | 'broadcast';

export interface LiveRoomHandlers {
  onPresenceChange?: (members: LivePresenceMember[]) => void;
  onChatMessage?: (msg: LiveChatEvent) => void;
  onReaction?: (reaction: LiveReactionEvent) => void;
  onGift?: (gift: LiveGiftEvent) => void;
  onBroadcastState?: (state: LiveBroadcastState) => void;
  onBroadcastEnded?: (roomId: string, hostPeerId: string) => void;
  onCoHostRequest?: (req: CoHostRequestEvent) => void;
  onCoHostDecision?: (decision: CoHostDecisionEvent) => void;
  onCoHostLeave?: (roomId: string, coHostPeerId: string) => void;
  onRtcSignal?: (signal: RtcSignalPayload) => void;
  onSpeechCaption?: (caption: LiveSpeechCaptionEvent) => void;
  onSyncRequested?: (requesterPeerId: string) => void;
  onStatusChange?: (status: 'connecting' | 'connected' | 'reconnecting', mode: LiveTransportMode) => void;
}

const CHANNEL_NAME = 'live-rooms';
const BROADCAST_CHANNEL_NAME = 'jatt_vibereels_live_rooms_v1';
const STORAGE_FALLBACK_KEY = 'jatt_vibereels_live_rooms_evt_v1';

export function createLivePeerId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `peer_${crypto.randomUUID().slice(0, 12)}`;
  }
  return `peer_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function createEventId(prefix = 'evt'): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Unified real-time client for `live-rooms`:
 * - Uses Supabase Realtime (`supabase.channel('live-rooms')`) when configured
 * - Falls back automatically to browser `BroadcastChannel` + `storage` events when Supabase keys are absent
 * - Stores active broadcast state in Presence so late-joining devices see all live hosts immediately
 * - Guarantees idempotent event handling via event ID deduplication
 */
export class LiveRoomRealtimeClient {
  public readonly peerId: string;
  private roomId: string;
  private profile: { name: string; username: string; avatar: string };
  private role: 'host' | 'cohost' | 'viewer' = 'viewer';
  private activeBroadcast: LiveBroadcastState | null = null;
  private handlers: LiveRoomHandlers;

  private supabaseChannel: RealtimeChannel | null = null;
  private supabaseSubscribed = false;
  private pendingOutgoing: Array<{ event: string; payload: Record<string, unknown> }> = [];
  private broadcastChannel: BroadcastChannel | null = null;
  private mode: LiveTransportMode = isSupabaseConfigured && supabase ? 'supabase' : 'broadcast';

  private seenIds = new Set<string>();
  private peerMap = new Map<string, LivePresenceMember>();
  private heartbeatTimer: number | null = null;
  private pruneTimer: number | null = null;
  private disposed = false;

  constructor(options: {
    peerId: string;
    roomId: string;
    profile: { name: string; username: string; avatar: string };
    handlers: LiveRoomHandlers;
  }) {
    this.peerId = options.peerId;
    this.roomId = options.roomId;
    this.profile = options.profile;
    this.handlers = options.handlers;
  }

  public getTransportMode(): LiveTransportMode {
    return this.mode;
  }

  public setRoomId(roomId: string) {
    this.roomId = roomId;
    this.announcePresence();
  }

  public setRole(role: 'host' | 'cohost' | 'viewer') {
    this.role = role;
    this.announcePresence();
  }

  public setActiveBroadcast(state: LiveBroadcastState | null) {
    this.activeBroadcast = state;
    this.announcePresence();
  }

  public requestSync() {
    this.sendRaw('broadcast:sync_request', {
      id: createEventId('sync'),
      requesterPeerId: this.peerId,
    });
  }

  public connect() {
    if (this.disposed) return;
    this.handlers.onStatusChange?.('connecting', this.mode);

    if (this.mode === 'supabase' && supabase) {
      this.connectSupabase();
    } else {
      this.connectBroadcastFallback();
    }
  }

  private markSeen(id?: string): boolean {
    if (!id) return true;
    if (this.seenIds.has(id)) return false;
    this.seenIds.add(id);
    if (this.seenIds.size > 600) {
      const first = this.seenIds.values().next().value;
      if (first) this.seenIds.delete(first);
    }
    return true;
  }

  private buildSelfMember(): LivePresenceMember {
    return {
      peerId: this.peerId,
      name: sanitizeText(this.profile.name, 60) || 'Viewer',
      username: sanitizeUsername(this.profile.username, 40) || 'viewer',
      avatar: sanitizeSafeUrl(this.profile.avatar) || 'https://api.dicebear.com/7.x/bottts/svg?seed=Viewer',
      role: this.role,
      roomId: this.roomId,
      joinedAt: Date.now(),
      lastSeen: Date.now(),
      activeBroadcast: this.activeBroadcast,
    };
  }

  private connectSupabase() {
    if (!supabase) {
      this.mode = 'broadcast';
      this.connectBroadcastFallback();
      return;
    }

    const channel = supabase.channel(CHANNEL_NAME, {
      config: {
        broadcast: { self: false },
        presence: { key: this.peerId },
      },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<LivePresenceMember>();
        const members: LivePresenceMember[] = [];
        Object.values(state).forEach((entries) => {
          entries.forEach((entry) => {
            if (entry && entry.peerId) {
              members.push(entry);
            }
          });
        });
        this.handlers.onPresenceChange?.(members);
      })
      .on('broadcast', { event: 'chat:message' }, ({ payload }) => {
        this.handleIncomingEnvelope('chat:message', payload);
      })
      .on('broadcast', { event: 'reaction:burst' }, ({ payload }) => {
        this.handleIncomingEnvelope('reaction:burst', payload);
      })
      .on('broadcast', { event: 'gift:sent' }, ({ payload }) => {
        this.handleIncomingEnvelope('gift:sent', payload);
      })
      .on('broadcast', { event: 'broadcast:state' }, ({ payload }) => {
        this.handleIncomingEnvelope('broadcast:state', payload);
      })
      .on('broadcast', { event: 'broadcast:ended' }, ({ payload }) => {
        this.handleIncomingEnvelope('broadcast:ended', payload);
      })
      .on('broadcast', { event: 'cohost:request' }, ({ payload }) => {
        this.handleIncomingEnvelope('cohost:request', payload);
      })
      .on('broadcast', { event: 'cohost:decision' }, ({ payload }) => {
        this.handleIncomingEnvelope('cohost:decision', payload);
      })
      .on('broadcast', { event: 'cohost:leave' }, ({ payload }) => {
        this.handleIncomingEnvelope('cohost:leave', payload);
      })
      .on('broadcast', { event: 'rtc:signal' }, ({ payload }) => {
        this.handleIncomingEnvelope('rtc:signal', payload);
      })
      .on('broadcast', { event: 'speech:caption' }, ({ payload }) => {
        this.handleIncomingEnvelope('speech:caption', payload);
      })
      .on('broadcast', { event: 'broadcast:sync_request' }, ({ payload }) => {
        this.handleIncomingEnvelope('broadcast:sync_request', payload);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          this.supabaseSubscribed = true;
          this.handlers.onStatusChange?.('connected', 'supabase');
          await channel.track(this.buildSelfMember());

          if (this.pendingOutgoing.length > 0) {
            const queued = [...this.pendingOutgoing];
            this.pendingOutgoing = [];
            for (const msg of queued) {
              channel.send({ type: 'broadcast', event: msg.event, payload: msg.payload });
            }
          }

          this.sendRaw('broadcast:sync_request', {
            id: createEventId('sync'),
            requesterPeerId: this.peerId,
          });
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          this.supabaseSubscribed = false;
          this.handlers.onStatusChange?.('reconnecting', 'supabase');
        }
      });

    this.supabaseChannel = channel;
  }

  private connectBroadcastFallback() {
    this.mode = 'broadcast';
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        const bc = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
        bc.onmessage = (evt) => {
          if (!evt.data || typeof evt.data !== 'object') return;
          const { event, payload } = evt.data as { event: string; payload: unknown };
          this.handleIncomingEnvelope(event, payload);
        };
        this.broadcastChannel = bc;
      } catch {
        this.broadcastChannel = null;
      }
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('storage', this.handleStorageFallback);
      window.addEventListener('beforeunload', this.handleBeforeUnload);
    }

    const selfMember = this.buildSelfMember();
    this.peerMap.set(this.peerId, selfMember);
    this.emitLocalPresence();

    this.handlers.onStatusChange?.('connected', 'broadcast');

    // Broadcast our presence and ask any active live host for current broadcast state
    this.announcePresence();
    this.sendRaw('broadcast:sync_request', {
      id: createEventId('sync'),
      requesterPeerId: this.peerId,
    });

    this.heartbeatTimer = window.setInterval(() => {
      this.announcePresence();
    }, 3500);

    this.pruneTimer = window.setInterval(() => {
      const cutoff = Date.now() - 12000;
      let changed = false;
      this.peerMap.forEach((member, id) => {
        if (id !== this.peerId && member.lastSeen < cutoff) {
          this.peerMap.delete(id);
          changed = true;
        }
      });
      if (changed) this.emitLocalPresence();
    }, 4000);
  }

  private handleStorageFallback = (e: StorageEvent) => {
    if (e.key !== STORAGE_FALLBACK_KEY || !e.newValue) return;
    try {
      const parsed = JSON.parse(e.newValue) as { event: string; payload: unknown };
      if (parsed && parsed.event) {
        this.handleIncomingEnvelope(parsed.event, parsed.payload);
      }
    } catch {
      // ignore malformed payload
    }
  };

  private handleBeforeUnload = () => {
    this.sendRaw('presence:leave', {
      id: createEventId('leave'),
      peerId: this.peerId,
    });
  };

  private emitLocalPresence() {
    this.handlers.onPresenceChange?.(Array.from(this.peerMap.values()));
  }

  private handleIncomingEnvelope(event: string, payload: unknown) {
    if (!payload || typeof payload !== 'object') return;
    const data = payload as Record<string, unknown>;
    const evtId = typeof data.id === 'string' ? data.id : undefined;
    if (evtId && event !== 'presence:heartbeat' && !this.markSeen(evtId)) {
      return;
    }

    switch (event) {
      case 'presence:heartbeat': {
        const member = data.member as LivePresenceMember | undefined;
        if (member && member.peerId) {
          this.peerMap.set(member.peerId, { ...member, lastSeen: Date.now() });
          this.emitLocalPresence();
        }
        break;
      }
      case 'presence:leave': {
        const leavingId = typeof data.peerId === 'string' ? data.peerId : '';
        if (leavingId && this.peerMap.has(leavingId)) {
          this.peerMap.delete(leavingId);
          this.emitLocalPresence();
        }
        break;
      }
      case 'chat:message': {
        this.handlers.onChatMessage?.(payload as LiveChatEvent);
        break;
      }
      case 'reaction:burst': {
        this.handlers.onReaction?.(payload as LiveReactionEvent);
        break;
      }
      case 'gift:sent': {
        this.handlers.onGift?.(payload as LiveGiftEvent);
        break;
      }
      case 'broadcast:state': {
        this.handlers.onBroadcastState?.(payload as LiveBroadcastState);
        break;
      }
      case 'broadcast:ended': {
        const roomId = typeof data.roomId === 'string' ? data.roomId : '';
        const hostPeerId = typeof data.hostPeerId === 'string' ? data.hostPeerId : '';
        this.handlers.onBroadcastEnded?.(roomId, hostPeerId);
        break;
      }
      case 'cohost:request': {
        this.handlers.onCoHostRequest?.(payload as CoHostRequestEvent);
        break;
      }
      case 'cohost:decision': {
        this.handlers.onCoHostDecision?.(payload as CoHostDecisionEvent);
        break;
      }
      case 'cohost:leave': {
        const roomId = typeof data.roomId === 'string' ? data.roomId : '';
        const coHostPeerId = typeof data.coHostPeerId === 'string' ? data.coHostPeerId : '';
        this.handlers.onCoHostLeave?.(roomId, coHostPeerId);
        break;
      }
      case 'rtc:signal': {
        const sig = payload as RtcSignalPayload;
        if (sig.toPeerId === this.peerId || sig.toPeerId === '*') {
          this.handlers.onRtcSignal?.(sig);
        }
        break;
      }
      case 'speech:caption': {
        this.handlers.onSpeechCaption?.(payload as LiveSpeechCaptionEvent);
        break;
      }
      case 'broadcast:sync_request': {
        const requesterPeerId = typeof data.requesterPeerId === 'string' ? data.requesterPeerId : '';
        if (requesterPeerId && requesterPeerId !== this.peerId) {
          this.handlers.onSyncRequested?.(requesterPeerId);
        }
        break;
      }
    }
  }

  private sendRaw(event: string, payload: Record<string, unknown>) {
    if (this.disposed) return;

    if (this.mode === 'supabase' && this.supabaseChannel) {
      if (!this.supabaseSubscribed) {
        if (this.pendingOutgoing.length < 40) {
          this.pendingOutgoing.push({ event, payload });
        }
        return;
      }
      this.supabaseChannel.send({
        type: 'broadcast',
        event,
        payload,
      });
      return;
    }

    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage({ event, payload });
      } catch {
        // ignore channel closed
      }
    }

    if (typeof window !== 'undefined' && event !== 'presence:heartbeat') {
      try {
        localStorage.setItem(
          STORAGE_FALLBACK_KEY,
          JSON.stringify({ event, payload, nonce: Math.random() })
        );
      } catch {
        // ignore quota errors
      }
    }
  }

  public announcePresence() {
    const member = this.buildSelfMember();
    if (this.mode === 'supabase' && this.supabaseChannel) {
      if (this.supabaseSubscribed) {
        this.supabaseChannel.track(member).catch(() => {});
      }
    } else {
      this.peerMap.set(this.peerId, member);
      this.emitLocalPresence();
      this.sendRaw('presence:heartbeat', {
        id: createEventId('hb'),
        member,
      });
    }
  }

  public sendChatMessage(msg: LiveChatEvent) {
    this.markSeen(msg.id);
    this.sendRaw('chat:message', msg as unknown as Record<string, unknown>);
  }

  public sendReaction(reaction: LiveReactionEvent) {
    this.markSeen(reaction.id);
    this.sendRaw('reaction:burst', reaction as unknown as Record<string, unknown>);
  }

  public sendGift(gift: LiveGiftEvent) {
    this.markSeen(gift.id);
    this.sendRaw('gift:sent', gift as unknown as Record<string, unknown>);
  }

  public publishBroadcastState(state: LiveBroadcastState) {
    this.activeBroadcast = state.isLive ? state : null;
    this.announcePresence();
    this.sendRaw('broadcast:state', {
      ...(state as unknown as Record<string, unknown>),
      id: createEventId('bstate'),
    });
  }

  public endBroadcast(roomId: string) {
    this.activeBroadcast = null;
    this.announcePresence();
    this.sendRaw('broadcast:ended', {
      id: createEventId('bend'),
      roomId,
      hostPeerId: this.peerId,
    });
  }

  public sendCoHostRequest(req: CoHostRequestEvent) {
    this.markSeen(req.id);
    this.sendRaw('cohost:request', req as unknown as Record<string, unknown>);
  }

  public sendCoHostDecision(decision: CoHostDecisionEvent) {
    this.markSeen(decision.id);
    this.sendRaw('cohost:decision', decision as unknown as Record<string, unknown>);
  }

  public sendCoHostLeave(roomId: string, coHostPeerId: string) {
    this.sendRaw('cohost:leave', {
      id: createEventId('coleave'),
      roomId,
      coHostPeerId,
    });
  }

  public sendRtcSignal(signal: RtcSignalPayload) {
    this.markSeen(signal.id);
    this.sendRaw('rtc:signal', signal as unknown as Record<string, unknown>);
  }

  public sendSpeechCaption(caption: LiveSpeechCaptionEvent) {
    this.markSeen(caption.id);
    this.sendRaw('speech:caption', caption as unknown as Record<string, unknown>);
  }

  public disconnect() {
    this.disposed = true;

    if (this.heartbeatTimer !== null) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.pruneTimer !== null) {
      clearInterval(this.pruneTimer);
      this.pruneTimer = null;
    }

    if (typeof window !== 'undefined') {
      window.removeEventListener('storage', this.handleStorageFallback);
      window.removeEventListener('beforeunload', this.handleBeforeUnload);
    }

    if (this.supabaseChannel && supabase) {
      this.supabaseChannel.untrack().catch(() => {});
      supabase.removeChannel(this.supabaseChannel).catch(() => {});
      this.supabaseChannel = null;
    }

    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage({
          event: 'presence:leave',
          payload: { id: createEventId('leave'), peerId: this.peerId },
        });
        this.broadcastChannel.close();
      } catch {
        // ignore
      }
      this.broadcastChannel = null;
    }
  }
}

// ============================================================================
// Device Camera / Microphone Acquisition (Capped at 720p 30fps for 3GB RAM & Mobile Data)
// ============================================================================

export interface AcquiredMediaResult {
  stream: MediaStream;
  resolutionLabel: string;
  hasAudio: boolean;
  hasVideo: boolean;
}

export function stopMediaStream(stream: MediaStream | null | undefined) {
  if (!stream) return;
  stream.getTracks().forEach((track) => {
    try {
      track.stop();
    } catch {
      // ignore
    }
  });
}

export async function acquireLiveCameraStream(options: {
  facingMode: 'user' | 'environment';
  audioEnabled?: boolean;
}): Promise<AcquiredMediaResult> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    throw new Error('Camera & microphone access requires HTTPS or a supported modern browser.');
  }

  const { facingMode, audioEnabled = true } = options;

  const attempts: MediaStreamConstraints[] = [
    {
      video: { facingMode },
      audio: audioEnabled,
    },
    {
      video: true,
      audio: audioEnabled,
    },
    {
      video: { facingMode },
      audio: false,
    },
    {
      video: true,
      audio: false,
    },
  ];

  let stream: MediaStream | null = null;
  let lastError: unknown = null;

  for (const constraints of attempts) {
    try {
      stream = await navigator.mediaDevices.getUserMedia(constraints);
      break;
    } catch (err) {
      lastError = err;
    }
  }

  if (!stream) {
    const errName = lastError instanceof Error && lastError.name ? lastError.name : 'CameraError';
    const errMessage =
      lastError instanceof Error && lastError.message
        ? lastError.message
        : 'Unable to access device camera.';
    throw new Error(`${errName}: ${errMessage}`);
  }

  const videoTrack = stream.getVideoTracks()[0];
  if (videoTrack && typeof videoTrack.applyConstraints === 'function') {
    await videoTrack
      .applyConstraints({
        width: { ideal: 3840 },
        height: { ideal: 2160 },
      })
      .catch(() => {});
  }

  const settings = videoTrack?.getSettings?.() || {};
  const width = settings.width || 1280;
  const height = settings.height || 720;
  const fps = settings.frameRate ? Math.round(settings.frameRate) : 30;

  const resolutionLabel =
    width >= 3800 || height >= 2100
      ? `4K UHD · ${fps}fps`
      : width >= 1900 || height >= 1080
      ? `1080p HD · ${fps}fps`
      : height >= 700
      ? `720p · ${fps}fps`
      : `${height}p · ${fps}fps`;

  return {
    stream,
    resolutionLabel,
    hasAudio: stream.getAudioTracks().length > 0,
    hasVideo: stream.getVideoTracks().length > 0,
  };
}

// ============================================================================
// WebRTC Peer Mesh (Host <-> Viewers & Host <-> Co-Host)
// ============================================================================

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
  ],
  iceCandidatePoolSize: 4,
};

export class LiveWebRtcMesh {
  private selfPeerId: string;
  private roomId: string;
  private sendSignalFn: (signal: RtcSignalPayload) => void;
  private onRemoteStream: (peerId: string, stream: MediaStream) => void;
  private onPeerClosed?: (peerId: string) => void;

  private peers = new Map<string, RTCPeerConnection>();
  private remoteMediaStreams = new Map<string, MediaStream>();
  private pendingIce = new Map<string, RTCIceCandidateInit[]>();
  private localStream: MediaStream | null = null;
  private maxBitrateBps = 1_100_000;

  constructor(options: {
    selfPeerId: string;
    roomId: string;
    maxBitrateBps?: number;
    sendSignal: (signal: RtcSignalPayload) => void;
    onRemoteStream: (peerId: string, stream: MediaStream) => void;
    onPeerClosed?: (peerId: string) => void;
  }) {
    this.selfPeerId = options.selfPeerId;
    this.roomId = options.roomId;
    if (options.maxBitrateBps) this.maxBitrateBps = options.maxBitrateBps;
    this.sendSignalFn = options.sendSignal;
    this.onRemoteStream = options.onRemoteStream;
    this.onPeerClosed = options.onPeerClosed;
  }

  public setRoomId(roomId: string) {
    this.roomId = roomId;
  }

  private applySenderCap(pc: RTCPeerConnection) {
    try {
      pc.getSenders().forEach((sender) => {
        if (sender.track?.kind !== 'video') return;
        const params = sender.getParameters();
        if (!params.encodings || params.encodings.length === 0) {
          params.encodings = [{}];
        }
        params.encodings[0].maxBitrate = this.maxBitrateBps;
        params.encodings[0].maxFramerate = 30;
        sender.setParameters(params).catch(() => {});
      });
    } catch {
      // ignore if browser disallows dynamic RTCRtpSender tuning
    }
  }

  public setLocalStream(stream: MediaStream | null) {
    this.localStream = stream;
    if (!stream) return;

    const newTracks = stream.getTracks();
    this.peers.forEach((pc) => {
      const senders = pc.getSenders();
      newTracks.forEach((track) => {
        const matchingSender = senders.find((s) => s.track && s.track.kind === track.kind);
        if (matchingSender) {
          matchingSender.replaceTrack(track).catch(() => {});
        } else {
          try {
            pc.addTrack(track, stream);
          } catch {
            // ignore duplicate track
          }
        }
      });
      this.applySenderCap(pc);
    });
  }

  private getOrCreatePeer(remotePeerId: string): RTCPeerConnection {
    const existing = this.peers.get(remotePeerId);
    if (
      existing &&
      existing.signalingState !== 'closed' &&
      existing.connectionState !== 'failed' &&
      existing.connectionState !== 'closed'
    ) {
      return existing;
    }

    if (existing) {
      this.closePeer(remotePeerId);
    }

    const pc = new RTCPeerConnection(RTC_CONFIG);

    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        try {
          pc.addTrack(track, this.localStream!);
        } catch {
          // ignore
        }
      });
      this.applySenderCap(pc);
    }

    pc.onicecandidate = (evt) => {
      if (evt.candidate) {
        this.sendSignalFn({
          id: createEventId('ice'),
          roomId: this.roomId,
          fromPeerId: this.selfPeerId,
          toPeerId: remotePeerId,
          kind: 'ice',
          candidate: evt.candidate.toJSON(),
        });
      }
    };

    pc.ontrack = (evt) => {
      // Combine audio & video tracks safely into one persistent MediaStream per remote peer
      let targetStream = this.remoteMediaStreams.get(remotePeerId);
      if (!targetStream) {
        targetStream = new MediaStream();
        this.remoteMediaStreams.set(remotePeerId, targetStream);
      }
      const incoming = evt.streams?.[0];
      if (incoming) {
        incoming.getTracks().forEach((track) => {
          if (!targetStream!.getTracks().some((t) => t.id === track.id)) {
            targetStream!.addTrack(track);
          }
        });
      } else if (evt.track && !targetStream.getTracks().some((t) => t.id === evt.track.id)) {
        targetStream.addTrack(evt.track);
      }
      // Clone container reference so React state updates cleanly when second track (audio/video) arrives
      this.onRemoteStream(remotePeerId, new MediaStream(targetStream.getTracks()));
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        this.closePeer(remotePeerId);
      }
    };

    this.peers.set(remotePeerId, pc);
    return pc;
  }

  public async initiateCall(remotePeerId: string, forceRestart = false) {
    if (remotePeerId === this.selfPeerId) return;
    if (forceRestart) {
      this.closePeer(remotePeerId);
    }
    const existing = this.peers.get(remotePeerId);
    if (
      existing &&
      !forceRestart &&
      (existing.connectionState === 'connected' || existing.signalingState !== 'stable')
    ) {
      return;
    }

    const pc = this.getOrCreatePeer(remotePeerId);
    try {
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });
      await pc.setLocalDescription(offer);
      this.applySenderCap(pc);
      this.sendSignalFn({
        id: createEventId('offer'),
        roomId: this.roomId,
        fromPeerId: this.selfPeerId,
        toPeerId: remotePeerId,
        kind: 'offer',
        sdp: pc.localDescription?.toJSON() || offer,
      });
    } catch {
      // ignore transient negotiation errors
    }
  }

  public async handleSignal(signal: RtcSignalPayload) {
    if (signal.fromPeerId === this.selfPeerId) return;

    if (signal.kind === 'bye') {
      this.closePeer(signal.fromPeerId);
      return;
    }

    if (signal.kind === 'ready') {
      // A viewer or co-host announced readiness; host or co-host initiates offer
      if (this.localStream) {
        const existing = this.peers.get(signal.fromPeerId);
        const needFresh =
          !existing ||
          existing.connectionState === 'disconnected' ||
          existing.connectionState === 'failed' ||
          existing.connectionState === 'closed';
        await this.initiateCall(signal.fromPeerId, needFresh);
      }
      return;
    }

    const pc = this.getOrCreatePeer(signal.fromPeerId);

    try {
      if (signal.kind === 'offer' && signal.sdp) {
        const polite = this.selfPeerId < signal.fromPeerId;
        if (pc.signalingState !== 'stable' && !polite) {
          return;
        }
        await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
        await this.flushIce(signal.fromPeerId, pc);

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        this.applySenderCap(pc);
        this.sendSignalFn({
          id: createEventId('ans'),
          roomId: this.roomId,
          fromPeerId: this.selfPeerId,
          toPeerId: signal.fromPeerId,
          kind: 'answer',
          sdp: pc.localDescription?.toJSON() || answer,
        });
      } else if (signal.kind === 'answer' && signal.sdp) {
        if (pc.signalingState === 'have-local-offer') {
          await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
          await this.flushIce(signal.fromPeerId, pc);
        }
      } else if (signal.kind === 'ice' && signal.candidate) {
        if (pc.remoteDescription) {
          await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
        } else {
          const list = this.pendingIce.get(signal.fromPeerId) || [];
          list.push(signal.candidate);
          this.pendingIce.set(signal.fromPeerId, list);
        }
      }
    } catch {
      // ignore transient ICE/SDP mismatch
    }
  }

  private async flushIce(remotePeerId: string, pc: RTCPeerConnection) {
    const queued = this.pendingIce.get(remotePeerId);
    if (!queued || queued.length === 0) return;
    this.pendingIce.delete(remotePeerId);
    for (const candidate of queued) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch {
        // ignore stale candidates
      }
    }
  }

  public closePeer(remotePeerId: string) {
    const pc = this.peers.get(remotePeerId);
    if (pc) {
      try {
        pc.close();
      } catch {
        // ignore
      }
      this.peers.delete(remotePeerId);
    }
    this.remoteMediaStreams.delete(remotePeerId);
    this.pendingIce.delete(remotePeerId);
    this.onPeerClosed?.(remotePeerId);
  }

  public closeAll() {
    this.peers.forEach((pc) => {
      try {
        pc.close();
      } catch {
        // ignore
      }
    });
    this.peers.clear();
    this.remoteMediaStreams.clear();
    this.pendingIce.clear();
  }
}
