'use client';

import React from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ShieldAlert, ArrowLeft, LogOut, Key, CheckCircle } from 'lucide-react';

export default function AccessDeniedPage() {
  return (
    <div className="min-h-screen bg-navy-900 flex flex-col justify-center items-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-6">
        <div className="text-center">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center shadow-lg shadow-rose-500/10">
            <ShieldAlert size={32} className="text-rose-400" />
          </div>
          <h1 className="mt-4 text-2xl font-black text-text-primary tracking-tight">
            Access Restricted
          </h1>
          <p className="mt-1 text-xs text-text-muted">
            Role-Based Authorization Barrier (RBAC)
          </p>
        </div>

        <Card padding="lg" className="border-rose-500/20 bg-surface-800/90 shadow-xl space-y-4">
          <div className="p-3.5 rounded-xl bg-surface-700/50 border border-border text-xs text-text-secondary leading-relaxed">
            <p className="font-semibold text-text-primary mb-1">
              Unauthorized Area
            </p>
            You do not possess the required role permissions to view this resource. The ExamGuard platform enforces strict access boundaries:
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex items-start gap-2.5 p-2 rounded-lg bg-surface-700/30 border border-border">
              <CheckCircle size={14} className="text-emerald-400 mt-0.5 shrink-0" />
              <div>
                <strong className="text-text-primary">Students:</strong> Permitted to access personal coursework, exams, and mapped baseline telemetry only.
              </div>
            </div>

            <div className="flex items-start gap-2.5 p-2 rounded-lg bg-surface-700/30 border border-border">
              <CheckCircle size={14} className="text-indigo-400 mt-0.5 shrink-0" />
              <div>
                <strong className="text-text-primary">Instructors:</strong> Permitted to review assigned student sessions, telemetry reports, and review queues.
              </div>
            </div>

            <div className="flex items-start gap-2.5 p-2 rounded-lg bg-surface-700/30 border border-border">
              <CheckCircle size={14} className="text-amber-400 mt-0.5 shrink-0" />
              <div>
                <strong className="text-text-primary">Administrators:</strong> Permitted to manage platform users, role assignments, and system status.
              </div>
            </div>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row gap-2.5">
            <Link href="/instructor/dashboard" className="flex-1">
              <Button variant="primary" size="sm" className="w-full justify-center text-xs">
                <ArrowLeft size={13} className="mr-1.5" />
                Instructor Dashboard
              </Button>
            </Link>
            <Link href="/student/dashboard" className="flex-1">
              <Button variant="secondary" size="sm" className="w-full justify-center text-xs">
                Student Dashboard
              </Button>
            </Link>
          </div>

          <div className="border-t border-border/70 pt-3 text-center">
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
            >
              <LogOut size={13} />
              Switch user account / sign in again
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
