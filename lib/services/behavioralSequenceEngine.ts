/**
 * ExamGuard — Behavioral Sequence Signature Engine
 * 
 * Analyzes action ordering, inter-event timing, consecutive action transitions,
 * n-gram patterns, and transition entropy to produce a compact mathematical
 * sequence signature comparing current examination interaction against personal baseline history.
 * 
 * Privacy Policy:
 * - NO raw keystroke streams or clipboard contents are recorded or stored.
 * - Stores only high-level derived event tokens and transition frequencies.
 */

import {
  BehavioralEventType,
  BehavioralSequenceEvent,
  BehavioralSequenceSignature,
  TransitionCount,
} from '@/types';

// ─── Standard Event Categories ──────────────────────────────────────────────

export const ALL_BEHAVIORAL_EVENTS: BehavioralEventType[] = [
  'question_view',
  'pause',
  'typing',
  'character_insertion',
  'answer_select',
  'answer_change',
  'revision',
  'pointer_activity',
  'scrolling',
  'navigation',
  'paste_attempt',
  'submission',
  'fullscreen_exit',
  'page_visibility_change',
  'connection_interrupt',
  'reconnection',
];

// Pause threshold: inter-event latency >= 3000ms qualifies as a distinct cognitive pause event
export const PAUSE_THRESHOLD_MS = 3000;

/**
 * Creates a structured sequence event with computed delta timestamp.
 */
