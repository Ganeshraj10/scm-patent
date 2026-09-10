/**
 * ExamGuard — Real-Time Behavioral Feature Extractor
 * 
 * Stage 7 Correction: Privacy-preserving client-side telemetry capture engine
 * with rapid character insertion rate measurement and character-burst detection.
 * 
 * Privacy Policy:
 * - NO raw mouse trajectories or coordinate streams are stored.
 * - NO raw keystrokes or text contents are logged for behavioral analysis.
 * - NO clipboard contents are read or stored.
 * - NO audio or video is captured.
 */

import {
  ExamQuestionTelemetry,
  QuestionType,
  BehavioralSequenceEvent,
  BehavioralEventType,
  IntegrityOpportunityEvent,
  IntegrityEventType,
} from '@/types';
import { createSequenceEvent } from '@/lib/services/behavioralSequenceEngine';

// ─── Character Burst Configuration ──────────────────────────────────────────

export const CHARACTER_BURST_CONFIG = {
  // Human typing is typically 4–15 characters/sec (approx 40–120 WPM).
  // Rates exceeding 100 characters/sec represent superhuman/burst insertion.
  BURST_RATE_THRESHOLD_CHARS_PER_SEC: 100,

  // Single-event instant character addition threshold (e.g. pasting >= 60 chars in a single change event).
  SINGLE_EVENT_CHAR_THRESHOLD: 60,

  // Minimum characters in an insertion to qualify for rate-based burst evaluation.
  MIN_BURST_CHARS_THRESHOLD: 35,

  // Minimum elapsed time (ms) to avoid division by zero or infinite spikes.
  MIN_TIME_WINDOW_MS: 50,
};

export interface InsertionRateResult {
  deltaChars: number;
  elapsedMs: number;
  insertionRateCharsPerSec: number;
  isBurst: boolean;
  reason: string;
}

/**
 * Reusable helper to calculate character insertion rate (chars/sec) and evaluate burst status.
 */
export function calculateInsertionRate(
  deltaChars: number,
  elapsedMs: number
): InsertionRateResult {
  if (deltaChars <= 0) {
    return {
      deltaChars: 0,
      elapsedMs,
      insertionRateCharsPerSec: 0,
      isBurst: false,
      reason: 'No characters inserted',
    };
  }

  // Enforce minimum time interval to avoid division-by-zero or Infinity
  const safeElapsedMs = Math.max(CHARACTER_BURST_CONFIG.MIN_TIME_WINDOW_MS, elapsedMs);
  const elapsedSec = safeElapsedMs / 1000;
  const insertionRateCharsPerSec = Number((deltaChars / elapsedSec).toFixed(1));

  let isBurst = false;
  let reason = 'Normal typing cadence';

  // Rule 1: High insertion rate (>= 100 chars/sec) on a non-trivial insertion (>= 35 chars)
  if (
    deltaChars >= CHARACTER_BURST_CONFIG.MIN_BURST_CHARS_THRESHOLD &&
    insertionRateCharsPerSec >= CHARACTER_BURST_CONFIG.BURST_RATE_THRESHOLD_CHARS_PER_SEC
  ) {
    isBurst = true;
    reason = `Superhuman insertion rate: ${insertionRateCharsPerSec} chars/sec (>= ${CHARACTER_BURST_CONFIG.BURST_RATE_THRESHOLD_CHARS_PER_SEC} chars/sec threshold)`;
  }
  // Rule 2: Large instant single-event insertion (>= 60 chars occurring in a single input change within < 800ms)
  else if (
    deltaChars >= CHARACTER_BURST_CONFIG.SINGLE_EVENT_CHAR_THRESHOLD &&
    safeElapsedMs <= 800
  ) {
    isBurst = true;
    reason = `Large instant insertion: ${deltaChars} chars in ${safeElapsedMs}ms (${insertionRateCharsPerSec} chars/sec)`;
  }

  return {
    deltaChars,
    elapsedMs: safeElapsedMs,
    insertionRateCharsPerSec,
    isBurst,
    reason,
  };
}

