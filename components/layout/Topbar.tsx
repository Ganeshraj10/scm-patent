'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bell, Menu, ChevronRight } from 'lucide-react';

interface TopbarProps {
  title: string;
  breadcrumbs?: { label: string; href?: string }[];
  onMenuClick?: () => void;
  actions?: React.ReactNode;
}

export function Topbar({ title, breadcrumbs, onMenuClick, actions }: TopbarProps) {
  const pathname = usePathname();

  // Auto-generate breadcrumbs from pathname if not provided
  const crumbs = breadcrumbs ?? generateBreadcrumbs(pathname);

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
        <div className="flex items-center gap-2 flex-shrink-0">
          {actions}

          {/* Notifications */}
          <button
            className="relative p-2 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-700 transition-colors"
            aria-label="View notifications"
            id="notifications-btn"
          >
            <Bell size={18} />
            {/* Unread dot */}
            <span
              className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-amber-400 border-2 border-surface-900"
              aria-hidden="true"
            />
          </button>

          {/* Avatar */}
          <button
            className="w-8 h-8 rounded-full bg-indigo-600/30 border border-indigo-500/30 flex items-center justify-center hover:bg-indigo-600/40 transition-colors"
            aria-label="Account menu"
            id="account-menu-btn"
          >
            <span className="text-xs font-bold text-indigo-400">A</span>
          </button>
        </div>
      </div>
    </header>
  );
}

// ─── Auto-breadcrumb generator ───────────────────────────────

const labelMap: Record<string, string> = {
  instructor: 'Instructor',
  dashboard: 'Dashboard',
  students: 'Students',
  sessions: 'Examinations',
  alerts: 'Review Queue',
  settings: 'Settings',
  calibration: 'Calibration',
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
