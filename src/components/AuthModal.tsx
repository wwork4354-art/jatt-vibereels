import React, { useState, useEffect } from 'react';
import {
  X,
  Lock,
  User,
  Mail,
  Phone,
  Shield,
  Sparkles,
  Eye,
  EyeOff,
  LogIn,
  UserPlus,
  ArrowRight,
  KeyRound,
  CheckCircle2,
  Circle,
  AlertTriangle,
  Clock,
} from 'lucide-react';
import { UserAccount, UserRole } from '../types';
import { DeveloperCreditBadge } from './DeveloperCreditBadge';
import { soundEngine } from '../utils/soundEngine';
import {
  MAIN_ADMIN_EMAIL,
  MAIN_ADMIN_USERNAME,
  verifyLegacyPasswordForUser,
} from '../data/mockUsers';
import { syncRegisteredUserToCloud } from '../lib/supabaseService';
import {
  sanitizeInputLive,
  sanitizeText,
  sanitizeUsername,
  validatePasswordStrength,
  hashPasswordAsync,
  verifyPasswordAsync,
  verifyAdminPinAsync,
  getLockoutStatus,
  recordFailedAttempt,
  resetLockout,
  formatLockoutCountdown,
  checkRateLimit,
  recordRateLimitEvent,
  touchSessionActivity,
  LockoutStatus,
} from '../utils/security';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'login' | 'register';
  onLoginSuccess: (user: UserAccount) => void;
  registeredUsers: UserAccount[];
  onRegisterUser: (newUser: UserAccount) => void;
  onUpgradeUserPassword?: (userId: string, passwordHash: string) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  initialMode = 'login',
  onLoginSuccess,
  registeredUsers,
  onRegisterUser,
  onUpgradeUserPassword,
}) => {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [adminPinInput, setAdminPinInput] = useState('');
  const [isAdminSignIn, setIsAdminSignIn] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Register Fields
  const [regName, setRegName] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regRole, setRegRole] = useState<'user' | 'creator'>('user');

  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [lockout, setLockout] = useState<LockoutStatus>(() => getLockoutStatus('login'));

  // Sync lockout countdown every second when locked
  useEffect(() => {
    if (!isOpen) return;
    setLockout(getLockoutStatus('login'));
    const timer = window.setInterval(() => {
      setLockout(getLockoutStatus('login'));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isOpen]);

  if (!isOpen) return null;

  const isTargetMainAdmin = (term: string) => {
    const clean = sanitizeText(term, 120).toLowerCase().replace(/^@+/, '');
    return clean === MAIN_ADMIN_EMAIL || clean === MAIN_ADMIN_USERNAME;
  };

  const passwordStrength = validatePasswordStrength(passwordInput);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const currentLock = getLockoutStatus('login');
    setLockout(currentLock);
    if (currentLock.isLocked) {
      setErrorMsg(
        `Too many failed attempts. Login locked for ${formatLockoutCountdown(
          currentLock.remainingSeconds
        )}.`
      );
      return;
    }

    setIsLoading(true);
    try {
      const term = sanitizeText(usernameInput, 120).toLowerCase().replace(/^@+/, '');
      const foundUser = registeredUsers.find(
        (u) =>
          u.username.toLowerCase() === term ||
          u.email.toLowerCase() === term ||
          (u.phone && u.phone.toLowerCase() === term)
      );

      if (!foundUser) {
        const nextLock = recordFailedAttempt('login');
        setLockout(nextLock);
        setErrorMsg(
          nextLock.isLocked
            ? `3 failed login attempts. Access locked for ${formatLockoutCountdown(
                nextLock.remainingSeconds
              )}.`
            : `Invalid username, email, or phone. (${nextLock.attemptsLeft} attempt${
                nextLock.attemptsLeft === 1 ? '' : 's'
              } left before 5m lockout)`
        );
        return;
      }

      if (foundUser.status === 'suspended') {
        setErrorMsg('This account has been suspended by an administrator.');
        return;
      }

      // Enforce Admin PIN verification (hashed verification) for Main Admin login
      if (foundUser.role === 'admin' || isTargetMainAdmin(term)) {
        const suppliedSecret = (adminPinInput || passwordInput).trim();
        const isPinValid = await verifyAdminPinAsync(suppliedSecret);
        if (!isPinValid) {
          setIsAdminSignIn(true);
          const nextLock = recordFailedAttempt('login');
          setLockout(nextLock);
          setErrorMsg(
            nextLock.isLocked
              ? `3 failed Admin attempts. Locked for ${formatLockoutCountdown(
                  nextLock.remainingSeconds
                )}.`
              : `Invalid Admin Security PIN. (${nextLock.attemptsLeft} attempt${
                  nextLock.attemptsLeft === 1 ? '' : 's'
                } left before 5m lockout)`
          );
          return;
        }
      } else if (foundUser.passwordHash) {
        const matches = await verifyPasswordAsync(passwordInput, foundUser.passwordHash);
        if (!matches) {
          const nextLock = recordFailedAttempt('login');
          setLockout(nextLock);
          setErrorMsg(
            nextLock.isLocked
              ? `3 failed password attempts. Locked for ${formatLockoutCountdown(
                  nextLock.remainingSeconds
                )}.`
              : `Incorrect password. (${nextLock.attemptsLeft} attempt${
                  nextLock.attemptsLeft === 1 ? '' : 's'
                } left before 5m lockout)`
          );
          return;
        }
      } else {
        // Legacy account created before password hashing was introduced:
        // Allow seamless login (checking legacy plaintext password if one existed) and auto-upgrade to PBKDF2 hash.
        if (!passwordInput.trim()) {
          setErrorMsg('Please enter your password.');
          return;
        }
        const legacyCheck = verifyLegacyPasswordForUser(
          foundUser.id,
          foundUser.username,
          passwordInput
        );
        if (legacyCheck === false) {
          const nextLock = recordFailedAttempt('login');
          setLockout(nextLock);
          setErrorMsg(
            nextLock.isLocked
              ? `3 failed password attempts. Locked for ${formatLockoutCountdown(
                  nextLock.remainingSeconds
                )}.`
              : `Incorrect password. (${nextLock.attemptsLeft} attempt${
                  nextLock.attemptsLeft === 1 ? '' : 's'
                } left before 5m lockout)`
          );
          return;
        }
        try {
          const upgradedHash = await hashPasswordAsync(passwordInput);
          onUpgradeUserPassword?.(foundUser.id, upgradedHash);
        } catch {
          // Allow login even if hashing falls back
        }
      }

      resetLockout('login');
      setLockout(getLockoutStatus('login'));
      touchSessionActivity();

      const { passwordHash: _omitHash, ...safeFound } = foundUser;
      const activeUser: UserAccount = {
        ...safeFound,
        lastActiveAt: new Date().toISOString(),
        isOnline: true,
      };
      void syncRegisteredUserToCloud(activeUser);
      soundEngine.playDownloadComplete();
      onLoginSuccess(activeUser);
      onClose();
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    // Rate limiting: max 3 signups per minute
    const rate = checkRateLimit('signup');
    if (!rate.allowed) {
      setErrorMsg(
        `Anti-spam limit reached: Max 3 signups per minute. Please wait ${rate.retryAfterSeconds}s.`
      );
      return;
    }

    const cleanName = sanitizeText(regName, 80);
    const cleanUsername = sanitizeUsername(regUsername, 40);
    const cleanEmail = sanitizeText(regEmail, 120).toLowerCase();
    const cleanPhone = sanitizeText(regPhone, 32);

    if (!cleanName || cleanName.length < 2) {
      setErrorMsg('Please enter a valid display name (at least 2 safe characters).');
      return;
    }
    if (!cleanUsername || cleanUsername.length < 3) {
      setErrorMsg('Please choose a valid @username (at least 3 letters, numbers, or _).');
      return;
    }
    if (cleanUsername === MAIN_ADMIN_USERNAME || cleanEmail === MAIN_ADMIN_EMAIL) {
      setErrorMsg('This reserved handle or email cannot be registered.');
      return;
    }
    if (!cleanEmail && !cleanPhone) {
      setErrorMsg('Please provide either your Email or Phone Number.');
      return;
    }
    if (cleanEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }

    const pwdCheck = validatePasswordStrength(passwordInput);
    if (!pwdCheck.isValid) {
      setErrorMsg(`Weak password. Required: ${pwdCheck.errors.join(', ')}.`);
      return;
    }

    // Check if username or email already exists
    const exists = registeredUsers.some(
      (u) =>
        u.username.toLowerCase() === cleanUsername ||
        (cleanEmail && u.email.toLowerCase() === cleanEmail) ||
        (cleanPhone && u.phone && u.phone === cleanPhone)
    );

    if (exists) {
      setErrorMsg('An account with that username, email, or phone already exists.');
      return;
    }

    setIsLoading(true);
    try {
      const passwordHash = await hashPasswordAsync(passwordInput);
      const now = new Date();
      const nowIso = now.toISOString();
      const joinedLabel = now.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });

      const safeRole: UserRole = regRole === 'creator' ? 'creator' : 'user';
      const newUser: UserAccount = {
        id: `usr-${Date.now()}`,
        name: cleanName,
        username: cleanUsername,
        email: cleanEmail || `${cleanUsername}@vibereels.app`,
        phone: cleanPhone || undefined,
        avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(
          cleanUsername
        )}&backgroundColor=06b6d4`,
        role: safeRole,
        status: 'active',
        joinedAt: joinedLabel,
        createdAtIso: nowIso,
        lastActiveAt: nowIso,
        isOnline: true,
        videosCount: 0,
        bio: safeRole === 'creator' ? 'Video Creator' : 'Jatt VibeReels Member',
        passwordHash,
      };

      recordRateLimitEvent('signup');
      touchSessionActivity();
      onRegisterUser(newUser);
      void syncRegisteredUserToCloud(newUser);
      soundEngine.playDownloadComplete();

      const { passwordHash: _omitHash, ...sessionUser } = newUser;
      onLoginSuccess(sessionUser);
      onClose();
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickCreatorDemo = () => {
    if (lockout.isLocked) {
      setErrorMsg(
        `Login temporarily locked (${formatLockoutCountdown(lockout.remainingSeconds)} left).`
      );
      return;
    }
    const user = registeredUsers.find(
      (u) => u.username.toLowerCase() === 'cosmic_explorer'
    );
    if (user) {
      const { passwordHash: _omitHash, ...safeDemo } = user;
      const activeDemo: UserAccount = {
        ...safeDemo,
        lastActiveAt: new Date().toISOString(),
        isOnline: true,
      };
      touchSessionActivity();
      soundEngine.playDownloadComplete();
      onLoginSuccess(activeDemo);
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
                  ? 'Persistent encrypted session · Stay signed in across updates'
                  : 'PBKDF2 password hashing & anti-XSS enabled'}
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

        {/* PROMINENT DEVELOPER ATTRIBUTION SECTION IN LOGIN SCREEN */}
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

        {/* Brute-Force Lockout Countdown Banner */}
        {mode === 'login' && lockout.isLocked && (
          <div className="mb-4 p-3.5 bg-rose-950/70 border border-rose-500/50 rounded-xl text-xs text-rose-200 flex items-center justify-between gap-3 relative z-10">
            <div className="flex items-center gap-2 min-w-0">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <div>
                <p className="font-black text-rose-300">Brute-Force Lockout Active</p>
                <p className="text-[11px] text-rose-200/80">
                  Too many failed attempts. Please wait before trying again.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-black/50 border border-rose-500/40 font-mono font-black text-rose-300 shrink-0">
              <Clock className="w-3.5 h-3.5" />
              <span>{formatLockoutCountdown(lockout.remainingSeconds)}</span>
            </div>
          </div>
        )}

        {errorMsg && (
          <div className="mb-4 p-3 bg-rose-500/15 border border-rose-500/40 rounded-xl text-xs text-rose-300 flex items-center gap-2 animate-in fade-in duration-200 relative z-10">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* INTERACTIVE SIGN IN FORM */}
        {mode === 'login' ? (
          <form onSubmit={handleLoginSubmit} className="space-y-3.5 relative z-10">
            <div>
              <label className="block text-xs font-bold text-neutral-300 mb-1">
                Username, Email or Phone
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={usernameInput}
                  onChange={(e) => {
                    const val = sanitizeInputLive(e.target.value, 120);
                    setUsernameInput(val);
                    if (isTargetMainAdmin(val)) {
                      setIsAdminSignIn(true);
                    }
                  }}
                  placeholder="Enter @username, email or phone"
                  className="w-full bg-neutral-900 text-xs sm:text-sm text-white placeholder-neutral-500 pl-10 pr-3.5 py-2.5 rounded-xl border border-neutral-800 focus:outline-hidden focus:border-pink-500 focus:ring-1 focus:ring-pink-500/50 transition-all shadow-inner"
                />
                <User className="w-4 h-4 text-pink-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-neutral-300 mb-1">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required={!isAdminSignIn}
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

            {(isAdminSignIn || isTargetMainAdmin(usernameInput)) && (
              <div className="p-3 rounded-xl bg-pink-500/10 border border-pink-500/35 space-y-1.5">
                <label className="block text-[11px] font-black text-pink-300 flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5" />
                  <span>Main Admin Security PIN</span>
                </label>
                <input
                  type="password"
                  value={adminPinInput}
                  onChange={(e) => setAdminPinInput(e.target.value)}
                  placeholder="Enter secret Admin PIN"
                  className="w-full bg-neutral-950 text-xs text-white placeholder-neutral-500 px-3 py-2 rounded-lg border border-pink-500/40 focus:outline-hidden focus:border-pink-400"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading || lockout.isLocked}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-pink-600 via-purple-600 to-cyan-500 hover:from-pink-500 hover:via-purple-500 hover:to-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-pink-600/35 hover:shadow-cyan-500/40 active:scale-98 transition-all border border-pink-400/30 group mt-1"
            >
              <KeyRound className="w-4 h-4 group-hover:rotate-12 transition-transform" />
              <span>
                {lockout.isLocked
                  ? `Locked (${formatLockoutCountdown(lockout.remainingSeconds)})`
                  : isLoading
                  ? 'Verifying...'
                  : 'Sign In'}
              </span>
              {!lockout.isLocked && (
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              )}
            </button>

            <div className="pt-2 border-t border-neutral-800/80 flex flex-col gap-2">
              <button
                type="button"
                disabled={lockout.isLocked}
                onClick={handleQuickCreatorDemo}
                className="w-full p-2.5 bg-neutral-900/90 hover:bg-neutral-800 disabled:opacity-50 border border-neutral-800 hover:border-cyan-500/40 rounded-xl flex items-center justify-between text-left transition-all group"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center shrink-0 border border-cyan-500/30">
                    <Sparkles className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold text-white truncate group-hover:text-cyan-400">
                      Quick Creator Preview
                    </p>
                    <p className="text-[9px] text-neutral-400 font-mono">@cosmic_explorer</p>
                  </div>
                </div>
                <span className="text-[10px] font-bold text-cyan-400 shrink-0">Try &rarr;</span>
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleRegisterSubmit} className="space-y-3 relative z-10">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-neutral-300">Display Name</label>
                <span className="text-[10px] text-neutral-400">HTML tags stripped</span>
              </div>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={regName}
                  onChange={(e) => setRegName(sanitizeInputLive(e.target.value, 80))}
                  placeholder="e.g. Jatt ★ Official Vibes"
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-xl pl-9 pr-3.5 py-2 text-xs text-white placeholder-neutral-500 focus:outline-hidden focus:border-pink-500"
                />
                <User className="w-4 h-4 text-pink-400 absolute left-3 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-bold text-neutral-300 mb-1">@Username</label>
                <input
                  type="text"
                  required
                  value={regUsername}
                  onChange={(e) =>
                    setRegUsername(
                      sanitizeInputLive(e.target.value, 40)
                        .toLowerCase()
                        .replace(/[^a-z0-9_.-]/g, '')
                    )
                  }
                  placeholder="jatt_vibe"
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white placeholder-neutral-500 focus:outline-hidden focus:border-pink-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-neutral-300 mb-1">Account Type</label>
                <select
                  value={regRole}
                  onChange={(e) => setRegRole(e.target.value as 'user' | 'creator')}
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-2.5 py-2 text-xs text-white focus:outline-hidden"
                >
                  <option value="user">Viewer (User)</option>
                  <option value="creator">Creator</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-bold text-neutral-300 mb-1">Email</label>
                <div className="relative">
                  <input
                    type="email"
                    value={regEmail}
                    onChange={(e) => setRegEmail(sanitizeInputLive(e.target.value, 120))}
                    placeholder="name@example.com"
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-neutral-500 focus:outline-hidden focus:border-pink-500"
                  />
                  <Mail className="w-3.5 h-3.5 text-pink-400 absolute left-3 top-1/2 -translate-y-1/2" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-neutral-300 mb-1">Phone Number</label>
                <div className="relative">
                  <input
                    type="tel"
                    value={regPhone}
                    onChange={(e) => setRegPhone(sanitizeInputLive(e.target.value, 32))}
                    placeholder="+92 300 1234567"
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-neutral-500 focus:outline-hidden focus:border-pink-500"
                  />
                  <Phone className="w-3.5 h-3.5 text-cyan-400 absolute left-3 top-1/2 -translate-y-1/2" />
                </div>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-neutral-300">Strong Password</label>
                <span
                  className={`text-[10px] font-bold ${
                    passwordStrength.isValid ? 'text-emerald-400' : 'text-amber-400'
                  }`}
                >
                  {passwordStrength.score}/4 rules
                </span>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="Min 8 chars, Uppercase, Number & Symbol"
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

              {/* Password Strength Checklist */}
              <div className="mt-2 grid grid-cols-2 gap-1.5 p-2.5 rounded-xl bg-neutral-900/80 border border-neutral-800/80 text-[10px]">
                <div
                  className={`flex items-center gap-1.5 ${
                    passwordStrength.minLength ? 'text-emerald-400 font-semibold' : 'text-neutral-400'
                  }`}
                >
                  {passwordStrength.minLength ? (
                    <CheckCircle2 className="w-3 h-3 shrink-0" />
                  ) : (
                    <Circle className="w-3 h-3 shrink-0" />
                  )}
                  <span>8+ characters</span>
                </div>
                <div
                  className={`flex items-center gap-1.5 ${
                    passwordStrength.hasUppercase ? 'text-emerald-400 font-semibold' : 'text-neutral-400'
                  }`}
                >
                  {passwordStrength.hasUppercase ? (
                    <CheckCircle2 className="w-3 h-3 shrink-0" />
                  ) : (
                    <Circle className="w-3 h-3 shrink-0" />
                  )}
                  <span>Uppercase (A-Z)</span>
                </div>
                <div
                  className={`flex items-center gap-1.5 ${
                    passwordStrength.hasNumber ? 'text-emerald-400 font-semibold' : 'text-neutral-400'
                  }`}
                >
                  {passwordStrength.hasNumber ? (
                    <CheckCircle2 className="w-3 h-3 shrink-0" />
                  ) : (
                    <Circle className="w-3 h-3 shrink-0" />
                  )}
                  <span>Number (0-9)</span>
                </div>
                <div
                  className={`flex items-center gap-1.5 ${
                    passwordStrength.hasSymbol ? 'text-emerald-400 font-semibold' : 'text-neutral-400'
                  }`}
                >
                  {passwordStrength.hasSymbol ? (
                    <CheckCircle2 className="w-3 h-3 shrink-0" />
                  ) : (
                    <Circle className="w-3 h-3 shrink-0" />
                  )}
                  <span>Symbol (!@#$...)</span>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading || !passwordStrength.isValid}
              className="w-full py-2.5 bg-gradient-to-r from-pink-600 via-purple-600 to-cyan-500 hover:from-pink-500 hover:to-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black text-xs rounded-xl shadow-lg shadow-pink-600/25 active:scale-98 transition-all mt-2"
            >
              {isLoading ? 'Encrypting & Creating...' : 'Complete Secure Registration'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