export interface QuestionTelemetryState {
  questionId: string;
  questionType: QuestionType;
  sessionPosition: number;
  questionDifficulty: number;
  
  // MCQ / Selection state
  selectedAnswerIndex: number | null;
  selectedAnswerIndices: number[];
  initialAnswerTimeMs: number | null;
  lastRevisionTimeMs: number | null;
  revisionCount: number;

  // Text / Code Editing State
  textAnswer: string;
  codeAnswer: string;
  codeRevisionCount: number;
  timeToFirstEditMs: number | null;
  codeRunCount: number;
  testCasesPassed: number;
  testCasesTotal: number;

  // Time & Interaction metrics (All 9 Core Features)
  totalTimeMs: number;
  startTimeMs: number | null;
  pointerDistancePx: number;
  pointerSampleCount: number;
  scrollDistancePx: number;
  scrollEventsCount: number;
  pasteDetected: number;
  characterBurstFlag: number;

  // Real-time burst detection diagnostics
  maxInsertionRate: number;
  maxCharsInserted: number;
  burstReason: string;

  // Real-time burst tracking state (ephemeral)
  lastInputTimeMs: number | null;
  lastInputLength: number;

  // Sequence and Integrity events tracking
  sequenceEvents: BehavioralSequenceEvent[];
  integrityEvents: IntegrityOpportunityEvent[];
  lastEventTimestampMs: number | null;
}

export function detectDeviceType(): 'web_desktop' | 'web_laptop' | 'mobile' {
  if (typeof window === 'undefined') return 'web_desktop';
  const ua = navigator.userAgent.toLowerCase();

  const isMobile = /iphone|ipad|ipod|android|blackberry|mini|windows\sce|palm/i.test(ua);
  if (isMobile) return 'mobile';

  const isTouchLaptop = navigator.maxTouchPoints > 0 && window.innerWidth <= 1440;
  if (isTouchLaptop || window.innerWidth < 1366) {
    return 'web_laptop';
  }

  return 'web_desktop';
}

export function createInitialTelemetryState(
  questionId: string,
  sessionPosition: number,
  questionDifficulty: number = 0.5,
  questionType: QuestionType = 'mcq',
  initialContent: string = ''
): QuestionTelemetryState {
  const now = Date.now();
  const initialSequenceEvents: BehavioralSequenceEvent[] = [
    createSequenceEvent('question_view', null, now, questionId, sessionPosition),
  ];

  return {
    questionId,
    questionType,
    sessionPosition,
    questionDifficulty,
    selectedAnswerIndex: null,
    selectedAnswerIndices: [],
    initialAnswerTimeMs: null,
    lastRevisionTimeMs: null,
    revisionCount: 0,
    textAnswer: questionType === 'short_answer' ? initialContent : '',
    codeAnswer: questionType === 'coding' || questionType === 'debugging' ? initialContent : '',
    codeRevisionCount: 0,
    timeToFirstEditMs: null,
    codeRunCount: 0,
    testCasesPassed: 0,
    testCasesTotal: 0,
    totalTimeMs: 0,
    startTimeMs: now,
    pointerDistancePx: 0,
    pointerSampleCount: 0,
    scrollDistancePx: 0,
    scrollEventsCount: 0,
    pasteDetected: 0,
    characterBurstFlag: 0,
    maxInsertionRate: 0,
    maxCharsInserted: 0,
    burstReason: 'Normal typing cadence',
    lastInputTimeMs: null,
    lastInputLength: initialContent ? initialContent.length : 0,
    sequenceEvents: initialSequenceEvents,
    integrityEvents: [],
    lastEventTimestampMs: now,
  };
}

// ─── Sequence Event Helper ──────────────────────────────────────────────────

