'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  BookOpen,
  Brain,
  ClipboardList,
  BarChart3,
  ShieldCheck,
  X,
  ChevronRight,
  GraduationCap,
} from 'lucide-react';

interface StudentNavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  sublabel?: string;
}

const navItems: StudentNavItem[] = [
  {
    label: 'Dashboard',
    href: '/student/dashboard',
    icon: <LayoutDashboard size={17} />,
    sublabel: 'Overview & coursework summary',
  },
  {
    label: 'My Coursework',
    href: '/student/coursework',
    icon: <BookOpen size={17} />,
    sublabel: 'Practice & completed coursework',
  },
  {
    label: 'Session History',
    href: '/student/history',
    icon: <BarChart3 size={17} />,
    sublabel: 'Longitudinal interaction history',
  },
  {
    label: 'Behavior Profile',
    href: '/student/behavior',
    icon: <Brain size={17} />,
    sublabel: 'Longitudinal behavioral trends',
  },
  {
    label: 'Take Examination',
    href: '/student/examination',
    icon: <ClipboardList size={17} />,
    sublabel: 'Graded examination session',
  },
];

interface StudentSidebarProps {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

function NavLink({ item, active }: { item: StudentNavItem; active: boolean }) {
  return (
    <Link
      href={item.href}
      className={[
        'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium',
        'transition-all duration-150 group border',
        active
          ? 'bg-indigo-600/15 text-indigo-400 border-indigo-500/20'
          : 'text-text-secondary hover:text-text-primary hover:bg-surface-700 border-transparent',
      ].join(' ')}
      aria-current={active ? 'page' : undefined}
    >
      <span className={active ? 'text-indigo-400' : 'text-text-muted group-hover:text-text-secondary'}>
        {item.icon}
      </span>
      <div className="flex-1 min-w-0">
        <p className="leading-none text-xs font-semibold">{item.label}</p>
        {item.sublabel && (
          <p className="text-[10px] text-text-muted mt-0.5 leading-none">{item.sublabel}</p>
        )}
      </div>
      {active && <ChevronRight size={13} className="text-indigo-400 opacity-60 flex-shrink-0" />}
    </Link>
  );
}

export function StudentSidebar({ mobileOpen = false, onMobileClose }: StudentSidebarProps) {
  const pathname = usePathname();

  const sidebarContent = (
    <div className="flex flex-col h-full bg-navy-950 border-r border-border select-none">
      {/* Brand header */}
      <div className="h-16 flex items-center justify-between px-5 border-b border-border">
        <Link href="/student/dashboard" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-lg bg-sky-500/20 border border-sky-500/40 flex items-center justify-center text-sky-400 group-hover:bg-sky-500/30 transition-colors shadow-md shadow-sky-500/10">
            <GraduationCap size={18} />
          </div>
          <div>
            <span className="font-bold text-sm text-text-primary tracking-tight block leading-none">
              ExamGuard
            </span>
            <span className="text-[10px] text-sky-400 font-semibold tracking-wider uppercase leading-tight block mt-0.5">
              Student Portal
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

      {/* Student Badge Banner */}
      <div className="px-4 py-2.5 mx-3 mt-3 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
          <span className="text-[11px] font-bold text-sky-300">Alex Chen</span>
        </div>
        <span className="text-[10px] font-mono text-sky-400 font-bold bg-surface-900 px-1.5 py-0.5 rounded border border-sky-500/30">
          S001
        </span>
      </div>

      {/* Navigation */}
      <nav aria-label="Student Navigation" className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <div className="text-[10px] font-semibold text-text-muted uppercase tracking-wider px-3 mb-2">
          Student Coursework
        </div>
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== '/student/dashboard' && pathname.startsWith(item.href));
          return <NavLink key={item.href} item={item} active={isActive} />;
        })}
      </nav>

      {/* Privacy Notice Card */}
      <div className="p-4 border-t border-border">
        <div className="p-3 rounded-xl bg-surface-900 border border-border text-[11px] text-text-muted space-y-1">
          <div className="flex items-center gap-1.5 font-semibold text-text-primary text-[11px]">
            <ShieldCheck size={13} className="text-emerald-400" />
            <span>Private Behavioral History</span>
          </div>
          <p className="text-[10px] text-text-muted leading-tight">
            Your longitudinal interaction history belongs exclusively to you and forms your future baseline.
          </p>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <aside aria-label="Desktop Navigation" className="hidden lg:flex lg:w-60 lg:flex-col lg:flex-shrink-0 h-full">
        {sidebarContent}
      </aside>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={onMobileClose}
        />
      )}

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
