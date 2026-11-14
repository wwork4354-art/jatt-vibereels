import React, { useState, useRef, useEffect } from 'react';
import { X, Upload, Video, Sparkles } from 'lucide-react';
import { VideoPost, UserAccount, CreatorProfileData } from '../types';
import {
  uploadMediaToReelsBucket,
  createGlobalPostInSupabase,
  getOrCreateUserProfileId,
} from '../lib/supabaseService';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserAccount | null;
  creatorProfile?: CreatorProfileData;
  onUploadSuccess: (newPost: VideoPost) => void;
  onShowToast?: (msg: string) => void;
}

export const UploadModal: React.FC<UploadModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  creatorProfile,
  onUploadSuccess,
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
  const [soundTrack, setSoundTrack] = useState<VideoPost['sound']['trackType']>('future_bass');
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (currentUser) {
      setCreatorName(currentUser.name);
    } else if (creatorProfile) {
      setCreatorName(creatorProfile.name);
    }
  }, [currentUser, creatorProfile]);

  if (!isOpen) return null;

  const processFile = (file: File) => {
    if (file && (file.type.startsWith('video/') || file.type.startsWith('image/'))) {
      setSelectedFile(file);
      setSelectedMediaType(file.type.startsWith('image/') ? 'image' : 'video');
      const objectUrl = URL.createObjectURL(file);
      setPreviewUrl(objectUrl);
      if (!title) {
        setTitle(file.name.replace(/\.[^/.]+$/, ''));
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUploading(true);

    try {
      const urlTrimmed = videoUrlInput.trim();
      const inferredUrlMediaType: 'video' | 'image' =
        /\.(jpg|jpeg|png|gif|webp|avif)(\?|$)/i.test(urlTrimmed) ? 'image' : 'video';

      let mediaType: 'video' | 'image' =
        videoSourceType === 'file' && selectedFile ? selectedMediaType : inferredUrlMediaType;

      let finalMediaUrl =
        videoSourceType === 'file' && previewUrl
          ? previewUrl
          : urlTrimmed ||
            'https://upload.wikimedia.org/wikipedia/commons/4/47/Astrophysics_Holiday_Vertical_Video_%28SVS14800_-_Fermi_YuleLog_Rotate_Reel%29.webm';

      const userId = creatorProfile?.id || currentUser?.id || getOrCreateUserProfileId();
      const authorName = currentUser?.name || creatorProfile?.name || creatorName.trim() || 'Jatt Creator';
      const authorUsername =
        currentUser?.username ||
        creatorProfile?.username ||
        creatorName.toLowerCase().replace(/\s+/g, '_') ||
        'jatt_official';
      const authorAvatar =
        currentUser?.avatar ||
        creatorProfile?.avatar ||
        `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(authorUsername)}&backgroundColor=ec4899`;

      const tags = hashtagsStr
        .split(/[\s,]+/)
        .map((t) => t.replace(/^#/, '').trim())
        .filter(Boolean);
      const captionText = `${title.trim() || 'My New Post'}${
        description.trim() ? ` - ${description.trim()}` : ''
      } ${tags.map((t) => `#${t}`).join(' ')}`.trim();

      if (videoSourceType === 'file' && selectedFile) {
        onShowToast?.('Uploading media to Supabase Storage...');
        const uploadedUrl = await uploadMediaToReelsBucket(
          selectedFile,
          'posts',
          selectedFile.name
        );
        if (uploadedUrl) {
          finalMediaUrl = uploadedUrl;
        }
      }

      const supabasePost = await createGlobalPostInSupabase({
        userId,
        username: authorUsername,
        displayName: authorName,
        avatarUrl: authorAvatar,
        mediaUrl: finalMediaUrl,
        mediaType,
        caption: captionText,
      });

      if (supabasePost) {
        onUploadSuccess(supabasePost);
        onClose();
        return;
      }

      const newPost: VideoPost = {
        id: `user-vid-${Date.now()}`,
        title: title.trim() || 'My New Post',
        description: captionText,
        hashtags: tags.length ? tags : ['foryou', 'trending'],
        videoUrl: finalMediaUrl,
        posterUrl: mediaType === 'image' ? finalMediaUrl : undefined,
        fallbackGradient: 'from-pink-950 via-purple-950 to-neutral-950',
        category: category,
        userId,
        mediaType,
        isUserUploaded: true,
        creator: {
          name: authorName,
          username: authorUsername,
          avatar: authorAvatar,
          isVerified: currentUser?.role === 'admin' || currentUser?.role === 'creator',
          isFollowing: false,
          bio: currentUser?.bio || creatorProfile?.bio || 'Creator on VibeReels',
        },
        stats: {
          likes: 0,
          comments: 0,
          shares: 0,
          saves: 0,
        },
        isLiked: false,
        isSaved: false,
        sound: {
          title: `${authorName}'s Original Audio`,
          artist: authorName,
          trackType: soundTrack,
        },
        commentsList: [],
      };

      onUploadSuccess(newPost);
      onClose();
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-2xl animate-in fade-in duration-200 my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-4 border-b border-neutral-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-pink-500/20 text-pink-500 flex items-center justify-center">
              <Upload className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">Upload Short Reel</h3>
              <p className="text-xs text-neutral-400">Add a vertical video directly to the feed</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-white rounded-full hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Source Toggle */}
          <div className="flex bg-neutral-950 p-1 rounded-xl border border-neutral-800 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setVideoSourceType('file')}
              className={`flex-1 py-2 rounded-lg transition-colors ${
                videoSourceType === 'file' ? 'bg-neutral-800 text-white shadow-xs' : 'text-neutral-400 hover:text-white'
              }`}
            >
              Choose Video File
            </button>
            <button
              type="button"
              onClick={() => setVideoSourceType('url')}
              className={`flex-1 py-2 rounded-lg transition-colors ${
                videoSourceType === 'url' ? 'bg-neutral-800 text-white shadow-xs' : 'text-neutral-400 hover:text-white'
              }`}
            >
              Paste Video URL
            </button>
          </div>

          {/* File Picker or URL Input */}
          {videoSourceType === 'file' ? (
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*,image/*"
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
                className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer transition-all ${
                  isDragging
                    ? 'border-pink-500 bg-pink-500/10 scale-[1.01]'
                    : 'border-neutral-700 hover:border-pink-500/80 bg-neutral-950/40 hover:bg-pink-950/10'
                }`}
              >
                {previewUrl ? (
                  <div className="flex flex-col items-center">
                    {selectedMediaType === 'image' ? (
                      <img
                        src={previewUrl}
                        alt="Preview"
                        className="w-24 h-40 object-cover rounded-lg shadow-lg mb-2 border border-neutral-700"
                      />
                    ) : (
                      <video
                        src={previewUrl}
                        className="w-24 h-40 object-cover rounded-lg shadow-lg mb-2 border border-neutral-700"
                        muted
                        autoPlay
                        loop
                      />
                    )}
                    <p className="text-xs text-pink-400 font-semibold truncate max-w-xs">
                      {selectedFile?.name}
                    </p>
                    <p className="text-[11px] text-neutral-500">Click or drop another video/image to replace</p>
                  </div>
                ) : (
                  <>
                    <div className="w-12 h-12 rounded-full bg-neutral-800 flex items-center justify-center text-neutral-400 mb-2">
                      <Video className="w-6 h-6 text-pink-400" />
                    </div>
                    <p className="text-sm font-semibold text-white">Select video or image to upload</p>
                    <p className="text-xs text-neutral-400 mt-1">Drag & drop or browse MP4, WebM, JPG, PNG</p>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-neutral-300 mb-1">
                Direct Video URL (.mp4 / .webm)
              </label>
              <input
                type="url"
                value={videoUrlInput}
                onChange={(e) => setVideoUrlInput(e.target.value)}
                placeholder="https://example.com/video.mp4"
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-hidden focus:border-pink-500"
              />
            </div>
          )}

          {/* Title & Caption */}
          <div>
            <label className="block text-xs font-semibold text-neutral-300 mb-1">Title / Caption</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Midnight city lights or Epic sunset trick"
              className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-hidden focus:border-pink-500"
            />
          </div>

          {/* Hashtags */}
          <div>
            <label className="block text-xs font-semibold text-neutral-300 mb-1">Hashtags</label>
            <input
              type="text"
              value={hashtagsStr}
              onChange={(e) => setHashtagsStr(e.target.value)}
              placeholder="#tokyo #aesthetic #vibes"
              className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-hidden focus:border-pink-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-neutral-300 mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as VideoPost['category'])}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-hidden"
              >
                <option value="trending">Trending</option>
                <option value="nature">Nature & Animals</option>
                <option value="urban">Urban & Skate</option>
                <option value="music">Music & Dance</option>
                <option value="cute">Cute & Pets</option>
                <option value="creative">Creative & Art</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-300 mb-1">Music Beat</label>
              <select
                value={soundTrack}
                onChange={(e) => setSoundTrack(e.target.value as VideoPost['sound']['trackType'])}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-hidden"
              >
                <option value="future_bass">Future Bass Beat</option>
                <option value="ambient_lofi">Ambient Lo-Fi</option>
                <option value="tokyo_drift">Tokyo Drift Rhythm</option>
                <option value="chill_synth">Chill Synthwave</option>
                <option value="cosmic_pulse">Cosmic Pulse</option>
              </select>
            </div>
          </div>

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
