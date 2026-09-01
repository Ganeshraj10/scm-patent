'use client';

import React, { useState, useMemo } from 'react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import {
  getStudentBehaviorTrends,
  getStudentDeviceHistory,
  getStudentTimeOfDayHistory,
  getStudentCourseworkSummary,
} from '@/lib/services/studentHistoryService';
import { getStudentBaseline } from '@/lib/services/personalizedBaselineService';
import { StudentBehaviorCharts } from '@/components/integrity/StudentBehaviorCharts';
import { PersonalizedBaselineCard } from '@/components/integrity/PersonalizedBaselineCard';
import { StudentDeviceHistory } from '@/components/integrity/StudentDeviceHistory';
import { StudentTimeOfDay } from '@/components/integrity/StudentTimeOfDay';
import {
  Brain,
  ShieldCheck,
  Clock,
  Activity,
  MousePointer2,
  Scroll,
  Info,
  Sparkles,
  Layers,
} from 'lucide-react';

export default function StudentBehaviorProfilePage() {
  const [studentId, setStudentId] = useState<string>('S001');

  const baseline = useMemo(() => getStudentBaseline(studentId), [studentId]);
  const summary = useMemo(() => getStudentCourseworkSummary(studentId), [studentId]);
  const trends = useMemo(() => getStudentBehaviorTrends(studentId), [studentId]);
  const devices = useMemo(() => getStudentDeviceHistory(studentId), [studentId]);
  const timeOfDayStats = useMemo(() => getStudentTimeOfDayHistory(studentId), [studentId]);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-text-primary">My Behavioral Baseline & Profile</h2>
            <Badge variant="active" size="sm">
              Student ID: {studentId}
            </Badge>
          </div>
          <p className="text-xs text-text-muted mt-0.5">
            Your personalized behavioral model learned exclusively from your own low-stakes coursework
          </p>
        </div>

        {/* Demo Switcher */}
        <div className="flex items-center gap-1.5 bg-surface-800 p-1.5 rounded-xl border border-border text-xs">
          <span className="text-[11px] text-text-muted px-2">Student:</span>
          {['S001', 'S002', 'S003', 'S004'].map((sId) => (
            <button
              key={sId}
              onClick={() => setStudentId(sId)}
              className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all ${
                studentId === sId
                  ? 'bg-sky-500 text-navy-950 shadow-md shadow-sky-500/30'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              {sId}
            </button>
          ))}
        </div>
      </div>

      {/* Patent Behavioral Principle Callout */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-indigo-950/40 via-surface-800 to-surface-800 border border-indigo-500/20 flex items-start gap-3.5 shadow-lg">
        <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 shrink-0 mt-0.5">
          <Brain size={20} />
        </div>
        <div className="space-y-1 text-xs text-text-secondary leading-relaxed">
          <div className="flex items-center gap-2">
            <span className="font-bold text-text-primary">Individual Longitudinal Foundation</span>
            <span className="px-2 py-0.2 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              Patent Principle
            </span>
          </div>
          <p className="text-[11px] text-text-muted">
            The platform learns your normal interaction habits exclusively from your own previous low-stakes coursework.
            We never compare your behavior against a universal population average. Each metric below reflects your own historical progression.
          </p>
        </div>
      </div>

      {/* Personalized Baseline Card with 9 Modeled Features & Uncertainty */}
      <PersonalizedBaselineCard baseline={baseline} />

      {/* 4 Longitudinal Behavioral Trend Charts with Baseline Overlays */}
      <StudentBehaviorCharts trends={trends} studentId={studentId} showBaselineOverlay={true} />

      {/* Device History & Diurnal Activity Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <StudentDeviceHistory devices={devices} />
        <StudentTimeOfDay stats={timeOfDayStats} />
      </div>
    </div>
  );
}
