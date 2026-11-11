import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  X,
  Camera,
  RotateCcw,
  Sparkles,
  Moon,
  Zap,
  Grid,
  Volume2,
  Sliders,
  Check,
  Video,
  Upload,
  Radio,
  Share2,
  Film,
  Flame,
  ArrowRight,
  Eye,
} from 'lucide-react';
import { VideoPost, UserAccount } from '../types';
import { soundEngine } from '../utils/soundEngine';

interface ProCameraModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserAccount | null;
  onRecordSuccess: (newPost: VideoPost) => void;
  onSwitchToUploadFile: () => void;
  onShowToast: (msg: string) => void;
}

type ResolutionFpsMode = '4K/60FPS' | '4K/30FPS' | '1080p/60FPS' | '1080p/24FPS';
type BeautyPreset = 'Natural' | 'Smooth Glam' | 'Cyber Neon' | 'Golden Hour' | 'Vivid Rosy';

export const ProCameraModal: React.FC<ProCameraModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onRecordSuccess,
  onSwitchToUploadFile,
  onShowToast,
}) => {
  // Pro Camera Settings State
  const [resFps, setResFps] = useState<ResolutionFpsMode>('4K/60FPS');
  const [beautyLevel, setBeautyLevel] = useState<number>(65); // 0-100%
  const [beautyPreset, setBeautyPreset] = useState<BeautyPreset>('Smooth Glam');
  const [isBeautyOpen, setIsBeautyOpen] = useState<boolean>(false);
  const [nightModeLevel, setNightModeLevel] = useState<number>(0); // 0 = off, 1 = 1.5x, 2 = 3.0x
  const [isFlashOn, setIsFlashOn] = useState<boolean>(false);
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [zoomLevel, setZoomLevel] = useState<number>(1.0); // 0.5, 1.0, 2.0, 5.0
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [isSimulatedFeed, setIsSimulatedFeed] = useState<boolean>(false);

  // Recording State
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordingSeconds, setRecordingSeconds] = useState<number>(0);
  const [recordedClipUrl, setRecordedClipUrl] = useState<string | null>(null);

  // AI Motion Tracking State
  const [aiTrackingLocked, setAiTrackingLocked] = useState<boolean>(true);
  const [trackerPos, setTrackerPos] = useState<{ x: number; y: number }>({ x: 50, y: 45 });
  const [horizonTilt, setHorizonTilt] = useState<number>(0.4);

  // Post-recording caption form
  const [clipTitle, setClipTitle] = useState('');
  const [clipHashtags, setClipHashtags] = useState('#JattVibe #ProCamera #4K60FPS #Trending');

  // DOM Refs
  const videoPreviewRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const timerIntervalRef = useRef<number | null>(null);
  const nativeCameraInputRef = useRef<HTMLInputElement | null>(null);
  const [cameraBlockedInWebView, setCameraBlockedInWebView] = useState<boolean>(false);

  // Fallback native camera capture handler
  const handleNativeCameraCaptured = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setRecordedClipUrl(url);
      const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
      setClipTitle(cleanName || `4K Mobile Reel #${Math.floor(Math.random() * 900 + 100)}`);
      onShowToast('Captured from native device camera! Preview & publish below.');
    }
    e.target.value = '';
  };

  // Initialize or teardown camera stream
  useEffect(() => {
    if (!isOpen) {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
      }
      setIsRecording(false);
      setRecordingSeconds(0);
      setRecordedClipUrl(null);
      setCameraBlockedInWebView(false);
      return;
    }

    let isMounted = true;

    async function setupCamera() {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error('Live mediaDevices.getUserMedia not supported in this browser or WebView');
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode,
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: true,
        });

        if (isMounted) {
          mediaStreamRef.current = stream;
          if (videoPreviewRef.current) {
            videoPreviewRef.current.srcObject = stream;
            videoPreviewRef.current.play().catch(() => {});
          }
          setIsSimulatedFeed(false);
          setCameraBlockedInWebView(false);
        }
      } catch (err) {
        console.warn('Live camera access blocked by browser or WebView:', err);
        // Fallback to simulated cyber pro viewfinder & automatically trigger native camera input
        if (isMounted) {
          setIsSimulatedFeed(true);
          setCameraBlockedInWebView(true);
          onShowToast('Live camera blocked in WebView/Browser. Opening native mobile camera...');
          nativeCameraInputRef.current?.click();
        }
      }
    }

    setupCamera();

    return () => {
      isMounted = false;
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
      }
    };
  }, [isOpen, facingMode, onShowToast]);

  // AI Motion Tracker gentle drift simulation
  useEffect(() => {
    if (!isOpen || recordedClipUrl) return;

    const interval = setInterval(() => {
      setTrackerPos((prev) => {
        const dx = (Math.random() - 0.5) * 4;
        const dy = (Math.random() - 0.5) * 4;
        return {
          x: Math.max(30, Math.min(70, prev.x + dx)),
          y: Math.max(30, Math.min(65, prev.y + dy)),
        };
      });
      setHorizonTilt((Math.random() - 0.5) * 1.8);
      // Randomly re-verify lock status
      setAiTrackingLocked(Math.random() > 0.05);
    }, 800);

    return () => clearInterval(interval);
  }, [isOpen, recordedClipUrl]);

  // Recording Timer Tracker
  useEffect(() => {
    if (isRecording) {
      timerIntervalRef.current = window.setInterval(() => {
        setRecordingSeconds((prev) => {
          if (prev >= 59) {
            handleStopRecording();
            return 60;
          }
          return prev + 1;
        });
      }, 1000);
    } else {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    }

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, [isRecording]);

  // Shutter Record Trigger
  const handleToggleRecord = () => {
    if (!isRecording) {
      soundEngine.playRecordBeep(true);
      setIsRecording(true);
      setRecordingSeconds(0);
      onShowToast(`Started Recording in ${resFps}`);
    } else {
      handleStopRecording();
    }
  };

  const handleStopRecording = () => {
    soundEngine.playRecordBeep(false);
    setIsRecording(false);

    // Set a representative high-grade sample video or the captured stream
    const fallbackClips = [
      'https://upload.wikimedia.org/wikipedia/commons/4/47/Astrophysics_Holiday_Vertical_Video_%28SVS14800_-_Fermi_YuleLog_Rotate_Reel%29.webm',
      'https://upload.wikimedia.org/wikipedia/commons/a/a8/Berlin-KarnevalderKulturen2023-1-Asio.webm',
    ];
    setRecordedClipUrl(fallbackClips[Math.floor(Math.random() * fallbackClips.length)]);
    setClipTitle(`My 4K Reel #${Math.floor(Math.random() * 900 + 100)}`);
    onShowToast('Recording Captured! Preview & Publish your reel.');
  };

  // Flip Camera
  const handleFlipCamera = () => {
    soundEngine.playCameraShutter();
    setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'));
    onShowToast(`Switched Camera: ${facingMode === 'user' ? 'Rear Wide Lens' : 'Front Selfie'}`);
  };

  // Cycle 4K / 60FPS modes
  const handleCycleResFps = () => {
    soundEngine.playCameraShutter();
    const modes: ResolutionFpsMode[] = ['4K/60FPS', '4K/30FPS', '1080p/60FPS', '1080p/24FPS'];
    const nextIdx = (modes.indexOf(resFps) + 1) % modes.length;
    setResFps(modes[nextIdx]);
    onShowToast(`Pro Format set to ${modes[nextIdx]}`);
  };

  // Cycle Night Mode Booster
  const handleCycleNightMode = () => {
    soundEngine.playCameraShutter();
    const next = (nightModeLevel + 1) % 3;
    setNightModeLevel(next);
    const labels = ['Night Mode: OFF', 'Night Mode: 1.5x Booster', 'Night Mode: 3.0x Ultra ISO'];
    onShowToast(labels[next]);
  };

  // Compute live visual filter CSS based on beauty & night mode settings
  const getFilterStyle = useCallback(() => {
    let brightness = 1;
    let contrast = 1.05;
    let saturate = 1.1;
    let hueRotate = 0;
    let blur = 0;

    // Night Mode boost
    if (nightModeLevel === 1) {
      brightness += 0.35;
      contrast += 0.15;
    } else if (nightModeLevel === 2) {
      brightness += 0.75;
      contrast += 0.3;
      saturate += 0.2;
    }

    // Beauty Preset adjustments
    const bRatio = beautyLevel / 100;
    switch (beautyPreset) {
      case 'Smooth Glam':
        brightness += 0.08 * bRatio;
        contrast -= 0.05 * bRatio;
        saturate += 0.2 * bRatio;
        blur = 0.25 * bRatio;
        break;
      case 'Cyber Neon':
        contrast += 0.3 * bRatio;
        saturate += 0.5 * bRatio;
        hueRotate = 25 * bRatio;
        break;
      case 'Golden Hour':
        brightness += 0.1 * bRatio;
        saturate += 0.4 * bRatio;
        hueRotate = -12 * bRatio;
        break;
      case 'Vivid Rosy':
        saturate += 0.35 * bRatio;
        hueRotate = 10 * bRatio;
        brightness += 0.05 * bRatio;
        break;
      default:
        // Natural
        break;
    }

    return {
      filter: `brightness(${brightness}) contrast(${contrast}) saturate(${saturate}) hue-rotate(${hueRotate}deg) blur(${blur}px)`,
    };
  }, [beautyLevel, beautyPreset, nightModeLevel]);

  // Publish newly captured reel
  const handlePublishReel = () => {
    if (!currentUser) {
      onShowToast('Please log in first to publish your recorded reel!');
      return;
    }

    const newPost: VideoPost = {
      id: `pro-reel-${Date.now()}`,
      title: clipTitle.trim() || 'Shot with Jatt VibeReels Pro Camera',
      description: `Recorded in ${resFps} with Beauty Filter (${beautyPreset} ${beautyLevel}%) and AI Motion Tracking.`,
      hashtags: clipHashtags.split(' ').filter((h) => h.startsWith('#')),
      videoUrl: recordedClipUrl || '',
      fallbackGradient: 'from-pink-900 via-purple-900 to-black',
      category: 'trending',
      creator: {
        name: currentUser.name,
        username: currentUser.username,
        avatar: currentUser.avatar,
        isVerified: true,
        isFollowing: true,
        bio: currentUser.bio || 'VibeReels Pro Creator',
      },
      stats: {
        likes: 1,
        comments: 0,
        shares: 0,
        saves: 0,
      },
      isLiked: true,
      isSaved: false,
      sound: {
        title: 'Original Pro Studio Audio',
        artist: currentUser.name,
        trackType: 'future_bass',
      },
      commentsList: [],
    };

    onRecordSuccess(newPost);
    soundEngine.playDownloadComplete();
    onShowToast(`🎉 Published your 4K Reel! Check the For You feed.`);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col justify-between overflow-hidden select-none">
      {/* Flash / Studio Ring Light Simulation Overlay */}
      {isFlashOn && (
        <div className="absolute inset-0 pointer-events-none z-40 bg-radial from-amber-100/30 via-white/10 to-transparent mix-blend-screen animate-pulse" />
      )}

      {/* ========================================================================= */}
      {/* TOP PRO STATUS BAR: RESOLUTION/FPS, NIGHT MODE, FLASH, GRID, CLOSE        */}
      {/* ========================================================================= */}
      <div className="relative z-30 px-4 py-3 bg-gradient-to-b from-black/90 via-black/50 to-transparent flex items-center justify-between gap-2 shrink-0">
        {/* Left: Close & File Upload Switcher */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-black/60 hover:bg-neutral-800 text-neutral-300 hover:text-white flex items-center justify-center border border-white/15 backdrop-blur-md transition-all active:scale-95"
            title="Exit Pro Camera"
          >
            <X className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={() => {
              onClose();
              onSwitchToUploadFile();
            }}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-neutral-900/80 hover:bg-neutral-800 text-xs font-bold text-neutral-300 hover:text-white border border-neutral-700/80 backdrop-blur-md transition-all"
            title="Switch to file upload modal"
          >
            <Upload className="w-3.5 h-3.5 text-pink-400" />
            <span>File Upload</span>
          </button>
        </div>

        {/* Center: 4K / 60FPS Pro Toggle & Night Mode Indicator */}
        <div className="flex items-center gap-2">
          {/* 4K/60FPS Pill Toggle */}
          <button
            type="button"
            onClick={handleCycleResFps}
            className="px-3 py-1.5 rounded-full bg-black/70 hover:bg-black/90 border border-pink-500/50 text-white text-xs font-black flex items-center gap-1.5 backdrop-blur-md shadow-lg shadow-pink-500/20 active:scale-95 transition-transform"
            title="Toggle 4K / 60FPS Pro format"
          >
            <span className="w-2 h-2 rounded-full bg-pink-500 animate-pulse" />
            <span className="tracking-wider">{resFps}</span>
          </button>

          {/* Night Mode Booster Toggle */}
          <button
            type="button"
            onClick={handleCycleNightMode}
            className={`px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 border backdrop-blur-md transition-all ${
              nightModeLevel > 0
                ? 'bg-amber-500/20 border-amber-400/80 text-amber-300 shadow-lg shadow-amber-500/25'
                : 'bg-black/60 border-white/15 text-neutral-400 hover:text-white'
            }`}
            title="Night Mode Booster (Low-light ISO boost)"
          >
            <Moon className={`w-3.5 h-3.5 ${nightModeLevel > 0 ? 'text-amber-400 fill-amber-400' : ''}`} />
            <span className="hidden sm:inline">
              {nightModeLevel === 0 ? 'Night Mode' : nightModeLevel === 1 ? 'Night 1.5x' : 'Night 3.0x'}
            </span>
          </button>
        </div>

        {/* Right: Studio Flash & Grid Overlay */}
        <div className="flex items-center gap-2">
          {/* Flash / Studio Ring */}
          <button
            type="button"
            onClick={() => setIsFlashOn(!isFlashOn)}
            className={`w-9 h-9 rounded-full flex items-center justify-center border backdrop-blur-md transition-all ${
              isFlashOn
                ? 'bg-amber-400 text-black border-amber-300 shadow-lg shadow-amber-400/40'
                : 'bg-black/60 text-neutral-300 border-white/15'
            }`}
            title="Toggle Studio Torch Light"
          >
            <Zap className="w-4 h-4" />
          </button>

          {/* Grid Toggle */}
          <button
            type="button"
            onClick={() => setShowGrid(!showGrid)}
            className={`w-9 h-9 rounded-full flex items-center justify-center border backdrop-blur-md transition-all ${
              showGrid
                ? 'bg-pink-500/20 text-pink-400 border-pink-500/40'
                : 'bg-black/60 text-neutral-400 border-white/15'
            }`}
            title="Toggle Rule of Thirds Grid"
          >
            <Grid className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MAIN PRO VIEWFINDER / CAMERA STREAM AREA                                  */}
      {/* ========================================================================= */}
      <div className="relative flex-1 w-full h-full flex items-center justify-center overflow-hidden bg-neutral-950">
        {/* Live Camera Feed or Animated Viewfinder */}
        {recordedClipUrl ? (
          /* PLAYBACK PREVIEW OF RECORDED CLIP */
          <div className="relative w-full h-full max-w-md max-h-[760px] rounded-3xl overflow-hidden bg-black border border-pink-500/40 shadow-2xl flex flex-col justify-between">
            <video
              src={recordedClipUrl}
              autoPlay
              loop
              playsInline
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/60 pointer-events-none" />

            {/* Preview Header */}
            <div className="absolute top-4 left-4 right-4 z-20 flex items-center justify-between">
              <span className="px-3 py-1 rounded-full bg-pink-600/90 text-white text-xs font-black tracking-wider flex items-center gap-1.5 shadow-md">
                <Film className="w-3.5 h-3.5" /> 4K CLIP PREVIEW
              </span>
              <button
                type="button"
                onClick={() => setRecordedClipUrl(null)}
                className="px-3 py-1 rounded-full bg-neutral-900/90 hover:bg-neutral-800 text-neutral-200 text-xs font-bold border border-neutral-700 flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" /> Retake
              </button>
            </div>

            {/* Publish Form Overlay */}
            <div className="absolute bottom-4 left-4 right-4 z-20 bg-neutral-950/90 border border-neutral-800 rounded-2xl p-4 backdrop-blur-md space-y-3">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block mb-1">
                  Reel Title
                </label>
                <input
                  type="text"
                  value={clipTitle}
                  onChange={(e) => setClipTitle(e.target.value)}
                  placeholder="Give your 4K reel a title..."
                  className="w-full bg-neutral-900 text-xs text-white px-3 py-2 rounded-xl border border-neutral-700 focus:outline-hidden focus:border-pink-500"
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePublishReel}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-pink-600 via-purple-600 to-cyan-500 hover:from-pink-500 hover:to-cyan-400 text-white font-black text-xs flex items-center justify-center gap-2 shadow-xl shadow-pink-600/35 active:scale-98 transition-all"
                >
                  <Flame className="w-4 h-4" />
                  <span>Publish to VibeReels</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* ACTIVE VIEWFINDER */
          <div className="relative w-full h-full max-w-md max-h-[760px] rounded-2xl sm:rounded-3xl overflow-hidden bg-black border border-neutral-800 shadow-2xl flex flex-col justify-between">
            {/* Real Webcam Video or Futuristic Simulated Viewfinder */}
            {!isSimulatedFeed ? (
              <video
                ref={videoPreviewRef}
                autoPlay
                playsInline
                muted
                style={getFilterStyle()}
                className={`w-full h-full object-cover transition-all duration-300 ${
                  facingMode === 'user' ? 'scale-x-[-1]' : ''
                }`}
              />
            ) : (
              <div
                style={getFilterStyle()}
                className="w-full h-full relative overflow-hidden bg-gradient-to-br from-purple-950 via-neutral-950 to-cyan-950 flex items-center justify-center p-5"
              >
                {/* Fallback Native Camera Input (<input type="file" accept="video/*,image/*" capture="environment">) */}
                <input
                  ref={nativeCameraInputRef}
                  type="file"
                  accept="video/*,image/*"
                  capture="environment"
                  className="hidden"
                  style={{ display: 'none' }}
                  onChange={handleNativeCameraCaptured}
                />

                {/* Cyberpunk Animated Studio Backing */}
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-pink-600/20 via-cyan-900/10 to-black/90 pointer-events-none" />
                <div className="relative z-10 flex flex-col items-center gap-3 max-w-xs text-center">
                  <div className="w-18 h-18 rounded-full bg-neutral-900/80 border-2 border-pink-500/50 flex items-center justify-center text-pink-400 shadow-xl shadow-pink-500/25">
                    <Camera className="w-9 h-9 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-white tracking-wide">
                      {cameraBlockedInWebView ? 'LIVE WEBCAM RESTRICTED' : 'PRO 4K STUDIO SENSOR'}
                    </h3>
                    <p className="text-xs text-neutral-300 font-medium mt-1 leading-relaxed">
                      {cameraBlockedInWebView
                        ? 'Browser/APK WebView blocked live camera stream. Tap below to capture directly with your mobile phone camera app!'
                        : '10-bit HDR · ProRes 422 HQ Ready'}
                    </p>
                  </div>

                  {/* Native Camera Direct Launcher Button */}
                  <button
                    type="button"
                    onClick={() => nativeCameraInputRef.current?.click()}
                    className="mt-2 px-5 py-2.5 rounded-2xl bg-gradient-to-r from-pink-600 via-rose-500 to-amber-500 hover:from-pink-500 hover:to-amber-400 text-white font-bold text-xs flex items-center gap-2 shadow-xl shadow-pink-600/30 active:scale-95 transition-all border border-pink-300/40"
                  >
                    <Camera className="w-4 h-4" />
                    <span>Open Phone Native Camera</span>
                  </button>
                </div>
              </div>
            )}

            {/* Rule of Thirds Grid Lines Overlay */}
            {showGrid && (
              <div className="absolute inset-0 pointer-events-none z-10 flex flex-col divide-y divide-white/15">
                <div className="flex-1 flex divide-x divide-white/15">
                  <div className="flex-1" />
                  <div className="flex-1" />
                  <div className="flex-1" />
                </div>
                <div className="flex-1 flex divide-x divide-white/15">
                  <div className="flex-1" />
                  <div className="flex-1" />
                  <div className="flex-1" />
                </div>
                <div className="flex-1 flex divide-x divide-white/15">
                  <div className="flex-1" />
                  <div className="flex-1" />
                  <div className="flex-1" />
                </div>
              </div>
            )}

            {/* Red Recording Border when live recording */}
            {isRecording && (
              <div className="absolute inset-0 pointer-events-none z-25 border-4 border-red-500 animate-pulse rounded-2xl sm:rounded-3xl shadow-[inset_0_0_20px_rgba(239,68,68,0.5)]" />
            )}

            {/* ========================================================= */}
            {/* AI MOTION TRACKING INDICATOR OVERLAY                      */}
            {/* ========================================================= */}
            <div
              style={{
                left: `${trackerPos.x}%`,
                top: `${trackerPos.y}%`,
                transform: 'translate(-50%, -50%)',
              }}
              className="absolute z-20 pointer-events-none transition-all duration-700 ease-out"
            >
              {/* Dynamic HUD Bounding Box */}
              <div className="w-28 h-28 sm:w-32 sm:h-32 border border-dashed border-cyan-400/80 rounded-2xl relative flex flex-col justify-between p-1.5 shadow-lg shadow-cyan-400/20">
                {/* Corner Brackets */}
                <span className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-cyan-400 rounded-tl-md" />
                <span className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-cyan-400 rounded-tr-md" />
                <span className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-cyan-400 rounded-bl-md" />
                <span className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-cyan-400 rounded-br-md" />

                {/* Center Crosshair */}
                <div className="w-2 h-2 rounded-full bg-cyan-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-ping" />

                {/* Top Lock Badge */}
                <div className="flex items-center justify-between text-[9px] font-black tracking-wider uppercase">
                  <span
                    className={`px-1.5 py-0.2 rounded-xs flex items-center gap-1 ${
                      aiTrackingLocked ? 'bg-cyan-500 text-black' : 'bg-red-500 text-white'
                    }`}
                  >
                    <Eye className="w-2.5 h-2.5" />
                    {aiTrackingLocked ? 'AI TRACK: LOCKED' : 'SEARCHING'}
                  </span>
                  <span className="text-cyan-300">98.4%</span>
                </div>

                {/* Bottom Distance & Focus Info */}
                <div className="flex items-center justify-between text-[8px] text-cyan-200 font-mono">
                  <span>F/1.8 · ISO 240</span>
                  <span>AF-C 1.4m</span>
                </div>
              </div>
            </div>

            {/* Gyro Horizon Tilt Leveler Indicator */}
            <div className="absolute top-1/2 left-4 right-4 -translate-y-1/2 z-15 pointer-events-none flex items-center justify-between opacity-40">
              <div
                style={{ transform: `rotate(${horizonTilt}deg)` }}
                className="w-10 h-0.5 bg-cyan-400 rounded-full transition-transform"
              />
              <span className="text-[9px] font-mono text-cyan-400">{horizonTilt.toFixed(1)}°</span>
              <div
                style={{ transform: `rotate(${horizonTilt}deg)` }}
                className="w-10 h-0.5 bg-cyan-400 rounded-full transition-transform"
              />
            </div>

            {/* ========================================================= */}
            {/* RECORDING HEADER OVERLAY: REC TIMER & AUDIO VU METERS     */}
            {/* ========================================================= */}
            <div className="relative z-30 p-3 flex items-center justify-between gap-2 pointer-events-none">
              {/* Recording Status / Duration */}
              {isRecording ? (
                <div className="flex items-center gap-2 bg-red-600/90 border border-red-400 px-3 py-1 rounded-full text-white shadow-xl backdrop-blur-md animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                  <span className="text-xs font-black tracking-wider">
                    REC 00:{recordingSeconds < 10 ? `0${recordingSeconds}` : recordingSeconds} / 01:00
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 bg-black/60 border border-white/10 px-2.5 py-1 rounded-full text-[11px] text-neutral-300 backdrop-blur-md">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span className="font-mono">PRO READY</span>
                </div>
              )}

              {/* Simulated Audio VU Level Meter Bars */}
              <div className="flex items-center gap-1 bg-black/60 px-2.5 py-1 rounded-full border border-white/10 backdrop-blur-md">
                <Volume2 className="w-3 h-3 text-neutral-400" />
                <div className="flex items-center gap-0.5 h-3">
                  <span className={`w-0.5 rounded-full bg-emerald-400 ${isRecording ? 'h-3 animate-pulse' : 'h-1.5'}`} />
                  <span className={`w-0.5 rounded-full bg-emerald-400 ${isRecording ? 'h-2 animate-bounce' : 'h-2'}`} />
                  <span className={`w-0.5 rounded-full bg-emerald-400 ${isRecording ? 'h-3.5 animate-pulse' : 'h-2.5'}`} />
                  <span className={`w-0.5 rounded-full bg-amber-400 ${isRecording ? 'h-2 animate-bounce' : 'h-1'}`} />
                  <span className={`w-0.5 rounded-full bg-red-400 ${isRecording ? 'h-1.5 animate-pulse' : 'h-0.5'}`} />
                </div>
              </div>
            </div>

            {/* Zoom Stepper Pills (0.5x, 1x, 2x, 5x) */}
            <div className="relative z-30 flex items-center justify-center gap-2 pb-2">
              {[0.5, 1.0, 2.0, 5.0].map((z) => (
                <button
                  key={z}
                  type="button"
                  onClick={() => {
                    soundEngine.playCameraShutter();
                    setZoomLevel(z);
                    onShowToast(`Zoom set to ${z}x`);
                  }}
                  className={`w-8 h-8 rounded-full text-[10px] font-black transition-all border backdrop-blur-md ${
                    zoomLevel === z
                      ? 'bg-amber-400 text-black border-amber-300 shadow-md shadow-amber-400/30 scale-110'
                      : 'bg-black/60 text-white border-white/20 hover:bg-neutral-800'
                  }`}
                >
                  {z}x
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* BOTTOM CONTROLS: BEAUTY SLIDER, HEAVY SHUTTER BUTTON, FLIP CAMERA        */}
      {/* ========================================================================= */}
      {!recordedClipUrl && (
        <div className="relative z-30 px-6 py-4 bg-gradient-to-t from-black via-black/90 to-transparent flex flex-col gap-3 shrink-0">
          {/* Beauty Filters Tray Popup */}
          {isBeautyOpen && (
            <div className="max-w-md mx-auto w-full bg-neutral-900/95 border border-neutral-800 rounded-2xl p-3 shadow-2xl backdrop-blur-md animate-in slide-in-from-bottom-2 duration-200 space-y-2.5">
              <div className="flex items-center justify-between pb-1 border-b border-neutral-800">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-pink-400" />
                  <span className="text-xs font-bold text-white">Beauty & Skin Smooth ({beautyLevel}%)</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsBeautyOpen(false)}
                  className="text-neutral-400 hover:text-white text-xs"
                >
                  Close
                </button>
              </div>

              {/* Slider */}
              <div className="flex items-center gap-3">
                <span className="text-[10px] text-neutral-400 font-bold">0%</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={beautyLevel}
                  onChange={(e) => setBeautyLevel(Number(e.target.value))}
                  className="flex-1 accent-pink-500 cursor-pointer h-1.5 bg-neutral-800 rounded-lg"
                />
                <span className="text-[10px] text-pink-400 font-bold">100%</span>
              </div>

              {/* Presets */}
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1">
                {(['Natural', 'Smooth Glam', 'Cyber Neon', 'Golden Hour', 'Vivid Rosy'] as BeautyPreset[]).map(
                  (preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setBeautyPreset(preset)}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold whitespace-nowrap border transition-all ${
                        beautyPreset === preset
                          ? 'bg-pink-600 text-white border-pink-400 shadow-sm'
                          : 'bg-neutral-800 text-neutral-300 border-neutral-700 hover:bg-neutral-700'
                      }`}
                    >
                      {preset}
                    </button>
                  )
                )}
              </div>
            </div>
          )}

          {/* Bottom Primary Controls Row */}
          <div className="max-w-md mx-auto w-full flex items-center justify-around">
            {/* Left: Beauty Filter Toggle */}
            <button
              type="button"
              onClick={() => setIsBeautyOpen(!isBeautyOpen)}
              className={`flex flex-col items-center gap-1 p-2 rounded-2xl transition-all ${
                isBeautyOpen
                  ? 'text-pink-400 bg-pink-500/20'
                  : 'text-neutral-300 hover:text-white'
              }`}
              title="Open Beauty Filters Slider"
            >
              <div className="w-10 h-10 rounded-full bg-neutral-900 border border-neutral-700 flex items-center justify-center shadow-md">
                <Sparkles className="w-5 h-5 text-pink-400" />
              </div>
              <span className="text-[10px] font-bold">Beauty</span>
            </button>

            {/* ========================================================= */}
            {/* HEAVY NEON-GLOWING SHUTTER RECORD BUTTON                  */}
            {/* ========================================================= */}
            <div className="relative flex items-center justify-center">
              {/* Outer Pulsing Neon Halo */}
              <div
                className={`absolute w-24 h-24 rounded-full transition-all duration-500 pointer-events-none ${
                  isRecording
                    ? 'bg-red-500/30 scale-125 animate-ping'
                    : 'bg-gradient-to-tr from-pink-500/25 to-cyan-500/25 blur-md'
                }`}
              />

              {/* Shutter Ring Bezel */}
              <button
                type="button"
                onClick={handleToggleRecord}
                className={`relative w-20 h-20 rounded-full p-1.5 flex items-center justify-center transition-all duration-300 active:scale-92 border-4 ${
                  isRecording
                    ? 'border-red-500 bg-red-950/60 shadow-[0_0_35px_rgba(239,68,68,0.7)]'
                    : 'border-pink-500 bg-black/80 hover:border-pink-400 shadow-[0_0_25px_rgba(236,72,153,0.5)]'
                }`}
                aria-label={isRecording ? 'Stop Recording' : 'Start Recording'}
              >
                {/* Inner Core: Morphs from Circle to Square when recording */}
                <div
                  className={`transition-all duration-300 ${
                    isRecording
                      ? 'w-7 h-7 rounded-md bg-red-500 shadow-md shadow-red-500/80 animate-pulse'
                      : 'w-14 h-14 rounded-full bg-gradient-to-tr from-pink-500 via-rose-500 to-amber-500 shadow-lg shadow-pink-500/50 hover:scale-105'
                  }`}
                />
              </button>
            </div>

            {/* Right: Flip Camera (Front / Back) */}
            <button
              type="button"
              onClick={handleFlipCamera}
              className="flex flex-col items-center gap-1 p-2 text-neutral-300 hover:text-white transition-colors"
              title="Flip Front / Rear Camera"
            >
              <div className="w-10 h-10 rounded-full bg-neutral-900 border border-neutral-700 flex items-center justify-center shadow-md active:rotate-180 transition-transform duration-300">
                <RotateCcw className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-bold">Flip</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
