import React, { useState } from 'react';
import { X, Heart, Send, Sparkles } from 'lucide-react';
import { CommentItem } from '../types';
import { soundEngine } from '../utils/soundEngine';

interface CommentsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  comments: CommentItem[];
  onAddComment: (text: string) => void;
  onLikeComment: (commentId: string) => void;
}

const QUICK_EMOJIS = ['🔥', '❤️', '😂', '👏', '💯', '✨', '🙌', '😍'];

export const CommentsDrawer: React.FC<CommentsDrawerProps> = ({
  isOpen,
  onClose,
  comments,
  onAddComment,
  onLikeComment,
}) => {
  const [inputText, setInputText] = useState('');
  const [activeTab, setActiveTab] = useState<'top' | 'newest'>('top');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    onAddComment(inputText.trim());
    setInputText('');
    soundEngine.playCommentSound();
  };

  const handleEmojiClick = (emoji: string) => {
    setInputText((prev) => prev + emoji);
  };

  const sortedComments = [...comments].sort((a, b) => {
    if (activeTab === 'top') {
      return b.likes - a.likes;
    }
    return 0; // Maintain insertion/newest order
  });

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60 backdrop-blur-xs transition-opacity duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg mx-auto bg-neutral-900 border-t border-neutral-800 rounded-t-3xl flex flex-col max-h-[75vh] min-h-[50vh] shadow-2xl overflow-hidden animate-in slide-in-from-bottom-6 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Grab Handle */}
        <div className="w-12 h-1 bg-neutral-700 rounded-full mx-auto mt-3 mb-1" />

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-neutral-800/80">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-bold text-white tracking-tight">
              {comments.length.toLocaleString()} Comments
            </h3>
            <div className="flex items-center bg-neutral-800 rounded-lg p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setActiveTab('top')}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                  activeTab === 'top' ? 'bg-neutral-700 text-white shadow-xs' : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                Top
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('newest')}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                  activeTab === 'newest' ? 'bg-neutral-700 text-white shadow-xs' : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                Newest
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-white rounded-full hover:bg-neutral-800 transition-colors"
            aria-label="Close comments"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Comments Feed */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 no-scrollbar">
          {sortedComments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center text-neutral-400">
              <Sparkles className="w-8 h-8 text-neutral-600 mb-2" />
              <p className="text-sm font-medium text-neutral-300">Be the first to comment!</p>
              <p className="text-xs text-neutral-500 mt-1">Share your thoughts on this reel.</p>
            </div>
          ) : (
            sortedComments.map((comment) => (
              <div key={comment.id} className="flex items-start gap-3 group">
                <img
                  src={comment.user.avatar}
                  alt={comment.user.name}
                  className="w-9 h-9 rounded-full object-cover shrink-0 bg-neutral-800 border border-neutral-700/60"
                  referrerPolicy="no-referrer"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-neutral-200 truncate">
                      {comment.user.name}
                    </span>
                    {comment.user.isCreator && (
                      <span className="text-[10px] font-bold uppercase tracking-wider text-pink-400 bg-pink-500/10 px-1.5 py-0.2 rounded-xs">
                        Creator
                      </span>
                    )}
                    <span className="text-[11px] text-neutral-500">· {comment.timestamp}</span>
                  </div>
                  <p className="text-sm text-neutral-100 mt-0.5 break-words leading-relaxed">
                    {comment.text}
                  </p>
                  <div className="flex items-center gap-4 mt-1.5 text-xs text-neutral-500">
                    <button
                      type="button"
                      className="hover:text-neutral-300 font-medium transition-colors"
                      onClick={() => setInputText(`@${comment.user.username} `)}
                    >
                      Reply
                    </button>
                  </div>
                </div>
                {/* Like Button */}
                <button
                  type="button"
                  onClick={() => onLikeComment(comment.id)}
                  className="flex flex-col items-center gap-0.5 text-neutral-400 hover:text-rose-500 transition-colors shrink-0 pt-1"
                >
                  <Heart
                    className={`w-4 h-4 transition-transform active:scale-125 ${
                      comment.isLiked ? 'fill-rose-500 text-rose-500' : ''
                    }`}
                  />
                  <span className="text-[10px] font-medium tabular-nums">
                    {comment.likes > 0 ? comment.likes.toLocaleString() : ''}
                  </span>
                </button>
              </div>
            ))
          )}
        </div>

        {/* Quick Emoji Bar */}
        <div className="px-4 py-2 border-t border-neutral-800/60 bg-neutral-900/90 flex items-center gap-2 overflow-x-auto no-scrollbar">
          {QUICK_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => handleEmojiClick(emoji)}
              className="text-base p-1.5 hover:bg-neutral-800 rounded-lg transition-transform active:scale-125 shrink-0"
            >
              {emoji}
            </button>
          ))}
        </div>

        {/* Bottom Input Field */}
        <form onSubmit={handleSubmit} className="p-3 bg-neutral-950 border-t border-neutral-800/80 flex items-center gap-2">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Add a comment..."
            className="flex-1 bg-neutral-800 text-sm text-white placeholder-neutral-500 px-4 py-2.5 rounded-full border border-neutral-700/60 focus:outline-hidden focus:border-pink-500 transition-colors"
          />
          <button
            type="submit"
            disabled={!inputText.trim()}
            className="w-10 h-10 rounded-full bg-pink-600 disabled:bg-neutral-800 disabled:text-neutral-600 text-white flex items-center justify-center transition-all hover:bg-pink-500 active:scale-95 shrink-0"
            aria-label="Send comment"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
