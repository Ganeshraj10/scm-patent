/**
 * ExamGuard — Patent Anomaly Detection Service
 * 
 * Computes deterministic weighted standardized residual anomaly scores (0–100)
 * comparing a graded exam record against the student's personalized baseline.
 * 
 * Modular architecture designed to allow seamless addition of Mahalanobis distance,
 * Ledoit-Wolf covariance shrinkage, and conformal calibration.
 */

import { PatentRecord } from './datasetService';
import { PersonalizedBaseline, calculateExpectedBehavior, ExpectedBehavior } from './behavioralModel';

export interface ScoringWeights {
  responseTime: number;
  revisionCount: number;
  pointerDistance: number;
  pointerSpeed: number;
  scrollDistance: number;
  pasteDetected: number;
  characterBurst: number;
  deviceChange: number;
}

export const DEFAULT_SCORING_WEIGHTS: ScoringWeights = {
  responseTime: 0.20,
  revisionCount: 0.15,
  pointerDistance: 0.10,
  pointerSpeed: 0.15,
  scrollDistance: 0.10,
  pasteDetected: 0.15,
  characterBurst: 0.10,
  deviceChange: 0.05,
};

export type RiskLevel = 'Low' | 'Medium' | 'High';

export interface FeatureResidual {
  featureKey: string;
  label: string;
  unit: string;
  expected: number;
  observed: number;
  residual: number; // observed - expected
  standardizedDeviation: number; // Z-score / normalized distance
  weight: number;
  weightedContribution: number; // percentage of total score
  status: 'Normal' | 'Unusual' | 'Review' | 'Detected';
  direction: 'higher' | 'lower' | 'within_range' | 'flagged';
}

export interface AnomalyEvaluation {
  recordId: string;
  studentId: string;
  sessionId: string;
  sessionType: string;
  questionDifficulty: number;
  isColdStart: boolean;
  modelConfidence: number;
  
  riskScore: number; // 0–100
  riskLevel: RiskLevel;
  reviewRecommended: boolean;
  
  expectedBehavior: ExpectedBehavior;
  residuals: FeatureResidual[];
  evaluatedAt: string;
  
  // Contextual flags
  isUnexpectedDevice: boolean;
  pasteFlagged: boolean;
  burstFlagged: boolean;
}

/**
 * Computes anomaly evaluation for a single graded examination record against a personalized baseline.
 */
