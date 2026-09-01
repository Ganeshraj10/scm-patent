/**
 * ExamGuard — Patent Risk Explanation Service
 * 
 * Generates clear, non-accusatory, patent-aligned natural language explanations
 * and structured report data from numerical anomaly detection residuals.
 * 
 * Strict Ethical UX Policy:
 * - DO NOT use words like "cheating", "fraud", or "guilty".
 * - Use terms like "Behavioral deviation detected", "Review recommended", "Unusual compared with personal baseline".
 * - Final determination remains strictly with human reviewers.
 */

import { AnomalyEvaluation, FeatureResidual } from './anomalyDetection';
import { PatentRecord } from './datasetService';

export interface ExplanationBullet {
  featureKey: string;
  title: string;
  description: string;
  severity: 'info' | 'warning' | 'critical';
  contributionPct: number;
}

export interface RiskReportData {
  studentId: string;
  sessionId: string;
  recordId: string;
  riskScore: number;
  riskLevel: 'Low' | 'Medium' | 'High';
  statusLabel: string;
  summaryText: string;
  bullets: ExplanationBullet[];
  tableRows: {
    feature: string;
    expected: string;
    observed: string;
    deviation: string;
    contribution: string;
    status: 'Normal' | 'Unusual' | 'Review' | 'Detected';
  }[];
  disclaimer: string;
}

export const PATENT_PROTOTYPE_DISCLAIMER =
  'Prototype using synthetic research data. Behavioral deviation is not proof of misconduct.';

/**
 * Translates an AnomalyEvaluation into a human-readable, explainable risk report.
 */
