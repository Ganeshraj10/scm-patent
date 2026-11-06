/**
 * ============================================================================
 * EXAMGUARD — MODEL 2: ISOLATION FOREST ANOMALY DETECTOR
 * ============================================================================
 * Ensemble tree-based non-parametric outlier detector (Liu, Ting & Zhou, 2008).
 *
 * Mathematical Specification:
 * - Isolation Tree (iTree): Recursively isolates observations by randomly selecting
 *   a feature j in {0..p-1} and a split point uniformly in [min(x_j), max(x_j)].
 * - Average Path Length E[h(x)] across t isolation trees.
 * - Normalization Factor:
 *     c(n) = 2 * (ln(n - 1) + gamma) - (2 * (n - 1) / n)
 *   where gamma = 0.5772156649 (Euler-Mascheroni constant).
 * - Anomaly Score:
 *     s(x, n) = 2^( - E[h(x)] / c(n) ) in [0, 1]
 * - Interpretation:
 *     s -> 1.0: anomalous (isolated rapidly in few tree splits)
 *     s -> 0.5: normal baseline cluster
 *     s -> 0.0: dense core interior
 * - Score Orientation: 'higher_is_more_anomalous'
 */

import {
  IAnomalyDetectionModel,
  ModelMetadata,
  AnomalyPrediction,
  ML_ORDERED_FEATURES,
} from '../types';
import { StandardScaler } from '../preprocessing';
import { calibrateThreshold } from '../calibration';
import { SeededPRNG } from '../../services/syntheticDatasetGenerator';

const EULER_MASCHERONI = 0.5772156649;

function computeAveragePathLength(n: number): number {
  if (n <= 1) return 0;
  if (n === 2) return 1;
  return 2 * (Math.log(n - 1) + EULER_MASCHERONI) - (2 * (n - 1)) / n;
}

interface IsolationTreeNode {
  isLeaf: boolean;
  size: number;
  splitFeature?: number;
  splitValue?: number;
  left?: IsolationTreeNode;
  right?: IsolationTreeNode;
}

export class IsolationForestModel implements IAnomalyDetectionModel {
  public readonly modelName = 'Isolation Forest';
  public readonly modelFamily = 'ensemble_isolation';
  public readonly version = '1.2.0-deterministic-trees';
  public readonly scoreOrientation = 'higher_is_more_anomalous' as const;

  private scaler: StandardScaler;
  private nEstimators: number = 100;
  private maxSamples: number = 256;
  private maxTreeHeight: number = 8;
  private seed: number = 42;
  private prng: SeededPRNG;
  private trees: IsolationTreeNode[] = [];
  private subSampleSize: number = 20;
  private calibratedThreshold: number | null = null;
  private targetFPR: number = 0.05;
  private nTrain: number = 0;
  private nCal: number = 0;
  private isFitted: boolean = false;

  constructor(options: {
    nEstimators?: number;
    maxSamples?: number;
    seed?: number;
    targetFPR?: number;
  } = {}) {
    this.scaler = new StandardScaler();
    if (options.nEstimators !== undefined) this.nEstimators = options.nEstimators;
    if (options.maxSamples !== undefined) this.maxSamples = options.maxSamples;
    if (options.seed !== undefined) this.seed = options.seed;
    if (options.targetFPR !== undefined) this.targetFPR = options.targetFPR;
    this.prng = new SeededPRNG(this.seed);
  }

  fit(trainingData: number[][]): void {
    if (!trainingData || trainingData.length === 0) {
      throw new Error(`[${this.modelName}] Training data cannot be empty.`);
    }

    this.nTrain = trainingData.length;
    this.scaler.fit(trainingData);
    const X = this.scaler.transform(trainingData);

    this.subSampleSize = Math.min(this.maxSamples, X.length);
    this.maxTreeHeight = Math.max(1, Math.ceil(Math.log2(this.subSampleSize)));

    this.trees = [];
    for (let t = 0; t < this.nEstimators; t++) {
      // Subsample training observations
      const sample = this.drawSubSample(X, this.subSampleSize);
      const tree = this.buildTree(sample, 0, this.maxTreeHeight);
      this.trees.push(tree);
    }

    this.isFitted = true;
  }

  private drawSubSample(X: number[][], sampleSize: number): number[][] {
    const indices: number[] = [];
    const pool = Array.from({ length: X.length }, (_, i) => i);
    const k = Math.min(sampleSize, X.length);

    for (let i = 0; i < k; i++) {
      const idx = Math.floor(this.prng.random() * pool.length);
      indices.push(pool[idx]);
      pool.splice(idx, 1);
    }

    return indices.map((i) => X[i]);
  }

