import React from 'react';
import { X } from 'lucide-react';
import { UserAccount } from '../types';
import { LiveStreamMainView } from './LiveStreamMainView';

interface LiveStreamModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserAccount | null;
  onShowToast: (msg: string) => void;
}

export const LiveStreamModal: React.FC<LiveStreamModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onShowToast,
}) => {
  const [isMuted, setIsMuted] = React.useState(false);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-md overflow-hidden">
      <button
        type="button"
        onClick={onClose}
        className="absolute top-3 right-3 z-50 w-10 h-10 rounded-full bg-neutral-900/90 hover:bg-neutral-800 text-neutral-300 hover:text-white flex items-center justify-center border border-neutral-700"
        title="Close Live Studio"
        aria-label="Close Live Studio"
      >
        <X className="w-5 h-5" />
      </button>

      <div className="w-full h-full">
        <LiveStreamMainView
          currentUser={currentUser}
          onSelectTab={() => onClose()}
          onShowToast={onShowToast}
          isMuted={isMuted}
          onToggleMute={() => setIsMuted((m) => !m)}
        />
      </div>
    </div>
  );
};
