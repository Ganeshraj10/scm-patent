/**
 * ExamGuard — Personalized Behavioral Baseline Engine
 * 
 * Stage 5: Core patent personalization engine.
 * Computes individual behavioral baselines trained EXCLUSIVELY on each student's
 * own prior low-stakes coursework sessions (session_type === 'low_stakes').
 * 
 * Features difficulty-adjusted linear regression, device-specific baselines,
 * model maturity progression, and uncertainty estimation without any population-wide merging.
 */

import {
  getStudentLowStakesRecords,
  getStudentSessions,
  PatentRecord,
} from '@/lib/services/datasetService';
import {
  PersonalizedBaseline,
  FeatureBaseline,
  DeviceBaseline,
  MaturityStatus,
  AdjustmentMethod,
  BehaviorContext,
} from '@/types';

// ─── Feature Meta Configuration ─────────────────────────────────────────────

export interface FeatureMeta {
  key: string;
  name: string;
  unit: string;
  extractor: (r: PatentRecord) => number;
}

export const MODELED_FEATURES: FeatureMeta[] = [
  {
    key: 'response_time_sec',
    name: 'Response Time',
    unit: 's',
    extractor: (r) => r.response_time_sec,
  },
  {
    key: 'answer_revision_count',
    name: 'Answer Revisions',
    unit: 'revisions',
    extractor: (r) => r.answer_revision_count,
  },
  {
    key: 'answer_revision_time_sec',
    name: 'Revision Timing',
    unit: 's',
    extractor: (r) => r.answer_revision_time_sec,
  },
  {
    key: 'pointer_distance_px',
    name: 'Pointer Distance',
    unit: 'px',
    extractor: (r) => r.pointer_distance_px,
  },
  {
    key: 'pointer_avg_speed_px_s',
    name: 'Pointer Speed',
    unit: 'px/s',
    extractor: (r) => r.pointer_avg_speed_px_s,
  },
  {
    key: 'scroll_distance_px',
    name: 'Scroll Distance',
    unit: 'px',
    extractor: (r) => r.scroll_distance_px,
  },
  {
    key: 'scroll_events',
    name: 'Scroll Events',
    unit: 'events',
    extractor: (r) => r.scroll_events,
  },
  {
    key: 'paste_detected',
    name: 'Paste Activity',
    unit: 'rate',
    extractor: (r) => r.paste_detected,
  },
  {
    key: 'character_burst_flag',
    name: 'Character Burst',
    unit: 'rate',
    extractor: (r) => r.character_burst_flag,
  },
];

// ─── Transparent Statistical Utilities ──────────────────────────────────────

export function calculateStats(values: number[]): {
  mean: number;
  median: number;
  stdDev: number;
  min: number;
  max: number;
  uncertainty: number;
} {
  const n = values.length;
  if (n === 0) {
    return { mean: 0, median: 0, stdDev: 0, min: 0, max: 0, uncertainty: 0 };
  }

  const sum = values.reduce((acc, val) => acc + val, 0);
  const mean = sum / n;

  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(n / 2);
  const median = n % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;

  const min = sorted[0];
  const max = sorted[n - 1];

  let stdDev = 0;
  if (n > 1) {
    const variance = values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / (n - 1);
    stdDev = Math.sqrt(Math.max(0, variance));
  }

  // Transparent uncertainty: Standard Error of the Mean (sigma / sqrt(n))
  const uncertainty = n > 0 ? stdDev / Math.sqrt(n) : 0;

  return {
    mean: Number(mean.toFixed(2)),
    median: Number(median.toFixed(2)),
    stdDev: Number(stdDev.toFixed(2)),
    min: Number(min.toFixed(2)),
    max: Number(max.toFixed(2)),
    uncertainty: Number(uncertainty.toFixed(3)),
  };
}

export function calculateLinearRegression(
  xVals: number[],
  yVals: number[]
): { slope: number; intercept: number; r2: number } | null {
  const n = xVals.length;
  if (n < 3) return null;

  const xMean = xVals.reduce((a, b) => a + b, 0) / n;
  const yMean = yVals.reduce((a, b) => a + b, 0) / n;

  let ssXX = 0;
  let ssYY = 0;
  let ssXY = 0;

  for (let i = 0; i < n; i++) {
    const xDiff = xVals[i] - xMean;
    const yDiff = yVals[i] - yMean;
    ssXX += xDiff * xDiff;
    ssYY += yDiff * yDiff;
    ssXY += xDiff * yDiff;
  }

  // Zero variance in question difficulty
  if (ssXX < 1e-7) return null;

  const slope = ssXY / ssXX;
  const intercept = yMean - slope * xMean;

  let r2 = 0;
  if (ssYY > 1e-7) {
    r2 = Math.min(1, Math.max(0, Math.pow(ssXY, 2) / (ssXX * ssYY)));
  }

  return {
    slope: Number(slope.toFixed(3)),
    intercept: Number(intercept.toFixed(3)),
    r2: Number(r2.toFixed(3)),
  };
}

