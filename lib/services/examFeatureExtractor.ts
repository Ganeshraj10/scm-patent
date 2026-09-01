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

import { ExamQuestionTelemetry, QuestionType } from '@/types';

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

  // Time & Interaction metrics
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
    startTimeMs: null,
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
  };
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
  } else if (state.selectedAnswerIndex !== optionIndex) {
    state.revisionCount += 1;
    state.lastRevisionTimeMs = now;
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
  } else {
    state.revisionCount += 1;
    state.lastRevisionTimeMs = now;
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
    }
  }

  if (state.initialAnswerTimeMs === null && newText.length > 0) {
    state.initialAnswerTimeMs = now;
  } else if (newText !== state.textAnswer) {
    state.revisionCount += 1;
    state.lastRevisionTimeMs = now;
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
    }
  }

  state.codeRevisionCount += 1;
  state.codeAnswer = newCode;
  state.lastInputTimeMs = now;
  state.lastInputLength = newCode.length;
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
}

/**
 * Record a clipboard paste event without accessing clipboard content.
 */
export function recordPasteEvent(state: QuestionTelemetryState): void {
  state.pasteDetected = 1;
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

  // Calculate active response time
  let finalTimeMs = state.totalTimeMs;
  if (state.startTimeMs !== null) {
    finalTimeMs += Date.now() - state.startTimeMs;
  }
  const responseTimeSec = Number(Math.max(0.5, finalTimeMs / 1000).toFixed(1));

  // Revision timing
  let revisionTimeSec = 0;
  if (state.initialAnswerTimeMs && state.lastRevisionTimeMs && state.lastRevisionTimeMs > state.initialAnswerTimeMs) {
    revisionTimeSec = Number(((state.lastRevisionTimeMs - state.initialAnswerTimeMs) / 1000).toFixed(1));
  }

  // Pointer speed
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
    responseTimeSec,
    answerRevisionCount: state.revisionCount,
    answerRevisionTimeSec: revisionTimeSec,
    codeRevisionCount: state.codeRevisionCount > 0 ? state.codeRevisionCount : undefined,
    timeToFirstEditSec,
    codeRunCount: state.codeRunCount > 0 ? state.codeRunCount : undefined,
    testCasesPassed: state.testCasesTotal > 0 ? state.testCasesPassed : undefined,
    testCasesTotal: state.testCasesTotal > 0 ? state.testCasesTotal : undefined,
    textAnswerLength: state.textAnswer.length > 0 ? state.textAnswer.length : undefined,
    pointerDistancePx: pointerDist,
    pointerAvgSpeedPxS: pointerSpeed,
    scrollDistancePx: Number(state.scrollDistancePx.toFixed(1)),
    scrollEvents: state.scrollEventsCount,
    pasteDetected: state.pasteDetected > 0 ? 1 : 0,
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
