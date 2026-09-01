'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { login, switchRole } from '@/lib/actions/auth';
import { Button } from '@/components/ui/Button';
import { UserRole } from '@/types';
import {
  ShieldCheck,
  AlertCircle,
  GraduationCap,
  Briefcase,
  Shield,
  ArrowRight,
  Sparkles,
  Lock,
  Mail,
  KeyRound,
  CheckCircle2,
} from 'lucide-react';

interface RoleConfig {
  role: UserRole;
  title: string;
  name: string;
  email: string;
  badge: string;
  description: string;
  color: string;
  borderActive: string;
  bgActive: string;
  icon: React.ReactNode;
}

const ROLES: RoleConfig[] = [
  {
    role: 'student',
    title: 'Student / Test-Taker',
    name: 'Alex Chen',
    email: 'student_demo@examguard.io',
    badge: 'Dataset ID: S001',
    description: 'Access personal coursework, baseline telemetry, and exam sessions.',
    color: 'text-sky-400',
    borderActive: 'border-sky-500/60 ring-1 ring-sky-500/40 bg-sky-500/10',
    bgActive: 'bg-sky-500/20 text-sky-300',
    icon: <GraduationCap size={20} className="text-sky-400" />,
  },
  {
    role: 'instructor',
    title: 'Instructor / Reviewer',
    name: 'Prof. Robert Davis',
    email: 'instructor_demo@examguard.io',
    badge: 'Human Reviewer',
    description: 'Inspect student behavioral models, review queue & record decisions.',
    color: 'text-indigo-400',
    borderActive: 'border-indigo-500/60 ring-1 ring-indigo-500/40 bg-indigo-500/10',
    bgActive: 'bg-indigo-500/20 text-indigo-300',
    icon: <Briefcase size={20} className="text-indigo-400" />,
  },
  {
    role: 'admin',
    title: 'Platform Administrator',
    name: 'Sarah Connor',
    email: 'admin_demo@examguard.io',
    badge: 'Full Oversight',
    description: 'Manage platform user accounts, assign roles, and inspect system status.',
    color: 'text-amber-400',
    borderActive: 'border-amber-500/60 ring-1 ring-amber-500/40 bg-amber-500/10',
    bgActive: 'bg-amber-500/20 text-amber-300',
    icon: <Shield size={20} className="text-amber-400" />,
  },
];