export function createSequenceEvent(
  eventType: BehavioralEventType,
  previousTimestampMs: number | null,
  currentTimestampMs: number = Date.now(),
  questionId?: string,
  sessionPosition?: number,
  durationMs?: number,
  details?: Record<string, any>
): BehavioralSequenceEvent {
  const deltaMs = previousTimestampMs !== null
    ? Math.max(0, currentTimestampMs - previousTimestampMs)
    : 0;

  return {
    id: `EVT_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    eventType,
    timestamp: new Date(currentTimestampMs).toISOString(),
    deltaMs,
    durationMs: durationMs !== undefined ? durationMs : deltaMs,
    questionId,
    sessionPosition,
    details,
  };
}

/**
 * Builds transition matrix, top transition pairs, and transition entropy from an ordered list of events.
 */
export function extractSequenceSignature(
  events: BehavioralSequenceEvent[],
  sessionId: string,
  studentId: string
): BehavioralSequenceSignature {
  if (!events || events.length === 0) {
    return {
      sessionId,
      studentId,
      totalEvents: 0,
      transitionMatrix: {},
      topTransitions: [],
      commonNGrams: [],
      transitionEntropy: 0,
      avgInterEventLatencyMs: 0,
      pauseFrequency: 0,
      sequenceSimilarityToBaseline: 1.0,
      evaluatedAt: new Date().toISOString(),
    };
  }

  const transitionCounts: Record<string, Record<string, number>> = {};
  const totalFromCount: Record<string, number> = {};
  let totalDeltaMs = 0;
  let pauseCount = 0;

  // Initialize transition records
  for (let i = 0; i < events.length - 1; i++) {
    const fromType = events[i].eventType;
    const toType = events[i + 1].eventType;
    const delta = events[i + 1].deltaMs;

    totalDeltaMs += delta;
    if (fromType === 'pause' || delta >= PAUSE_THRESHOLD_MS) {
      pauseCount += 1;
    }

    if (!transitionCounts[fromType]) {
      transitionCounts[fromType] = {};
      totalFromCount[fromType] = 0;
    }

    transitionCounts[fromType][toType] = (transitionCounts[fromType][toType] || 0) + 1;
    totalFromCount[fromType] += 1;
  }

  // Calculate transition probabilities and overall transition distribution entropy
  const topTransitions: TransitionCount[] = [];
  let entropySum = 0;
  const numTransitions = Math.max(1, events.length - 1);

  Object.entries(transitionCounts).forEach(([from, toMap]) => {
    const fromTotal = totalFromCount[from] || 1;
    Object.entries(toMap).forEach(([to, count]) => {
      const probFrom = Number((count / fromTotal).toFixed(3));
      const overallProb = count / numTransitions;
      topTransitions.push({
        fromEvent: from as BehavioralEventType,
        toEvent: to as BehavioralEventType,
        count,
        probability: probFrom,
      });

      if (overallProb > 0) {
        entropySum -= overallProb * Math.log2(overallProb);
      }
    });
  });

  // Sort top transitions by count descending
  topTransitions.sort((a, b) => b.count - a.count);

  // Extract common 3-grams
  const trigramCounts: Record<string, number> = {};
  for (let i = 0; i < events.length - 2; i++) {
    const trigram = `${events[i].eventType}->${events[i + 1].eventType}->${events[i + 2].eventType}`;
    trigramCounts[trigram] = (trigramCounts[trigram] || 0) + 1;
  }

  const commonNGrams = Object.entries(trigramCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([ngram, count]) => `${ngram} (${count}x)`);

  const avgLatency = events.length > 1
    ? Math.round(totalDeltaMs / (events.length - 1))
    : 0;

  return {
    sessionId,
    studentId,
    totalEvents: events.length,
    transitionMatrix: transitionCounts,
    topTransitions: topTransitions.slice(0, 10),
    commonNGrams,
    transitionEntropy: Math.min(10, Number(entropySum.toFixed(2))),
    avgInterEventLatencyMs: avgLatency,
    pauseFrequency: Number((pauseCount / Math.max(1, events.length)).toFixed(2)),
    sequenceSimilarityToBaseline: 1.0, // Calculated against historical profile
    evaluatedAt: new Date().toISOString(),
  };
}

/**
 * Calculates cosine similarity between current session's transition signature and historical baseline transitions.
 */
export function calculateSequenceSimilarity(
  currentSignature: BehavioralSequenceSignature,
  historicalSignature?: BehavioralSequenceSignature
): number {
  if (!historicalSignature || historicalSignature.totalEvents === 0 || currentSignature.totalEvents === 0) {
    return 1.0; // Default when no baseline exists (e.g. cold start)
  }

  // Construct transition vector from union of transition keys
  const allKeys = new Set<string>();
  const curVec: Record<string, number> = {};
  const histVec: Record<string, number> = {};

  const populateVector = (sig: BehavioralSequenceSignature, target: Record<string, number>) => {
    Object.entries(sig.transitionMatrix).forEach(([from, toMap]) => {
      Object.entries(toMap).forEach(([to, count]) => {
        const key = `${from}:${to}`;
        allKeys.add(key);
        target[key] = count / Math.max(1, sig.totalEvents);
      });
    });
  };

  populateVector(currentSignature, curVec);
  populateVector(historicalSignature, histVec);

  let dotProduct = 0;
  let curMag = 0;
  let histMag = 0;

  allKeys.forEach((key) => {
    const c = curVec[key] || 0;
    const h = histVec[key] || 0;
    dotProduct += c * h;
    curMag += c * c;
    histMag += h * h;
  });

  if (curMag === 0 || histMag === 0) return 1.0;

  const similarity = dotProduct / (Math.sqrt(curMag) * Math.sqrt(histMag));
  return Number(Math.max(0, Math.min(1.0, similarity)).toFixed(3));
}

/**
 * Synthesizes a representative default sequence of events for question interaction
 * based on question format, difficulty, and standard student behavior.
 */
export function generateSyntheticSequenceEvents(
  questionId: string,
  sessionPosition: number,
  difficulty: number,
  responseTimeSec: number,
  revisionCount: number,
  pasteDetected: boolean,
  characterBurst: boolean,
  startTimestampMs: number = Date.now() - responseTimeSec * 1000
): BehavioralSequenceEvent[] {
  const events: BehavioralSequenceEvent[] = [];
  let currentMs = startTimestampMs;

  // 1. Question View
  events.push(createSequenceEvent('question_view', null, currentMs, questionId, sessionPosition));

  // 2. Initial Cognitive Pause (difficulty-proportional)
  const pauseDurationMs = Math.round(Math.min(responseTimeSec * 0.4, 2000 + difficulty * 4000) * 1000);
  currentMs += pauseDurationMs;
  events.push(createSequenceEvent('pause', currentMs - pauseDurationMs, currentMs, questionId, sessionPosition, pauseDurationMs));

  // 3. Pointer Activity & Scrolling
  const pointerDeltaMs = 800;
  currentMs += pointerDeltaMs;
  events.push(createSequenceEvent('pointer_activity', currentMs - pointerDeltaMs, currentMs, questionId, sessionPosition));

  // 4. Typing / Character Insertion or Paste
  if (pasteDetected) {
    const pasteDeltaMs = 400;
    currentMs += pasteDeltaMs;
    events.push(createSequenceEvent('paste_attempt', currentMs - pasteDeltaMs, currentMs, questionId, sessionPosition));
  }

  if (characterBurst) {
    const burstDeltaMs = 300;
    currentMs += burstDeltaMs;
    events.push(createSequenceEvent('character_insertion', currentMs - burstDeltaMs, currentMs, questionId, sessionPosition, burstDeltaMs, { burst: true }));
  } else {
    const typeDeltaMs = 1500;
    currentMs += typeDeltaMs;
    events.push(createSequenceEvent('typing', currentMs - typeDeltaMs, currentMs, questionId, sessionPosition));
  }

  // 5. Initial Answer Select
  const selectDeltaMs = 1200;
  currentMs += selectDeltaMs;
  events.push(createSequenceEvent('answer_select', currentMs - selectDeltaMs, currentMs, questionId, sessionPosition));

  // 6. Revisions
  for (let r = 0; r < revisionCount; r++) {
    const revPauseMs = 1000 + r * 500;
    currentMs += revPauseMs;
    events.push(createSequenceEvent('pause', currentMs - revPauseMs, currentMs, questionId, sessionPosition, revPauseMs));

    const revChangeMs = 700;
    currentMs += revChangeMs;
    events.push(createSequenceEvent('answer_change', currentMs - revChangeMs, currentMs, questionId, sessionPosition));

    events.push(createSequenceEvent('revision', currentMs - 100, currentMs, questionId, sessionPosition));
  }

  // 7. Navigation
  const navDeltaMs = 600;
  currentMs += navDeltaMs;
  events.push(createSequenceEvent('navigation', currentMs - navDeltaMs, currentMs, questionId, sessionPosition));

  return events;
}
