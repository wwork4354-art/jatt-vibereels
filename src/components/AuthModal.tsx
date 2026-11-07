import React, { useState } from 'react';
import {
  X,
  Lock,
  User,
  Mail,
  Shield,
  Sparkles,
  Eye,
  EyeOff,
  LogIn,
  UserPlus,
  ArrowRight,
  KeyRound,
} from 'lucide-react';
import { UserAccount, UserRole } from '../types';
import { DeveloperCreditBadge } from './DeveloperCreditBadge';
import { soundEngine } from '../utils/soundEngine';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'login' | 'register';
  onLoginSuccess: (user: UserAccount) => void;
  registeredUsers: UserAccount[];
  onRegisterUser: (newUser: UserAccount) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  initialMode = 'login',
  onLoginSuccess,
  registeredUsers,
  onRegisterUser,
}) => {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Register Fields
  const [regName, setRegName] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regRole, setRegRole] = useState<UserRole>('user');

  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setIsLoading(true);

    setTimeout(() => {
      setIsLoading(false);
      const term = usernameInput.trim().toLowerCase().replace(/^@/, '');
      const foundUser = registeredUsers.find(
        (u) =>
          u.username.toLowerCase() === term ||
          u.email.toLowerCase() === term
      );

      if (!foundUser) {
        setErrorMsg('Invalid username or password. You can use the quick demo accounts below or create an account!');
        return;
      }

      if (foundUser.status === 'suspended') {
        setErrorMsg('This account has been suspended by an administrator.');
        return;
      }

      soundEngine.playDownloadComplete();
      onLoginSuccess(foundUser);
      onClose();
    }, 450);
  };

  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setIsLoading(true);

    const cleanUsername = regUsername.trim().toLowerCase().replace(/^@/, '');
    const cleanEmail = regEmail.trim().toLowerCase();

    if (!regName.trim()) {
      setIsLoading(false);
      setErrorMsg('Please enter your full name.');
      return;
    }
    if (!cleanUsername) {
      setIsLoading(false);
      setErrorMsg('Please choose a username.');
      return;
    }
    if (!passwordInput) {
      setIsLoading(false);
      setErrorMsg('Please enter a secure password.');
      return;
    }

    // Check if username or email already exists
    const exists = registeredUsers.some(
      (u) =>
        u.username.toLowerCase() === cleanUsername ||
        (cleanEmail && u.email.toLowerCase() === cleanEmail)
    );

    if (exists) {
      setIsLoading(false);
      setErrorMsg('A user with that username or email already exists.');
      return;
    }

    setTimeout(() => {
      setIsLoading(false);
      const newUser: UserAccount = {
        id: `usr-${Date.now()}`,
        name: regName.trim(),
        username: cleanUsername,
        email: cleanEmail || `${cleanUsername}@vibereels.app`,
        avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${cleanUsername}&backgroundColor=${
          regRole === 'admin' ? 'ec4899' : '06b6d4'
        }`,
        role: regRole,
        status: 'active',
        joinedAt: 'Nov 2026',
        videosCount: 0,
        bio: `${
          regRole === 'admin'
            ? 'Platform Administrator'
            : regRole === 'creator'
            ? 'Video Creator'
            : 'VibeReels Member'
        }`,
      };

      onRegisterUser(newUser);
      soundEngine.playDownloadComplete();
      onLoginSuccess(newUser);
      onClose();
    }, 450);
  };

  const handleQuickLogin = (targetUser: string) => {
    const clean = targetUser.toLowerCase().replace(/^@/, '');
    const user = registeredUsers.find(
      (u) => u.username.toLowerCase() === clean || u.email.toLowerCase() === clean
    );
    if (user) {
      soundEngine.playDownloadComplete();
      onLoginSuccess(user);
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 overflow-y-auto animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-neutral-950 border border-neutral-800 hover:border-pink-500/50 rounded-3xl p-5 sm:p-6 shadow-[0_0_50px_rgba(236,72,153,0.18)] transition-all duration-300 relative overflow-hidden my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top ambient neon glowing streaks */}
        <div className="absolute top-0 left-1/4 right-1/4 h-[2px] bg-gradient-to-r from-transparent via-pink-500 to-transparent pointer-events-none" />
        <div className="absolute -top-16 -right-16 w-36 h-36 bg-pink-500/15 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-36 h-36 bg-cyan-500/15 rounded-full blur-2xl pointer-events-none" />

        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3.5 border-b border-neutral-800/80 relative z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-pink-600 to-purple-600 text-white flex items-center justify-center shadow-md shadow-pink-500/25">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-black text-white tracking-tight flex items-center gap-1.5">
                {mode === 'login' ? 'Sign In to Jatt VibeReels' : 'Create Creator Account'}
              </h2>
              <p className="text-[11px] text-neutral-400">
                {mode === 'login'
                  ? 'Access your saved reels, live interactions & studio'
                  : 'Join the next-generation short video platform'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-white rounded-full hover:bg-neutral-800 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ========================================================= */}
        {/* PROMINENT DEVELOPER ATTRIBUTION SECTION IN LOGIN SCREEN  */}
        {/* ========================================================= */}
        <div className="my-3.5 relative z-10">
          <DeveloperCreditBadge variant="modal" showDetails={true} />
        </div>

        {/* Tab Switcher: Sign In vs Sign Up */}
        <div className="flex bg-neutral-900 p-1 rounded-xl border border-neutral-800 mb-4 text-xs font-bold relative z-10">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setErrorMsg('');
            }}
            className={`flex-1 py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              mode === 'login'
                ? 'bg-gradient-to-r from-pink-600 to-purple-600 text-white shadow-md'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Sign In</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setErrorMsg('');
            }}
            className={`flex-1 py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              mode === 'register'
                ? 'bg-gradient-to-r from-pink-600 to-purple-600 text-white shadow-md'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Sign Up</span>
          </button>
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 bg-rose-500/15 border border-rose-500/40 rounded-xl text-xs text-rose-300 flex items-center gap-2 animate-in fade-in duration-200">
            <span>{errorMsg}</span>
          </div>
        )}

        {/* ========================================================= */}
        {/* INTERACTIVE SIGN IN (LOG IN) FORM                         */}
        {/* ========================================================= */}
        {mode === 'login' ? (
          <form onSubmit={handleLoginSubmit} className="space-y-3.5 relative z-10">
            {/* Username Input */}
            <div>
              <label className="block text-xs font-bold text-neutral-300 mb-1">
                Username
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={usernameInput}
                  onChange={(e) => setUsernameInput(e.target.value)}
                  placeholder="Enter your username (e.g. admin or @cosmic_explorer)"
                  className="w-full bg-neutral-900 text-xs sm:text-sm text-white placeholder-neutral-500 pl-10 pr-3.5 py-2.5 rounded-xl border border-neutral-800 focus:outline-hidden focus:border-pink-500 focus:ring-1 focus:ring-pink-500/50 transition-all shadow-inner"
                />
                <User className="w-4 h-4 text-pink-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            {/* Password Input with show/hide */}
            <div>
              <label className="block text-xs font-bold text-neutral-300 mb-1">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full bg-neutral-900 text-xs sm:text-sm text-white placeholder-neutral-500 pl-10 pr-10 py-2.5 rounded-xl border border-neutral-800 focus:outline-hidden focus:border-pink-500 focus:ring-1 focus:ring-pink-500/50 transition-all shadow-inner"
                />
                <Lock className="w-4 h-4 text-pink-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300"
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* GLOWING "SIGN IN" BUTTON */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-pink-600 via-purple-600 to-cyan-500 hover:from-pink-500 hover:via-purple-500 hover:to-cyan-400 text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-pink-600/35 hover:shadow-cyan-500/40 active:scale-98 transition-all border border-pink-400/30 group mt-1"
            >
              <KeyRound className="w-4 h-4 group-hover:rotate-12 transition-transform" />
              <span>{isLoading ? 'Signing In...' : 'Sign In'}</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>

            {/* Quick Demo Logins Section */}
            <div className="pt-2 border-t border-neutral-800/80">
              <p className="text-[11px] font-semibold text-neutral-400 text-center mb-2">
                One-Click Quick Test Accounts:
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleQuickLogin('admin')}
                  className="p-2.5 bg-neutral-900/90 hover:bg-neutral-800 border border-neutral-800 hover:border-pink-500/40 rounded-xl flex items-center gap-2 text-left transition-all group"
                >
                  <div className="w-7 h-7 rounded-lg bg-pink-500/20 text-pink-400 flex items-center justify-center shrink-0 border border-pink-500/30">
                    <Shield className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold text-white truncate group-hover:text-pink-400">
                      Admin Demo
                    </p>
                    <p className="text-[9px] text-neutral-400 font-mono">@admin</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickLogin('cosmic_explorer')}
                  className="p-2.5 bg-neutral-900/90 hover:bg-neutral-800 border border-neutral-800 hover:border-cyan-500/40 rounded-xl flex items-center gap-2 text-left transition-all group"
                >
                  <div className="w-7 h-7 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center shrink-0 border border-cyan-500/30">
                    <Sparkles className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold text-white truncate group-hover:text-cyan-400">
                      Creator Demo
                    </p>
                    <p className="text-[9px] text-neutral-400 font-mono">@cosmic_explorer</p>
                  </div>
                </button>
              </div>
            </div>
          </form>
        ) : (
          <form onSubmit={handleRegisterSubmit} className="space-y-3 relative z-10">


            <div>
              <label className="block text-xs font-bold text-neutral-300 mb-1">Full Name</label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  placeholder="e.g. Jaspreet Singh"
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-xl pl-9 pr-3.5 py-2 text-xs text-white placeholder-neutral-500 focus:outline-hidden focus:border-pink-500"
                />
                <User className="w-4 h-4 text-pink-400 absolute left-3 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-bold text-neutral-300 mb-1">Username</label>
                <input
                  type="text"
                  required
                  value={regUsername}
                  onChange={(e) => setRegUsername(e.target.value)}
                  placeholder="jatt_vibe"
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white placeholder-neutral-500 focus:outline-hidden focus:border-pink-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-neutral-300 mb-1">Account Role</label>
                <select
                  value={regRole}
                  onChange={(e) => setRegRole(e.target.value as UserRole)}
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-2.5 py-2 text-xs text-white focus:outline-hidden"
                >
                  <option value="user">Viewer (User)</option>
                  <option value="creator">Creator</option>
                  <option value="admin">Administrator</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-neutral-300 mb-1">Email</label>
              <div className="relative">
                <input
                  type="email"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  placeholder="jatt@example.com (optional)"
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-xl pl-9 pr-3.5 py-2 text-xs text-white placeholder-neutral-500 focus:outline-hidden focus:border-pink-500"
                />
                <Mail className="w-4 h-4 text-pink-400 absolute left-3 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-neutral-300 mb-1">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="Create a strong password"
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-xl pl-9 pr-10 py-2 text-xs text-white placeholder-neutral-500 focus:outline-hidden focus:border-pink-500"
                />
                <Lock className="w-4 h-4 text-pink-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300"
                >
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 bg-gradient-to-r from-pink-600 via-purple-600 to-cyan-500 hover:from-pink-500 hover:to-cyan-400 text-white font-black text-xs rounded-xl shadow-lg shadow-pink-600/25 active:scale-98 transition-all mt-2"
            >
              {isLoading ? 'Creating Account...' : 'Complete Registration'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
