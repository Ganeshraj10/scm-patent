'use client';

import { useState, useMemo, useEffect } from 'react';
import {
  User,
  ClipboardList,
  AlertTriangle,
  CheckCircle,
  HelpCircle,
  Play,
  Sparkles,
  Sliders,
  Filter,
  RefreshCw,
  Cpu,
  Monitor,
  Smartphone,
  Tablet,
} from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import {
  getPatentStudents,
  getStudentPatentRecords,
  getStudentLowStakesRecords,
  getStudentGradedRecords,
  PatentRecord,
  getAllPatentRecords,
} from '@/lib/services/datasetService';
import { buildPersonalizedBaseline, PersonalizedBaseline } from '@/lib/services/behavioralModel';
import { evaluateSessionAnomaly, AnomalyEvaluation } from '@/lib/services/anomalyDetection';
import { generateRiskReport } from '@/lib/services/riskExplanation';
import { BehavioralBaseline } from './BehavioralBaseline';
import { RiskReport } from './RiskReport';
import { HumanReview, HumanReviewDecision } from './HumanReview';
import { ColdStartStatus } from './ColdStartStatus';
import { DatasetStatusCard } from './DatasetStatusCard';
import { DatasetExplorer } from './DatasetExplorer';
import { getItem } from '@/lib/sessionStore';
import { Database } from 'lucide-react';

interface ExamAnalysisProps {
  initialStudentId?: string;
  initialSessionId?: string;
}

