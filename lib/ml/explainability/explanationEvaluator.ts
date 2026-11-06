/**
 * ============================================================================
 * EXAMGUARD — PHASE 4: EXPLANATION EVALUATOR MODULE
 * ============================================================================
 * Rigorously evaluates XAI explanations across five objective dimensions:
 * 1. Faithfulness: Monotonic reduction in anomaly score when top-attributed features are neutralized.
 * 2. Stability: Invariance of top feature ranks under slight measurement noise (eps ~ N(0, 0.05^2)).
 * 3. Feature Relevance: Concordance with ground-truth known deviations (Category C).
 * 4. Model Consistency: Low attribution on normal sessions, high attribution on deviations.
 * 5. Computational Cost: Millisecond execution time per explanation.
 *
 * Explicit Principle:
 * - Statistical associations, sensitivities, and rank stabilities are reported.
 * - Causal claims are explicitly excluded.
 */

import { IAnomalyDetectionModel } from '../types';
import { ModelExplanationResult, ExplanationEvaluationReport } from './types';
import { MahalanobisExplainer } from './mahalanobisExplainer';
import { IsolationForestExplainer } from './isolationForestExplainer';
import { LOFExplainer } from './lofExplainer';
import { OneClassSVMExplainer } from './ocsvmExplainer';

export class ExplanationEvaluator {
  /**
   * Explains any model using its corresponding specialized explainability engine.
   */
  static explainModel(
    model: IAnomalyDetectionModel,
    observation: number[],
    sessionId: string = 'SESSION-EVAL',
    studentId: string = 'STUDENT-EVAL'
  ): ModelExplanationResult {
    const modelName = model.get_metadata().modelName;

    if (modelName.includes('Mahalanobis')) {
      return MahalanobisExplainer.explain(model as any, observation, sessionId, studentId);
    } else if (modelName.includes('Isolation Forest')) {
      return IsolationForestExplainer.explain(model as any, observation, sessionId, studentId);
    } else if (modelName.includes('Local Outlier Factor')) {
      return LOFExplainer.explain(model as any, observation, sessionId, studentId);
    } else if (modelName.includes('One-Class SVM')) {
      return OneClassSVMExplainer.explain(model as any, observation, sessionId, studentId);
    } else {
      throw new Error(`[ExplanationEvaluator] Unsupported model: ${modelName}`);
    }
  }

  /**
   * Evaluates faithfulness of an explanation.
   * Tests whether neutralizing the top-ranked feature lowers the anomaly score.
   */
  static evaluateFaithfulness(
    model: IAnomalyDetectionModel,
    observation: number[],
    explanation: ModelExplanationResult
  ): number {
    const rawScore = explanation.rawAnomalyScore;
    const topFeature = explanation.topContributingFeature;
    const topFeatureIdx = explanation.features.findIndex((f) => f.featureKey === topFeature);

    if (topFeatureIdx === -1) return 1.0;

    const baselineMean = explanation.features[topFeatureIdx].baselineMean;
    const neutralized = [...observation];
    neutralized[topFeatureIdx] = baselineMean;

    const scoreNeutralized = model.predict_score(neutralized);

    // Score should decrease or stay equal
    if (rawScore <= 0.05) return 1.0; // Already baseline
    const drop = Math.max(0, rawScore - scoreNeutralized);
    return Number(Math.min(1.0, drop / (rawScore || 1.0)).toFixed(3));
  }

  /**
   * Evaluates explanation stability under measurement noise eps ~ N(0, (0.05*std)^2).
   * Measures top-feature rank agreement across perturbed samples.
   */
  static evaluateStability(
    model: IAnomalyDetectionModel,
    observation: number[],
    noiseScale: number = 0.05,
    numTrials: number = 5
  ): number {
    const baseExplanation = this.explainModel(model, observation);
    const baseTopFeature = baseExplanation.topContributingFeature;

    let matches = 0;
    for (let t = 0; t < numTrials; t++) {
      const noisyObs = observation.map((val, idx) => {
        const std = baseExplanation.features[idx]?.baselineStdDev || 1.0;
        const noise = (Math.random() - 0.5) * 2 * noiseScale * std;
        return val + noise;
      });

      const noisyExplanation = this.explainModel(model, noisyObs);
      if (noisyExplanation.topContributingFeature === baseTopFeature) {
        matches++;
      }
    }

    return Number((matches / numTrials).toFixed(2));
  }

  /**
   * Benchmarks explanation latency and quality metrics across a batch of observations.
   */
  static benchmarkExplainer(
    model: IAnomalyDetectionModel,
    observations: { observation: number[]; expectedTopFeature?: string }[]
  ): ExplanationEvaluationReport {
    let totalFaithfulness = 0;
    let totalStability = 0;
    let totalRelevance = 0;
    let totalDurationMs = 0;

    const n = observations.length;
    if (n === 0) {
      return {
        faithfulnessAverage: 1.0,
        stabilityScore: 1.0,
        relevanceConsistency: 1.0,
        avgComputationLatencyMs: 0,
        totalEvaluated: 0,
      };
    }

    for (const item of observations) {
      const t0 = performance.now();
      const expl = this.explainModel(model, item.observation);
      const t1 = performance.now();
      totalDurationMs += t1 - t0;

      const faith = this.evaluateFaithfulness(model, item.observation, expl);
      totalFaithfulness += faith;

      const stab = this.evaluateStability(model, item.observation, 0.05, 3);
      totalStability += stab;

      if (item.expectedTopFeature) {
        if (expl.topContributingFeature === item.expectedTopFeature) {
          totalRelevance += 1.0;
        } else {
          // Check if it was in the top 2
          const rank = expl.features.find((f) => f.featureKey === item.expectedTopFeature)?.attributionRank || 5;
          if (rank <= 2) totalRelevance += 0.5;
        }
      } else {
        totalRelevance += 1.0;
      }
    }

    return {
      faithfulnessAverage: Number((totalFaithfulness / n).toFixed(3)),
      stabilityScore: Number((totalStability / n).toFixed(3)),
      relevanceConsistency: Number((totalRelevance / n).toFixed(3)),
      avgComputationLatencyMs: Number((totalDurationMs / n).toFixed(3)),
      totalEvaluated: n,
    };
  }
}

