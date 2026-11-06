/**
 * ============================================================================
 * EXAMGUARD — PHASE 4: ISOLATION FOREST EXPLAINABILITY MODULE
 * ============================================================================
 * Mathematical Specification:
 * 1. Exact Shapley Values (SHAP) across All 2^5 = 32 Coalitions:
 *    phi_j = sum_{S subset F \ {j}} [ (|S|! * (p - |S| - 1)!) / p! ] * [ v(S U {j}) - v(S) ]
 *    where:
 *    - F is the 5-feature set
 *    - v(S) is the model anomaly score evaluated on observation with features
 *      in S kept at observed values, and features not in S imputed to student baseline mean mu_k
 *    - Guarantees local efficiency: sum_{j=1}^5 phi_j = s(x) - s(mu)
 * 2. Counterfactual Feature Perturbation:
 *    Delta s_j = s(x) - s(x_{\setminus j})
 *    where x_{\setminus j} replaces x_j with baseline mean mu_j.
 * 3. Faithfulness:
 *    Measures anomaly score reduction when top-ranking SHAP features are neutralized.
 */

import { ML_ORDERED_FEATURES, MLFeatureKey } from '../types';
import { IsolationForestModel } from '../models/isolationForestModel';
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

function factorial(n: number): number {
  if (n <= 1) return 1;
  let res = 1;
  for (let i = 2; i <= n; i++) res *= i;
  return res;
}

