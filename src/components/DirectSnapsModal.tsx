import React, { useState, useMemo } from 'react';
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
  onMarkSnapViewed: (snapId: string) => void;
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

function formatMessageTime(iso: string): string {
  const diffMs = Math.max(0, Date.now() - new Date(iso).getTime());
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

export const DirectSnapsModal: React.FC<DirectSnapsModalProps> = ({
  isOpen,
  onClose,
  currentUserId,
  currentUsername,
  snaps,
  recipients,
  onMarkSnapViewed,
  onReplyWithCamera,
  onSendTextMessage,
  onShowToast,
}) => {
  const [selectedUsername, setSelectedUsername] = useState<string | null>(null);
  const [friendSearch, setFriendSearch] = useState('');
  const [textDraft, setTextDraft] = useState('');
  const [isSendingText, setIsSendingText] = useState(false);
  const [activeViewerSnap, setActiveViewerSnap] = useState<DirectSnapMessage | null>(null);

  const ownClean = normalizeCreatorUsername(currentUsername);

  const isMe = (id: string, username: string) => {
    const clean = normalizeCreatorUsername(username);
    return id === currentUserId || (Boolean(ownClean) && clean === ownClean);
  };

  // Group direct snaps & messages into friend conversations
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
      if (existing) {
        existing.messages.push(msg);
        if (isUnreadIncoming) existing.unreadCount += 1;
        if (new Date(msg.createdAt).getTime() > new Date(existing.lastMessage.createdAt).getTime()) {
          existing.lastMessage = msg;
        }
      } else {
        map.set(key, {
          partner: {
            id: partnerId,
            username: partnerUsername,
            name: partnerName || partnerUsername,
            avatar:
              partnerAvatar ||
              `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(partnerUsername)}&backgroundColor=ec4899`,
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
    const foundRecip = recipients.find(
      (r) => normalizeCreatorUsername(r.username) === key
    );
    if (!foundRecip) return null;
    return {
      partner: foundRecip,
      messages: [] as DirectSnapMessage[],
      lastMessage: null as DirectSnapMessage | null,
      unreadCount: 0,
    };
  }, [selectedUsername, conversations, recipients]);

  const filteredFriends = useMemo(() => {
    const q = friendSearch.trim().toLowerCase().replace(/^@+/, '');
    if (!q) return recipients;
    return recipients.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.username.toLowerCase().includes(q)
    );
  }, [recipients, friendSearch]);

  if (!isOpen) return null;

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
    } catch {
      onShowToast('Could not send message. Please try again.');
    } finally {
      setIsSendingText(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl h-[90vh] sm:h-[680px] bg-neutral-950 border border-neutral-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="px-4 sm:px-6 py-3.5 border-b border-neutral-800/80 bg-neutral-950 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            {activeConversation && (
              <button
                type="button"
                onClick={() => setSelectedUsername(null)}
                className="md:hidden p-1.5 rounded-xl bg-neutral-900 border border-neutral-800 text-neutral-300 hover:text-white cursor-pointer"
                aria-label="Back to chats"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            )}
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-400 via-pink-500 to-fuchsia-600 text-white flex items-center justify-center shadow-md shadow-pink-500/25">
              <Send className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-black text-white">
                Direct Chat &amp; Live Snaps
              </h2>
              <p className="text-[11px] text-neutral-400">
                Tap incoming snaps to watch live or reply with your camera
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-neutral-400 hover:text-white rounded-full hover:bg-neutral-900 cursor-pointer"
            aria-label="Close Direct Snaps"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Main 2-Column Body */}
        <div className="flex-1 flex min-h-0 overflow-hidden">
          {/* Left Column: Inbox Conversations + Friend Picker */}
          <div
            className={`${
              activeConversation ? 'hidden md:flex' : 'flex'
            } w-full md:w-80 border-r border-neutral-800/80 flex-col bg-neutral-950`}
          >
            {/* Friend search */}
            <div className="p-3 border-b border-neutral-900">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-cyan-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={friendSearch}
                  onChange={(e) => setFriendSearch(sanitizeSearchQuery(e.target.value, 120))}
                  placeholder="Search friends or @username..."
                  className="w-full bg-neutral-900 text-xs text-white placeholder-neutral-400 pl-8.5 pr-3 py-2 rounded-xl border border-neutral-800 focus:outline-hidden focus:border-pink-500"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto no-scrollbar divide-y divide-neutral-900">
              {/* Active Conversations */}
              {conversations.length > 0 && !friendSearch.trim() && (
                <div>
                  <div className="px-3.5 py-1.5 bg-neutral-900/50 text-[10px] font-black uppercase tracking-wider text-neutral-400">
                    Recent Snaps &amp; Chats
                  </div>
                  {conversations.map((conv) => {
                    const isSelected =
                      activeConversation &&
                      normalizeCreatorUsername(activeConversation.partner.username) ===
                        normalizeCreatorUsername(conv.partner.username);
                    const hasMedia = Boolean(conv.lastMessage.mediaUrl);
                    return (
                      <button
                        key={conv.partner.username}
                        type="button"
                        onClick={() => setSelectedUsername(conv.partner.username)}
                        className={`w-full px-3.5 py-2.5 flex items-center justify-between gap-2.5 text-left transition-colors cursor-pointer ${
                          isSelected ? 'bg-pink-600/15 border-l-2 border-pink-500' : 'hover:bg-neutral-900/80'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <img
                            src={optimizeThumbnailUrl(conv.partner.avatar, 'grid')}
                            alt={conv.partner.name}
                            loading="lazy"
                            decoding="async"
                            className="w-10 h-10 rounded-full object-cover bg-neutral-800 border border-pink-500/40 shrink-0"
                            referrerPolicy="no-referrer"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-1">
                              <p className="text-xs font-bold text-white truncate">
                                {conv.partner.name}
                              </p>
                              <span className="text-[10px] text-neutral-500 shrink-0">
                                {formatMessageTime(conv.lastMessage.createdAt)}
                              </span>
                            </div>
                            <p
                              className={`text-[11px] truncate mt-0.5 flex items-center gap-1 ${
                                conv.unreadCount > 0 ? 'text-pink-400 font-bold' : 'text-neutral-400'
                              }`}
                            >
                              {hasMedia ? (
                                <>
                                  <Camera className="w-3 h-3 shrink-0" />
                                  <span>
                                    {conv.unreadCount > 0
                                      ? 'New Live Snap · Tap to watch'
                                      : conv.lastMessage.mediaType === 'image'
                                      ? 'Photo Snap'
                                      : 'Video Snap'}
                                  </span>
                                </>
                              ) : (
                                conv.lastMessage.textMessage || 'Sent a message'
                              )}
                            </p>
                          </div>
                        </div>

                        {conv.unreadCount > 0 && (
                          <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-pink-600 text-white text-[10px] font-black flex items-center justify-center shrink-0">
                            {conv.unreadCount}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Friends Directory for Direct Send / New Chat */}
              <div>
                <div className="px-3.5 py-1.5 bg-neutral-900/50 text-[10px] font-black uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
                  <UserPlus className="w-3 h-3 text-cyan-400" />
                  <span>Friends &amp; Creators</span>
                </div>
                {filteredFriends.length === 0 ? (
                  <p className="p-4 text-center text-xs text-neutral-500">
                    No matching friends found.
                  </p>
                ) : (
                  filteredFriends.map((friend) => {
                    const isSelected =
                      activeConversation &&
                      normalizeCreatorUsername(activeConversation.partner.username) ===
                        normalizeCreatorUsername(friend.username);
                    return (
                      <div
                        key={friend.username}
                        className={`px-3.5 py-2.5 flex items-center justify-between gap-2.5 transition-colors ${
                          isSelected ? 'bg-pink-600/15' : 'hover:bg-neutral-900/80'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => setSelectedUsername(friend.username)}
                          className="flex items-center gap-2.5 min-w-0 flex-1 text-left cursor-pointer"
                        >
                          <img
                            src={optimizeThumbnailUrl(friend.avatar, 'grid')}
                            alt={friend.name}
                            loading="lazy"
                            decoding="async"
                            className="w-9 h-9 rounded-full object-cover bg-neutral-800 border border-neutral-700 shrink-0"
                            referrerPolicy="no-referrer"
                          />
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-white truncate">{friend.name}</p>
                            <p className="text-[10px] text-cyan-400 truncate">@{friend.username}</p>
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => onReplyWithCamera(friend)}
                          className="px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-400 via-pink-500 to-fuchsia-600 text-white text-[10px] font-black flex items-center gap-1 shrink-0 cursor-pointer active:scale-95"
                          title={`Send Live Camera Snap to @${friend.username}`}
                        >
                          <Camera className="w-3 h-3" />
                          <span>Snap</span>
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Active Conversation Thread */}
          <div
            className={`${
              activeConversation ? 'flex' : 'hidden md:flex'
            } flex-1 flex-col bg-neutral-900/30 min-w-0`}
          >
            {!activeConversation ? (
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-3">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-400/20 via-pink-500/20 to-fuchsia-600/20 border border-pink-500/30 flex items-center justify-center text-pink-400">
                  <MessageCircle className="w-8 h-8" />
                </div>
                <h3 className="text-base font-black text-white">Select a Friend to Chat or Snap</h3>
                <p className="text-xs text-neutral-400 max-w-xs">
                  Pick a conversation on the left to watch received live video snaps or reply instantly using your Pro Camera.
                </p>
              </div>
            ) : (
              <>
                {/* Thread Header */}
                <div className="px-4 py-3 border-b border-neutral-800/80 bg-neutral-950/80 flex items-center justify-between gap-2 shrink-0">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <img
                      src={optimizeThumbnailUrl(activeConversation.partner.avatar, 'grid')}
                      alt={activeConversation.partner.name}
                      loading="lazy"
                      decoding="async"
                      className="w-9 h-9 rounded-full object-cover border border-pink-500/40 shrink-0"
                      referrerPolicy="no-referrer"
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-black text-white truncate">
                        {activeConversation.partner.name}
                      </p>
                      <p className="text-[10px] text-cyan-400 truncate">
                        @{activeConversation.partner.username}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => onReplyWithCamera(activeConversation.partner)}
                    className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-400 via-pink-500 to-fuchsia-600 hover:brightness-110 text-white text-xs font-black flex items-center gap-1.5 shadow-md shadow-pink-500/25 cursor-pointer active:scale-95 shrink-0"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>Reply with Live Camera Video</span>
                  </button>
                </div>

                {/* Messages Feed */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3 no-scrollbar">
                  {activeConversation.messages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center py-8 space-y-3">
                      <Sparkles className="w-8 h-8 text-amber-400" />
                      <p className="text-xs text-neutral-300 font-semibold">
                        Start a live snap conversation with {activeConversation.partner.name}!
                      </p>
                      <button
                        type="button"
                        onClick={() => onReplyWithCamera(activeConversation.partner)}
                        className="px-4 py-2 rounded-xl bg-gradient-to-r from-pink-600 to-amber-500 text-white text-xs font-black flex items-center gap-2 cursor-pointer"
                      >
                        <Camera className="w-4 h-4" />
                        <span>Shoot Live Snap Now</span>
                      </button>
                    </div>
                  ) : (
                    activeConversation.messages.map((msg) => {
                      const sentByMe = isMe(msg.senderId, msg.senderUsername);
                      const hasMedia = Boolean(msg.mediaUrl);
                      const isUnwatchedIncoming = !sentByMe && !msg.isViewed && hasMedia;

                      return (
                        <div
                          key={msg.id}
                          className={`flex flex-col ${sentByMe ? 'items-end' : 'items-start'}`}
                        >
                          <div
                            className={`max-w-[80%] sm:max-w-xs rounded-2xl p-3 border space-y-2 ${
                              sentByMe
                                ? 'bg-pink-600/20 border-pink-500/40 text-white'
                                : 'bg-neutral-900 border-neutral-800 text-neutral-100'
                            }`}
                          >
                            {hasMedia && (
                              <button
                                type="button"
                                onClick={() => handleOpenSnapViewer(msg)}
                                className={`w-full rounded-xl p-2.5 flex items-center gap-2.5 text-left transition-all cursor-pointer active:scale-98 ${
                                  isUnwatchedIncoming
                                    ? 'bg-gradient-to-r from-amber-500 via-pink-600 to-fuchsia-600 text-white shadow-lg shadow-pink-500/30 animate-pulse'
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
                                    {msg.filterName ? `${msg.filterName} filter` : 'Pro Camera Live'}
                                  </p>
                                </div>
                                <Video className="w-4 h-4 shrink-0 opacity-80" />
                              </button>
                            )}

                            {msg.caption && (
                              <p className="text-xs text-neutral-200">{msg.caption}</p>
                            )}
                            {msg.textMessage && (
                              <p className="text-xs text-white leading-relaxed">{msg.textMessage}</p>
                            )}

                            <div className="flex items-center justify-end gap-1 text-[10px] text-neutral-400">
                              <span>{formatMessageTime(msg.createdAt)}</span>
                              {sentByMe && (
                                <CheckCheck
                                  className={`w-3 h-3 ${
                                    msg.isViewed ? 'text-cyan-400' : 'text-neutral-500'
                                  }`}
                                />
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Reply Input Bar */}
                <form
                  onSubmit={handleSendText}
                  className="p-3 border-t border-neutral-800/80 bg-neutral-950 flex items-center gap-2 shrink-0"
                >
                  <button
                    type="button"
                    onClick={() => onReplyWithCamera(activeConversation.partner)}
                    className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-400 via-pink-500 to-fuchsia-600 text-white flex items-center justify-center shrink-0 cursor-pointer active:scale-95 shadow-md"
                    title="Reply with Live Camera Video"
                    aria-label="Reply with Live Camera Video"
                  >
                    <Camera className="w-5 h-5" />
                  </button>
                  <input
                    type="text"
                    value={textDraft}
                    onChange={(e) => setTextDraft(sanitizeInputLive(e.target.value, 500))}
                    placeholder={`Message @${activeConversation.partner.username}...`}
                    className="flex-1 bg-neutral-900 text-xs text-white placeholder-neutral-500 px-3.5 py-2.5 rounded-xl border border-neutral-800 focus:outline-hidden focus:border-pink-500"
                  />
                  <button
                    type="submit"
                    disabled={!textDraft.trim() || isSendingText}
                    className="px-3.5 py-2.5 rounded-xl bg-pink-600 hover:bg-pink-500 disabled:opacity-40 text-white text-xs font-black flex items-center gap-1 cursor-pointer shrink-0"
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
                className="w-9 h-9 rounded-full bg-black/70 text-white flex items-center justify-center border border-white/15 cursor-pointer"
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
