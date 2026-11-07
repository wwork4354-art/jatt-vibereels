import React, { useState } from 'react';
import { X, Copy, Check, Share2, Send, QrCode } from 'lucide-react';
import { VideoPost } from '../types';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  video: VideoPost;
  onShowToast: (msg: string) => void;
}

export const ShareModal: React.FC<ShareModalProps> = ({
  isOpen,
  onClose,
  video,
  onShowToast,
}) => {
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);

  if (!isOpen) return null;

  const currentUrl = window.location.href.split('#')[0] + `#reel-${video.id}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(currentUrl);
      setCopied(true);
      onShowToast('Link copied to clipboard!');
      setTimeout(() => setCopied(false), 2500);
    } catch {
      onShowToast('Link copied to clipboard!');
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: video.title,
          text: `Check out this reel by @${video.creator.username}: "${video.title}"`,
          url: currentUrl,
        });
        onClose();
      } catch {
        // User cancelled share
      }
    } else {
      handleCopyLink();
    }
  };

  const shareToPlatform = (platform: 'whatsapp' | 'twitter' | 'reddit') => {
    const text = encodeURIComponent(`Check out this reel on VibeReels: ${video.title}`);
    const url = encodeURIComponent(currentUrl);
    let targetUrl = '';

    if (platform === 'whatsapp') {
      targetUrl = `https://api.whatsapp.com/send?text=${text}%20${url}`;
    } else if (platform === 'twitter') {
      targetUrl = `https://twitter.com/intent/tweet?text=${text}&url=${url}`;
    } else if (platform === 'reddit') {
      targetUrl = `https://reddit.com/submit?url=${url}&title=${text}`;
    }

    window.open(targetUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-t-3xl sm:rounded-2xl p-5 shadow-2xl animate-in slide-in-from-bottom-4 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
          <h3 className="text-base font-bold text-white tracking-tight">Share to</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-white rounded-full hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Video preview pill */}
        <div className="my-3 flex items-center gap-3 p-2.5 bg-neutral-800/60 rounded-xl border border-neutral-700/50">
          <img
            src={video.creator.avatar}
            alt={video.creator.name}
            className="w-9 h-9 rounded-full object-cover bg-neutral-700 shrink-0"
            referrerPolicy="no-referrer"
          />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-white truncate">@{video.creator.username}</p>
            <p className="text-xs text-neutral-400 truncate">{video.title}</p>
          </div>
        </div>

        {/* Share buttons row */}
        <div className="grid grid-cols-4 gap-3 my-4">
          <button
            type="button"
            onClick={handleNativeShare}
            className="flex flex-col items-center gap-1.5 p-2 rounded-xl hover:bg-neutral-800/80 transition-colors group"
          >
            <div className="w-12 h-12 rounded-full bg-pink-600/20 text-pink-500 group-hover:scale-105 transition-transform flex items-center justify-center border border-pink-500/30">
              <Share2 className="w-5 h-5" />
            </div>
            <span className="text-[11px] font-medium text-neutral-300">Share</span>
          </button>

          <button
            type="button"
            onClick={() => shareToPlatform('whatsapp')}
            className="flex flex-col items-center gap-1.5 p-2 rounded-xl hover:bg-neutral-800/80 transition-colors group"
          >
            <div className="w-12 h-12 rounded-full bg-emerald-600/20 text-emerald-500 group-hover:scale-105 transition-transform flex items-center justify-center border border-emerald-500/30">
              <Send className="w-5 h-5" />
            </div>
            <span className="text-[11px] font-medium text-neutral-300">WhatsApp</span>
          </button>

          <button
            type="button"
            onClick={() => shareToPlatform('twitter')}
            className="flex flex-col items-center gap-1.5 p-2 rounded-xl hover:bg-neutral-800/80 transition-colors group"
          >
            <div className="w-12 h-12 rounded-full bg-sky-600/20 text-sky-500 group-hover:scale-105 transition-transform flex items-center justify-center border border-sky-500/30">
              <span className="font-bold text-sm">𝕏</span>
            </div>
            <span className="text-[11px] font-medium text-neutral-300">X / Twitter</span>
          </button>

          <button
            type="button"
            onClick={() => setShowQr(!showQr)}
            className="flex flex-col items-center gap-1.5 p-2 rounded-xl hover:bg-neutral-800/80 transition-colors group"
          >
            <div className={`w-12 h-12 rounded-full flex items-center justify-center border transition-all ${showQr ? 'bg-amber-500/30 text-amber-400 border-amber-500/50' : 'bg-amber-600/20 text-amber-500 border-amber-500/30 group-hover:scale-105'}`}>
              <QrCode className="w-5 h-5" />
            </div>
            <span className="text-[11px] font-medium text-neutral-300">QR Code</span>
          </button>
        </div>

        {/* QR Code preview block if toggled */}
        {showQr && (
          <div className="mb-4 p-4 bg-neutral-950 rounded-xl border border-neutral-800 flex flex-col items-center animate-in fade-in duration-150">
            <div className="p-2.5 bg-white rounded-lg shadow-md">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(currentUrl)}`}
                alt="QR Code"
                className="w-32 h-32"
                referrerPolicy="no-referrer"
              />
            </div>
            <p className="text-[11px] text-neutral-400 mt-2">Scan with camera to view on mobile</p>
          </div>
        )}

        {/* Copy link bar */}
        <div className="flex items-center gap-2 p-1.5 bg-neutral-950 rounded-xl border border-neutral-800">
          <input
            type="text"
            readOnly
            value={currentUrl}
            className="flex-1 bg-transparent px-3 text-xs text-neutral-400 truncate focus:outline-hidden"
          />
          <button
            type="button"
            onClick={handleCopyLink}
            className="px-3 py-2 bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors shrink-0"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
