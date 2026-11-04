/**
 * ExamGuard — Multimodal Evidence Fusion Engine (Layer 3)
 *
 * Evaluates Layer 1 (Behavioral Intelligence) + Layer 2 (Camera Evidence) +
 * Integrity Opportunity Events + Contextual Temporal Correlation.
 *
 * Key Principles:
 * - Does NOT replace behavioral analysis.
 * - Does NOT train behavioral baselines on camera frames.
 * - Does NOT claim emotion detection or automated cheating verdicts.
 * - Analyzes temporal relationships across multimodal layers to produce explainable assessments.
 */

import {
  MultimodalEvidenceAssessment,
  MultimodalCorrelationPattern,
  CameraEvidenceSummary,
  CameraIntegrityEvent,
  IntegrityOpportunityEvent,
  BehavioralState,
  BehavioralStateInference,
  ContinuousConsistencyScore,
  BehavioralSequenceSignature,
  ExamQuestionTelemetry,
} from '@/types';

export interface FusionInput {
  sessionId: string;
  studentId: string;
  examId?: string;
  deviationScore: number; // 0–100 Mahalanobis deviation
  personalizedThreshold: number;
  consistencyScore?: ContinuousConsistencyScore;
  stateInference?: BehavioralStateInference;
  sequenceSignature?: BehavioralSequenceSignature;
  interactions?: ExamQuestionTelemetry[];
  integrityEvents?: IntegrityOpportunityEvent[];
  cameraSummary?: CameraEvidenceSummary;
  cameraEvents?: CameraIntegrityEvent[];
  baselineMaturity?: string;
  temporalDeltaMs?: number;
}

/**
 * Evaluates temporal correlation between two timestamped event streams within a configurable difference window Delta (in ms).
 * Default window is 5000ms (5.0 seconds).
 */
export function matchTemporalEventWindow<T extends { timestamp: string }, U extends { timestamp: string }>(
  streamA: T[],
  streamB: U[],
  deltaMs: number = 5000
): { eventA: T; eventB: U; deltaSec: number }[] {
  const matches: { eventA: T; eventB: U; deltaSec: number }[] = [];
  for (const a of streamA) {
    const tA = new Date(a.timestamp).getTime();
    if (isNaN(tA)) continue;
    for (const b of streamB) {
      const tB = new Date(b.timestamp).getTime();
      if (isNaN(tB)) continue;
      const diffMs = Math.abs(tA - tB);
      if (diffMs <= deltaMs) {
        matches.push({ eventA: a, eventB: b, deltaSec: Number((diffMs / 1000).toFixed(2)) });
      }
    }
  }
  return matches;
}

/**
 * Executes multimodal temporal cross-layer correlation and assessment synthesis.
 */
