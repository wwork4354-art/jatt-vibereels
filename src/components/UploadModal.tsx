import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  X,
  Upload,
  Video,
  Image as ImageIcon,
  Sparkles,
  Music,
  Search,
  Play,
  Pause,
  Volume2,
  FileAudio,
  Check,
  Trash2,
  Lock,
  Download,
} from 'lucide-react';
import { VideoPost, UserAccount, CreatorProfileData, AudioTrackOption } from '../types';
import {
  uploadMediaToReelsBucket,
  createGlobalPostInSupabase,
  getOrCreateUserProfileId,
  fileToPersistentDataUrl,
  saveLocalPostRecord,
  savePostAudioMeta,
  savePostPrivacyMeta,
} from '../lib/supabaseService';
import { compressImageFile } from '../utils/imageOptimize';
import { searchAudioLibrary } from '../data/audioLibrary';
import { soundEngine } from '../utils/soundEngine';
import { savePostForOffline } from '../lib/offlineMediaStore';
import {
  sanitizeInputLive,
  sanitizeText,
  sanitizeHashtagsInput,
  sanitizeUsername,
  sanitizeSafeUrl,
  validateSafeMediaFile,
  validateSafeAudioFile,
  checkRateLimit,
  recordRateLimitEvent,
} from '../utils/security';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserAccount | null;
  creatorProfile?: CreatorProfileData;
  preselectedFile?: File | null;
  onUploadSuccess: (newPost: VideoPost) => void;
  onUploadCloudSynced?: (tempId: string, syncedPost: VideoPost) => void;
  onShowToast?: (msg: string) => void;
}

