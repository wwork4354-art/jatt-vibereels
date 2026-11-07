import React, { useState, useEffect, useRef } from 'react';
import {
  Radio,
  Users,
  Heart,
  Send,
  Gift,
  Volume2,
  VolumeX,
  Sparkles,
  Trophy,
  Swords,
  ChevronLeft,
  ChevronRight,
  Smile,
  CheckCircle,
  Share2,
  MessageCircle,
  Flame,
  Wand2,
  Tv,
  Layers,
  ArrowLeft,
  Camera,
} from 'lucide-react';
import { UserAccount, FeedTab } from '../types';
import { soundEngine } from '../utils/soundEngine';

interface LiveStreamMainViewProps {
  currentUser: UserAccount | null;
  onSelectTab: (tab: FeedTab) => void;
  onShowToast: (msg: string) => void;
  isMuted: boolean;
  onToggleMute: () => void;
}

interface StreamChannel {
  id: string;
  hostName: string;
  hostHandle: string;
  hostAvatar: string;
  title: string;
  category: string;
  viewers: number;
  diamonds: number;
  videoUrl: string;
  gradientBg: string;
  guestName?: string;
  guestAvatar?: string;
}

interface LiveChatMessage {
  id: string;
  user: string;
  username: string;
  avatar: string;
  text: string;
  isHost?: boolean;
  isGift?: boolean;
  isSystem?: boolean;
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

const LIVE_CHANNELS: StreamChannel[] = [
  {
    id: 'stream-1',
    hostName: 'DJ Vibe Master',
    hostHandle: 'dj_vibemaster',
    hostAvatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=DJVibe&backgroundColor=ec4899',
    title: '🔥 Live Neon Street Beats & Dhol Electro Set | Jatt VibeReels Official',
    category: 'Music & DJ',
    viewers: 19450,
    diamonds: 42100,
    videoUrl: 'https://upload.wikimedia.org/wikipedia/commons/a/a8/Berlin-KarnevalderKulturen2023-1-Asio.webm',
    gradientBg: 'from-pink-950 via-purple-950 to-neutral-950',
    guestName: 'MC Aurora Beats',
    guestAvatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=AuroraGuest&backgroundColor=06b6d4',
  },
  {
    id: 'stream-2',
    hostName: 'Dr. Stella Vance',
    hostHandle: 'cosmic_explorer',
    hostAvatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=StellaCosmic&backgroundColor=6366f1',
    title: '🔭 Live Telescope Watch: Gamma Ray Pulsar & Galactic Nebula Rotation',
    category: 'Science & Cosmos',
    viewers: 12890,
    diamonds: 28400,
    videoUrl: 'https://upload.wikimedia.org/wikipedia/commons/4/47/Astrophysics_Holiday_Vertical_Video_%28SVS14800_-_Fermi_YuleLog_Rotate_Reel%29.webm',
    gradientBg: 'from-blue-950 via-indigo-950 to-neutral-950',
    guestName: 'Prof. Kenji Astro',
    guestAvatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=KenjiAstro&backgroundColor=3b82f6',
  },
  {
    id: 'stream-3',
    hostName: 'Rainforest Sanctuaries',
    hostHandle: 'wild_encounters',
    hostAvatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=WildBird&backgroundColor=10b981',
    title: '🦜 Live Canopy Feed: Intelligent Macaw Nut Cracking & Jungle Ambience',
    category: 'Wildlife & Nature',
    viewers: 8740,
    diamonds: 15320,
    videoUrl: 'https://upload.wikimedia.org/wikipedia/commons/c/c5/Blue_and_yellow_macaw_eating_a_peanut.webm',
    gradientBg: 'from-emerald-950 via-teal-950 to-neutral-950',
  },
];

const GIFTS_CATALOG = [
  { id: 'g-rose', name: 'Rose', icon: '🌹', diamonds: 1, color: 'from-rose-500 to-pink-500' },
  { id: 'g-heart', name: 'Neon Heart', icon: '💖', diamonds: 10, color: 'from-pink-500 to-purple-500' },
  { id: 'g-rocket', name: 'Cosmic Rocket', icon: '🚀', diamonds: 100, color: 'from-cyan-500 to-blue-500' },
  { id: 'g-galaxy', name: 'Galaxy Portal', icon: '🌌', diamonds: 500, color: 'from-purple-500 to-indigo-600' },
  { id: 'g-crown', name: 'Jatt Royal Crown', icon: '👑', diamonds: 1000, color: 'from-amber-400 to-yellow-500' },
  { id: 'g-lion', name: 'Golden Lion', icon: '🦁', diamonds: 5000, color: 'from-yellow-400 to-amber-600' },
];

const SIMULATED_STREAM_COMMENTS = [
  { user: 'Vikram Dhillon', text: 'Chak de phatte!! Jatt VibeReels squad is lit 🔥🔥', badge: 'Top Fan' },
  { user: 'Sarah Jenkins', text: 'Greetings from Vancouver 🇨🇦 the audio setup is incredible!', badge: 'VIP' },
  { user: 'Maya Patel', text: 'That transition just blew my mind! 💥' },
  { user: 'Kenji Takahashi', text: 'Bassline is pumping in Shibuya 🎧⚡', badge: 'Creator' },
  { user: 'Elena Rostova', text: 'Sent you roses! Keep the energy flowing 🌹🌹' },
  { user: 'Harman Singh', text: 'Royal vibe only! Best live stream on the app 👑' },
  { user: 'Alex Rivera', text: 'Dropping diamonds for the PK battle win!! 💎' },
  { user: 'Chloe Monet', text: 'The guest co-host is hilarious haha 😂' },
  { user: 'Spike Neon', text: 'Let’s cross 25K viewers tonight! Let’s gooo 🚀' },
  { user: 'Simran Kaur', text: 'Shoutout from Amritsar! Love the music mix 💖' },
];

const HOST_SIMULATED_SPEECHES = [
  'Welcome to the live session everyone! Drop your city in the chat! 🌍',
  'Shoutout to our top gifters! You guys are keeping the vibe alive! 💎✨',
  'Wait for this next drop, turning up the equalizer now! 🎚️',
  'Who wants to challenge in the PK battle next? Let me know in chat! ⚔️',
  'Huge love to everyone sharing the stream right now! ❤️',
];

export const LiveStreamMainView: React.FC<LiveStreamMainViewProps> = ({
  currentUser,
  onSelectTab,
  onShowToast,
  isMuted,
  onToggleMute,
}) => {
  const [channelIndex, setChannelIndex] = useState(0);
  const currentChannel = LIVE_CHANNELS[channelIndex];

  const [viewersCount, setViewersCount] = useState(currentChannel.viewers);
  const [diamondsCount, setDiamondsCount] = useState(currentChannel.diamonds);
  const [isFollowingHost, setIsFollowingHost] = useState(false);
  const [isSplitScreen, setIsSplitScreen] = useState(true);
  const [isPkBattle, setIsPkBattle] = useState(true);
  const [pkScoreHost, setPkScoreHost] = useState(65);
  const [pkScoreGuest, setPkScoreGuest] = useState(35);

  const [activeHostAction, setActiveHostAction] = useState<string>('Host is live on camera 🎙️');
  const [hostSpeechBubble, setHostSpeechBubble] = useState<string>(HOST_SIMULATED_SPEECHES[0]);
  const [cameraFilter, setCameraFilter] = useState<'neon' | 'studio' | 'gold' | 'cyber'>('neon');

  const [chatMessages, setChatMessages] = useState<LiveChatMessage[]>([
    {
      id: 'm-0',
      user: 'System',
      username: 'system',
      avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=SystemAlert',
      text: 'Welcome to Jatt VibeReels LIVE! Keep comments friendly and respectful.',
      isSystem: true,
    },
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
      text: 'Loving the dual guest audio feed from Toronto 🇨🇦',
    },
  ]);

