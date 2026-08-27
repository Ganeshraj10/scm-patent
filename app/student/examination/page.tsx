'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Clock,
  ChevronLeft,
  ChevronRight,
  Send,
  Lock
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { getAllQuestions } from '@/lib/services/assessments';
import { getCurrentStudentProfile } from '@/lib/services/students';
import type { Question } from '@/types';
import { saveExamSession, getTrackedSessionsByStudent, getStudentSessions } from '@/lib/services/sessions';
import type { ExamSessionCreateInput, BehavioralFeatureInput, FeatureContributionInput } from '@/lib/services/sessions';
import { getSessionsByStudentId } from '@/data/mockSessions';
import { useBehavioralTracker } from '@/lib/trackingEngine';
import { buildBehavioralModel } from '@/lib/modelingEngine';
import { evaluateSessionDeviation } from '@/lib/deviationEngine';
import { generateAndSaveCommitment } from '@/lib/services/provenance';
type SessionPhase = 'loading' | 'intro' | 'active' | 'submitting' | 'persist_error';

const TOTAL_TIME_SECONDS = 45 * 60; // 45 minutes for 30 questions

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function ExaminationPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<SessionPhase>('loading');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [timeLeft, setTimeLeft] = useState(TOTAL_TIME_SECONDS);
  const [submittingStep, setSubmittingStep] = useState(0);
  const [examQuestions, setExamQuestions] = useState<Question[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [persistError, setPersistError] = useState<string | null>(null);
  const [studentDbId, setStudentDbId] = useState<string | null>(null);
  const examStartedAt = useRef<string>(new Date().toISOString());

  // Load questions and authentic student profile
  useEffect(() => {
    Promise.all([
      getAllQuestions(),
      getCurrentStudentProfile()
    ])
      .then(([qs, profile]) => {
        if (!profile) {
          setLoadError('Your student profile could not be loaded.');
          return;
        }
        setStudentDbId(profile.id);
        
        // Build 30 questions from base 10 (a/b/c variants) — preserves existing exam behaviour
        const base = qs.length > 0 ? qs : [];
        const expanded = [
          ...base.map((q) => ({ ...q, id: `${q.id}-a` })),
          ...base.map((q) => ({ ...q, id: `${q.id}-b` })),
          ...base.map((q) => ({ ...q, id: `${q.id}-c` })),
        ];
        setExamQuestions(expanded);
        setPhase('intro');
      })
      .catch((err) => {
        console.error('[Examination] Failed to load data:', err);
        setLoadError(err.message ?? 'Failed to load exam questions.');
      });
  }, []);

  const current = examQuestions[currentIndex] ?? { id: '', text: '', options: [], correctIndex: 0, difficulty: 1, topic: '', examCode: '' };
  const progress = ((currentIndex + 1) / examQuestions.length) * 100;
  const answeredCount = Object.keys(answers).length;
  const isLastQuestion = currentIndex === examQuestions.length - 1;

  // Behavioral Tracking
  const tracker = useBehavioralTracker(phase === 'active', current.id);

  // Timer
  useEffect(() => {
    if (phase !== 'active') return;
    if (timeLeft <= 0) {
      handleSubmit();
      return;
    }
    const id = setInterval(() => setTimeLeft((t) => t - 1), 1000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, timeLeft]);

  const handleAnswer = (optionIndex: number) => {
    if (answers[current.id] !== undefined && answers[current.id] !== optionIndex) {
      tracker.recordRevision();
    }
    setAnswers((prev) => ({ ...prev, [current.id]: optionIndex }));
  };

  const handleNext = () => {
    if (currentIndex < examQuestions.length - 1) setCurrentIndex((i) => i + 1);
  };

  const handlePrev = () => {
    if (currentIndex > 0) setCurrentIndex((i) => i - 1);
  };

  const handleSubmit = useCallback(async () => {
    if (!studentDbId) {
      setPersistError('Student identity missing.');
      setPhase('persist_error');
      return;
    }
    
    setPhase('submitting');
    setPersistError(null);
    
    // Grab the final tracked data snapshot
    const rawTrackedData = tracker.getFinalData();
    const submittedAt = new Date().toISOString();

    // UI Steps simulation
    const steps = [
      'Finalizing responses…',
      'Securing session data…',
      'Encrypting behavioral payload…',
      'Transmitting to ExamGuard…',
    ];

    for (let i = 0; i < steps.length - 1; i++) {
      await new Promise((r) => setTimeout(r, 600));
      setSubmittingStep(i + 1);
    }

    // ── Build per-question feature list ────────────────────
    const questionIds = Object.keys(rawTrackedData);
    const numQuestions = questionIds.length || 1;
    let totalTime = 0, totalPointer = 0, totalScroll = 0, totalRevisions = 0, totalPaste = 0;
    
    const featuresList: BehavioralFeatureInput[] = questionIds.map((id, idx) => {
      const d = rawTrackedData[id];
      totalTime     += d.responseTimeMs;
      totalPointer  += d.pointerMovementPx;
      totalScroll   += d.scrollDistancePx;
      totalRevisions += d.revisionCount;
      totalPaste    += d.pasteCount;
      return {
        questionId:       id,
        responseTime:     d.responseTimeMs,
        pointerMovement:  d.pointerMovementPx,
        scrollDistance:   d.scrollDistancePx,
        revisionCount:    d.revisionCount,
        pasteDetected:    d.pasteCount > 0,
        deviceType:       'desktop' as const,
        sessionPosition:  idx,
        eventTimestamp:   submittedAt,
      };
    });

    // ── Build session for deviation engine ─────────────────
    const rawSessionForEngine: any = {
      id:           `engine-${Date.now()}`,
      studentId:    studentDbId || '',
      studentName:  'Student',
      examName:     'Data Structures & Algorithms Final',
      examCode:     'CS301-FINAL',
      type:         'graded_examination',
      date:         submittedAt,
      duration:     Math.round((TOTAL_TIME_SECONDS - timeLeft) / 60),
      questionCount: examQuestions.length,
      deviceType:   'desktop',
      features: questionIds.map((id) => ({
        questionId:      id,
        responseTime:    rawTrackedData[id].responseTimeMs,
        pointerMovement: rawTrackedData[id].pointerMovementPx,
        scrollDistance:  rawTrackedData[id].scrollDistancePx,
        revisionCount:   rawTrackedData[id].revisionCount,
        pasteDetected:   rawTrackedData[id].pasteCount > 0,
        deviceType:      'desktop',
      })),
    };

    // ── Evaluate deviation ─────────────────────────────────
    // Build a client-side temporary model representation to calculate deviations in the browser
    const examSessions    = await getStudentSessions(studentDbId || '');
    const trackedSessions = await getTrackedSessionsByStudent(studentDbId || '');
    const uniqueSessionsMap = new Map();
    [...examSessions, ...trackedSessions].forEach(s => uniqueSessionsMap.set(s.id, s));
    const uniqueSessions  = Array.from(uniqueSessionsMap.values());
    const model           = buildBehavioralModel(studentDbId || '', uniqueSessions);

    // ── Evaluate deviation ─────────────────────────────────
    const analysis  = evaluateSessionDeviation(rawSessionForEngine, model);
    const isLimited = (analysis as any).rawStatus === 'analysis_limited';
    const finalStatus = isLimited ? 'normal'
                       : analysis.reviewRequired ? 'review_required'
                       : 'normal';

    // ── Map feature contributions for persistence ──────────
    const contributions: FeatureContributionInput[] = analysis.featureContributions.map((c) => ({
      feature:      c.feature,
      observed:     isFinite(c.observed)     ? c.observed     : 0,
      expected:     isFinite(c.expected)     ? c.expected     : 0,
      deviation:    isFinite(c.deviation)    ? c.deviation    : 0,
      contribution: isFinite(c.contribution) ? c.contribution : 0,
      direction:    (c as any).direction ?? 'within_expected_range',
    }));

    // ── Advance submitting step ────────────────────────────
    setSubmittingStep(steps.length);
    await new Promise((r) => setTimeout(r, 400));

    // ── Persist to Supabase (atomic) ───────────────────────
    const input: ExamSessionCreateInput = {
      studentId:            studentDbId || '', // Resolved via auth
      deviceType:           'desktop',
      startedAt:            examStartedAt.current,
      submittedAt,
      deviationScore:       isFinite(analysis.deviationScore) ? analysis.deviationScore : 0,
      personalizedThreshold: isFinite(analysis.personalizedThreshold) ? analysis.personalizedThreshold : 0,
      confidence:           isFinite(analysis.confidence) ? analysis.confidence : 0,
      reviewStatus:         finalStatus,
      features:             featuresList,
      featureContributions: contributions,
    };

    try {
      const result = await saveExamSession(input);
      
      // Now that we have the real ID, generate and persist the cryptographic commitment
      const completeSession = {
        id: result.sessionId,
        studentId: input.studentId,
        deviceType: input.deviceType,
        date: input.startedAt,
        features: rawSessionForEngine.features,
      };
      
      // Async generation and API transmission
      await generateAndSaveCommitment(completeSession);

      router.push(`/student/results/${result.sessionId}`);
    } catch (err: any) {
      console.error('[Examination] Failed to persist exam session:', err);
      setPersistError(err.message ?? 'Failed to save your exam. Please contact support.');
      setPhase('persist_error');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answers, timeLeft, router, examQuestions.length, studentDbId]);

  const submittingSteps = [
    'Finalizing responses…',
    'Securing session data…',
    'Encrypting behavioral payload…',
    'Transmitting to ExamGuard…',
  ];

  // ── Persist Error ─────────────────────────────────────────
  if (phase === 'persist_error') {
    return (
      <div className="max-w-xl mx-auto py-16 flex flex-col items-center text-center gap-6">
        <div className="w-16 h-16 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
          <span className="text-rose-400 text-2xl">!</span>
        </div>
        <div>
          <h2 className="text-lg font-semibold text-text-primary mb-2">Submission Failed</h2>
          <p className="text-sm text-text-secondary leading-relaxed">
            Your exam was completed successfully, but we encountered an error while saving your results.
          </p>
          <p className="text-xs text-rose-400 mt-3 font-mono break-all">{persistError}</p>
        </div>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={() => router.push('/student/dashboard')}>
            Go to Dashboard
          </Button>
          <Button variant="primary" onClick={() => { setPhase('submitting'); setSubmittingStep(0); handleSubmit(); }}>
            Retry Submission
          </Button>
        </div>
      </div>
    );
  }

  // ── Loading ──────────────────────────────────────────────
  if (phase === 'loading') {
    if (loadError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4">
          <h2 className="text-lg font-semibold text-text-primary mb-2">Error</h2>
          <p className="text-sm text-rose-400">{loadError}</p>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => router.push('/student/dashboard')}>Dashboard</Button>
            <Button variant="primary" onClick={() => window.location.reload()}>Retry</Button>
          </div>
        </div>
      );
    }
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ── Intro ──────────────────────────────────────────────────
  if (phase === 'intro') {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-text-primary">Graded Examination</h2>
          <p className="text-sm text-text-muted mt-0.5">
            Data Structures & Algorithms (CS301-FINAL)
          </p>
        </div>

        <div className="bg-surface-800 border border-border rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-3 pb-4 border-b border-border">
            <Lock className="text-emerald-400" size={20} />
            <p className="text-sm font-medium text-text-primary">ExamGuard Integrity Active</p>
          </div>
          <p className="text-sm text-text-secondary leading-relaxed">
            This is a 30-question graded examination. Once you begin, your interactions (timing, pointer movement, revisions, etc.) will be securely tracked and compared against your personalized behavioral model.
          </p>
          <ul className="text-xs text-text-muted list-disc list-inside space-y-1.5 ml-1">
            <li>Ensure you have a stable internet connection.</li>
            <li>Do not switch tabs or use external tools.</li>
            <li>You have 45 minutes to complete the examination.</li>
          </ul>

          <div className="pt-4 flex justify-end">
            <Button variant="primary" onClick={() => setPhase('active')}>
              Start Examination
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── Submitting ──────────────────────────────────────────────
  if (phase === 'submitting') {
    return (
      <div className="max-w-xl mx-auto py-12 flex flex-col items-center text-center space-y-8">
        <div className="w-16 h-16 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
        <div className="space-y-2">
          <h2 className="text-xl font-semibold text-text-primary">Submitting Examination</h2>
          <p className="text-sm text-text-muted">Please do not close this window.</p>
        </div>
        <div className="w-full max-w-sm space-y-3 text-left">
          {submittingSteps.map((step, i) => (
            <div key={i} className={`flex items-center gap-3 text-sm transition-opacity duration-500 ${i <= submittingStep ? 'opacity-100' : 'opacity-0'}`}>
              {i < submittingStep ? (
                <div className="w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center">
                  <div className="w-1.5 h-1.5 bg-white rounded-full" />
                </div>
              ) : (
                <div className="w-4 h-4 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
              )}
              <span className={i < submittingStep ? 'text-text-secondary' : 'text-indigo-400 font-medium'}>
                {step}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Active Exam ───────────────────────────────────────────
  return (
    <div className="max-w-3xl mx-auto flex flex-col h-[calc(100vh-8rem)]">
      {/* Top Bar */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold text-text-primary">CS301-FINAL</h2>
          <p className="text-xs text-text-muted">Question {currentIndex + 1} of {examQuestions.length}</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-text-secondary bg-surface-800 px-3 py-1.5 rounded-lg border border-border">
            <Clock size={14} className={timeLeft < 300 ? 'text-amber-400 animate-pulse' : 'text-indigo-400'} />
            <span className={`text-sm font-medium tabular-nums ${timeLeft < 300 ? 'text-amber-400' : ''}`}>
              {formatTime(timeLeft)}
            </span>
          </div>
        </div>
      </div>

      {/* Progress */}
      <div className="mb-8 space-y-2">
        <ProgressBar value={progress} color="indigo" size="sm" />
        <p className="text-[10px] text-text-muted text-right">{answeredCount} answered</p>
      </div>

      {/* Question Card */}
      <div className="flex-1 bg-surface-800 border border-border rounded-xl p-6 sm:p-8 flex flex-col">
        <div className="mb-8">
          <span className="inline-block px-2.5 py-1 bg-surface-700 text-text-secondary text-[10px] font-semibold uppercase tracking-wider rounded-md mb-4">
            {current.topic}
          </span>
          <h3 className="text-lg font-medium text-text-primary leading-relaxed">
            {current.text}
          </h3>
        </div>

        <div className="space-y-3 mb-auto">
          {current.options.map((opt, i) => {
            const isSelected = answers[current.id] === i;
            return (
              <button
                key={i}
                onClick={() => handleAnswer(i)}
                className={`w-full text-left p-4 rounded-xl border transition-all duration-200 flex items-center justify-between group
                  ${isSelected
                    ? 'bg-indigo-500/10 border-indigo-500 text-text-primary'
                    : 'bg-surface-900 border-border text-text-secondary hover:border-text-muted/50 hover:bg-surface-800'
                  }
                `}
              >
                <span className="text-sm">{opt}</span>
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors
                  ${isSelected ? 'border-indigo-400' : 'border-text-muted/30 group-hover:border-text-muted'}
                `}>
                  {isSelected && <div className="w-2 h-2 rounded-full bg-indigo-400" />}
                </div>
              </button>
            );
          })}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between pt-8 mt-8 border-t border-border">
          <Button
            variant="secondary"
            onClick={handlePrev}
            disabled={currentIndex === 0}
            className="w-28 flex justify-center"
          >
            <ChevronLeft size={16} className="mr-1" /> Prev
          </Button>
          
          {isLastQuestion ? (
            <Button
              variant="primary"
              onClick={handleSubmit}
              className="w-32 flex justify-center bg-indigo-600 hover:bg-indigo-500 text-white"
            >
              Submit Exam <Send size={14} className="ml-2" />
            </Button>
          ) : (
            <Button
              variant="secondary"
              onClick={handleNext}
              className="w-28 flex justify-center"
            >
              Next <ChevronRight size={16} className="ml-1" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
