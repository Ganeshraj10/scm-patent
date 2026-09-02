/**
 * ExamGuard — Personalized Behavioral Deviation & Risk Analysis Engine
 * 
 * Stage 8: Evaluates graded exam interactions against THAT SAME STUDENT'S
 * personalized behavioral baseline (Stage 5).
 * 
 * Key Principles:
 * 1. Zero Cross-Student Comparisons — Never compares Student A against Student B.
 * 2. Zero Population Baselines — Never compares against a generic "average student".
 * 3. Human-Review Terminology — Measures "Behavioral Deviation", NOT "Proof of Cheating".
 * 4. Model-Maturity Gating — Cold-start students receive "Insufficient Personal History"
 *    with low confidence and zero high-risk accusations.
 */

import {
  getStudentBaseline,
  getExpectedFeatureValue,
  MODELED_FEATURES,
} from '@/lib/services/personalizedBaselineService';
import {
  getGradedExamSession,
  getAllGradedExamSessions,
} from '@/lib/services/examSessionService';
import {
  getStudentGradedRecords,
  PatentRecord,
  getStudentLowStakesRecords,
} from '@/lib/services/datasetService';
import {
  BehavioralAnalysisResult,
  QuestionAnalysis,
  FeatureDeviation,
  FeatureContributionSummary,
  RiskLevel,
  ConfidenceLevel,
  DeviationDirection,
  ExamQuestionTelemetry,
  PersonalizedBaseline,
  MaturityStatus,
} from '@/types';

// ─── Configurable Behavioral Feature Weights ─────────────────────────────────

export const BEHAVIORAL_WEIGHTS_CONFIG = {
  response_time_weight: 0.25,
  answer_revision_count_weight: 0.15,
  answer_revision_time_weight: 0.05,
  pointer_avg_speed_weight: 0.12,
  pointer_distance_weight: 0.08,
  scroll_distance_weight: 0.08,
  scroll_events_weight: 0.05,
  paste_detected_weight: 0.12,
  character_burst_weight: 0.10,
  device_change_weight: 0.05, // Contextual deviation signal
};

// ─── Prototype Risk Thresholds ───────────────────────────────────────────────

export const RISK_THRESHOLDS = {
  LOW_MAX: 29,       // 0–29: Within Personal Pattern
  MEDIUM_MAX: 59,    // 30–59: Behavioral Deviation
  HIGH_MIN: 60,      // 60–100: Review Recommended
};

// ─── Analysis Result Cache ───────────────────────────────────────────────────

const analysisCache = new Map<string, BehavioralAnalysisResult>();

export function clearAnalysisCache(sessionId?: string): void {
  if (sessionId) {
    analysisCache.delete(sessionId);
  } else {
    analysisCache.clear();
  }
}

// ─── Question-Level Feature Deviation Analyzer ───────────────────────────────

/**
 * Computes feature-level deviations and question score for a single question interaction
 * relative to the student's personalized baseline and question difficulty.
 */
