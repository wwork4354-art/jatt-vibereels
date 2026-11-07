import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Radio,
  Users,
  Heart,
  Send,
  Gift,
  Mic,
  MicOff,
  Camera,
  Maximize2,
  Minimize2,
  Sparkles,
  Trophy,
  Swords,
  Volume2,
  Smile,
  Shield,
  CheckCircle,
} from 'lucide-react';
import { UserAccount } from '../types';
import { soundEngine } from '../utils/soundEngine';

interface LiveStreamModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserAccount | null;
  onShowToast: (msg: string) => void;
}

interface LiveChatMessage {
  id: string;
  user: string;
  username: string;
  avatar: string;
  text: string;
  isHost?: boolean;
  isGift?: boolean;
  giftIcon?: string;
  giftName?: string;
  badge?: string;
}

interface FloatingHeartItem {
  id: number;
  x: number;
  color: string;
  size: number;
}

interface ActiveGiftBanner {
  id: number;
  sender: string;
  giftName: string;
  giftIcon: string;
  diamonds: number;
}

const GIFTS_CATALOG = [
  { id: 'g-rose', name: 'Rose', icon: '🌹', diamonds: 1, color: 'from-rose-500 to-pink-500' },
  { id: 'g-heart', name: 'Neon Heart', icon: '💖', diamonds: 10, color: 'from-pink-500 to-purple-500' },
  { id: 'g-rocket', name: 'Cosmic Rocket', icon: '🚀', diamonds: 100, color: 'from-cyan-500 to-blue-500' },
  { id: 'g-galaxy', name: 'Galaxy Portal', icon: '🌌', diamonds: 500, color: 'from-purple-500 to-indigo-600' },
  { id: 'g-crown', name: 'Jatt Royal Crown', icon: '👑', diamonds: 1000, color: 'from-amber-400 to-yellow-500' },
  { id: 'g-lion', name: 'Golden Lion', icon: '🦁', diamonds: 5000, color: 'from-yellow-400 to-amber-600' },
];

const INITIAL_MESSAGES: LiveChatMessage[] = [
  {
    id: 'm-1',
    user: 'Amrit Singh',
    username: 'amrit_s',
    avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=Amrit&backgroundColor=ec4899',
    text: 'Jatt VibeReels stream is lit tonight! 🔥🔥',
    badge: 'VIP',
  },
  {
    id: 'm-2',
    user: 'Sarah Jenkins',
    username: 'sarah_j',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=SarahJ',
    text: 'Love the split screen guest vibe! Greetings from Toronto 🇨🇦',
  },
  {
    id: 'm-3',
    user: 'Kenji Takahashi',
    username: 'neon_shibuya',
    avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=Kenji&backgroundColor=ec4899',
    text: 'Audio levels sound crystal clear bro! 🎧',
    badge: 'Creator',
  },
];

const SIMULATED_STREAM_COMMENTS = [
  { user: 'Vikram Dhillon', text: 'Boom! Jatt squad in the house 💥', badge: 'Top Fan' },
  { user: 'Maya Patel', text: 'Can you show the camera setup? ✨' },
  { user: 'Alex Rivera', text: 'This PK battle is intense!! Drop diamonds! 💎' },
  { user: 'Elena Rostova', text: 'Greetings from Berlin! Amazing energy 👏' },
  { user: 'David O\'Connor', text: 'Sent you roses! Keep crushing it 🌹' },
  { user: 'Liam Zhang', text: 'Best stream on the app hands down 💯' },
  { user: 'Chloe Monet', text: 'The guest is hilarious haha 😂' },
  { user: 'Spike Neon', text: 'Let’s hit 20k viewers tonight!! 🚀' },
];