export default function LoginPage() {
  const [selectedRole, setSelectedRole] = useState<UserRole>('student');
  const [email, setEmail] = useState<string>('student_demo@examguard.io');
  const [password, setPassword] = useState<string>('demo123456');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const activeConfig = ROLES.find((r) => r.role === selectedRole)!;

  const handleSelectRole = (role: UserRole) => {
    setSelectedRole(role);
    const target = ROLES.find((r) => r.role === role)!;
    setEmail(target.email);
    setPassword('demo123456');
    setError(null);
  };

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError(null);
    formData.set('role', selectedRole);
    const result = await login(formData);

    if (result?.error) {
      setError(result.error);
      setLoading(false);
    }
  }

  async function handleInstantRoleLogin(role: UserRole) {
    setLoading(true);
    setError(null);
    await switchRole(role);
  }

  return (
    <div className="min-h-screen bg-navy-950 flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-xl">
        {/* Brand Header */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-600/20 border border-indigo-500/40 shadow-xl shadow-indigo-600/20">
            <ShieldCheck size={28} className="text-indigo-400" />
          </div>
          <h1 className="mt-4 text-2xl sm:text-3xl font-extrabold text-text-primary tracking-tight">
            ExamGuard Sign In
          </h1>
          <p className="mt-1.5 text-xs text-text-secondary">
            Examination Integrity Platform with Longitudinal Behavioral Verification
          </p>
        </div>

        {/* Main Card */}
        <div className="mt-6 bg-surface-800/90 backdrop-blur-sm p-6 sm:p-8 shadow-2xl border border-border sm:rounded-2xl space-y-6">
          {/* ─── Step 1: Select Application Role ─── */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-xs font-bold text-text-primary uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles size={14} className="text-indigo-400" />
                Select Your Role (3 Roles Available)
              </label>
              <span className="text-[10px] text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                1-Click Sign In Ready
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {ROLES.map((cfg) => {
                const isSelected = selectedRole === cfg.role;
                return (
                  <button
                    key={cfg.role}
                    type="button"
                    onClick={() => handleSelectRole(cfg.role)}
                    className={`text-left p-3.5 rounded-xl border transition-all relative flex flex-col justify-between ${
                      isSelected
                        ? cfg.borderActive
                        : 'bg-surface-700/30 border-border hover:bg-surface-700/60 hover:border-border/80'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="p-1.5 rounded-lg bg-surface-900/60 border border-border/50">
                        {cfg.icon}
                      </div>
                      {isSelected && (
                        <CheckCircle2 size={16} className={cfg.color} />
                      )}
                    </div>
                    <div>
                      <span className={`text-xs font-bold block ${isSelected ? cfg.color : 'text-text-primary'}`}>
                        {cfg.title.split('/')[0]}
                      </span>
                      <span className="text-[10px] text-text-muted block mt-0.5">
                        {cfg.name}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ─── Selected Role Banner & Instant Action ─── */}
          <div className="p-3.5 rounded-xl bg-surface-700/40 border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="text-xs">
              <div className="flex items-center gap-2">
                <strong className={`font-bold ${activeConfig.color}`}>
                  {activeConfig.title}
                </strong>
                <span className="px-2 py-0.2 text-[10px] font-mono rounded bg-surface-900 text-text-muted border border-border">
                  {activeConfig.badge}
                </span>
              </div>
              <p className="text-[11px] text-text-muted mt-0.5 leading-relaxed">
                {activeConfig.description}
              </p>
            </div>

            <Button
              type="button"
              variant="primary"
              size="sm"
              disabled={loading}
              onClick={() => handleInstantRoleLogin(selectedRole)}
              className="text-xs whitespace-nowrap justify-center shadow-lg"
            >
              {loading ? 'Authenticating...' : `Instant Sign In (${activeConfig.title.split('/')[0].trim()})`}
              <ArrowRight size={13} className="ml-1.5" />
            </Button>
          </div>

          {/* ─── Step 2: Credentials Form ─── */}
          <form action={handleSubmit} className="space-y-4 pt-2 border-t border-border/70">
            {error && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-start gap-2.5">
                <AlertCircle size={16} className="text-rose-400 shrink-0 mt-0.5" />
                <p className="text-xs text-rose-400">{error}</p>
              </div>
            )}

            <div>
              <label
                htmlFor="email"
                className="block text-xs font-medium text-text-secondary mb-1"
              >
                Email Address
              </label>
              <div className="relative">
                <Mail size={15} className="absolute left-3 top-2.5 text-text-muted" />
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full appearance-none rounded-lg border border-border bg-surface-900 pl-9 pr-3 py-2 text-text-primary text-xs focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors"
                  placeholder="name@university.edu"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-xs font-medium text-text-secondary mb-1"
              >
                Password
              </label>
              <div className="relative">
                <KeyRound size={15} className="absolute left-3 top-2.5 text-text-muted" />
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full appearance-none rounded-lg border border-border bg-surface-900 pl-9 pr-3 py-2 text-text-primary text-xs focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors"
                />
              </div>
            </div>

            <Button
              type="submit"
              variant="secondary"
              className="w-full justify-center text-xs mt-2"
              disabled={loading}
            >
              {loading ? 'Verifying credentials...' : 'Sign In with Credentials'}
            </Button>
          </form>

          {/* ─── Footer Register Link ─── */}
          <div className="text-center pt-2 text-xs text-text-muted">
            Need a new account?{' '}
            <Link
              href="/register"
              className="font-medium text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              Register here
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