export function recordSequenceEvent(
  state: QuestionTelemetryState,
  eventType: BehavioralEventType,
  details?: Record<string, any>
): void {
  const now = Date.now();
  const prevTime = state.lastEventTimestampMs || state.startTimeMs || now;
  const evt = createSequenceEvent(
    eventType,
    prevTime,
    now,
    state.questionId,
    state.sessionPosition,
    undefined,
    details
  );
  state.sequenceEvents.push(evt);
  state.lastEventTimestampMs = now;
}

export function recordIntegrityOpportunity(
  state: QuestionTelemetryState,
  eventType: IntegrityEventType,
  contextSummary: string,
  durationMs?: number
): IntegrityOpportunityEvent {
  const now = new Date();
  const existingSameType = state.integrityEvents.filter((e) => e.eventType === eventType);
  const occurrenceIndex = existingSameType.length + 1;
  const isIsolated = occurrenceIndex === 1;

  const event: IntegrityOpportunityEvent = {
    id: `INT_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    eventType,
    timestamp: now.toISOString(),
    questionId: state.questionId,
    sessionPosition: state.sessionPosition,
    durationMs,
    isIsolated,
    occurrenceIndex,
    contextSummary: `${contextSummary} (Occurrence ${occurrenceIndex})`,
  };

  state.integrityEvents.push(event);

  // Map to sequence event as well
  let seqType: BehavioralEventType = 'page_visibility_change';
  if (eventType === 'fullscreen_exit') seqType = 'fullscreen_exit';
  if (eventType === 'paste_attempt') seqType = 'paste_attempt';
  if (eventType === 'connection_interrupt') seqType = 'connection_interrupt';
  if (eventType === 'reconnection') seqType = 'reconnection';
  if (eventType === 'navigation_away') seqType = 'navigation';

  recordSequenceEvent(state, seqType, { integrityEventId: event.id });
  return event;
}

// ─── Behavioral Signal Handlers ─────────────────────────────────────────────

/**
 * Record a single-option MCQ selection and track revision count/timing.
 */
export function recordMCQSelection(
  state: QuestionTelemetryState,
  optionIndex: number
): void {
  const now = Date.now();
  if (state.selectedAnswerIndex === null) {
    state.initialAnswerTimeMs = now;
    recordSequenceEvent(state, 'answer_select', { optionIndex });
  } else if (state.selectedAnswerIndex !== optionIndex) {
    state.revisionCount += 1;
    state.lastRevisionTimeMs = now;
    recordSequenceEvent(state, 'answer_change', { from: state.selectedAnswerIndex, to: optionIndex });
    recordSequenceEvent(state, 'revision', { revisionNumber: state.revisionCount });
  }
  state.selectedAnswerIndex = optionIndex;
}

/**
 * Record a multiple-select checkbox toggle and track revision count.
 */
export function recordMultiSelectToggle(
  state: QuestionTelemetryState,
  optionIndex: number
): number[] {
  const now = Date.now();
  const current = new Set(state.selectedAnswerIndices);

  if (current.has(optionIndex)) {
    current.delete(optionIndex);
  } else {
    current.add(optionIndex);
  }

  if (state.initialAnswerTimeMs === null) {
    state.initialAnswerTimeMs = now;
    recordSequenceEvent(state, 'answer_select', { optionIndex });
  } else {
    state.revisionCount += 1;
    state.lastRevisionTimeMs = now;
    recordSequenceEvent(state, 'answer_change', { toggled: optionIndex });
    recordSequenceEvent(state, 'revision', { revisionNumber: state.revisionCount });
  }

  state.selectedAnswerIndices = Array.from(current).sort((a, b) => a - b);
  return state.selectedAnswerIndices;
}

/**
 * Record short-answer text changes with character-burst detection.
 */
export function recordTextChange(
  state: QuestionTelemetryState,
  newText: string
): void {
  const now = Date.now();
  const deltaChars = newText.length - state.lastInputLength;
  const prevTime = state.lastInputTimeMs || state.startTimeMs || now;
  const elapsedMs = Math.max(10, now - prevTime);

  if (deltaChars > 0) {
    const rateResult = calculateInsertionRate(deltaChars, elapsedMs);
    state.maxInsertionRate = Math.max(state.maxInsertionRate, rateResult.insertionRateCharsPerSec);
    state.maxCharsInserted = Math.max(state.maxCharsInserted, deltaChars);

    if (rateResult.isBurst) {
      state.characterBurstFlag = 1;
      state.burstReason = rateResult.reason;
      recordSequenceEvent(state, 'character_insertion', { burst: true, rate: rateResult.insertionRateCharsPerSec });
    } else {
      recordSequenceEvent(state, 'typing', { deltaChars });
    }
  }

  if (state.initialAnswerTimeMs === null && newText.length > 0) {
    state.initialAnswerTimeMs = now;
    recordSequenceEvent(state, 'answer_select', { initialInputLength: newText.length });
  } else if (newText !== state.textAnswer) {
    state.revisionCount += 1;
    state.lastRevisionTimeMs = now;
    recordSequenceEvent(state, 'revision', { revisionNumber: state.revisionCount });
  }

  state.textAnswer = newText;
  state.lastInputTimeMs = now;
  state.lastInputLength = newText.length;
}

/**
 * Record code editor modifications, code revisions, and time to first edit.
 */
export function recordCodeEdit(
  state: QuestionTelemetryState,
  newCode: string
): void {
  const now = Date.now();

  if (state.timeToFirstEditMs === null && state.startTimeMs !== null) {
    state.timeToFirstEditMs = now - state.startTimeMs;
  }

  const deltaChars = newCode.length - state.lastInputLength;
  const prevTime = state.lastInputTimeMs || state.startTimeMs || now;
  const elapsedMs = Math.max(10, now - prevTime);

  if (deltaChars > 0) {
    const rateResult = calculateInsertionRate(deltaChars, elapsedMs);
    state.maxInsertionRate = Math.max(state.maxInsertionRate, rateResult.insertionRateCharsPerSec);
    state.maxCharsInserted = Math.max(state.maxCharsInserted, deltaChars);

    if (rateResult.isBurst) {
      state.characterBurstFlag = 1;
      state.burstReason = rateResult.reason;
      recordSequenceEvent(state, 'character_insertion', { burst: true, rate: rateResult.insertionRateCharsPerSec });
    } else {
      recordSequenceEvent(state, 'typing', { deltaChars });
    }
  }

  state.codeRevisionCount += 1;
  state.codeAnswer = newCode;
  state.lastInputTimeMs = now;
  state.lastInputLength = newCode.length;
  recordSequenceEvent(state, 'revision', { codeRevisionCount: state.codeRevisionCount });
}

/**
 * Record a code execution run and test case results.
 */
export function recordCodeRun(
  state: QuestionTelemetryState,
  passed: number,
  total: number
): void {
  state.codeRunCount += 1;
  state.testCasesPassed = passed;
  state.testCasesTotal = total;
  recordSequenceEvent(state, 'pointer_activity', { action: 'run_tests', passed, total });
}

/**
 * Record a clipboard paste event without accessing clipboard content.
 */
export function recordPasteEvent(state: QuestionTelemetryState): void {
  state.pasteDetected = 1;
  recordSequenceEvent(state, 'paste_attempt', { timestamp: Date.now() });
  recordIntegrityOpportunity(state, 'paste_attempt', 'Clipboard paste intercepted on question');
}

// ─── Finalize Telemetry Record ──────────────────────────────────────────────

export function finalizeQuestionTelemetry(
  state: QuestionTelemetryState,
  sessionId: string,
  studentId: string,
  deviceType: string = detectDeviceType(),
  isAnswerCorrect?: boolean
): ExamQuestionTelemetry {
  const now = new Date();
  const timeOfDayStr = now.toTimeString().split(' ')[0]; // '14:32:00'
  const timestampStr = now.toISOString().replace('T', ' ').substring(0, 19);

  // Record submission / transition event
  recordSequenceEvent(state, 'submission', { isAnswerCorrect });

  // Calculate active response time (Core Feature 1)
  let finalTimeMs = state.totalTimeMs;
  if (state.startTimeMs !== null) {
    finalTimeMs += Date.now() - state.startTimeMs;
  }
  const responseTimeSec = Number(Math.max(0.5, finalTimeMs / 1000).toFixed(1));

  // Revision timing (Core Feature 3)
  let revisionTimeSec = 0;
  if (state.initialAnswerTimeMs && state.lastRevisionTimeMs && state.lastRevisionTimeMs > state.initialAnswerTimeMs) {
    revisionTimeSec = Number(((state.lastRevisionTimeMs - state.initialAnswerTimeMs) / 1000).toFixed(1));
  }

  // Pointer speed (Core Features 4 & 5)
  const pointerDist = Number(state.pointerDistancePx.toFixed(1));
  const pointerSpeed = responseTimeSec > 0 ? Number((pointerDist / responseTimeSec).toFixed(1)) : 0;

  // Time to first edit (seconds)
  const timeToFirstEditSec = state.timeToFirstEditMs !== null
    ? Number((state.timeToFirstEditMs / 1000).toFixed(1))
    : undefined;

  return {
    recordId: `${sessionId}_Q${String(state.sessionPosition).padStart(2, '0')}`,
    studentId,
    sessionId,
    questionId: state.questionId,
    questionType: state.questionType,
    questionDifficulty: Number(state.questionDifficulty.toFixed(2)),
    sessionPosition: state.sessionPosition,
    selectedAnswerIndex: state.selectedAnswerIndex,
    selectedAnswerIndices: state.selectedAnswerIndices.length > 0 ? state.selectedAnswerIndices : undefined,
    isAnswerCorrect: isAnswerCorrect !== undefined ? isAnswerCorrect : false,
    // 1. Response Time
    responseTimeSec,
    // 2. Answer Revision Count
    answerRevisionCount: state.revisionCount,
    // 3. Answer Revision Time
    answerRevisionTimeSec: revisionTimeSec,
    codeRevisionCount: state.codeRevisionCount > 0 ? state.codeRevisionCount : undefined,
    timeToFirstEditSec,
    codeRunCount: state.codeRunCount > 0 ? state.codeRunCount : undefined,
    testCasesPassed: state.testCasesTotal > 0 ? state.testCasesPassed : undefined,
    testCasesTotal: state.testCasesTotal > 0 ? state.testCasesTotal : undefined,
    textAnswerLength: state.textAnswer.length > 0 ? state.textAnswer.length : undefined,
    // 4. Pointer Distance
    pointerDistancePx: pointerDist,
    // 5. Pointer Average Speed
    pointerAvgSpeedPxS: pointerSpeed,
    // 6. Scroll Distance
    scrollDistancePx: Number(state.scrollDistancePx.toFixed(1)),
    // 7. Scroll Events
    scrollEvents: state.scrollEventsCount,
    // 8. Paste Detected
    pasteDetected: state.pasteDetected > 0 ? 1 : 0,
    // 9. Character Burst Flag
    characterBurstFlag: state.characterBurstFlag > 0 ? 1 : 0,
    maxInsertionRate: state.maxInsertionRate > 0 ? state.maxInsertionRate : undefined,
    maxCharsInserted: state.maxCharsInserted > 0 ? state.maxCharsInserted : undefined,
    burstThresholdUsed: CHARACTER_BURST_CONFIG.BURST_RATE_THRESHOLD_CHARS_PER_SEC,
    burstReason: state.burstReason,
    deviceType,
    timeOfDay: timeOfDayStr,
    timestamp: timestampStr,
  };
}