export function analyzeQuestion(
  interaction: ExamQuestionTelemetry,
  baseline: PersonalizedBaseline,
  deviceType: string
): QuestionAnalysis {
  const featureDeviations: Record<string, FeatureDeviation> = {};
  let totalWeightedScore = 0;
  let totalApplicableWeights = 0;
  let primaryFeatureKey = '';
  let highestFeatureScore = -1;

  const difficulty = interaction.questionDifficulty || 0.5;
  const isColdStart = baseline.maturityStatus === 'cold_start';

  // 1. Response Time Deviation
  const respExpected = getExpectedFeatureValue(baseline.studentId, 'response_time_sec', {
    difficulty,
    deviceType,
    sessionPosition: interaction.sessionPosition,
  });

  const respObserved = interaction.responseTimeSec;
  const respDiff = Number((respObserved - respExpected.expected).toFixed(1));
  const respSpread = Math.max(4.0, baseline.overallFeatures.response_time_sec?.stdDev || 6.0);
  const respZ = isColdStart ? 0 : Number((respDiff / respSpread).toFixed(2));
  
  // Deviation scoring: |z| <= 1.0 -> 0 score; |z| = 2.0 -> ~50; |z| >= 3.0 -> ~100
  const respAbsZ = Math.abs(respZ);
  const respScore = isColdStart ? 0 : Math.min(100, Math.round(Math.max(0, (respAbsZ - 1.0) / 2.0) * 100));

  featureDeviations['response_time_sec'] = {
    featureKey: 'response_time_sec',
    displayName: 'Response Time',
    observedValue: respObserved,
    expectedValue: respExpected.expected,
    difference: respDiff,
    uncertainty: respSpread,
    standardizedDeviation: respZ,
    direction: respDiff > 1.5 ? 'higher' : respDiff < -1.5 ? 'lower' : 'expected',
    contributionWeight: BEHAVIORAL_WEIGHTS_CONFIG.response_time_weight,
    contributionPct: 0,
    unit: 's',
    status: isColdStart ? 'insufficient_data' : 'evaluated',
    explanation: respDiff < -6.0
      ? `Response time was ${Math.abs(respDiff)}s faster than this student's personalized expectation (${respExpected.expected}s).`
      : respDiff > 8.0
      ? `Response time was ${respDiff}s slower than this student's personalized expectation (${respExpected.expected}s).`
      : `Response time was within this student's expected range for this question difficulty.`,
  };

  totalWeightedScore += respScore * BEHAVIORAL_WEIGHTS_CONFIG.response_time_weight;
  totalApplicableWeights += BEHAVIORAL_WEIGHTS_CONFIG.response_time_weight;

  // 2. Answer Revisions Deviation
  const revExpected = getExpectedFeatureValue(baseline.studentId, 'answer_revision_count', {
    difficulty,
    deviceType,
  });
  const revObserved = interaction.answerRevisionCount || 0;
  const revDiff = revObserved - revExpected.expected;
  const revSpread = Math.max(0.6, baseline.overallFeatures.answer_revision_count?.stdDev || 0.8);
  const revZ = isColdStart ? 0 : Number((revDiff / revSpread).toFixed(2));
  const revScore = isColdStart ? 0 : Math.min(100, Math.round(Math.max(0, (Math.abs(revZ) - 1.2) / 2.0) * 100));

  featureDeviations['answer_revision_count'] = {
    featureKey: 'answer_revision_count',
    displayName: 'Answer Revisions',
    observedValue: revObserved,
    expectedValue: revExpected.expected,
    difference: revDiff,
    uncertainty: revSpread,
    standardizedDeviation: revZ,
    direction: revDiff > 0.5 ? 'higher' : revDiff < -0.5 ? 'lower' : 'expected',
    contributionWeight: BEHAVIORAL_WEIGHTS_CONFIG.answer_revision_count_weight,
    contributionPct: 0,
    unit: 'revs',
    status: isColdStart ? 'insufficient_data' : 'evaluated',
    explanation: revDiff > 1.5
      ? `Revisions (${revObserved}) exceeded student's historical baseline average (${revExpected.expected}).`
      : `Revision count aligned with student's personal habit.`,
  };

  totalWeightedScore += revScore * BEHAVIORAL_WEIGHTS_CONFIG.answer_revision_count_weight;
  totalApplicableWeights += BEHAVIORAL_WEIGHTS_CONFIG.answer_revision_count_weight;

  // 3. Pointer Speed Deviation
  const speedExpected = getExpectedFeatureValue(baseline.studentId, 'pointer_avg_speed_px_s', {
    difficulty,
    deviceType,
  });
  const speedObserved = interaction.pointerAvgSpeedPxS || 0;
  const speedDiff = Number((speedObserved - speedExpected.expected).toFixed(1));
  const speedSpread = Math.max(30.0, baseline.overallFeatures.pointer_avg_speed_px_s?.stdDev || 45.0);
  const speedZ = isColdStart ? 0 : Number((speedDiff / speedSpread).toFixed(2));
  const speedScore = isColdStart ? 0 : Math.min(100, Math.round(Math.max(0, (Math.abs(speedZ) - 1.2) / 2.2) * 100));

  featureDeviations['pointer_avg_speed_px_s'] = {
    featureKey: 'pointer_avg_speed_px_s',
    displayName: 'Pointer Speed',
    observedValue: speedObserved,
    expectedValue: speedExpected.expected,
    difference: speedDiff,
    uncertainty: speedSpread,
    standardizedDeviation: speedZ,
    direction: speedDiff > 35 ? 'higher' : speedDiff < -35 ? 'lower' : 'expected',
    contributionWeight: BEHAVIORAL_WEIGHTS_CONFIG.pointer_avg_speed_weight,
    contributionPct: 0,
    unit: 'px/s',
    status: isColdStart ? 'insufficient_data' : 'evaluated',
    explanation: Math.abs(speedDiff) > 60
      ? `Pointer speed (${speedObserved} px/s) differed from personal baseline (${speedExpected.expected} px/s).`
      : `Pointer movement speed was typical for this student.`,
  };

  totalWeightedScore += speedScore * BEHAVIORAL_WEIGHTS_CONFIG.pointer_avg_speed_weight;
  totalApplicableWeights += BEHAVIORAL_WEIGHTS_CONFIG.pointer_avg_speed_weight;

  // 4. Scroll Distance Deviation
  const scrollExpected = getExpectedFeatureValue(baseline.studentId, 'scroll_distance_px', {
    difficulty,
    deviceType,
  });
  const scrollObserved = interaction.scrollDistancePx || 0;
  const scrollDiff = Number((scrollObserved - scrollExpected.expected).toFixed(1));
  const scrollSpread = Math.max(60.0, baseline.overallFeatures.scroll_distance_px?.stdDev || 100.0);
  const scrollZ = isColdStart ? 0 : Number((scrollDiff / scrollSpread).toFixed(2));
  const scrollScore = isColdStart ? 0 : Math.min(100, Math.round(Math.max(0, (Math.abs(scrollZ) - 1.5) / 2.5) * 100));

  featureDeviations['scroll_distance_px'] = {
    featureKey: 'scroll_distance_px',
    displayName: 'Scroll Distance',
    observedValue: scrollObserved,
    expectedValue: scrollExpected.expected,
    difference: scrollDiff,
    uncertainty: scrollSpread,
    standardizedDeviation: scrollZ,
    direction: scrollDiff > 50 ? 'higher' : scrollDiff < -50 ? 'lower' : 'expected',
    contributionWeight: BEHAVIORAL_WEIGHTS_CONFIG.scroll_distance_weight,
    contributionPct: 0,
    unit: 'px',
    status: isColdStart ? 'insufficient_data' : 'evaluated',
    explanation: `Scroll traversal distance: ${scrollObserved}px vs personal baseline ${scrollExpected.expected}px.`,
  };

  totalWeightedScore += scrollScore * BEHAVIORAL_WEIGHTS_CONFIG.scroll_distance_weight;
  totalApplicableWeights += BEHAVIORAL_WEIGHTS_CONFIG.scroll_distance_weight;

  // 5. Paste Detection Signal
  const pasteObserved = interaction.pasteDetected ? 1 : 0;
  const pasteScore = pasteObserved === 1 ? 85 : 0;

  featureDeviations['paste_detected'] = {
    featureKey: 'paste_detected',
    displayName: 'Paste Event',
    observedValue: pasteObserved,
    expectedValue: 0,
    difference: pasteObserved,
    uncertainty: 0,
    standardizedDeviation: pasteObserved === 1 ? 2.5 : 0,
    direction: pasteObserved === 1 ? 'signal_detected' : 'expected',
    contributionWeight: BEHAVIORAL_WEIGHTS_CONFIG.paste_detected_weight,
    contributionPct: 0,
    unit: 'event',
    status: pasteObserved === 1 ? 'signal_triggered' : 'evaluated',
    explanation: pasteObserved === 1
      ? 'A clipboard paste event was recorded during this question.'
      : 'No paste event detected.',
  };

  totalWeightedScore += pasteScore * BEHAVIORAL_WEIGHTS_CONFIG.paste_detected_weight;
  totalApplicableWeights += BEHAVIORAL_WEIGHTS_CONFIG.paste_detected_weight;

  // 6. Character Burst Signal
  const burstObserved = interaction.characterBurstFlag ? 1 : 0;
  const burstScore = burstObserved === 1 ? 95 : 0;

  featureDeviations['character_burst_flag'] = {
    featureKey: 'character_burst_flag',
    displayName: 'Character Burst',
    observedValue: burstObserved,
    expectedValue: 0,
    difference: burstObserved,
    uncertainty: 0,
    standardizedDeviation: burstObserved === 1 ? 3.0 : 0,
    direction: burstObserved === 1 ? 'signal_detected' : 'expected',
    contributionWeight: BEHAVIORAL_WEIGHTS_CONFIG.character_burst_weight,
    contributionPct: 0,
    unit: 'event',
    status: burstObserved === 1 ? 'signal_triggered' : 'evaluated',
    explanation: burstObserved === 1
      ? `High-cadence character insertion (>100 chars/sec) detected on this question.`
      : 'Character insertion cadence remained within normal physical limits.',
  };

  totalWeightedScore += burstScore * BEHAVIORAL_WEIGHTS_CONFIG.character_burst_weight;
  totalApplicableWeights += BEHAVIORAL_WEIGHTS_CONFIG.character_burst_weight;

  // Question Final Normalized Score
  let questionScore = totalApplicableWeights > 0 ? Math.round(totalWeightedScore / totalApplicableWeights) : 0;
  if (isColdStart) {
    questionScore = 0; // Zero confident deviation for cold start
  }

  // Find primary contributing feature
  Object.values(featureDeviations).forEach((f) => {
    const rawDev = Math.abs(f.standardizedDeviation);
    if (rawDev > highestFeatureScore) {
      highestFeatureScore = rawDev;
      primaryFeatureKey = f.displayName;
    }
  });

  return {
    questionId: interaction.questionId,
    sessionPosition: interaction.sessionPosition,
    questionDifficulty: difficulty,
    questionScore,
    isAnomalous: questionScore >= RISK_THRESHOLDS.HIGH_MIN,
    featureDeviations,
    primaryContributingFeature: primaryFeatureKey,
    explanation: questionScore >= RISK_THRESHOLDS.HIGH_MIN
      ? `Marked deviation observed on ${primaryFeatureKey || 'multiple interaction features'}.`
      : questionScore >= RISK_THRESHOLDS.MEDIUM_MAX
      ? `Moderate behavioral deviation from personal baseline.`
      : `Interaction behavior conformed to personal historical expectation.`,
  };
}