export function ExamAnalysis({
  initialStudentId = 'S001',
  initialSessionId,
}: ExamAnalysisProps) {
  const students = useMemo(() => getPatentStudents(), []);
  
  const [selectedStudentId, setSelectedStudentId] = useState<string>(initialStudentId);
  const [selectedSessionId, setSelectedSessionId] = useState<string>(initialSessionId || '');
  const [activeTab, setActiveTab] = useState<'analysis' | 'baseline' | 'review' | 'dataset'>('analysis');
  const [coldStartOverride, setColdStartOverride] = useState<boolean>(false);
  const [customDeviceOverride, setCustomDeviceOverride] = useState<string | null>(null);

  // Get records for the selected student
  const studentRecords = useMemo(
    () => getStudentPatentRecords(selectedStudentId),
    [selectedStudentId]
  );

  const gradedRecords = useMemo(
    () => studentRecords.filter((r) => r.session_type === 'graded'),
    [studentRecords]
  );

  // Set default session if not set or changed
  useEffect(() => {
    if (gradedRecords.length > 0) {
      const match = gradedRecords.find((r) => r.session_id === selectedSessionId);
      if (!match) {
        setSelectedSessionId(gradedRecords[0].session_id);
      }
    }
  }, [selectedStudentId, gradedRecords, selectedSessionId]);

  // Selected graded record
  const currentGradedRecord = useMemo(() => {
    let rec = gradedRecords.find((r) => r.session_id === selectedSessionId) || gradedRecords[0];
    if (!rec && studentRecords.length > 0) {
      rec = studentRecords[0];
    }
    if (rec && customDeviceOverride) {
      return { ...rec, device_type: customDeviceOverride };
    }
    return rec;
  }, [gradedRecords, selectedSessionId, studentRecords, customDeviceOverride]);

  // Read verified clean sessions from sessionStore for baseline building
  const verifiedSessions = useMemo(() => {
    if (typeof window === 'undefined') return [];
    return getItem<string[]>(`patent_verified_sessions_${selectedStudentId}`) || [];
  }, [selectedStudentId]);

  // Build Personalized Baseline (with cold start simulation if active)
  const baseline: PersonalizedBaseline = useMemo(() => {
    if (coldStartOverride) {
      // Simulate student with only 2 low-stakes sessions
      const limitedRecords = studentRecords.filter((r) => r.session_type === 'low_stakes').slice(0, 2);
      return buildPersonalizedBaseline(selectedStudentId, [], limitedRecords);
    }
    return buildPersonalizedBaseline(selectedStudentId, verifiedSessions);
  }, [selectedStudentId, verifiedSessions, coldStartOverride, studentRecords]);

  // Compute Anomaly Evaluation
  const anomalyEvaluation: AnomalyEvaluation | null = useMemo(() => {
    if (!currentGradedRecord) return null;
    return evaluateSessionAnomaly(currentGradedRecord, baseline);
  }, [currentGradedRecord, baseline]);

  // Generate Risk Report
  const riskReport = useMemo(() => {
    if (!anomalyEvaluation || !currentGradedRecord) return null;
    return generateRiskReport(anomalyEvaluation, currentGradedRecord);
  }, [anomalyEvaluation, currentGradedRecord]);

  // Test Scenarios Quick Triggers
  const applyScenario = (scenario: number) => {
    setColdStartOverride(false);
    setCustomDeviceOverride(null);

    switch (scenario) {
      case 1:
        // Scenario 1: Normal graded session
        setSelectedStudentId('S001');
        setSelectedSessionId('S001_EX01');
        break;
      case 2:
        // Scenario 2: High deviation (low response time + revisions + pointer)
        setSelectedStudentId('S003');
        setSelectedSessionId('S003_EX02'); // Response time 3.8s, revisions 5, pointer speed 654 px/s, paste=1, burst=1
        break;
      case 3:
        // Scenario 3: Device change (Student with desktop/laptop baseline tested on mobile)
        setSelectedStudentId('S001');
        setSelectedSessionId('S001_EX01');
        setCustomDeviceOverride('mobile_tablet_unknown');
        break;
      case 4:
        // Scenario 4: Cold Start (<3 low-stakes sessions)
        setSelectedStudentId('S001');
        setSelectedSessionId('S001_EX01');
        setColdStartOverride(true);
        break;
      default:
        break;
    }
  };

  const riskBadgeVariant =
    anomalyEvaluation?.riskLevel === 'High'
      ? 'high'
      : anomalyEvaluation?.riskLevel === 'Medium'
      ? 'medium'
      : 'low';

  return (
    <div className="space-y-6">
      {/* Top Banner & Scenario Launcher */}
      <div className="rounded-2xl bg-gradient-to-r from-indigo-950/70 via-surface-800 to-surface-800 border border-indigo-500/20 p-5 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                Prototype / Synthetic Dataset
              </span>
              <span className="text-xs text-text-muted">120 Longitudinal Records · Patent Behavioral Integrity Model</span>
            </div>
            <h2 className="text-xl font-bold text-text-primary mt-2">
              Examination Integrity Analysis & Baseline Workbench
            </h2>
            <p className="text-xs text-text-secondary mt-1 max-w-2xl leading-relaxed">
              Compares a student&apos;s examination session against their own longitudinal low-stakes baseline. Evaluates response time, revisions, pointer telemetry, clipboard paste, and device consistency.
            </p>
          </div>

          {/* Test Scenario Buttons */}
          <div className="flex flex-col gap-2">
            <span className="text-[11px] font-semibold text-indigo-300 uppercase tracking-wider">
              Test Case Presets:
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              <button
                onClick={() => applyScenario(1)}
                className="px-2.5 py-1.5 rounded-lg text-[11px] font-medium bg-surface-700 hover:bg-surface-600 text-text-secondary hover:text-text-primary border border-border transition-all text-center"
              >
                1. Normal Session
              </button>
              <button
                onClick={() => applyScenario(2)}
                className="px-2.5 py-1.5 rounded-lg text-[11px] font-medium bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 transition-all text-center"
              >
                2. High Deviation
              </button>
              <button
                onClick={() => applyScenario(3)}
                className="px-2.5 py-1.5 rounded-lg text-[11px] font-medium bg-violet-500/15 hover:bg-violet-500/25 text-violet-300 border border-violet-500/30 transition-all text-center"
              >
                3. Device Change
              </button>
              <button
                onClick={() => applyScenario(4)}
                className="px-2.5 py-1.5 rounded-lg text-[11px] font-medium bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 transition-all text-center"
              >
                4. Cold Start (&lt;3)
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Selectors Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-xl bg-surface-800 border border-border">
        {/* Student Selector */}
        <div>
          <label className="text-xs font-semibold text-text-muted uppercase tracking-wider block mb-1.5">
            Select Student
          </label>
          <div className="relative">
            <select
              value={selectedStudentId}
              onChange={(e) => {
                setSelectedStudentId(e.target.value);
                setColdStartOverride(false);
                setCustomDeviceOverride(null);
              }}
              className="w-full h-10 px-3 pr-8 rounded-lg bg-surface-700 border border-border text-sm text-text-primary font-medium focus:outline-none focus:border-indigo-500/60 transition-colors"
            >
              {students.map((stu) => (
                <option key={stu} value={stu}>
                  Student {stu} (8 low-stakes + 4 graded)
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Graded Exam Session Selector */}
        <div>
          <label className="text-xs font-semibold text-text-muted uppercase tracking-wider block mb-1.5">
            Select Graded Exam Session
          </label>
          <select
            value={selectedSessionId}
            onChange={(e) => setSelectedSessionId(e.target.value)}
            className="w-full h-10 px-3 pr-8 rounded-lg bg-surface-700 border border-border text-sm text-text-primary font-medium focus:outline-none focus:border-indigo-500/60 transition-colors"
          >
            {gradedRecords.map((r) => (
              <option key={r.session_id} value={r.session_id}>
                {r.session_id} · Question {r.question_id} (Diff {r.question_difficulty}, {r.response_time_sec}s)
              </option>
            ))}
          </select>
        </div>

        {/* Live Score Summary */}
        <div className="flex items-center justify-between p-2.5 rounded-lg bg-surface-700/60 border border-border">
          <div>
            <span className="text-[11px] text-text-muted block">Integrity Risk Score</span>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-2xl font-black tabular-nums text-text-primary">
                {anomalyEvaluation ? anomalyEvaluation.riskScore : '—'}
              </span>
              <span className="text-xs text-text-muted">/100</span>
              {anomalyEvaluation && (
                <Badge variant={riskBadgeVariant}>{anomalyEvaluation.riskLevel} Risk</Badge>
              )}
            </div>
          </div>
          <div className="text-right">
            <span className="text-[11px] text-text-muted block">Confidence</span>
            <span className="text-sm font-bold text-indigo-400">
              {baseline.confidence}%
            </span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-border pb-3 flex-wrap">
        <button
          onClick={() => setActiveTab('analysis')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'analysis'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-900/30'
              : 'bg-surface-800 text-text-secondary hover:text-text-primary hover:bg-surface-700 border border-border'
          }`}
        >
          <ClipboardList size={15} />
          Explainable Risk Analysis
        </button>

        <button
          onClick={() => setActiveTab('baseline')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'baseline'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-900/30'
              : 'bg-surface-800 text-text-secondary hover:text-text-primary hover:bg-surface-700 border border-border'
          }`}
        >
          <User size={15} />
          Personalized Behavioral Baseline
        </button>

        <button
          onClick={() => setActiveTab('review')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'review'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-900/30'
              : 'bg-surface-800 text-text-secondary hover:text-text-primary hover:bg-surface-700 border border-border'
          }`}
        >
          <AlertTriangle size={15} />
          Human Review & Model Update
        </button>

        <button
          onClick={() => setActiveTab('dataset')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'dataset'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-900/30'
              : 'bg-surface-800 text-text-secondary hover:text-text-primary hover:bg-surface-700 border border-border'
          }`}
        >
          <Database size={15} />
          Dataset Exploration & Schema
        </button>
      </div>

      {/* Active Tab View */}
      {activeTab === 'analysis' && riskReport && (
        <div className="space-y-6">
          <RiskReport report={riskReport} />
          
          {/* Quick baseline preview underneath */}
          <Card>
            <CardHeader
              title={`Student ${selectedStudentId} Baseline Reference`}
              subtitle="Quick reference of historical parameters used to evaluate this examination"
            />
            <div className="mt-2">
              <BehavioralBaseline baseline={baseline} />
            </div>
          </Card>
        </div>
      )}

      {activeTab === 'baseline' && (
        <BehavioralBaseline baseline={baseline} />
      )}

      {activeTab === 'review' && currentGradedRecord && (
        <div className="space-y-6">
          <HumanReview
            sessionId={currentGradedRecord.session_id}
            studentId={selectedStudentId}
            initialStatus={
              currentGradedRecord.human_review_label === 'flagged_mock'
                ? 'review_recommended'
                : 'pending_review'
            }
          />
          {riskReport && <RiskReport report={riskReport} />}
        </div>
      )}

      {activeTab === 'dataset' && (
        <div className="space-y-6">
          <DatasetStatusCard />
          <DatasetExplorer />
        </div>
      )}
    </div>
  );
}
