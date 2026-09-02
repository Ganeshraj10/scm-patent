'use client';

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { use, useEffect, useState, useMemo } from 'react';
import { getBehavioralModel } from '@/lib/services/behavioralModels';
import { getStudentBaseline } from '@/lib/services/personalizedBaselineService';
import { PersonalizedBaselineCard } from '@/components/integrity/PersonalizedBaselineCard';
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
  ShieldCheck,
  Info,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Card, CardHeader } from '@/components/ui/Card';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { mockStudents } from '@/data/mockStudents';
import { mockDeviationHistory } from '@/data/mockFeatures';
import { getDemoStudentProfile, isDemoStudent } from '@/lib/services/demoStudentService';
import { DemoStudentSelector } from '@/components/demo/DemoStudentSelector';
import { getSessionsByStudentId } from '@/data/mockSessions';
import { getAlertsByStudent } from '@/data/mockAlerts';
import { formatDate, formatModelStatus, formatRelativeTime, formatConfidence } from '@/lib/formatters';
import type { ReviewStatus, ModelStatus } from '@/types';

export default function StudentProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const demoProfile = getDemoStudentProfile(id);

  // Match by id or student identifier (e.g. S001, U2021034)
  const student = mockStudents.find((s) => s.id === id || s.studentId === id) || {
    id: id,
    studentId: id.startsWith('S0') ? id : 'S001',
    name: demoProfile ? demoProfile.name : (id.startsWith('S0') ? `Student ${id}` : 'Alex Chen'),
    department: 'Computer Science',
    enrollmentYear: 2023,
    modelStatus: 'active' as const,
    modelConfidence: 94,
    sessionCount: demoProfile ? demoProfile.lowStakesSessionCount : 8,
    averageDeviation: 1.2,
    reviewStatus: 'clear' as const,
    deviceType: 'web_desktop',
  };

  const studentDatasetId = student.studentId?.startsWith('S0') ? student.studentId : (id.startsWith('S0') ? id : 'S001');
  const personalizedBaseline = useMemo(() => getStudentBaseline(studentDatasetId), [studentDatasetId]);

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
            <Badge variant="active" dot>
              {student.studentId}
            </Badge>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">
              {personalizedBaseline.maturityLabel}
            </span>
          </div>
          <p className="text-xs text-text-muted">
            {student.studentId} · {student.department} · Enrolled {student.enrollmentYear}
          </p>
        </div>
      </div>

      {/* Demo Student Profile Switcher */}
      <DemoStudentSelector selectedStudentId={studentDatasetId} showNavigationLinks={true} />

      {/* Instructor Inspection Banner */}
      <div className="p-4 rounded-2xl bg-surface-800 border border-indigo-500/30 flex items-start gap-3.5 shadow-lg">
        <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 shrink-0 mt-0.5">
          <ShieldCheck size={20} />
        </div>
        <div className="space-y-1 text-xs text-text-secondary leading-relaxed">
          <span className="font-bold text-text-primary">Instructor Baseline Inspection</span>
          <p className="text-[11px] text-text-muted">
            This baseline represents the student&apos;s historical low-stakes interaction behavior trained exclusively on their own coursework.
            No automated anomaly accusations or risk scores are generated in this stage.
          </p>
        </div>
      </div>

      {/* Personalized Behavioral Baseline Card Component */}
      <PersonalizedBaselineCard
        baseline={personalizedBaseline}
        isInstructorView={true}
        title={`Behavioral Baseline: ${student.name} (${studentDatasetId})`}
        subtitle="Individual behavioral expectation profile trained on low-stakes coursework history"
      />

      {/* Low-Stakes Training Sessions Inventory */}
      <Card>
        <CardHeader
          title="Eligible Low-Stakes Training Sessions"
          subtitle={`The following ${personalizedBaseline.eligibleLowStakesSessions.length} low-stakes sessions were used to build this baseline`}
          badge={
            <Badge variant="active">
              {personalizedBaseline.trainingSessionCount} Sessions · {personalizedBaseline.totalInteractions} Questions
            </Badge>
          }
        />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-3">
          {personalizedBaseline.eligibleLowStakesSessions.map((sId) => (
            <div
              key={sId}
              className="p-2.5 rounded-lg bg-surface-700/30 border border-border text-xs flex items-center justify-between"
            >
              <span className="font-mono font-bold text-sky-400">{sId}</span>
              <span className="text-[10px] text-text-muted">Low-Stakes</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
