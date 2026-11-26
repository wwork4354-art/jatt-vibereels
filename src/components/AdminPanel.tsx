import React, { useState, useEffect } from 'react';
import {
  X,
  Shield,
  Users,
  UserX,
  Search,
  Plus,
  Trash2,
  Video,
  RefreshCw,
  Clock,
  Mail,
  Phone,
  Lock,
  KeyRound,
  AlertTriangle,
  Eye,
  EyeOff,
  Wallet,
  CalendarCheck,
} from 'lucide-react';
import { UserAccount, UserRole, UserStatus } from '../types';
import {
  formatAccountCreatedDateTime,
  isMainAdminAccount,
  isUserOnlineNow,
} from '../data/mockUsers';
import {
  sanitizeInputLive,
  sanitizeText,
  sanitizeUsername,
  verifyAdminPinAsync,
  verifyUsersTrackerPinAsync,
  setCustomUsersTrackerPinAsync,
  resetUsersTrackerPinToDefault,
  getLockoutStatus,
  recordFailedAttempt,
  resetLockout,
  formatLockoutCountdown,
  LockoutStatus,
} from '../utils/security';
import { BRAND_CONFIG } from '../config/brandConfig';
import { evaluateLicenseSync } from '../lib/licenseService';
import { EasyPaymentModal } from './EasyPaymentModal';

interface AdminPanelProps {
  isOpen: boolean;
  onClose: () => void;
  users: UserAccount[];
  currentUser: UserAccount | null;
  isAdminUnlocked: boolean;
  onUnlockAdmin: () => void;
  onLockAdmin: () => void;
  onUpdateUserRole: (userId: string, newRole: UserRole) => void;
  onToggleUserStatus: (userId: string) => void;
  onDeleteUser: (userId: string) => void;
  onAddNewUser: (user: UserAccount) => void;
  onRefreshLiveUsers?: () => void;
  onShowToast: (msg: string) => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  isOpen,
  onClose,
  users,
  currentUser,
  isAdminUnlocked,
  onUnlockAdmin,
  onLockAdmin,
  onUpdateUserRole,
  onToggleUserStatus,
  onDeleteUser,
  onAddNewUser,
  onRefreshLiveUsers,
  onShowToast,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | UserRole>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | UserStatus | 'online'>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [confirmDeleteUserId, setConfirmDeleteUserId] = useState<string | null>(null);
  const [nowTick, setNowTick] = useState<number>(() => Date.now());
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const licenseStatus = evaluateLicenseSync();

  // Secret Admin PIN Lock Gate states
  const [pinInput, setPinInput] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [pinError, setPinError] = useState('');
  const [verifyingPin, setVerifyingPin] = useState(false);
  const [showPinReset, setShowPinReset] = useState(false);
  const [customResetPin, setCustomResetPin] = useState('');
  const [pinLockout, setPinLockout] = useState<LockoutStatus>(() =>
    getLockoutStatus('admin_pin')
  );