export class IsolationForestExplainer {
  /**
   * Generates exact Shapley and perturbation explainability for Isolation Forest.
   */
  static explain(
    model: IsolationForestModel,
    observation: number[],
    sessionId: string = 'SESSION-ANON',
    studentId: string = 'STUDENT-ANON',
    timestamp: string = new Date().toISOString()
  ): ModelExplanationResult {
    const scaler = (model as any).scaler;
    if (!scaler || !scaler.isFitted) {
      throw new Error('[IsolationForestExplainer] Model must be fitted before generating explanations.');
    }

    const prediction = model.predict(observation, sessionId, studentId, timestamp);
    const p = ML_ORDERED_FEATURES.length; // 5 features
    const observedScore = prediction.rawAnomalyScore;

    // Baseline point (all features at student baseline mean)
    const baselineScore = model.predict_score([...scaler.means]);

    // 1. Evaluate Characteristic Function v(S) for all 2^5 = 32 Coalitions
    const numCoalitions = 1 << p; // 32
    const coalitionScores: number[] = new Array(numCoalitions).fill(0);

    for (let mask = 0; mask < numCoalitions; mask++) {
      const hybridVector: number[] = new Array(p).fill(0);
      for (let j = 0; j < p; j++) {
        if ((mask & (1 << j)) !== 0) {
          hybridVector[j] = observation[j] !== undefined && !isNaN(observation[j])
            ? observation[j]
            : scaler.means[j];
        } else {
          hybridVector[j] = scaler.means[j];
        }
      }
      coalitionScores[mask] = model.predict_score(hybridVector);
    }

    // 2. Compute Exact Shapley Values phi_j
    const shapleyValues: number[] = new Array(p).fill(0);

    for (let j = 0; j < p; j++) {
      let phi_j = 0;
      for (let mask = 0; mask < numCoalitions; mask++) {
        // If mask does NOT contain feature j
        if ((mask & (1 << j)) === 0) {
          const S_size = this.countBits(mask);
          const weight =
            (factorial(S_size) * factorial(p - S_size - 1)) / factorial(p);

          const withJ_mask = mask | (1 << j);
          const marginalContribution =
            coalitionScores[withJ_mask] - coalitionScores[mask];

          phi_j += weight * marginalContribution;
        }
      }
      shapleyValues[j] = Number(phi_j.toFixed(4));
    }

    // 3. Counterfactual Single-Feature Perturbation Delta s_j
    const perturbationImpacts: number[] = new Array(p).fill(0);
    for (let j = 0; j < p; j++) {
      const perturbed = [...observation];
      perturbed[j] = scaler.means[j];
      const s_perturbed = model.predict_score(perturbed);
      perturbationImpacts[j] = Number(Math.max(0, observedScore - s_perturbed).toFixed(4));
    }

    const totalPositiveShap = shapleyValues.reduce((sum, v) => sum + Math.max(0, v), 0) || 1e-4;

    // 4. Build Standardized Feature Attributions
    const z = scaler.transformVector(observation);
    const shapRecord: Record<MLFeatureKey, number> = {} as any;

    const features: FeatureAttribution[] = ML_ORDERED_FEATURES.map((featureKey, idx) => {
      const meta = FEATURE_METADATA[featureKey];
      const obsVal = observation[idx];
      const meanVal = scaler.means[idx];
      const stdVal = scaler.stdDevs[idx];
      const phi = shapleyValues[idx];
      shapRecord[featureKey] = phi;

      const normAttribution = Number(Math.max(0, phi / totalPositiveShap).toFixed(3));
      let directionalEffect: 'accelerating_deviation' | 'dampening_deviation' | 'neutral' = 'neutral';
      if (phi > 0.02) directionalEffect = 'accelerating_deviation';
      else if (phi < -0.01) directionalEffect = 'dampening_deviation';

      const description = this.buildDescription(featureKey, obsVal, meanVal, z[idx], phi);

      return {
        featureKey,
        displayName: meta.displayName,
        unit: meta.unit,
        observedValue: Number(obsVal !== undefined && !isNaN(obsVal) ? obsVal.toFixed(2) : meanVal.toFixed(2)),
        baselineMean: Number(meanVal.toFixed(2)),
        baselineStdDev: Number(stdVal.toFixed(2)),
        standardizedDeviation: Number(z[idx].toFixed(2)),
        attributionScore: normAttribution,
        attributionRank: 1, // populated below
        perturbationImpact: perturbationImpacts[idx],
        directionalEffect,
        humanDescription: description,
      };
    });

    // Rank features by Shapley value
    const sorted = features
      .map((f, idx) => ({ idx, score: shapleyValues[idx] }))
      .sort((a, b) => b.score - a.score);
    sorted.forEach((item, rank) => {
      features[item.idx].attributionRank = rank + 1;
    });

    const topFeature = features[sorted[0].idx].featureKey;

    let reviewCategory: HumanReviewCategory = 'Normal behaviour';
    if (prediction.isAnomaly) {
      reviewCategory = prediction.rawAnomalyScore > prediction.calibratedThreshold * 1.2
        ? 'Review required'
        : 'Behavioural deviation detected';
    }

    // Explanation Faithfulness: Anomaly score reduction when top feature is neutralized
    const topFeaturePerturbed = [...observation];
    topFeaturePerturbed[sorted[0].idx] = scaler.means[sorted[0].idx];
    const topRemovedScore = model.predict_score(topFeaturePerturbed);
    const scoreDiff = observedScore - baselineScore;
    const explanationFaithfulnessScore = scoreDiff > 0.01
      ? Number(Math.min(1.0, Math.max(0, (observedScore - topRemovedScore) / scoreDiff)).toFixed(3))
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
      isolationForestShap: {
        baselineExpectedScore: Number(baselineScore.toFixed(4)),
        shapleyValues: shapRecord,
        approximationMethod: 'exact_32_coalitions',
      },
      explanationFaithfulnessScore,
      nonCausalDisclaimer:
        'This explanation details statistical behavioural associations relative to personal baseline. It does not establish causal intent or prove misconduct.',
    };
  }

  private static countBits(n: number): number {
    let count = 0;
    while (n > 0) {
      count += n & 1;
      n >>= 1;
    }
    return count;
  }

  private static buildDescription(
    key: MLFeatureKey,
    observed: number,
    mean: number,
    z: number,
    phi: number
  ): string {
    const impact = phi > 0.03 ? 'Accelerated tree isolation' : 'Neutral tree impact';
    const direction = z > 0 ? 'above' : 'below';
    return `${impact}: Observed ${observed.toFixed(1)} is ${Math.abs(z).toFixed(1)}σ ${direction} baseline mean (Shapley ϕ = ${phi.toFixed(3)}).`;
  }
}

