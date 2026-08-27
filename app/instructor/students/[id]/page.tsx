'use client';

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { use, useEffect, useState } from 'react';
import { getBehavioralModel } from '@/lib/services/behavioralModels';
import type { BehavioralModel } from '@/types';
import {
  ArrowLeft,
  Clock,
  RotateCcw,
  MousePointer,
  ArrowDown,
  ClipboardX,
  Monitor,
  Brain,
  AlertTriangle,
  CheckCircle,
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
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
} from 'recharts';
import { Badge } from '@/components/ui/Badge';
import { Card, CardHeader } from '@/components/ui/Card';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { ChartContainer } from '@/components/ui/ChartContainer';
import { mockStudents } from '@/data/mockStudents';
import { mockDeviationHistory } from '@/data/mockFeatures';
import { getSessionsByStudentId } from '@/data/mockSessions';
import { getAlertsByStudent } from '@/data/mockAlerts';
import { formatDate, formatModelStatus, formatRelativeTime, formatConfidence } from '@/lib/formatters';
import type { ReviewStatus, ModelStatus } from '@/types';

const featureIcons: Record<string, React.ReactNode> = {
  responseTime: <Clock size={16} />,
  revisionCount: <RotateCcw size={16} />,
  pointerMovement: <MousePointer size={16} />,
  scrollDistance: <ArrowDown size={16} />,
  pasteDetected: <ClipboardX size={16} />,
};

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name: string }>; label?: string }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-surface-700 border border-border rounded-lg px-3 py-2 shadow-lg text-xs">
        <p className="text-text-muted mb-1">{label}</p>
        {payload.map((p) => (
          <p key={p.name} className="text-text-primary font-medium">{p.name}: {p.value.toFixed(1)}</p>
        ))}
      </div>
    );
  }
  return null;
};

