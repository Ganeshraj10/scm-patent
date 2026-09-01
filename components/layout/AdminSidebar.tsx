'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  ShieldCheck,
  X,
  ChevronRight,
  Database,
  SlidersHorizontal,
  Activity,
  GraduationCap,
  Briefcase,
} from 'lucide-react';

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  badge?: string | number;
}

const navItems: NavItem[] = [
  {
    label: 'Admin Dashboard',
    href: '/admin/dashboard',
    icon: <LayoutDashboard size={18} />,
  },
  {
    label: 'User Management',
    href: '/admin/users',
    icon: <Users size={18} />,
  },
  {
    label: 'System & Dataset Status',
    href: '/admin/status',
    icon: <Database size={18} />,
  },
  {
    label: 'Integrity Analysis',
    href: '/instructor/analysis',
    icon: <Activity size={18} />,
  },
  {
    label: 'Platform Settings',
    href: '/admin/settings',
    icon: <SlidersHorizontal size={18} />,
  },
];

interface AdminSidebarProps {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function AdminSidebar({
  mobileOpen = false,
  onMobileClose,
}: AdminSidebarProps) {
  const pathname = usePathname();

  const sidebarContent = (
    <div className="flex flex-col h-full bg-navy-950 border-r border-border select-none">
      {/* Brand header */}
      <div className="h-16 flex items-center justify-between px-5 border-b border-border">
        <Link
          href="/admin/dashboard"
          className="flex items-center gap-2.5 group"
        >
          <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 group-hover:bg-amber-500/30 transition-colors shadow-md shadow-amber-500/10">
            <ShieldCheck size={18} />
          </div>
          <div>
            <span className="font-bold text-sm text-text-primary tracking-tight block leading-none">
              ExamGuard
            </span>
            <span className="text-[10px] text-amber-400 font-semibold tracking-wider uppercase leading-tight block mt-0.5">
              Admin Portal
            </span>
          </div>
        </Link>
        {onMobileClose && (
          <button
            onClick={onMobileClose}
            className="p-1 rounded-md text-text-muted hover:text-text-primary hover:bg-surface-700 transition-colors lg:hidden"
            aria-label="Close navigation"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Role Indicator Banner */}
      <div className="px-4 py-2.5 mx-3 mt-3 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          <span className="text-[11px] font-bold text-amber-300">Administrator</span>
        </div>
        <span className="text-[10px] text-text-muted">Full Control</span>
      </div>

      {/* Navigation */}
      <nav aria-label="Admin Navigation" className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <div className="text-[10px] font-semibold text-text-muted uppercase tracking-wider px-3 mb-2">
          Platform Oversight
        </div>
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== '/admin/dashboard' && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onMobileClose}
              className={[
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors group',
                isActive
                  ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                  : 'text-text-secondary hover:text-text-primary hover:bg-surface-700/60',
              ].join(' ')}
            >
              <span
                className={
                  isActive
                    ? 'text-amber-400'
                    : 'text-text-muted group-hover:text-text-secondary'
                }
              >
                {item.icon}
              </span>
              <span className="flex-1">{item.label}</span>
              {item.badge && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300">
                  {item.badge}
                </span>
              )}
              {isActive && (
                <ChevronRight
                  size={14}
                  className="text-amber-400 flex-shrink-0"
                />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer info */}
      <div className="p-4 border-t border-border">
        <div className="p-3 rounded-lg bg-surface-900 border border-border/60 text-[11px] text-text-muted space-y-1">
          <div className="flex items-center justify-between text-text-secondary font-semibold">
            <span>Prototype Dataset</span>
            <span className="text-emerald-400">120 records</span>
          </div>
          <p className="text-[10px] text-text-muted leading-tight">
            Role-Based Access Control Active
          </p>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside aria-label="Desktop Navigation" className="hidden lg:flex lg:w-60 lg:flex-col lg:flex-shrink-0 h-full">
        {sidebarContent}
      </aside>

      {/* Mobile drawer backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={onMobileClose}
        />
      )}

      {/* Mobile drawer */}
      <aside
        aria-label="Mobile Navigation"
        className={[
          'fixed inset-y-0 left-0 z-50 w-72 transform transition-transform duration-300 ease-in-out lg:hidden',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        ].join(' ')}
      >
        {sidebarContent}
      </aside>
    </>
  );
}
