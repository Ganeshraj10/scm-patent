/**
 * ============================================================================
 * EXAMGUARD — PHASE 4: EXPLAINABLE AI SUBSYSTEM TYPES
 * ============================================================================
 * Defines types for feature attributions, model explainers, covariance coupling,
 * local neighbourhood inspection, sensitivity metrics, and explanation evaluation.
 *
 * Ethical Principle:
 * - Explanations reflect statistical associations and coordinate sensitivities
 *   relative to a student's personal baseline.
 * - They do NOT constitute proof of misconduct or causal intent.
 */

import { MLFeatureKey, ScoreOrientation } from '../types';

export type HumanReviewCategory =
  | 'Normal behaviour'
  | 'Behavioural deviation detected'
  | 'Review required';

export type InstructorReviewDecision =
  | 'pending'
  | 'cleared_normal'
  | 'verified_deviation'
  | 'inconclusive';

export interface FeatureAttribution {
  featureKey: MLFeatureKey;
  displayName: string;
  unit: string;
  observedValue: number;
  baselineMean: number;
  baselineStdDev: number;
  standardizedDeviation: number; // Signed z-score
  expectedConditionalValue?: number; // E[x_j | x_{-j}]
  attributionScore: number; // Normalized importance in [0, 1]
  attributionRank: number; // 1 = highest contributor
  perturbationImpact: number; // Delta in anomaly score when feature is neutralized
  directionalEffect: 'accelerating_deviation' | 'dampening_deviation' | 'neutral';
  humanDescription: string;
}

export interface CovarianceCouplingDetail {
  featureA: MLFeatureKey;
  featureB: MLFeatureKey;
  correlation: number;
  inverseCorrelationTerm: number;
  couplingContribution: number;
}

export interface LOFNeighbourhoodInspection {
  kNeighbors: number;
  queryLocalReachabilityDensity: number;
  averageNeighbourDensity: number;
  densityRatio: number; // LOF score
  neighbours: {
    neighborIndex: number;
    sessionId?: string;
    distance: number;
    kDistance: number;
    lrd: number;
  }[];
}

export interface SVMGradientSensitivity {
  featureKey: MLFeatureKey;
  gradient: number; // d(s) / d(z_j)
  magnitude: number;
  supportVectorProximity: number;
}

export interface ModelExplanationResult {
  modelName: string;
  modelVersion: string;
  sessionId: string;
  studentId: string;
  timestamp: string;
  rawAnomalyScore: number;
  calibratedThreshold: number;
  isAnomaly: boolean;
  scoreOrientation: ScoreOrientation;
  reviewCategory: HumanReviewCategory;
  dataQualityStatus: 'complete' | 'imputed_missing_features';
  dataQualityNotes?: string[];
  
  // Feature-level explanations
  features: FeatureAttribution[];
  topContributingFeature: MLFeatureKey;
  
  // Model-specific explainability artifacts
  mahalanobisCoupling?: {
    isCovarianceAccountedFor: boolean;
    covarianceCouplings: CovarianceCouplingDetail[];
    conditionalExpectedResiduals: Record<MLFeatureKey, number>;
    disclaimer: string;
  };
  isolationForestShap?: {
    baselineExpectedScore: number;
    shapleyValues: Record<MLFeatureKey, number>;
    approximationMethod: 'exact_32_coalitions' | 'kernel_shap';
  };
  lofNeighbourhood?: LOFNeighbourhoodInspection;
  svmSensitivity?: {
    gradients: Record<MLFeatureKey, number>;
    marginOffsetRho: number;
    supportVectorCount: number;
  };

  // Explanation metrics
  explanationFaithfulnessScore: number; // Reduction in score when top features neutralized
  nonCausalDisclaimer: string;
}

export interface ExplanationEvaluationReport {
  faithfulnessAverage: number;
  stabilityScore: number; // Rank stability under measurement noise in [0, 1]
  relevanceConsistency: number; // Alignment with ground truth single/multi deviations
  avgComputationLatencyMs: number;
  totalEvaluated: number;
}

