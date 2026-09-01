'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  ClipboardList,
  AlertTriangle,
  Brain,
  SlidersHorizontal,
  Settings,
  ShieldCheck,
  X,
  ChevronRight,
  Activity,
} from 'lucide-react';

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  badge?: number;
}

const navItems: NavItem[] = [
  {
    label: 'Dashboard',
    href: '/instructor/dashboard',
    icon: <LayoutDashboard size={18} />,
  },
  {
    label: 'Integrity Analysis',
    href: '/instructor/analysis',
    icon: <Activity size={18} />,
  },
  {
    label: 'Students',
    href: '/instructor/students',
    icon: <Users size={18} />,
  },
  {
    label: 'Examinations',
    href: '/instructor/sessions',
    icon: <ClipboardList size={18} />,
  },
  {
    label: 'Review Queue',
    href: '/instructor/alerts',
    icon: <AlertTriangle size={18} />,
    badge: 2,
  },
  {
    label: 'Behavioral Models',
    href: '/instructor/students',
    icon: <Brain size={18} />,
  },
  {
    label: 'Calibration',
    href: '/instructor/settings',
    icon: <SlidersHorizontal size={18} />,
  },
  {
    label: 'Settings',
    href: '/instructor/settings',
    icon: <Settings size={18} />,
  },
];

interface SidebarProps {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      href={item.href}
      className={[
        'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium',
        'transition-all duration-150 group relative',
        active
          ? 'bg-indigo-600/15 text-indigo-400 border border-indigo-500/20'
          : 'text-text-secondary hover:text-text-primary hover:bg-surface-700 border border-transparent',
      ].join(' ')}
      aria-current={active ? 'page' : undefined}
    >
      <span
        className={[
          'transition-colors duration-150',
          active ? 'text-indigo-400' : 'text-text-muted group-hover:text-text-secondary',
        ].join(' ')}
      >
        {item.icon}
      </span>
      <span className="flex-1">{item.label}</span>
      {item.badge !== undefined && item.badge > 0 && (
        <span className="inline-flex items-center justify-center w-5 h-5 text-[10px] font-bold rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
          {item.badge}
        </span>
      )}
      {active && (
        <ChevronRight size={14} className="text-indigo-400 opacity-60" />
      )}
    </Link>
  );
}

export function Sidebar({ mobileOpen = false, onMobileClose }: SidebarProps) {
  const pathname = usePathname();

  const sidebarContent = (
    <div className="flex flex-col h-full bg-surface-900 border-r border-border">
      {/* Logo */}
      <div className="flex items-center justify-between px-5 py-5 border-b border-border flex-shrink-0">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-600/30 group-hover:bg-indigo-500 transition-colors">
            <ShieldCheck size={18} className="text-white" />
          </div>
          <div>
            <span className="text-sm font-bold text-text-primary tracking-tight">
              ExamGuard
            </span>
            <p className="text-[10px] text-text-muted leading-none mt-0.5">Instructor Portal</p>
          </div>
        </Link>
        {/* Mobile close */}
        {onMobileClose && (
          <button
            onClick={onMobileClose}
            className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-700 transition-colors lg:hidden"
            aria-label="Close sidebar"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto" aria-label="Instructor navigation">
        <div className="mb-3 px-3">
          <p className="text-[10px] font-semibold text-text-muted uppercase tracking-widest">
            Navigation
          </p>
        </div>
        {navItems.map((item) => {
          const active =
            item.href === pathname ||
            (item.href !== '/instructor/dashboard' && pathname.startsWith(item.href));
          return <NavLink key={item.href + item.label} item={item} active={active} />;
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-border flex-shrink-0">
        <div className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg bg-surface-700 border border-border">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-7 h-7 rounded-full bg-indigo-600/30 border border-indigo-500/30 flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-bold text-indigo-400">A</span>
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-text-primary truncate">Instructor</p>
              <p className="text-[10px] text-text-muted truncate">admin@university.edu</p>
            </div>
          </div>
          <form action="/auth/logout" method="POST">
            <button
              type="submit"
              className="p-1.5 rounded-lg text-text-muted hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
              title="Log out"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
            </button>
          </form>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-64 flex-shrink-0 h-screen sticky top-0">
        {sidebarContent}
      </aside>

      {/* Mobile drawer backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={onMobileClose}
          aria-hidden="true"
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={[
          'fixed inset-y-0 left-0 z-50 w-64 lg:hidden',
          'transform transition-transform duration-300 ease-in-out',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        ].join(' ')}
        aria-hidden={!mobileOpen}
      >
        {sidebarContent}
      </aside>
    </>
  );
}
