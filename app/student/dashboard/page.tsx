'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import {
  getStudentCourseworkSummary,
  getStudentCourseworkSessions,
  getStudentBehaviorTrends,
  getStudentDeviceHistory,
  getStudentTimeOfDayHistory,
  getStudentTimeline,
} from '@/lib/services/studentHistoryService';
import { getModelMaturity } from '@/lib/services/personalizedBaselineService';
import { StudentBehaviorCharts } from '@/components/integrity/StudentBehaviorCharts';
import { StudentTimeline } from '@/components/integrity/StudentTimeline';
import { StudentDeviceHistory } from '@/components/integrity/StudentDeviceHistory';
import { StudentTimeOfDay } from '@/components/integrity/StudentTimeOfDay';
import { StudentSessionDetailModal } from '@/components/integrity/StudentSessionDetailModal';
import {
  BookOpen,
  ClipboardList,
  Clock,
  Activity,
  MousePointer2,
  Scroll,
  ArrowRight,
  ShieldCheck,
  GraduationCap,
  Sparkles,
  Calendar,
  Layers,
  ChevronRight,
  User,
  Brain,
} from 'lucide-react';

export default function StudentDashboardPage() {
  // Allow toggling between prototype cohort students (S001, S002, S003) for easy testing of isolation
  const [activeStudentId, setActiveStudentId] = useState<string>('S001');
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  // Student student profile lookup
  const studentNames: Record<string, string> = {
    S001: 'Alex Chen',
    S002: 'Bhavna Patel',
    S003: 'Carlos Gomez',
    S004: 'David Kim',
    S005: 'Elena Rostova',
  };

  const studentName = studentNames[activeStudentId] || `Student (${activeStudentId})`;

  // Fetch longitudinal data strictly scoped to activeStudentId
  const summary = useMemo(() => getStudentCourseworkSummary(activeStudentId), [activeStudentId]);
  const maturity = useMemo(() => getModelMaturity(activeStudentId), [activeStudentId]);
  const recentSessions = useMemo(
    () => getStudentCourseworkSessions(activeStudentId, { sortOrder: 'newest_first' }).slice(0, 5),
    [activeStudentId]
  );
  const trends = useMemo(() => getStudentBehaviorTrends(activeStudentId), [activeStudentId]);
  const devices = useMemo(() => getStudentDeviceHistory(activeStudentId), [activeStudentId]);
  const timeOfDayStats = useMemo(() => getStudentTimeOfDayHistory(activeStudentId), [activeStudentId]);
  const timeline = useMemo(() => getStudentTimeline(activeStudentId).slice(0, 4), [activeStudentId]);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* ─── Top Welcome & Identity Banner ─── */}
      <div className="rounded-2xl bg-gradient-to-r from-sky-950/60 via-surface-800 to-surface-800 border border-sky-500/20 p-5 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-sky-500/20 text-sky-300 border border-sky-500/30">
                Student Portal
              </span>
              <span className="text-xs text-text-muted">
                Longitudinal Coursework & Behavioral Profile
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                <Brain size={11} />
                {maturity.label}
              </span>
            </div>

            <div className="flex items-center gap-3 mt-2">
              <h1 className="text-2xl font-black text-text-primary tracking-tight">
                Welcome, {studentName}
              </h1>
              <span className="px-2 py-0.5 rounded-md bg-surface-900 border border-sky-500/30 text-xs font-mono font-bold text-sky-400">
                {activeStudentId}
              </span>
            </div>

            <p className="text-xs text-text-secondary mt-1 max-w-2xl leading-relaxed">
              Your low-stakes coursework and practice sessions build your individual historical profile. The platform uses your own previous history as your future baseline.
            </p>
          </div>

          {/* Prototype Cohort Switcher */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 bg-surface-900/80 p-2.5 rounded-xl border border-border">
            <span className="text-[11px] text-text-muted font-medium flex items-center gap-1">
              <User size={13} className="text-sky-400" />
              Demo Student:
            </span>
            <div className="flex items-center gap-1">
              {['S001', 'S002', 'S003', 'S004'].map((sId) => (
                <button
                  key={sId}
                  onClick={() => setActiveStudentId(sId)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all ${
                    activeStudentId === sId
                      ? 'bg-sky-500 text-navy-950 shadow-md shadow-sky-500/30'
                      : 'text-text-secondary hover:text-text-primary hover:bg-surface-700'
                  }`}
                >
                  {sId}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ─── Empty State (for students with 0 records) ─── */}
      {!summary ? (
        <Card padding="lg">
          <div className="py-12 text-center space-y-4 max-w-md mx-auto">
            <div className="w-12 h-12 rounded-2xl bg-surface-700/60 border border-border flex items-center justify-center mx-auto text-text-muted">
              <BookOpen size={24} />
            </div>
            <div>
              <h3 className="text-base font-bold text-text-primary">No Coursework History Yet</h3>
              <p className="text-xs text-text-muted mt-1 leading-relaxed">
                You haven&apos;t completed any practice coursework or examination sessions yet. Complete practice sessions to start recording your longitudinal behavioral history.
              </p>
            </div>
            <Link href="/student/practice">
              <Button variant="primary" size="sm" className="text-xs">
                Start Practice Coursework
                <ArrowRight size={13} className="ml-1.5" />
              </Button>
            </Link>
          </div>
        </Card>
      ) : (
        <>
          {/* ─── Coursework & Exam KPI Summary Grid ─── */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
            {/* 1. Low-Stakes Practice */}
            <div className="p-3.5 rounded-xl bg-surface-800 border border-border space-y-1">
              <div className="flex items-center justify-between text-text-muted text-[11px]">
                <span>Practice Sessions</span>
                <BookOpen size={14} className="text-sky-400" />
              </div>
              <p className="text-2xl font-black text-sky-400 tabular-nums">
                {summary.lowStakesSessionsCount}
              </p>
              <span className="text-[10px] text-text-muted block">Low-Stakes Coursework</span>
            </div>

            {/* 2. Graded Examinations */}
            <div className="p-3.5 rounded-xl bg-surface-800 border border-border space-y-1">
              <div className="flex items-center justify-between text-text-muted text-[11px]">
                <span>Graded Exams</span>
                <ClipboardList size={14} className="text-indigo-400" />
              </div>
              <p className="text-2xl font-black text-indigo-400 tabular-nums">
                {summary.gradedSessionsCount}
              </p>
              <span className="text-[10px] text-text-muted block">Examination Sessions</span>
            </div>

            {/* 3. Total Questions */}
            <div className="p-3.5 rounded-xl bg-surface-800 border border-border space-y-1">
              <div className="flex items-center justify-between text-text-muted text-[11px]">
                <span>Questions Done</span>
                <Layers size={14} className="text-emerald-400" />
              </div>
              <p className="text-2xl font-black text-emerald-400 tabular-nums">
                {summary.totalQuestionsAnswered}
              </p>
              <span className="text-[10px] text-text-muted block">Interactions Logged</span>
            </div>

            {/* 4. Avg Response Time */}
            <div className="p-3.5 rounded-xl bg-surface-800 border border-border space-y-1">
              <div className="flex items-center justify-between text-text-muted text-[11px]">
                <span>Avg Response</span>
                <Clock size={14} className="text-amber-400" />
              </div>
              <p className="text-2xl font-black text-amber-400 tabular-nums font-mono">
                {summary.avgResponseTimeSec}s
              </p>
              <span className="text-[10px] text-text-muted block">Historical Average</span>
            </div>

            {/* 5. Avg Revisions */}
            <div className="p-3.5 rounded-xl bg-surface-800 border border-border space-y-1">
              <div className="flex items-center justify-between text-text-muted text-[11px]">
                <span>Avg Revisions</span>
                <Activity size={14} className="text-purple-400" />
              </div>
              <p className="text-2xl font-black text-purple-400 tabular-nums font-mono">
                {summary.avgAnswerRevisions}
              </p>
              <span className="text-[10px] text-text-muted block">Per Question</span>
            </div>

            {/* 6. Devices Used */}
            <div className="p-3.5 rounded-xl bg-surface-800 border border-border space-y-1">
              <div className="flex items-center justify-between text-text-muted text-[11px]">
                <span>Devices Used</span>
                <Sparkles size={14} className="text-sky-300" />
              </div>
              <p className="text-2xl font-black text-text-primary tabular-nums">
                {summary.devicesUsed.length}
              </p>
              <span className="text-[10px] text-text-muted block">Hardware Contexts</span>
            </div>
          </div>

          {/* ─── Descriptive Behavioral Activity Summary ─── */}
          <Card>
            <CardHeader
              title="Your Activity History"
              subtitle="Descriptive interaction averages across your longitudinal coursework sessions"
              badge={<Badge variant="active">Descriptive Statistics Only</Badge>}
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-3">
              <div className="p-3.5 rounded-xl bg-surface-700/30 border border-border space-y-1.5">
                <div className="flex items-center gap-2 text-text-muted text-xs">
                  <Clock size={14} className="text-emerald-400" />
                  <span>Average Response Time</span>
                </div>
                <div className="text-xl font-bold text-emerald-400 font-mono">
                  {summary.avgResponseTimeSec} seconds
                </div>
                <p className="text-[10px] text-text-muted leading-tight">
                  Typical time spent formulating and submitting answers.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-surface-700/30 border border-border space-y-1.5">
                <div className="flex items-center gap-2 text-text-muted text-xs">
                  <Activity size={14} className="text-indigo-400" />
                  <span>Average Answer Revisions</span>
                </div>
                <div className="text-xl font-bold text-indigo-400 font-mono">
                  {summary.avgAnswerRevisions} changes / Q
                </div>
                <p className="text-[10px] text-text-muted leading-tight">
                  Frequency of revising choices before final submission.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-surface-700/30 border border-border space-y-1.5">
                <div className="flex items-center gap-2 text-text-muted text-xs">
                  <MousePointer2 size={14} className="text-amber-400" />
                  <span>Average Pointer Speed</span>
                </div>
                <div className="text-xl font-bold text-amber-400 font-mono">
                  {summary.avgPointerSpeedPxS} px/s
                </div>
                <p className="text-[10px] text-text-muted leading-tight">
                  Natural cursor navigation velocity across questions.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-surface-700/30 border border-border space-y-1.5">
                <div className="flex items-center gap-2 text-text-muted text-xs">
                  <Scroll size={14} className="text-sky-400" />
                  <span>Average Scroll Distance</span>
                </div>
                <div className="text-xl font-bold text-sky-400 font-mono">
                  {summary.avgScrollDistancePx} pixels
                </div>
                <p className="text-[10px] text-text-muted leading-tight">
                  Average vertical viewport movement per interaction.
                </p>
              </div>
            </div>
          </Card>

          {/* ─── Longitudinal Behavior Charts ─── */}
          <StudentBehaviorCharts trends={trends} studentId={activeStudentId} />

          {/* ─── Timeline & Recent Sessions Grid ─── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Timeline */}
            <StudentTimeline
              timeline={timeline}
              onSelectSession={(sId) => setSelectedSessionId(sId)}
            />

            {/* Recent Coursework Sessions Table */}
            <Card>
              <CardHeader
                title="Recent Coursework Sessions"
                subtitle="Your most recent practice and examination sessions"
                action={
                  <Link href="/student/coursework">
                    <Button variant="ghost" size="sm" className="text-xs text-sky-400 hover:text-sky-300">
                      View All ({summary.totalSessions})
                      <ArrowRight size={13} className="ml-1" />
                    </Button>
                  </Link>
                }
              />
              <div className="space-y-2 mt-3">
                {recentSessions.map((s) => {
                  const isLowStakes = s.sessionType === 'low_stakes';
                  return (
                    <div
                      key={s.sessionId}
                      onClick={() => setSelectedSessionId(s.sessionId)}
                      className="p-3 rounded-xl bg-surface-700/30 hover:bg-surface-700/60 border border-border transition-all cursor-pointer flex items-center justify-between gap-3 group"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-text-primary">
                            {s.sessionId}
                          </span>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              isLowStakes
                                ? 'bg-sky-500/15 text-sky-300 border border-sky-500/30'
                                : 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/30'
                            }`}
                          >
                            {isLowStakes ? 'Practice' : 'Exam'}
                          </span>
                        </div>
                        <p className="text-[11px] text-text-muted">
                          {s.timestamp} · {s.questionCount} Questions · {s.deviceType}
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right text-xs">
                          <span className="font-mono text-emerald-400 font-bold block">
                            {s.avgResponseTimeSec}s
                          </span>
                          <span className="text-[10px] text-text-muted">avg resp</span>
                        </div>
                        <ChevronRight size={14} className="text-text-muted group-hover:text-text-primary group-hover:translate-x-0.5 transition-all" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>

          {/* ─── Device History & Time of Day ─── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <StudentDeviceHistory devices={devices} />
            <StudentTimeOfDay stats={timeOfDayStats} />
          </div>
        </>
      )}

      {/* Question Detail Inspector Modal */}
      <StudentSessionDetailModal
        studentId={activeStudentId}
        sessionId={selectedSessionId}
        onClose={() => setSelectedSessionId(null)}
      />
    </div>
  );
}
