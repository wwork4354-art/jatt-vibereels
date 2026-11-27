import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  X,
  Send,
  Camera,
  Search,
  Play,
  Sparkles,
  CheckCheck,
  ChevronLeft,
  UserPlus,
  Image as ImageIcon,
  Video,
  MessageCircle,
  Smile,
  SmilePlus,
  CheckCircle2,
} from 'lucide-react';
import { DirectSnapMessage, DirectSnapRecipient } from '../types';
import { normalizeCreatorUsername } from '../lib/supabaseService';
import { optimizeThumbnailUrl } from '../utils/imageOptimize';
import { sanitizeInputLive, sanitizeSearchQuery, sanitizeText } from '../utils/security';

interface DirectSnapsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserId: string;
  currentUsername: string;
  currentName: string;
  currentAvatar: string;
  snaps: DirectSnapMessage[];
  recipients: DirectSnapRecipient[];
  initialPartner?: DirectSnapRecipient | null;
  onMarkSnapViewed: (snapId: string) => void;
  onMarkConversationSeen?: (messageIds: string[]) => void;
  onToggleReaction?: (messageId: string, emoji: string) => void;
  onOpenCreatorProfile?: (username: string) => void;
  onReplyWithCamera: (recipient: DirectSnapRecipient) => void;
  onSendTextMessage: (recipient: DirectSnapRecipient, text: string) => Promise<void>;
  onShowToast: (msg: string) => void;
}

interface ConversationSummary {
  partner: DirectSnapRecipient;
  messages: DirectSnapMessage[];
  lastMessage: DirectSnapMessage;
  unreadCount: number;
}

const QUICK_REACTIONS = ['❤️', '😂', '🔥', '👍', '😮', '👏'] as const;
const COMPOSER_EMOJIS = ['😀', '😂', '❤️', '🔥', '😍', '🙌', '✨', '💯', '🎵', '👑', '🙏', '🥳'] as const;