export function generateRiskReport(
  evaluation: AnomalyEvaluation,
  rawRecord: PatentRecord
): RiskReportData {
  const bullets: ExplanationBullet[] = [];
  const { residuals, expectedBehavior, isColdStart, riskScore, riskLevel } = evaluation;

  // 1. Check Response Time
  const timeRes = residuals.find((r) => r.featureKey === 'responseTime');
  if (timeRes && timeRes.standardizedDeviation >= 2.0 && rawRecord.response_time_sec < expectedBehavior.expectedResponseTime) {
    bullets.push({
      featureKey: 'responseTime',
      title: 'Significantly Accelerated Response Time',
      description: `Response time (${rawRecord.response_time_sec}s) was significantly lower than the student's historical baseline (expected ${expectedBehavior.expectedResponseTime.toFixed(1)}s, given difficulty ${rawRecord.question_difficulty}).`,
      severity: timeRes.standardizedDeviation >= 3.0 ? 'critical' : 'warning',
      contributionPct: timeRes.weightedContribution,
    });
  }

  // 2. Check Revisions
  const revRes = residuals.find((r) => r.featureKey === 'revisionCount');
  if (revRes && revRes.standardizedDeviation >= 2.0) {
    bullets.push({
      featureKey: 'revisionCount',
      title: 'Unusual Revision Count Pattern',
      description: `Answer revision count (${rawRecord.answer_revision_count}) was higher than the student's normal pattern (expected ${expectedBehavior.expectedRevisionCount.toFixed(1)} revisions).`,
      severity: revRes.standardizedDeviation >= 3.0 ? 'critical' : 'warning',
      contributionPct: revRes.weightedContribution,
    });
  }

  // 3. Check Pointer Speed
  const speedRes = residuals.find((r) => r.featureKey === 'pointerSpeed');
  if (speedRes && speedRes.standardizedDeviation >= 2.0 && rawRecord.pointer_avg_speed_px_s > expectedBehavior.expectedPointerSpeed) {
    bullets.push({
      featureKey: 'pointerSpeed',
      title: 'Elevated Pointer Velocity',
      description: `Pointer speed (${rawRecord.pointer_avg_speed_px_s} px/s) was unusually high compared with historical behavior (expected ${expectedBehavior.expectedPointerSpeed.toFixed(1)} px/s).`,
      severity: speedRes.standardizedDeviation >= 3.0 ? 'critical' : 'warning',
      contributionPct: speedRes.weightedContribution,
    });
  }

  // 4. Check Paste Detected
  if (rawRecord.paste_detected === 1) {
    bullets.push({
      featureKey: 'pasteDetected',
      title: 'Clipboard Paste Event Detected',
      description: 'A clipboard paste event was detected during this examination question, contrasting with low-stakes practice baseline.',
      severity: 'critical',
      contributionPct: residuals.find((r) => r.featureKey === 'pasteDetected')?.weightedContribution || 15,
    });
  }

  // 5. Check Character Burst Flag
  if (rawRecord.character_burst_flag === 1) {
    bullets.push({
      featureKey: 'characterBurst',
      title: 'Abnormal Character Burst Detected',
      description: 'An abnormal character insertion burst was logged during answer input.',
      severity: 'critical',
      contributionPct: residuals.find((r) => r.featureKey === 'characterBurst')?.weightedContribution || 10,
    });
  }

  // 6. Check Device Type
  if (expectedBehavior.isUnexpectedDevice) {
    bullets.push({
      featureKey: 'deviceType',
      title: 'Unexpected Device Type',
      description: expectedBehavior.deviceNotes || `Device type '${rawRecord.device_type}' differs from historical device usage.`,
      severity: 'warning',
      contributionPct: residuals.find((r) => r.featureKey === 'deviceType')?.weightedContribution || 5,
    });
  }

  // 7. Cold Start notice
  if (isColdStart) {
    bullets.unshift({
      featureKey: 'coldStart',
      title: 'Immature Model / Cold Start',
      description: 'The student has fewer than 3 historical low-stakes sessions. Anomaly confidence is attenuated and high-risk conclusions are suppressed.',
      severity: 'info',
      contributionPct: 0,
    });
  }

  // Generate high-level summary text
  let statusLabel = 'Normal';
  let summaryText = 'Behavioral patterns align closely with the student’s personalized longitudinal baseline.';

  if (isColdStart) {
    statusLabel = 'Insufficient History';
    summaryText = 'Personalized baseline is still immature due to limited low-stakes history. Baseline confidence is reduced.';
  } else if (riskLevel === 'High') {
    statusLabel = 'High-risk behavioral deviation';
    summaryText = 'Substantial multidimensional deviation detected across response timing, input patterns, and peripheral telemetry. Human review recommended.';
  } else if (riskLevel === 'Medium') {
    statusLabel = 'Unusual behavior';
    summaryText = 'Moderate deviation detected on specific behavioral channels. Verification recommended.';
  }

  // Format table rows
  const tableRows = residuals.map((r) => {
    let expectedStr = `${r.expected} ${r.unit}`;
    let observedStr = `${r.observed} ${r.unit}`;
    let deviationStr = `${r.standardizedDeviation > 0 ? '+' : ''}${r.standardizedDeviation}σ`;

    if (r.featureKey === 'pasteDetected' || r.featureKey === 'characterBurst') {
      expectedStr = `${r.expected}%`;
      observedStr = r.observed === 1 ? 'Yes' : 'No';
      deviationStr = r.observed === 1 ? 'High' : 'None';
    } else if (r.featureKey === 'deviceType') {
      expectedStr = 'Historical Set';
      observedStr = rawRecord.device_type;
      deviationStr = expectedBehavior.isUnexpectedDevice ? 'New Device' : 'Matches';
    }

    return {
      feature: r.label,
      expected: expectedStr,
      observed: observedStr,
      deviation: deviationStr,
      contribution: `${r.weightedContribution}%`,
      status: r.status,
    };
  });

  return {
    studentId: evaluation.studentId,
    sessionId: evaluation.sessionId,
    recordId: evaluation.recordId,
    riskScore,
    riskLevel,
    statusLabel,
    summaryText,
    bullets,
    tableRows,
    disclaimer: PATENT_PROTOTYPE_DISCLAIMER,
  };
}