export const LiveStreamModal: React.FC<LiveStreamModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onShowToast,
}) => {
  const [isSplitScreen, setIsSplitScreen] = useState(true);
  const [isPkBattle, setIsPkBattle] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [viewersCount, setViewersCount] = useState(14820);
  const [diamondsCount, setDiamondsCount] = useState(8940);
  const [pkScoreHost, setPkScoreHost] = useState(64);
  const [pkScoreGuest, setPkScoreGuest] = useState(36);
  const [streamSeconds, setStreamSeconds] = useState(142);
  const [isGiftTrayOpen, setIsGiftTrayOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<LiveChatMessage[]>(INITIAL_MESSAGES);
  const [inputText, setInputText] = useState('');
  const [floatingHearts, setFloatingHearts] = useState<FloatingHeartItem[]>([]);
  const [activeGiftBanner, setActiveGiftBanner] = useState<ActiveGiftBanner | null>(null);
  const [isEndingStream, setIsEndingStream] = useState(false);

  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  // Play fanfare when entering live stream
  useEffect(() => {
    if (isOpen) {
      soundEngine.playLiveStartSound();
      setIsEndingStream(false);
    }
  }, [isOpen]);

  // Stream duration ticker & fluctuating viewer counter
  useEffect(() => {
    if (!isOpen || isEndingStream) return;

    const interval = setInterval(() => {
      setStreamSeconds((s) => s + 1);
      // Fluctuate viewers slightly (+5 to -3)
      setViewersCount((v) => Math.max(1000, v + Math.floor(Math.random() * 9) - 3));
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen, isEndingStream]);

  // Auto-streaming simulated viewer comments
  useEffect(() => {
    if (!isOpen || isEndingStream) return;

    const commentInterval = setInterval(() => {
      const sample = SIMULATED_STREAM_COMMENTS[Math.floor(Math.random() * SIMULATED_STREAM_COMMENTS.length)];
      const newMsg: LiveChatMessage = {
        id: `msg-${Date.now()}-${Math.random()}`,
        user: sample.user,
        username: sample.user.toLowerCase().replace(/\s+/g, '_'),
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(sample.user)}`,
        text: sample.text,
        badge: sample.badge,
      };

      setChatMessages((prev) => [...prev.slice(-30), newMsg]);

      // Occasionally auto-spawn floating hearts from viewers
      if (Math.random() > 0.4) {
        spawnFloatingHeart();
      }
    }, 2800);

    return () => clearInterval(commentInterval);
  }, [isOpen, isEndingStream]);

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages]);

  if (!isOpen) return null;

  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const spawnFloatingHeart = (colorOverride?: string) => {
    const colors = ['#ec4899', '#f43f5e', '#a855f7', '#06b6d4', '#eab308'];
    const chosenColor = colorOverride || colors[Math.floor(Math.random() * colors.length)];
    const newHeart: FloatingHeartItem = {
      id: Date.now() + Math.random(),
      x: Math.random() * 80 - 40, // random offset
      color: chosenColor,
      size: Math.floor(Math.random() * 12) + 20,
    };

    setFloatingHearts((prev) => [...prev.slice(-25), newHeart]);

    setTimeout(() => {
      setFloatingHearts((prev) => prev.filter((h) => h.id !== newHeart.id));
    }, 2200);
  };

  const handleSendComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const myName = currentUser?.name || 'You';
    const myUsername = currentUser?.username || 'you';
    const myAvatar =
      currentUser?.avatar ||
      'https://api.dicebear.com/7.x/bottts/svg?seed=YouLive&backgroundColor=ec4899';

    const newMsg: LiveChatMessage = {
      id: `my-msg-${Date.now()}`,
      user: myName,
      username: myUsername,
      avatar: myAvatar,
      text: inputText.trim(),
      isHost: true,
      badge: 'Host',
    };

    setChatMessages((prev) => [...prev, newMsg]);
    setInputText('');
    soundEngine.playCommentSound();
    spawnFloatingHeart('#ec4899');
  };

  const handleSendGift = (gift: typeof GIFTS_CATALOG[0]) => {
    soundEngine.playGiftSound();

    const senderName = currentUser?.name || 'You';
    const bannerItem: ActiveGiftBanner = {
      id: Date.now(),
      sender: senderName,
      giftName: gift.name,
      giftIcon: gift.icon,
      diamonds: gift.diamonds,
    };

    setActiveGiftBanner(bannerItem);
    setDiamondsCount((d) => d + gift.diamonds);

    // Boost host PK battle score
    if (isPkBattle) {
      setPkScoreHost((h) => Math.min(95, h + 5));
      setPkScoreGuest((g) => Math.max(5, g - 5));
    }

    // Add gift announcement to live chat
    const giftMsg: LiveChatMessage = {
      id: `gift-${Date.now()}`,
      user: senderName,
      username: currentUser?.username || 'you',
      avatar: currentUser?.avatar || 'https://api.dicebear.com/7.x/bottts/svg?seed=YouLive',
      text: `sent ${gift.name} ${gift.icon} (+${gift.diamonds} 💎)`,
      isGift: true,
      giftIcon: gift.icon,
      giftName: gift.name,
    };
    setChatMessages((prev) => [...prev, giftMsg]);

    // Spawn multiple hearts
    for (let i = 0; i < 6; i++) {
      setTimeout(() => spawnFloatingHeart(), i * 120);
    }

    onShowToast(`Sent ${gift.name} ${gift.icon}!`);

    // Hide banner after 3.2s
    setTimeout(() => {
      setActiveGiftBanner((curr) => (curr?.id === bannerItem.id ? null : curr));
    }, 3200);
  };

  const handleEndLiveStream = () => {
    setIsEndingStream(true);
  };

  const hostName = currentUser?.name || 'Jatt Live Studio';
  const hostHandle = currentUser?.username || 'jatt_official';
  const hostAvatar =
    currentUser?.avatar ||
    'https://api.dicebear.com/7.x/bottts/svg?seed=JattLive&backgroundColor=ec4899';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-md overflow-hidden select-none animate-in fade-in duration-200">
      {/* Stream Ended Summary Dialog */}
      {isEndingStream ? (
        <div className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-3xl p-6 shadow-2xl text-center space-y-5 animate-in zoom-in-95 duration-200 m-4">
          <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-pink-600 to-rose-600 text-white flex items-center justify-center mx-auto shadow-xl shadow-pink-600/30">
            <Radio className="w-8 h-8 animate-pulse" />
          </div>
          <div>
            <h3 className="text-xl font-black text-white tracking-tight">Live Stream Ended</h3>
            <p className="text-xs text-neutral-400 mt-1">Here is how your stream performed today</p>
          </div>

          <div className="grid grid-cols-3 gap-2.5 bg-neutral-950 p-4 rounded-2xl border border-neutral-800">
            <div>
              <p className="text-[10px] uppercase font-bold text-neutral-500">Duration</p>
              <p className="text-base font-bold text-white tabular-nums">{formatTimer(streamSeconds)}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-neutral-500">Peak Viewers</p>
              <p className="text-base font-bold text-pink-400 tabular-nums">{viewersCount.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-neutral-500">Diamonds</p>
              <p className="text-base font-bold text-amber-400 tabular-nums">{diamondsCount.toLocaleString()}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-full py-3 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white font-bold text-sm rounded-xl shadow-lg shadow-pink-600/25 transition-all"
          >
            Back to Reels Feed
          </button>
        </div>
      ) : (
        /* Active Live Stream Interface */
        <div className="relative w-full h-[100dvh] sm:max-w-[480px] sm:h-[95vh] sm:rounded-3xl bg-neutral-950 overflow-hidden flex flex-col justify-between shadow-2xl border border-neutral-800/80">
          {/* ========================================================= */}
          {/* VIDEO FEEDS: Split Screen (Host + Guest) or Single Screen */}
          {/* ========================================================= */}
          <div className="relative w-full h-full flex flex-col overflow-hidden bg-neutral-950">
            {isSplitScreen ? (
              /* Split Screen View (Host Top + Guest Bottom / Dual PK) */
              <div className="w-full h-full flex flex-col divide-y-2 divide-neutral-900 relative">
                {/* HOST VIEWPORT (TOP HALF) */}
                <div className="relative flex-1 bg-gradient-to-b from-purple-950/60 via-neutral-900 to-neutral-950 overflow-hidden flex items-center justify-center">
                  {/* Procedural animated backdrop representing host live feed */}
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-pink-900/30 via-neutral-950/80 to-black pointer-events-none" />
                  
                  {/* Host Identity Card Tag */}
                  <div className="relative z-10 flex flex-col items-center gap-2">
                    <div className="relative">
                      <img
                        src={hostAvatar}
                        alt={hostName}
                        className="w-20 h-20 rounded-full object-cover border-2 border-pink-500 shadow-xl shadow-pink-500/25 ring-4 ring-pink-500/20"
                        referrerPolicy="no-referrer"
                      />
                      <span className="absolute bottom-0 right-0 w-5 h-5 rounded-full bg-pink-500 text-white flex items-center justify-center text-[10px] font-bold border-2 border-black">
                        👑
                      </span>
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-bold text-white flex items-center justify-center gap-1">
                        {hostName}
                        <CheckCircle className="w-3.5 h-3.5 text-pink-400 fill-pink-500/20" />
                      </p>
                      <p className="text-[11px] text-pink-400 font-semibold">@{hostHandle} · Host</p>
                    </div>

                    {/* Animated Audio Equalizer Bars */}
                    <div className="flex items-center gap-1 mt-1">
                      <span className="w-1 h-3 bg-pink-400 rounded-full animate-bounce [animation-delay:0.1s]" />
                      <span className="w-1 h-5 bg-pink-400 rounded-full animate-bounce [animation-delay:0.3s]" />
                      <span className="w-1 h-2 bg-pink-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                      <span className="w-1 h-4 bg-pink-400 rounded-full animate-bounce [animation-delay:0.4s]" />
                    </div>
                  </div>
                </div>

                {/* GUEST VIEWPORT (BOTTOM HALF) */}
                <div className="relative flex-1 bg-gradient-to-b from-cyan-950/60 via-neutral-900 to-neutral-950 overflow-hidden flex items-center justify-center">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-cyan-900/30 via-neutral-950/80 to-black pointer-events-none" />

                  {/* Guest Tag */}
                  <div className="relative z-10 flex flex-col items-center gap-2">
                    <div className="relative">
                      <img
                        src="https://api.dicebear.com/7.x/bottts/svg?seed=AuroraGuest&backgroundColor=06b6d4"
                        alt="Guest Host"
                        className="w-18 h-18 rounded-full object-cover border-2 border-cyan-400 shadow-xl shadow-cyan-500/25 ring-4 ring-cyan-500/20"
                        referrerPolicy="no-referrer"
                      />
                      <span className="absolute bottom-0 right-0 w-5 h-5 rounded-full bg-cyan-500 text-black flex items-center justify-center text-[10px] font-bold border-2 border-black">
                        🎤
                      </span>
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-bold text-white">DJ Aurora Vines</p>
                      <p className="text-[11px] text-cyan-400 font-semibold">@aurora_beats · Co-Host</p>
                    </div>

                    {/* Guest Audio Waves */}
                    <div className="flex items-center gap-1 mt-1">
                      <span className="w-1 h-2 bg-cyan-400 rounded-full animate-bounce [animation-delay:0.3s]" />
                      <span className="w-1 h-4 bg-cyan-400 rounded-full animate-bounce [animation-delay:0.1s]" />
                      <span className="w-1 h-5 bg-cyan-400 rounded-full animate-bounce [animation-delay:0.4s]" />
                      <span className="w-1 h-3 bg-cyan-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                    </div>
                  </div>

                  {/* Guest connection info pill */}
                  <div className="absolute bottom-24 right-4 z-20 bg-neutral-900/80 px-2 py-0.5 rounded-full border border-neutral-700/80 text-[10px] text-neutral-400 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>HD 1080p · 18ms</span>
                  </div>
                </div>

                {/* PK Battle Score Bar Overlay in Center */}
                {isPkBattle && (
                  <div className="absolute top-1/2 left-4 right-4 -translate-y-1/2 z-30 flex flex-col gap-1 pointer-events-none">
                    <div className="flex items-center justify-between text-xs font-black text-white px-1 drop-shadow-md">
                      <span className="text-pink-400 font-bold flex items-center gap-1">
                        <Trophy className="w-3.5 h-3.5" /> Host: {pkScoreHost}%
                      </span>
                      <span className="text-[10px] uppercase font-bold text-amber-300 bg-amber-500/20 px-2 py-0.5 rounded-full border border-amber-500/30">
                        ⚔️ PK Battle
                      </span>
                      <span className="text-cyan-400 font-bold flex items-center gap-1">
                        Guest: {pkScoreGuest}% <Swords className="w-3.5 h-3.5" />
                      </span>
                    </div>

                    <div className="w-full h-3 bg-neutral-900 rounded-full overflow-hidden flex border border-neutral-700/80 shadow-lg">
                      <div
                        style={{ width: `${pkScoreHost}%` }}
                        className="h-full bg-gradient-to-r from-pink-600 to-rose-500 transition-all duration-500"
                      />
                      <div
                        style={{ width: `${pkScoreGuest}%` }}
                        className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-500"
                      />
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Single Full Screen Host View */
              <div className="w-full h-full bg-gradient-to-b from-purple-950/70 via-neutral-900 to-black flex items-center justify-center relative">
                <div className="relative z-10 flex flex-col items-center gap-3">
                  <img
                    src={hostAvatar}
                    alt={hostName}
                    className="w-24 h-24 rounded-full object-cover border-4 border-pink-500 shadow-2xl shadow-pink-500/30 ring-8 ring-pink-500/10"
                    referrerPolicy="no-referrer"
                  />
                  <div className="text-center">
                    <h3 className="text-base font-bold text-white flex items-center justify-center gap-1.5">
                      {hostName}
                      <CheckCircle className="w-4 h-4 text-pink-400" />
                    </h3>
                    <p className="text-xs text-pink-400 font-semibold">@{hostHandle} · Solo Live</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ========================================================= */}
          {/* TOP CONTROLS: Live Badge, Viewer Counter, Diamonds, Close */}
          {/* ========================================================= */}
          <div className="absolute top-0 left-0 right-0 z-40 p-3 pt-4 bg-gradient-to-b from-black/90 via-black/40 to-transparent flex items-center justify-between pointer-events-auto">
            {/* Host Pill */}
            <div className="flex items-center gap-2 bg-black/60 backdrop-blur-md p-1 pr-3 rounded-full border border-white/15">
              <img
                src={hostAvatar}
                alt={hostName}
                className="w-8 h-8 rounded-full object-cover border border-pink-500 shrink-0"
                referrerPolicy="no-referrer"
              />
              <div className="min-w-0">
                <p className="text-[11px] font-bold text-white truncate max-w-[90px]">{hostName}</p>
                <div className="flex items-center gap-1 text-[9px] text-amber-400 font-semibold">
                  <span>💎</span>
                  <span className="tabular-nums">{diamondsCount.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Right Top Status Controls */}
            <div className="flex items-center gap-2">
              {/* Viewer Counter Badge */}
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-600/20 border border-red-500/40 text-white backdrop-blur-md">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-red-400">LIVE</span>
                <span className="text-neutral-500">|</span>
                <Users className="w-3 h-3 text-neutral-300" />
                <span className="text-[11px] font-bold tabular-nums">
                  {viewersCount.toLocaleString()}
                </span>
              </div>

              {/* End Stream / Close Button */}
              <button
                type="button"
                onClick={handleEndLiveStream}
                className="w-8 h-8 rounded-full bg-black/60 hover:bg-neutral-800 text-neutral-300 hover:text-white flex items-center justify-center border border-white/15 backdrop-blur-md transition-colors"
                title="End stream"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* ========================================================= */}
          {/* FLOATING GIFT BANNER ANIMATION */}
          {/* ========================================================= */}
          {activeGiftBanner && (
            <div className="absolute top-20 left-4 right-4 z-40 pointer-events-none animate-in slide-in-from-top-6 duration-300">
              <div className="p-3 bg-gradient-to-r from-pink-600/90 via-purple-600/90 to-amber-500/90 rounded-2xl shadow-2xl border border-white/30 backdrop-blur-md flex items-center justify-between text-white">
                <div className="flex items-center gap-3">
                  <span className="text-3xl animate-bounce">{activeGiftBanner.giftIcon}</span>
                  <div>
                    <p className="text-xs font-bold">{activeGiftBanner.sender} sent</p>
                    <p className="text-sm font-black tracking-tight">{activeGiftBanner.giftName}!</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs font-black text-amber-300 drop-shadow-md">
                    +{activeGiftBanner.diamonds} 💎
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* FLOATING HEARTS PARTICLES */}
          {/* ========================================================= */}
          <div className="absolute bottom-20 right-4 w-28 h-72 pointer-events-none overflow-hidden z-30">
            {floatingHearts.map((heart) => (
              <div
                key={heart.id}
                style={{
                  left: `calc(50% + ${heart.x}px)`,
                  bottom: '10px',
                  color: heart.color,
                }}
                className="absolute animate-float-note-1 text-2xl font-bold filter drop-shadow-md"
              >
                ♥
              </div>
            ))}
          </div>

          {/* ========================================================= */}
          {/* BOTTOM OVERLAY: Live Chat Scroll Panel + Controls */}
          {/* ========================================================= */}
          <div className="absolute bottom-0 left-0 right-0 z-40 p-3 bg-gradient-to-t from-black via-black/80 to-transparent flex flex-col justify-end pointer-events-auto">
            {/* Live Chat Message Feed */}
            <div
              ref={chatScrollRef}
              className="max-h-48 overflow-y-auto space-y-1.5 mb-3 pr-12 no-scrollbar text-xs"
            >
              {chatMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`inline-flex items-start gap-1.5 p-1.5 rounded-xl backdrop-blur-xs max-w-[90%] ${
                    msg.isGift
                      ? 'bg-amber-500/20 border border-amber-500/30 text-amber-200'
                      : 'bg-black/40 text-neutral-200'
                  }`}
                >
                  <img
                    src={msg.avatar}
                    alt={msg.user}
                    className="w-5 h-5 rounded-full object-cover shrink-0 mt-0.5"
                    referrerPolicy="no-referrer"
                  />
                  <div className="leading-tight">
                    <span className="font-bold text-white text-[11px] mr-1.5">
                      {msg.user}
                    </span>
                    {msg.badge && (
                      <span className="text-[9px] uppercase font-bold text-pink-400 bg-pink-500/20 px-1 py-0.2 rounded-xs mr-1.5">
                        {msg.badge}
                      </span>
                    )}
                    <span className="text-[11px] text-neutral-300 break-words">
                      {msg.text}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Bottom Interactive Bar */}
            <div className="flex items-center gap-2">
              {/* Comment Input */}
              <form onSubmit={handleSendComment} className="flex-1 flex items-center gap-1.5">
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Say something nice in chat..."
                  className="flex-1 bg-neutral-900/90 text-xs text-white placeholder-neutral-500 px-3.5 py-2.5 rounded-full border border-neutral-700/60 focus:outline-hidden focus:border-pink-500 transition-colors"
                />
                <button
                  type="submit"
                  disabled={!inputText.trim()}
                  className="w-9 h-9 rounded-full bg-pink-600 disabled:opacity-40 text-white flex items-center justify-center shrink-0 active:scale-95 transition-all"
                  aria-label="Send message"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>

              {/* Gift Drawer Trigger */}
              <button
                type="button"
                onClick={() => setIsGiftTrayOpen(!isGiftTrayOpen)}
                className="w-10 h-10 rounded-full bg-gradient-to-tr from-amber-500 to-rose-500 text-white flex items-center justify-center shadow-lg shadow-amber-500/25 active:scale-95 transition-transform shrink-0"
                title="Send virtual gift"
              >
                <Gift className="w-5 h-5" />
              </button>

              {/* Quick Heart Reaction Button */}
              <button
                type="button"
                onClick={() => {
                  soundEngine.playLikeSound();
                  spawnFloatingHeart();
                }}
                className="w-10 h-10 rounded-full bg-rose-600 text-white flex items-center justify-center shadow-lg shadow-rose-600/30 active:scale-125 transition-transform shrink-0"
                title="Send reaction heart"
              >
                <Heart className="w-5 h-5 fill-white" />
              </button>
            </div>

            {/* Quick Host Toolbar Toggles */}
            <div className="flex items-center justify-between pt-2 px-1 text-xs text-neutral-400">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsSplitScreen(!isSplitScreen)}
                  className={`flex items-center gap-1 text-[11px] font-semibold transition-colors ${
                    isSplitScreen ? 'text-pink-400' : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>{isSplitScreen ? 'Split Screen On' : 'Solo Mode'}</span>
                </button>

                {isSplitScreen && (
                  <button
                    type="button"
                    onClick={() => setIsPkBattle(!isPkBattle)}
                    className={`flex items-center gap-1 text-[11px] font-semibold transition-colors ${
                      isPkBattle ? 'text-amber-400' : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    <Swords className="w-3.5 h-3.5" />
                    <span>{isPkBattle ? 'PK Battle' : 'Co-Host'}</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsMuted(!isMuted);
                    onShowToast(isMuted ? 'Mic Unmuted' : 'Mic Muted');
                  }}
                  className={`p-1.5 rounded-full border transition-colors ${
                    isMuted
                      ? 'bg-rose-500/20 text-rose-400 border-rose-500/40'
                      : 'bg-neutral-800 text-neutral-300 border-neutral-700'
                  }`}
                  title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
                >
                  {isMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </div>

          {/* ========================================================= */}
          {/* GIFT TRAY BOTTOM SHEET */}
          {/* ========================================================= */}
          {isGiftTrayOpen && (
            <div className="absolute bottom-0 left-0 right-0 z-50 bg-neutral-900 border-t border-neutral-800 rounded-t-3xl p-4 shadow-2xl animate-in slide-in-from-bottom-6 duration-200">
              <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
                <div className="flex items-center gap-2">
                  <Gift className="w-4 h-4 text-amber-400" />
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                    Virtual Gifts Tray
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={() => setIsGiftTrayOpen(false)}
                  className="p-1 text-neutral-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2.5 my-3">
                {GIFTS_CATALOG.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => handleSendGift(g)}
                    className="p-3 bg-neutral-950 hover:bg-neutral-800/80 rounded-2xl border border-neutral-800 flex flex-col items-center justify-center gap-1 group active:scale-95 transition-all hover:border-pink-500/50"
                  >
                    <span className="text-3xl group-hover:scale-110 transition-transform">
                      {g.icon}
                    </span>
                    <span className="text-xs font-bold text-white truncate max-w-full">
                      {g.name}
                    </span>
                    <span className="text-[10px] text-amber-400 font-semibold flex items-center gap-0.5">
                      💎 {g.diamonds}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