function formatRelativeTime(iso: string): string {
  const diffMs = Math.max(0, Date.now() - new Date(iso).getTime());
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function formatClockTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDayLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const today = new Date();
  const yesterday = new Date(Date.now() - 86_400_000);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

export const DirectSnapsModal: React.FC<DirectSnapsModalProps> = ({
  isOpen,
  onClose,
  currentUserId,
  currentUsername,
  snaps,
  recipients,
  initialPartner = null,
  onMarkSnapViewed,
  onMarkConversationSeen,
  onToggleReaction,
  onOpenCreatorProfile,
  onReplyWithCamera,
  onSendTextMessage,
  onShowToast,
}) => {
  const [selectedUsername, setSelectedUsername] = useState<string | null>(
    initialPartner?.username || null
  );
  const [adHocPartner, setAdHocPartner] = useState<DirectSnapRecipient | null>(initialPartner);
  const [friendSearch, setFriendSearch] = useState('');
  const [textDraft, setTextDraft] = useState('');
  const [isSendingText, setIsSendingText] = useState(false);
  const [activeViewerSnap, setActiveViewerSnap] = useState<DirectSnapMessage | null>(null);
  const [openReactionMenuMsgId, setOpenReactionMenuMsgId] = useState<string | null>(null);
  const [isEmojiTrayOpen, setIsEmojiTrayOpen] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const ownClean = normalizeCreatorUsername(currentUsername);

  const isMe = (id: string, username: string) => {
    const clean = normalizeCreatorUsername(username);
    return id === currentUserId || (Boolean(ownClean) && clean === ownClean);
  };

  // Sync initialPartner whenever opened with a target user from profile or feed
  useEffect(() => {
    if (!isOpen) {
      setOpenReactionMenuMsgId(null);
      setIsEmojiTrayOpen(false);
      return;
    }
    if (initialPartner?.username) {
      setAdHocPartner(initialPartner);
      setSelectedUsername(initialPartner.username);
    }
  }, [isOpen, initialPartner]);

  // Group direct messages & snaps into conversations
  const conversations = useMemo<ConversationSummary[]>(() => {
    const map = new Map<string, ConversationSummary>();

    for (const msg of snaps) {
      const sentByMe = isMe(msg.senderId, msg.senderUsername);
      const partnerId = sentByMe ? msg.recipientId : msg.senderId;
      const partnerUsername = sentByMe ? msg.recipientUsername : msg.senderUsername;
      const partnerName = sentByMe ? msg.recipientName : msg.senderName;
      const partnerAvatar = sentByMe ? msg.recipientAvatar : msg.senderAvatar;

      const key = normalizeCreatorUsername(partnerUsername) || partnerId;
      if (!key) continue;

      const isUnreadIncoming = !sentByMe && !msg.isViewed;
      const existing = map.get(key);
      const fallbackAvatar = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(
        partnerUsername || 'user'
      )}&backgroundColor=ec4899`;

      if (existing) {
        existing.messages.push(msg);
        if (isUnreadIncoming) existing.unreadCount += 1;
        if (new Date(msg.createdAt).getTime() > new Date(existing.lastMessage.createdAt).getTime()) {
          existing.lastMessage = msg;
        }
        if (!existing.partner.avatar && partnerAvatar) {
          existing.partner.avatar = partnerAvatar;
        }
      } else {
        map.set(key, {
          partner: {
            id: partnerId,
            username: partnerUsername,
            name: partnerName || partnerUsername,
            avatar: partnerAvatar || fallbackAvatar,
          },
          messages: [msg],
          lastMessage: msg,
          unreadCount: isUnreadIncoming ? 1 : 0,
        });
      }
    }

    return Array.from(map.values()).sort(
      (a, b) =>
        new Date(b.lastMessage.createdAt).getTime() - new Date(a.lastMessage.createdAt).getTime()
    );
  }, [snaps, currentUserId, ownClean]);

  const totalUnreadMessages = useMemo(
    () => conversations.reduce((sum, c) => sum + c.unreadCount, 0),
    [conversations]
  );

  // Merge recipients + conversation partners + adHocPartner for complete user search
  const allSearchableUsers = useMemo<DirectSnapRecipient[]>(() => {
    const map = new Map<string, DirectSnapRecipient>();
    const addCandidate = (r?: DirectSnapRecipient | null) => {
      if (!r?.username) return;
      const clean = normalizeCreatorUsername(r.username);
      if (!clean || clean === ownClean) return;
      if (!map.has(clean)) {
        map.set(clean, r);
      }
    };
    addCandidate(adHocPartner);
    for (const r of recipients) addCandidate(r);
    for (const c of conversations) addCandidate(c.partner);
    return Array.from(map.values());
  }, [adHocPartner, recipients, conversations, ownClean]);

  const activeConversation = useMemo(() => {
    if (!selectedUsername) return null;
    const key = normalizeCreatorUsername(selectedUsername);
    const foundConv = conversations.find(
      (c) => normalizeCreatorUsername(c.partner.username) === key
    );
    if (foundConv) {
      return {
        ...foundConv,
        messages: [...foundConv.messages].sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        ),
      };
    }
    const foundRecip = allSearchableUsers.find(
      (r) => normalizeCreatorUsername(r.username) === key
    );
    if (!foundRecip) return null;
    return {
      partner: foundRecip,
      messages: [] as DirectSnapMessage[],
      lastMessage: null as DirectSnapMessage | null,
      unreadCount: 0,
    };
  }, [selectedUsername, conversations, allSearchableUsers]);

  // Automatically mark unread text messages in the currently open thread as Seen
  useEffect(() => {
    if (!isOpen || !activeConversation) return;
    const unreadIncomingIds = activeConversation.messages
      .filter((msg) => !isMe(msg.senderId, msg.senderUsername) && !msg.isViewed && !msg.mediaUrl)
      .map((msg) => msg.id);

    if (unreadIncomingIds.length > 0) {
      onMarkConversationSeen?.(unreadIncomingIds);
    }
  }, [isOpen, activeConversation, onMarkConversationSeen]);

  // Smooth scroll to latest message whenever thread changes or new message arrives
  useEffect(() => {
    if (!isOpen || !activeConversation) return;
    const timer = window.setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, 60);
    return () => window.clearTimeout(timer);
  }, [isOpen, activeConversation?.partner.username, activeConversation?.messages.length]);

  const filteredDirectory = useMemo(() => {
    const q = friendSearch.trim().toLowerCase().replace(/^@+/, '');
    if (!q) return allSearchableUsers;
    return allSearchableUsers.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.username.toLowerCase().includes(q)
    );
  }, [allSearchableUsers, friendSearch]);

  if (!isOpen) return null;

  const handleSelectPartner = (partner: DirectSnapRecipient) => {
    setAdHocPartner(partner);
    setSelectedUsername(partner.username);
    setOpenReactionMenuMsgId(null);
    window.setTimeout(() => inputRef.current?.focus(), 80);
  };

  const handleOpenSnapViewer = (snap: DirectSnapMessage) => {
    setActiveViewerSnap(snap);
    if (!isMe(snap.senderId, snap.senderUsername) && !snap.isViewed) {
      onMarkSnapViewed(snap.id);
    }
  };

  const handleSendText = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanText = sanitizeText(textDraft, 500);
    if (!activeConversation || !cleanText || isSendingText) return;
    setIsSendingText(true);
    try {
      await onSendTextMessage(activeConversation.partner, cleanText);
      setTextDraft('');
      setIsEmojiTrayOpen(false);
    } catch {
      onShowToast('Could not send message. Please try again.');
    } finally {
      setIsSendingText(false);
    }
  };

  const handleReactionClick = (msgId: string, emoji: string) => {
    setOpenReactionMenuMsgId(null);
    onToggleReaction?.(msgId, emoji);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-5xl h-[100dvh] sm:h-[700px] bg-neutral-950 border-0 sm:border sm:border-neutral-800 rounded-none sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Modal Header */}
        <div className="px-4 sm:px-6 py-3 border-b border-neutral-800/80 bg-neutral-950 flex items-center justify-between gap-3 shrink-0 pt-[max(0.75rem,env(safe-area-inset-top))] sm:pt-3.5">
          <div className="flex items-center gap-3 min-w-0">
            {activeConversation && (
              <button
                type="button"
                onClick={() => setSelectedUsername(null)}
                className="md:hidden min-w-[44px] min-h-[44px] rounded-xl bg-neutral-900 border border-neutral-800 text-neutral-200 hover:text-white flex items-center justify-center cursor-pointer shrink-0"
                aria-label="Back to messages inbox"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-pink-600 via-rose-500 to-cyan-500 text-white flex items-center justify-center shadow-md shadow-pink-500/25 shrink-0">
              <Send className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-black text-white truncate">
                Messages / Inbox
              </h2>
              <p className="text-[11px] text-neutral-400 truncate tabular-nums">
                {totalUnreadMessages > 0
                  ? `${totalUnreadMessages} unread · Direct chats & live snaps`
                  : 'Direct chats, emoji reactions & live snaps'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="min-w-[44px] min-h-[44px] text-neutral-400 hover:text-white rounded-full hover:bg-neutral-900 flex items-center justify-center cursor-pointer shrink-0"
            aria-label="Close Messages"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Main 2-Column Inbox + Chat Layout */}
        <div className="flex-1 flex min-h-0 overflow-hidden">
          {/* Left Column: Conversations Inbox + Registered User Search */}
          <div
            className={`${
              activeConversation ? 'hidden md:flex' : 'flex'
            } w-full md:w-80 lg:w-88 border-r border-neutral-800/80 flex-col bg-neutral-950 min-h-0`}
          >
            {/* User Search Input */}
            <div className="p-3 border-b border-neutral-900 shrink-0">
              <div className="relative">
                <Search className="w-4 h-4 text-cyan-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={friendSearch}
                  onChange={(e) => setFriendSearch(sanitizeSearchQuery(e.target.value, 120))}
                  placeholder="Search user by name or @username..."
                  className="w-full min-h-[44px] bg-neutral-900 text-xs text-white placeholder-neutral-400 pl-9 pr-9 py-2 rounded-xl border border-neutral-800 focus:outline-hidden focus:border-pink-500"
                />
                {friendSearch && (
                  <button
                    type="button"
                    onClick={() => setFriendSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-neutral-400 hover:text-white cursor-pointer"
                    aria-label="Clear user search"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto no-scrollbar divide-y divide-neutral-900/80">
              {/* Recent Conversations */}
              {conversations.length > 0 && !friendSearch.trim() && (
                <div>
                  <div className="px-4 py-2 bg-neutral-900/40 text-[11px] font-bold text-neutral-400 flex items-center justify-between">
                    <span>Recent Conversations</span>
                    <span className="tabular-nums text-neutral-500">{conversations.length}</span>
                  </div>
                  {conversations.map((conv) => {
                    const isSelected =
                      activeConversation &&
                      normalizeCreatorUsername(activeConversation.partner.username) ===
                        normalizeCreatorUsername(conv.partner.username);
                    const hasMedia = Boolean(conv.lastMessage.mediaUrl);
                    const lastSentByMe = isMe(
                      conv.lastMessage.senderId,
                      conv.lastMessage.senderUsername
                    );

                    return (
                      <button
                        key={conv.partner.username}
                        type="button"
                        onClick={() => handleSelectPartner(conv.partner)}
                        className={`w-full min-h-[64px] px-4 py-3 flex items-center justify-between gap-3 text-left transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-pink-500/12 border-y border-pink-500/25'
                            : 'hover:bg-neutral-900/75'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <img
                            src={optimizeThumbnailUrl(conv.partner.avatar, 'grid')}
                            alt={conv.partner.name}
                            loading="lazy"
                            decoding="async"
                            className="w-11 h-11 rounded-full object-cover bg-neutral-800 border border-neutral-700 shrink-0"
                            referrerPolicy="no-referrer"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1 min-w-0">
                                <p className="text-xs sm:text-sm font-bold text-white truncate">
                                  {conv.partner.name}
                                </p>
                                {conv.partner.isVerified && (
                                  <CheckCircle2 className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                                )}
                              </div>
                              <span className="text-[10px] text-neutral-500 shrink-0 tabular-nums">
                                {formatRelativeTime(conv.lastMessage.createdAt)}
                              </span>
                            </div>

                            <p className="text-[10px] text-cyan-400 truncate">
                              @{conv.partner.username}
                            </p>

                            <p
                              className={`text-[11px] truncate mt-0.5 flex items-center gap-1 ${
                                conv.unreadCount > 0 ? 'text-pink-300 font-bold' : 'text-neutral-400'
                              }`}
                            >
                              {hasMedia ? (
                                <>
                                  <Camera className="w-3 h-3 shrink-0 text-pink-400" />
                                  <span className="truncate">
                                    {conv.unreadCount > 0
                                      ? 'New Live Snap · Tap to watch'
                                      : conv.lastMessage.mediaType === 'image'
                                      ? 'Photo Snap'
                                      : 'Video Snap'}
                                  </span>
                                </>
                              ) : (
                                <span className="truncate">
                                  {lastSentByMe ? 'You: ' : ''}
                                  {conv.lastMessage.textMessage || 'Sent a message'}
                                </span>
                              )}
                            </p>
                          </div>
                        </div>

                        {conv.unreadCount > 0 && (
                          <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-pink-600 text-white text-[10px] font-black flex items-center justify-center shrink-0 tabular-nums">
                            {conv.unreadCount}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Registered Users & Creators Directory */}
              <div>
                <div className="px-4 py-2 bg-neutral-900/40 text-[11px] font-bold text-neutral-400 flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5">
                    <UserPlus className="w-3.5 h-3.5 text-cyan-400" />
                    <span>
                      {friendSearch.trim() ? 'Matching Users' : 'Start New Chat'}
                    </span>
                  </span>
                  <span className="tabular-nums text-neutral-500">{filteredDirectory.length}</span>
                </div>

                {filteredDirectory.length === 0 ? (
                  <p className="p-6 text-center text-xs text-neutral-500">
                    No registered users matched &ldquo;{friendSearch}&rdquo;.
                  </p>
                ) : (
                  filteredDirectory.map((person) => {
                    const isSelected =
                      activeConversation &&
                      normalizeCreatorUsername(activeConversation.partner.username) ===
                        normalizeCreatorUsername(person.username);
                    return (
                      <div
                        key={person.username}
                        className={`min-h-[60px] px-4 py-2.5 flex items-center justify-between gap-2.5 transition-colors ${
                          isSelected ? 'bg-pink-500/12' : 'hover:bg-neutral-900/75'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => handleSelectPartner(person)}
                          className="flex items-center gap-3 min-w-0 flex-1 text-left cursor-pointer min-h-[44px]"
                        >
                          <img
                            src={optimizeThumbnailUrl(person.avatar, 'grid')}
                            alt={person.name}
                            loading="lazy"
                            decoding="async"
                            className="w-10 h-10 rounded-full object-cover bg-neutral-800 border border-neutral-700 shrink-0"
                            referrerPolicy="no-referrer"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1">
                              <p className="text-xs font-bold text-white truncate">{person.name}</p>
                              {person.isVerified && (
                                <CheckCircle2 className="w-3 h-3 text-sky-400 shrink-0" />
                              )}
                            </div>
                            <p className="text-[11px] text-cyan-400 truncate">
                              @{person.username}
                            </p>
                          </div>
                        </button>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleSelectPartner(person)}
                            className="min-h-[36px] px-3 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-neutral-100 text-[11px] font-bold flex items-center gap-1 cursor-pointer whitespace-nowrap"
                          >
                            <MessageCircle className="w-3 h-3 text-cyan-400" />
                            <span>Chat</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => onReplyWithCamera(person)}
                            className="min-h-[36px] px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-pink-600 to-rose-600 hover:brightness-110 text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer whitespace-nowrap"
                            title={`Send Live Camera Snap to @${person.username}`}
                          >
                            <Camera className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Active Chat Thread */}
          <div
            className={`${
              activeConversation ? 'flex' : 'hidden md:flex'
            } flex-1 flex-col bg-neutral-900/25 min-w-0 min-h-0`}
          >
            {!activeConversation ? (
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-3">
                <div className="w-16 h-16 rounded-2xl bg-neutral-900 border border-neutral-800 flex items-center justify-center text-pink-400">
                  <MessageCircle className="w-8 h-8" />
                </div>
                <h3 className="text-base font-black text-white">Your Direct Messages</h3>
                <p className="text-xs text-neutral-400 max-w-xs leading-relaxed">
                  Select a conversation or search any registered user by name or @username to start chatting.
                </p>
              </div>
            ) : (
              <>
                {/* Thread Header */}
                <div className="px-4 py-3 border-b border-neutral-800/80 bg-neutral-950/90 flex items-center justify-between gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      if (onOpenCreatorProfile) {
                        onClose();
                        onOpenCreatorProfile(activeConversation.partner.username);
                      }
                    }}
                    className="flex items-center gap-2.5 min-w-0 text-left group cursor-pointer"
                    title="View profile"
                  >
                    <img
                      src={optimizeThumbnailUrl(activeConversation.partner.avatar, 'grid')}
                      alt={activeConversation.partner.name}
                      loading="lazy"
                      decoding="async"
                      className="w-10 h-10 rounded-full object-cover border border-pink-500/40 shrink-0"
                      referrerPolicy="no-referrer"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1">
                        <p className="text-xs sm:text-sm font-black text-white truncate group-hover:text-pink-400 transition-colors">
                          {activeConversation.partner.name}
                        </p>
                        {activeConversation.partner.isVerified && (
                          <CheckCircle2 className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                        )}
                      </div>
                      <p className="text-[11px] text-cyan-400 truncate">
                        @{activeConversation.partner.username}
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => onReplyWithCamera(activeConversation.partner)}
                    className="min-h-[40px] px-3 py-1.5 rounded-xl bg-gradient-to-r from-pink-600 via-rose-500 to-amber-500 hover:brightness-110 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-pink-500/20 cursor-pointer active:scale-95 shrink-0 whitespace-nowrap"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Live Snap</span>
                  </button>
                </div>

                {/* Messages Feed */}
                <div
                  className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 no-scrollbar"
                  onClick={() => setOpenReactionMenuMsgId(null)}
                >
                  {activeConversation.messages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center py-8 space-y-3">
                      <img
                        src={optimizeThumbnailUrl(activeConversation.partner.avatar, 'grid')}
                        alt={activeConversation.partner.name}
                        loading="lazy"
                        decoding="async"
                        className="w-16 h-16 rounded-full object-cover border-2 border-pink-500/40"
                        referrerPolicy="no-referrer"
                      />
                      <div className="space-y-1">
                        <p className="text-sm font-black text-white">
                          {activeConversation.partner.name}
                        </p>
                        <p className="text-xs text-neutral-400">
                          Say hello to @{activeConversation.partner.username} to start your chat.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => inputRef.current?.focus()}
                        className="min-h-[40px] px-4 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-pink-400" />
                        <span>Write a message</span>
                      </button>
                    </div>
                  ) : (
                    activeConversation.messages.map((msg, idx) => {
                      const sentByMe = isMe(msg.senderId, msg.senderUsername);
                      const hasMedia = Boolean(msg.mediaUrl);
                      const isUnwatchedIncoming = !sentByMe && !msg.isViewed && hasMedia;
                      const prevMsg = idx > 0 ? activeConversation.messages[idx - 1] : null;
                      const showDayHeader =
                        !prevMsg ||
                        formatDayLabel(prevMsg.createdAt) !== formatDayLabel(msg.createdAt);

                      const reactionsEntries = msg.reactions
                        ? Object.entries(msg.reactions).filter(([, list]) => list.length > 0)
                        : [];

                      return (
                        <React.Fragment key={msg.id}>
                          {showDayHeader && (
                            <div className="flex justify-center py-1">
                              <span className="text-[10px] font-semibold text-neutral-500">
                                {formatDayLabel(msg.createdAt)}
                              </span>
                            </div>
                          )}

                          <div
                            className={`flex flex-col ${sentByMe ? 'items-end' : 'items-start'}`}
                          >
                            <div
                              className={`flex items-end gap-1.5 max-w-[85%] sm:max-w-sm ${
                                sentByMe ? 'flex-row-reverse' : 'flex-row'
                              }`}
                            >
                              {!sentByMe && (
                                <img
                                  src={optimizeThumbnailUrl(activeConversation.partner.avatar, 'grid')}
                                  alt={activeConversation.partner.name}
                                  loading="lazy"
                                  decoding="async"
                                  className="w-6 h-6 rounded-full object-cover shrink-0 mb-1 border border-neutral-800"
                                  referrerPolicy="no-referrer"
                                />
                              )}

                              <div className="relative group">
                                <div
                                  className={`rounded-2xl px-3.5 py-2.5 border space-y-2 ${
                                    sentByMe
                                      ? 'bg-gradient-to-br from-pink-600/25 via-rose-600/20 to-purple-600/25 border-pink-500/40 text-white rounded-br-sm'
                                      : 'bg-neutral-900 border-neutral-800 text-neutral-100 rounded-bl-sm'
                                  }`}
                                >
                                  {hasMedia && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleOpenSnapViewer(msg);
                                      }}
                                      className={`w-full rounded-xl p-2.5 flex items-center gap-2.5 text-left transition-all cursor-pointer active:scale-98 ${
                                        isUnwatchedIncoming
                                          ? 'bg-gradient-to-r from-amber-500 via-pink-600 to-fuchsia-600 text-white shadow-lg shadow-pink-500/30'
                                          : 'bg-neutral-950/90 hover:bg-neutral-800 border border-neutral-700/80 text-white'
                                      }`}
                                    >
                                      <div className="w-9 h-9 rounded-lg bg-black/40 flex items-center justify-center shrink-0">
                                        {msg.mediaType === 'image' ? (
                                          <ImageIcon className="w-4 h-4 text-cyan-300" />
                                        ) : (
                                          <Play className="w-4 h-4 fill-white text-white" />
                                        )}
                                      </div>
                                      <div className="min-w-0 flex-1">
                                        <p className="text-xs font-black truncate">
                                          {isUnwatchedIncoming
                                            ? 'Tap to Watch Live Snap'
                                            : msg.mediaType === 'image'
                                            ? 'Photo Snap · Tap to view'
                                            : 'Live Video Snap · Tap to watch'}
                                        </p>
                                        <p className="text-[10px] text-white/80 truncate">
                                          {msg.filterName
                                            ? `${msg.filterName} filter`
                                            : 'Pro Camera Live'}
                                        </p>
                                      </div>
                                      <Video className="w-4 h-4 shrink-0 opacity-80" />
                                    </button>
                                  )}

                                  {msg.caption && (
                                    <p className="text-xs text-neutral-200">{msg.caption}</p>
                                  )}
                                  {msg.textMessage && (
                                    <p className="text-xs sm:text-[13px] text-white leading-relaxed break-words">
                                      {msg.textMessage}
                                    </p>
                                  )}

                                  <div className="flex items-center justify-end gap-1.5 text-[10px] text-neutral-400 tabular-nums">
                                    <span>{formatClockTime(msg.createdAt)}</span>
                                    {sentByMe && (
                                      <span className="inline-flex items-center gap-0.5">
                                        <CheckCheck
                                          className={`w-3.5 h-3.5 ${
                                            msg.isViewed ? 'text-cyan-400' : 'text-neutral-500'
                                          }`}
                                        />
                                        <span
                                          className={
                                            msg.isViewed ? 'text-cyan-300 font-semibold' : 'text-neutral-500'
                                          }
                                        >
                                          {msg.isViewed ? 'Seen' : 'Delivered'}
                                        </span>
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* Floating Emoji Reaction Picker Popover */}
                                {openReactionMenuMsgId === msg.id && (
                                  <div
                                    onClick={(e) => e.stopPropagation()}
                                    className={`absolute -top-11 z-30 flex items-center gap-1 px-2 py-1 rounded-full bg-neutral-950 border border-neutral-700 shadow-2xl ${
                                      sentByMe ? 'right-0' : 'left-0'
                                    }`}
                                  >
                                    {QUICK_REACTIONS.map((emoji) => (
                                      <button
                                        key={emoji}
                                        type="button"
                                        onClick={() => handleReactionClick(msg.id, emoji)}
                                        className="w-7 h-7 rounded-full hover:bg-neutral-800 text-sm flex items-center justify-center transition-transform hover:scale-125 cursor-pointer"
                                      >
                                        {emoji}
                                      </button>
                                    ))}
                                  </div>
                                )}

                                {/* Existing Emoji Reactions Summary */}
                                {reactionsEntries.length > 0 && (
                                  <div
                                    className={`flex flex-wrap gap-1 mt-1 ${
                                      sentByMe ? 'justify-end' : 'justify-start'
                                    }`}
                                  >
                                    {reactionsEntries.map(([emoji, usersList]) => {
                                      const didReact = usersList.some(
                                        (u) => normalizeCreatorUsername(u) === ownClean
                                      );
                                      return (
                                        <button
                                          key={emoji}
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleReactionClick(msg.id, emoji);
                                          }}
                                          className={`px-2 py-0.5 rounded-full text-[11px] flex items-center gap-1 border cursor-pointer tabular-nums ${
                                            didReact
                                              ? 'bg-pink-500/20 border-pink-400/50 text-pink-200'
                                              : 'bg-neutral-900 border-neutral-800 text-neutral-300'
                                          }`}
                                        >
                                          <span>{emoji}</span>
                                          {usersList.length > 1 && <span>{usersList.length}</span>}
                                        </button>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>

                              {/* React Button Trigger */}
                              {onToggleReaction && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setOpenReactionMenuMsgId((prev) =>
                                      prev === msg.id ? null : msg.id
                                    );
                                  }}
                                  className="min-w-[32px] min-h-[32px] rounded-full text-neutral-500 hover:text-pink-300 hover:bg-neutral-900 flex items-center justify-center transition-colors cursor-pointer shrink-0 mb-1"
                                  title="React with emoji"
                                  aria-label="React to message"
                                >
                                  <SmilePlus className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </div>
                        </React.Fragment>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Quick Emoji Tray */}
                {isEmojiTrayOpen && (
                  <div className="px-3 py-2 border-t border-neutral-800/80 bg-neutral-950 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
                    {COMPOSER_EMOJIS.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => {
                          setTextDraft((prev) => sanitizeInputLive(`${prev}${emoji}`, 500));
                          inputRef.current?.focus();
                        }}
                        className="min-w-[36px] min-h-[36px] rounded-xl bg-neutral-900 hover:bg-neutral-800 text-base flex items-center justify-center cursor-pointer active:scale-95 shrink-0"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}

                {/* Reply Input Bar */}
                <form
                  onSubmit={handleSendText}
                  className="p-3 border-t border-neutral-800/80 bg-neutral-950 flex items-center gap-2 shrink-0 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:pb-3"
                >
                  <button
                    type="button"
                    onClick={() => onReplyWithCamera(activeConversation.partner)}
                    className="min-w-[44px] min-h-[44px] rounded-xl bg-gradient-to-tr from-pink-600 via-rose-500 to-amber-500 text-white flex items-center justify-center shrink-0 cursor-pointer active:scale-95 shadow-md"
                    title="Send Live Camera Snap"
                    aria-label="Send Live Camera Snap"
                  >
                    <Camera className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEmojiTrayOpen((prev) => !prev)}
                    className={`min-w-[44px] min-h-[44px] rounded-xl border flex items-center justify-center shrink-0 cursor-pointer transition-colors ${
                      isEmojiTrayOpen
                        ? 'bg-pink-500/20 border-pink-500/50 text-pink-300'
                        : 'bg-neutral-900 border-neutral-800 text-neutral-300 hover:text-white'
                    }`}
                    title="Insert Emoji"
                    aria-label="Insert Emoji"
                  >
                    <Smile className="w-5 h-5" />
                  </button>
                  <input
                    ref={inputRef}
                    type="text"
                    value={textDraft}
                    onChange={(e) => setTextDraft(sanitizeInputLive(e.target.value, 500))}
                    placeholder={`Message @${activeConversation.partner.username}...`}
                    className="flex-1 min-h-[44px] bg-neutral-900 text-xs sm:text-sm text-white placeholder-neutral-500 px-3.5 py-2.5 rounded-xl border border-neutral-800 focus:outline-hidden focus:border-pink-500"
                  />
                  <button
                    type="submit"
                    disabled={!textDraft.trim() || isSendingText}
                    className="min-h-[44px] px-4 py-2.5 rounded-xl bg-pink-600 hover:bg-pink-500 disabled:opacity-40 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer shrink-0 whitespace-nowrap"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Send</span>
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Inline Fullscreen Live Snap Media Viewer */}
      {activeViewerSnap && (
        <div
          className="fixed inset-0 z-60 bg-black/95 flex items-center justify-center p-3"
          onClick={() => setActiveViewerSnap(null)}
        >
          <div
            className="relative w-full max-w-md h-[85vh] rounded-3xl overflow-hidden bg-black border border-pink-500/40 flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="absolute top-3 left-3 right-3 z-20 flex items-center justify-between">
              <div className="flex items-center gap-2 bg-black/70 px-3 py-1.5 rounded-full border border-white/15">
                <img
                  src={activeViewerSnap.senderAvatar}
                  alt={activeViewerSnap.senderName}
                  loading="lazy"
                  decoding="async"
                  className="w-6 h-6 rounded-full object-cover"
                  referrerPolicy="no-referrer"
                />
                <span className="text-xs font-bold text-white">
                  @{activeViewerSnap.senderUsername}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setActiveViewerSnap(null)}
                className="w-10 h-10 rounded-full bg-black/70 text-white flex items-center justify-center border border-white/15 cursor-pointer"
                aria-label="Close snap viewer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {activeViewerSnap.mediaType === 'image' ? (
              <img
                src={activeViewerSnap.mediaUrl}
                alt="Live Snap"
                loading="lazy"
                decoding="async"
                className="w-full h-full object-cover"
              />
            ) : (
              <video
                src={activeViewerSnap.mediaUrl}
                autoPlay
                controls
                playsInline
                className="w-full h-full object-cover"
              />
            )}

            <div className="p-4 bg-neutral-950 border-t border-neutral-800 flex items-center justify-between gap-2">
              <p className="text-xs text-neutral-300 truncate">
                {activeViewerSnap.caption || 'Live Camera Snap'}
              </p>
              {activeConversation && (
                <button
                  type="button"
                  onClick={() => {
                    setActiveViewerSnap(null);
                    onReplyWithCamera(activeConversation.partner);
                  }}
                  className="px-3 py-2 rounded-xl bg-gradient-to-r from-amber-400 via-pink-500 to-fuchsia-600 text-white text-xs font-black flex items-center gap-1.5 shrink-0 cursor-pointer"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>Reply Live</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
