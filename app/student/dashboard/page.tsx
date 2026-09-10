'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ProgressBar } from '@/components/ui/ProgressBar';
import {
  getStudentCourseworkSummary,
  getStudentCourseworkSessions,
  getStudentCourseworkSessionsAsync,
  getStudentBehaviorTrends,
} from '@/lib/services/studentHistoryService';
import { getCurrentProfileClient } from '@/lib/services/auth';
import { subscribeToStudentSessions } from '@/lib/services/supabaseSessionService';
import { getModelMaturity } from '@/lib/services/personalizedBaselineService';
import { StudentSessionDetailModal } from '@/components/integrity/StudentSessionDetailModal';
import { DatasetSession } from '@/types';
import { formatExamDate } from '@/lib/formatters';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts';
import {
  BookOpen,
  ClipboardList,
  Clock,
  Activity,
  ArrowRight,
  ShieldCheck,
  GraduationCap,
  Sparkles,
  Layers,
  ChevronRight,
  User,
  Brain,
  CheckCircle2,
  Calendar,
  AlertCircle,
  FileCheck,
} from 'lucide-react';

export default function StudentDashboardPage() {
  const [activeStudentId, setActiveStudentId] = useState<string>('S001');
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<DatasetSession[]>(() =>
    getStudentCourseworkSessions('S001', { sortOrder: 'newest_first' })
  );

  // Resolve active student from Supabase Auth on mount
  useEffect(() => {
    getCurrentProfileClient().then((profile) => {
      if (profile?.student_identifier) {
        setActiveStudentId(profile.student_identifier);
      } else if (profile?.student_id) {
        setActiveStudentId(profile.student_id);
      }
    });
  }, []);

  // Fetch longitudinal sessions asynchronously from Supabase & local storage
  const loadDashboardSessions = useCallback(async () => {
    try {
      const syncRes = getStudentCourseworkSessions(activeStudentId, { sortOrder: 'newest_first' });
      if (syncRes.length > 0) {
        setSessions(syncRes);
      }

      const res = await getStudentCourseworkSessionsAsync(activeStudentId, { sortOrder: 'newest_first' });
      if (res && res.length > 0) {
        setSessions(res);
      }
    } catch (e) {
      // Graceful fallback to sync sessions
    }
  }, [activeStudentId]);

  useEffect(() => {
    loadDashboardSessions();
  }, [loadDashboardSessions]);

  // Realtime subscription for cross-device updates
  useEffect(() => {
    const unsubscribe = subscribeToStudentSessions(activeStudentId, () => {
      loadDashboardSessions();
    });
    return () => unsubscribe();
  }, [activeStudentId, loadDashboardSessions]);

  // Student profile lookup
  const studentNames: Record<string, string> = {
    S001: 'Alex Chen',
    S002: 'Bhavna Patel',
    S003: 'Carlos Gomez',
    S004: 'David Kim',
    S005: 'Elena Rostova',
  };

  const studentName = studentNames[activeStudentId] || `Student (${activeStudentId})`;

  // Fetch longitudinal data strictly scoped to activeStudentId
  const summary = useMemo(() => getStudentCourseworkSummary(activeStudentId), [activeStudentId, sessions]);
  const maturity = useMemo(() => getModelMaturity(activeStudentId), [activeStudentId]);
  const recentSessions = useMemo(() => sessions.slice(0, 6), [sessions]);
  const trends = useMemo(() => getStudentBehaviorTrends(activeStudentId), [activeStudentId, sessions]);

  // Clean, aggregated session trend data for Student Chart (Max 10 points)
  const paceTrendData = useMemo(() => {
    return sessions
      .slice(0, 8)
      .reverse()
      .map((s, idx) => ({
        name: s.sessionId.replace(`${activeStudentId}_`, ''),
        type: s.sessionType === 'low_stakes' ? 'Practice' : 'Exam',
        responseTime: s.avgResponseTimeSec,
        revisions: s.avgRevisionCount,
        questions: s.questionCount,
      }));
  }, [sessions, activeStudentId]);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* ─── 1. Welcome & Personalized Profile Maturity Header ─── */}
      <div className="rounded-2xl bg-gradient-to-r from-sky-950/60 via-surface-800 to-surface-800 border border-sky-500/20 p-5 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-sky-500/20 text-sky-300 border border-sky-500/30">
                Student Portal
              </span>
              <span className="text-xs text-text-muted">
                Coursework Progress & Learning Profile
              </span>
              <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border flex items-center gap-1 ${
                maturity.status === 'established'
                  ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                  : maturity.status === 'developing'
                  ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                  : 'bg-surface-700 text-text-muted border-border'
              }`}>
                <Brain size={12} />
                Profile: {maturity.label}
              </span>
            </div>

            <div className="flex items-center gap-3 mt-2">
              <h1 className="text-2xl font-black text-text-primary tracking-tight">
                Welcome back, {studentName}
              </h1>
              <span className="px-2 py-0.5 rounded-md bg-surface-900 border border-sky-500/30 text-xs font-mono font-bold text-sky-400">
                {activeStudentId}
              </span>
            </div>

            <p className="text-xs text-text-secondary mt-1 max-w-2xl leading-relaxed">
              Your low-stakes coursework builds your personal learning profile. Your previous practice history ensures accurate, personalized evaluation without cross-student comparisons.
            </p>
          </div>

          {/* Prototype Student Switcher */}
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

      {!summary ? (
        <Card padding="lg">
          <div className="py-12 text-center space-y-4 max-w-md mx-auto">
            <div className="w-12 h-12 rounded-2xl bg-surface-700/60 border border-border flex items-center justify-center mx-auto text-text-muted">
              <BookOpen size={24} />
            </div>
            <div>
              <h3 className="text-base font-bold text-text-primary">No Coursework History Yet</h3>
              <p className="text-xs text-text-muted mt-1 leading-relaxed">
                You haven&apos;t completed any coursework sessions yet. Complete practice sessions to establish your personalized profile.
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
          {/* ─── 2. Actionable Upcoming Assessments & Quick Actions ─── */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Active Examination Card */}
            <div className="md:col-span-2 p-4 rounded-xl bg-gradient-to-r from-indigo-950/40 via-surface-800 to-surface-800 border border-indigo-500/30 shadow-lg flex flex-col justify-between gap-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                      Active Assessment
                    </span>
                    <span className="text-xs text-text-muted">CS401 · Advanced Algorithms</span>
                  </div>
                  <h3 className="text-base font-bold text-text-primary mt-1.5">
                    Stage 7 Multi-Format Validation Examination
                  </h3>
                  <p className="text-xs text-text-secondary mt-0.5 max-w-xl">
                    Comprehensive technical validation covering Multiple Choice, Multi-Select, Short Answer, Coding, and Recursive Debugging.
                  </p>
                </div>
                <Link href="/student/examination">
                  <Button variant="primary" size="sm" className="text-xs shadow-md shadow-indigo-600/30 shrink-0">
                    Take Exam
                    <ArrowRight size={13} className="ml-1.5" />
                  </Button>
                </Link>
              </div>

              <div className="flex items-center gap-4 text-xs text-text-muted pt-2 border-t border-border/60">
                <span className="flex items-center gap-1">
                  <Clock size={13} className="text-indigo-400" />
                  25 Minutes
                </span>
                <span className="flex items-center gap-1">
                  <Layers size={13} className="text-sky-400" />
                  5 Questions
                </span>
                <span className="flex items-center gap-1">
                  <ShieldCheck size={13} className="text-emerald-400" />
                  Continuous Behavioral Protection
                </span>
              </div>
            </div>

            {/* Practice Coursework Quick Card */}
            <div className="p-4 rounded-xl bg-surface-800 border border-border flex flex-col justify-between gap-3">
              <div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  Low-Stakes Practice
                </span>
                <h4 className="text-sm font-bold text-text-primary mt-1.5">
                  Build Baseline History
                </h4>
                <p className="text-xs text-text-muted mt-0.5">
                  Complete ungraded exercises to reinforce your profile accuracy.
                </p>
              </div>
              <Link href="/student/practice">
                <Button variant="secondary" size="sm" className="w-full text-xs">
                  Continue Practice
                  <ChevronRight size={14} className="ml-1" />
                </Button>
              </Link>
            </div>
          </div>

          {/* ─── 3. Coursework KPI Summary Cards ─── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            <div className="p-3.5 rounded-xl bg-surface-800 border border-border space-y-1">
              <div className="flex items-center justify-between text-text-muted text-[11px]">
                <span>Practice Completed</span>
                <BookOpen size={14} className="text-sky-400" />
              </div>
              <p className="text-2xl font-black text-sky-400 tabular-nums">
                {summary.lowStakesSessionsCount}
              </p>
              <span className="text-[10px] text-text-muted block">Low-Stakes Modules</span>
            </div>

            <div className="p-3.5 rounded-xl bg-surface-800 border border-border space-y-1">
              <div className="flex items-center justify-between text-text-muted text-[11px]">
                <span>Graded Exams</span>
                <ClipboardList size={14} className="text-indigo-400" />
              </div>
              <p className="text-2xl font-black text-indigo-400 tabular-nums">
                {summary.gradedSessionsCount}
              </p>
              <span className="text-[10px] text-text-muted block">Completed Assessments</span>
            </div>

            <div className="p-3.5 rounded-xl bg-surface-800 border border-border space-y-1">
              <div className="flex items-center justify-between text-text-muted text-[11px]">
                <span>Typical Pace</span>
                <Clock size={14} className="text-amber-400" />
              </div>
              <p className="text-2xl font-black text-amber-400 tabular-nums font-mono">
                {summary.avgResponseTimeSec}s
              </p>
              <span className="text-[10px] text-text-muted block">Avg per Question</span>
            </div>

            <div className="p-3.5 rounded-xl bg-surface-800 border border-border space-y-1">
              <div className="flex items-center justify-between text-text-muted text-[11px]">
                <span>Questions Done</span>
                <Layers size={14} className="text-emerald-400" />
              </div>
              <p className="text-2xl font-black text-emerald-400 tabular-nums">
                {summary.totalQuestionsAnswered}
              </p>
              <span className="text-[10px] text-text-muted block">Total Interactions</span>
            </div>
          </div>

          {/* ─── 4. Maximum 2 Intuitive Student Visualizations ─── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Chart 1: Coursework vs Examination Progress */}
            <Card>
              <CardHeader
                title="Coursework & Exam Milestones"
                subtitle="Overview of your completed practice sessions and graded examinations"
                badge={<Badge variant="active" size="sm">Completed Sessions</Badge>}
              />
              <div className="h-56 mt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={paceTrendData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} />
                    <YAxis stroke="#94a3b8" fontSize={11} />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-surface-800 border border-border p-2 rounded-lg text-xs shadow-xl">
                              <p className="font-bold text-text-primary">{data.name} ({data.type})</p>
                              <p className="text-sky-400 font-mono mt-0.5">Questions: {data.questions}</p>
                              <p className="text-amber-400 font-mono">Avg Time: {data.responseTime}s</p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar dataKey="questions" fill="#38bdf8" radius={[4, 4, 0, 0]} name="Questions" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            {/* Chart 2: Pacing Progression Trend */}
            <Card>
              <CardHeader
                title="Response Pace Progression"
                subtitle="Your average formulation pace across completed coursework sessions"
                badge={<Badge variant="verified" size="sm">Pacing History</Badge>}
              />
              <div className="h-56 mt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={paceTrendData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} />
                    <YAxis stroke="#94a3b8" fontSize={11} />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-surface-800 border border-border p-2 rounded-lg text-xs shadow-xl">
                              <p className="font-bold text-text-primary">{data.name}</p>
                              <p className="text-emerald-400 font-mono mt-0.5">Pace: {data.responseTime} seconds</p>
                              <p className="text-indigo-400 font-mono">Revisions: {data.revisions} / Q</p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="responseTime"
                      stroke="#10b981"
                      strokeWidth={2.5}
                      dot={{ r: 4, fill: '#10b981' }}
                      activeDot={{ r: 6 }}
                      name="Response Time (s)"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          {/* ─── 5. Recent Sessions History List ─── */}
          <Card>
            <CardHeader
              title="Recent Coursework & Examination Sessions"
              subtitle="Your most recent practice coursework and graded examination attempts"
              action={
                <Link href="/student/coursework">
                  <Button variant="ghost" size="sm" className="text-xs text-sky-400 hover:text-sky-300">
                    View All ({summary.totalSessions})
                    <ArrowRight size={13} className="ml-1" />
                  </Button>
                </Link>
              }
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-3">
              {recentSessions.map((s) => {
                const isLowStakes = s.sessionType === 'low_stakes';
                return (
                  <div
                    key={s.sessionId}
                    onClick={() => setSelectedSessionId(s.sessionId)}
                    className="p-3.5 rounded-xl bg-surface-700/30 hover:bg-surface-700/60 border border-border transition-all cursor-pointer flex flex-col justify-between gap-3 group"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-xs text-text-primary font-mono truncate">
                          {s.sessionId}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            isLowStakes
                              ? 'bg-sky-500/15 text-sky-300 border border-sky-500/30'
                              : 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/30'
                          }`}
                        >
                          {isLowStakes ? 'Practice' : 'Graded Exam'}
                        </span>
                      </div>
                      <p className="text-[11px] text-text-muted mt-1">
                        {formatExamDate(s.timestamp)} · {s.deviceType}
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-border/50 text-xs">
                      <span className="text-text-muted">
                        {s.questionCount} Questions
                      </span>
                      <div className="flex items-center gap-1.5 text-emerald-400 font-mono font-bold">
                        <span>{s.avgResponseTimeSec}s avg</span>
                        <ChevronRight size={13} className="text-text-muted group-hover:translate-x-0.5 transition-transform" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* ─── 6. Important Privacy & Integrity Notifications ─── */}
          <div className="p-4 rounded-xl bg-surface-800/80 border border-border flex items-start gap-3 text-xs">
            <ShieldCheck size={18} className="text-emerald-400 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-bold text-text-primary block">
                Privacy & Continuous Behavioral Protection Active
              </span>
              <p className="text-text-muted text-[11px] leading-relaxed">
                ExamGuard protects exam integrity through non-invasive behavioral telemetry. No webcam video, microphone audio, or clipboard contents are ever recorded. Your baseline belongs exclusively to you.
              </p>
            </div>
          </div>
        </>
      )}

      {/* Session Details Modal */}
      <StudentSessionDetailModal
        studentId={activeStudentId}
        sessionId={selectedSessionId}
        onClose={() => setSelectedSessionId(null)}
      />
    </div>
  );
}