  const [inputText, setInputText] = useState('');
  const [isGiftTrayOpen, setIsGiftTrayOpen] = useState(false);
  const [floatingHearts, setFloatingHearts] = useState<FloatingHeartItem[]>([]);
  const [activeGiftBanner, setActiveGiftBanner] = useState<ActiveGiftBanner | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  // Play fanfare when entering live view
  useEffect(() => {
    soundEngine.playLiveStartSound();
  }, []);

  // Update viewers count when channel changes
  useEffect(() => {
    setViewersCount(currentChannel.viewers);
    setDiamondsCount(currentChannel.diamonds);
  }, [currentChannel]);

  // Handle video element play
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = isMuted;
      videoRef.current.play().catch(() => {
        // Autoplay safe guard
      });
    }
  }, [isMuted, channelIndex]);

  // Fluctuating viewers and stream stats
  useEffect(() => {
    const interval = setInterval(() => {
      setViewersCount((v) => Math.max(1000, v + Math.floor(Math.random() * 11) - 4));
    }, 1200);

    return () => clearInterval(interval);
  }, []);

  // Simulated host actions cycle
  useEffect(() => {
    const actions = [
      'Host waved to the chat 👋',
      'Host smiled and thanked top gifters ✨',
      'Host dropped an acoustic dhol beat 🥁',
      'Host checked the studio audio monitor 🎧',
      'Host initiated a 30s PK battle rush ⚔️',
      'Host drank some water 🥤',
    ];

    let actionIdx = 0;
    const hostInterval = setInterval(() => {
      actionIdx = (actionIdx + 1) % actions.length;
      setActiveHostAction(actions[actionIdx]);
      setHostSpeechBubble(HOST_SIMULATED_SPEECHES[actionIdx % HOST_SIMULATED_SPEECHES.length]);
    }, 5000);

    return () => clearInterval(hostInterval);
  }, []);

  // Auto-streaming simulated viewer comments
  useEffect(() => {
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

      // Spawn periodic floating hearts from other viewers
      if (Math.random() > 0.45) {
        spawnFloatingHeart();
      }
    }, 2600);

    return () => clearInterval(commentInterval);
  }, []);

  // Auto-scroll chat
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages]);

  const spawnFloatingHeart = (colorOverride?: string) => {
    const colors = ['#ec4899', '#f43f5e', '#a855f7', '#06b6d4', '#eab308'];
    const chosenColor = colorOverride || colors[Math.floor(Math.random() * colors.length)];
    const newHeart: FloatingHeartItem = {
      id: Date.now() + Math.random(),
      x: Math.random() * 90 - 45,
      color: chosenColor,
      size: Math.floor(Math.random() * 12) + 22,
    };

    setFloatingHearts((prev) => [...prev.slice(-25), newHeart]);

    setTimeout(() => {
      setFloatingHearts((prev) => prev.filter((h) => h.id !== newHeart.id));
    }, 2400);
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
      isHost: currentUser?.role === 'admin' || currentUser?.role === 'creator',
      badge: currentUser?.role === 'admin' ? 'Admin' : currentUser?.role === 'creator' ? 'Creator' : 'VIP',
    };

    setChatMessages((prev) => [...prev, newMsg]);
    setInputText('');
    soundEngine.playCommentSound();
    spawnFloatingHeart('#ec4899');

    // Host acknowledges message
    setTimeout(() => {
      setActiveHostAction(`Host reacted to @${myUsername}'s message! 💬`);
      setHostSpeechBubble(`Appreciate you tuning in, @${myUsername}! 🔥`);
    }, 1400);
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

    // Boost host PK score
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

    // Host celebration response
    setActiveHostAction(`Host celebrated ${gift.name} from ${senderName}! 👑🎉`);
    setHostSpeechBubble(`WOW! Thank you so much for the ${gift.name} ${gift.icon}!! 💎`);

    // Spawn shower of floating hearts
    for (let i = 0; i < 7; i++) {
      setTimeout(() => spawnFloatingHeart(), i * 110);
    }

    onShowToast(`Sent ${gift.name} ${gift.icon}!`);

    setTimeout(() => {
      setActiveGiftBanner((curr) => (curr?.id === bannerItem.id ? null : curr));
    }, 3400);
  };

  const handleTriggerHostAction = (actionTitle: string, responseSpeech: string) => {
    setActiveHostAction(actionTitle);
    setHostSpeechBubble(responseSpeech);
    soundEngine.playCommentSound();
    onShowToast(actionTitle);
  };

  const nextChannel = () => {
    setChannelIndex((prev) => (prev + 1) % LIVE_CHANNELS.length);
    onShowToast('Switched to next Live Stream');
  };

  const prevChannel = () => {
    setChannelIndex((prev) => (prev - 1 + LIVE_CHANNELS.length) % LIVE_CHANNELS.length);
    onShowToast('Switched to previous Live Stream');
  };

  // Camera filter class
  const getCameraFilterStyle = () => {
    switch (cameraFilter) {
      case 'studio':
        return 'contrast-110 saturate-125 brightness-105';
      case 'gold':
        return 'sepia-[0.25] contrast-105 saturate-150 brightness-105 hue-rotate-[-10deg]';
      case 'cyber':
        return 'contrast-125 saturate-150 hue-rotate-[25deg]';
      default:
        return 'contrast-105 saturate-110';
    }
  };

  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-black overflow-hidden relative select-none">
      {/* Top Banner Navigation: Back to Feed / Channel Switcher */}
      <div className="w-full max-w-5xl px-4 py-2 flex items-center justify-between z-30 shrink-0">
        <button
          type="button"
          onClick={() => onSelectTab('foryou')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-900/90 hover:bg-neutral-800 text-neutral-200 hover:text-white border border-neutral-700/80 text-xs font-bold transition-all shadow-md active:scale-95"
        >
          <ArrowLeft className="w-3.5 h-3.5 text-pink-400" />
          <span>Back to Reels Feed</span>
        </button>

        {/* Channel Indicator & Switcher */}
        <div className="flex items-center gap-2 bg-neutral-900/80 px-3 py-1 rounded-full border border-neutral-800 backdrop-blur-md">
          <button
            type="button"
            onClick={prevChannel}
            className="p-1 text-neutral-400 hover:text-white transition-colors"
            title="Previous Live Channel"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs font-bold text-white flex items-center gap-1.5">
            <Radio className="w-3 h-3 text-red-500 animate-pulse" />
            <span className="truncate max-w-[140px] sm:max-w-[200px]">{currentChannel.hostName}</span>
          </span>
          <button
            type="button"
            onClick={nextChannel}
            className="p-1 text-neutral-400 hover:text-white transition-colors"
            title="Next Live Channel"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Sound toggle */}
        <button
          type="button"
          onClick={onToggleMute}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
            isMuted
              ? 'bg-neutral-900 text-neutral-400 border-neutral-800'
              : 'bg-pink-600/20 text-pink-400 border-pink-500/40'
          }`}
        >
          {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          <span className="hidden sm:inline">{isMuted ? 'Muted' : 'Sound On'}</span>
        </button>
      </div>

      {/* Main Stream Container (Maximized TikTok Live Stage) */}
      <div className="relative w-full h-[calc(100%-48px)] sm:max-w-4xl max-h-[820px] rounded-2xl sm:rounded-3xl overflow-hidden bg-neutral-950 border border-neutral-800/80 shadow-2xl flex flex-col justify-between">
        
        {/* ========================================================= */}
        {/* CAMERA / VIDEO VIEW WITH SIMULATED HOST BROADCAST */}
        {/* ========================================================= */}
        <div className="absolute inset-0 z-0 bg-neutral-950 flex flex-col overflow-hidden">
          {isSplitScreen && currentChannel.guestName ? (
            /* DUAL SPLIT SCREEN VIEW: Host (Left/Top) + Co-Host Guest (Right/Bottom) */
            <div className="w-full h-full flex flex-col sm:flex-row divide-y-2 sm:divide-y-0 sm:divide-x-2 divide-neutral-900 relative">
              {/* HOST ACTIVE CAMERA VIEWPORT */}
              <div className="relative flex-1 h-full overflow-hidden flex items-center justify-center bg-gradient-to-b from-purple-950/60 to-black">
                <video
                  ref={videoRef}
                  src={currentChannel.videoUrl}
                  loop
                  autoPlay
                  playsInline
                  className={`w-full h-full object-cover opacity-85 transition-all duration-300 ${getCameraFilterStyle()}`}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/60 pointer-events-none" />

                {/* Host Live Label & Audio Wave */}
                <div className="absolute top-14 left-4 z-20 flex items-center gap-2 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-full border border-pink-500/30">
                  <span className="w-2 h-2 rounded-full bg-pink-500 animate-ping" />
                  <span className="text-[11px] font-bold text-white flex items-center gap-1">
                    {currentChannel.hostName}
                    <CheckCircle className="w-3 h-3 text-pink-400" />
                  </span>
                  <div className="flex items-center gap-0.5 ml-1">
                    <span className="w-1 h-2.5 bg-pink-400 rounded-full animate-bounce [animation-delay:0.1s]" />
                    <span className="w-1 h-4 bg-pink-400 rounded-full animate-bounce [animation-delay:0.3s]" />
                    <span className="w-1 h-2 bg-pink-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                  </div>
                </div>

                {/* Floating Host Speech Bubble */}
                <div className="absolute top-24 left-4 max-w-[240px] z-20 bg-neutral-900/90 border border-neutral-700/80 rounded-2xl rounded-tl-xs p-2.5 text-xs text-white shadow-xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-200">
                  <p className="text-[11px] font-bold text-pink-400 mb-0.5">Host says:</p>
                  <p className="leading-snug">{hostSpeechBubble}</p>
                </div>
              </div>

              {/* GUEST CO-HOST VIEWPORT */}
              <div className="relative flex-1 h-full overflow-hidden flex items-center justify-center bg-gradient-to-b from-cyan-950/60 via-neutral-900 to-black">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-cyan-900/25 via-neutral-950/80 to-black pointer-events-none" />

                <div className="relative z-10 flex flex-col items-center gap-2 p-4 text-center">
                  <div className="relative">
                    <img
                      src={currentChannel.guestAvatar}
                      alt={currentChannel.guestName}
                      className="w-20 h-20 rounded-full object-cover border-2 border-cyan-400 shadow-xl shadow-cyan-500/25 ring-4 ring-cyan-500/20"
                      referrerPolicy="no-referrer"
                    />
                    <span className="absolute bottom-0 right-0 w-6 h-6 rounded-full bg-cyan-500 text-black flex items-center justify-center text-xs font-bold border-2 border-black">
                      🎤
                    </span>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">{currentChannel.guestName}</h4>
                    <p className="text-[11px] text-cyan-400 font-semibold">Co-Host · Live in Studio</p>
                  </div>

                  {/* Guest Audio Equalizer */}
                  <div className="flex items-center gap-1 mt-1">
                    <span className="w-1 h-2.5 bg-cyan-400 rounded-full animate-bounce [animation-delay:0.3s]" />
                    <span className="w-1 h-4 bg-cyan-400 rounded-full animate-bounce [animation-delay:0.1s]" />
                    <span className="w-1 h-5 bg-cyan-400 rounded-full animate-bounce [animation-delay:0.4s]" />
                    <span className="w-1 h-3 bg-cyan-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                  </div>
                </div>

                {/* Guest Connection Stats */}
                <div className="absolute bottom-24 right-4 z-20 bg-neutral-900/80 px-2 py-0.5 rounded-full border border-neutral-700/80 text-[10px] text-neutral-400 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>1080p60 · 14ms · Stereo</span>
                </div>
              </div>

              {/* PK Battle Score Bar Overlay */}
              {isPkBattle && (
                <div className="absolute top-1/2 left-4 right-4 -translate-y-1/2 z-30 flex flex-col gap-1 pointer-events-none">
                  <div className="flex items-center justify-between text-xs font-black text-white px-2 drop-shadow-md">
                    <span className="text-pink-400 font-bold flex items-center gap-1">
                      <Trophy className="w-3.5 h-3.5" /> {currentChannel.hostName}: {pkScoreHost}%
                    </span>
                    <span className="text-[10px] uppercase font-bold text-amber-300 bg-amber-500/20 px-2 py-0.5 rounded-full border border-amber-500/30">
                      ⚔️ PK Battle Rush
                    </span>
                    <span className="text-cyan-400 font-bold flex items-center gap-1">
                      {currentChannel.guestName}: {pkScoreGuest}% <Swords className="w-3.5 h-3.5" />
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
            /* SOLO FULL SCREEN BROADCAST VIEW */
            <div className="relative w-full h-full overflow-hidden flex items-center justify-center">
              <video
                ref={videoRef}
                src={currentChannel.videoUrl}
                loop
                autoPlay
                playsInline
                className={`w-full h-full object-cover opacity-90 transition-all duration-300 ${getCameraFilterStyle()}`}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-black/60 pointer-events-none" />

              {/* Floating Host Speech Bubble in Solo Mode */}
              <div className="absolute top-20 left-4 max-w-[260px] z-20 bg-neutral-900/90 border border-pink-500/30 rounded-2xl rounded-tl-xs p-3 text-xs text-white shadow-xl backdrop-blur-md animate-in fade-in duration-200">
                <p className="text-[11px] font-bold text-pink-400 mb-0.5 flex items-center gap-1">
                  <span>{currentChannel.hostName}</span>
                  <CheckCircle className="w-3 h-3 text-pink-400" />
                </p>
                <p className="leading-snug">{hostSpeechBubble}</p>
              </div>
            </div>
          )}
        </div>

        {/* ========================================================= */}
        {/* TOP OVERLAY BAR: Host Card, Live Badge, Viewers, Diamonds */}
        {/* ========================================================= */}
        <div className="relative z-30 p-3 sm:p-4 bg-gradient-to-b from-black/90 via-black/40 to-transparent flex items-center justify-between gap-2 pointer-events-auto">
          {/* Host Profile Info Pill */}
          <div className="flex items-center gap-2 bg-black/60 backdrop-blur-md p-1 pr-3 rounded-full border border-white/15">
            <img
              src={currentChannel.hostAvatar}
              alt={currentChannel.hostName}
              className="w-9 h-9 rounded-full object-cover border-2 border-pink-500 shrink-0"
              referrerPolicy="no-referrer"
            />
            <div className="min-w-0">
              <div className="flex items-center gap-1">
                <p className="text-xs font-bold text-white truncate max-w-[110px] sm:max-w-[150px]">
                  {currentChannel.hostName}
                </p>
                <CheckCircle className="w-3 h-3 text-pink-400 shrink-0" />
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-neutral-300">
                <span className="text-amber-400 font-bold flex items-center gap-0.5">
                  💎 {diamondsCount.toLocaleString()}
                </span>
                <span>·</span>
                <span className="text-neutral-400">@{currentChannel.hostHandle}</span>
              </div>
            </div>

            {/* Follow Host Button */}
            <button
              type="button"
              onClick={() => {
                setIsFollowingHost(!isFollowingHost);
                onShowToast(isFollowingHost ? 'Unfollowed host' : `Followed ${currentChannel.hostName}!`);
              }}
              className={`ml-1 px-2.5 py-1 rounded-full text-xs font-bold transition-all ${
                isFollowingHost
                  ? 'bg-neutral-800 text-neutral-300 border border-neutral-700'
                  : 'bg-pink-600 hover:bg-pink-500 text-white shadow-md shadow-pink-600/30'
              }`}
            >
              {isFollowingHost ? 'Following' : '+ Follow'}
            </button>
          </div>

          {/* Right Top Status Controls */}
          <div className="flex items-center gap-2">
            {/* Live Viewer Counter */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-600/20 border border-red-500/40 text-white backdrop-blur-md shadow-sm">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
              <span className="text-xs font-bold uppercase tracking-wider text-red-400">LIVE</span>
              <span className="text-neutral-500">|</span>
              <Users className="w-3.5 h-3.5 text-neutral-300" />
              <span className="text-xs font-bold tabular-nums">
                {viewersCount.toLocaleString()}
              </span>
            </div>

            {/* Split Screen Mode Toggle */}
            {currentChannel.guestName && (
              <button
                type="button"
                onClick={() => setIsSplitScreen(!isSplitScreen)}
                className={`p-2 rounded-full border transition-colors backdrop-blur-md ${
                  isSplitScreen
                    ? 'bg-pink-500/20 text-pink-400 border-pink-500/40'
                    : 'bg-black/60 text-neutral-300 border-white/15'
                }`}
                title={isSplitScreen ? 'Switch to Solo mode' : 'Switch to Split Screen'}
              >
                <Users className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* ========================================================= */}
        {/* SIMULATED HOST ACTION NOTIFICATION BANNER */}
        {/* ========================================================= */}
        <div className="relative z-30 px-4 pointer-events-none">
          <div className="inline-flex items-center gap-2 bg-neutral-900/80 border border-neutral-700/80 px-3 py-1 rounded-full backdrop-blur-md text-xs text-neutral-200 shadow-md">
            <span className="w-2 h-2 rounded-full bg-pink-400 animate-pulse" />
            <span className="font-semibold">{activeHostAction}</span>
          </div>
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
              <div className="text-right">
                <span className="text-xs font-black text-amber-300 drop-shadow-md">
                  +{activeGiftBanner.diamonds} 💎
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* FLOATING HEARTS PARTICLES SYSTEM */}
        {/* ========================================================= */}
        <div className="absolute bottom-20 right-4 w-28 h-80 pointer-events-none overflow-hidden z-30">
          {floatingHearts.map((heart) => (
            <div
              key={heart.id}
              style={{
                left: `calc(50% + ${heart.x}px)`,
                bottom: '12px',
                color: heart.color,
                fontSize: `${heart.size}px`,
              }}
              className="absolute animate-float-note-1 font-bold filter drop-shadow-md"
            >
              ♥
            </div>
          ))}
        </div>

        {/* ========================================================= */}
        {/* BOTTOM SECTION: SCROLLING COMMENTS (LEFT) + GIFTS (RIGHT) */}
        {/* ========================================================= */}
        <div className="relative z-30 p-3 sm:p-4 bg-gradient-to-t from-black via-black/85 to-transparent flex flex-col justify-end pointer-events-auto">
          
          <div className="flex flex-col sm:flex-row items-end justify-between gap-4 mb-3">
            {/* ===================================================== */}
            {/* SIMULATED SCROLLING COMMENTS (PINNED BOTTOM LEFT) */}
            {/* ===================================================== */}
            <div className="w-full sm:max-w-md">
              <div
                ref={chatScrollRef}
                className="max-h-44 sm:max-h-52 overflow-y-auto space-y-1.5 no-scrollbar text-xs pr-2"
              >
                {chatMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`inline-flex items-start gap-1.5 p-1.5 rounded-xl backdrop-blur-xs max-w-[95%] shadow-xs ${
                      msg.isSystem
                        ? 'bg-neutral-900/80 border border-neutral-700/80 text-neutral-300 text-[10px]'
                        : msg.isGift
                        ? 'bg-amber-500/20 border border-amber-500/40 text-amber-200'
                        : msg.isHost
                        ? 'bg-pink-500/20 border border-pink-500/40 text-pink-200'
                        : 'bg-black/50 border border-white/10 text-neutral-200'
                    }`}
                  >
                    {!msg.isSystem && (
                      <img
                        src={msg.avatar}
                        alt={msg.user}
                        className="w-5 h-5 rounded-full object-cover shrink-0 mt-0.5"
                        referrerPolicy="no-referrer"
                      />
                    )}
                    <div className="leading-snug">
                      <span className="font-bold text-white text-[11px] mr-1.5">
                        {msg.user}
                      </span>
                      {msg.badge && (
                        <span
                          className={`text-[9px] uppercase font-bold px-1 py-0.2 rounded-xs mr-1.5 ${
                            msg.badge === 'Admin' || msg.badge === 'Host'
                              ? 'bg-pink-500 text-white'
                              : msg.badge === 'VIP'
                              ? 'bg-amber-500/30 text-amber-300 border border-amber-500/40'
                              : 'bg-cyan-500/20 text-cyan-300'
                          }`}
                        >
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
            </div>

            {/* ===================================================== */}
            {/* FLOATING QUICK HOST ACTION SHORTCUTS (CENTER/RIGHT) */}
            {/* ===================================================== */}
            <div className="flex items-center gap-1.5 bg-neutral-900/80 backdrop-blur-md p-1.5 rounded-2xl border border-neutral-800 text-[11px]">
              <button
                type="button"
                onClick={() => handleTriggerHostAction('Host waved back! 👋', 'Big love to the chat! Thanks for watching!')}
                className="px-2 py-1 bg-neutral-800 hover:bg-neutral-700 rounded-lg text-neutral-200 font-semibold transition-colors"
                title="Simulate Host Wave"
              >
                👋 Wave
              </button>
              <button
                type="button"
                onClick={() => handleTriggerHostAction('Host gave a shoutout! 📣', 'Shoutout to everyone rocking with Jatt VibeReels!')}
                className="px-2 py-1 bg-neutral-800 hover:bg-neutral-700 rounded-lg text-neutral-200 font-semibold transition-colors"
                title="Simulate Host Shoutout"
              >
                📣 Shoutout
              </button>
              <button
                type="button"
                onClick={() => {
                  const filters: Array<'neon' | 'studio' | 'gold' | 'cyber'> = ['neon', 'studio', 'gold', 'cyber'];
                  const nextFilter = filters[(filters.indexOf(cameraFilter) + 1) % filters.length];
                  setCameraFilter(nextFilter);
                  handleTriggerHostAction(`Host changed camera filter to ${nextFilter.toUpperCase()} ✨`, 'Camera filter updated!');
                }}
                className="px-2 py-1 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 rounded-lg font-semibold border border-purple-500/30 transition-colors flex items-center gap-1"
                title="Cycle Host Camera Filter"
              >
                <Wand2 className="w-3 h-3 text-purple-400" />
                <span className="capitalize">{cameraFilter}</span>
              </button>
            </div>
          </div>

          {/* ========================================================= */}
          {/* BOTTOM INTERACTIVE INPUT BAR & FLOATING GIFT BUTTONS */}
          {/* ========================================================= */}
          <div className="flex items-center gap-2">
            {/* Comment Form */}
            <form onSubmit={handleSendComment} className="flex-1 flex items-center gap-1.5">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Say something nice in chat..."
                className="flex-1 bg-neutral-900/90 text-xs text-white placeholder-neutral-500 px-4 py-2.5 rounded-full border border-neutral-700/80 focus:outline-hidden focus:border-pink-500 transition-colors shadow-inner"
              />
              <button
                type="submit"
                disabled={!inputText.trim()}
                className="w-9 h-9 rounded-full bg-pink-600 disabled:opacity-40 text-white flex items-center justify-center shrink-0 active:scale-95 transition-all shadow-md shadow-pink-600/30"
                aria-label="Send comment"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>

            {/* Virtual Gift Tray Trigger */}
            <button
              type="button"
              onClick={() => setIsGiftTrayOpen(!isGiftTrayOpen)}
              className="w-10 h-10 rounded-full bg-gradient-to-tr from-amber-500 to-rose-500 hover:from-amber-400 hover:to-rose-400 text-white flex items-center justify-center shadow-lg shadow-amber-500/25 active:scale-95 transition-transform shrink-0"
              title="Open Virtual Gifts Panel"
            >
              <Gift className="w-5 h-5" />
            </button>

            {/* Quick Floating Heart Reaction Button */}
            <button
              type="button"
              onClick={() => {
                soundEngine.playLikeSound();
                spawnFloatingHeart();
              }}
              className="w-10 h-10 rounded-full bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center shadow-lg shadow-rose-600/30 active:scale-125 transition-transform shrink-0"
              title="Send Heart Reaction"
            >
              <Heart className="w-5 h-5 fill-white" />
            </button>
          </div>

          {/* ========================================================= */}
          {/* FLOATING GIFTS PANEL TRAY */}
          {/* ========================================================= */}
          {isGiftTrayOpen && (
            <div className="mt-3 bg-neutral-900/95 border border-neutral-800 rounded-2xl p-3 shadow-2xl backdrop-blur-md animate-in slide-in-from-bottom-4 duration-200">
              <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
                <div className="flex items-center gap-2">
                  <Gift className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-bold text-white uppercase tracking-wider">
                    Virtual Gifts Panel
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsGiftTrayOpen(false)}
                  className="text-neutral-400 hover:text-white text-xs font-bold"
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
                    <span className="text-2xl group-hover:scale-110 transition-transform">
                      {g.icon}
                    </span>
                    <span className="text-[11px] font-bold text-white truncate max-w-full">
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
      </div>
    </div>
  );
};
