'use client';

import Link from 'next/link';
import {
  Users,
  ClipboardList,
  AlertTriangle,
  TrendingUp,
  ArrowRight,
  Clock,
  Monitor,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from 'recharts';
import { StatCard } from '@/components/ui/StatCard';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { ChartContainer } from '@/components/ui/ChartContainer';
import { mockStudents } from '@/data/mockStudents';
import { mockSessions } from '@/data/mockSessions';
import { mockAlerts } from '@/data/mockAlerts';
import { formatDate, formatRelativeTime, formatDeviation } from '@/lib/formatters';
import type { ReviewStatus, AlertSeverity } from '@/types';

// ─── Deviation distribution data ─────────────────────────────
const distributionData = [
  { range: '0–10', count: 3, label: '0–10' },
  { range: '10–20', count: 7, label: '10–20' },
  { range: '20–30', count: 5, label: '20–30' },
  { range: '30–40', count: 2, label: '30–40' },
  { range: '40–50', count: 1, label: '40–50' },
  { range: '50–60', count: 1, label: '50–60' },
  { range: '60–70', count: 2, label: '60–70' },
  { range: '70–80', count: 1, label: '70–80' },
];

function getBarColor(range: string): string {
  const val = parseInt(range.split('–')[0]);
  if (val < 30) return '#34d399'; // emerald
  if (val < 50) return '#fbbf24'; // amber
  return '#fb7185'; // rose
}

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-surface-700 border border-border rounded-lg px-3 py-2 shadow-lg">
        <p className="text-xs text-text-muted">Score {label}</p>
        <p className="text-sm font-semibold text-text-primary">{payload[0].value} sessions</p>
      </div>
    );
  }
  return null;
};

