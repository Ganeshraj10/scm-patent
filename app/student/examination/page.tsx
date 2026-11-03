'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ProgressBar } from '@/components/ui/ProgressBar';
import {
  validationExamQuestions,
  VALIDATION_EXAM_CODE,
  VALIDATION_EXAM_TITLE,
} from '@/data/validationExamQuestions';
import {
  createGradedExamSession,
  saveQuestionTelemetry,
  completeGradedExamSession,
  completeGradedExamSessionAsync,
} from '@/lib/services/examSessionService';
import { getCurrentProfileClient } from '@/lib/services/auth';
import {
  QuestionTelemetryState,
  createInitialTelemetryState,
  finalizeQuestionTelemetry,
  recordMCQSelection,
  recordMultiSelectToggle,
  recordTextChange,
  recordCodeEdit,
  recordCodeRun,
  recordPasteEvent,
  recordIntegrityOpportunity,
  recordSequenceEvent,
  detectDeviceType,
} from '@/lib/services/examFeatureExtractor';
import { Question, GradedExamSession, IntegrityOpportunityEvent, CameraIntegrityEvent, LookAwayDirection } from '@/types';
import { MCQView } from '@/components/examination/MCQView';
import { MultipleSelectView } from '@/components/examination/MultipleSelectView';
import { ShortAnswerView } from '@/components/examination/ShortAnswerView';
import { CodingEditorView } from '@/components/examination/CodingEditorView';
import { CameraPreviewOverlay } from '@/components/examination/CameraPreviewOverlay';
import {
  CameraProctoringTracker,
  analyzeVideoFrame,
  estimateLookAwayDirection,
  RawFaceDetection,
} from '@/lib/services/cameraProctoringService';
import {
  Clock,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Users,
  ArrowRight,
  BookOpen,
  Code2,
  CheckSquare,
  FileText,
  HelpCircle,
  RefreshCw,
  Camera,
  Video,
  VideoOff,
  Eye,
} from 'lucide-react';

import { formatExamDate, formatAttendedDate } from '@/lib/formatters';

type ExamPhase = 'intro' | 'active' | 'completed';