// ─── Cache ──────────────────────────────────────────────────────────────────

const baselineCache = new Map<string, PersonalizedBaseline>();

export function clearBaselineCache(studentId?: string) {
  if (studentId) {
    baselineCache.delete(studentId);
  } else {
    baselineCache.clear();
  }
}

// ─── Core Baseline Builder ──────────────────────────────────────────────────

export function buildStudentBaseline(studentId: string): PersonalizedBaseline {
  // 1. Retrieve EXCLUSIVELY low-stakes records for the particular student
  const lowStakesRecords = getStudentLowStakesRecords(studentId);
  const lowStakesSessions = Array.from(new Set(lowStakesRecords.map((r) => r.session_id)));
  const trainingSessionCount = lowStakesSessions.length;
  const totalInteractions = lowStakesRecords.length;

  // 2. Model Maturity Progression
  let maturityStatus: MaturityStatus = 'cold_start';
  let maturityLabel = 'Cold Start (Insufficient History)';

  if (trainingSessionCount >= 6) {
    maturityStatus = 'established';
    maturityLabel = `Established Baseline (${trainingSessionCount} Low-Stakes Sessions)`;
  } else if (trainingSessionCount >= 3) {
    maturityStatus = 'developing';
    maturityLabel = `Developing Baseline (${trainingSessionCount} Low-Stakes Sessions)`;
  } else {
    maturityStatus = 'cold_start';
    maturityLabel = `Cold Start (${trainingSessionCount} Sessions · Needs ≥3 Sessions)`;
  }

  // 3. Overall Feature Baselines
  const overallFeatures: Record<string, FeatureBaseline> = {};

  MODELED_FEATURES.forEach((feat) => {
    const rawValues = lowStakesRecords.map(feat.extractor);
    const difficulties = lowStakesRecords.map((r) => r.question_difficulty);

    const stats = calculateStats(rawValues);

    // Question Difficulty Regression
    const regression = calculateLinearRegression(difficulties, rawValues);

    let method: AdjustmentMethod = 'student_mean_fallback';
    let expectedValue = stats.mean;

    if (regression && rawValues.length >= 3) {
      method = 'difficulty_adjusted';
      // Average difficulty expectation as standard baseline reference
      const avgDiff = difficulties.length > 0 ? difficulties.reduce((a, b) => a + b, 0) / difficulties.length : 0.5;
      expectedValue = Number((regression.intercept + regression.slope * avgDiff).toFixed(2));
    }

    let status: 'established' | 'limited_data' | 'insufficient_data' = 'insufficient_data';
    if (rawValues.length >= 6) {
      status = 'established';
    } else if (rawValues.length >= 3) {
      status = 'limited_data';
    }

    overallFeatures[feat.key] = {
      featureName: feat.key,
      displayName: feat.name,
      expectedValue,
      mean: stats.mean,
      median: stats.median,
      stdDev: stats.stdDev,
      min: stats.min,
      max: stats.max,
      sampleCount: stats.mean === 0 && rawValues.length === 0 ? 0 : rawValues.length,
      uncertainty: stats.uncertainty,
      status,
      method,
      unit: feat.unit,
      difficultyRegression: regression || undefined,
    };
  });

  // 4. Device-Specific Baselines
  const deviceBaselines: Record<string, DeviceBaseline> = {};
  const uniqueDevices = Array.from(new Set(lowStakesRecords.map((r) => r.device_type)));

  ['web_desktop', 'web_laptop', 'mobile'].forEach((devType) => {
    const devRecords = lowStakesRecords.filter((r) => r.device_type === devType);
    const devSessions = Array.from(new Set(devRecords.map((r) => r.session_id)));
    const devFeatures: Record<string, FeatureBaseline> = {};

    MODELED_FEATURES.forEach((feat) => {
      const devValues = devRecords.map(feat.extractor);
      const devDifficulties = devRecords.map((r) => r.question_difficulty);

      if (devValues.length >= 3) {
        const stats = calculateStats(devValues);
        const regression = calculateLinearRegression(devDifficulties, devValues);
        let method: AdjustmentMethod = 'difficulty_adjusted';
        let expVal = stats.mean;
        if (regression) {
          const avgDiff = devDifficulties.reduce((a, b) => a + b, 0) / devDifficulties.length;
          expVal = Number((regression.intercept + regression.slope * avgDiff).toFixed(2));
        } else {
          method = 'student_mean_fallback';
        }

        devFeatures[feat.key] = {
          featureName: feat.key,
          displayName: feat.name,
          expectedValue: expVal,
          mean: stats.mean,
          median: stats.median,
          stdDev: stats.stdDev,
          min: stats.min,
          max: stats.max,
          sampleCount: devValues.length,
          uncertainty: stats.uncertainty,
          status: devValues.length >= 6 ? 'established' : 'limited_data',
          method,
          unit: feat.unit,
          difficultyRegression: regression || undefined,
        };
      } else {
        // Fall back to student's overall baseline
        devFeatures[feat.key] = {
          ...overallFeatures[feat.key],
          method: 'student_overall_fallback',
        };
      }
    });

    deviceBaselines[devType] = {
      deviceType: devType,
      sessionCount: devSessions.length,
      sampleCount: devRecords.length,
      features: devFeatures,
    };
  });

  // 5. Time-of-Day Distribution
  const timeOfDayDistribution: Record<string, number> = {
    Morning: 0,
    Afternoon: 0,
    Evening: 0,
    Night: 0,
  };

  lowStakesRecords.forEach((r) => {
    let hour = 12;
    if (r.time_of_day && r.time_of_day.includes(':')) {
      hour = parseInt(r.time_of_day.split(':')[0], 10);
    } else {
      const parsedDate = new Date(r.timestamp);
      if (!isNaN(parsedDate.getTime())) hour = parsedDate.getHours();
    }

    if (hour >= 6 && hour < 12) timeOfDayDistribution.Morning += 1;
    else if (hour >= 12 && hour < 17) timeOfDayDistribution.Afternoon += 1;
    else if (hour >= 17 && hour < 22) timeOfDayDistribution.Evening += 1;
    else timeOfDayDistribution.Night += 1;
  });

  const baseline: PersonalizedBaseline = {
    studentId,
    trainingSessionCount,
    totalInteractions,
    maturityStatus,
    maturityLabel,
    overallFeatures,
    deviceBaselines,
    timeOfDayDistribution,
    lastUpdated: new Date().toISOString().replace('T', ' ').substring(0, 19),
    eligibleLowStakesSessions: lowStakesSessions,
  };

  baselineCache.set(studentId, baseline);
  return baseline;
}

