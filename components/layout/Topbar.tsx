import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bell, Menu, ChevronRight, LogOut, User } from 'lucide-react';
import { getCurrentProfileClient, signOutUserClient } from '@/lib/services/auth';

interface TopbarProps {
  title: string;
  breadcrumbs?: { label: string; href?: string }[];
  onMenuClick?: () => void;
  actions?: React.ReactNode;
}

export function Topbar({ title, breadcrumbs, onMenuClick, actions }: TopbarProps) {
  const pathname = usePathname();
  const [profile, setProfile] = useState<{
    id?: string;
    student_identifier?: string;
    full_name?: string;
    email?: string;
    role?: string;
  } | null>(null);

  useEffect(() => {
    getCurrentProfileClient().then((p) => {
      if (p) setProfile(p);
    });
  }, [pathname]);

  const handleLogout = async () => {
    await signOutUserClient();
  };

  // Auto-generate breadcrumbs from pathname if not provided
  const crumbs = breadcrumbs ?? generateBreadcrumbs(pathname);

  const displayRole = profile?.role || (pathname.startsWith('/admin') ? 'admin' : pathname.startsWith('/instructor') ? 'instructor' : 'student');
  const displayName = profile?.full_name || (displayRole === 'admin' ? 'Admin Demo' : displayRole === 'instructor' ? 'Prof. Davis' : 'Alex Chen');
  const displayIdentifier = profile?.student_identifier || 'S001';

  return (
    <header className="h-16 flex-shrink-0 border-b border-border bg-surface-900/80 backdrop-blur-sm sticky top-0 z-30">
      <div className="h-full flex items-center gap-4 px-5">
        {/* Mobile menu button */}
        <button
          onClick={onMenuClick}
          className="p-2 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-700 transition-colors lg:hidden"
          aria-label="Open navigation menu"
          id="mobile-menu-btn"
        >
          <Menu size={20} />
        </button>

        {/* Breadcrumbs + Title */}
        <div className="flex-1 min-w-0">
          {crumbs.length > 1 && (
            <nav aria-label="Breadcrumb" className="flex items-center gap-1 mb-0.5">
              {crumbs.map((crumb, i) => (
                <span key={i} className="flex items-center gap-1">
                  {i > 0 && (
                    <ChevronRight size={10} className="text-text-muted flex-shrink-0" />
                  )}
                  {crumb.href ? (
                    <Link
                      href={crumb.href}
                      className="text-[10px] text-text-muted hover:text-text-secondary transition-colors"
                    >
                      {crumb.label}
                    </Link>
                  ) : (
                    <span className="text-[10px] text-text-muted">{crumb.label}</span>
                  )}
                </span>
              ))}
            </nav>
          )}
          <h1 className="text-base font-semibold text-text-primary truncate">{title}</h1>
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-3 flex-shrink-0">
          {actions}

          {/* Role Badge */}
          {displayRole === 'admin' && (
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              Administrator
            </span>
          )}
          {displayRole === 'instructor' && (
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
              Instructor
            </span>
          )}
          {displayRole === 'student' && (
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-sky-500/15 text-sky-300 border border-sky-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
              Student ({displayIdentifier})
            </span>
          )}

          {/* Notifications */}
          <button
            className="relative p-2 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-700 transition-colors"
            aria-label="View notifications"
            id="notifications-btn"
          >
            <Bell size={18} />
            <span
              className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-amber-400 border-2 border-surface-900"
              aria-hidden="true"
            />
          </button>

          {/* User Account / Profile Info */}
          <div className="flex items-center gap-2 pl-1">
            <div className="flex items-center gap-2 p-1.5 pr-2.5 rounded-full bg-surface-800 border border-border text-xs text-text-secondary">
              <div className="w-7 h-7 rounded-full bg-indigo-600/30 border border-indigo-500/30 flex items-center justify-center font-bold text-xs text-indigo-400">
                {displayName.charAt(0).toUpperCase()}
              </div>
              <span className="hidden md:inline font-medium text-[11px] text-text-primary">
                {displayName}
              </span>
            </div>

            {/* Direct Logout Action Button */}
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 p-2 rounded-lg text-text-muted hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/30 transition-all text-xs font-semibold"
              title="Sign Out of Session"
              aria-label="Log Out"
              id="topbar-logout-btn"
            >
              <LogOut size={16} />
              <span className="hidden sm:inline text-[11px]">Sign Out</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}

// ─── Auto-breadcrumb generator ───────────────────────────────

const labelMap: Record<string, string> = {
  admin: 'Admin Portal',
  instructor: 'Instructor Portal',
  student: 'Student Portal',
  dashboard: 'Dashboard',
  users: 'User Management',
  status: 'System Status',
  students: 'Students',
  sessions: 'Examinations',
  alerts: 'Review Queue',
  settings: 'Settings',
  analysis: 'Integrity Analysis',
  practice: 'Practice Coursework',
  examination: 'Examination',
  behavior: 'Behavior Profile',
  results: 'Results',
};

function generateBreadcrumbs(
  pathname: string
): { label: string; href?: string }[] {
  const segments = pathname.split('/').filter(Boolean);
  const crumbs: { label: string; href?: string }[] = [
    { label: 'ExamGuard', href: '/' },
  ];

  let accumulated = '';
  for (const seg of segments) {
    accumulated += `/${seg}`;
    const label = labelMap[seg] ?? seg;
    crumbs.push({ label, href: accumulated });
  }

  return crumbs;
}