export default function StudentProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const student = mockStudents.find((s) => s.id === id);
  if (!student) notFound();

  const [model, setModel] = useState<BehavioralModel | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    getBehavioralModel(id, 'desktop')
      .then((data) => {
        if (active) {
          setModel(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [id]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
      </div>
    );
  }
  const sessions = getSessionsByStudentId(id);
  const alerts = getAlertsByStudent(id);
  const deviationHistory = mockDeviationHistory[id] ?? [];
  const isColdStart = student.modelStatus === 'cold_start';

  // Radar chart data
  const radarData = model?.expectations.map((exp) => ({
    feature: exp.label.split(' ')[0],
    uncertainty: Math.round((1 - (model.uncertainties.find((u) => u.feature === exp.feature)?.uncertainty ?? 0)) * 100),
  })) ?? [];

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Back + header */}
      <div className="flex items-start gap-4">
        <Link
          href="/instructor/students"
          className="mt-1 p-2 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-700 transition-colors flex-shrink-0"
          aria-label="Back to students"
        >
          <ArrowLeft size={16} />
        </Link>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h2 className="text-lg font-semibold text-text-primary">{student.name}</h2>
            <Badge variant={student.reviewStatus as ReviewStatus} dot>
              {student.reviewStatus === 'review_required' ? 'Review Required' : student.reviewStatus.charAt(0).toUpperCase() + student.reviewStatus.slice(1)}
            </Badge>
          </div>
          <p className="text-sm text-text-muted">
            {student.studentId} · {student.department} · Enrolled {student.enrollmentYear}
          </p>
        </div>
      </div>

      {/* Cold start banner */}
      {isColdStart && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/8 border border-amber-500/20">
          <AlertTriangle size={16} className="text-amber-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-amber-400">Personalization Status: Cold Start</p>
            <p className="text-xs text-text-secondary mt-0.5">
              {model?.sessionCount ?? 0} of {model?.minimumSessionsRequired ?? 10} required sessions collected.
              Behavioral analysis is currently limited — flags are discounted until the model has sufficient history.
            </p>
          </div>
        </div>
      )}

      {/* Top row: model status + feature cards */}
      <div className="grid md:grid-cols-4 gap-4">
        {/* Model summary */}
        <Card className="md:col-span-1">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-lg bg-indigo-600/15 flex items-center justify-center">
              <Brain size={15} className="text-indigo-400" />
            </div>
            <span className="text-xs font-semibold text-text-primary uppercase tracking-wider">Personalized Model</span>
          </div>
          <div className="space-y-3">
            <div>
              <p className="text-xs text-text-muted">Status</p>
              <Badge variant={student.modelStatus as ModelStatus} dot className="mt-1">
                {formatModelStatus(student.modelStatus)}
              </Badge>
            </div>
            <div>
              <p className="text-xs text-text-muted">Confidence</p>
              <p className="text-xl font-bold text-text-primary tabular-nums mt-1">
                {formatConfidence(student.modelConfidence)}
              </p>
              <ProgressBar
                value={student.modelConfidence}
                colorThresholds={{ low: 70, high: 90 }}
                size="xs"
                className="mt-2"
              />
            </div>
            <div>
              <p className="text-xs text-text-muted">Sessions</p>
              <p className="text-sm font-semibold text-text-primary mt-1">
                {student.sessionCount}
                {isColdStart && (
                  <span className="text-xs text-text-muted font-normal ml-1">
                    / {model?.minimumSessionsRequired ?? 10} min
                  </span>
                )}
              </p>
              {isColdStart && (
                <ProgressBar
                  value={student.sessionCount}
                  max={model?.minimumSessionsRequired ?? 10}
                  color="amber"
                  size="xs"
                  className="mt-2"
                />
              )}
            </div>
            <div>
              <p className="text-xs text-text-muted">Primary Device</p>
              <div className="flex items-center gap-1.5 mt-1">
                <Monitor size={13} className="text-text-muted" />
                <span className="text-sm text-text-primary capitalize">{student.deviceType}</span>
              </div>
            </div>
            <div>
              <p className="text-xs text-text-muted">Last Activity</p>
              <p className="text-sm text-text-secondary mt-1">{formatRelativeTime(student.lastActivity)}</p>
            </div>
          </div>
        </Card>

        {/* Feature expectation cards */}
        <div className="md:col-span-3 grid grid-cols-2 sm:grid-cols-3 gap-3">
          {model?.expectations.map((exp) => (
            <Card key={exp.feature} padding="sm">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-indigo-400">{featureIcons[exp.feature]}</span>
                <span className="text-xs font-medium text-text-secondary">{exp.label}</span>
              </div>
              <p className="text-lg font-bold text-text-primary tabular-nums">
                {exp.feature === 'responseTime'
                  ? `${(exp.mean / 1000).toFixed(1)}s`
                  : exp.feature === 'pasteDetected'
                  ? `${exp.mean}%`
                  : exp.feature === 'pointerMovement' || exp.feature === 'scrollDistance'
                  ? `${exp.mean.toLocaleString()} px`
                  : exp.mean.toFixed(1)}
              </p>
              <p className="text-[10px] text-text-muted mt-0.5">Expected mean</p>
              <div className="mt-2 pt-2 border-t border-border">
                <p className="text-[10px] text-text-muted">
                  ±{exp.feature === 'responseTime'
                    ? `${(exp.stdDev / 1000).toFixed(1)}s`
                    : exp.stdDev.toFixed(1)} std dev
                </p>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Charts row */}
      <div className="grid lg:grid-cols-2 gap-5">
        {/* Deviation over time */}
        <ChartContainer
          title="Behavioral Deviation Over Time"
          subtitle="Score per session vs. personalized threshold"
          height={240}
          empty={deviationHistory.length === 0}
          emptyMessage="Insufficient session history for trend chart"
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={deviationHistory} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine y={deviationHistory[0]?.threshold ?? 35} stroke="rgba(251,191,36,0.5)" strokeDasharray="4 4" />
              <Line
                type="monotone"
                dataKey="deviationScore"
                name="Deviation"
                stroke="#6366f1"
                strokeWidth={2}
                dot={(props) => {
                  const d = props.payload as { reviewRequired: boolean };
                  return (
                    <circle
                      key={`dot-${props.index}`}
                      cx={props.cx}
                      cy={props.cy}
                      r={d.reviewRequired ? 5 : 3}
                      fill={d.reviewRequired ? '#fb7185' : '#6366f1'}
                      stroke={d.reviewRequired ? '#fb7185' : '#6366f1'}
                    />
                  );
                }}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartContainer>

        {/* Confidence radar */}
        <ChartContainer
          title="Feature Confidence"
          subtitle="Model certainty per behavioral feature"
          height={240}
          empty={radarData.length === 0}
        >
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={radarData}>
              <PolarGrid stroke="rgba(255,255,255,0.06)" />
              <PolarAngleAxis dataKey="feature" tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <Radar
                name="Confidence"
                dataKey="uncertainty"
                stroke="#6366f1"
                fill="#6366f1"
                fillOpacity={0.15}
                strokeWidth={2}
              />
            </RadarChart>
          </ResponsiveContainer>
        </ChartContainer>
      </div>

      {/* Session history */}
      <Card
        header={<CardHeader title="Session History" subtitle={`${sessions.length} sessions recorded`} />}
        padding="none"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-900/40">
                <th className="text-left px-5 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">Exam</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider hidden md:table-cell">Type</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">Deviation</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider hidden lg:table-cell">Threshold</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider hidden md:table-cell">Date</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sessions.map((session) => (
                <tr key={session.id} className="hover:bg-surface-700/40 transition-colors group">
                  <td className="px-5 py-3.5">
                    <p className="font-medium text-text-primary">{session.examName}</p>
                    <p className="text-xs text-text-muted mt-0.5">{session.examCode}</p>
                  </td>
                  <td className="px-4 py-3.5 hidden md:table-cell">
                    <Badge variant={session.type === 'graded_examination' ? 'graded' : 'low_stakes'} size="sm">
                      {session.type === 'graded_examination' ? 'Graded' : 'Low Stakes'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <span
                      className={[
                        'text-sm font-semibold tabular-nums',
                        session.deviationScore > session.personalizedThreshold
                          ? 'text-rose-400'
                          : session.deviationScore > session.personalizedThreshold * 0.8
                          ? 'text-amber-400'
                          : 'text-emerald-400',
                      ].join(' ')}
                    >
                      {session.deviationScore.toFixed(1)}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-right hidden lg:table-cell">
                    <span className="text-xs text-text-muted tabular-nums">{session.personalizedThreshold.toFixed(1)}</span>
                  </td>
                  <td className="px-4 py-3.5">
                    <Badge variant={session.reviewStatus as ReviewStatus} dot size="sm">
                      {session.reviewStatus === 'review_required' ? 'Review' : session.reviewStatus.charAt(0).toUpperCase() + session.reviewStatus.slice(1)}
                    </Badge>
                  </td>
                  <td className="px-4 py-3.5 hidden md:table-cell">
                    <span className="text-xs text-text-secondary">{formatDate(session.date)}</span>
                  </td>
                  <td className="px-4 py-3.5">
                    <Link
                      href={`/instructor/sessions/${session.id}`}
                      className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors opacity-0 group-hover:opacity-100 flex items-center gap-1"
                    >
                      View <ChevronRight size={11} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Alert timeline */}
      {alerts.length > 0 && (
        <Card header={<CardHeader title="Review Timeline" subtitle="Historical review activity" />} padding="sm">
          <div className="space-y-3">
            {alerts.map((alert) => (
              <div key={alert.id} className="flex items-start gap-3 p-3 rounded-lg bg-surface-700 border border-border">
                <div className={[
                  'w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5',
                  alert.status === 'verified' ? 'bg-sky-500/15 text-sky-400' :
                  alert.status === 'disputed' ? 'bg-rose-500/15 text-rose-400' :
                  'bg-amber-500/15 text-amber-400',
                ].join(' ')}>
                  {alert.status === 'verified' ? <CheckCircle size={13} /> : <AlertTriangle size={13} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-text-primary">{alert.examName}</p>
                    <Badge variant={alert.status as ReviewStatus} size="sm">
                      {alert.status === 'review_required' ? 'Review Required' : alert.status.charAt(0).toUpperCase() + alert.status.slice(1)}
                    </Badge>
                  </div>
                  <p className="text-xs text-text-muted mt-0.5">
                    Deviation: {alert.deviationScore.toFixed(1)} vs threshold {alert.personalizedThreshold.toFixed(1)}
                    {alert.reviewedBy && ` · Reviewed by ${alert.reviewedBy}`}
                  </p>
                  {alert.notes && (
                    <p className="text-xs text-text-secondary mt-1 italic">&ldquo;{alert.notes}&rdquo;</p>
                  )}
                </div>
                <span className="text-[10px] text-text-muted flex-shrink-0">{formatDate(alert.createdAt)}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