export const UploadModal: React.FC<UploadModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  creatorProfile,
  preselectedFile,
  onUploadSuccess,
  onUploadCloudSynced,
  onShowToast,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [hashtagsStr, setHashtagsStr] = useState('#foryou #viral #aesthetic');
  const [creatorName, setCreatorName] = useState(
    currentUser?.name || creatorProfile?.name || 'Jatt Creator'
  );
  const [videoSourceType, setVideoSourceType] = useState<'file' | 'url'>('file');
  const [videoUrlInput, setVideoUrlInput] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedMediaType, setSelectedMediaType] = useState<'video' | 'image'>('video');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [category, setCategory] = useState<VideoPost['category']>('trending');
  const [allowDownload, setAllowDownload] = useState<boolean>(true);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSecurityError, setUploadSecurityError] = useState('');

  // Song / Naat / Background Audio Picker State
  const [isAudioPanelOpen, setIsAudioPanelOpen] = useState(true);
  const [audioSearch, setAudioSearch] = useState('');
  const [audioCategory, setAudioCategory] = useState<'all' | 'naat' | 'song' | 'beat'>('all');
  const [selectedLibraryTrack, setSelectedLibraryTrack] = useState<AudioTrackOption | null>(null);
  const [selectedAudioFile, setSelectedAudioFile] = useState<File | null>(null);
  const [selectedAudioPreviewUrl, setSelectedAudioPreviewUrl] = useState<string | null>(null);
  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const [originalVolume, setOriginalVolume] = useState<number>(100);
  const [bgAudioVolume, setBgAudioVolume] = useState<number>(80);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const audioFileInputRef = useRef<HTMLInputElement | null>(null);
  const customAudioPreviewRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (currentUser) {
      setCreatorName(currentUser.name);
    } else if (creatorProfile) {
      setCreatorName(creatorProfile.name);
    }
  }, [currentUser, creatorProfile]);

  // Apply preselected file when opened from Mobile "+" sheet
  useEffect(() => {
    if (isOpen && preselectedFile) {
      processFile(preselectedFile);
      setVideoSourceType('file');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, preselectedFile]);

  // Stop any audio previews on close or unmount
  useEffect(() => {
    if (!isOpen) {
      soundEngine.stopPreviewTrack();
      setPreviewingId(null);
      if (customAudioPreviewRef.current) {
        customAudioPreviewRef.current.pause();
      }
    }
    return () => {
      soundEngine.stopPreviewTrack();
      if (customAudioPreviewRef.current) {
        customAudioPreviewRef.current.pause();
      }
    };
  }, [isOpen]);

  const filteredAudioTracks = useMemo(
    () => searchAudioLibrary(audioSearch, audioCategory),
    [audioSearch, audioCategory]
  );

  if (!isOpen) return null;

  const processFile = (file: File) => {
    setUploadSecurityError('');
    const check = validateSafeMediaFile(file);
    if (!check.valid) {
      const msg =
        check.reason ||
        'Blocked unsafe file. Only .mp4, .webm, .jpg, .png, and .webp are allowed.';
      setUploadSecurityError(msg);
      onShowToast?.(msg);
      return;
    }

    setSelectedFile(file);
    const isImg = check.mediaType === 'image';
    setSelectedMediaType(isImg ? 'image' : 'video');
    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    if (!title) {
      const safeName = sanitizeText(
        file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' '),
        100
      );
      if (safeName) setTitle(safeName);
    }
    if (isImg) {
      setIsAudioPanelOpen(true);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleAudioFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const audioCheck = validateSafeAudioFile(file);
    if (!audioCheck.valid) {
      const msg = audioCheck.reason || 'Blocked invalid audio file.';
      setUploadSecurityError(msg);
      onShowToast?.(msg);
      e.target.value = '';
      return;
    }

    setUploadSecurityError('');
    soundEngine.stopPreviewTrack();
    if (selectedAudioPreviewUrl && selectedAudioPreviewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(selectedAudioPreviewUrl);
    }

    const objUrl = URL.createObjectURL(file);
    setSelectedAudioFile(file);
    setSelectedAudioPreviewUrl(objUrl);
    setSelectedLibraryTrack(null);
    setPreviewingId(null);
    onShowToast?.(`Attached audio: ${sanitizeText(file.name, 60)}`);
    e.target.value = '';
  };

  const handleTogglePreviewLibraryTrack = (track: AudioTrackOption) => {
    if (customAudioPreviewRef.current) {
      customAudioPreviewRef.current.pause();
    }
    if (previewingId === track.id) {
      soundEngine.stopPreviewTrack();
      setPreviewingId(null);
    } else {
      soundEngine.playPreviewTrack(track.trackType, bgAudioVolume / 100);
      setPreviewingId(track.id);
    }
  };

  const handleTogglePreviewCustomAudio = () => {
    soundEngine.stopPreviewTrack();
    const audioEl = customAudioPreviewRef.current;
    if (!audioEl || !selectedAudioPreviewUrl) return;

    if (previewingId === 'custom-file') {
      audioEl.pause();
      setPreviewingId(null);
    } else {
      audioEl.volume = bgAudioVolume / 100;
      void audioEl.play().catch(() => {});
      setPreviewingId('custom-file');
    }
  };

  const handleClearAttachedAudio = () => {
    soundEngine.stopPreviewTrack();
    if (customAudioPreviewRef.current) {
      customAudioPreviewRef.current.pause();
    }
    if (selectedAudioPreviewUrl && selectedAudioPreviewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(selectedAudioPreviewUrl);
    }
    setSelectedLibraryTrack(null);
    setSelectedAudioFile(null);
    setSelectedAudioPreviewUrl(null);
    setPreviewingId(null);
  };

  const hasCustomAudioAttached = Boolean(selectedAudioFile || selectedLibraryTrack);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setUploadSecurityError('');

    // Anti-spam rate limit: max 5 uploads per minute
    const rate = checkRateLimit('upload');
    if (!rate.allowed) {
      const msg = `Upload rate limit reached: Max 5 uploads per minute. Please wait ${rate.retryAfterSeconds}s.`;
      setUploadSecurityError(msg);
      onShowToast?.(msg);
      return;
    }

    if (videoSourceType === 'file') {
      if (!selectedFile) {
        setUploadSecurityError('Please select a safe .mp4, .webm, .jpg, .png, or .webp file.');
        return;
      }
      const check = validateSafeMediaFile(selectedFile);
      if (!check.valid) {
        setUploadSecurityError(check.reason || 'Unsafe file rejected.');
        return;
      }
    }

    const urlTrimmed = videoUrlInput.trim();
    let safeExternalUrl = '';
    if (videoSourceType === 'url' && urlTrimmed) {
      safeExternalUrl = sanitizeSafeUrl(urlTrimmed, {
        allowBlob: false,
        allowDataImageAudio: false,
      });
      if (!safeExternalUrl) {
        setUploadSecurityError('Blocked unsafe URL. Only valid http:// or https:// media links are allowed.');
        return;
      }
    }

    soundEngine.stopPreviewTrack();
    if (customAudioPreviewRef.current) {
      customAudioPreviewRef.current.pause();
    }
    setIsUploading(true);
    recordRateLimitEvent('upload');

    const inferredUrlMediaType: 'video' | 'image' =
      /\.(jpg|jpeg|png|webp)(\?|$)/i.test(safeExternalUrl) ? 'image' : 'video';

    const mediaType: 'video' | 'image' =
      videoSourceType === 'file' && selectedFile ? selectedMediaType : inferredUrlMediaType;

    // Preserve an independent local object URL so closing modal doesn't revoke feed preview
    const instantMediaUrl =
      videoSourceType === 'file' && selectedFile
        ? URL.createObjectURL(selectedFile)
        : safeExternalUrl ||
          'https://upload.wikimedia.org/wikipedia/commons/4/47/Astrophysics_Holiday_Vertical_Video_%28SVS14800_-_Fermi_YuleLog_Rotate_Reel%29.webm';

    const instantAudioUrl = selectedAudioFile ? URL.createObjectURL(selectedAudioFile) : undefined;

    const userId = creatorProfile?.id || currentUser?.id || getOrCreateUserProfileId();
    const authorName =
      sanitizeText(
        currentUser?.name || creatorProfile?.name || creatorName || 'Jatt Creator',
        80
      ) || 'Jatt Creator';
    const authorUsername =
      sanitizeUsername(
        currentUser?.username ||
          creatorProfile?.username ||
          creatorName.replace(/\s+/g, '_') ||
          'jatt_official',
        40
      ) || 'jatt_official';
    const authorAvatar =
      sanitizeSafeUrl(currentUser?.avatar || creatorProfile?.avatar || '') ||
      `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(
        authorUsername
      )}&backgroundColor=ec4899`;

    const cleanTitle = sanitizeText(title, 140) || 'My New Post';
    const cleanDescription = sanitizeText(description, 400);
    const cleanHashtagsStr = sanitizeText(hashtagsStr, 200);

    const tags = cleanHashtagsStr
      .split(/[\s,]+/)
      .map((t) => sanitizeUsername(t.replace(/^#/, ''), 32))
      .filter(Boolean);
    const captionText = `${cleanTitle}${
      cleanDescription ? ` - ${cleanDescription}` : ''
    } ${tags.map((t) => `#${t}`).join(' ')}`.trim();

    const instantSound: VideoPost['sound'] = selectedAudioFile
      ? {
          title: sanitizeText(selectedAudioFile.name.replace(/\.[^/.]+$/, ''), 80) || 'Attached Audio',
          artist: authorName,
          trackType: 'ambient_lofi',
          audioUrl: instantAudioUrl,
          category: 'song',
          originalVolume: mediaType === 'video' ? originalVolume / 100 : 0,
          bgAudioVolume: bgAudioVolume / 100,
          hasAttachedAudio: true,
        }
      : selectedLibraryTrack
      ? {
          title: selectedLibraryTrack.title,
          artist: selectedLibraryTrack.artist,
          trackType: selectedLibraryTrack.trackType,
          category: selectedLibraryTrack.category,
          originalVolume: mediaType === 'video' ? originalVolume / 100 : 0,
          bgAudioVolume: bgAudioVolume / 100,
          hasAttachedAudio: true,
        }
      : {
          title:
            mediaType === 'image'
              ? `${authorName}'s Photo Vibe`
              : `${authorName}'s Original Audio`,
          artist: authorName,
          trackType: mediaType === 'image' ? 'ambient_lofi' : 'future_bass',
          category: mediaType === 'image' ? 'beat' : 'original',
          originalVolume: mediaType === 'video' ? originalVolume / 100 : 0,
          bgAudioVolume: mediaType === 'image' ? bgAudioVolume / 100 : 0,
          hasAttachedAudio: mediaType === 'image',
        };

    const tempPostId = `user-vid-${Date.now()}`;
    const optimisticPost: VideoPost = {
      id: tempPostId,
      title: cleanTitle,
      description: captionText,
      hashtags: tags.length ? tags : ['foryou', 'trending'],
      videoUrl: instantMediaUrl,
      posterUrl: mediaType === 'image' ? instantMediaUrl : undefined,
      fallbackGradient: 'from-pink-950 via-purple-950 to-neutral-950',
      category,
      userId,
      mediaType,
      allowDownload,
      isUserUploaded: true,
      createdAt: new Date().toISOString(),
      creator: {
        name: authorName,
        username: authorUsername,
        avatar: authorAvatar,
        isVerified: currentUser?.role === 'admin' || currentUser?.role === 'creator',
        isFollowing: false,
        bio: currentUser?.bio || creatorProfile?.bio || 'Creator on VibeReels',
      },
      stats: {
        views: 0,
        likes: 0,
        comments: 0,
        shares: 0,
        saves: 0,
        downloads: 0,
      },
      isLiked: false,
      isSaved: false,
      sound: instantSound,
      commentsList: [],
    };

    // 1. Instant local playback & feed publish (zero lag)
    savePostPrivacyMeta([tempPostId, instantMediaUrl], allowDownload);
    savePostAudioMeta([tempPostId, instantMediaUrl], instantSound);
    saveLocalPostRecord(optimisticPost);
    onUploadSuccess(optimisticPost);
    setIsUploading(false);
    onClose();

    // 2. Background upload & cloud sync (does not block UI or playback)
    const pickedFile = videoSourceType === 'file' ? selectedFile : null;
    const pickedAudio = selectedAudioFile;
    const pickedAllowDl = allowDownload;
    const isDeviceOnline = typeof navigator === 'undefined' ? true : navigator.onLine;

    void (async () => {
      try {
        let finalMediaUrl = instantMediaUrl;
        let processedMediaBlob: Blob | undefined = pickedFile || undefined;

        if (pickedFile) {
          const fileToUpload =
            mediaType === 'image'
              ? await compressImageFile(pickedFile, 1080, 0.82)
              : pickedFile;
          processedMediaBlob = fileToUpload;

          if (isDeviceOnline) {
            const uploadedUrl = await uploadMediaToReelsBucket(
              fileToUpload,
              'posts',
              fileToUpload.name
            );
            if (uploadedUrl) {
              finalMediaUrl = uploadedUrl;
            } else {
              const dataUrl = await fileToPersistentDataUrl(fileToUpload);
              if (dataUrl) finalMediaUrl = dataUrl;
            }
          }
        }

        let finalAudioUrl: string | undefined = instantAudioUrl;
        if (pickedAudio && isDeviceOnline) {
          const uploadedAudioUrl = await uploadMediaToReelsBucket(
            pickedAudio,
            'audio',
            pickedAudio.name
          );
          if (uploadedAudioUrl) {
            finalAudioUrl = uploadedAudioUrl;
          } else {
            const audioDataUrl = await fileToPersistentDataUrl(pickedAudio, 3_500_000);
            if (audioDataUrl) finalAudioUrl = audioDataUrl;
          }
        }

        const syncedSound: VideoPost['sound'] = pickedAudio
          ? { ...instantSound, audioUrl: finalAudioUrl }
          : instantSound;

        const supabasePost = isDeviceOnline
          ? await createGlobalPostInSupabase({
              userId,
              username: authorUsername,
              displayName: authorName,
              avatarUrl: authorAvatar,
              mediaUrl: finalMediaUrl,
              mediaType,
              caption: captionText,
              allowDownload: pickedAllowDl,
              sound: syncedSound,
            })
          : null;

        const finalSyncedPost: VideoPost = supabasePost
          ? {
              ...supabasePost,
              allowDownload: pickedAllowDl,
              sound: syncedSound,
            }
          : {
              ...optimisticPost,
              videoUrl: finalMediaUrl,
              posterUrl: mediaType === 'image' ? finalMediaUrl : undefined,
              sound: syncedSound,
            };

        savePostPrivacyMeta([finalSyncedPost.id, finalMediaUrl, tempPostId], pickedAllowDl);
        savePostAudioMeta([finalSyncedPost.id, finalMediaUrl], syncedSound);
        saveLocalPostRecord(finalSyncedPost);

        await savePostForOffline(finalSyncedPost, {
          mediaBlob: processedMediaBlob,
          audioBlob: pickedAudio || undefined,
          sourceType: 'uploaded',
          skipRemoteFetch: true,
        });

        onUploadCloudSynced?.(tempPostId, finalSyncedPost);
      } catch (err) {
        console.warn('Background upload sync warning:', err);
      }
    })();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto"
      onClick={onClose}
    >
      {/* Hidden audio preview element for picked MP3/M4A files */}
      <audio
        ref={customAudioPreviewRef}
        src={selectedAudioPreviewUrl || undefined}
        onEnded={() => setPreviewingId(null)}
        className="hidden"
      />

      <div
        className="w-full max-w-xl bg-neutral-900 border border-neutral-800 rounded-2xl p-5 sm:p-6 shadow-2xl animate-in fade-in duration-150 my-auto max-h-[92vh] overflow-y-auto no-scrollbar"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-neutral-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-pink-600/30 to-cyan-500/30 border border-pink-500/40 text-pink-400 flex items-center justify-center">
              <Upload className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-black text-white tracking-tight">
                Upload Video or Photo + Song / Naat
              </h3>
              <p className="text-xs text-neutral-400">
                Post videos or images with background Songs, Naats, or MP3 audio
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-white rounded-full hover:bg-neutral-800 transition-colors"
            aria-label="Close upload modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {uploadSecurityError && (
            <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/45 text-xs text-rose-200 font-semibold">
              {uploadSecurityError}
            </div>
          )}

          {/* Source Toggle */}
          <div className="flex bg-neutral-950 p-1 rounded-xl border border-neutral-800 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setVideoSourceType('file')}
              className={`flex-1 py-2 rounded-lg transition-colors flex items-center justify-center gap-1.5 ${
                videoSourceType === 'file'
                  ? 'bg-neutral-800 text-white shadow-xs'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <ImageIcon className="w-3.5 h-3.5 text-cyan-400" />
              <span>Choose Video / Image File</span>
            </button>
            <button
              type="button"
              onClick={() => setVideoSourceType('url')}
              className={`flex-1 py-2 rounded-lg transition-colors ${
                videoSourceType === 'url'
                  ? 'bg-neutral-800 text-white shadow-xs'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              Paste Media URL
            </button>
          </div>

          {/* File Picker or URL Input */}
          {videoSourceType === 'file' ? (
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".mp4,.webm,.jpg,.jpeg,.png,.webp,video/mp4,video/webm,image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleFileChange}
              />
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-xl p-5 flex flex-col items-center justify-center cursor-pointer transition-all ${
                  isDragging
                    ? 'border-pink-500 bg-pink-500/10 scale-[1.01]'
                    : 'border-neutral-700 hover:border-pink-500/80 bg-neutral-950/40 hover:bg-pink-950/10'
                }`}
              >
                {previewUrl ? (
                  <div className="flex flex-col items-center">
                    <div className="relative">
                      {selectedMediaType === 'image' ? (
                        <img
                          src={previewUrl}
                          alt="Preview"
                          className="w-28 h-44 object-cover rounded-xl shadow-lg mb-2 border border-neutral-700"
                        />
                      ) : (
                        <video
                          src={previewUrl}
                          preload="auto"
                          playsInline
                          className="w-28 h-44 object-cover rounded-xl shadow-lg mb-2 border border-neutral-700 [transform:translate3d(0,0,0)]"
                          muted
                          autoPlay
                          loop
                        />
                      )}
                      {selectedMediaType === 'image' && hasCustomAudioAttached && (
                        <span className="absolute bottom-3 left-1.5 right-1.5 px-2 py-0.5 rounded-full bg-black/85 border border-pink-500/50 text-[9px] font-black text-pink-300 text-center truncate">
                          🎵 Audio-Visual
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-pink-400 font-semibold truncate max-w-xs">
                      {selectedFile?.name}
                    </p>
                    <p className="text-[11px] text-neutral-500">
                      Click or drop another video or photo to replace
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="w-12 h-12 rounded-full bg-neutral-800 flex items-center justify-center text-neutral-400 mb-2 gap-1">
                      <Video className="w-5 h-5 text-pink-400" />
                      <ImageIcon className="w-4 h-4 text-cyan-400" />
                    </div>
                    <p className="text-sm font-semibold text-white">
                      Select video or image (photo) to upload
                    </p>
                    <p className="text-xs text-neutral-400 mt-1">
                      Supports safe MP4, WebM, JPG, PNG, WebP only
                    </p>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-neutral-300 mb-1">
                Direct Video or Image URL (.mp4 / .webm / .jpg / .png)
              </label>
              <input
                type="url"
                value={videoUrlInput}
                onChange={(e) => setVideoUrlInput(sanitizeInputLive(e.target.value, 500))}
                placeholder="https://example.com/video.mp4 or photo.jpg"
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-hidden focus:border-pink-500"
              />
            </div>
          )}

          {/* ===================================================== */}
          {/* ADD SONG / NAAT / AUDIO SECTION                        */}
          {/* ===================================================== */}
          <div className="rounded-2xl bg-neutral-950/90 border border-neutral-800 p-3.5 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setIsAudioPanelOpen(!isAudioPanelOpen)}
                className="flex items-center gap-2 text-left"
              >
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-pink-600/25 to-purple-600/25 border border-pink-500/40 flex items-center justify-center text-pink-400">
                  <Music className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-black text-white flex items-center gap-1.5">
                    <span>Add Song / Naat / Audio</span>
                    {hasCustomAudioAttached && (
                      <span className="px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[9px] font-black">
                        Attached
                      </span>
                    )}
                  </h4>
                  <p className="text-[11px] text-neutral-400">
                    Search songs &amp; naats or pick MP3/M4A from device
                  </p>
                </div>
              </button>

              <div className="flex items-center gap-1.5">
                <input
                  ref={audioFileInputRef}
                  type="file"
                  accept=".mp3,.m4a,.wav,.ogg,audio/mpeg,audio/mp4,audio/wav,audio/ogg"
                  className="hidden"
                  onChange={handleAudioFileSelected}
                />
                <button
                  type="button"
                  onClick={() => audioFileInputRef.current?.click()}
                  className="px-2.5 py-1.5 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/40 text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer"
                  title="Pick MP3 / M4A / WAV audio file from device"
                >
                  <FileAudio className="w-3.5 h-3.5" />
                  <span>Pick MP3/M4A</span>
                </button>
              </div>
            </div>

            {/* Active Selected Audio Banner */}
            {(selectedAudioFile || selectedLibraryTrack) && (
              <div className="p-2.5 rounded-xl bg-gradient-to-r from-pink-600/15 via-purple-600/15 to-cyan-500/15 border border-pink-500/40 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  {selectedAudioFile && (
                    <button
                      type="button"
                      onClick={handleTogglePreviewCustomAudio}
                      className="w-7 h-7 rounded-full bg-pink-600 text-white flex items-center justify-center shrink-0"
                    >
                      {previewingId === 'custom-file' ? (
                        <Pause className="w-3.5 h-3.5" />
                      ) : (
                        <Play className="w-3.5 h-3.5 translate-x-0.2" />
                      )}
                    </button>
                  )}
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white truncate">
                      {selectedAudioFile
                        ? selectedAudioFile.name
                        : selectedLibraryTrack?.title}
                    </p>
                    <p className="text-[10px] text-cyan-300 truncate">
                      {selectedAudioFile
                        ? 'Custom Device Audio · Ready to mix'
                        : `${selectedLibraryTrack?.artist} · ${selectedLibraryTrack?.category.toUpperCase()}`}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleClearAttachedAudio}
                  className="p-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-rose-400 transition-colors shrink-0"
                  title="Remove attached audio"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Quick One-Tap Trending Music & Naats Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
              <span className="text-[10px] font-black uppercase text-pink-400 shrink-0">
                Quick Add:
              </span>
              {filteredAudioTracks.slice(0, 5).map((chipTrack) => {
                const isSelected = selectedLibraryTrack?.id === chipTrack.id;
                return (
                  <button
                    key={`chip-${chipTrack.id}`}
                    type="button"
                    onClick={() => {
                      setSelectedAudioFile(null);
                      setSelectedAudioPreviewUrl(null);
                      setSelectedLibraryTrack(isSelected ? null : chipTrack);
                      if (!isSelected) {
                        soundEngine.playPreviewTrack(chipTrack.trackType, bgAudioVolume / 100);
                        setPreviewingId(chipTrack.id);
                      } else {
                        soundEngine.stopPreviewTrack();
                        setPreviewingId(null);
                      }
                    }}
                    className={`px-2.5 py-1 rounded-full text-[10px] font-bold whitespace-nowrap border transition-all cursor-pointer shrink-0 flex items-center gap-1 ${
                      isSelected
                        ? 'bg-pink-600 border-pink-400 text-white shadow-sm'
                        : 'bg-neutral-900 hover:bg-neutral-800 border-neutral-700 text-neutral-300'
                    }`}
                  >
                    <Music className="w-2.5 h-2.5 text-pink-300" />
                    <span>{chipTrack.title.split('(')[0].trim()}</span>
                  </button>
                );
              })}
            </div>

            {/* Search & Curated Songs / Naats List */}
            {isAudioPanelOpen && (
              <div className="space-y-2.5">
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="relative flex-1">
                    <Search className="w-3.5 h-3.5 text-pink-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={audioSearch}
                      onChange={(e) => setAudioSearch(sanitizeInputLive(e.target.value, 100))}
                      placeholder="Search songs, naats, Sufi, Punjabi..."
                      className="w-full bg-neutral-900 text-xs text-white placeholder-neutral-500 pl-8 pr-3 py-2 rounded-xl border border-neutral-800 focus:outline-hidden focus:border-pink-500"
                    />
                  </div>
                  <div className="flex items-center gap-1 text-[10px] font-bold">
                    {(['all', 'naat', 'song', 'beat'] as const).map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setAudioCategory(cat)}
                        className={`px-2.5 py-1.5 rounded-lg border transition-colors capitalize cursor-pointer ${
                          audioCategory === cat
                            ? 'bg-pink-600/25 border-pink-500/60 text-pink-300'
                            : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white'
                        }`}
                      >
                        {cat === 'all' ? 'All' : cat === 'naat' ? 'Naats' : `${cat}s`}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Scrollable matching tracks */}
                <div className="max-h-40 overflow-y-auto no-scrollbar space-y-1.5 pr-0.5">
                  {filteredAudioTracks.length === 0 ? (
                    <p className="text-[11px] text-neutral-500 text-center py-3">
                      No matching songs or naats found. Try another search or pick an MP3/M4A file.
                    </p>
                  ) : (
                    filteredAudioTracks.map((track) => {
                      const isSelected = selectedLibraryTrack?.id === track.id;
                      const isPreviewing = previewingId === track.id;
                      return (
                        <div
                          key={track.id}
                          className={`p-2 rounded-xl border flex items-center justify-between gap-2 transition-all ${
                            isSelected
                              ? 'bg-pink-600/15 border-pink-500/60'
                              : 'bg-neutral-900/80 hover:bg-neutral-900 border-neutral-800'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <button
                              type="button"
                              onClick={() => handleTogglePreviewLibraryTrack(track)}
                              className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-colors cursor-pointer ${
                                isPreviewing
                                  ? 'bg-pink-600 text-white'
                                  : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300'
                              }`}
                              title={isPreviewing ? 'Stop preview' : 'Preview audio'}
                            >
                              {isPreviewing ? (
                                <Pause className="w-3.5 h-3.5" />
                              ) : (
                                <Play className="w-3.5 h-3.5 translate-x-0.2" />
                              )}
                            </button>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <p className="text-xs font-bold text-white truncate">
                                  {track.title}
                                </p>
                                <span
                                  className={`px-1.5 py-0.2 rounded-sm text-[9px] font-black uppercase shrink-0 ${
                                    track.category === 'naat'
                                      ? 'bg-emerald-500/20 text-emerald-300'
                                      : track.category === 'song'
                                      ? 'bg-cyan-500/20 text-cyan-300'
                                      : 'bg-purple-500/20 text-purple-300'
                                  }`}
                                >
                                  {track.category}
                                </span>
                              </div>
                              <p className="text-[10px] text-neutral-400 truncate">
                                {track.artist} · {track.duration} · {track.mood}
                              </p>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              setSelectedAudioFile(null);
                              setSelectedAudioPreviewUrl(null);
                              setSelectedLibraryTrack(isSelected ? null : track);
                            }}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold shrink-0 flex items-center gap-1 transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-pink-600 text-white'
                                : 'bg-neutral-800 hover:bg-pink-600/80 text-neutral-200 hover:text-white'
                            }`}
                          >
                            {isSelected ? (
                              <>
                                <Check className="w-3 h-3" />
                                <span>Attached</span>
                              </>
                            ) : (
                              <span>Use</span>
                            )}
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* Volume Mixer Sliders */}
            {(selectedMediaType === 'video' || hasCustomAudioAttached) && (
              <div className="pt-2 border-t border-neutral-800/80 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {selectedMediaType === 'video' && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-semibold text-neutral-300 flex items-center gap-1">
                        <Volume2 className="w-3 h-3 text-cyan-400" />
                        Original Video Vol
                      </span>
                      <span className="font-bold text-cyan-300 tabular-nums">
                        {originalVolume}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={originalVolume}
                      onChange={(e) => setOriginalVolume(Number(e.target.value))}
                      className="w-full accent-cyan-400 cursor-pointer"
                    />
                  </div>
                )}

                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-neutral-300 flex items-center gap-1">
                      <Music className="w-3 h-3 text-pink-400" />
                      Song / Naat Vol
                    </span>
                    <span className="font-bold text-pink-300 tabular-nums">
                      {bgAudioVolume}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={bgAudioVolume}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setBgAudioVolume(val);
                      if (customAudioPreviewRef.current) {
                        customAudioPreviewRef.current.volume = val / 100;
                      }
                    }}
                    className="w-full accent-pink-500 cursor-pointer"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Title & Caption */}
          <div>
            <label className="block text-xs font-semibold text-neutral-300 mb-1">
              Title / Caption
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(sanitizeInputLive(e.target.value, 140))}
              placeholder="e.g. Peaceful Ramadan Sunset or Midnight City Vibes"
              className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-hidden focus:border-pink-500"
            />
          </div>

          {/* Hashtags & Category */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-neutral-300 mb-1">
                Hashtags
              </label>
              <input
                type="text"
                value={hashtagsStr}
                onChange={(e) => setHashtagsStr(sanitizeHashtagsInput(e.target.value, 200))}
                placeholder="#jattvibereels #naat #punjabi"
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-hidden focus:border-pink-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-300 mb-1">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as VideoPost['category'])}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-hidden"
              >
                <option value="trending">Trending</option>
                <option value="music">Music &amp; Naats</option>
                <option value="nature">Nature &amp; Scenery</option>
                <option value="urban">Urban &amp; Cars</option>
                <option value="cute">Cute &amp; Lifestyle</option>
                <option value="creative">Creative &amp; Art</option>
              </select>
            </div>
          </div>

          {/* Creator Download Privacy Toggle */}
          <div className="rounded-2xl bg-neutral-950/90 border border-neutral-800 p-3.5 space-y-2.5">
            <div className="flex items-start gap-2">
              <div className="w-7 h-7 rounded-lg bg-amber-500/15 border border-amber-500/40 text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
                {allowDownload ? <Download className="w-3.5 h-3.5 text-cyan-400" /> : <Lock className="w-3.5 h-3.5 text-amber-400" />}
              </div>
              <div>
                <p className="text-xs font-black text-white leading-snug">
                  Allow others to download your video?
                </p>
                <p className="text-[11px] text-neutral-400">
                  (Kya koi aap ki video download kar sakta hai?)
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setAllowDownload(true)}
                className={`p-2.5 rounded-xl border text-left flex items-center gap-2 transition-all cursor-pointer ${
                  allowDownload
                    ? 'bg-emerald-500/15 border-emerald-400/70 text-emerald-200 shadow-sm'
                    : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white'
                }`}
              >
                <Download className={`w-4 h-4 shrink-0 ${allowDownload ? 'text-emerald-400' : 'text-neutral-500'}`} />
                <div className="min-w-0">
                  <p className="text-xs font-bold leading-tight">Yes, Allow Download</p>
                  <p className="text-[10px] opacity-80 truncate">Viewers can save this video</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setAllowDownload(false)}
                className={`p-2.5 rounded-xl border text-left flex items-center gap-2 transition-all cursor-pointer ${
                  !allowDownload
                    ? 'bg-rose-500/15 border-rose-400/70 text-rose-200 shadow-sm'
                    : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white'
                }`}
              >
                <Lock className={`w-4 h-4 shrink-0 ${!allowDownload ? 'text-rose-400' : 'text-neutral-500'}`} />
                <div className="min-w-0">
                  <p className="text-xs font-bold leading-tight">No, Keep Private (Disable Download)</p>
                  <p className="text-[10px] opacity-80 truncate">Blocks downloads with alert</p>
                </div>
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-neutral-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isUploading}
              className="px-5 py-2.5 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 disabled:opacity-60 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-lg shadow-pink-600/20 active:scale-95 transition-all cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{isUploading ? 'Publishing...' : 'Publish to Global Feed'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
