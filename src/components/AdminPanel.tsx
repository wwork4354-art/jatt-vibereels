import React, { useState } from 'react';
import {
  X,
  Shield,
  Users,
  UserCheck,
  UserX,
  Search,
  Plus,
  Trash2,
  CheckCircle,
  AlertTriangle,
  Video,
  ArrowUpDown,
  Filter,
} from 'lucide-react';
import { UserAccount, UserRole, UserStatus } from '../types';

interface AdminPanelProps {
  isOpen: boolean;
  onClose: () => void;
  users: UserAccount[];
  currentUser: UserAccount | null;
  onUpdateUserRole: (userId: string, newRole: UserRole) => void;
  onToggleUserStatus: (userId: string) => void;
  onDeleteUser: (userId: string) => void;
  onAddNewUser: (user: UserAccount) => void;
  onShowToast: (msg: string) => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  isOpen,
  onClose,
  users,
  currentUser,
  onUpdateUserRole,
  onToggleUserStatus,
  onDeleteUser,
  onAddNewUser,
  onShowToast,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | UserRole>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | UserStatus>('all');
  const [showAddModal, setShowAddModal] = useState(false);

  // New user form state
  const [newUserName, setNewUserName] = useState('');
  const [newUserUsername, setNewUserUsername] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRole, setNewUserRole] = useState<UserRole>('user');

  if (!isOpen) return null;

  // Filtered users list
  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    const matchesStatus = statusFilter === 'all' || u.status === statusFilter;
    return matchesSearch && matchesRole && matchesStatus;
  });

  // Analytics counts
  const totalUsers = users.length;
  const totalCreators = users.filter((u) => u.role === 'creator').length;
  const totalAdmins = users.filter((u) => u.role === 'admin').length;
  const totalSuspended = users.filter((u) => u.status === 'suspended').length;

  const handleCreateUserSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName.trim() || !newUserUsername.trim() || !newUserEmail.trim()) {
      return;
    }

    const created: UserAccount = {
      id: `usr-admin-${Date.now()}`,
      name: newUserName.trim(),
      username: newUserUsername.trim().toLowerCase().replace(/^@/, ''),
      email: newUserEmail.trim().toLowerCase(),
      avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${newUserUsername}&backgroundColor=${newUserRole === 'admin' ? 'ec4899' : '6366f1'}`,
      role: newUserRole,
      status: 'active',
      joinedAt: 'Nov 2026',
      videosCount: 0,
      bio: 'Added via Admin Console',
    };

    onAddNewUser(created);
    setShowAddModal(false);
    setNewUserName('');
    setNewUserUsername('');
    setNewUserEmail('');
    onShowToast(`User @${created.username} created successfully`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-3 sm:p-6 overflow-y-auto">
      <div className="w-full max-w-5xl bg-neutral-900 border border-neutral-800 rounded-3xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Top Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800/80 bg-neutral-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-pink-600 to-rose-600 text-white flex items-center justify-center shadow-md shadow-pink-600/20">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white tracking-tight">Jatt VibeReels · Admin Console</h2>
                <span className="text-[10px] font-bold uppercase tracking-wider text-pink-400 bg-pink-500/10 px-2 py-0.5 rounded-full border border-pink-500/20">
                  User Management
                </span>
              </div>
              <p className="text-xs text-neutral-400">
                Logged in as <span className="text-neutral-200 font-semibold">{currentUser?.name || 'Administrator'}</span> ({currentUser?.email || 'admin'})
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-neutral-400 hover:text-white rounded-full hover:bg-neutral-800 transition-colors"
            aria-label="Close admin panel"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Metric Cards Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-6 bg-neutral-950/30 border-b border-neutral-800/60">
          <div className="p-3.5 bg-neutral-900/80 rounded-2xl border border-neutral-800 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/15 text-blue-400 flex items-center justify-center shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold text-neutral-400">Total Users</p>
              <p className="text-xl font-bold text-white tabular-nums">{totalUsers}</p>
            </div>
          </div>

          <div className="p-3.5 bg-neutral-900/80 rounded-2xl border border-neutral-800 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-pink-500/15 text-pink-400 flex items-center justify-center shrink-0">
              <Video className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold text-neutral-400">Active Creators</p>
              <p className="text-xl font-bold text-white tabular-nums">{totalCreators}</p>
            </div>
          </div>

          <div className="p-3.5 bg-neutral-900/80 rounded-2xl border border-neutral-800 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center shrink-0">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold text-neutral-400">Administrators</p>
              <p className="text-xl font-bold text-white tabular-nums">{totalAdmins}</p>
            </div>
          </div>

          <div className="p-3.5 bg-neutral-900/80 rounded-2xl border border-neutral-800 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/15 text-rose-400 flex items-center justify-center shrink-0">
              <UserX className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold text-neutral-400">Suspended</p>
              <p className="text-xl font-bold text-white tabular-nums">{totalSuspended}</p>
            </div>
          </div>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="px-6 py-3.5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b border-neutral-800/60 bg-neutral-900">
          <div className="flex-1 flex items-center gap-2 max-w-md">
            <div className="relative w-full">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by name, @username, or email..."
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-neutral-500 focus:outline-hidden focus:border-pink-500"
              />
              <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
            {/* Role Filter */}
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as 'all' | UserRole)}
              className="bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-300 font-medium focus:outline-hidden"
            >
              <option value="all">All Roles</option>
              <option value="admin">Admins</option>
              <option value="creator">Creators</option>
              <option value="user">Users</option>
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | UserStatus)}
              className="bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-300 font-medium focus:outline-hidden"
            >
              <option value="all">All Status</option>
              <option value="active">Active Only</option>
              <option value="suspended">Suspended Only</option>
            </select>

            {/* Add User Button */}
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="px-3.5 py-2 bg-pink-600 hover:bg-pink-500 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-md shadow-pink-600/20 active:scale-95 transition-all shrink-0"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Add User</span>
            </button>
          </div>
        </div>

        {/* Users Table */}
        <div className="flex-1 overflow-y-auto px-6 py-4 no-scrollbar">
          {filteredUsers.length === 0 ? (
            <div className="py-16 text-center text-neutral-500">
              <Users className="w-10 h-10 mx-auto mb-2 text-neutral-600" />
              <p className="text-sm font-semibold text-neutral-300">No users found</p>
              <p className="text-xs text-neutral-500 mt-1">Try adjusting your search or filters.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-neutral-800 text-neutral-400 font-semibold uppercase tracking-wider text-[10px]">
                    <th className="pb-3 pl-2">User</th>
                    <th className="pb-3 px-3">Role</th>
                    <th className="pb-3 px-3">Status</th>
                    <th className="pb-3 px-3 text-right">Reels</th>
                    <th className="pb-3 px-3">Joined</th>
                    <th className="pb-3 pr-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/60">
                  {filteredUsers.map((u) => {
                    const isSelf = currentUser?.id === u.id;
                    return (
                      <tr key={u.id} className="hover:bg-neutral-800/40 transition-colors group">
                        {/* User Identity */}
                        <td className="py-3 pl-2">
                          <div className="flex items-center gap-3">
                            <img
                              src={u.avatar}
                              alt={u.name}
                              className="w-9 h-9 rounded-full object-cover bg-neutral-800 border border-neutral-700/60 shrink-0"
                              referrerPolicy="no-referrer"
                            />
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-white truncate">{u.name}</span>
                                {isSelf && (
                                  <span className="text-[9px] bg-pink-500/20 text-pink-400 px-1.5 py-0.2 rounded-xs font-semibold">
                                    You
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-neutral-400 truncate">@{u.username}</p>
                              <p className="text-[10px] text-neutral-500 truncate">{u.email}</p>
                            </div>
                          </div>
                        </td>

                        {/* Role Selector */}
                        <td className="py-3 px-3">
                          <select
                            value={u.role}
                            disabled={isSelf}
                            onChange={(e) => {
                              onUpdateUserRole(u.id, e.target.value as UserRole);
                              onShowToast(`Updated @${u.username} role to ${e.target.value}`);
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
                            <option value="admin">Admin</option>
                          </select>
                        </td>

                        {/* Status Badge & Toggle */}
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
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors ${
                              u.status === 'active'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20'
                                : 'bg-rose-500/10 text-rose-400 border border-rose-500/30 hover:bg-rose-500/20'
                            }`}
                            title={isSelf ? 'Cannot change own status' : 'Click to toggle status'}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                u.status === 'active' ? 'bg-emerald-400' : 'bg-rose-400'
                              }`}
                            />
                            <span>{u.status === 'active' ? 'Active' : 'Suspended'}</span>
                          </button>
                        </td>

                        {/* Video count */}
                        <td className="py-3 px-3 text-right tabular-nums font-semibold text-neutral-300">
                          {u.videosCount}
                        </td>

                        {/* Joined Date */}
                        <td className="py-3 px-3 text-neutral-400 text-[11px]">
                          {u.joinedAt}
                        </td>

                        {/* Actions */}
                        <td className="py-3 pr-2 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {!isSelf && (
                              <button
                                type="button"
                                onClick={() => {
                                  if (confirm(`Are you sure you want to delete user @${u.username}?`)) {
                                    onDeleteUser(u.id);
                                    onShowToast(`Deleted user @${u.username}`);
                                  }
                                }}
                                className="p-1.5 text-neutral-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                                title="Delete user"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
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
                <h3 className="text-sm font-bold text-white">Create New User</h3>
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
                    onChange={(e) => setNewUserName(e.target.value)}
                    placeholder="e.g. Jordan Smith"
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-hidden focus:border-pink-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-neutral-400 mb-1">
                    Username
                  </label>
                  <input
                    type="text"
                    required
                    value={newUserUsername}
                    onChange={(e) => setNewUserUsername(e.target.value)}
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
                    required
                    value={newUserEmail}
                    onChange={(e) => setNewUserEmail(e.target.value)}
                    placeholder="jordan@example.com"
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
                    <option value="admin">Administrator</option>
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
                    className="px-4 py-2 bg-pink-600 hover:bg-pink-500 text-white text-xs font-bold rounded-xl shadow-md transition-colors"
                  >
                    Create User
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