  private buildTree(X: number[][], currentHeight: number, maxHeight: number): IsolationTreeNode {
    const n = X.length;

    // Termination conditions
    if (currentHeight >= maxHeight || n <= 1) {
      return { isLeaf: true, size: n };
    }

    const p = ML_ORDERED_FEATURES.length;
    // Find candidate features that have true variation in this node
    const candidates: { featureIdx: number; minVal: number; maxVal: number }[] = [];
    for (let j = 0; j < p; j++) {
      let minVal = Infinity;
      let maxVal = -Infinity;
      for (let i = 0; i < n; i++) {
        const v = X[i][j];
        if (v < minVal) minVal = v;
        if (v > maxVal) maxVal = v;
      }
      if (maxVal - minVal > 1e-6) {
        candidates.push({ featureIdx: j, minVal, maxVal });
      }
    }

    // If no features have variation in this node, all points are identical and form a leaf
    if (candidates.length === 0) {
      return { isLeaf: true, size: n };
    }

    // Select randomly among candidate features
    const chosen = candidates[Math.floor(this.prng.random() * candidates.length)];
    const splitValue = chosen.minVal + this.prng.random() * (chosen.maxVal - chosen.minVal);

    const leftX: number[][] = [];
    const rightX: number[][] = [];

    for (let i = 0; i < n; i++) {
      if (X[i][chosen.featureIdx] < splitValue) {
        leftX.push(X[i]);
      } else {
        rightX.push(X[i]);
      }
    }

    // Handle empty partitions safely
    if (leftX.length === 0 || rightX.length === 0) {
      return {
        isLeaf: false,
        size: n,
        splitFeature: chosen.featureIdx,
        splitValue,
        left: leftX.length > 0 ? this.buildTree(leftX, currentHeight + 1, maxHeight) : { isLeaf: true, size: 0 },
        right: rightX.length > 0 ? this.buildTree(rightX, currentHeight + 1, maxHeight) : { isLeaf: true, size: 0 },
      };
    }

    return {
      isLeaf: false,
      size: n,
      splitFeature: chosen.featureIdx,
      splitValue,
      left: this.buildTree(leftX, currentHeight + 1, maxHeight),
      right: this.buildTree(rightX, currentHeight + 1, maxHeight),
    };
  }

  private evaluatePathLength(x: number[], node: IsolationTreeNode, currentDepth: number): number {
    if (node.isLeaf || node.left === undefined || node.right === undefined) {
      return currentDepth + computeAveragePathLength(node.size);
    }

    const featureIdx = node.splitFeature!;
    const splitVal = node.splitValue!;

    if (x[featureIdx] < splitVal) {
      return this.evaluatePathLength(x, node.left, currentDepth + 1);
    } else {
      return this.evaluatePathLength(x, node.right, currentDepth + 1);
    }
  }

  predict_score(observation: number[]): number {
    if (!this.isFitted) {
      throw new Error(`[${this.modelName}] Model must be fitted before scoring.`);
    }

    const z = this.scaler.transformVector(observation);

    let totalPathLength = 0;
    for (let t = 0; t < this.nEstimators; t++) {
      totalPathLength += this.evaluatePathLength(z, this.trees[t], 0);
    }

    const avgPathLength = totalPathLength / this.nEstimators;
    const cN = computeAveragePathLength(this.subSampleSize);

    if (cN <= 1e-6) return 0.5;

    // Anomaly score s = 2^(-E[h(x)] / c(n))
    const score = Math.pow(2, -avgPathLength / cN);
    return Number(Math.max(0, Math.min(1.0, score)).toFixed(4));
  }

  calibrate(calibrationData: number[][], targetFPR?: number): number {
    if (!this.isFitted) {
      throw new Error(`[${this.modelName}] Model must be fitted before calibration.`);
    }

    this.nCal = calibrationData.length;
    if (targetFPR !== undefined) this.targetFPR = targetFPR;

    const scores = calibrationData.map((obs) => this.predict_score(obs));
    const result = calibrateThreshold(scores, this.targetFPR, this.scoreOrientation);
    this.calibratedThreshold = result.calibratedThreshold;
    return this.calibratedThreshold;
  }

  predict(
    observation: number[],
    sessionId: string = 'SESSION-TEST',
    studentId: string = 'STUDENT-ANON',
    timestamp: string = new Date().toISOString()
  ): AnomalyPrediction {
    if (!this.isFitted) {
      throw new Error(`[${this.modelName}] Model must be fitted before prediction.`);
    }

    const threshold = this.calibratedThreshold ?? 0.6;
    const rawScore = this.predict_score(observation);
    const isAnomaly = rawScore > threshold;

    const z = this.scaler.transformVector(observation);
    const featureContributions: Record<string, number> = {};
    ML_ORDERED_FEATURES.forEach((featureKey, idx) => {
      featureContributions[featureKey] = Number(Math.abs(z[idx]).toFixed(3));
    });

    return {
      studentId,
      sessionId,
      modelName: this.modelName,
      rawAnomalyScore: rawScore,
      scoreOrientation: this.scoreOrientation,
      calibratedThreshold: threshold,
      isAnomaly,
      reviewStatus: isAnomaly ? 'review_required' : 'normal',
      modelVersion: this.version,
      timestamp,
      dataQualityStatus: observation.some((val) => isNaN(val)) ? 'imputed_missing_features' : 'complete',
      featureContributions,
    };
  }

  get_metadata(): ModelMetadata {
    return {
      modelName: this.modelName,
      modelFamily: this.modelFamily,
      version: this.version,
      scoreOrientation: this.scoreOrientation,
      hyperparameters: {
        nEstimators: this.nEstimators,
        maxSamples: this.maxSamples,
        maxTreeHeight: this.maxTreeHeight,
        seed: this.seed,
      },
      trainingObservationCount: this.nTrain,
      calibrationObservationCount: this.nCal,
      calibratedThreshold: this.calibratedThreshold,
      targetFPR: this.targetFPR,
    };
  }
}

