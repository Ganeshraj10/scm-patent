'use client';

import React, { useState, useMemo } from 'react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { BehaviorTrendPoint } from '@/lib/services/studentHistoryService';
import { getStudentBaseline } from '@/lib/services/personalizedBaselineService';
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
  ReferenceLine,
} from 'recharts';
import { Clock, MousePointer2, RefreshCw, Scroll, Activity, Sparkles } from 'lucide-react';

interface StudentBehaviorChartsProps {
  trends: BehaviorTrendPoint[];
  studentId: string;
  showBaselineOverlay?: boolean;
}

export function StudentBehaviorCharts({
  trends,
  studentId,
  showBaselineOverlay = true,
}: StudentBehaviorChartsProps) {
  const [activeTab, setActiveTab] = useState<'all' | 'response' | 'revisions' | 'pointer' | 'scroll'>('all');
  const [showBaseline, setShowBaseline] = useState<boolean>(showBaselineOverlay);

  const baseline = useMemo(() => getStudentBaseline(studentId), [studentId]);

  if (!trends || trends.length === 0) {
    return (
      <Card padding="md">
        <div className="p-8 text-center text-text-muted text-xs">
          No longitudinal behavioral data recorded yet for student {studentId}. Complete practice coursework to see your behavior trends over time.
        </div>
      </Card>
    );
  }

  // Custom tooltips
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data: BehaviorTrendPoint = payload[0].payload;
      return (
        <div className="bg-surface-800 border border-border p-2.5 rounded-lg shadow-xl text-xs space-y-1">
          <div className="flex items-center justify-between gap-3 text-text-muted text-[10px]">
            <span>{data.date}</span>
            <span className={data.sessionType === 'low_stakes' ? 'text-sky-400' : 'text-indigo-400'}>
              {data.sessionTypeLabel}
            </span>
          </div>
          <p className="font-bold text-text-primary">
            Question: <span className="font-mono text-indigo-300">{data.questionId}</span>
          </p>
          <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px] pt-1 border-t border-border/60">
            <span className="text-text-muted">Response Time:</span>
            <span className="text-emerald-400 font-mono text-right">{data.responseTimeSec}s</span>
            <span className="text-text-muted">Revisions:</span>
            <span className="text-indigo-400 font-mono text-right">{data.answerRevisionCount}</span>
            <span className="text-text-muted">Pointer Speed:</span>
            <span className="text-amber-400 font-mono text-right">{data.pointerSpeedPxS} px/s</span>
            <span className="text-text-muted">Scroll Distance:</span>
            <span className="text-sky-400 font-mono text-right">{data.scrollDistancePx} px</span>
          </div>
        </div>
      );
    }
    return null;
  };

  const expResp = baseline?.overallFeatures?.response_time_sec?.expectedValue;
  const expRev = baseline?.overallFeatures?.answer_revision_count?.expectedValue;
  const expSpeed = baseline?.overallFeatures?.pointer_avg_speed_px_s?.expectedValue;
  const expScroll = baseline?.overallFeatures?.scroll_distance_px?.expectedValue;

  return (
    <div className="space-y-4">
      {/* Header with metric tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-text-primary flex items-center gap-2">
              <Activity size={18} className="text-indigo-400" />
              Behavior Over Time & Personalized Baseline
            </h3>
            <Badge variant="normal" size="sm">
              {trends.length} Data Points
            </Badge>
          </div>
          <p className="text-xs text-text-muted mt-0.5">
            Your individual longitudinal interaction trends plotted against your personalized low-stakes baseline
          </p>
        </div>

        {/* Tab Controls & Baseline Overlay Toggle */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setShowBaseline(!showBaseline)}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all flex items-center gap-1.5 ${
              showBaseline
                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                : 'bg-surface-700 text-text-muted border-border hover:text-text-primary'
            }`}
          >
            <Sparkles size={13} />
            {showBaseline ? 'Baseline Overlay Active' : 'Show Expected Baseline'}
          </button>

          <div className="flex items-center gap-1 bg-surface-800 p-1 rounded-xl border border-border text-xs">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                activeTab === 'all'
                  ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/40'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              All Charts
            </button>
            <button
              onClick={() => setActiveTab('response')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                activeTab === 'response'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              Response Time
            </button>
            <button
              onClick={() => setActiveTab('revisions')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                activeTab === 'revisions'
                  ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              Revisions
            </button>
            <button
              onClick={() => setActiveTab('pointer')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                activeTab === 'pointer'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              Pointer Speed
            </button>
            <button
              onClick={() => setActiveTab('scroll')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                activeTab === 'scroll'
                  ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              Scroll
            </button>
          </div>
        </div>
      </div>

      {/* Grid of 4 Charts with Personalized Baseline Overlay */}
      <div className={`grid gap-4 ${activeTab === 'all' ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}>
        {/* 1. Response Time Chart */}
        {(activeTab === 'all' || activeTab === 'response') && (
          <Card>
            <CardHeader
              title="1. Response Time Trend"
              subtitle="Seconds spent per question vs. your personalized expected baseline"
              badge={<Badge variant="active">Time (s)</Badge>}
            />
            <div className="h-56 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a334a" vertical={false} />
                  <XAxis dataKey="index" tick={{ fill: '#8b9bb4', fontSize: 10 }} tickLine={false} />
                  <YAxis tick={{ fill: '#8b9bb4', fontSize: 10 }} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  {showBaseline && expResp !== undefined && (
                    <ReferenceLine
                      y={expResp}
                      stroke="#10b981"
                      strokeDasharray="4 4"
                      strokeWidth={2}
                      label={{
                        value: `Expected Baseline (${expResp}s)`,
                        fill: '#34d399',
                        fontSize: 9,
                        position: 'insideTopRight',
                      }}
                    />
                  )}
                  <Line
                    type="monotone"
                    dataKey="responseTimeSec"
                    stroke="#10b981"
                    strokeWidth={2.5}
                    dot={{ fill: '#10b981', r: 3 }}
                    activeDot={{ r: 5, fill: '#34d399' }}
                    name="Response Time (s)"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
        )}

        {/* 2. Answer Revision Count Chart */}
        {(activeTab === 'all' || activeTab === 'revisions') && (
          <Card>
            <CardHeader
              title="2. Answer Revision Count"
              subtitle="Number of changes made before final submission vs expected baseline"
              badge={<Badge variant="active">Revisions</Badge>}
            />
            <div className="h-56 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a334a" vertical={false} />
                  <XAxis dataKey="index" tick={{ fill: '#8b9bb4', fontSize: 10 }} tickLine={false} />
                  <YAxis tick={{ fill: '#8b9bb4', fontSize: 10 }} tickLine={false} allowDecimals={false} />
                  <Tooltip content={<CustomTooltip />} />
                  {showBaseline && expRev !== undefined && (
                    <ReferenceLine
                      y={expRev}
                      stroke="#818cf8"
                      strokeDasharray="4 4"
                      strokeWidth={2}
                      label={{
                        value: `Expected (${expRev})`,
                        fill: '#a5b4fc',
                        fontSize: 9,
                        position: 'insideTopRight',
                      }}
                    />
                  )}
                  <Bar dataKey="answerRevisionCount" fill="#6366f1" radius={[4, 4, 0, 0]} name="Revisions" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        )}

        {/* 3. Pointer Average Speed Chart */}
        {(activeTab === 'all' || activeTab === 'pointer') && (
          <Card>
            <CardHeader
              title="3. Pointer Movement Speed"
              subtitle="Average cursor velocity in px/s vs personalized expected speed"
              badge={<Badge variant="active">px / sec</Badge>}
            />
            <div className="h-56 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trends} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a334a" vertical={false} />
                  <XAxis dataKey="index" tick={{ fill: '#8b9bb4', fontSize: 10 }} tickLine={false} />
                  <YAxis tick={{ fill: '#8b9bb4', fontSize: 10 }} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  {showBaseline && expSpeed !== undefined && (
                    <ReferenceLine
                      y={expSpeed}
                      stroke="#f59e0b"
                      strokeDasharray="4 4"
                      strokeWidth={2}
                      label={{
                        value: `Expected (${expSpeed} px/s)`,
                        fill: '#fbbf24',
                        fontSize: 9,
                        position: 'insideTopRight',
                      }}
                    />
                  )}
                  <Line
                    type="monotone"
                    dataKey="pointerSpeedPxS"
                    stroke="#f59e0b"
                    strokeWidth={2.5}
                    dot={{ fill: '#f59e0b', r: 3 }}
                    activeDot={{ r: 5, fill: '#fbbf24' }}
                    name="Pointer Speed (px/s)"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
        )}

        {/* 4. Scroll Activity & Distance Chart */}
        {(activeTab === 'all' || activeTab === 'scroll') && (
          <Card>
            <CardHeader
              title="4. Scroll Activity & Distance"
              subtitle="Total vertical scroll traversal in px vs personalized expected scroll"
              badge={<Badge variant="active">Pixels</Badge>}
            />
            <div className="h-56 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trends} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a334a" vertical={false} />
                  <XAxis dataKey="index" tick={{ fill: '#8b9bb4', fontSize: 10 }} tickLine={false} />
                  <YAxis tick={{ fill: '#8b9bb4', fontSize: 10 }} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  {showBaseline && expScroll !== undefined && (
                    <ReferenceLine
                      y={expScroll}
                      stroke="#0284c7"
                      strokeDasharray="4 4"
                      strokeWidth={2}
                      label={{
                        value: `Expected (${expScroll} px)`,
                        fill: '#38bdf8',
                        fontSize: 9,
                        position: 'insideTopRight',
                      }}
                    />
                  )}
                  <Line
                    type="monotone"
                    dataKey="scrollDistancePx"
                    stroke="#0284c7"
                    strokeWidth={2.5}
                    dot={{ fill: '#0284c7', r: 3 }}
                    activeDot={{ r: 5, fill: '#38bdf8' }}
                    name="Scroll Distance (px)"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