export function evaluateSessionAnomaly(
  record: PatentRecord,
  baseline: PersonalizedBaseline,
  customWeights: Partial<ScoringWeights> = {}
): AnomalyEvaluation {
  const weights: ScoringWeights = { ...DEFAULT_SCORING_WEIGHTS, ...customWeights };
  const expected = calculateExpectedBehavior(baseline, record);

  // 1. Response Time deviation (Suspiciously fast vs historical baseline)
  const timeStd = Math.max(baseline.responseTime.stdDev, 1.0);
  const timeResidual = record.response_time_sec - expected.expectedResponseTime;
  // If response time is much lower than expected, standardized deviation increases rapidly
  let timeZ = 0;
  if (record.response_time_sec < expected.expectedResponseTime) {
    timeZ = Math.min(5.0, (expected.expectedResponseTime - record.response_time_sec) / timeStd);
  } else {
    timeZ = Math.min(2.5, (record.response_time_sec - expected.expectedResponseTime) / (timeStd * 2));
  }

  // 2. Answer Revision deviation (Abnormal revision counts)
  const revStd = Math.max(baseline.revisionCount.stdDev, 0.5);
  const revResidual = record.answer_revision_count - expected.expectedRevisionCount;
  const revZ = Math.min(5.0, Math.abs(revResidual) / revStd);

  // 3. Pointer Distance deviation
  const ptrDistStd = Math.max(baseline.pointerDistance.stdDev, 20.0);
  const ptrDistResidual = record.pointer_distance_px - expected.expectedPointerDistance;
  const ptrDistZ = Math.min(5.0, Math.abs(ptrDistResidual) / ptrDistStd);

  // 4. Pointer Speed deviation (Unusually high speed / erratic movement)
  const ptrSpeedStd = Math.max(baseline.pointerSpeed.stdDev, 15.0);
  const ptrSpeedResidual = record.pointer_avg_speed_px_s - expected.expectedPointerSpeed;
  const ptrSpeedZ = record.pointer_avg_speed_px_s > expected.expectedPointerSpeed
    ? Math.min(5.0, (record.pointer_avg_speed_px_s - expected.expectedPointerSpeed) / ptrSpeedStd)
    : Math.min(2.0, (expected.expectedPointerSpeed - record.pointer_avg_speed_px_s) / (ptrSpeedStd * 2));

  // 5. Scroll Distance deviation
  const scrollStd = Math.max(baseline.scrollDistance.stdDev, 15.0);
  const scrollResidual = record.scroll_distance_px - expected.expectedScrollDistance;
  const scrollZ = Math.min(5.0, Math.abs(scrollResidual) / scrollStd);

  // 6. Paste Event
  const pasteZ = record.paste_detected === 1 ? (baseline.pasteRate < 0.2 ? 4.0 : 1.5) : 0;

  // 7. Character Burst Flag
  const burstZ = record.character_burst_flag === 1 ? (baseline.characterBurstRate < 0.2 ? 4.0 : 1.5) : 0;

  // 8. Device Change
  const deviceZ = expected.isUnexpectedDevice ? 3.5 : 0;

  // Calculate raw weighted anomaly metric
  // Normalize each Z-score relative to a typical threshold (~2.5 sigma = standard review zone)
  const scoreParts = [
    { key: 'responseTime', z: timeZ, weight: weights.responseTime },
    { key: 'revisionCount', z: revZ, weight: weights.revisionCount },
    { key: 'pointerDistance', z: ptrDistZ, weight: weights.pointerDistance },
    { key: 'pointerSpeed', z: ptrSpeedZ, weight: weights.pointerSpeed },
    { key: 'scrollDistance', z: scrollZ, weight: weights.scrollDistance },
    { key: 'pasteDetected', z: pasteZ, weight: weights.pasteDetected },
    { key: 'characterBurst', z: burstZ, weight: weights.characterBurst },
    { key: 'deviceChange', z: deviceZ, weight: weights.deviceChange },
  ];

  const totalWeightedZ = scoreParts.reduce((sum, p) => sum + p.z * p.weight, 0);
  const totalWeight = scoreParts.reduce((sum, p) => sum + p.weight, 0);
  const normalizedWeightedZ = totalWeightedZ / (totalWeight || 1);

  // Map normalized Z to 0–100 scale non-linearly (Z=0 -> 10, Z=1.5 -> 35, Z=2.5 -> 65, Z>=3.5 -> 88+)
  let rawRiskScore = Math.min(99, Math.max(5, Math.round(normalizedWeightedZ * 26 + (record.paste_detected && record.character_burst_flag ? 20 : 0))));

  // Handle Cold Start: reduce aggressive score if baseline is immature (< 3 sessions)
  let finalRiskScore = rawRiskScore;
  if (baseline.isColdStart) {
    finalRiskScore = Math.min(55, Math.round(rawRiskScore * 0.65));
  }

  // Determine Risk Level
  let riskLevel: RiskLevel = 'Low';
  if (finalRiskScore >= 70) {
    riskLevel = 'High';
  } else if (finalRiskScore >= 40) {
    riskLevel = 'Medium';
  }

  const reviewRecommended = riskLevel === 'High' || (riskLevel === 'Medium' && (record.paste_detected === 1 || expected.isUnexpectedDevice));

  // Compute percentage contributions for each feature
  const totalContributionUnits = scoreParts.reduce((sum, p) => sum + p.z * p.weight, 0) || 1;

  const residuals: FeatureResidual[] = [
    {
      featureKey: 'responseTime',
      label: 'Response Time',
      unit: 'sec',
      expected: Number(expected.expectedResponseTime.toFixed(1)),
      observed: Number(record.response_time_sec.toFixed(1)),
      residual: Number(timeResidual.toFixed(1)),
      standardizedDeviation: Number(timeZ.toFixed(2)),
      weight: weights.responseTime,
      weightedContribution: Math.round(((scoreParts[0].z * weights.responseTime) / totalContributionUnits) * 100),
      status: timeZ >= 2.0 ? 'Unusual' : 'Normal',
      direction: record.response_time_sec < expected.expectedResponseTime ? 'lower' : 'higher',
    },
    {
      featureKey: 'revisionCount',
      label: 'Answer Revisions',
      unit: 'revisions',
      expected: Number(expected.expectedRevisionCount.toFixed(1)),
      observed: record.answer_revision_count,
      residual: Number(revResidual.toFixed(1)),
      standardizedDeviation: Number(revZ.toFixed(2)),
      weight: weights.revisionCount,
      weightedContribution: Math.round(((scoreParts[1].z * weights.revisionCount) / totalContributionUnits) * 100),
      status: revZ >= 2.0 ? 'Unusual' : 'Normal',
      direction: revResidual > 0 ? 'higher' : revResidual < 0 ? 'lower' : 'within_range',
    },
    {
      featureKey: 'pointerSpeed',
      label: 'Pointer Speed',
      unit: 'px/s',
      expected: Number(expected.expectedPointerSpeed.toFixed(1)),
      observed: Number(record.pointer_avg_speed_px_s.toFixed(1)),
      residual: Number(ptrSpeedResidual.toFixed(1)),
      standardizedDeviation: Number(ptrSpeedZ.toFixed(2)),
      weight: weights.pointerSpeed,
      weightedContribution: Math.round(((scoreParts[3].z * weights.pointerSpeed) / totalContributionUnits) * 100),
      status: ptrSpeedZ >= 2.0 ? 'Unusual' : 'Normal',
      direction: ptrSpeedResidual > 0 ? 'higher' : 'lower',
    },
    {
      featureKey: 'pointerDistance',
      label: 'Pointer Distance',
      unit: 'px',
      expected: Number(expected.expectedPointerDistance.toFixed(1)),
      observed: Number(record.pointer_distance_px.toFixed(1)),
      residual: Number(ptrDistResidual.toFixed(1)),
      standardizedDeviation: Number(ptrDistZ.toFixed(2)),
      weight: weights.pointerDistance,
      weightedContribution: Math.round(((scoreParts[2].z * weights.pointerDistance) / totalContributionUnits) * 100),
      status: ptrDistZ >= 2.2 ? 'Unusual' : 'Normal',
      direction: ptrDistResidual > 0 ? 'higher' : 'lower',
    },
    {
      featureKey: 'scrollDistance',
      label: 'Scroll Activity',
      unit: 'px',
      expected: Number(expected.expectedScrollDistance.toFixed(1)),
      observed: Number(record.scroll_distance_px.toFixed(1)),
      residual: Number(scrollResidual.toFixed(1)),
      standardizedDeviation: Number(scrollZ.toFixed(2)),
      weight: weights.scrollDistance,
      weightedContribution: Math.round(((scoreParts[4].z * weights.scrollDistance) / totalContributionUnits) * 100),
      status: scrollZ >= 2.2 ? 'Unusual' : 'Normal',
      direction: scrollResidual > 0 ? 'higher' : 'lower',
    },
    {
      featureKey: 'pasteDetected',
      label: 'Paste Detection',
      unit: 'event',
      expected: Number((baseline.pasteRate * 100).toFixed(0)),
      observed: record.paste_detected,
      residual: record.paste_detected - baseline.pasteRate,
      standardizedDeviation: pasteZ,
      weight: weights.pasteDetected,
      weightedContribution: Math.round(((scoreParts[5].z * weights.pasteDetected) / totalContributionUnits) * 100),
      status: record.paste_detected === 1 ? 'Detected' : 'Normal',
      direction: record.paste_detected === 1 ? 'flagged' : 'within_range',
    },
    {
      featureKey: 'characterBurst',
      label: 'Character Burst',
      unit: 'event',
      expected: Number((baseline.characterBurstRate * 100).toFixed(0)),
      observed: record.character_burst_flag,
      residual: record.character_burst_flag - baseline.characterBurstRate,
      standardizedDeviation: burstZ,
      weight: weights.characterBurst,
      weightedContribution: Math.round(((scoreParts[6].z * weights.characterBurst) / totalContributionUnits) * 100),
      status: record.character_burst_flag === 1 ? 'Detected' : 'Normal',
      direction: record.character_burst_flag === 1 ? 'flagged' : 'within_range',
    },
    {
      featureKey: 'deviceType',
      label: 'Device Usage',
      unit: 'type',
      expected: baseline.historicalDevices.length,
      observed: expected.isUnexpectedDevice ? 0 : 1,
      residual: expected.isUnexpectedDevice ? 1 : 0,
      standardizedDeviation: deviceZ,
      weight: weights.deviceChange,
      weightedContribution: Math.round(((scoreParts[7].z * weights.deviceChange) / totalContributionUnits) * 100),
      status: expected.isUnexpectedDevice ? 'Review' : 'Normal',
      direction: expected.isUnexpectedDevice ? 'flagged' : 'within_range',
    },
  ];

  return {
    recordId: record.record_id,
    studentId: record.student_id,
    sessionId: record.session_id,
    sessionType: record.session_type,
    questionDifficulty: record.question_difficulty,
    isColdStart: baseline.isColdStart,
    modelConfidence: baseline.confidence,
    riskScore: finalRiskScore,
    riskLevel,
    reviewRecommended,
    expectedBehavior: expected,
    residuals,
    evaluatedAt: new Date().toISOString(),
    isUnexpectedDevice: expected.isUnexpectedDevice,
    pasteFlagged: record.paste_detected === 1,
    burstFlagged: record.character_burst_flag === 1,
  };
}
