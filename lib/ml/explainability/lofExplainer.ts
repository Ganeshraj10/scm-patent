/**
 * ============================================================================
 * EXAMGUARD — PHASE 4: LOCAL OUTLIER FACTOR (LOF) EXPLAINABILITY MODULE
 * ============================================================================
 * Mathematical Specification:
 * 1. Local Neighbourhood Inspection:
 *    - Identifies k-nearest baseline neighbours N_k(x) in standardized space.
 *    - For each neighbor o in N_k(x), details:
 *      * Distance d(x, o)
 *      * Baseline k-distance k-dist(o)
 *      * Baseline local reachability density lrd(o)
 *    - Compares query density lrd(x) to mean neighbor density:
 *      LOF(x) = mean_{o in N_k(x)} [ lrd(o) / lrd(x) ]
 * 2. Feature-Removal / Marginal Density Perturbation:
 *    - Delta LOF_j = LOF(x) - LOF(x_{\setminus j})
 *    - Isolates which feature dimension drove the query observation away from
 *      the student's dense baseline cluster.
 */

import { ML_ORDERED_FEATURES, MLFeatureKey } from '../types';
import { LocalOutlierFactorModel } from '../models/localOutlierFactorModel';
import {
  FeatureAttribution,
  ModelExplanationResult,
  LOFNeighbourhoodInspection,
  HumanReviewCategory,
} from './types';

const FEATURE_METADATA: Record<MLFeatureKey, { displayName: string; unit: string }> = {
  responseTime: { displayName: 'Response Time', unit: 'seconds' },
  revisionCount: { displayName: 'Answer Revisions', unit: 'count' },
  pointerMovement: { displayName: 'Pointer Movement', unit: 'pixels' },
  scrollDistance: { displayName: 'Scroll Displacement', unit: 'pixels' },
  pasteDetected: { displayName: 'Paste Activity', unit: 'events' },
};

export class LOFExplainer {
  /**
   * Generates neighbourhood and density explainability for Local Outlier Factor.
   */
  static explain(
    model: LocalOutlierFactorModel,
    observation: number[],
    sessionId: string = 'SESSION-ANON',
    studentId: string = 'STUDENT-ANON',
    timestamp: string = new Date().toISOString()
  ): ModelExplanationResult {
    const scaler = (model as any).scaler;
    const trainingCache = (model as any).trainingCache as {
      point: number[];
      kDistance: number;
      lrd: number;
    }[];
    const effectiveK = (model as any).effectiveK as number;

    if (!scaler || !scaler.isFitted || !trainingCache || trainingCache.length === 0) {
      throw new Error('[LOFExplainer] Model must be fitted before generating explanations.');
    }

    const prediction = model.predict(observation, sessionId, studentId, timestamp);
    const z = scaler.transformVector(observation);
    const p = ML_ORDERED_FEATURES.length;
    const observedScore = prediction.rawAnomalyScore;

    // 1. Local Neighbourhood Analysis
    const distancesToTraining = trainingCache.map((entry, idx) => ({
      idx,
      dist: this.euclideanDistance(z, entry.point),
      entry,
    }));
    distancesToTraining.sort((a, b) => a.dist - b.dist);

    const kNearest = distancesToTraining.slice(0, effectiveK);

    let reachDistSum = 0;
    for (const item of kNearest) {
      const reachDist = Math.max(item.entry.kDistance, item.dist);
      reachDistSum += reachDist;
    }
    const queryLrd = effectiveK / Math.max(reachDistSum, 1e-6);
    const avgNeighbourLrd =
      kNearest.reduce((sum, item) => sum + item.entry.lrd, 0) / effectiveK;

    const neighbourhoodInspection: LOFNeighbourhoodInspection = {
      kNeighbors: effectiveK,
      queryLocalReachabilityDensity: Number(queryLrd.toFixed(4)),
      averageNeighbourDensity: Number(avgNeighbourLrd.toFixed(4)),
      densityRatio: observedScore,
      neighbours: kNearest.map((item) => ({
        neighborIndex: item.idx + 1,
        sessionId: `BASE-SES-${item.idx + 1}`,
        distance: Number(item.dist.toFixed(3)),
        kDistance: Number(item.entry.kDistance.toFixed(3)),
        lrd: Number(item.entry.lrd.toFixed(4)),
      })),
    };

    // 2. Feature-Wise Density Perturbation Delta LOF_j
    const perturbationDeltas: number[] = new Array(p).fill(0);
    for (let j = 0; j < p; j++) {
      const perturbed = [...observation];
      perturbed[j] = scaler.means[j];
      const s_perturbed = model.predict_score(perturbed);
      perturbationDeltas[j] = Math.max(0, observedScore - s_perturbed);
    }

    const totalDelta = perturbationDeltas.reduce((sum, d) => sum + d, 0) || 1e-4;

    // 3. Build Standardized Feature Attributions
    const features: FeatureAttribution[] = ML_ORDERED_FEATURES.map((featureKey, idx) => {
      const meta = FEATURE_METADATA[featureKey];
      const obsVal = observation[idx];
      const meanVal = scaler.means[idx];
      const stdVal = scaler.stdDevs[idx];
      const delta = perturbationDeltas[idx];
      const normAttribution = Number((delta / totalDelta).toFixed(3));

      let directionalEffect: 'accelerating_deviation' | 'dampening_deviation' | 'neutral' = 'neutral';
      if (delta > 0.15) directionalEffect = 'accelerating_deviation';
      else if (delta < -0.05) directionalEffect = 'dampening_deviation';

      const description = this.buildDescription(
        featureKey,
        obsVal,
        meanVal,
        z[idx],
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
      .map((f, idx) => ({ idx, delta: perturbationDeltas[idx] }))
      .sort((a, b) => b.delta - a.delta);
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

    // Faithfulness: score reduction when top density-disrupting feature is neutralized
    const topFeaturePerturbed = [...observation];
    topFeaturePerturbed[sorted[0].idx] = scaler.means[sorted[0].idx];
    const topNeutralizedScore = model.predict_score(topFeaturePerturbed);
    const scoreElevation = Math.max(0, observedScore - 1.0);
    const explanationFaithfulnessScore = scoreElevation > 0.1
      ? Number(Math.min(1.0, Math.max(0, (observedScore - topNeutralizedScore) / scoreElevation)).toFixed(3))
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
      lofNeighbourhood: neighbourhoodInspection,
      explanationFaithfulnessScore,
      nonCausalDisclaimer:
        'This explanation details statistical behavioural associations relative to personal baseline. It does not establish causal intent or prove misconduct.',
    };
  }

  private static euclideanDistance(a: number[], b: number[]): number {
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      const diff = a[i] - b[i];
      sum += diff * diff;
    }
    return Math.sqrt(sum);
  }

  private static buildDescription(
    key: MLFeatureKey,
    observed: number,
    mean: number,
    z: number,
    delta: number
  ): string {
    const densityImpact = delta > 0.2 ? 'Primary local density displacer' : 'Minor density effect';
    const direction = z > 0 ? 'above' : 'below';
    return `${densityImpact}: Observed ${observed.toFixed(1)} is ${Math.abs(z).toFixed(1)}σ ${direction} baseline mean (ΔLOF = ${delta.toFixed(3)}).`;
  }
}

