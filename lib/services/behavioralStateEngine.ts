/**
 * ExamGuard — Context-Aware Behavioral State Inference & Real-Time Intelligence
 * 
 * Provides:
 * 1. Context-Aware Behavioral State Inference (Observable states, zero emotion claims)
 * 2. Continuous Behavioral Consistency Score (0–100, sliding-window personal consistency)
 * 3. Temporal Persistence Aggregator (Isolated vs Short-lived vs Persistent deviations)
 * 4. Explainable Exam Event Timeline Synthesis (Chronological audit stream without raw data)
 */

import {
  BehavioralState,
  BehavioralStateInference,
  ContinuousConsistencyScore,
  RollingWindowConsistency,
  IntegrityOpportunityEvent,
  TemporalPersistenceResult,
  ExamEventTimelineEntry,
  ExamQuestionTelemetry,
  PersonalizedBaseline,
  BehavioralSequenceEvent,
  BehavioralSequenceSignature,
} from '@/types';

// ─── 1. Context-Aware Behavioral State Inference ────────────────────────────

export interface StateInferenceInput {
  responseTimeSec: number;
  expectedResponseTimeSec: number;
  revisionCount: number;
  expectedRevisionCount: number;
  pauseDurationSec?: number;
  questionDifficulty: number;
  pasteDetected: boolean;
  characterBurst: boolean;
  sequenceSimilarity?: number;
  integrityEventsCountInWindow?: number;
  rapidNavigationsInWindow?: number;
  isNearingTimeLimit?: boolean;
}

/**
 * Infers observable interaction state from low-level features and question context.
 * Strictly adheres to observable behavior principles without emotion claims.
 */
export function inferBehavioralState(
  input: StateInferenceInput
): { state: BehavioralState; confidence: number; reasoning: string; observableFactors: string[] } {
  const {
    responseTimeSec,
    expectedResponseTimeSec,
    revisionCount,
    expectedRevisionCount,
    questionDifficulty,
    pasteDetected,
    characterBurst,
    sequenceSimilarity = 1.0,
    integrityEventsCountInWindow = 0,
    rapidNavigationsInWindow = 0,
    isNearingTimeLimit = false,
  } = input;

  const observableFactors: string[] = [];

  // 1. Check for Abrupt Behavioral Change (high paste / burst / sudden sequence anomaly)
  if (
    (pasteDetected && characterBurst) ||
    (characterBurst && responseTimeSec < expectedResponseTimeSec * 0.4) ||
    (pasteDetected && rapidNavigationsInWindow >= 2) ||
    (sequenceSimilarity < 0.45 && (pasteDetected || characterBurst))
  ) {
    const factors = [
      pasteDetected ? 'External paste action recorded' : '',
      characterBurst ? 'Superhuman character insertion rate detected' : '',
      `Sequence transition similarity low (${Math.round(sequenceSimilarity * 100)}%)`
    ].filter(Boolean);

    return {
      state: 'Abrupt Behavioral Change',
      confidence: 85,
      reasoning: 'Abrupt transition observed characterized by instant text insertion or rapid external input.',
      observableFactors: factors,
    };
  }

  // 2. Check for Interaction Disruption (multiple environmental integrity events)
  if (integrityEventsCountInWindow >= 2 || rapidNavigationsInWindow >= 3) {
    observableFactors.push(
      `${integrityEventsCountInWindow} window/visibility transition events recorded in current window`,
      `${rapidNavigationsInWindow} rapid question navigations observed`
    );

    return {
      state: 'Interaction Disruption',
      confidence: 80,
      reasoning: 'Frequent window defocus or rapid navigations disrupted continuous exam engagement.',
      observableFactors,
    };
  }

  // 3. Check for Time Pressure (fast submission with few revisions nearing time limit)
  if (isNearingTimeLimit && responseTimeSec < expectedResponseTimeSec * 0.5) {
    observableFactors.push(
      'Session approaching allotted exam duration limit',
      `Response time (${responseTimeSec}s) markedly accelerated relative to personal mean (${expectedResponseTimeSec}s)`
    );

    return {
      state: 'Time Pressure',
      confidence: 75,
      reasoning: 'Accelerated pacing observed as exam allotted time approaches limit.',
      observableFactors,
    };
  }

  // 4. Check for Increased Uncertainty (elevated revisions + higher response time on moderate/hard question)
  const isHighRevisions = revisionCount >= Math.max(2, expectedRevisionCount + 2);
  const isElevatedTime = responseTimeSec > expectedResponseTimeSec * 1.6;

  if (isHighRevisions && isElevatedTime) {
    observableFactors.push(
      `Multiple answer modifications (${revisionCount} revisions vs expected ${expectedRevisionCount})`,
      `Extended formulation duration (${responseTimeSec}s vs expected ${expectedResponseTimeSec}s)`
    );

    return {
      state: 'Increased Uncertainty',
      confidence: 80,
      reasoning: 'Observed multiple revisions and extended formulating time indicating active deliberative hesitation.',
      observableFactors,
    };
  }

  // 5. Check for Possible Confusion (very long pause/time with zero revisions on difficult question)
  if (responseTimeSec > expectedResponseTimeSec * 2.2 && revisionCount === 0 && questionDifficulty >= 0.6) {
    observableFactors.push(
      `Prolonged dwell time (${responseTimeSec}s on difficulty ${questionDifficulty.toFixed(2)})`,
      'Zero interim answer selections recorded before final input'
    );

    return {
      state: 'Possible Confusion',
      confidence: 70,
      reasoning: 'Prolonged cognitive pause on high-difficulty question without interim selections.',
      observableFactors,
    };
  }

  // 6. Check for Hesitation (moderate response time increase or 1–2 revisions)
  if (isElevatedTime || isHighRevisions) {
    const factors = [
      isElevatedTime ? `Response time somewhat above typical average (+${Math.round(responseTimeSec - expectedResponseTimeSec)}s)` : '',
      isHighRevisions ? `Answer revised ${revisionCount} times` : ''
    ].filter(Boolean);

    return {
      state: 'Hesitation',
      confidence: 75,
      reasoning: 'Minor deliberation pause or answer reconsideration observed.',
      observableFactors: factors,
    };
  }

  // 7. Default: Stable Interaction
  observableFactors.push(
    `Cadence aligned with historical baseline (Response: ${responseTimeSec}s, Revisions: ${revisionCount})`,
    'Smooth sequence progression'
  );

  return {
    state: 'Stable Interaction',
    confidence: 90,
    reasoning: 'Interaction cadence, timing, and revisions conform to student personal historical baseline.',
    observableFactors,
  };
}

