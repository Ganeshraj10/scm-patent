'use client';

import { useState } from 'react';
import { StudentSidebar } from '@/components/layout/StudentSidebar';
import { Menu, Bell, ShieldCheck } from 'lucide-react';

interface StudentLayoutClientProps {
  children: React.ReactNode;
  title: string;
}

export function StudentLayoutClient({ children, title }: StudentLayoutClientProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-screen bg-navy-900 overflow-hidden">
      <StudentSidebar
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Topbar */}
        <header className="h-14 flex-shrink-0 border-b border-border bg-surface-900/80 backdrop-blur-sm sticky top-0 z-30">
          <div className="h-full flex items-center gap-3 px-5">
            <button
              onClick={() => setMobileOpen(true)}
              className="p-2 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-700 transition-colors lg:hidden"
              aria-label="Open navigation"
            >
              <Menu size={18} />
            </button>

            <div className="flex items-center gap-2 lg:hidden">
              <div className="w-6 h-6 rounded-md bg-indigo-600 flex items-center justify-center">
                <ShieldCheck size={13} className="text-white" />
              </div>
              <span className="text-sm font-bold text-text-primary">ExamGuard</span>
            </div>

            <h1 className="hidden lg:block text-sm font-semibold text-text-primary flex-1">
              {title}
            </h1>

            <div className="flex items-center gap-2 ml-auto">
              <button
                className="p-2 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-700 transition-colors"
                aria-label="Notifications"
              >
                <Bell size={16} />
              </button>
              <div className="w-7 h-7 rounded-full bg-indigo-600/30 border border-indigo-500/30 flex items-center justify-center">
                <span className="text-xs font-bold text-indigo-400">A</span>
              </div>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-5 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
