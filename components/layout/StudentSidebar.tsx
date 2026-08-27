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
    sublabel: 'Overview & model status',
  },
  {
    label: 'Practice Session',
    href: '/student/practice',
    icon: <BookOpen size={17} />,
    sublabel: 'Build your behavioral model',
  },
  {
    label: 'My Behavior Profile',
    href: '/student/behavior',
    icon: <Brain size={17} />,
    sublabel: 'Your personalized model',
  },
  {
    label: 'Take Examination',
    href: '/student/examination',
    icon: <ClipboardList size={17} />,
    sublabel: 'Graded session',
  },
  {
    label: 'My Results',
    href: '/student/results',
    icon: <BarChart3 size={17} />,
    sublabel: 'Session history',
  },
];

// Demo student identity (Phase 2 — mock)
const demoStudent = {
  name: 'Arjun Mehta',
  studentId: 'U2021034',
  modelStatus: 'active' as const,
  sessionCount: 24,
  confidence: 91,
};

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
        <p className="leading-none">{item.label}</p>
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
    <div className="flex flex-col h-full bg-surface-900 border-r border-border">
      {/* Logo + close */}
      <div className="flex items-center justify-between px-5 py-5 border-b border-border flex-shrink-0">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-600/30 group-hover:bg-indigo-500 transition-colors">
            <ShieldCheck size={17} className="text-white" />
          </div>
          <div>
            <span className="text-sm font-bold text-text-primary tracking-tight">ExamGuard</span>
            <p className="text-[10px] text-text-muted leading-none mt-0.5">Student Portal</p>
          </div>
        </Link>
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

      {/* Model status pill */}
      <div className="px-4 pt-4 pb-2">
        <div className="px-3 py-2.5 rounded-lg bg-emerald-500/8 border border-emerald-500/15">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider">Model Active</span>
            <span className="text-[10px] font-bold text-emerald-400">{demoStudent.confidence}%</span>
          </div>
          <div className="w-full h-1 bg-surface-600 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full"
              style={{ width: `${demoStudent.confidence}%` }}
            />
          </div>
          <p className="text-[10px] text-text-muted mt-1">{demoStudent.sessionCount} sessions · {demoStudent.confidence}% confidence</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-3 space-y-1 overflow-y-auto" aria-label="Student navigation">
        {navItems.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/');
          return <NavLink key={item.href} item={item} active={active} />;
        })}
      </nav>

      {/* Instructor link */}
      <div className="px-4 pb-3 flex-shrink-0">
        <Link
          href="/instructor/dashboard"
          className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs text-text-muted hover:text-text-secondary border border-border hover:bg-surface-700 transition-colors"
        >
          Switch to Instructor View
        </Link>
      </div>

      {/* Student identity footer */}
      <div className="p-4 border-t border-border flex-shrink-0">
        <div className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg bg-surface-700 border border-border">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-7 h-7 rounded-full bg-indigo-600/30 border border-indigo-500/30 flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-bold text-indigo-400">
                {demoStudent.name.charAt(0)}
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-text-primary truncate">{demoStudent.name}</p>
              <p className="text-[10px] text-text-muted truncate">{demoStudent.studentId}</p>
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
      {/* Desktop */}
      <aside className="hidden lg:flex flex-col w-64 flex-shrink-0 h-screen sticky top-0">
        {sidebarContent}
      </aside>

      {/* Mobile backdrop */}
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
