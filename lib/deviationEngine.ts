import { BehavioralModel, BehavioralSession, DeviationAnalysis, FeatureContribution } from '@/types';

/**
 * TEMPORARY_PROTOTYPE_THRESHOLD
 * This is a prototype threshold. The final architecture will replace this with student-specific distribution-free calibration.
 */
const TEMPORARY_PROTOTYPE_THRESHOLD = 2.5;

const FEATURE_WEIGHTS: Record<string, number> = {
  responseTime: 0.25,
  revisionCount: 0.20,
  pointerMovement: 0.20,
  scrollDistance: 0.15,
  pasteDetected: 0.20,
};

function calculateFeatureZScore(observed: number, mean: number, stdDev: number): number {
  if (stdDev === 0) {
    // prevent division by zero; use a small epsilon
    return Math.abs(observed - mean) / 0.001;
  }
  const zScore = Math.abs(observed - mean) / stdDev;
  return isNaN(zScore) || !isFinite(zScore) ? 0 : zScore;
}

function calculateFeatureContributions(sessionFeatures: any, model: BehavioralModel): FeatureContribution[] {
  const contributions: FeatureContribution[] = [];

  model.expectations.forEach(exp => {
    const observed = sessionFeatures[exp.feature] ?? 0;
    const expected = exp.mean;
    const stdDev = exp.stdDev;
    
    // Prototype Z-Score
    let deviation = 0;
    if (exp.feature === 'pasteDetected') {
      // Handle paste as a binary or frequency signal
      deviation = calculateFeatureZScore(observed, expected, stdDev);
    } else {
      deviation = calculateFeatureZScore(observed, expected, stdDev);
    }

    // Weighted Contribution
    const weight = FEATURE_WEIGHTS[exp.feature] ?? 0;
    const contribution = deviation * weight;

    let direction: 'higher_than_expected' | 'lower_than_expected' | 'within_expected_range' = 'within_expected_range';
    if (observed > expected + stdDev) {
      direction = 'higher_than_expected';
    } else if (observed < expected - stdDev) {
      direction = 'lower_than_expected';
    }

    contributions.push({
      feature: exp.feature,
      label: exp.label,
      unit: exp.unit,
      expected,
      observed,
      deviation,
      contribution,
      // @ts-ignore - patching the type for direction dynamically
      direction,
    });
  });

  return contributions;
}

function calculateDeviation(contributions: FeatureContribution[]): number {
  return contributions.reduce((sum, c) => sum + c.contribution, 0);
}

function determineReviewStatus(deviationScore: number, sessionCount: number, personalizedThreshold: number): 'normal' | 'review_required' | 'analysis_limited' {
  if (sessionCount < 10) {
    return 'analysis_limited';
  }
  if (deviationScore > personalizedThreshold) {
    return 'review_required';
  }
  return 'normal';
}

/**
 * Calculates the raw non-conformity/deviation score for a given set of features against a model.
 * This is used both for final graded evaluation and internally during conformal calibration.
 */
export function calculateRawDeviationScore(featuresList: any[], model: BehavioralModel): number {
  const numQuestions = featuresList.length || 1;
  let totalTime = 0, totalPointer = 0, totalScroll = 0, totalRevisions = 0, totalPaste = 0;
  
  featuresList.forEach(f => {
    totalTime += f.responseTime || 0;
    totalPointer += f.pointerMovement || 0;
    totalScroll += f.scrollDistance || 0;
    totalRevisions += f.revisionCount || 0;
    totalPaste += f.pasteDetected ? 1 : 0; // boolean to count
  });

  const averagedFeatures = {
    responseTime: totalTime / numQuestions,
    pointerMovement: totalPointer / numQuestions,
    scrollDistance: totalScroll / numQuestions,
    revisionCount: totalRevisions / numQuestions,
    pasteDetected: (totalPaste / numQuestions) * 100, // as percentage
  };

  const featureContributions = calculateFeatureContributions(averagedFeatures, model);
  return calculateDeviation(featureContributions);
}

/**
 * Executes the prototype deviation engine against a graded exam session.
 */
export function evaluateSessionDeviation(session: BehavioralSession, model: BehavioralModel): DeviationAnalysis {
  // Use the extracted raw deviation calculator
  const deviationScore = calculateRawDeviationScore(session.features || [], model);
  
  // Also need to get featureContributions for the UI. We can recalculate it here to keep the API clean.
  const numQuestions = session.features?.length || 1;
  let totalTime = 0, totalPointer = 0, totalScroll = 0, totalRevisions = 0, totalPaste = 0;
  session.features?.forEach(f => {
    totalTime += f.responseTime || 0;
    totalPointer += f.pointerMovement || 0;
    totalScroll += f.scrollDistance || 0;
    totalRevisions += f.revisionCount || 0;
    totalPaste += f.pasteDetected ? 1 : 0;
  });
  const averagedFeatures = {
    responseTime: totalTime / numQuestions,
    pointerMovement: totalPointer / numQuestions,
    scrollDistance: totalScroll / numQuestions,
    revisionCount: totalRevisions / numQuestions,
    pasteDetected: (totalPaste / numQuestions) * 100,
  };
  const featureContributions = calculateFeatureContributions(averagedFeatures, model);

  
  const threshold = model.calibratedThreshold ?? TEMPORARY_PROTOTYPE_THRESHOLD;
  const status = determineReviewStatus(deviationScore, model.sessionCount, threshold);

  // Re-map the status to ReviewStatus type
  let finalStatus: any = status;
  if (status === 'analysis_limited') {
    finalStatus = 'normal'; // It shouldn't trigger a hard review flag
  }

  return {
    sessionId: session.id,
    studentId: session.studentId,
    deviationScore,
    personalizedThreshold: model.calibratedThreshold ?? TEMPORARY_PROTOTYPE_THRESHOLD,
    reviewRequired: status === 'review_required',
    confidence: model.confidence,
    featureContributions,
    computedAt: new Date().toISOString(),
    // Expose raw status for UI
    // @ts-ignore
    rawStatus: status,
  };
}
