/**
 * ============================================================================
 * EXAMGUARD — PHASE 3: COMMON ANOMALY DETECTION MODEL INTERFACE
 * ============================================================================
 * Standardized interfaces for the four competing anomaly detection algorithms:
 * 1. Regularised Mahalanobis Distance (Parametric statistical benchmark)
 * 2. Isolation Forest (Tree-based ensemble isolation)
 * 3. Local Outlier Factor (Density-based novelty detector)
 * 4. One-Class SVM (Kernel hyperplane separator)
 */

export const ML_ORDERED_FEATURES = [
  'responseTime',
  'revisionCount',
  'pointerMovement',
  'scrollDistance',
  'pasteDetected',
] as const;

export type MLFeatureKey = (typeof ML_ORDERED_FEATURES)[number];

export type ScoreOrientation =
  | 'higher_is_more_anomalous'
  | 'lower_is_more_anomalous';

export type ModelFamily =
  | 'parametric_statistical'
  | 'ensemble_isolation'
  | 'density_based'
  | 'support_vector_kernel';

export interface ModelMetadata {
  modelName: string;
  modelFamily: ModelFamily;
  version: string;
  scoreOrientation: ScoreOrientation;
  hyperparameters: Record<string, any>;
  trainingObservationCount: number;
  calibrationObservationCount: number;
  calibratedThreshold: number | null;
  targetFPR: number;
}

export interface AnomalyPrediction {
  studentId: string;
  sessionId: string;
  modelName: string;
  rawAnomalyScore: number;
  scoreOrientation: ScoreOrientation;
  calibratedThreshold: number;
  isAnomaly: boolean;
  reviewStatus: 'normal' | 'review_required';
  modelVersion: string;
  timestamp: string;
  dataQualityStatus: string;
  featureContributions?: Record<string, number>;
}

export interface IAnomalyDetectionModel {
  fit(trainingData: number[][]): void;
  predict_score(observation: number[]): number;
  calibrate(calibrationData: number[][], targetFPR?: number): number;
  predict(
    observation: number[],
    sessionId?: string,
    studentId?: string,
    timestamp?: string
  ): AnomalyPrediction;
  get_metadata(): ModelMetadata;
}

export interface ModelBenchmarkResult {
  modelName: string;
  modelFamily: ModelFamily;
  totalEvaluated: number;
  truePositives: number;
  falsePositives: number;
  trueNegatives: number;
  falseNegatives: number;
  tpr: number; // Sensitivity / Recall on true deviations (C, D, E)
  fprOverall: number; // Overall false positive rate on all non-anomalies
  fprCategoryA: number; // False alarm rate on Category A (standard normal)
  farLegitimateCategoryB: number; // False alarm rate on Category B (difficult, breaks, device switch)
  precision: number;
  f1Score: number;
  aucRoc: number;
  avgInferenceLatencyMs: number;
}

