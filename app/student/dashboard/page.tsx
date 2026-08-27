'use client';

import Link from 'next/link';
import {
  Brain,
  BookOpen,
  Monitor,
  CheckCircle,
  AlertTriangle,
  ArrowRight,
  Clock,
  TrendingUp,
  Zap,
  ChevronRight,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { ChartContainer } from '@/components/ui/ChartContainer';
import { mockDeviationHistory } from '@/data/mockFeatures';
import { getStudentSessions, getTrackedSessionsByStudent } from '@/lib/services/sessions';
import { formatRelativeTime, formatDate } from '@/lib/formatters';
import { useState, useEffect } from 'react';
import { getBehavioralModel } from '@/lib/services/behavioralModels';
import { getCurrentStudentProfile } from '@/lib/services/students';
import type { BehavioralModel, Student } from '@/types';

// Demo mock fallbacks will be resolved per student UUID where possible

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-surface-700 border border-border rounded-lg px-3 py-2 shadow-lg text-xs">
        <p className="text-text-muted">{label}</p>
        <p className="text-text-primary font-semibold mt-0.5">Score: {payload[0].value.toFixed(1)}</p>
      </div>
    );
  }
  return null;
};

export default function StudentDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);
  
  const [model, setModel] = useState<BehavioralModel | null>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    let active = true;
    getCurrentStudentProfile().then(profile => {
      if (!active) return;
      if (!profile) {
        setProfileError('Student profile not found');
        setLoading(false);
        return;
      }
      
      const studentId = profile.id;
      getStudentSessions(studentId).then(baseSess => {
        getTrackedSessionsByStudent(studentId).then(tracked => {
          if (!active) return;
          const combinedSess = [...baseSess, ...tracked];
          const uniqueSess = Array.from(new Map(combinedSess.map(s => [s.id, s])).values());
          
          const baseHist = mockDeviationHistory[studentId] ?? [];
          const appendedHist = [...baseHist];
          tracked.forEach((s) => {
            const dateStr = new Date(s.date || (s as any).startedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            if (!appendedHist.find(h => h.date === dateStr)) {
              appendedHist.push({
                date: dateStr,
                deviationScore: s.deviationScore || 0,
                threshold: s.personalizedThreshold || 0,
                reviewRequired: s.reviewStatus === 'review_required' || s.reviewStatus === 'disputed'
              });
            }
          });
      
      // Phase 6: Fetch model from persistence
      getBehavioralModel(studentId, 'desktop')
        .then(persistedModel => {
          if (!active) return;
          setModel(persistedModel);
          setSessions(uniqueSess);
          setHistory(appendedHist);
          setLoading(false);
        })
        .catch(err => {
          if (active) {
            setProfileError('Failed to load behavioral model');
            setLoading(false);
          }
        });
        }).catch(err => {
          if (active) {
            setProfileError('Failed to load tracked sessions');
            setLoading(false);
          }
        });
      }).catch(err => {
        if (active) {
          setProfileError('Failed to load student sessions');
          setLoading(false);
        }
      });
    }).catch(err => {
      if (active) {
        setProfileError(err.message);
        setLoading(false);
      }
    });
    return () => { active = false; };
  }, []);

  if (loading) {
    return <div className="p-8 text-center text-text-muted">Loading dashboard...</div>;
  }
  if (profileError || !model) {
    return <div className="p-8 text-center text-rose-400">{profileError || 'Unable to load profile'}</div>;
  }

  const isActive = model.status === 'active';

  const recentSessions = sessions
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 4);

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Welcome */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-text-primary">Welcome back, Arjun</h2>
          <p className="text-sm text-text-muted mt-0.5">
            Your personalized behavioral model is {isActive ? 'active and ready' : 'still building'}.
          </p>
        </div>
        <Link
          href="/student/practice"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors shadow-lg shadow-indigo-600/20 flex-shrink-0"
          id="start-practice-btn"
        >
          <BookOpen size={14} />
          Start Practice
        </Link>
      </div>

      {/* Model status cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Model status */}
        <div className={[
          'col-span-2 lg:col-span-1 rounded-xl p-5 border',
          isActive
            ? 'bg-emerald-500/8 border-emerald-500/20'
            : 'bg-amber-500/8 border-amber-500/20',
        ].join(' ')}>
          <div className="flex items-center gap-2 mb-3">
            <Brain size={15} className={isActive ? 'text-emerald-400' : 'text-amber-400'} />
            <span className="text-xs font-semibold uppercase tracking-wider"
              style={{ color: isActive ? '#34d399' : '#fbbf24' }}>
              Behavioral Model
            </span>
          </div>
          <p className="text-2xl font-bold text-text-primary tabular-nums">{model.confidence}%</p>
          <p className="text-xs mt-1" style={{ color: isActive ? '#34d399' : '#fbbf24' }}>
            confidence
          </p>
          <ProgressBar
            value={model.confidence}
            colorThresholds={{ low: 70, high: 85 }}
            size="xs"
            className="mt-3"
          />
        </div>

        {/* Sessions */}
        <div className="rounded-xl bg-surface-800 border border-border p-5">
          <div className="flex items-center gap-2 mb-3">
            <BookOpen size={14} className="text-indigo-400" />
            <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">Sessions</span>
          </div>
          <p className="text-2xl font-bold tabular-nums text-text-primary">{model.sessionCount}</p>
          <p className="text-xs text-text-muted mt-1">low-stakes completed</p>
        </div>

        {/* Model status badge */}
        <div className="rounded-xl bg-surface-800 border border-border p-5">
          <div className="flex items-center gap-2 mb-3">
            <Zap size={14} className="text-sky-400" />
            <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">Status</span>
          </div>
          <Badge
            variant={isActive ? 'active' : 'cold_start'}
            dot
            className="text-sm px-3 py-1.5"
          >
            {isActive ? 'ACTIVE' : 'COLD START'}
          </Badge>
          <p className="text-xs text-text-muted mt-2">
            {isActive ? 'Fully personalized' : `${model.minimumSessionsRequired - model.sessionCount} more sessions needed`}
          </p>
        </div>

        {/* Device */}
        <div className="rounded-xl bg-surface-800 border border-border p-5">
          <div className="flex items-center gap-2 mb-3">
            <Monitor size={14} className="text-text-muted" />
            <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">Device</span>
          </div>
          <p className="text-lg font-semibold text-text-primary capitalize">Desktop</p>
          <p className="text-xs text-text-muted mt-1">current session</p>
        </div>
      </div>

      {/* Privacy notice */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-indigo-600/6 border border-indigo-500/15">
        <CheckCircle size={15} className="text-indigo-400 mt-0.5 flex-shrink-0" />
        <p className="text-xs text-text-secondary leading-relaxed">
          <span className="font-semibold text-indigo-400">Privacy: </span>
          ExamGuard tracks only behavioral metadata — timing, scroll patterns, pointer movement — not your answers or keystrokes.
          Your behavioral model is built from your own history and is never shared with other students.
        </p>
      </div>

      {/* Charts + quick actions */}
      <div className="grid lg:grid-cols-3 gap-5">
        {/* Deviation over time */}
        <div className="lg:col-span-2">
          <ChartContainer
            title="Your Deviation History"
            subtitle="Behavioral deviation score per session — lower is more consistent"
            height={220}
          >
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={history} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine y={35} stroke="rgba(251,191,36,0.4)" strokeDasharray="4 4" />
                <Line
                  type="monotone"
                  dataKey="deviationScore"
                  stroke="#6366f1"
                  strokeWidth={2.5}
                  dot={(props) => {
                    const d = props.payload as { reviewRequired: boolean };
                    return (
                      <circle
                        key={`dot-${props.index}`}
                        cx={props.cx}
                        cy={props.cy}
                        r={d.reviewRequired ? 5 : 3}
                        fill={d.reviewRequired ? '#fb7185' : '#6366f1'}
                        stroke="transparent"
                      />
                    );
                  }}
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartContainer>
        </div>

        {/* Next steps */}
        <Card header={<CardHeader title="Next Steps" />} padding="sm">
          <div className="space-y-2">
            {[
              {
                icon: <BookOpen size={14} />,
                label: 'Practice Session',
                sub: 'Adds to your model history',
                href: '/student/practice',
                color: 'text-indigo-400',
                done: true,
              },
              {
                icon: <Brain size={14} />,
                label: 'View Behavior Profile',
                sub: 'See your expected behavior',
                href: '/student/behavior',
                color: 'text-sky-400',
                done: false,
              },
              {
                icon: <TrendingUp size={14} />,
                label: 'Track Improvement',
                sub: 'Model confidence grows with sessions',
                href: '/student/results',
                color: 'text-emerald-400',
                done: false,
              },
            ].map((step, i) => (
              <Link
                key={i}
                href={step.href}
                className="flex items-start gap-2.5 p-2.5 rounded-lg hover:bg-surface-700 transition-colors group"
              >
                <span className={`mt-0.5 flex-shrink-0 ${step.color}`}>{step.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-text-primary group-hover:text-indigo-400 transition-colors">
                    {step.label}
                  </p>
                  <p className="text-[10px] text-text-muted">{step.sub}</p>
                </div>
                <ChevronRight size={12} className="text-text-muted mt-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
              </Link>
            ))}
          </div>
        </Card>
      </div>

      {/* Recent session activity */}
      <Card
        header={
          <CardHeader
            title="Recent Sessions"
            subtitle="Your latest practice and examination sessions"
            action={
              <Link href="/student/results" className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1">
                All sessions <ArrowRight size={11} />
              </Link>
            }
          />
        }
        padding="none"
      >
        <div className="divide-y divide-border">
          {recentSessions.map((session) => (
            <div key={session.id} className="px-5 py-3.5 flex items-center gap-3">
              <div className={[
                'w-2 h-2 rounded-full flex-shrink-0',
                session.reviewStatus === 'review_required' || session.reviewStatus === 'disputed'
                  ? 'bg-amber-400'
                  : 'bg-emerald-400',
              ].join(' ')} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text-primary truncate">{session.examName}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <Clock size={10} className="text-text-muted flex-shrink-0" />
                  <p className="text-xs text-text-muted">{formatRelativeTime(session.date)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Badge variant={session.type === 'graded_examination' ? 'graded' : 'low_stakes'} size="sm">
                  {session.type === 'graded_examination' ? 'Exam' : 'Practice'}
                </Badge>
                <span className={[
                  'text-sm font-bold tabular-nums',
                  session.deviationScore > session.personalizedThreshold ? 'text-amber-400' : 'text-emerald-400',
                ].join(' ')}>
                  {session.deviationScore.toFixed(0)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Model explanation card */}
      <Card padding="md">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center flex-shrink-0">
            <Brain size={18} className="text-indigo-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-text-primary mb-1">How your model works</h3>
            <p className="text-xs text-text-secondary leading-relaxed">
              ExamGuard builds a personalized behavioral model from your practice sessions.
              It learns your typical response timing, scrolling habits, and revision patterns.
              During graded examinations, your behavior is compared against{' '}
              <span className="text-indigo-400 font-medium">your own</span> baseline — not other students.
              The more sessions you complete, the more accurate and confident the model becomes.
            </p>
            <div className="flex items-center gap-2 mt-3">
              {isActive ? (
                <><CheckCircle size={13} className="text-emerald-400" />
                <span className="text-xs text-emerald-400 font-medium">Your model has enough history to be reliable.</span></>
              ) : (
                <><AlertTriangle size={13} className="text-amber-400" />
                <span className="text-xs text-amber-400 font-medium">Complete {Math.max(0, model.minimumSessionsRequired - model.sessionCount)} more practice sessions to activate your full model.</span></>
              )}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