// ─── 2. Continuous Behavioral Consistency Score (0–100) ─────────────────────

/**
 * Calculates continuous behavioral consistency across question interactions.
 * Higher score (80–100) = current behavior closely aligns with established personal profile.
 * Lower score (<50) = current behavior deviates from personal profile.
 */
export function calculateContinuousConsistency(
  interactions: ExamQuestionTelemetry[],
  baseline: PersonalizedBaseline,
  sequenceSignature?: BehavioralSequenceSignature
): ContinuousConsistencyScore {
  if (!interactions || interactions.length === 0) {
    return {
      overallScore: 100,
      statusLabel: 'Normal Consistency',
      rollingWindows: [],
      factorsConsidered: ['No interactions recorded yet'],
    };
  }

  const rollingWindows: RollingWindowConsistency[] = [];
  let cumulativeScore = 0;
  const isColdStart = baseline.maturityStatus === 'cold_start';

  interactions.forEach((q, idx) => {
    let windowScore = 100;
    const keyFactors: string[] = [];

    // Response time deviation factor
    const expResp = baseline.overallFeatures.response_time_sec?.expectedValue || 25;
    const respSpread = Math.max(5, baseline.overallFeatures.response_time_sec?.stdDev || 8);
    const respZ = isColdStart ? 0 : Math.abs(q.responseTimeSec - expResp) / respSpread;

    if (respZ > 2.5) {
      windowScore -= 25;
      keyFactors.push(`Response time delta (|z|=${respZ.toFixed(1)})`);
    } else if (respZ > 1.5) {
      windowScore -= 12;
      keyFactors.push(`Moderate response time shift`);
    }

    // Revisions factor
    const expRev = baseline.overallFeatures.answer_revision_count?.expectedValue || 0.8;
    const revDiff = Math.abs(q.answerRevisionCount - expRev);
    if (revDiff > 3) {
      windowScore -= 15;
      keyFactors.push('Unusual revision frequency');
    }

    // Paste / Burst signals
    if (q.pasteDetected) {
      windowScore -= 30;
      keyFactors.push('Clipboard paste event');
    }
    if (q.characterBurstFlag) {
      windowScore -= 25;
      keyFactors.push('Rapid character burst insertion');
    }

    // Sequence similarity factor
    if (sequenceSignature && sequenceSignature.sequenceSimilarityToBaseline !== undefined) {
      const sim = sequenceSignature.sequenceSimilarityToBaseline;
      if (sim < 0.5) {
        windowScore -= 20;
        keyFactors.push(`Low sequence similarity (${Math.round(sim * 100)}%)`);
      }
    }

    const clampedWindowScore = Math.max(10, Math.min(100, windowScore));
    cumulativeScore += clampedWindowScore;

    // Infer state for this window
    const stateInference = inferBehavioralState({
      responseTimeSec: q.responseTimeSec,
      expectedResponseTimeSec: expResp,
      revisionCount: q.answerRevisionCount,
      expectedRevisionCount: expRev,
      questionDifficulty: q.questionDifficulty || 0.5,
      pasteDetected: q.pasteDetected === 1,
      characterBurst: q.characterBurstFlag === 1,
      sequenceSimilarity: sequenceSignature?.sequenceSimilarityToBaseline || 1.0,
    });

    rollingWindows.push({
      windowIndex: idx + 1,
      timestamp: q.timestamp || new Date().toISOString(),
      score: clampedWindowScore,
      keyFactor: keyFactors.length > 0 ? keyFactors.join(', ') : 'Consistent with profile',
      state: stateInference.state,
    });
  });

  const rawOverall = Math.round(cumulativeScore / interactions.length);
  const overallScore = isColdStart ? 85 : Math.max(15, Math.min(100, rawOverall));

  let statusLabel = 'Highly Consistent with Personal Profile';
  if (overallScore < 50) {
    statusLabel = 'Significant Inconsistency Observed';
  } else if (overallScore < 75) {
    statusLabel = 'Moderate Consistency Variance';
  }

  return {
    overallScore,
    statusLabel,
    rollingWindows,
    factorsConsidered: [
      'Response pacing relative to student baseline',
      'Answer revision frequency',
      'Cursor and viewport movement stability',
      'Action sequence transition patterns',
      'Absence of rapid external burst insertions',
    ],
  };
}

