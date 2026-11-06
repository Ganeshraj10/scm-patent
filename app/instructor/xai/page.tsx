'use client';

import React, { Suspense, useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Brain,
  AlertTriangle,
  ShieldCheck,
  CheckCircle,
  Clock,
  Layers,
  Sparkles,
  Info,
  ChevronRight,
  Filter,
  Search,
  ExternalLink,
} from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ExplainabilityPanel } from '@/components/integrity/ExplainabilityPanel';
import { HumanReviewService, HumanReviewCase } from '@/lib/services/humanReviewService';
import { mockAlerts } from '@/data/mockAlerts';
import { mockSessions } from '@/data/mockSessions';

function XAIContent() {
  const searchParams = useSearchParams();
  const urlSession = searchParams.get('session') || '';

  const [allSessions, setAllSessions] = useState<
    {
      sessionId: string;
      studentName: string;
      studentId: string;
      examName: string;
      status: string;
      isAnomaly: boolean;
      deviationScore: number;
      threshold: number;
      isSynthetic: boolean;
    }[]
  >([]);

  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [reviewCase, setReviewCase] = useState<HumanReviewCase | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'flagged' | 'normal'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);

  // Initialize available review sessions
  useEffect(() => {
    const list = HumanReviewService.getAllReviewSessions();
    // Add additional representative sessions from mockSessions
    const additional = mockSessions.slice(0, 6).map((s) => ({
      sessionId: s.id,
      studentName: s.studentName,
      studentId: s.studentId,
      examName: s.examName,
      status: s.reviewStatus || 'pending',
      deviationScore: s.deviationScore,
      threshold: s.personalizedThreshold || 35.0,
      isAnomaly: s.deviationScore > (s.personalizedThreshold || 35.0),
      isSynthetic: true,
    }));

    // Deduplicate by sessionId
    const map = new Map<string, any>();
    [...list, ...additional].forEach((item) => {
      if (!map.has(item.sessionId)) map.set(item.sessionId, item);
    });

    // Add a synthetic research dataset session option
    map.set('STU-0001_SES35', {
      sessionId: 'STU-0001_SES35',
      studentName: 'Simulated Student STU-0001',
      studentId: 'STU-0001',
      examName: 'Phase 2 Synthetic Graded Exam (Session 35)',
      status: 'pending',
      deviationScore: 54.2,
      threshold: 30.0,
      isAnomaly: true,
      isSynthetic: true,
    });

    const merged = Array.from(map.values());
    setAllSessions(merged);

    // Initial selected session: urlSession or first flagged session or first available
    const initialMatch = urlSession
      ? merged.find((s) => s.sessionId === urlSession)?.sessionId
      : merged.find((s) => s.isAnomaly)?.sessionId || merged[0]?.sessionId || '';

    setSelectedSessionId(initialMatch);
    setLoading(false);
  }, [urlSession]);

  // Load review case whenever selectedSessionId changes
  useEffect(() => {
    if (!selectedSessionId) return;
    try {
      const c = HumanReviewService.getOrCreateCaseForSession(selectedSessionId);
      setReviewCase(c);
    } catch (err) {
      console.error('[XAIPage] Error loading review case:', err);
    }
  }, [selectedSessionId]);

  const filteredSessions = useMemo(() => {
    return allSessions.filter((s) => {
      const matchFilter =
        filterType === 'all'
          ? true
          : filterType === 'flagged'
          ? s.isAnomaly
          : !s.isAnomaly;
      const matchSearch =
        searchQuery === '' ||
        s.sessionId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.examName.toLowerCase().includes(searchQuery.toLowerCase());
      return matchFilter && matchSearch;
    });
  }, [allSessions, filterType, searchQuery]);

  const handleDecisionSubmit = async (decision: any, notes: string) => {
    if (!selectedSessionId) return;
    await HumanReviewService.submitReviewDecision(
      selectedSessionId,
      'INST-PRIMARY',
      decision,
      notes
    );
    // Refresh review case state
    const updated = HumanReviewService.getOrCreateCaseForSession(selectedSessionId);
    setReviewCase({ ...updated });
    // Update session list status
    setAllSessions((prev) =>
      prev.map((s) =>
        s.sessionId === selectedSessionId ? { ...s, status: decision } : s
      )
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* 1. Header Banner */}
      <div className="rounded-2xl bg-gradient-to-r from-indigo-950/70 via-surface-800 to-surface-800 border border-indigo-500/30 p-5 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center gap-1.5">
              <Brain size={14} /> Explainable AI (XAI) Hub
            </span>
            <span className="text-xs text-text-muted">
              Phase 4 Implementation · 4 Competing Models
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-300 border border-amber-500/20">
              Simulated Research Telemetry
            </span>
          </div>
          <h1 className="text-xl font-bold text-text-primary mt-2">
            Multi-Model Behavioural Explainability & Pedagogical Review
          </h1>
          <p className="text-xs text-text-secondary mt-1 max-w-3xl leading-relaxed">
            Inspect individual student behavioural telemetry across all four anomaly detection algorithms. Compare covariance couplings, exact Shapley attributions, local density neighbourhood ratios, and decision boundary gradients.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Link href="/instructor/alerts">
            <Button variant="secondary" size="sm" className="text-xs">
              <AlertTriangle size={13} className="mr-1 text-amber-400" />
              Review Queue
            </Button>
          </Link>
          <Link href="/instructor/analysis">
            <Button variant="secondary" size="sm" className="text-xs">
              Integrity Workbench
            </Button>
          </Link>
        </div>
      </div>

      {/* 2. Session Selector & Filter Bar */}
      <Card className="p-4 border-border/60 bg-surface/60">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Filter Pills */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-muted font-medium flex items-center gap-1">
              <Filter size={13} /> Filter:
            </span>
            <button
              onClick={() => setFilterType('all')}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                filterType === 'all'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-surface-elevated text-text-muted hover:text-text-primary'
              }`}
            >
              All Sessions ({allSessions.length})
            </button>
            <button
              onClick={() => setFilterType('flagged')}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors flex items-center gap-1 ${
                filterType === 'flagged'
                  ? 'bg-rose-600 text-white'
                  : 'bg-surface-elevated text-text-muted hover:text-text-primary'
              }`}
            >
              <AlertTriangle size={12} className="text-rose-400" /> Flagged Deviations
            </button>
            <button
              onClick={() => setFilterType('normal')}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors flex items-center gap-1 ${
                filterType === 'normal'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-surface-elevated text-text-muted hover:text-text-primary'
              }`}
            >
              <ShieldCheck size={12} className="text-emerald-400" /> Within Baseline
            </button>
          </div>

          {/* Search Box */}
          <div className="relative w-full lg:w-72">
            <Search size={14} className="absolute left-3 top-2.5 text-text-muted" />
            <input
              type="text"
              placeholder="Search session or student..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-surface-elevated border border-border/50 rounded-lg text-xs text-text-primary placeholder-text-muted focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        {/* Session Pills Carousel / Grid */}
        <div className="mt-3 pt-3 border-t border-border/40 flex items-center gap-2 overflow-x-auto pb-1">
          {filteredSessions.length === 0 ? (
            <p className="text-xs text-text-muted py-2">No examination sessions match your query.</p>
          ) : (
            filteredSessions.map((s) => {
              const isSelected = s.sessionId === selectedSessionId;
              return (
                <button
                  key={s.sessionId}
                  onClick={() => setSelectedSessionId(s.sessionId)}
                  className={`px-3 py-2 rounded-lg text-left transition-all shrink-0 border ${
                    isSelected
                      ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300 ring-1 ring-indigo-500/50 shadow-sm'
                      : 'bg-surface-elevated/70 border-border/40 text-text-muted hover:border-border hover:text-text-primary'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] font-bold text-text-primary">
                      {s.sessionId}
                    </span>
                    {s.isAnomaly && (
                      <span className="w-2 h-2 rounded-full bg-rose-400 animate-pulse" />
                    )}
                  </div>
                  <div className="text-[11px] text-text-secondary truncate max-w-[160px] mt-0.5">
                    {s.studentName}
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-1">
                    <span className="text-[10px] text-text-muted font-mono">
                      Dev: {s.deviationScore.toFixed(0)}
                    </span>
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.2 rounded uppercase ${
                        s.status === 'verified_deviation'
                          ? 'bg-rose-500/10 text-rose-400'
                          : s.status === 'cleared_normal'
                          ? 'bg-emerald-500/10 text-emerald-400'
                          : 'bg-amber-500/10 text-amber-400'
                      }`}
                    >
                      {s.status.replace('_', ' ')}
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </Card>

      {/* 3. Main Explainability & Review Panel */}
      {reviewCase ? (
        <ExplainabilityPanel
          sessionId={reviewCase.sessionId}
          pseudonymousStudentId={reviewCase.pseudonymousStudentId}
          explanations={reviewCase.modelExplanations}
          initialModelName={reviewCase.primaryModel}
          initialReviewStatus={reviewCase.reviewStatus}
          onDecisionSubmit={handleDecisionSubmit}
        />
      ) : (
        <Card className="p-12 text-center text-text-muted">
          <Brain size={32} className="mx-auto text-indigo-400 mb-2 opacity-50" />
          <p className="text-sm">Select an examination session above to inspect Explainable AI telemetry.</p>
        </Card>
      )}
    </div>
  );
}

export default function XAIPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-24">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <XAIContent />
    </Suspense>
  );
}

