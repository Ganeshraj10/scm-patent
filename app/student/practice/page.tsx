'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Clock,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  Circle,
  AlertCircle,
  BookOpen,
  Send,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { getAllQuestions } from '@/lib/services/assessments';
import { getCurrentStudentProfile } from '@/lib/services/students';
import { useBehavioralTracker } from '@/lib/trackingEngine';
import { createBehavioralSession } from '@/lib/services/sessions';
import type { BehavioralSessionCreateInput, BehavioralFeatureInput } from '@/lib/services/sessions';
import type { Question } from '@/types';

import { mockStudents } from '@/data/mockStudents';
import { mockQuestions } from '@/data/mockQuestions';

type SessionPhase = 'loading' | 'intro' | 'active' | 'submitting' | 'complete' | 'persist_error';

const TOTAL_TIME_SECONDS = 15 * 60; // 15 minutes for 10 questions

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function PracticeSessionPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<SessionPhase>('loading');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [timeLeft, setTimeLeft] = useState(TOTAL_TIME_SECONDS);
  const [submittingStep, setSubmittingStep] = useState(0);
  const [questions, setQuestions] = useState<Question[]>(mockQuestions);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [persistError, setPersistError] = useState<string | null>(null);
  const [studentDbId, setStudentDbId] = useState<string | null>(null);
  const sessionStartedAt = useRef<string>(new Date().toISOString());

  // Load questions and authentic student profile
  useEffect(() => {
    Promise.all([
      getAllQuestions(),
      getCurrentStudentProfile()
    ])
      .then(([qs, profile]) => {
        const studentProfile = profile || mockStudents[0];
        setStudentDbId(studentProfile?.id || 'demo-student-id');
        const resolvedQs = qs && qs.length > 0 ? qs : mockQuestions;
        setQuestions(resolvedQs);
        setPhase('intro');
      })
      .catch(() => {
        setStudentDbId(mockStudents[0]?.id || 'demo-student-id');
        setQuestions(mockQuestions);
        setPhase('intro');
      });
  }, []);
  const current = questions[currentIndex] ?? { id: '', text: '', options: [], correctIndex: 0, difficulty: 1, topic: '', examCode: '' };
  const progress = ((currentIndex + 1) / Math.max(questions.length, 1)) * 100;
  const answeredCount = Object.keys(answers).length;
  const isLastQuestion = currentIndex === questions.length - 1;

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
    if (currentIndex < questions.length - 1) setCurrentIndex((i) => i + 1);
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
    const completedAt = new Date().toISOString();

    // Simulate behavioral extraction steps
    const steps = [
      'Extracting behavioral features…',
      'Computing response timing…',
      'Analyzing revision patterns…',
      'Generating session record…',
      'Saving to ExamGuard…',
    ];

    for (let i = 0; i < steps.length - 1; i++) {
      await new Promise((r) => setTimeout(r, 700));
      setSubmittingStep(i + 1);
    }

    // Build per-question feature list (aggregated derived metrics only)
    const questionIds = Object.keys(rawTrackedData);
    const featuresList: BehavioralFeatureInput[] = questionIds.map((id, idx) => {
      const d = rawTrackedData[id];
      return {
        questionId:      id,
        responseTime:    d.responseTimeMs,
        pointerMovement: d.pointerMovementPx,
        scrollDistance:  d.scrollDistancePx,
        revisionCount:   d.revisionCount,
        pasteDetected:   d.pasteCount > 0,
        deviceType:      'desktop' as const,
        sessionPosition: idx,
        eventTimestamp:  completedAt,
      };
    });

    const input: BehavioralSessionCreateInput = {
      studentId:    studentDbId || '', // Resolved via auth
      sessionType:  'low_stakes',
      deviceType:   'desktop',
      startedAt:    sessionStartedAt.current,
      completedAt,
      features:     featuresList,
    };

    try {
      await createBehavioralSession(input);
      setSubmittingStep(steps.length);
      await new Promise((r) => setTimeout(r, 400));
      setPhase('complete');
    } catch (err: any) {
      console.error('[PracticeSession] Failed to persist session:', err);
      setPersistError(err.message ?? 'Failed to save session.');
      setPhase('persist_error');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submittingSteps = [
    'Extracting behavioral features…',
    'Computing response timing…',
    'Analyzing revision patterns…',
    'Generating session record…',
    'Updating behavioral model…',
  ];

  // ── Persist Error ─────────────────────────────────────────
  if (phase === 'persist_error') {
    return (
      <div className="max-w-xl mx-auto py-16 flex flex-col items-center text-center gap-6">
        <div className="w-16 h-16 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
          <span className="text-rose-400 text-2xl">!</span>
        </div>
        <div>
          <h2 className="text-lg font-semibold text-text-primary mb-2">Session Save Failed</h2>
          <p className="text-sm text-text-secondary leading-relaxed">
            Your practice session was completed, but we could not save it to the server.
          </p>
          {persistError && (
            <p className="text-xs text-rose-400 mt-3 font-mono break-all">{persistError}</p>
          )}
        </div>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={() => router.push('/student/dashboard')}>
            Go to Dashboard
          </Button>
          <Button variant="primary" onClick={() => { setPhase('submitting'); setSubmittingStep(0); handleSubmit(); }}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  // ── Loading ────────────────────────────────────────────────
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
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ── Intro ──────────────────────────────────────────────────
  if (phase === 'intro') {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-text-primary">Practice Session</h2>
          <p className="text-sm text-text-muted mt-0.5">
            Complete this quiz to add a session to your behavioral history.
          </p>
        </div>

        <div className="rounded-2xl bg-surface-800 border border-border overflow-hidden">
          {/* Header */}
          <div className="p-6 border-b border-border">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-600/10 flex items-center justify-center">
                <BookOpen size={20} className="text-indigo-400" />
              </div>
              <div>
                <h3 className="font-semibold text-text-primary">Data Structures & Algorithms</h3>
                <p className="text-xs text-text-muted font-mono">CS301-PRAC</p>
              </div>
            </div>
          </div>

          {/* Details */}
          <div className="p-6 grid grid-cols-3 gap-4">
            {[
              { label: 'Questions', value: `${questions.length}` },
              { label: 'Time Limit', value: '15 min' },
              { label: 'Type', value: 'Low Stakes' },
            ].map((item) => (
              <div key={item.label} className="text-center p-3 rounded-lg bg-surface-700 border border-border">
                <p className="text-xl font-bold text-text-primary">{item.value}</p>
                <p className="text-xs text-text-muted mt-0.5">{item.label}</p>
              </div>
            ))}
          </div>

          {/* What&apos;s tracked */}
          <div className="px-6 pb-6">
            <div className="p-4 rounded-xl bg-indigo-600/6 border border-indigo-500/15 mb-5">
              <p className="text-xs font-semibold text-indigo-400 mb-2">What ExamGuard observes during this session</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  'Response timing per question',
                  'Answer revision count',
                  'Pointer movement patterns',
                  'Scroll behavior',
                  'Clipboard paste events',
                  'Device type',
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-1.5 text-xs text-text-secondary">
                    <CheckCircle size={11} className="text-indigo-400 flex-shrink-0" />
                    {item}
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-text-muted mt-3">
                ✦ No keystrokes, answers, or screen content are ever recorded.
              </p>
            </div>

            <Button
              variant="primary"
              size="lg"
              className="w-full"
              leftIcon={<BookOpen size={16} />}
              onClick={() => setPhase('active')}
              id="start-practice-session-btn"
            >
              Begin Practice Session
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── Submitting ─────────────────────────────────────────────
  if (phase === 'submitting') {
    return (
      <div className="max-w-md mx-auto flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-text-primary mb-1">Processing Session</h3>
          <p className="text-sm text-text-secondary">Please wait while we process your behavioral data.</p>
        </div>
        <div className="w-full space-y-2.5">
          {submittingSteps.map((step, i) => (
            <div
              key={i}
              className={[
                'flex items-center gap-3 px-4 py-2.5 rounded-lg border text-sm transition-all duration-300',
                i < submittingStep
                  ? 'bg-emerald-500/8 border-emerald-500/20 text-emerald-400'
                  : i === submittingStep
                  ? 'bg-indigo-600/10 border-indigo-500/20 text-indigo-400 animate-pulse'
                  : 'bg-surface-800 border-border text-text-muted',
              ].join(' ')}
            >
              {i < submittingStep ? (
                <CheckCircle size={14} className="flex-shrink-0" />
              ) : i === submittingStep ? (
                <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin flex-shrink-0" />
              ) : (
                <Circle size={14} className="flex-shrink-0 opacity-40" />
              )}
              {step}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Complete ───────────────────────────────────────────────
  if (phase === 'complete') {
    const correctCount = questions.filter((q) => answers[q.id] === q.correctIndex).length;
    const score = Math.round((correctCount / questions.length) * 100);

    return (
      <div className="max-w-lg mx-auto space-y-5">
        <div className="text-center py-6">
          <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={28} className="text-emerald-400" />
          </div>
          <h3 className="text-xl font-bold text-text-primary mb-1">Session Complete</h3>
          <p className="text-sm text-text-secondary">
            This session has been added to your behavioral history.
          </p>
        </div>

        {/* Score */}
        <div className="rounded-xl bg-surface-800 border border-border p-5 grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-2xl font-bold tabular-nums text-text-primary">{score}%</p>
            <p className="text-xs text-text-muted mt-0.5">Score</p>
          </div>
          <div>
            <p className="text-2xl font-bold tabular-nums text-emerald-400">{correctCount}/{questions.length}</p>
            <p className="text-xs text-text-muted mt-0.5">Correct</p>
          </div>
          <div>
            <p className="text-2xl font-bold tabular-nums text-indigo-400">25</p>
            <p className="text-xs text-text-muted mt-0.5">Sessions total</p>
          </div>
        </div>

        {/* Model update */}
        <div className="rounded-xl bg-emerald-500/8 border border-emerald-500/20 p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle size={14} className="text-emerald-400" />
            <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">Behavioral Model Updated</span>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-text-muted text-xs">Previous sessions</p>
              <p className="font-semibold text-text-primary">24</p>
            </div>
            <div>
              <p className="text-text-muted text-xs">New sessions</p>
              <p className="font-semibold text-emerald-400">25</p>
            </div>
            <div>
              <p className="text-text-muted text-xs">Previous confidence</p>
              <p className="font-semibold text-text-primary">91%</p>
            </div>
            <div>
              <p className="text-text-muted text-xs">New confidence</p>
              <p className="font-semibold text-emerald-400">92%</p>
            </div>
          </div>
        </div>

        {/* Review answers */}
        <div className="rounded-xl bg-surface-800 border border-border overflow-hidden">
          <div className="px-5 py-3 border-b border-border">
            <p className="text-sm font-semibold text-text-primary">Answer Review</p>
          </div>
          <div className="divide-y divide-border max-h-64 overflow-y-auto">
            {questions.map((q, i) => {
              const selected = answers[q.id];
              const isCorrect = selected === q.correctIndex;
              return (
                <div key={q.id} className="px-5 py-3 flex items-start gap-3">
                  <span className="text-xs font-mono text-text-muted mt-0.5 flex-shrink-0 w-4">{i + 1}.</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-text-secondary truncate">{q.text}</p>
                    <div className="flex items-center gap-2 mt-1">
                      {isCorrect ? (
                        <CheckCircle size={11} className="text-emerald-400" />
                      ) : (
                        <AlertCircle size={11} className="text-rose-400" />
                      )}
                      <span className={`text-[11px] ${isCorrect ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {selected === undefined
                          ? 'Skipped'
                          : isCorrect
                          ? `Correct — ${(q.options || [])[q.correctIndex || 0] || 'Correct'}`
                          : `Wrong — correct: ${(q.options || [])[q.correctIndex || 0] || 'N/A'}`}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex gap-3">
          <Button
            variant="secondary"
            className="flex-1"
            onClick={() => { setPhase('intro'); setAnswers({}); setCurrentIndex(0); setTimeLeft(TOTAL_TIME_SECONDS); setSubmittingStep(0); }}
          >
            Take Another Session
          </Button>
          <Button
            variant="primary"
            className="flex-1"
            onClick={() => router.push('/student/dashboard')}
          >
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  // ── Active exam ────────────────────────────────────────────
  const isAnswered = answers[current.id] !== undefined;
  const isLowTime = timeLeft < 120;

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* Header bar */}
      <div className="rounded-xl bg-surface-800 border border-border px-5 py-3.5 flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">Data Structures & Algorithms</p>
          <p className="text-sm font-semibold text-text-primary mt-0.5">
            Question {currentIndex + 1} <span className="text-text-muted font-normal">of {questions.length}</span>
          </p>
        </div>
        <div className={[
          'flex items-center gap-2 px-3 py-1.5 rounded-lg border font-mono font-semibold text-sm',
          isLowTime
            ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
            : 'bg-surface-700 border-border text-text-primary',
        ].join(' ')}>
          <Clock size={13} />
          {formatTime(timeLeft)}
        </div>
      </div>

      {/* Progress */}
      <div className="space-y-2">
        <ProgressBar value={progress} color="indigo" size="xs" />
        <div className="flex gap-1">
          {questions.map((q, i) => (
            <button
              key={q.id}
              onClick={() => setCurrentIndex(i)}
              className={[
                'flex-1 h-1.5 rounded-full transition-colors',
                i === currentIndex
                  ? 'bg-indigo-500'
                  : answers[q.id] !== undefined
                  ? 'bg-emerald-500/60'
                  : 'bg-surface-600',
              ].join(' ')}
              aria-label={`Question ${i + 1}`}
            />
          ))}
        </div>
        <div className="flex justify-between text-[10px] text-text-muted">
          <span>{answeredCount} answered</span>
          <span>{questions.length - answeredCount} remaining</span>
        </div>
      </div>

      {/* Question card */}
      <div className="rounded-2xl bg-surface-800 border border-border overflow-hidden">
        {/* Difficulty pip */}
        <div className="px-6 pt-5 pb-2 flex items-center gap-2">
          <div className="flex gap-1">
            {[...Array(5)].map((_, i) => (
              <span
                key={i}
                className={`w-1.5 h-1.5 rounded-full ${i < current.difficulty ? 'bg-indigo-400' : 'bg-surface-600'}`}
              />
            ))}
          </div>
          <span className="text-[10px] text-text-muted">Difficulty {current.difficulty}/5 · {current.topic}</span>
        </div>

        {/* Question text */}
        <div className="px-6 pb-5">
          <p className="text-base font-medium text-text-primary leading-relaxed mb-5">
            {current.text}
          </p>

          {/* Options */}
          <div className="space-y-2.5">
            {(current.options || []).map((option, i) => {
              const selected = answers[current.id] === i;
              return (
                <button
                  key={i}
                  id={`option-${i}`}
                  onClick={() => handleAnswer(i)}
                  className={[
                    'w-full text-left flex items-center gap-3 px-4 py-3.5 rounded-xl border text-sm font-medium',
                    'transition-all duration-150',
                    selected
                      ? 'bg-indigo-600/15 border-indigo-500/40 text-indigo-300'
                      : 'bg-surface-700 border-border text-text-secondary hover:bg-surface-600 hover:border-border-strong hover:text-text-primary',
                  ].join(' ')}
                >
                  <span className={[
                    'w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 text-[10px] font-bold',
                    selected
                      ? 'border-indigo-400 bg-indigo-600 text-white'
                      : 'border-border text-text-muted',
                  ].join(' ')}>
                    {selected ? '●' : String.fromCharCode(65 + i)}
                  </span>
                  {option}
                </button>
              );
            })}
          </div>
        </div>

        {/* Navigation */}
        <div className="px-6 pb-5 flex items-center justify-between gap-3 border-t border-border pt-4">
          <Button
            variant="ghost"
            size="sm"
            leftIcon={<ChevronLeft size={14} />}
            onClick={handlePrev}
            disabled={currentIndex === 0}
          >
            Previous
          </Button>

          <div className="flex items-center gap-2">
            {!isAnswered && (
              <span className="text-[10px] text-text-muted">Not answered</span>
            )}
            {isAnswered && (
              <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                <CheckCircle size={10} /> Answered
              </span>
            )}
          </div>

          {isLastQuestion ? (
            <Button
              variant="primary"
              size="sm"
              rightIcon={<Send size={13} />}
              onClick={handleSubmit}
              id="submit-practice-btn"
            >
              Submit Session ({answeredCount}/{questions.length})
            </Button>
          ) : (
            <Button
              variant={isAnswered ? 'primary' : 'secondary'}
              size="sm"
              rightIcon={<ChevronRight size={14} />}
              onClick={handleNext}
              id="next-question-btn"
            >
              Next
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