export default function DashboardPage() {
  const reviewRequired = mockAlerts.filter((a) => a.status === 'review_required').length;
  const activeExams = mockSessions.filter((s) => s.type === 'graded_examination').length;
  const avgDeviation =
    mockSessions.reduce((sum, s) => sum + s.deviationScore, 0) / mockSessions.length;

  const recentAlerts = mockAlerts.slice(0, 4);
  const recentSessions = mockSessions
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5);

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Prototype / Synthetic Dataset Disclaimer Banner */}
      <div className="rounded-2xl bg-gradient-to-r from-indigo-950/60 via-surface-800 to-surface-800 border border-indigo-500/20 p-4 sm:p-5 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              Prototype / Synthetic Dataset
            </span>
            <span className="text-xs text-text-muted">Patent Behavioral Integrity Model (120 Records)</span>
          </div>
          <p className="text-xs text-text-secondary mt-1.5 leading-relaxed">
            Longitudinal baseline integrity evaluation active. <em>Disclaimer: Prototype using synthetic research data. Behavioral deviation is not proof of misconduct.</em>
          </p>
        </div>
        <Link
          href="/instructor/analysis"
          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-900/30 transition-all flex-shrink-0"
        >
          Open Integrity Workbench
          <ArrowRight size={14} />
        </Link>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Students"
          value={mockStudents.length}
          subtitle="Enrolled in system"
          icon={<Users size={18} />}
          accent="indigo"
          trend={{ value: 12, label: 'this semester' }}
        />
        <StatCard
          title="Active Examinations"
          value={activeExams}
          subtitle="Graded sessions"
          icon={<ClipboardList size={18} />}
          accent="sky"
        />
        <StatCard
          title="Review Required"
          value={reviewRequired}
          subtitle="Pending human review"
          icon={<AlertTriangle size={18} />}
          accent="amber"
        />
        <StatCard
          title="Avg Deviation Score"
          value={avgDeviation.toFixed(1)}
          subtitle="Across all sessions"
          icon={<TrendingUp size={18} />}
          accent="emerald"
          trend={{ value: -3, label: 'vs last period' }}
        />
      </div>

      {/* Charts row */}
      <div className="grid lg:grid-cols-3 gap-5">
        {/* Distribution chart */}
        <div className="lg:col-span-2">
          <ChartContainer
            title="Behavioral Deviation Distribution"
            subtitle="Score distribution across all examination sessions"
            height={280}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={distributionData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                <XAxis
                  dataKey="range"
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine
                  x="30–40"
                  stroke="rgba(251,191,36,0.4)"
                  strokeDasharray="3 3"
                  label={{ value: 'Threshold ~35', position: 'top', fill: '#fbbf24', fontSize: 10 }}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {distributionData.map((entry, idx) => (
                    <Cell key={idx} fill={getBarColor(entry.range)} fillOpacity={0.85} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartContainer>
        </div>

        {/* Model health */}
        <Card
          header={<CardHeader title="Model Health" subtitle="Student personalization status" />}
          padding="sm"
        >
          <div className="space-y-3">
            {[
              {
                label: 'Active Models',
                count: mockStudents.filter((s) => s.modelStatus === 'active').length,
                total: mockStudents.length,
                color: 'bg-emerald-500',
              },
              {
                label: 'Cold Start',
                count: mockStudents.filter((s) => s.modelStatus === 'cold_start').length,
                total: mockStudents.length,
                color: 'bg-amber-500',
              },
              {
                label: 'Insufficient Data',
                count: mockStudents.filter((s) => s.modelStatus === 'insufficient_data').length,
                total: mockStudents.length,
                color: 'bg-rose-500',
              },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${item.color}`} />
                  <span className="text-xs text-text-secondary truncate">{item.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-text-primary tabular-nums">{item.count}</span>
                  <div className="w-16 h-1.5 bg-surface-600 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${item.color}`}
                      style={{ width: `${(item.count / item.total) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
            <div className="pt-3 border-t border-border">
              <Link
                href="/instructor/students"
                className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1"
              >
                View all students <ArrowRight size={11} />
              </Link>
            </div>
          </div>
        </Card>
      </div>

      {/* Bottom row */}
      <div className="grid lg:grid-cols-2 gap-5">
        {/* Recent Review Queue */}
        <Card
          header={
            <CardHeader
              title="Recent Review Queue"
              subtitle="Sessions requiring human review"
              action={
                <Link
                  href="/instructor/alerts"
                  className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1"
                >
                  View all <ArrowRight size={11} />
                </Link>
              }
            />
          }
          padding="none"
        >
          <div className="divide-y divide-border">
            {recentAlerts.map((alert) => (
              <div key={alert.id} className="px-5 py-3.5 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-primary truncate">
                    {alert.studentName}
                  </p>
                  <p className="text-xs text-text-muted truncate mt-0.5">
                    {alert.examName}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-bold tabular-nums" style={{ color: alert.deviationScore > alert.personalizedThreshold ? '#fb7185' : '#34d399' }}>
                    {formatDeviation(alert.deviationScore)}
                  </p>
                  <p className="text-[10px] text-text-muted">score</p>
                </div>
                <Badge
                  variant={alert.status as ReviewStatus}
                  dot
                  size="sm"
                >
                  {alert.status === 'review_required' ? 'Review' : alert.status.charAt(0).toUpperCase() + alert.status.slice(1)}
                </Badge>
              </div>
            ))}
          </div>
        </Card>

        {/* Recent session activity */}
        <Card
          header={
            <CardHeader
              title="Recent Examination Activity"
              subtitle="Latest sessions across all students"
              action={
                <Link
                  href="/instructor/sessions"
                  className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1"
                >
                  View all <ArrowRight size={11} />
                </Link>
              }
            />
          }
          padding="none"
        >
          <div className="divide-y divide-border">
            {recentSessions.map((session) => (
              <Link
                key={session.id}
                href={`/instructor/sessions/${session.id}`}
                className="px-5 py-3.5 flex items-center gap-3 hover:bg-surface-700 transition-colors group"
              >
                <div className="w-8 h-8 rounded-lg bg-surface-600 border border-border flex items-center justify-center flex-shrink-0">
                  <Monitor size={14} className="text-text-muted" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-primary truncate group-hover:text-indigo-400 transition-colors">
                    {session.studentName}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <Clock size={10} className="text-text-muted flex-shrink-0" />
                    <p className="text-xs text-text-muted truncate">
                      {formatRelativeTime(session.date)} · {session.examName}
                    </p>
                  </div>
                </div>
                <Badge
                  variant={session.reviewStatus as ReviewStatus}
                  size="sm"
                  dot
                >
                  {session.deviationScore.toFixed(0)}
                </Badge>
              </Link>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
