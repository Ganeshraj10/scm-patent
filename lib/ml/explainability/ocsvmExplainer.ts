/**
 * ============================================================================
 * EXAMGUARD — PHASE 4: ONE-CLASS SVM (OC-SVM) EXPLAINABILITY MODULE
 * ============================================================================
 * Mathematical Specification:
 * 1. Analytical Decision-Function Sensitivity & Gradient:
 *    - Decision function: f(z) = sum_{i in SV} alpha_i * K(z_i, z) - rho
 *    - Raw anomaly score: s(z) = -f(z) = rho - sum_{i in SV} alpha_i * K(z_i, z)
 *    - Gradient with respect to feature coordinate z_j:
 *        d(s) / d(z_j) = 2 * gamma * sum_{i in SV} alpha_i * K(z_i, z) * (z_j - z_{i, j})
 *    - Magnitude |d(s) / d(z_j)| expresses the local sensitivity of the margin boundary
 *      to infinitesimal changes along dimension j.
 * 2. Counterfactual Feature Perturbation:
 *    - Delta s_j = s(z) - s(z_{\setminus j})
 *    - Directly measures how much feature coordinate z_j pushes the observation
 *      outside the support hyperplane.
 */

import { ML_ORDERED_FEATURES, MLFeatureKey } from '../types';
import { OneClassSVMModel } from '../models/oneClassSvmModel';
import {
  FeatureAttribution,
  ModelExplanationResult,
  HumanReviewCategory,
} from './types';

const FEATURE_METADATA: Record<MLFeatureKey, { displayName: string; unit: string }> = {
  responseTime: { displayName: 'Response Time', unit: 'seconds' },
  revisionCount: { displayName: 'Answer Revisions', unit: 'count' },
  pointerMovement: { displayName: 'Pointer Movement', unit: 'pixels' },
  scrollDistance: { displayName: 'Scroll Displacement', unit: 'pixels' },
  pasteDetected: { displayName: 'Paste Activity', unit: 'events' },
};