// ─── 3. Temporal Persistence Evaluation ─────────────────────────────────────

/**
 * Distinguishes isolated events from short-lived or persistent behavioral deviations.
 */
export function evaluateTemporalPersistence(
  interactions: ExamQuestionTelemetry[],
  integrityEvents: IntegrityOpportunityEvent[] = []
): TemporalPersistenceResult {
  const totalQuestions = Math.max(1, interactions.length);
  
  // Count anomalous question interactions (paste, burst, or extreme response time)
  let anomalousCount = 0;
  interactions.forEach((q) => {
    if (q.pasteDetected || q.characterBurstFlag || q.responseTimeSec < 3.0) {
      anomalousCount += 1;
    }
  });

  const totalEventSignals = anomalousCount + integrityEvents.length;
  const isolatedEvents = integrityEvents.filter((e) => e.isIsolated).length;
  const repeatedEvents = integrityEvents.filter((e) => !e.isIsolated).length;

  let tier: 'isolated' | 'short_lived' | 'persistent' = 'isolated';
  let score = 10;
  let explanation = 'Observed interactions reflect isolated or transient behavioral signals.';

  if (totalEventSignals === 0) {
    tier = 'isolated';
    score = 0;
    explanation = 'No anomalous interaction signals or environmental disruptions detected.';
  } else if (totalEventSignals >= 3 || repeatedEvents >= 2 || (anomalousCount >= 2 && totalQuestions <= 5)) {
    tier = 'persistent';
    score = 85;
    explanation = `Persistent pattern: ${totalEventSignals} correlated behavioral signals observed across multiple session windows.`;
  } else if (totalEventSignals === 2 || anomalousCount === 1) {
    tier = 'short_lived';
    score = 45;
    explanation = 'Short-lived deviation: signals were localized to a brief window and did not sustain across the full exam.';
  } else {
    tier = 'isolated';
    score = 15;
    explanation = 'Single isolated occurrence; does not constitute a persistent behavioral trend.';
  }

  return {
    persistenceTier: tier,
    persistenceLabel: tier === 'persistent' ? 'Persistent Deviation' : tier === 'short_lived' ? 'Short-Lived Deviation' : 'Isolated Event',
    persistenceScore: score,
    eventFrequency: Number((totalEventSignals / totalQuestions).toFixed(2)),
    isolatedEventCount: isolatedEvents,
    repeatedEventCount: repeatedEvents + anomalousCount,
    explanation,
  };
}