// ─── Session-Level Behavioral Deviation Engine ───────────────────────────────

export function analyzeSession(
  sessionId: string,
  requesterRole: string = 'instructor',
  requesterStudentId?: string
): BehavioralAnalysisResult {
  // Check cache first
  const cached = analysisCache.get(sessionId);
  if (cached) {
    if (requesterRole === 'student' && requesterStudentId && cached.studentId !== requesterStudentId) {
      throw new Error(`[Security] Unauthorized access to foreign session analysis: ${sessionId}`);
    }
    return cached;
  }

  // Retrieve session from live storage or synthetic prototype records
  let studentId = '';
  let examTitle = 'Graded Assessment';
  let deviceType = 'web_desktop';
  let interactions: ExamQuestionTelemetry[] = [];

  const liveSession = getGradedExamSession(sessionId);
  if (liveSession) {
    studentId = liveSession.studentId;
    examTitle = liveSession.examTitle;
    deviceType = liveSession.deviceType;
    interactions = liveSession.interactions;
  } else {
    // Fallback to synthetic dataset graded records
    const allGraded = getAllGradedExamSessions();
    const foundGraded = allGraded.find((s) => s.sessionId === sessionId);
    if (foundGraded) {
      studentId = foundGraded.studentId;
      examTitle = foundGraded.examTitle;
      deviceType = foundGraded.deviceType;
      interactions = foundGraded.interactions;
    } else {
      // Direct lookup from student graded records
      const [prefix] = sessionId.split('_');
      const records = getStudentGradedRecords(prefix);
      const sessionRecords = records.filter((r) => r.session_id === sessionId);
      if (sessionRecords.length > 0) {
        studentId = sessionRecords[0].student_id;
        examTitle = `Examination ${sessionId}`;
        deviceType = sessionRecords[0].device_type;
        interactions = sessionRecords.map((r, idx) => ({
          recordId: r.record_id,
          studentId: r.student_id,
          sessionId: r.session_id,
          questionId: r.question_id,
          questionDifficulty: r.question_difficulty,
          sessionPosition: r.session_position || idx + 1,
          selectedAnswerIndex: 0,
          responseTimeSec: r.response_time_sec,
          answerRevisionCount: r.answer_revision_count,
          answerRevisionTimeSec: r.answer_revision_time_sec,
          pointerDistancePx: r.pointer_distance_px,
          pointerAvgSpeedPxS: r.pointer_avg_speed_px_s,
          scrollDistancePx: r.scroll_distance_px,
          scrollEvents: r.scroll_events,
          pasteDetected: r.paste_detected,
          characterBurstFlag: r.character_burst_flag,
          deviceType: r.device_type,
          timeOfDay: r.time_of_day,
          timestamp: r.timestamp,
        }));
      }
    }
  }

  if (!studentId || interactions.length === 0) {
    throw new Error(`[Analysis] Session ${sessionId} not found or contains no telemetry records.`);
  }

  // Security role verification
  if (requesterRole === 'student' && requesterStudentId && studentId !== requesterStudentId) {
    throw new Error(`[Security] Student ${requesterStudentId} cannot access session ${sessionId} belonging to ${studentId}`);
  }

  // Retrieve Personalized Baseline trained EXCLUSIVELY on this student's low-stakes history
  const baseline = getStudentBaseline(studentId);
  const isColdStart = baseline.maturityStatus === 'cold_start';
  const isDeveloping = baseline.maturityStatus === 'developing';
  const isEstablished = baseline.maturityStatus === 'established';

  // Check device context change
  const historicalDevices = Object.keys(baseline.deviceBaselines);
  const deviceChangeDetected = historicalDevices.length > 0 && !historicalDevices.includes(deviceType);

  // Analyze all questions
  const questionAnalyses = interactions.map((q) => analyzeQuestion(q, baseline, deviceType));

  // Compute aggregated feature deviations and contributions
  const aggregatedFeatureDeviations: Record<string, FeatureDeviation> = {};
  const featureContributionTotals: Record<string, number> = {};

  const featureKeys = [
    'response_time_sec',
    'answer_revision_count',
    'pointer_avg_speed_px_s',
    'scroll_distance_px',
    'paste_detected',
    'character_burst_flag',
  ];

  featureKeys.forEach((key) => {
    let sumDiff = 0;
    let sumZ = 0;
    let sumObserved = 0;
    let sumExpected = 0;
    let count = 0;

    questionAnalyses.forEach((qa) => {
      const fd = qa.featureDeviations[key];
      if (fd) {
        sumDiff += fd.difference;
        sumZ += Math.abs(fd.standardizedDeviation);
        sumObserved += fd.observedValue;
        sumExpected += fd.expectedValue;
        count += 1;
      }
    });

    const avgDiff = count > 0 ? Number((sumDiff / count).toFixed(2)) : 0;
    const avgZ = count > 0 ? Number((sumZ / count).toFixed(2)) : 0;
    const avgObs = count > 0 ? Number((sumObserved / count).toFixed(1)) : 0;
    const avgExp = count > 0 ? Number((sumExpected / count).toFixed(1)) : 0;

    const baseFeat = baseline.overallFeatures[key];
    const weight = (BEHAVIORAL_WEIGHTS_CONFIG as any)[`${key}_weight`] || 0.1;
    const rawContrib = avgZ * weight;
    featureContributionTotals[key] = isColdStart ? 0 : rawContrib;

    aggregatedFeatureDeviations[key] = {
      featureKey: key,
      displayName: baseFeat?.displayName || key,
      observedValue: avgObs,
      expectedValue: avgExp,
      difference: avgDiff,
      uncertainty: baseFeat?.uncertainty || 1.0,
      standardizedDeviation: isColdStart ? 0 : avgZ,
      direction: avgDiff > 0 ? 'higher' : avgDiff < 0 ? 'lower' : 'expected',
      contributionWeight: weight,
      contributionPct: 0,
      unit: baseFeat?.unit || '',
      status: isColdStart ? 'insufficient_data' : 'evaluated',
      explanation: isColdStart
        ? 'Insufficient personal low-stakes history to evaluate this feature.'
        : `Average observed ${baseFeat?.displayName || key}: ${avgObs} (expected: ${avgExp}).`,
    };
  });

  // Calculate percentage contributions
  const totalRawContrib = Object.values(featureContributionTotals).reduce((a, b) => a + b, 0);
  const featureContributions: FeatureContributionSummary[] = featureKeys.map((key) => {
    const raw = featureContributionTotals[key] || 0;
    const pct = totalRawContrib > 0 ? Math.round((raw / totalRawContrib) * 100) : 0;
    const dev = aggregatedFeatureDeviations[key];

    if (dev) {
      dev.contributionPct = pct;
    }

    return {
      featureKey: key,
      displayName: dev?.displayName || key,
      rawContribution: Number(raw.toFixed(3)),
      percentage: pct,
      direction: dev?.direction || 'expected',
      unit: dev?.unit || '',
    };
  }).sort((a, b) => b.percentage - a.percentage);

  // Overall Score Aggregation
  let rawScore = 0;
  if (questionAnalyses.length > 0) {
    const meanQuestionScore = questionAnalyses.reduce((acc, q) => acc + q.questionScore, 0) / questionAnalyses.length;
    const maxQuestionScore = Math.max(...questionAnalyses.map((q) => q.questionScore));
    // 70% mean score + 30% peak anomaly influence
    rawScore = Math.round(meanQuestionScore * 0.7 + maxQuestionScore * 0.3);

    if (deviceChangeDetected && !isColdStart) {
      rawScore = Math.min(100, rawScore + 5); // Contextual signal bonus
    }
  }

  // Model-Maturity Gating
  let overallScore = rawScore;
  let riskLevel: RiskLevel = 'low';
  let riskStatusLabel = 'Within Personal Pattern';
  let confidence: ConfidenceLevel = 'high';
  let confidenceLabel = 'High Confidence (Mature Personalized Baseline)';
  const warnings: string[] = [];

  if (isColdStart) {
    overallScore = Math.min(20, rawScore); // Strictly capped to low
    riskLevel = 'limited_analysis';
    riskStatusLabel = 'Insufficient Personal History';
    confidence = 'low';
    confidenceLabel = 'Low Confidence (Cold Start · <3 Practice Sessions)';
    warnings.push(
      'Insufficient Personal History: The student does not have enough historical low-stakes activity to establish a reliable personalized baseline. No behavioral deviation conclusion is drawn.'
    );
  } else if (isDeveloping) {
    confidence = 'moderate';
    confidenceLabel = `Developing Baseline (${baseline.trainingSessionCount} Sessions · Moderate Confidence)`;
    if (overallScore >= RISK_THRESHOLDS.HIGH_MIN) {
      riskLevel = 'high';
      riskStatusLabel = 'Review Recommended (Developing Baseline)';
    } else if (overallScore >= RISK_THRESHOLDS.MEDIUM_MAX) {
      riskLevel = 'medium';
      riskStatusLabel = 'Behavioral Deviation (Developing Baseline)';
    } else {
      riskLevel = 'low';
      riskStatusLabel = 'Within Personal Pattern';
    }
  } else {
    // Established
    confidence = 'high';
    confidenceLabel = 'High Confidence (Established Baseline · 6+ Sessions)';
    if (overallScore >= RISK_THRESHOLDS.HIGH_MIN) {
      riskLevel = 'high';
      riskStatusLabel = 'Review Recommended';
    } else if (overallScore >= RISK_THRESHOLDS.MEDIUM_MAX) {
      riskLevel = 'medium';
      riskStatusLabel = 'Behavioral Deviation';
    } else {
      riskLevel = 'low';
      riskStatusLabel = 'Within Personal Pattern';
    }
  }

  if (deviceChangeDetected) {
    warnings.push(`Unexpected Device Context: Examination taken on '${deviceType}', which was not among student's historical devices.`);
  }

  // Summary human-review explanation
  let summaryExplanation = '';
  if (isColdStart) {
    summaryExplanation =
      'Personal baseline is in Cold Start state. The examination activity was recorded, but deviation analysis is deferred until the student completes at least 3 low-stakes coursework sessions.';
  } else if (overallScore < RISK_THRESHOLDS.LOW_MAX) {
    summaryExplanation =
      'No significant behavioral deviation detected. The student’s interaction pace, revision frequency, pointer movements, and scrolling aligned closely with their personal coursework baseline.';
  } else if (overallScore < RISK_THRESHOLDS.HIGH_MIN) {
    const topFeature = featureContributions[0]?.displayName || 'interaction timing';
    summaryExplanation = `Moderate behavioral deviation observed relative to this student's historical pattern, primarily in ${topFeature}.`;
  } else {
    const topFeatures = featureContributions.slice(0, 2).map((f) => f.displayName).join(' and ');
    summaryExplanation = `Substantial behavioral deviation from personal expectation observed across ${topFeatures}. Review is recommended to inspect question telemetry.`;
  }

  const result: BehavioralAnalysisResult = {
    analysisId: `ANALYSIS_${sessionId}_${Date.now()}`,
    studentId,
    sessionId,
    examTitle,
    evaluatedAt: new Date().toISOString(),
    modelStatus: baseline.maturityStatus,
    modelMaturityLabel: baseline.maturityLabel,
    trainingSessionCount: baseline.trainingSessionCount,
    overallScore,
    riskLevel,
    riskStatusLabel,
    confidence,
    confidenceLabel,
    examDeviceType: deviceType,
    deviceChangeDetected,
    deviceContextNote: deviceChangeDetected ? `New device (${deviceType}) detected` : undefined,
    questionAnalyses,
    featureDeviations: aggregatedFeatureDeviations,
    featureContributions,
    summaryExplanation,
    warnings,
    isEligibleForReport: !isColdStart,
  };

  analysisCache.set(sessionId, result);
  return result;
}

// ─── Student Analyses Listing ────────────────────────────────────────────────

export function getStudentAnalysisHistory(
  studentId: string,
  requesterRole: string = 'instructor',
  requesterStudentId?: string
): BehavioralAnalysisResult[] {
  if (requesterRole === 'student' && requesterStudentId && studentId !== requesterStudentId) {
    throw new Error(`[Security] Student ${requesterStudentId} cannot access analyses for student ${studentId}`);
  }

  const allGraded = getAllGradedExamSessions();
  const studentSessions = allGraded.filter((s) => s.studentId === studentId);

  return studentSessions.map((s) => analyzeSession(s.sessionId, requesterRole, requesterStudentId));
}
