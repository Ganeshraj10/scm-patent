'use client';

import { useState } from 'react';
import {
  Clock,
  RotateCcw,
  MousePointer,
  ArrowDown,
  Monitor,
  Smartphone,
  Tablet,
  CheckCircle,
  Brain,
  TrendingUp,
  Activity,
  Layers,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Area,
  AreaChart,
  BarChart,
  Bar,
  Cell,
} from 'recharts';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { PersonalizedBaseline } from '@/lib/services/behavioralModel';
import { PatentRecord } from '@/lib/services/datasetService';
import { ColdStartStatus } from './ColdStartStatus';

interface BehavioralBaselineProps {
  baseline: PersonalizedBaseline;
  records?: PatentRecord[];
  latestRiskScore?: number;
  latestRiskLevel?: 'Low' | 'Medium' | 'High';
}

const CustomChartTooltip = ({
  active,
  payload,
  label,
  unit,
}: {
  active?: boolean;
  payload?: Array<{ value: number; name?: string; color?: string }>;
  label?: string;
  unit?: string;
}) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-surface-700 border border-border rounded-lg px-3 py-2 shadow-xl text-xs">
        <p className="text-text-muted font-medium mb-1">{label}</p>
        {payload.map((p, idx) => (
          <p key={idx} className="font-semibold text-text-primary">
            {p.name || 'Value'}: {typeof p.value === 'number' ? p.value.toFixed(1) : p.value} {unit || ''}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export function BehavioralBaseline({
  baseline,
  records = baseline.trainingRecords,
  latestRiskScore,
  latestRiskLevel,
}: BehavioralBaselineProps) {
  const [activeChart, setActiveChart] = useState<'responseTime' | 'revisions' | 'pointerSpeed' | 'scroll'>('responseTime');

  const historyData = records.map((r, i) => ({
    session: r.session_id.replace(`${r.student_id}_`, ''),
    fullSessionId: r.session_id,
    type: r.session_type,
    date: r.timestamp.split(' ')[0],
    responseTime: r.response_time_sec,
    revisions: r.answer_revision_count,
    pointerSpeed: r.pointer_avg_speed_px_s,
    scroll: r.scroll_distance_px,
    device: r.device_type,
    difficulty: r.question_difficulty,
  }));

  const maturityBadgeVariant =
    baseline.maturityStatus === 'mature'
      ? 'active'
      : baseline.maturityStatus === 'maturing'
      ? 'graded'
      : 'cold_start';

  return (
    <div className="space-y-6">
      {/* Student Summary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <div className="p-3.5 rounded-xl bg-surface-800 border border-border">
          <span className="text-[11px] text-text-muted font-medium uppercase tracking-wider block">Student</span>
          <div className="flex items-center gap-2 mt-1">
            <div className="w-6 h-6 rounded-md bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-xs">
              {baseline.studentId.replace('S', '')}
            </div>
            <span className="text-base font-bold text-text-primary">{baseline.studentId}</span>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-surface-800 border border-border">
          <span className="text-[11px] text-text-muted font-medium uppercase tracking-wider block">History</span>
          <div className="flex items-center gap-1.5 mt-1">
            <span className="text-base font-bold text-text-primary">{baseline.sessionCount}</span>
            <span className="text-xs text-text-muted">practice sessions</span>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-surface-800 border border-border">
          <span className="text-[11px] text-text-muted font-medium uppercase tracking-wider block">Baseline Status</span>
          <div className="mt-1">
            <Badge variant={maturityBadgeVariant}>
              {baseline.maturityStatus === 'mature' ? 'Mature Baseline' : baseline.maturityStatus === 'maturing' ? 'Maturing' : 'Cold Start'}
            </Badge>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-surface-800 border border-border">
          <span className="text-[11px] text-text-muted font-medium uppercase tracking-wider block">Avg Response</span>
          <div className="flex items-center gap-1 mt-1 text-indigo-400">
            <Clock size={14} />
            <span className="text-base font-bold tabular-nums">{baseline.responseTime.mean.toFixed(1)}s</span>
            <span className="text-[10px] text-text-muted">±{baseline.responseTime.stdDev.toFixed(1)}s</span>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-surface-800 border border-border">
          <span className="text-[11px] text-text-muted font-medium uppercase tracking-wider block">Avg Revisions</span>
          <div className="flex items-center gap-1 mt-1 text-amber-400">
            <RotateCcw size={14} />
            <span className="text-base font-bold tabular-nums">{baseline.revisionCount.mean.toFixed(1)}</span>
            <span className="text-[10px] text-text-muted">per q</span>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-surface-800 border border-border">
          <span className="text-[11px] text-text-muted font-medium uppercase tracking-wider block">Normal Devices</span>
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            {baseline.historicalDevices.map((d) => (
              <span key={d} className="px-1.5 py-0.5 rounded text-[10px] bg-surface-700 text-text-secondary border border-border">
                {d.replace('web_', '')}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Cold Start Notice if applicable */}
      {baseline.isColdStart && (
        <ColdStartStatus sessionCount={baseline.sessionCount} confidence={baseline.confidence} studentId={baseline.studentId} />
      )}

      {/* Longitudinal Visualizer Tabs */}
      <Card>
        <CardHeader
          title="Personalized Longitudinal Behavioral Baselines"
          subtitle={`Tracking student ${baseline.studentId} across historical low-stakes sessions with expected tolerance bounds`}
          badge={
            <div className="flex items-center gap-1.5 bg-surface-700 p-1 rounded-lg border border-border">
              <button
                onClick={() => setActiveChart('responseTime')}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                  activeChart === 'responseTime'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-text-muted hover:text-text-primary'
                }`}
              >
                Response Time
              </button>
              <button
                onClick={() => setActiveChart('revisions')}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                  activeChart === 'revisions'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-text-muted hover:text-text-primary'
                }`}
              >
                Revisions
              </button>
              <button
                onClick={() => setActiveChart('pointerSpeed')}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                  activeChart === 'pointerSpeed'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-text-muted hover:text-text-primary'
                }`}
              >
                Pointer Speed
              </button>
              <button
                onClick={() => setActiveChart('scroll')}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                  activeChart === 'scroll'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-text-muted hover:text-text-primary'
                }`}
              >
                Scroll Activity
              </button>
            </div>
          }
        />

        <div className="h-64 mt-4">
          <ResponsiveContainer width="100%" height="100%">
            {activeChart === 'responseTime' ? (
              <AreaChart data={historyData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorTime" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="session" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} unit="s" />
                <Tooltip content={<CustomChartTooltip unit="s" />} />
                <ReferenceLine
                  y={baseline.responseTime.mean}
                  stroke="#818cf8"
                  strokeDasharray="4 4"
                  label={{
                    value: `Baseline Mean: ${baseline.responseTime.mean.toFixed(1)}s`,
                    fill: '#818cf8',
                    fontSize: 11,
                    position: 'insideTopRight',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="responseTime"
                  name="Response Time"
                  stroke="#6366f1"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#colorTime)"
                />
              </AreaChart>
            ) : activeChart === 'revisions' ? (
              <BarChart data={historyData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                <XAxis dataKey="session" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
                <Tooltip content={<CustomChartTooltip unit="revisions" />} />
                <ReferenceLine
                  y={baseline.revisionCount.mean}
                  stroke="#f59e0b"
                  strokeDasharray="4 4"
                  label={{
                    value: `Avg Revisions: ${baseline.revisionCount.mean.toFixed(1)}`,
                    fill: '#f59e0b',
                    fontSize: 11,
                    position: 'insideTopRight',
                  }}
                />
                <Bar dataKey="revisions" name="Revisions" fill="#f59e0b" radius={[4, 4, 0, 0]}>
                  {historyData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.revisions > baseline.revisionCount.mean + 1.5 ? '#f43f5e' : '#f59e0b'}
                    />
                  ))}
                </Bar>
              </BarChart>
            ) : activeChart === 'pointerSpeed' ? (
              <AreaChart data={historyData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorSpeed" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="session" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} unit=" px/s" />
                <Tooltip content={<CustomChartTooltip unit="px/s" />} />
                <ReferenceLine
                  y={baseline.pointerSpeed.mean}
                  stroke="#22d3ee"
                  strokeDasharray="4 4"
                  label={{
                    value: `Baseline Speed: ${baseline.pointerSpeed.mean.toFixed(0)} px/s`,
                    fill: '#22d3ee',
                    fontSize: 11,
                    position: 'insideTopRight',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="pointerSpeed"
                  name="Pointer Speed"
                  stroke="#06b6d4"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#colorSpeed)"
                />
              </AreaChart>
            ) : (
              <AreaChart data={historyData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorScroll" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="session" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} unit="px" />
                <Tooltip content={<CustomChartTooltip unit="px" />} />
                <ReferenceLine
                  y={baseline.scrollDistance.mean}
                  stroke="#34d399"
                  strokeDasharray="4 4"
                  label={{
                    value: `Baseline Scroll: ${baseline.scrollDistance.mean.toFixed(0)} px`,
                    fill: '#34d399',
                    fontSize: 11,
                    position: 'insideTopRight',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="scroll"
                  name="Scroll Activity"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#colorScroll)"
                />
              </AreaChart>
            )}
          </ResponsiveContainer>
        </div>

        <div className="flex items-center justify-between text-xs text-text-muted mt-3 pt-3 border-t border-border flex-wrap gap-2">
          <span>Tolerance band: ±1.8σ personal standard deviation</span>
          <span>Chronological order (earliest → most recent practice)</span>
        </div>
      </Card>
    </div>
  );
}