const EXAM_DURATION_SECONDS = 25 * 60; // 25 minutes for validation exam

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function ExaminationPage() {
  const [phase, setPhase] = useState<ExamPhase>('intro');
  const [studentId, setStudentId] = useState<string>('S001');
  const [questions, setQuestions] = useState<Question[]>(validationExamQuestions);
  const [currentIndex, setCurrentIndex] = useState<number>(0);

  // Fullscreen state
  const [isFullscreenActive, setIsFullscreenActive] = useState<boolean>(false);
  const [fullscreenSupported, setFullscreenSupported] = useState<boolean>(true);
  const [fullscreenExitCount, setFullscreenExitCount] = useState<number>(0);
  const lastFullscreenStateRef = useRef<boolean>(false);

  // Camera Proctoring state
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraPermissionState, setCameraPermissionState] = useState<'prompt' | 'granted' | 'denied' | 'unsupported'>('prompt');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [introFaceDetection, setIntroFaceDetection] = useState<RawFaceDetection | null>(null);
  const [isCameraChecking, setIsCameraChecking] = useState<boolean>(false);
  const [liveDetection, setLiveDetection] = useState<RawFaceDetection>({
    faceDetected: true,
    faceCount: 1,
    confidence: 0.9,
  });
  const [liveDirection, setLiveDirection] = useState<LookAwayDirection>('forward');
  const introVideoRef = useRef<HTMLVideoElement | null>(null);
  const introCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const cameraTrackerRef = useRef<CameraProctoringTracker>(new CameraProctoringTracker());
  const cameraEventsRef = useRef<CameraIntegrityEvent[]>([]);

  // Resolve active student from Supabase Auth on mount
  useEffect(() => {
    getCurrentProfileClient().then((profile) => {
      if (profile?.student_identifier) {
        setStudentId(profile.student_identifier);
      } else if (profile?.student_id) {
        setStudentId(profile.student_id);
      }
    });

    if (typeof document !== 'undefined') {
      const isSupported = Boolean(
        document.fullscreenEnabled ||
        (document as any).webkitFullscreenEnabled ||
        (document as any).mozFullScreenEnabled ||
        (document as any).msFullscreenEnabled
      );
      setFullscreenSupported(isSupported);
    }
  }, []);

  // Request browser camera stream
  const handleEnableCamera = async () => {
    setCameraError(null);
    setIsCameraChecking(true);
    try {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraPermissionState('unsupported');
        setCameraError('Camera API is not supported in this browser environment.');
        setIsCameraChecking(false);
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 320, height: 240, facingMode: 'user' },
        audio: false,
      });

      setCameraStream(stream);
      setCameraPermissionState('granted');
      setIsCameraChecking(false);

      // Listen for unexpected track stops
      stream.getVideoTracks().forEach((track) => {
        track.onended = () => {
          console.warn('[Camera] Video track ended / disconnected');
          cameraTrackerRef.current.recordInterruption('Video track ended unexpectedly');
        };
      });
    } catch (err: any) {
      console.warn('[Camera] Camera access denied or failed:', err);
      setCameraPermissionState('denied');
      setIsCameraChecking(false);
      setCameraError(
        err.name === 'NotAllowedError'
          ? 'Camera permission was denied. Please allow camera access in browser settings to begin the monitored examination.'
          : err.message || 'Could not connect to a usable webcam device.'
      );
    }
  };

  // Preview face verification loop in intro phase
  useEffect(() => {
    if (phase !== 'intro' || !cameraStream || !introVideoRef.current || !introCanvasRef.current) return;

    introVideoRef.current.srcObject = cameraStream;
    introVideoRef.current.play().catch(() => {});

    const interval = setInterval(() => {
      if (introVideoRef.current && introCanvasRef.current) {
        const detection = analyzeVideoFrame(introVideoRef.current, introCanvasRef.current);
        setIntroFaceDetection(detection);
      }
    }, 500);

    return () => clearInterval(interval);
  }, [phase, cameraStream]);

  // Clean up camera stream on unmount
  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach((t) => t.stop());
      }
    };
  }, [cameraStream]);

  const handleCameraEvent = (event: CameraIntegrityEvent) => {
    const existingIdx = cameraEventsRef.current.findIndex((e) => e.id === event.id);
    if (existingIdx >= 0) {
      cameraEventsRef.current[existingIdx] = { ...event };
    } else {
      cameraEventsRef.current.push(event);
    }
  };
  
  // Student answer state
  const [answers, setAnswers] = useState<Record<number, any>>({});
  const [timeLeft, setTimeLeft] = useState<number>(EXAM_DURATION_SECONDS);
  const [session, setSession] = useState<GradedExamSession | null>(null);
  const [showConfirmSubmit, setShowConfirmSubmit] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);

  // Active question telemetry state ref
  const telemetryMap = useRef<Record<number, QuestionTelemetryState>>({});
  const lastMousePos = useRef<{ x: number; y: number } | null>(null);
  const lastScrollY = useRef<number | null>(null);
  const integrityEventsRef = useRef<IntegrityOpportunityEvent[]>([]);

  // Interactive Fullscreen Request Helper
  const handleRequestFullscreen = useCallback(async () => {
    if (typeof document === 'undefined') return;
    try {
      const docEl = document.documentElement as any;
      const requestMethod =
        docEl.requestFullscreen ||
        docEl.webkitRequestFullscreen ||
        docEl.mozRequestFullScreen ||
        docEl.msRequestFullscreen;

      if (requestMethod) {
        await requestMethod.call(docEl);
        setIsFullscreenActive(true);
        lastFullscreenStateRef.current = true;
      }
    } catch (err) {
      console.warn('[ExaminationPage] Fullscreen request not permitted or refused:', err);
      setIsFullscreenActive(false);
      lastFullscreenStateRef.current = false;
    }
  }, []);

  // Initialize active question telemetry state
  const initializeQuestionTelemetry = useCallback((index: number, questionList: Question[]) => {
    if (!questionList[index]) return;
    const q = questionList[index];

    if (!telemetryMap.current[index]) {
      const initialContent = (q.type === 'coding' || q.type === 'debugging') ? (q.starterCode || '') : '';
      telemetryMap.current[index] = createInitialTelemetryState(
        q.id,
        index + 1,
        q.difficulty || 0.5,
        q.type || 'mcq',
        initialContent
      );
    }
    telemetryMap.current[index].startTimeMs = Date.now();
    lastMousePos.current = null;
    lastScrollY.current = typeof window !== 'undefined' ? window.scrollY : null;
  }, []);

  // Finalize current question metrics before navigating
  const flushCurrentQuestionTelemetry = useCallback(() => {
    if (!session || !telemetryMap.current[currentIndex]) return;

    const state = telemetryMap.current[currentIndex];
    const currentQ = questions[currentIndex];
    if (state.startTimeMs !== null) {
      state.totalTimeMs += Date.now() - state.startTimeMs;
      state.startTimeMs = null;
    }

    // Determine correctness
    let isAnswerCorrect = false;
    if (currentQ) {
      if (currentQ.type === 'mcq') {
        isAnswerCorrect = state.selectedAnswerIndex !== null && state.selectedAnswerIndex === currentQ.correctIndex;
      } else if (currentQ.type === 'multiple_select') {
        const expected = (currentQ.correctIndices || []).slice().sort().join(',');
        const actual = (state.selectedAnswerIndices || []).slice().sort().join(',');
        isAnswerCorrect = expected === actual && actual.length > 0;
      } else if (currentQ.type === 'short_answer') {
        isAnswerCorrect = state.textAnswer.trim().length >= (currentQ.minWordCount || 10) * 4;
      } else if (currentQ.type === 'coding' || currentQ.type === 'debugging') {
        isAnswerCorrect = state.testCasesTotal > 0 && state.testCasesPassed === state.testCasesTotal;
      }
    }

    const telemetry = finalizeQuestionTelemetry(
      state,
      session.sessionId,
      session.studentId,
      session.deviceType,
      isAnswerCorrect
    );

    saveQuestionTelemetry(session.sessionId, telemetry);
  }, [session, currentIndex, questions]);

  // Start Exam Action
  const handleStartExam = async () => {
    // If camera stream not yet initialized, request it
    if (!cameraStream) {
      await handleEnableCamera();
    }

    const examQuestions = questions.length > 0 ? questions : validationExamQuestions;
    if (questions.length === 0) {
      setQuestions(examQuestions);
    }

    const newSession = createGradedExamSession({
      studentId,
      examId: VALIDATION_EXAM_CODE,
      examTitle: VALIDATION_EXAM_TITLE,
      questionCount: examQuestions.length,
      deviceType: detectDeviceType(),
    });

    // Request fullscreen on explicit start interaction
    await handleRequestFullscreen();

    setSession(newSession);
    initializeQuestionTelemetry(0, examQuestions);
    setPhase('active');
  };

  // Timer countdown
  useEffect(() => {
    if (phase !== 'active') return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleSubmitExam();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [phase]);

  // Mouse movement tracking (Euclidean distance & speed)
  useEffect(() => {
    if (phase !== 'active') return;

    const handleMouseMove = (e: MouseEvent) => {
      const state = telemetryMap.current[currentIndex];
      if (!state) return;

      if (lastMousePos.current) {
        const dx = e.clientX - lastMousePos.current.x;
        const dy = e.clientY - lastMousePos.current.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        state.pointerDistancePx += dist;
        state.pointerSampleCount += 1;
      }
      lastMousePos.current = { x: e.clientX, y: e.clientY };
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [phase, currentIndex]);

  // Scroll tracking (Distance & Events)
  useEffect(() => {
    if (phase !== 'active') return;

    const handleScroll = () => {
      const state = telemetryMap.current[currentIndex];
      if (!state) return;

      const currentScrollY = window.scrollY;
      if (lastScrollY.current !== null) {
        const delta = Math.abs(currentScrollY - lastScrollY.current);
        state.scrollDistancePx += delta;
        state.scrollEventsCount += 1;
      }
      lastScrollY.current = currentScrollY;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [phase, currentIndex]);

  // Global window paste listener
  useEffect(() => {
    if (phase !== 'active') return;

    const handlePaste = () => {
      const state = telemetryMap.current[currentIndex];
      if (state) {
        recordPasteEvent(state);
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [phase, currentIndex]);

  // Integrity Opportunity Events: Blur, Focus, Fullscreen, Copy, and Visibility
  useEffect(() => {
    if (phase !== 'active') return;

    const handleVisibility = () => {
      const state = telemetryMap.current[currentIndex];
      if (!state) return;

      if (document.hidden) {
        if (state.startTimeMs !== null) {
          state.totalTimeMs += Date.now() - state.startTimeMs;
          state.startTimeMs = null;
        }
        const evt = recordIntegrityOpportunity(state, 'page_visibility_change', 'Tab hidden or switched');
        integrityEventsRef.current.push(evt);
      } else {
        state.startTimeMs = Date.now();
        recordSequenceEvent(state, 'reconnection');
      }
    };

    const handleBlur = () => {
      const state = telemetryMap.current[currentIndex];
      if (state) {
        const evt = recordIntegrityOpportunity(state, 'window_blur', 'Window lost focus');
        integrityEventsRef.current.push(evt);
      }
    };

    const handleFullscreenChange = () => {
      const isFs = Boolean(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).mozFullScreenElement ||
        (document as any).msFullscreenElement
      );

      setIsFullscreenActive(isFs);

      const state = telemetryMap.current[currentIndex];
      // Only record fullscreen exit event if transitioning from previously active to inactive
      if (!isFs && lastFullscreenStateRef.current) {
        setFullscreenExitCount((prev) => prev + 1);
        if (state) {
          const evt = recordIntegrityOpportunity(state, 'fullscreen_exit', 'Exited fullscreen mode');
          integrityEventsRef.current.push(evt);
        }
      }
      lastFullscreenStateRef.current = isFs;
    };

    const handleCopy = () => {
      const state = telemetryMap.current[currentIndex];
      if (state) {
        const evt = recordIntegrityOpportunity(state, 'copy_attempt', 'Exam content copy attempt');
        integrityEventsRef.current.push(evt);
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('blur', handleBlur);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);
    window.addEventListener('copy', handleCopy);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
      window.removeEventListener('copy', handleCopy);
    };
  }, [phase, currentIndex]);

  // ─── Interaction Handlers ──────────────────────────────────────────────────

  const handleMCQSelect = (optionIndex: number) => {
    const state = telemetryMap.current[currentIndex];
    if (state) {
      recordMCQSelection(state, optionIndex);
    }
    setAnswers((prev) => ({ ...prev, [currentIndex]: optionIndex }));
  };

  const handleMultiSelectToggle = (optionIndex: number) => {
    const state = telemetryMap.current[currentIndex];
    if (state) {
      const updated = recordMultiSelectToggle(state, optionIndex);
      setAnswers((prev) => ({ ...prev, [currentIndex]: updated }));
    }
  };

  const handleShortAnswerChange = (text: string) => {
    const state = telemetryMap.current[currentIndex];
    if (state) {
      recordTextChange(state, text);
    }
    setAnswers((prev) => ({ ...prev, [currentIndex]: text }));
  };

  const handleCodeChange = (code: string) => {
    const state = telemetryMap.current[currentIndex];
    if (state) {
      recordCodeEdit(state, code);
    }
    setAnswers((prev) => ({ ...prev, [currentIndex]: code }));
  };

  const handleCodeRun = (passed: number, total: number) => {
    const state = telemetryMap.current[currentIndex];
    if (state) {
      recordCodeRun(state, passed, total);
    }
  };

  const handleSpecificPaste = () => {
    const state = telemetryMap.current[currentIndex];
    if (state) {
      recordPasteEvent(state);
    }
  };

  const handleGoToQuestion = (targetIndex: number) => {
    if (targetIndex < 0 || targetIndex >= questions.length || targetIndex === currentIndex) return;

    flushCurrentQuestionTelemetry();
    setCurrentIndex(targetIndex);
    initializeQuestionTelemetry(targetIndex, questions);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmitExam = async () => {
    if (!session || isSubmitting) return;
    setIsSubmitting(true);
    setSubmissionError(null);

    try {
      flushCurrentQuestionTelemetry();
      if (integrityEventsRef.current.length > 0) {
        session.integrityOpportunityEvents = [...integrityEventsRef.current];
      }

      // Attach camera events and summarize camera evidence
      const examElapsedSec = Math.max(1, EXAM_DURATION_SECONDS - timeLeft);
      session.cameraIntegrityEvents = [...cameraEventsRef.current];
      session.cameraEvidenceSummary = cameraTrackerRef.current.summarize(examElapsedSec);

      const updated = await completeGradedExamSessionAsync(session.sessionId);
      if (updated) {
        setSession({ ...updated });
      }

      // Clean up camera stream
      if (cameraStream) {
        cameraStream.getTracks().forEach((t) => t.stop());
      }

      setPhase('completed');
    } catch (err: any) {
      console.error('[ExaminationPage] Exam submission persistence failed:', err);
      setSubmissionError(err?.message || 'Database persistence failed. Please try submitting again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const answeredCount = Object.keys(answers).length;
  const currentQ = questions[currentIndex];
  const progressPct = questions.length > 0 ? ((currentIndex + 1) / questions.length) * 100 : 0;

  const getTypeBadge = (type?: string) => {
    switch (type) {
      case 'multiple_select':
        return <Badge variant="verified" size="sm">Multiple Select</Badge>;
      case 'short_answer':
        return <Badge variant="medium" size="sm">Short Answer</Badge>;
      case 'coding':
        return <Badge variant="graded" size="sm">Coding Problem</Badge>;
      case 'debugging':
        return <Badge variant="review_required" size="sm">Code Debugging</Badge>;
      default:
        return <Badge variant="default" size="sm">Multiple Choice</Badge>;
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* ─── PHASE 1: INTRO & PRIVACY SCREEN ─── */}
      {phase === 'intro' && (
        <Card padding="lg" className="border-indigo-500/30 shadow-2xl">
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/80 pb-5">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    Stage 7 Behavioral Validation
                  </span>
                  <Badge variant="active" size="sm">
                    Student ID: {studentId}
                  </Badge>
                </div>
                <h1 className="text-2xl font-black text-text-primary mt-1 tracking-tight">
                  {VALIDATION_EXAM_TITLE}
                </h1>
                <p className="text-xs text-text-muted mt-0.5">
                  Assessment Code: {VALIDATION_EXAM_CODE} · Multi-Format Technical Validation
                </p>
              </div>

              {/* Student identity switcher */}
              <div className="flex items-center gap-1 bg-surface-700/60 p-1.5 rounded-xl border border-border text-xs">
                <span className="text-[11px] text-text-muted px-1.5">Student:</span>
                {['S001', 'S002', 'S003', 'S004'].map((sId) => (
                  <button
                    key={sId}
                    type="button"
                    onClick={() => setStudentId(sId)}
                    className={`px-2 py-0.5 rounded text-xs font-mono font-bold transition-all ${
                      studentId === sId ? 'bg-indigo-600 text-white' : 'text-text-muted hover:text-text-primary'
                    }`}
                  >
                    {sId}
                  </button>
                ))}
              </div>
            </div>

            {/* Exam Parameters Overview */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-xl bg-surface-700/30 border border-border">
                <span className="text-[10px] text-text-muted block">Duration</span>
                <span className="text-base font-bold text-text-primary font-mono">25 Minutes</span>
              </div>
              <div className="p-3 rounded-xl bg-surface-700/30 border border-border">
                <span className="text-[10px] text-text-muted block">Total Questions</span>
                <span className="text-base font-bold text-text-primary font-mono">{questions.length} Questions</span>
              </div>
              <div className="p-3 rounded-xl bg-surface-700/30 border border-border">
                <span className="text-[10px] text-text-muted block">Question Formats</span>
                <span className="text-xs font-bold text-indigo-300">MCQ, MSQ, Text, Code, Debug</span>
              </div>
              <div className="p-3 rounded-xl bg-surface-700/30 border border-border">
                <span className="text-[10px] text-text-muted block">Environment</span>
                <span className="text-base font-bold text-emerald-400 font-mono">Graded Exam</span>
              </div>
            </div>

            {/* Formats Included */}
            <div className="p-4 rounded-xl bg-surface-700/20 border border-border/70 text-xs space-y-2">
              <span className="font-bold text-text-primary block text-xs">Supported Question Types in this Exam:</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-text-secondary text-[11px]">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-indigo-400 shrink-0" />
                  <span><strong>Multiple Choice & Multiple Select</strong> (Single & Multi-Select)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-sky-400 shrink-0" />
                  <span><strong>Short Answer</strong> (Algorithmic explanations & analysis)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                  <span><strong>Coding Problems</strong> (Python/JS with in-browser runner)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                  <span><strong>Code Debugging</strong> (Fixing faulty recursive logic)</span>
                </div>
              </div>
            </div>

            {/* Camera Proctoring & Fullscreen Verification Notice */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Fullscreen Requirement Card */}
              <div className="p-4 rounded-2xl bg-indigo-950/30 border border-indigo-500/30 space-y-2">
                <div className="flex items-center gap-2 text-indigo-300 font-bold text-xs">
                  <ShieldCheck size={16} className="text-sky-400 shrink-0" />
                  <span>Fullscreen Requirement</span>
                </div>
                <p className="text-[11px] text-text-muted leading-relaxed">
                  Graded examinations require fullscreen mode to establish interaction continuity. Fullscreen will be requested when you click Start below.
                </p>
                <div className="p-2.5 rounded-lg bg-surface-900/80 border border-border/80 text-[10px] text-sky-300 font-medium">
                  {fullscreenSupported
                    ? 'Browser Fullscreen API is supported on this device.'
                    : 'Note: Fullscreen may be restricted on some mobile browsers. The exam will adapt gracefully.'}
                </div>
              </div>

              {/* Camera Proctoring & Verification Card */}
              <div className="p-4 rounded-2xl bg-indigo-950/30 border border-indigo-500/30 space-y-2.5">
                <div className="flex items-center justify-between gap-2 text-indigo-300 font-bold text-xs">
                  <div className="flex items-center gap-2">
                    <Camera size={16} className="text-emerald-400 shrink-0" />
                    <span>Camera Proctoring Layer</span>
                  </div>
                  {cameraStream && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                      <CheckCircle2 size={10} /> Active
                    </span>
                  )}
                </div>

                <p className="text-[11px] text-text-muted leading-relaxed">
                  Layer 2 optical monitoring tracks face presence and estimated head orientation locally. <strong>No raw continuous video is stored or uploaded.</strong>
                </p>

                {/* Interactive Stream Check */}
                {!cameraStream ? (
                  <div className="space-y-2">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={handleEnableCamera}
                      disabled={isCameraChecking}
                      className="w-full text-xs font-semibold gap-1.5"
                    >
                      <Video size={13} />
                      {isCameraChecking ? 'Connecting Camera...' : 'Enable Camera & Verify Stream'}
                    </Button>
                    {cameraError && (
                      <p className="text-[10px] text-rose-400 font-medium leading-tight">{cameraError}</p>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-3 p-2 rounded-xl bg-surface-900/80 border border-border/80">
                    <video
                      ref={introVideoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-20 h-14 object-cover rounded-lg bg-black border border-indigo-500/40 transform -scale-x-100"
                    />
                    <canvas ref={introCanvasRef} className="hidden" />
                    <div className="space-y-1 text-xs">
                      <span className="font-bold text-emerald-400 block text-[11px]">
                        {introFaceDetection?.faceDetected ? 'Face Detected & Ready' : 'Position Face in Center'}
                      </span>
                      <span className="text-[10px] text-text-muted block">
                        Real-time presence active · Ready to begin
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Start Button */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-border/60">
              <span className="text-[11px] text-text-muted">
                Clicking Start will launch fullscreen mode and start the monitored 25-minute examination.
              </span>
              <Button
                variant="primary"
                size="lg"
                onClick={handleStartExam}
                className="text-sm font-bold shadow-lg shadow-indigo-500/20 px-8 w-full sm:w-auto"
              >
                Start Validation Examination
                <ArrowRight size={16} className="ml-2" />
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* ─── PHASE 2: ACTIVE EXAMINATION ─── */}
      {phase === 'active' && currentQ && (
        <div className="space-y-5">
          {/* Floating Camera Proctoring Preview */}
          <CameraPreviewOverlay
            stream={cameraStream}
            tracker={cameraTrackerRef.current}
            onEventGenerated={handleCameraEvent}
            onDetectionUpdate={(det, dir) => {
              setLiveDetection(det);
              setLiveDirection(dir);
            }}
            isExamActive={phase === 'active'}
            questionContext={{ id: currentQ.id, position: currentIndex + 1 }}
          />

          {/* Real-Time Live Proctoring & Fullscreen Alert Banners */}
          <div className="space-y-2">
            {/* 1. Fullscreen Exit Alert Banner */}
            {!isFullscreenActive && (
              <div className="p-3 rounded-xl bg-amber-500/15 border-2 border-amber-500/50 backdrop-blur-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg animate-pulse">
                <div className="flex items-center gap-2.5">
                  <AlertTriangle className="text-amber-400 shrink-0" size={18} />
                  <div>
                    <span className="font-bold text-amber-200 text-xs block">
                      Fullscreen Mode Inactive {fullscreenExitCount > 0 && `(Exited: ${fullscreenExitCount}x)`}
                    </span>
                    <p className="text-[11px] text-amber-300/80">
                      Exiting full-screen is recorded in the integrity audit log. Please re-enter full-screen mode to comply with proctoring standards.
                    </p>
                  </div>
                </div>
                {fullscreenSupported && (
                  <button
                    type="button"
                    onClick={handleRequestFullscreen}
                    className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-400 text-surface-950 transition-colors shrink-0 shadow-md cursor-pointer flex items-center gap-1.5"
                  >
                    <ShieldCheck size={13} />
                    Re-enter Fullscreen
                  </button>
                )}
              </div>
            )}

            {/* 2. Multiple Faces Security Warning */}
            {cameraStream && liveDetection.faceCount > 1 && (
              <div className="p-3 rounded-xl bg-rose-500/20 border-2 border-rose-500/60 backdrop-blur-md flex items-center gap-3 shadow-xl animate-bounce">
                <Users className="text-rose-400 shrink-0" size={20} />
                <div className="space-y-0.5">
                  <span className="font-bold text-rose-200 text-xs flex items-center gap-1.5">
                    Security Warning: Multiple People Detected in Camera Feed
                  </span>
                  <p className="text-[11px] text-rose-300/90">
                    {liveDetection.faceCount} distinct faces are currently detected in your camera view. The examination must be completed individually without external assistance.
                  </p>
                </div>
              </div>
            )}

            {/* 3. No Face in View Warning */}
            {cameraStream && !liveDetection.faceDetected && (
              <div className="p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/40 backdrop-blur-md flex items-center gap-2.5 shadow-md">
                <AlertCircle className="text-amber-400 shrink-0" size={18} />
                <div className="space-y-0.5">
                  <span className="font-bold text-amber-200 text-xs">
                    Camera Notice: No Face Detected in Frame
                  </span>
                  <p className="text-[11px] text-amber-300/80">
                    Please ensure your face is fully visible within the camera view. Continuous camera presence is required.
                  </p>
                </div>
              </div>
            )}

            {/* 4. Look-Away Attention Notice */}
            {cameraStream &&
              liveDetection.faceDetected &&
              liveDirection !== 'forward' &&
              liveDirection !== 'uncertain' && (
                <div className="p-2.5 rounded-xl bg-sky-500/15 border border-sky-500/40 backdrop-blur-md flex items-center gap-2.5 shadow-md">
                  <Eye className="text-sky-400 shrink-0" size={18} />
                  <div className="space-y-0.5">
                    <span className="font-bold text-sky-200 text-xs">
                      Attention Notice: Gaze Diverted (Looking {liveDirection.toUpperCase()})
                    </span>
                    <p className="text-[11px] text-sky-300/80">
                      Please keep your attention focused forward onto your examination screen.
                    </p>
                  </div>
                </div>
              )}
          </div>

          {/* Top Exam Header Bar */}
          <Card padding="sm" className="bg-surface-800/90 border-border">
            <div className="p-2 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">
                    Graded Validation Session
                  </span>
                  {getTypeBadge(currentQ.type)}

                  {/* Camera Status Indicator */}
                  {cameraStream ? (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                      <Camera size={11} className="text-emerald-400" />
                      CAMERA: Active
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1">
                      <VideoOff size={11} className="text-amber-400" />
                      CAMERA: Inactive
                    </span>
                  )}

                  {/* Persistent Fullscreen Status Indicator */}
                  {isFullscreenActive ? (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                      <ShieldCheck size={11} className="text-emerald-400" />
                      FULLSCREEN: Active
                    </span>
                  ) : (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1">
                        <AlertTriangle size={11} className="text-amber-400" />
                        FULLSCREEN: Exited / Attention Required
                      </span>
                      {fullscreenSupported && (
                        <button
                          type="button"
                          onClick={handleRequestFullscreen}
                          className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 transition-colors cursor-pointer"
                          title="Re-enter Fullscreen Mode"
                        >
                          Re-enter Fullscreen
                        </button>
                      )}
                    </div>
                  )}
                </div>
                <h2 className="text-sm font-bold text-text-primary">
                  {VALIDATION_EXAM_TITLE}
                </h2>
              </div>

              <div className="flex items-center gap-3 justify-between lg:justify-end">
                {/* Timer */}
                <div
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-mono text-xs font-bold border ${
                    timeLeft < 300
                      ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse'
                      : 'bg-surface-700 text-text-primary border-border'
                  }`}
                >
                  <Clock size={14} className={timeLeft < 300 ? 'text-rose-400' : 'text-indigo-400'} />
                  <span>{formatTime(timeLeft)}</span>
                </div>

                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowConfirmSubmit(true)}
                  className="text-xs font-semibold"
                >
                  Submit Exam
                </Button>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="px-2 pb-1">
              <div className="flex items-center justify-between text-[10px] text-text-muted mb-1">
                <span>
                  Question {currentIndex + 1} of {questions.length} · {currentQ.title || `Question ${currentIndex + 1}`}
                </span>
                <span>{answeredCount} Answered</span>
              </div>
              <ProgressBar value={progressPct} size="xs" color="indigo" />
            </div>
          </Card>

          {/* Question Navigation Palette */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {questions.map((q, idx) => {
              const isAnswered = answers[idx] !== undefined;
              const isCurrent = idx === currentIndex;
              return (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => handleGoToQuestion(idx)}
                  className={`w-8 h-8 rounded-lg text-xs font-bold font-mono transition-all shrink-0 ${
                    isCurrent
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/30 scale-105'
                      : isAnswered
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : 'bg-surface-700 text-text-muted hover:text-text-primary border border-border'
                  }`}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>

          {/* Active Question Card */}
          <Card padding="lg" className="border-border space-y-6">
            {/* Question Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs font-bold font-mono">
                  Q{currentIndex + 1}
                </span>
                <h3 className="text-sm font-bold text-text-primary">{currentQ.title || currentQ.topic}</h3>
              </div>
              <div className="flex items-center gap-3 text-[11px] text-text-muted font-mono">
                <span>Topic: <strong className="text-text-secondary">{currentQ.topic}</strong></span>
                <span>·</span>
                <span>Difficulty: <strong className="text-sky-400">{currentQ.difficulty?.toFixed(2) || '0.50'}</strong></span>
              </div>
            </div>

            {/* Question Prompt */}
            <div className="text-sm font-semibold text-text-primary leading-relaxed">
              {currentQ.text}
            </div>

            {/* Dynamic Question Type View */}
            {currentQ.type === 'multiple_select' ? (
              <MultipleSelectView
                question={currentQ}
                selectedIndices={answers[currentIndex] || []}
                onToggleOption={handleMultiSelectToggle}
              />
            ) : currentQ.type === 'short_answer' ? (
              <ShortAnswerView
                question={currentQ}
                textAnswer={answers[currentIndex] || ''}
                onChange={handleShortAnswerChange}
                onPaste={handleSpecificPaste}
              />
            ) : currentQ.type === 'coding' || currentQ.type === 'debugging' ? (
              <CodingEditorView
                question={currentQ}
                codeAnswer={answers[currentIndex] !== undefined ? answers[currentIndex] : (currentQ.starterCode || '')}
                onCodeChange={handleCodeChange}
                onPaste={handleSpecificPaste}
                onCodeRun={handleCodeRun}
              />
            ) : (
              <MCQView
                question={currentQ}
                selectedIndex={answers[currentIndex] !== undefined ? answers[currentIndex] : null}
                onSelectOption={handleMCQSelect}
              />
            )}

            {/* Submission Error Banner */}
            {submissionError && (
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-3 text-xs">
                <AlertTriangle size={16} className="text-rose-400 shrink-0 mt-0.5" />
                <div className="flex-1 space-y-1">
                  <p className="font-bold text-rose-300">Persistence Error — Submission Not Saved</p>
                  <p className="text-rose-200/80 leading-relaxed">{submissionError}</p>
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleSubmitExam}
                  disabled={isSubmitting}
                  className="bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-bold shrink-0"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw size={12} className="animate-spin mr-1" />
                      Retrying...
                    </>
                  ) : (
                    'Retry Submission'
                  )}
                </Button>
              </div>
            )}

            {/* Navigation Buttons Footer */}
            <div className="flex items-center justify-between pt-4 border-t border-border">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleGoToQuestion(currentIndex - 1)}
                disabled={currentIndex === 0 || isSubmitting}
                className="text-xs"
              >
                <ChevronLeft size={14} className="mr-1" />
                Previous Question
              </Button>

              {currentIndex < questions.length - 1 ? (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => handleGoToQuestion(currentIndex + 1)}
                  disabled={isSubmitting}
                  className="text-xs font-bold"
                >
                  Next Question
                  <ChevronRight size={14} className="ml-1" />
                </Button>
              ) : (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setShowConfirmSubmit(true)}
                  disabled={isSubmitting}
                  className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-900/30 font-bold"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw size={14} className="animate-spin mr-1.5" />
                      Saving to Database...
                    </>
                  ) : (
                    <>
                      Finish & Submit Exam
                      <CheckCircle2 size={14} className="ml-1.5" />
                    </>
                  )}
                </Button>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* ─── PHASE 3: SUBMISSION COMPLETED ─── */}
      {phase === 'completed' && (
        <Card padding="lg" className="border-emerald-500/30 shadow-2xl">
          <div className="py-8 text-center space-y-5 max-w-lg mx-auto">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/10">
              <CheckCircle2 size={28} />
            </div>

            <div className="space-y-1">
              <h2 className="text-2xl font-black text-text-primary tracking-tight">
                Exam Submitted Successfully
              </h2>
              <p className="text-xs text-text-muted leading-relaxed">
                Your multi-format examination responses and real-time interaction signals have been recorded securely.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-surface-700/40 border border-border text-xs space-y-2 text-left font-mono">
              <div className="flex justify-between py-1 border-b border-border/50">
                <span className="text-text-muted font-sans">Session ID:</span>
                <span className="font-bold text-sky-400">{session?.sessionId}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/50">
                <span className="text-text-muted font-sans">Student ID:</span>
                <span className="font-bold text-text-primary">{session?.studentId}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/50">
                <span className="text-text-muted font-sans">Started:</span>
                <span className="text-text-secondary">{formatExamDate(session?.startedAt)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/50">
                <span className="text-text-muted font-sans">Submitted:</span>
                <span className="text-text-secondary">{formatExamDate(session?.completedAt || new Date().toISOString())}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/50">
                <span className="text-text-muted font-sans">Questions Answered:</span>
                <span className="font-bold text-text-primary">
                  {answeredCount} of {questions.length}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-text-muted font-sans">Session Status:</span>
                <span className="font-bold text-emerald-400 font-sans">Completed & Persisted to Supabase</span>
              </div>
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <Link href="/student/dashboard">
                <Button variant="primary" size="sm" className="text-xs">
                  Return to Dashboard
                </Button>
              </Link>
              <Link href="/student/history">
                <Button variant="secondary" size="sm" className="text-xs">
                  View Session History
                </Button>
              </Link>
            </div>
          </div>
        </Card>
      )}

      {/* Confirmation Modal */}
      {showConfirmSubmit && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-800 border border-border rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 text-xs">
            <h3 className="text-base font-bold text-text-primary">Submit Validation Examination?</h3>
            <p className="text-text-secondary leading-relaxed">
              You have answered <strong>{answeredCount}</strong> of <strong>{questions.length}</strong> questions.
              {answeredCount < questions.length && (
                <span className="text-amber-400 block mt-1">
                  Warning: You have {questions.length - answeredCount} unanswered questions remaining.
                </span>
              )}
            </p>
            <div className="flex justify-end gap-2.5 pt-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowConfirmSubmit(false)}
                disabled={isSubmitting}
                className="text-xs"
              >
                Continue Exam
              </Button>
              <Button
                variant="primary"
                size="sm"
                disabled={isSubmitting}
                onClick={async () => {
                  setShowConfirmSubmit(false);
                  await handleSubmitExam();
                }}
                className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white"
              >
                {isSubmitting ? 'Persisting to Database...' : 'Confirm Submission'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