  // New user form state
  const [newUserName, setNewUserName] = useState('');
  const [newUserUsername, setNewUserUsername] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPhone, setNewUserPhone] = useState('');
  const [newUserRole, setNewUserRole] = useState<UserRole>('user');

  // Tick brute-force lockout countdown every 1s when PIN gate is locked
  useEffect(() => {
    if (!isOpen) return;
    setPinLockout(getLockoutStatus('admin_pin'));
    const timer = window.setInterval(() => {
      setPinLockout(getLockoutStatus('admin_pin'));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isOpen, isAdminUnlocked]);

  // Auto-refresh live clock & live users list every 10s ONLY when Admin Panel is open & unlocked
  useEffect(() => {
    if (!isOpen || !isAdminUnlocked || !isMainAdminAccount(currentUser)) return;
    onRefreshLiveUsers?.();
    const timer = window.setInterval(() => {
      setNowTick(Date.now());
      onRefreshLiveUsers?.();
    }, 10_000);
    return () => window.clearInterval(timer);
  }, [isOpen, isAdminUnlocked, currentUser, onRefreshLiveUsers]);

  if (!isOpen) return null;

  // Strict security gate: ONLY Main Admin Account may view the dashboard
  if (!isMainAdminAccount(currentUser)) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4"
        onClick={onClose}
      >
        <div
          className="w-full max-w-sm bg-neutral-950 border border-rose-500/40 rounded-3xl p-6 text-center space-y-4 shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="w-12 h-12 rounded-2xl bg-rose-500/15 border border-rose-500/40 text-rose-400 flex items-center justify-center mx-auto">
            <Lock className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-black text-white">Admin Access Restricted</h3>
            <p className="text-xs text-neutral-400 leading-relaxed">
              This Live Users Dashboard is private and accessible only to the main {BRAND_CONFIG.appName} Administrator account.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-bold cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  // Gate 2: Secret Admin PIN screen + 3-attempt -> 5-minute brute-force lockout
  if (!isAdminUnlocked) {
    const handleVerifyAdminPin = async (e: React.FormEvent) => {
      e.preventDefault();
      setPinError('');

      const currentLock = getLockoutStatus('admin_pin');
      setPinLockout(currentLock);
      if (currentLock.isLocked) {
        setPinError(
          `Admin access locked for ${formatLockoutCountdown(
            currentLock.remainingSeconds
          )} due to failed attempts.`
        );
        return;
      }

      setVerifyingPin(true);
      try {
        const isOk =
          (await verifyAdminPinAsync(pinInput)) ||
          (await verifyUsersTrackerPinAsync(pinInput));
        if (!isOk) {
          const nextLock = recordFailedAttempt('admin_pin');
          setPinLockout(nextLock);
          setPinInput('');
          setPinError(
            nextLock.isLocked
              ? `3 failed PIN attempts. Admin Panel locked for ${formatLockoutCountdown(
                  nextLock.remainingSeconds
                )}.`
              : `Invalid Admin Security PIN. (${nextLock.attemptsLeft} attempt${
                  nextLock.attemptsLeft === 1 ? '' : 's'
                } left before 5m lockout)`
          );
          return;
        }

        resetLockout('admin_pin');
        setPinLockout(getLockoutStatus('admin_pin'));
        setPinInput('');
        setPinError('');
        onUnlockAdmin();
        onShowToast('Admin Panel unlocked');
      } finally {
        setVerifyingPin(false);
      }
    };

    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4"
        onClick={onClose}
      >
        <div
          className="w-full max-w-sm bg-neutral-950 border border-pink-500/40 rounded-3xl p-6 space-y-4 shadow-[0_0_50px_rgba(236,72,153,0.2)]"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-pink-600 to-rose-600 text-white flex items-center justify-center shadow-lg shadow-pink-600/25">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-white">Admin Vault Locked</h3>
                <p className="text-[11px] text-neutral-400">Secret Admin PIN Verification</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-neutral-400 hover:text-white rounded-full hover:bg-neutral-800"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {pinLockout.isLocked && (
            <div className="p-3.5 rounded-xl bg-rose-950/75 border border-rose-500/50 flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 text-rose-200">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                <div>
                  <p className="font-black text-rose-300">Locked for 5 Minutes</p>
                  <p className="text-[10px] text-rose-200/80">Brute-force protection active</p>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-lg bg-black/60 border border-rose-500/40 font-mono font-black text-rose-300 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {formatLockoutCountdown(pinLockout.remainingSeconds)}
              </span>
            </div>
          )}

          {pinError && (
            <div className="p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/40 text-xs text-rose-300 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{pinError}</span>
            </div>
          )}

          <form onSubmit={handleVerifyAdminPin} className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-neutral-300 mb-1.5">
                Enter Admin Security PIN
              </label>
              <div className="relative">
                <input
                  type={showPin ? 'text' : 'password'}
                  required
                  autoFocus
                  disabled={pinLockout.isLocked}
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value)}
                  placeholder="Secret PIN"
                  className="w-full bg-neutral-900 border border-neutral-800 focus:border-pink-500 rounded-xl pl-9 pr-10 py-2.5 text-xs text-white placeholder-neutral-500 focus:outline-hidden disabled:opacity-50"
                />
                <KeyRound className="w-4 h-4 text-pink-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <button
                  type="button"
                  onClick={() => setShowPin((p) => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300"
                >
                  {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={verifyingPin || pinLockout.isLocked}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-black flex items-center justify-center gap-2 shadow-lg shadow-pink-600/25 cursor-pointer"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>
                {pinLockout.isLocked
                  ? `Locked (${formatLockoutCountdown(pinLockout.remainingSeconds)})`
                  : verifyingPin
                  ? 'Verifying PIN...'
                  : 'Unlock Admin Panel'}
              </span>
            </button>
          </form>

          {/* Subtle Forgot / Reset PIN option for logged-in Main Admin */}
          <div className="pt-1 border-t border-neutral-800/80">
            {!showPinReset ? (
              <div className="flex items-center justify-between text-[11px] text-neutral-500">
                <span>Signed in as Admin</span>
                <button
                  type="button"
                  onClick={() => {
                    setPinError('');
                    setShowPinReset(true);
                  }}
                  className="text-neutral-400 hover:text-pink-400 underline underline-offset-2 cursor-pointer"
                >
                  Forgot / Reset PIN
                </button>
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-neutral-900/90 border border-neutral-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-white">Reset Tracker PIN</span>
                  <button
                    type="button"
                    onClick={() => setShowPinReset(false)}
                    className="text-[11px] text-neutral-400 hover:text-white cursor-pointer"
                  >
                    Back
                  </button>
                </div>
                <div className="flex gap-2">
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={8}
                    value={customResetPin}
                    onChange={(e) => setCustomResetPin(e.target.value.replace(/[^\d]/g, ''))}
                    placeholder="New 4-8 digit PIN"
                    className="flex-1 bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-neutral-500 focus:outline-hidden focus:border-pink-500"
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      const res = await setCustomUsersTrackerPinAsync(customResetPin);
                      if (!res.ok) {
                        setPinError(res.error || 'Enter 4-8 digits.');
                        return;
                      }
                      setPinLockout(getLockoutStatus('admin_pin'));
                      setCustomResetPin('');
                      setShowPinReset(false);
                      setPinError('');
                      onUnlockAdmin();
                      onShowToast('Custom PIN saved & Admin Panel unlocked');
                    }}
                    className="px-3 py-1.5 rounded-lg bg-pink-600 hover:bg-pink-500 text-white text-[11px] font-bold cursor-pointer shrink-0"
                  >
                    Save &amp; Unlock
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    resetUsersTrackerPinToDefault();
                    setPinLockout(getLockoutStatus('admin_pin'));
                    setPinError('');
                    setShowPinReset(false);
                    onUnlockAdmin();
                    onShowToast('Lockout cleared & PIN reset to default');
                  }}
                  className="w-full py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-[11px] font-semibold cursor-pointer"
                >
                  Reset to Default PIN &amp; Unlock
                </button>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => setIsPaymentOpen(true)}
            className="w-full py-2.5 px-3 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/35 text-emerald-300 text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <Wallet className="w-4 h-4 shrink-0" />
            <span>Easy Payment &amp; Rent Renewal (JazzCash / EasyPaisa)</span>
          </button>
        </div>

        <EasyPaymentModal
          isOpen={isPaymentOpen}
          onClose={() => setIsPaymentOpen(false)}
          onShowToast={onShowToast}
          initialBrandName={BRAND_CONFIG.appName}
        />
      </div>
    );
  }

  // Sort newest registrations first
  const sortedUsers = [...users].sort((a, b) => {
    const tA = a.createdAtIso ? new Date(a.createdAtIso).getTime() : 0;
    const tB = b.createdAtIso ? new Date(b.createdAtIso).getTime() : 0;
    return tB - tA;
  });

  // Filtered users list
  const filteredUsers = sortedUsers.filter((u) => {
    const q = sanitizeText(searchTerm, 120).toLowerCase();
    const matchesSearch =
      !q ||
      u.name.toLowerCase().includes(q) ||
      u.username.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (u.phone && u.phone.toLowerCase().includes(q));
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    const isOnline = isUserOnlineNow(u, nowTick);
    const matchesStatus =
      statusFilter === 'all'
        ? true
        : statusFilter === 'online'
        ? isOnline
        : u.status === statusFilter;
    return matchesSearch && matchesRole && matchesStatus;
  });

  // Live analytics counts
  const totalUsers = users.length;
  const totalOnlineNow = users.filter((u) => isUserOnlineNow(u, nowTick)).length;
  const totalCreators = users.filter((u) => u.role === 'creator').length;
  const totalSuspended = users.filter((u) => u.status === 'suspended').length;

  const handleCreateUserSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = sanitizeText(newUserName, 80);
    const cleanHandle = sanitizeUsername(newUserUsername, 40);
    const cleanEmail = sanitizeText(newUserEmail, 120).toLowerCase();
    const cleanPhone = sanitizeText(newUserPhone, 32);

    if (!cleanName || !cleanHandle || (!cleanEmail && !cleanPhone)) {
      onShowToast('Please provide valid sanitized Name, @Username, and Email/Phone.');
      return;
    }

    const nowIso = new Date().toISOString();
    const safeRole: UserRole = newUserRole === 'creator' ? 'creator' : 'user';
    const created: UserAccount = {
      id: `usr-admin-${Date.now()}`,
      name: cleanName,
      username: cleanHandle,
      email: cleanEmail || `${cleanHandle}@vibereels.app`,
      phone: cleanPhone || undefined,
      avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(
        cleanHandle
      )}&backgroundColor=6366f1`,
      role: safeRole,
      status: 'active',
      joinedAt: new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }),
      createdAtIso: nowIso,
      lastActiveAt: nowIso,
      isOnline: true,
      videosCount: 0,
      bio: 'Added via Admin Console',
    };

    onAddNewUser(created);
    setShowAddModal(false);
    setNewUserName('');
    setNewUserUsername('');
    setNewUserEmail('');
    setNewUserPhone('');
    onShowToast(`User @${created.username} created successfully`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-3 sm:p-6 overflow-y-auto">
      <div className="w-full max-w-6xl bg-neutral-900 border border-neutral-800 rounded-3xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Top Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-neutral-800/80 bg-neutral-950/70 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-pink-600 to-rose-600 text-white flex items-center justify-center shadow-md shadow-pink-600/20 shrink-0">
              <Shield className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-black text-white tracking-tight truncate">
                  Registered App Users &amp; Admin Console
                </h2>
                <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-emerald-300 bg-emerald-500/15 px-2.5 py-0.5 rounded-full border border-emerald-500/35">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  <span>LIVE · {totalUsers} Users</span>
                </span>
              </div>
              <p className="text-xs text-neutral-400 truncate">
                Registered App Users Directory · Owner: <span className="text-neutral-200 font-semibold">{currentUser?.email}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                onLockAdmin();
                onShowToast('Admin Panel locked');
              }}
              className="px-3 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 text-xs font-bold flex items-center gap-1.5 border border-rose-500/35 cursor-pointer"
              title="Lock Admin Panel immediately"
            >
              <Lock className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Lock</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setNowTick(Date.now());
                onRefreshLiveUsers?.();
                onShowToast('Refreshed live user registrations');
              }}
              className="px-3 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-cyan-300 text-xs font-bold flex items-center gap-1.5 border border-neutral-700 cursor-pointer"
              title="Refresh live user registrations"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Live Sync</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-neutral-400 hover:text-white rounded-full hover:bg-neutral-800 transition-colors cursor-pointer"
              aria-label="Close admin panel"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Live Metric Cards Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-5 sm:p-6 bg-neutral-950/35 border-b border-neutral-800/60">
          <div className="p-3.5 bg-neutral-900/90 rounded-2xl border border-neutral-800 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/15 text-blue-400 flex items-center justify-center shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold text-neutral-400">Total Users</p>
              <p className="text-xl font-black text-white tabular-nums">{totalUsers}</p>
            </div>
          </div>

          <div className="p-3.5 bg-neutral-900/90 rounded-2xl border border-emerald-500/25 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0">
              <span className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse" />
            </div>
            <div>
              <p className="text-[11px] font-semibold text-neutral-400">Online / Active</p>
              <p className="text-xl font-black text-emerald-400 tabular-nums">{totalOnlineNow}</p>
            </div>
          </div>

          <div className="p-3.5 bg-neutral-900/90 rounded-2xl border border-neutral-800 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-pink-500/15 text-pink-400 flex items-center justify-center shrink-0">
              <Video className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold text-neutral-400">Creators</p>
              <p className="text-xl font-black text-white tabular-nums">{totalCreators}</p>
            </div>
          </div>

          <div className="p-3.5 bg-neutral-900/90 rounded-2xl border border-neutral-800 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/15 text-rose-400 flex items-center justify-center shrink-0">
              <UserX className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold text-neutral-400">Suspended</p>
              <p className="text-xl font-black text-white tabular-nums">{totalSuspended}</p>
            </div>
          </div>
        </div>

        {/* Subscription & Rent Renewal Strip */}
        <div className="px-5 sm:px-6 py-3 bg-neutral-950/60 border-b border-neutral-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
              <CalendarCheck className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-white truncate">
                Subscription &amp; Rental License
              </p>
              <p className="text-[11px] text-neutral-400 tabular-nums truncate">
                {licenseStatus.phase === 'grace'
                  ? `Grace Period · Expired ${licenseStatus.expiryDateLabel} (${licenseStatus.graceDaysRemaining}d left)`
                  : licenseStatus.isValid
                  ? `Active · Expires ${licenseStatus.expiryDateLabel} · ${licenseStatus.daysRemaining} days left`
                  : `Renewal Required · Expiry: ${licenseStatus.expiryDateLabel}`}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsPaymentOpen(true)}
            className="min-h-[40px] px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20 transition-colors cursor-pointer shrink-0"
          >
            <Wallet className="w-4 h-4 shrink-0" />
            <span>Easy Payment &amp; Rent Renewal</span>
          </button>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="px-5 sm:px-6 py-3.5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b border-neutral-800/60 bg-neutral-900">
          <div className="flex-1 flex items-center gap-2 max-w-md">
            <div className="relative w-full">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(sanitizeInputLive(e.target.value, 120))}
                placeholder="Search by name, @username, email or phone..."
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-neutral-500 focus:outline-hidden focus:border-pink-500"
              />
              <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as 'all' | UserRole)}
              className="bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-300 font-medium focus:outline-hidden"
            >
              <option value="all">All Roles</option>
              <option value="creator">Creators</option>
              <option value="user">Users</option>
              <option value="admin">Admin</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | UserStatus | 'online')}
              className="bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-300 font-medium focus:outline-hidden"
            >
              <option value="all">All Status</option>
              <option value="online">Online Now</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended Only</option>
            </select>

            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="px-3.5 py-2 bg-pink-600 hover:bg-pink-500 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-md shadow-pink-600/20 active:scale-95 transition-all shrink-0 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Add User</span>
            </button>
          </div>
        </div>

        {/* Live Users Table */}
        <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-4 no-scrollbar">
          {filteredUsers.length === 0 ? (
            <div className="py-16 text-center text-neutral-500">
              <Users className="w-10 h-10 mx-auto mb-2 text-neutral-600" />
              <p className="text-sm font-semibold text-neutral-300">No users found</p>
              <p className="text-xs text-neutral-500 mt-1">Try adjusting your search or filters.</p>
            </div>
          ) : (
            <>
              {/* Mobile Card View for Registered App Users (clean avatar, name, @username & join date) */}
              <div className="md:hidden space-y-2.5">
                {filteredUsers.map((u) => {
                  const isSelf = currentUser?.id === u.id || isMainAdminAccount(u);
                  const isOnline = isUserOnlineNow(u, nowTick);
                  const createdDt = formatAccountCreatedDateTime(u);

                  return (
                    <div
                      key={`mob-${u.id}`}
                      className="p-3 rounded-2xl bg-neutral-950/90 border border-neutral-800 space-y-2.5"
                    >
                      <div className="flex items-center justify-between gap-2.5">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="relative shrink-0">
                            <img
                              src={u.avatar}
                              alt={u.name}
                              loading="lazy"
                              decoding="async"
                              className="w-10 h-10 rounded-full object-cover bg-neutral-800 border border-pink-500/40"
                              referrerPolicy="no-referrer"
                            />
                            <span
                              className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-neutral-900 ${
                                u.status === 'suspended'
                                  ? 'bg-rose-500'
                                  : isOnline
                                  ? 'bg-emerald-400'
                                  : 'bg-neutral-500'
                              }`}
                            />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-xs font-black text-white truncate">
                                {u.name}
                              </span>
                              {isSelf && (
                                <span className="text-[9px] bg-pink-500/20 text-pink-400 px-1.5 py-0.2 rounded-xs font-black">
                                  Main Admin
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-cyan-400 font-semibold truncate">
                              @{u.username}
                            </p>
                          </div>
                        </div>

                        <span className="text-[10px] text-neutral-400 tabular-nums shrink-0">
                          {createdDt.dateLabel}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-neutral-800 text-neutral-400 font-semibold uppercase tracking-wider text-[10px]">
                    <th className="pb-3 pl-2">Name &amp; @Username</th>
                    <th className="pb-3 px-3">Email / Phone</th>
                    <th className="pb-3 px-3">Account Created (Date &amp; Time)</th>
                    <th className="pb-3 px-3">Online / Status</th>
                    <th className="pb-3 px-3">Role</th>
                    <th className="pb-3 pr-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/60">
                  {filteredUsers.map((u) => {
                    const isSelf = currentUser?.id === u.id || isMainAdminAccount(u);
                    const isOnline = isUserOnlineNow(u, nowTick);
                    const createdDt = formatAccountCreatedDateTime(u);

                    return (
                      <tr key={u.id} className="hover:bg-neutral-800/40 transition-colors group">
                        {/* Name & @Username */}
                        <td className="py-3 pl-2">
                          <div className="flex items-center gap-3">
                            <div className="relative shrink-0">
                              <img
                                src={u.avatar}
                                alt={u.name}
                                loading="lazy"
                                decoding="async"
                                className="w-9 h-9 rounded-full object-cover bg-neutral-800 border border-neutral-700/60"
                                referrerPolicy="no-referrer"
                              />
                              <span
                                className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-neutral-900 ${
                                  u.status === 'suspended'
                                    ? 'bg-rose-500'
                                    : isOnline
                                    ? 'bg-emerald-400'
                                    : 'bg-neutral-500'
                                }`}
                                title={isOnline ? 'Online / Active' : 'Offline'}
                              />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-white truncate">{u.name}</span>
                                {isSelf && (
                                  <span className="text-[9px] bg-pink-500/20 text-pink-400 px-1.5 py-0.2 rounded-xs font-black">
                                    Main Admin
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-cyan-400 font-semibold truncate">
                                @{u.username}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Email / Phone */}
                        <td className="py-3 px-3">
                          <div className="space-y-0.5 max-w-[200px]">
                            <p className="text-[11px] text-neutral-200 flex items-center gap-1 truncate">
                              <Mail className="w-3 h-3 text-pink-400 shrink-0" />
                              <span className="truncate">{u.email}</span>
                            </p>
                            {u.phone && (
                              <p className="text-[10px] text-neutral-400 flex items-center gap-1 truncate">
                                <Phone className="w-3 h-3 text-cyan-400 shrink-0" />
                                <span className="truncate">{u.phone}</span>
                              </p>
                            )}
                          </div>
                        </td>

                        {/* Account Creation Date & Time */}
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-1.5 text-neutral-300">
                            <Clock className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
                            <div>
                              <p className="text-[11px] font-semibold text-white whitespace-nowrap">
                                {createdDt.dateLabel}
                              </p>
                              <p className="text-[10px] text-neutral-400 tabular-nums whitespace-nowrap">
                                {createdDt.timeLabel}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Live Online / Active Status */}
                        <td className="py-3 px-3">
                          <button
                            type="button"
                            disabled={isSelf}
                            onClick={() => {
                              onToggleUserStatus(u.id);
                              onShowToast(
                                u.status === 'active'
                                  ? `Suspended account @${u.username}`
                                  : `Reactivated account @${u.username}`
                              );
                            }}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold transition-colors ${
                              u.status === 'suspended'
                                ? 'bg-rose-500/15 text-rose-400 border border-rose-500/35'
                                : isOnline
                                ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/40'
                                : 'bg-neutral-800 text-neutral-300 border border-neutral-700'
                            }`}
                            title={isSelf ? 'Main Admin status locked' : 'Click to toggle Active / Suspended'}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                u.status === 'suspended'
                                  ? 'bg-rose-400'
                                  : isOnline
                                  ? 'bg-emerald-400 animate-pulse'
                                  : 'bg-neutral-400'
                              }`}
                            />
                            <span>
                              {u.status === 'suspended'
                                ? 'Suspended'
                                : isOnline
                                ? 'Online · Active'
                                : 'Active (Offline)'}
                            </span>
                          </button>
                        </td>

                        {/* Role Selector */}
                        <td className="py-3 px-3">
                          <select
                            value={u.role}
                            disabled={isSelf}
                            onChange={(e) => {
                              const nextRole = e.target.value as UserRole;
                              if (nextRole === 'admin') return;
                              onUpdateUserRole(u.id, nextRole);
                              onShowToast(`Updated @${u.username} role to ${nextRole}`);
                            }}
                            className={`bg-neutral-950 border text-[11px] font-semibold rounded-lg px-2.5 py-1 focus:outline-hidden ${
                              u.role === 'admin'
                                ? 'text-pink-400 border-pink-500/40 bg-pink-500/10'
                                : u.role === 'creator'
                                ? 'text-indigo-400 border-indigo-500/40 bg-indigo-500/10'
                                : 'text-neutral-300 border-neutral-700'
                            }`}
                          >
                            <option value="user">User</option>
                            <option value="creator">Creator</option>
                            {u.role === 'admin' && <option value="admin">Main Admin</option>}
                          </select>
                        </td>

                        {/* In-App Delete Confirmation Actions */}
                        <td className="py-3 pr-2 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {!isSelf &&
                              (confirmDeleteUserId === u.id ? (
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      onDeleteUser(u.id);
                                      setConfirmDeleteUserId(null);
                                      onShowToast(`Removed user @${u.username}`);
                                    }}
                                    className="px-2 py-1 rounded-lg bg-rose-600 text-white text-[10px] font-black cursor-pointer"
                                  >
                                    Confirm
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setConfirmDeleteUserId(null)}
                                    className="px-2 py-1 rounded-lg bg-neutral-800 text-neutral-300 text-[10px] font-bold cursor-pointer"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteUserId(u.id)}
                                  className="p-1.5 text-neutral-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                                  title="Delete user"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              ))}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            </>
          )}
        </div>

        {/* Add User Modal Sub-dialog */}
        {showAddModal && (
          <div
            className="fixed inset-0 z-60 flex items-center justify-center bg-black/70 p-4"
            onClick={() => setShowAddModal(false)}
          >
            <div
              className="w-full max-w-sm bg-neutral-900 border border-neutral-800 rounded-2xl p-5 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
                <h3 className="text-sm font-bold text-white">Add New User</h3>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="p-1 text-neutral-400 hover:text-white rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleCreateUserSubmit} className="mt-3.5 space-y-3">
                <div>
                  <label className="block text-[11px] font-semibold text-neutral-400 mb-1">
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={newUserName}
                    onChange={(e) => setNewUserName(sanitizeInputLive(e.target.value, 80))}
                    placeholder="e.g. Jordan Smith"
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-hidden focus:border-pink-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-neutral-400 mb-1">
                    @Username
                  </label>
                  <input
                    type="text"
                    required
                    value={newUserUsername}
                    onChange={(e) =>
                      setNewUserUsername(
                        sanitizeInputLive(e.target.value, 40)
                          .toLowerCase()
                          .replace(/[^a-z0-9_.-]/g, '')
                      )
                    }
                    placeholder="jordansmith"
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-hidden focus:border-pink-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-neutral-400 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={newUserEmail}
                    onChange={(e) => setNewUserEmail(sanitizeInputLive(e.target.value, 120))}
                    placeholder="jordan@example.com"
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-hidden focus:border-pink-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-neutral-400 mb-1">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={newUserPhone}
                    onChange={(e) => setNewUserPhone(sanitizeInputLive(e.target.value, 32))}
                    placeholder="+92 300 1234567"
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-hidden focus:border-pink-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-neutral-400 mb-1">
                    Role
                  </label>
                  <select
                    value={newUserRole}
                    onChange={(e) => setNewUserRole(e.target.value as UserRole)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-hidden"
                  >
                    <option value="user">User (Viewer)</option>
                    <option value="creator">Creator</option>
                  </select>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-3 py-1.5 text-xs text-neutral-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-pink-600 hover:bg-pink-500 text-white text-xs font-bold rounded-xl shadow-md transition-colors cursor-pointer"
                  >
                    Create User
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>

      <EasyPaymentModal
        isOpen={isPaymentOpen}
        onClose={() => setIsPaymentOpen(false)}
        onShowToast={onShowToast}
        initialBrandName={BRAND_CONFIG.appName}
      />
    </div>
  );
};
