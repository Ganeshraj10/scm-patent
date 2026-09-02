/**
 * ExamGuard — Explainable Behavioral Risk Report Service
 * 
 * Stage 9: Transforms Stage 8 personalized behavioral analysis into an
 * instructor-comprehensible, fully transparent, and explainable risk report.
 * 
 * Key Principles:
 * 1. Strictly Relative to Personal Baseline — Explanations compare the student's exam
 *    against THEIR OWN historical low-stakes baseline.
 * 2. Orthogonal Concept Separation:
 *    - Model Maturity: Cold Start / Developing / Established
 *    - Behavioral Deviation: Low / Medium / High
 *    - Misconduct Determination: Pending Human Review (never automated)
 * 3. Human-Review Language — No claims of "cheated" or "probability of cheating".
 */

import { analyzeSession } from '@/lib/services/behavioralAnalysisService';
import { getStudentBaseline } from '@/lib/services/personalizedBaselineService';
import { getDemoStudentProfile } from '@/lib/services/demoStudentService';
import { mockStudents } from '@/data/mockStudents';
import {
  BehavioralRiskReport,
  FeatureReportItem,
  QuestionReportItem,
  FeatureStatusTag,
  BehavioralAnalysisResult,
  DeviationDirection,
} from '@/types';

/**
 * Maps a standardized z-score to a clear, human-review friendly status tag
 */
export function determineFeatureStatusTag(
  featureKey: string,
  zScore: number,
  observedValue: number,
  isColdStart: boolean
): FeatureStatusTag {
  if (isColdStart) {
    return 'Insufficient Data';
  }

  // Binary event signals
  if (featureKey === 'paste_detected' || featureKey === 'character_burst_flag') {
    return observedValue === 1 ? 'Detected Signal' : 'Within Baseline';
  }

  const absZ = Math.abs(zScore);
  if (absZ > 2.0) {
    return 'Significant Deviation';
  }
  if (absZ > 1.0) {
    return 'Mild Deviation';
  }
  return 'Within Baseline';
}

/**
 * Generates an explainable behavioral risk report consuming Stage 8 analysis results.
 */