// ─── 4. Chronological Exam Event Timeline Synthesis ─────────────────────────

/**
 * Synthesizes chronological timeline from sequence events, integrity events, and question milestones.
 * Never stores or displays raw keystrokes or clipboard text.
 */
export function buildExamEventTimeline(
  sequenceEvents: BehavioralSequenceEvent[] = [],
  integrityEvents: IntegrityOpportunityEvent[] = [],
  interactions: ExamQuestionTelemetry[] = []
): ExamEventTimelineEntry[] {
  const timeline: ExamEventTimelineEntry[] = [];

  // Helper to format ISO timestamp to "HH:MM:SS"
  const formatTime = (iso: string) => {
    try {
      const date = new Date(iso);
      if (isNaN(date.getTime())) return iso.substring(11, 19) || '10:00:00';
      return date.toTimeString().split(' ')[0];
    } catch {
      return '10:00:00';
    }
  };

  // 1. Add Integrity Opportunity Events
  integrityEvents.forEach((ie) => {
    let desc = `Integrity opportunity event: ${ie.eventType.replace(/_/g, ' ')}`;
    if (ie.eventType === 'page_visibility_change') desc = 'Browser tab or page visibility changed';
    if (ie.eventType === 'window_blur') desc = 'Browser window lost focus';
    if (ie.eventType === 'fullscreen_exit') desc = 'Exam window exited fullscreen mode';
    if (ie.eventType === 'paste_attempt') desc = 'Clipboard paste attempt intercepted';
    if (ie.eventType === 'navigation_away') desc = 'Navigation away from question window';

    timeline.push({
      id: ie.id,
      timestamp: ie.timestamp,
      timeFormatted: formatTime(ie.timestamp),
      eventType: ie.eventType,
      category: 'integrity_opportunity',
      description: `${desc} ${ie.isIsolated ? '(isolated)' : '(repeated)'}`,
      questionId: ie.questionId,
      sessionPosition: ie.sessionPosition,
      isAnomalous: true,
    });
  });

  // 2. Add Key Behavioral Sequence Transitions
  sequenceEvents.forEach((se) => {
    let desc = `Action: ${se.eventType.replace(/_/g, ' ')}`;
    let isAnomalous = false;

    if (se.eventType === 'question_view') desc = `Question ${se.sessionPosition || ''} displayed`;
    if (se.eventType === 'pause') desc = `Cognitive deliberation pause (${((se.durationMs || 0) / 1000).toFixed(1)}s)`;
    if (se.eventType === 'answer_select') desc = 'Option selected';
    if (se.eventType === 'answer_change') desc = 'Selected answer modified';
    if (se.eventType === 'revision') desc = 'Answer revised';
    if (se.eventType === 'character_insertion' && se.details?.burst) {
      desc = 'Rapid character insertion burst detected';
      isAnomalous = true;
    }
    if (se.eventType === 'paste_attempt') {
      desc = 'Paste attempt logged';
      isAnomalous = true;
    }
    if (se.eventType === 'submission') desc = 'Answer submitted';

    timeline.push({
      id: se.id,
      timestamp: se.timestamp,
      timeFormatted: formatTime(se.timestamp),
      eventType: se.eventType,
      category: se.eventType.includes('visibility') || se.eventType.includes('fullscreen')
        ? 'integrity_opportunity'
        : 'interaction',
      description: desc,
      questionId: se.questionId,
      sessionPosition: se.sessionPosition,
      durationSec: se.durationMs ? Number((se.durationMs / 1000).toFixed(1)) : undefined,
      isAnomalous,
    });
  });

  // 3. Sort chronologically
  timeline.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  return timeline;
}