export function fuseMultimodalEvidence(input: FusionInput): MultimodalEvidenceAssessment {
  const {
    deviationScore,
    personalizedThreshold,
    consistencyScore,
    stateInference,
    sequenceSignature,
    interactions = [],
    integrityEvents = [],
    cameraSummary,
    cameraEvents = [],
    baselineMaturity = 'established',
    temporalDeltaMs = 5000,
  } = input;

  const patterns: MultimodalCorrelationPattern[] = [];
  const now = new Date().toISOString();

  // 1. Behavioral Evidence Synthesis
  const isBehavioralAnomalous = deviationScore > (personalizedThreshold || 35);
  const consistencyVal = consistencyScore ? consistencyScore.overallScore : 85;
  const isConsistencyLow = consistencyVal < 60;
  const currentState: BehavioralState = stateInference?.currentState || 'Stable Interaction';

  // 2. Camera Evidence Synthesis
  const presencePct = cameraSummary ? cameraSummary.facePresencePercentage : 100;
  const prolongedLookAways = cameraSummary ? cameraSummary.prolongedLookAwayCount : 0;
  const repeatedLookAways = cameraSummary ? cameraSummary.repeatedLookAwayCount : 0;
  const multiplePersonsCount = cameraSummary ? cameraSummary.multiplePersonEventCount : 0;
  const cameraInterruptions = cameraSummary ? cameraSummary.cameraInterruptionCount : 0;

  // 3. Environmental Integrity Events Synthesis
  const pasteEvents = integrityEvents.filter((e) => e.eventType === 'paste_attempt');
  const fullscreenExits = integrityEvents.filter((e) => e.eventType === 'fullscreen_exit');
  const connectionDrops = integrityEvents.filter((e) => e.eventType === 'connection_interrupt');

  // ─── Temporal Cross-Layer Pattern Correlation ──────────────────────────────

  // Extract timestamped look-away events from camera feed
  const lookAwayEvents = cameraEvents.filter(
    (e) =>
      e.eventType === 'look_away' ||
      (e.direction && e.direction !== 'forward')
  );

  // Extract timestamped action events (paste integrity events and paste/burst interactions)
  const actionEvents: { timestamp: string; label: string }[] = [
    ...pasteEvents.map((e) => ({ timestamp: e.timestamp, label: 'paste_attempt' })),
    ...interactions
      .filter((i) => i.pasteDetected === 1 || i.characterBurstFlag === 1)
      .map((i) => ({
        timestamp: i.timestamp || now,
        label: i.pasteDetected === 1 ? 'paste_detected' : 'character_burst',
      })),
  ];

  // Evaluate explicit temporal window matching (configurable Delta, default 5000 ms)
  const inWindowCorrelations = matchTemporalEventWindow(lookAwayEvents, actionEvents, temporalDeltaMs);

  // Pattern A: Technical Interruption Context
  // Camera interruption or face missing occurring with connection drop
  if (cameraInterruptions > 0 && connectionDrops.length > 0) {
    patterns.push({
      id: `pat_tech_${Date.now()}`,
      patternType: 'technical_interruption',
      concernLevel: 'low',
      timestamp: now,
      behavioralSignals: ['Connection latency / drop recorded'],
      cameraSignals: [`${cameraInterruptions} camera interruption/stream drop observed`],
      integritySignals: ['Network reconnection event'],
      explanation:
        'Camera interruption occurred concurrent with network/connection instability. Findings suggest environmental/technical factors rather than intentional evasion.',
    });
  }

  // Pattern B: Correlated Look-Away + Action Anomaly (High / Elevated Concern)
  // Evaluates both fine-grained timestamp-window matching and session-level aggregate co-occurrence
  const hasPasteOrBurst = actionEvents.length > 0;
  const hasLookAwayElevated = prolongedLookAways >= 2 || repeatedLookAways >= 1;
  const hasTemporalOrAggregateCorrelation = inWindowCorrelations.length > 0 || (hasLookAwayElevated && hasPasteOrBurst);

  if (hasTemporalOrAggregateCorrelation) {
    const isExplicitTemporal = inWindowCorrelations.length > 0;
    const minOffsetSec = isExplicitTemporal
      ? Math.min(...inWindowCorrelations.map((c) => c.deltaSec))
      : null;

    const explanation = isExplicitTemporal
      ? `Temporal correlation confirmed within Δ=${(temporalDeltaMs / 1000).toFixed(1)}s window: ${inWindowCorrelations.length} gaze diversion and action event pair(s) aligned (min offset: ${minOffsetSec}s).`
      : 'Co-occurring aggregate rule-based association: session exhibits both elevated gaze diversion and external paste/burst activity across the session.';

    patterns.push({
      id: `pat_corr_${Date.now()}`,
      patternType: 'correlated_anomaly',
      concernLevel: 'high',
      timestamp: now,
      behavioralSignals: [
        'Rapid character insertion burst / external paste detected',
        `Behavioral deviation score (${deviationScore.toFixed(1)}) exceeds threshold`,
      ],
      cameraSignals: [
        `${prolongedLookAways} prolonged and ${repeatedLookAways} repeated look-away events recorded`,
      ],
      integritySignals: pasteEvents.length > 0 ? ['Clipboard paste integrity event'] : [],
      explanation,
    });
  }

  // Pattern C: Multiple-Person Presence
  if (multiplePersonsCount > 0) {
    patterns.push({
      id: `pat_mp_${Date.now()}`,
      patternType: 'correlated_anomaly',
      concernLevel: 'elevated',
      timestamp: now,
      behavioralSignals: ['Active exam interaction in progress'],
      cameraSignals: [`${multiplePersonsCount} multiple-person presence events recorded in frame`],
      integritySignals: [],
      explanation:
        'Additional individuals were detected in camera field of view during active examination window. Human review recommended to assess room context.',
    });
  }

  // Pattern D: Natural Deliberation / Hesitant Student (Deliberation, NOT Misconduct)
  const isDeliberatingState = currentState === 'Hesitation' || currentState === 'Increased Uncertainty' || currentState === 'Possible Confusion';
  if (isDeliberatingState && !hasPasteOrBurst && prolongedLookAways === 0 && multiplePersonsCount === 0) {
    patterns.push({
      id: `pat_delib_${Date.now()}`,
      patternType: 'natural_deliberation',
      concernLevel: 'low',
      timestamp: now,
      behavioralSignals: [
        `Observed state: ${currentState}`,
        'Extended response latency and answer reconsideration',
      ],
      cameraSignals: [
        `Continuous face presence (${presencePct}%) with natural gaze dynamics`,
      ],
      integritySignals: [],
      explanation:
        'Elevated response time and answer revisions reflect deliberative problem solving. Camera shows steady engagement with no unauthorized external assistance indicators.',
    });
  }

  // Pattern E: Isolated Distraction (Brief Look-Away)
  const briefLookAways = cameraSummary ? cameraSummary.briefLookAwayCount : 0;
  if (briefLookAways > 0 && prolongedLookAways === 0 && repeatedLookAways === 0 && !hasPasteOrBurst && !isBehavioralAnomalous) {
    patterns.push({
      id: `pat_brief_${Date.now()}`,
      patternType: 'isolated_distraction',
      concernLevel: 'low',
      timestamp: now,
      behavioralSignals: ['Nominal behavioral consistency aligned with baseline'],
      cameraSignals: [`${briefLookAways} brief look-away events (< 2.5s)`],
      integritySignals: [],
      explanation:
        'Brief, isolated gaze shifts observed with immediate return to active exam interaction. Conforms to natural human test-taking behavior.',
    });
  }

  // Pattern F: Nominal Conforming Interaction
  if (patterns.length === 0) {
    patterns.push({
      id: `pat_norm_${Date.now()}`,
      patternType: 'conforming_interaction',
      concernLevel: 'low',
      timestamp: now,
      behavioralSignals: ['Interaction rhythms and cadence conform to personal baseline'],
      cameraSignals: [`Consistent face presence (${presencePct}%) in primary orientation`],
      integritySignals: [],
      explanation:
        'Both behavioral telemetry and camera observation streams conform to standard examination engagement.',
    });
  }

  // ─── Overall Assessment Level Calculation ──────────────────────────────────

  let overallLevel: 'low_concern' | 'review_recommended' | 'elevated_review_recommended' | 'technical_inconclusive' = 'low_concern';
  let title = 'Standard Examination Engagement';
  let confidence = 85;

  const hasHighPattern = patterns.some((p) => p.concernLevel === 'high');
  const hasElevatedPattern = patterns.some((p) => p.concernLevel === 'elevated');
  const hasTechOnly = patterns.every((p) => p.patternType === 'technical_interruption');

  if (hasHighPattern) {
    overallLevel = 'elevated_review_recommended';
    title = 'Elevated Multimodal Evidence — Human Review Recommended';
    confidence = 90;
  } else if (hasElevatedPattern || isBehavioralAnomalous || isConsistencyLow || prolongedLookAways >= 2) {
    overallLevel = 'review_recommended';
    title = 'Multimodal Evidence Advisory — Review Recommended';
    confidence = 80;
  } else if (hasTechOnly && cameraInterruptions > 0) {
    overallLevel = 'technical_inconclusive';
    title = 'Technical / Network Disruption Noted';
    confidence = 70;
  } else {
    overallLevel = 'low_concern';
    title = 'Nominal Engagement — Low Concern';
    confidence = 88;
  }

  // Construct Summaries
  const behavioralSummary = isBehavioralAnomalous
    ? `Deviation score ${deviationScore.toFixed(1)} exceeds baseline threshold (${personalizedThreshold}). State inferred as '${currentState}'.`
    : `Interaction rhythms align with student personal baseline (Consistency: ${consistencyVal}/100, State: '${currentState}').`;

  const cameraSummaryText = cameraSummary
    ? `Face presence: ${presencePct}%. Look-aways: ${prolongedLookAways} prolonged, ${repeatedLookAways} repeated, ${briefLookAways} brief. Multiple-person events: ${multiplePersonsCount}.`
    : 'Camera observation telemetry nominal.';

  const integritySummary =
    integrityEvents.length > 0
      ? `${integrityEvents.length} integrity opportunity events recorded (${pasteEvents.length} paste, ${fullscreenExits.length} fullscreen exit, ${connectionDrops.length} connection).`
      : 'No environmental integrity interruptions observed.';

  const temporalSummary = patterns.map((p) => p.explanation).join(' ');

  let reviewerRecommendation = 'No action required. Exam conforms to normal student baseline.';
  if (overallLevel === 'elevated_review_recommended') {
    reviewerRecommendation =
      'Recommend instructor review of question timeline where gaze diversion coincides with rapid text modification or external input.';
  } else if (overallLevel === 'review_recommended') {
    reviewerRecommendation =
      'Recommend routine instructor review of highlighted behavioral deviations and camera observation logs.';
  } else if (overallLevel === 'technical_inconclusive') {
    reviewerRecommendation =
      'Verify whether connectivity instability impacted the session before taking any academic actions.';
  }

  return {
    overallAssessmentLevel: overallLevel,
    assessmentTitle: title,
    confidenceScore: confidence,
    behavioralEvidenceSummary: behavioralSummary,
    cameraEvidenceSummary: cameraSummaryText,
    integrityOpportunitySummary: integritySummary,
    temporalCorrelationSummary: temporalSummary,
    observedBehavioralState: currentState,
    correlationPatterns: patterns,
    recommendationForReviewer: reviewerRecommendation,
    assessedAt: now,
  };
}
