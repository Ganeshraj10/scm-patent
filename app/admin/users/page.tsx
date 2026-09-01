'use client';

import React, { useState, useMemo } from 'react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import {
  getAllUsers,
  createUser,
  updateUser,
  toggleUserStatus,
  changeUserRole,
  deleteUser,
} from '@/lib/services/userService';
import { UserProfile, UserRole, UserStatus, UserMutationInput } from '@/types';
import {
  Users,
  Search,
  Filter,
  UserPlus,
  Edit2,
  Shield,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  GraduationCap,
  Briefcase,
  UserCheck,
  UserX,
  RefreshCw,
  Trash2,
} from 'lucide-react';

export default function AdminUsersPage() {
  // Filters
  const [search, setSearch] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<UserRole | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<UserStatus | 'all'>('all');

  // Trigger re-render on mutation
  const [refreshKey, setRefreshKey] = useState<number>(0);

  // Modal States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [statusTogglingUser, setStatusTogglingUser] = useState<UserProfile | null>(null);
  const [roleChangingUser, setRoleChangingUser] = useState<UserProfile | null>(null);
  const [newSelectedRole, setNewSelectedRole] = useState<UserRole>('student');

  // New User Form State
  const [newUserData, setNewUserData] = useState<UserMutationInput>({
    name: '',
    email: '',
    role: 'student',
    status: 'active',
    studentId: '',
    department: 'Computer Science',
  });

  // Edit User Form State
  const [editFormData, setEditFormData] = useState<Partial<UserMutationInput>>({});

  // Query users
  const users = useMemo(() => {
    return getAllUsers({
      search,
      role: roleFilter,
      status: statusFilter,
    });
  }, [search, roleFilter, statusFilter, refreshKey]);

  // Handlers
  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserData.name || !newUserData.email) return;

    createUser(newUserData);
    setIsAddModalOpen(false);
    setNewUserData({
      name: '',
      email: '',
      role: 'student',
      status: 'active',
      studentId: '',
      department: 'Computer Science',
    });
    setRefreshKey((k) => k + 1);
  };

  const handleUpdateUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    updateUser(editingUser.id, editFormData);
    setEditingUser(null);
    setRefreshKey((k) => k + 1);
  };

  const handleConfirmToggleStatus = () => {
    if (!statusTogglingUser) return;
    toggleUserStatus(statusTogglingUser.id);
    setStatusTogglingUser(null);
    setRefreshKey((k) => k + 1);
  };

  const handleConfirmRoleChange = () => {
    if (!roleChangingUser) return;
    changeUserRole(roleChangingUser.id, newSelectedRole);
    setRoleChangingUser(null);
    setRefreshKey((k) => k + 1);
  };

  const renderRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'admin':
        return (
          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center gap-1 w-fit">
            <Shield size={11} /> Admin
          </span>
        );
      case 'instructor':
        return (
          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 flex items-center gap-1 w-fit">
            <Briefcase size={11} /> Instructor
          </span>
        );
      case 'student':
      default:
        return (
          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-sky-500/15 text-sky-300 border border-sky-500/30 flex items-center gap-1 w-fit">
            <GraduationCap size={11} /> Student
          </span>
        );
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-text-primary">User Management Directory</h2>
            <Badge variant="active" size="sm">
              {users.length} Users Listed
            </Badge>
          </div>
          <p className="text-xs text-text-muted mt-0.5">
            Administer platform accounts, role-based access permissions, and status controls
          </p>
        </div>

        <Button
          variant="primary"
          size="sm"
          onClick={() => setIsAddModalOpen(true)}
          className="text-xs bg-amber-600 hover:bg-amber-500 text-white border-amber-500"
        >
          <UserPlus size={14} className="mr-1.5" />
          Create New User
        </Button>
      </div>

      {/* Filter and Search Bar */}
      <Card padding="sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 px-2 py-1">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search size={14} className="absolute left-3 top-2.5 text-text-muted" />
            <input
              type="text"
              placeholder="Search by name, email, department, or student ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-surface-700 border border-border rounded-lg text-xs text-text-primary placeholder-text-muted focus:outline-none focus:border-amber-500 transition-colors"
            />
          </div>

          {/* Role & Status Filter Selectors */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-text-muted">Role:</span>
              <select
                aria-label="Filter by Role"
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value as any)}
                className="bg-surface-700 border border-border text-text-primary text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-amber-500"
              >
                <option value="all">All Roles</option>
                <option value="student">Students</option>
                <option value="instructor">Instructors</option>
                <option value="admin">Administrators</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-text-muted">Status:</span>
              <select
                aria-label="Filter by Status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="bg-surface-700 border border-border text-text-primary text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-amber-500"
              >
                <option value="all">All Statuses</option>
                <option value="active">Active Only</option>
                <option value="disabled">Disabled Only</option>
              </select>
            </div>

            {(search || roleFilter !== 'all' || statusFilter !== 'all') && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearch('');
                  setRoleFilter('all');
                  setStatusFilter('all');
                }}
                className="text-[11px] h-7 px-2 text-amber-400 hover:text-amber-300"
              >
                Reset
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Users Table */}
      <Card>
        <CardHeader
          title="Registered Platform Users"
          subtitle="Governed under Role-Based Access Control policies"
        />
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-border text-text-muted bg-surface-700/30">
                <th className="py-2.5 px-4 font-semibold">User Details</th>
                <th className="py-2.5 px-3 font-semibold">Role</th>
                <th className="py-2.5 px-3 font-semibold">Status</th>
                <th className="py-2.5 px-3 font-semibold">Dataset ID</th>
                <th className="py-2.5 px-3 font-semibold">Department</th>
                <th className="py-2.5 px-3 font-semibold">Registered</th>
                <th className="py-2.5 px-3 font-semibold">Last Login</th>
                <th className="py-2.5 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {users.map((user) => {
                const isActive = user.status === 'active';
                return (
                  <tr
                    key={user.id}
                    className="hover:bg-surface-700/40 transition-colors text-text-secondary"
                  >
                    <td className="py-3 px-4">
                      <div>
                        <span className="font-bold text-text-primary block text-xs">
                          {user.name}
                        </span>
                        <span className="text-[11px] text-text-muted font-mono block">
                          {user.email}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-3">{renderRoleBadge(user.role)}</td>
                    <td className="py-3 px-3">
                      {isActive ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 inline-flex items-center gap-1">
                          <CheckCircle2 size={10} /> Active
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/15 text-rose-400 border border-rose-500/25 inline-flex items-center gap-1">
                          <XCircle size={10} /> Disabled
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 font-mono text-xs">
                      {user.studentId ? (
                        <span className="text-indigo-300 font-bold">{user.studentId}</span>
                      ) : (
                        <span className="text-text-muted">—</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-text-muted">{user.department || '—'}</td>
                    <td className="py-3 px-3 font-mono text-[11px] text-text-muted">
                      {user.createdAt.split(' ')[0]}
                    </td>
                    <td className="py-3 px-3 font-mono text-[11px] text-text-muted">
                      {user.lastLogin}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Edit Button */}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setEditingUser(user);
                            setEditFormData({
                              name: user.name,
                              email: user.email,
                              department: user.department,
                              studentId: user.studentId,
                            });
                          }}
                          className="h-7 px-2 text-text-secondary hover:text-text-primary"
                          title="Edit User Info"
                        >
                          <Edit2 size={12} />
                        </Button>

                        {/* Change Role Button */}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setRoleChangingUser(user);
                            setNewSelectedRole(user.role);
                          }}
                          className="h-7 px-2 text-indigo-400 hover:text-indigo-300"
                          title="Change Role"
                        >
                          <Shield size={12} />
                        </Button>

                        {/* Enable/Disable Toggle Button */}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setStatusTogglingUser(user)}
                          className={`h-7 px-2 ${
                            isActive
                              ? 'text-rose-400 hover:text-rose-300 hover:bg-rose-500/10'
                              : 'text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10'
                          }`}
                          title={isActive ? 'Disable User' : 'Enable User'}
                        >
                          {isActive ? <UserX size={12} /> : <UserCheck size={12} />}
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ─── Add User Modal ─────────────────────────────────────────── */}
      <Modal
        open={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Create New Platform User"
        size="md"
      >
        <form onSubmit={handleCreateUser} className="space-y-4 text-xs">
          <div>
            <label className="block text-text-secondary font-medium mb-1">Full Name</label>
            <input
              type="text"
              required
              value={newUserData.name}
              onChange={(e) => setNewUserData({ ...newUserData, name: e.target.value })}
              placeholder="e.g. Maya Lin"
              className="w-full px-3 py-2 rounded-lg bg-surface-700 border border-border text-text-primary text-xs focus:outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label className="block text-text-secondary font-medium mb-1">Email Address</label>
            <input
              type="email"
              required
              value={newUserData.email}
              onChange={(e) => setNewUserData({ ...newUserData, email: e.target.value })}
              placeholder="e.g. maya.lin@university.edu"
              className="w-full px-3 py-2 rounded-lg bg-surface-700 border border-border text-text-primary text-xs focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-text-secondary font-medium mb-1">Application Role</label>
              <select
                value={newUserData.role}
                onChange={(e) =>
                  setNewUserData({ ...newUserData, role: e.target.value as UserRole })
                }
                className="w-full px-3 py-2 rounded-lg bg-surface-700 border border-border text-text-primary text-xs focus:outline-none focus:border-amber-500"
              >
                <option value="student">Student</option>
                <option value="instructor">Instructor</option>
                <option value="admin">Administrator</option>
              </select>
            </div>

            <div>
              <label className="block text-text-secondary font-medium mb-1">Initial Status</label>
              <select
                value={newUserData.status}
                onChange={(e) =>
                  setNewUserData({ ...newUserData, status: e.target.value as UserStatus })
                }
                className="w-full px-3 py-2 rounded-lg bg-surface-700 border border-border text-text-primary text-xs focus:outline-none focus:border-amber-500"
              >
                <option value="active">Active</option>
                <option value="disabled">Disabled</option>
              </select>
            </div>
          </div>

          {newUserData.role === 'student' && (
            <div>
              <label className="block text-text-secondary font-medium mb-1">
                Mapped Dataset Student ID (Optional)
              </label>
              <input
                type="text"
                value={newUserData.studentId}
                onChange={(e) => setNewUserData({ ...newUserData, studentId: e.target.value })}
                placeholder="e.g. S011"
                className="w-full px-3 py-2 rounded-lg bg-surface-700 border border-border text-text-primary text-xs font-mono focus:outline-none focus:border-amber-500"
              />
            </div>
          )}

          <div>
            <label className="block text-text-secondary font-medium mb-1">Department</label>
            <input
              type="text"
              value={newUserData.department}
              onChange={(e) => setNewUserData({ ...newUserData, department: e.target.value })}
              placeholder="e.g. Computer Science"
              className="w-full px-3 py-2 rounded-lg bg-surface-700 border border-border text-text-primary text-xs focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsAddModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" className="bg-amber-600 text-white">
              Create User
            </Button>
          </div>
        </form>
      </Modal>

      {/* ─── Edit User Modal ────────────────────────────────────────── */}
      {editingUser && (
        <Modal
          open={!!editingUser}
          onClose={() => setEditingUser(null)}
          title={`Edit User: ${editingUser.name}`}
          size="md"
        >
          <form onSubmit={handleUpdateUser} className="space-y-4 text-xs">
            <div>
              <label className="block text-text-secondary font-medium mb-1">Full Name</label>
              <input
                type="text"
                required
                value={editFormData.name ?? editingUser.name}
                onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-surface-700 border border-border text-text-primary text-xs focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-text-secondary font-medium mb-1">Email Address</label>
              <input
                type="email"
                required
                value={editFormData.email ?? editingUser.email}
                onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-surface-700 border border-border text-text-primary text-xs focus:outline-none focus:border-amber-500"
              />
            </div>

            {editingUser.role === 'student' && (
              <div>
                <label className="block text-text-secondary font-medium mb-1">
                  Mapped Dataset Student ID
                </label>
                <input
                  type="text"
                  value={editFormData.studentId ?? editingUser.studentId ?? ''}
                  onChange={(e) => setEditFormData({ ...editFormData, studentId: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-surface-700 border border-border text-text-primary text-xs font-mono focus:outline-none focus:border-amber-500"
                />
              </div>
            )}

            <div>
              <label className="block text-text-secondary font-medium mb-1">Department</label>
              <input
                type="text"
                value={editFormData.department ?? editingUser.department ?? ''}
                onChange={(e) => setEditFormData({ ...editFormData, department: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-surface-700 border border-border text-text-primary text-xs focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setEditingUser(null)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm" className="bg-amber-600 text-white">
                Save Changes
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* ─── Change Role Modal ──────────────────────────────────────── */}
      {roleChangingUser && (
        <Modal
          open={!!roleChangingUser}
          onClose={() => setRoleChangingUser(null)}
          title={`Change Role: ${roleChangingUser.name}`}
          size="sm"
        >
          <div className="space-y-4 text-xs">
            <p className="text-text-secondary leading-relaxed">
              Select a new application role for <strong className="text-text-primary">{roleChangingUser.name}</strong> ({roleChangingUser.email}):
            </p>

            <div className="space-y-2">
              {(['student', 'instructor', 'admin'] as UserRole[]).map((r) => (
                <label
                  key={r}
                  className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                    newSelectedRole === r
                      ? 'bg-amber-500/10 border-amber-500/40 text-amber-300'
                      : 'bg-surface-700/40 border-border text-text-secondary hover:bg-surface-700'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="role"
                      value={r}
                      checked={newSelectedRole === r}
                      onChange={() => setNewSelectedRole(r)}
                      className="text-amber-500 focus:ring-amber-500"
                    />
                    <span className="capitalize font-bold text-text-primary">{r}</span>
                  </div>
                  {renderRoleBadge(r)}
                </label>
              ))}
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setRoleChangingUser(null)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={handleConfirmRoleChange}
                className="bg-amber-600 text-white"
              >
                Update Role
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ─── Enable / Disable Confirmation Modal ────────────────────── */}
      {statusTogglingUser && (
        <Modal
          open={!!statusTogglingUser}
          onClose={() => setStatusTogglingUser(null)}
          title={
            statusTogglingUser.status === 'active'
              ? 'Disable User Account?'
              : 'Enable User Account?'
          }
          size="sm"
        >
          <div className="space-y-4 text-xs">
            <div className="p-3 rounded-xl bg-surface-700/50 border border-border flex items-start gap-3">
              <AlertTriangle size={18} className="text-amber-400 mt-0.5 shrink-0" />
              <p className="text-text-secondary leading-relaxed">
                Are you sure you want to {statusTogglingUser.status === 'active' ? 'disable' : 'enable'}{' '}
                <strong className="text-text-primary">{statusTogglingUser.name}</strong> ({statusTogglingUser.email})?
                {statusTogglingUser.status === 'active' &&
                  ' The user will be blocked from logging into the platform until re-enabled.'}
              </p>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setStatusTogglingUser(null)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant={statusTogglingUser.status === 'active' ? 'danger' : 'primary'}
                size="sm"
                onClick={handleConfirmToggleStatus}
              >
                {statusTogglingUser.status === 'active' ? 'Disable Account' : 'Enable Account'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