export class OneClassSVMExplainer {
  /**
   * Generates gradient sensitivity and counterfactual explainability for One-Class SVM.
   */
  static explain(
    model: OneClassSVMModel,
    observation: number[],
    sessionId: string = 'SESSION-ANON',
    studentId: string = 'STUDENT-ANON',
    timestamp: string = new Date().toISOString()
  ): ModelExplanationResult {
    const scaler = (model as any).scaler;
    const supportVectors = (model as any).supportVectors as {
      vector: number[];
      alpha: number;
    }[];
    const gamma = (model as any).gamma as number;
    const rho = (model as any).rho as number;

    if (!scaler || !scaler.isFitted || !supportVectors || supportVectors.length === 0) {
      throw new Error('[OneClassSVMExplainer] Model must be fitted before generating explanations.');
    }

    const prediction = model.predict(observation, sessionId, studentId, timestamp);
    const z = scaler.transformVector(observation);
    const p = ML_ORDERED_FEATURES.length;
    const observedScore = prediction.rawAnomalyScore;

    // 1. Analytical Decision-Boundary Gradient: d(s) / d(z_j)
    // d(s) / d(z_j) = 2 * gamma * sum_{i in SV} alpha_i * (z_j - z_{i, j}) * max(K(z_i, z), 1e-3)
    // Employs tail-regularization to prevent gradient vanishing on extreme outliers
    const gradients: number[] = new Array(p).fill(0);
    for (let j = 0; j < p; j++) {
      let gradSum = 0;
      for (const sv of supportVectors) {
        const kVal = Math.max(this.rbfKernel(sv.vector, z, gamma), 1e-3);
        gradSum += 2.0 * gamma * sv.alpha * (z[j] - sv.vector[j]) * kVal;
      }
      gradients[j] = Number(gradSum.toFixed(4));
    }

    // 2. Counterfactual Feature Perturbation Delta s_j
    const perturbationDeltas: number[] = new Array(p).fill(0);
    for (let j = 0; j < p; j++) {
      const perturbed = [...observation];
      perturbed[j] = scaler.means[j];
      const s_perturbed = model.predict_score(perturbed);
      perturbationDeltas[j] = Math.max(0, observedScore - s_perturbed);
    }

    const totalDelta = perturbationDeltas.reduce((sum, d) => sum + d, 0) || 1e-4;

    // 3. Build Standardized Feature Attributions
    const gradientMap: Record<MLFeatureKey, number> = {} as any;

    const features: FeatureAttribution[] = ML_ORDERED_FEATURES.map((featureKey, idx) => {
      const meta = FEATURE_METADATA[featureKey];
      const obsVal = observation[idx];
      const meanVal = scaler.means[idx];
      const stdVal = scaler.stdDevs[idx];
      const grad = gradients[idx];
      const delta = perturbationDeltas[idx];
      gradientMap[featureKey] = Number(grad.toFixed(4));

      const normAttribution = Number((delta / totalDelta).toFixed(3));
      let directionalEffect: 'accelerating_deviation' | 'dampening_deviation' | 'neutral' = 'neutral';
      if (grad > 0.05 || delta > 0.1) directionalEffect = 'accelerating_deviation';
      else if (grad < -0.05) directionalEffect = 'dampening_deviation';

      const description = this.buildDescription(
        featureKey,
        obsVal,
        meanVal,
        z[idx],
        grad,
        delta
      );

      return {
        featureKey,
        displayName: meta.displayName,
        unit: meta.unit,
        observedValue: Number(obsVal !== undefined && !isNaN(obsVal) ? obsVal.toFixed(2) : meanVal.toFixed(2)),
        baselineMean: Number(meanVal.toFixed(2)),
        baselineStdDev: Number(stdVal.toFixed(2)),
        standardizedDeviation: Number(z[idx].toFixed(2)),
        attributionScore: normAttribution,
        attributionRank: 1, // updated below
        perturbationImpact: Number(delta.toFixed(3)),
        directionalEffect,
        humanDescription: description,
      };
    });

    // Rank features by perturbation impact
    const sorted = features
      .map((f, idx) => ({ idx, score: perturbationDeltas[idx] }))
      .sort((a, b) => b.score - a.score);
    sorted.forEach((item, rank) => {
      features[item.idx].attributionRank = rank + 1;
    });

    const topFeature = features[sorted[0].idx].featureKey;

    let reviewCategory: HumanReviewCategory = 'Normal behaviour';
    if (prediction.isAnomaly) {
      reviewCategory = prediction.rawAnomalyScore > prediction.calibratedThreshold * 1.25
        ? 'Review required'
        : 'Behavioural deviation detected';
    }

    // Faithfulness: score reduction when top hyperplane-violating feature is neutralized
    const topFeaturePerturbed = [...observation];
    topFeaturePerturbed[sorted[0].idx] = scaler.means[sorted[0].idx];
    const topNeutralizedScore = model.predict_score(topFeaturePerturbed);
    const scoreDiff = observedScore - 0.0;
    const explanationFaithfulnessScore = scoreDiff > 0.05
      ? Number(Math.min(1.0, Math.max(0, (observedScore - topNeutralizedScore) / scoreDiff)).toFixed(3))
      : 0.95;

    return {
      modelName: model.modelName,
      modelVersion: model.version,
      sessionId,
      studentId,
      timestamp,
      rawAnomalyScore: prediction.rawAnomalyScore,
      calibratedThreshold: prediction.calibratedThreshold,
      isAnomaly: prediction.isAnomaly,
      scoreOrientation: model.scoreOrientation,
      reviewCategory,
      dataQualityStatus: observation.some((v) => isNaN(v)) ? 'imputed_missing_features' : 'complete',
      dataQualityNotes: observation.some((v) => isNaN(v))
        ? ['One or more telemetry features were unobserved and imputed to personal baseline mean.']
        : undefined,
      features,
      topContributingFeature: topFeature,
      svmSensitivity: {
        gradients: gradientMap,
        marginOffsetRho: Number(rho.toFixed(4)),
        supportVectorCount: supportVectors.length,
      },
      explanationFaithfulnessScore,
      nonCausalDisclaimer:
        'This explanation details statistical behavioural associations relative to personal baseline. It does not establish causal intent or prove misconduct.',
    };
  }

  private static rbfKernel(a: number[], b: number[], gamma: number): number {
    let sumSq = 0;
    for (let i = 0; i < a.length; i++) {
      const diff = a[i] - b[i];
      sumSq += diff * diff;
    }
    return Math.exp(-gamma * sumSq);
  }

  private static buildDescription(
    key: MLFeatureKey,
    observed: number,
    mean: number,
    z: number,
    grad: number,
    delta: number
  ): string {
    const marginEffect = grad > 0.05 ? 'Extends outside support hyperplane' : 'Within margin projection';
    const direction = z > 0 ? 'above' : 'below';
    return `${marginEffect}: Observed ${observed.toFixed(1)} is ${Math.abs(z).toFixed(1)}σ ${direction} baseline mean (Gradient = ${grad.toFixed(3)}, Δmargin = ${delta.toFixed(3)}).`;
  }
}