export function generateRiskReport(
  sessionId: string,
  requesterRole: string = 'instructor',
  requesterStudentId?: string
): BehavioralRiskReport {
  // 1. Obtain Stage 8 Personalized Analysis
  const analysis: BehavioralAnalysisResult = analyzeSession(sessionId, requesterRole, requesterStudentId);
  const baseline = getStudentBaseline(analysis.studentId);
  const demoProfile = getDemoStudentProfile(analysis.studentId);

  // Student metadata lookup
  const matchedStudent = mockStudents.find((s) => s.studentId === analysis.studentId || s.id === analysis.studentId);
  const studentName = demoProfile ? demoProfile.name : (matchedStudent ? matchedStudent.name : `Student ${analysis.studentId}`);
  const department = matchedStudent?.department || 'Computer Science & Engineering';

  const isColdStart = analysis.modelStatus === 'cold_start';
  const isDeveloping = analysis.modelStatus === 'developing';
  const isEstablished = analysis.modelStatus === 'established';

  // 2. Build Feature-Level Report Items
  const featureReports: FeatureReportItem[] = Object.values(analysis.featureDeviations).map((fd) => {
    const baseFeat = baseline.overallFeatures[fd.featureKey];
    const stdDev = baseFeat?.stdDev || 1.0;
    const status = determineFeatureStatusTag(fd.featureKey, fd.standardizedDeviation, fd.observedValue, isColdStart);

    let explanation = fd.explanation;
    if (!isColdStart) {
      if (fd.featureKey === 'response_time_sec') {
        if (fd.difference < -6.0) {
          explanation = `Observed response time (${fd.observedValue}s) was substantially lower than this student's historical expectation (${fd.expectedValue}s).`;
        } else if (fd.difference > 8.0) {
          explanation = `Observed response time (${fd.observedValue}s) was noticeably higher than this student's historical expectation (${fd.expectedValue}s).`;
        } else {
          explanation = `Observed response time (${fd.observedValue}s) aligned closely with this student's personalized expectation (${fd.expectedValue}s).`;
        }
      } else if (fd.featureKey === 'answer_revision_count') {
        if (fd.difference > 1.5) {
          explanation = `Answer revisions (${fd.observedValue}) were substantially higher than the student's personal historical pattern (${fd.expectedValue}).`;
        } else {
          explanation = `Revision count (${fd.observedValue}) conformed to the student's personal habit.`;
        }
      } else if (fd.featureKey === 'pointer_avg_speed_px_s') {
        if (Math.abs(fd.difference) > 50) {
          explanation = `Pointer movement speed (${fd.observedValue} px/s) differed from the student's historical baseline range (${fd.expectedValue} px/s).`;
        } else {
          explanation = `Pointer movement speed was typical for this student.`;
        }
      } else if (fd.featureKey === 'paste_detected') {
        explanation = fd.observedValue === 1
          ? 'A clipboard paste event was recorded during the examination.'
          : 'No paste event detected.';
      } else if (fd.featureKey === 'character_burst_flag') {
        explanation = fd.observedValue === 1
          ? 'A high-cadence character insertion (>100 chars/sec) was recorded.'
          : 'Character insertion cadence remained within normal physical limits.';
      }
    }

    return {
      featureKey: fd.featureKey,
      displayName: fd.displayName,
      expected: fd.expectedValue,
      observed: fd.observedValue,
      difference: fd.difference,
      uncertainty: fd.uncertainty,
      standardizedDeviation: fd.standardizedDeviation,
      contributionPct: fd.contributionPct,
      unit: fd.unit,
      status,
      direction: fd.direction,
      explanation,
      rangeMin: Number(Math.max(0, fd.expectedValue - stdDev).toFixed(1)),
      rangeMax: Number((fd.expectedValue + stdDev).toFixed(1)),
    };
  });

  // 3. Build Question-Level Report Items
  const questionReports: QuestionReportItem[] = analysis.questionAnalyses.map((qa) => {
    const respFeat = qa.featureDeviations['response_time_sec'];
    const revFeat = qa.featureDeviations['answer_revision_count'];
    const speedFeat = qa.featureDeviations['pointer_avg_speed_px_s'];
    const scrollFeat = qa.featureDeviations['scroll_distance_px'];
    const pasteFeat = qa.featureDeviations['paste_detected'];
    const burstFeat = qa.featureDeviations['character_burst_flag'];

    const tier = qa.questionScore >= 60 ? 'High' : qa.questionScore >= 30 ? 'Moderate' : 'Low';

    return {
      questionId: qa.questionId,
      sessionPosition: qa.sessionPosition,
      difficulty: qa.questionDifficulty,
      responseTimeObs: respFeat?.observedValue || 0,
      responseTimeExp: respFeat?.expectedValue || 0,
      revisionCountObs: revFeat?.observedValue || 0,
      revisionCountExp: revFeat?.expectedValue || 0,
      pointerSpeedObs: speedFeat?.observedValue || 0,
      scrollDistanceObs: scrollFeat?.observedValue || 0,
      pasteDetected: pasteFeat?.observedValue || 0,
      characterBurstFlag: burstFeat?.observedValue || 0,
      questionScore: qa.questionScore,
      deviationTier: tier,
      explanation: qa.explanation,
    };
  });

  // 4. Synthesize Dynamic Executive Summary
  let executiveSummary = '';
  if (isColdStart) {
    executiveSummary =
      'Insufficient personal history is available to make a reliable personalized comparison. The student has completed fewer than 3 low-stakes coursework sessions, precluding confident baseline establishment.';
  } else if (analysis.overallScore < 30) {
    executiveSummary =
      'The observed behavior was generally consistent with the student\'s established historical pattern across all evaluated behavioral dimensions. Response times, pointer kinetics, and revision counts conformed to personal baselines.';
  } else if (analysis.overallScore < 60) {
    const topContributors = analysis.featureContributions.slice(0, 2).map((f) => f.displayName).join(' and ');
    executiveSummary = `Several behavioral features differed from the student's personalized baseline, primarily in ${topContributors}. Moderate behavioral divergence detected.`;
  } else {
    const topContributors = analysis.featureContributions.slice(0, 2).map((f) => f.displayName).join(' and ');
    executiveSummary = `Substantial behavioral deviation from the personalized baseline was observed. ${topContributors} were the strongest contributors to the observed deviation.`;
  }

  // Append developing baseline context if applicable
  if (isDeveloping && !isColdStart) {
    executiveSummary += ' Note: The personalized baseline is still developing because limited historical coursework data is available.';
  }

  // 5. Recommended Action
  let recommendedAction = '';
  if (isColdStart) {
    recommendedAction = 'No automated deviation escalation. Encourage the student to complete additional low-stakes coursework sessions to build baseline maturity.';
  } else if (analysis.overallScore >= 60) {
    recommendedAction = 'Human review recommended. Detailed telemetry inspection is suggested for high-deviation questions and behavioral signals.';
  } else if (analysis.overallScore >= 30) {
    recommendedAction = 'Consider instructor review. Moderate behavioral divergence detected relative to personal baseline.';
  } else {
    recommendedAction = 'No significant behavioral deviation detected. Session conforms to personalized expectation.';
  }

  // 6. Device Context Explanation
  let deviceContextExplanation: string | undefined = undefined;
  const historicalDevices = Object.keys(baseline.deviceBaselines);
  if (analysis.deviceChangeDetected) {
    deviceContextExplanation = `The examination was taken on '${analysis.examDeviceType}', which differs from the student's historical device usage (${historicalDevices.join(', ') || 'none'}). This is treated as a contextual signal and does NOT indicate misconduct.`;
  }

  const report: BehavioralRiskReport = {
    reportId: `REP_${analysis.sessionId}_${Date.now()}`,
    studentId: analysis.studentId,
    studentName,
    department,
    sessionId: analysis.sessionId,
    examId: analysis.sessionId,
    examTitle: analysis.examTitle,
    generatedAt: new Date().toISOString(),

    modelStatus: analysis.modelStatus,
    modelMaturityLabel: analysis.modelMaturityLabel,
    trainingSessionCount: analysis.trainingSessionCount,

    overallScore: analysis.overallScore,
    riskLevel: analysis.riskLevel,
    riskStatusLabel: analysis.riskStatusLabel,
    confidence: analysis.confidence,
    confidenceLabel: analysis.confidenceLabel,

    executiveSummary,
    recommendedAction,

    featureReports,
    questionReports,

    examDeviceType: analysis.examDeviceType,
    historicalDevices,
    deviceChangeDetected: analysis.deviceChangeDetected,
    deviceContextExplanation,

    analysisMethod: 'Personalized Weighted Deviation (SCM-Patent Engine)',
    disclaimer: 'Behavioral deviation is not proof of misconduct. Human review is required before taking any administrative or academic action.',
    warnings: analysis.warnings,
    isEligibleForHumanReview: !isColdStart,
  };

  return report;
}

export function getExecutiveSummary(sessionId: string): string {
  const report = generateRiskReport(sessionId);
  return report.executiveSummary;
}

export function getFeatureExplanations(sessionId: string): FeatureReportItem[] {
  const report = generateRiskReport(sessionId);
  return report.featureReports;
}

export function getQuestionAnalysis(sessionId: string): QuestionReportItem[] {
  const report = generateRiskReport(sessionId);
  return report.questionReports;
}