// ─── Query Accessors ────────────────────────────────────────────────────────

export function getStudentBaseline(studentId: string): PersonalizedBaseline {
  if (baselineCache.has(studentId)) {
    return baselineCache.get(studentId)!;
  }
  return buildStudentBaseline(studentId);
}

export function getStudentBaselineForDevice(
  studentId: string,
  deviceType: string
): DeviceBaseline | null {
  const baseline = getStudentBaseline(studentId);
  return baseline.deviceBaselines[deviceType] || null;
}

export function getFeatureBaseline(
  studentId: string,
  featureName: string
): FeatureBaseline | null {
  const baseline = getStudentBaseline(studentId);
  return baseline.overallFeatures[featureName] || null;
}

/**
 * Returns the contextual expected value for a feature given difficulty and device.
 */
export function getExpectedFeatureValue(
  studentId: string,
  featureName: string,
  context?: BehaviorContext
): { expected: number; uncertainty: number; method: AdjustmentMethod } {
  const baseline = getStudentBaseline(studentId);

  let featBaseline: FeatureBaseline = baseline.overallFeatures[featureName];

  // Try device-specific baseline if device context is provided
  if (context?.deviceType && baseline.deviceBaselines[context.deviceType]) {
    const devFeat = baseline.deviceBaselines[context.deviceType].features[featureName];
    if (devFeat) {
      featBaseline = devFeat;
    }
  }

  if (!featBaseline) {
    return { expected: 0, uncertainty: 0, method: 'student_mean_fallback' };
  }

  // Adjust for question difficulty if linear regression model exists and difficulty is provided
  if (
    context?.difficulty !== undefined &&
    featBaseline.difficultyRegression &&
    featBaseline.sampleCount >= 3
  ) {
    const reg = featBaseline.difficultyRegression;
    const adjusted = reg.intercept + reg.slope * context.difficulty;
    return {
      expected: Number(Math.max(0, adjusted).toFixed(2)),
      uncertainty: featBaseline.uncertainty,
      method: 'difficulty_adjusted',
    };
  }

  return {
    expected: featBaseline.expectedValue,
    uncertainty: featBaseline.uncertainty,
    method: featBaseline.method,
  };
}

export function getModelMaturity(studentId: string): {
  status: MaturityStatus;
  label: string;
  sessionCount: number;
} {
  const baseline = getStudentBaseline(studentId);
  return {
    status: baseline.maturityStatus,
    label: baseline.maturityLabel,
    sessionCount: baseline.trainingSessionCount,
  };
}

export function updateBaseline(studentId: string, eligibleSessions?: string[]): PersonalizedBaseline {
  clearBaselineCache(studentId);
  return buildStudentBaseline(studentId);
}
