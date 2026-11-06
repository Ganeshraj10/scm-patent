/**
 * ============================================================================
 * EXAMGUARD — MODEL 3: LOCAL OUTLIER FACTOR (LOF) NOVELTY DETECTOR
 * ============================================================================
 * Density-based local outlier factor (Breunig, Kriegel, Ng & Sander, SIGMOD 2000)
 * extended to inductive Novelty Detection for scoring unseen examination sessions.
 *
 * Mathematical Specification:
 * - Distance Metric: Euclidean metric in standardized feature space:
 *     d(p, q) = sqrt( sum_{j=1}^5 (p_j - q_j)^2 )
 * - k-distance of p in training set D:
 *     k-dist(p) = d(p, o^(k)) where o^(k) is the k-th nearest neighbor in D \ {p}.
 * - Reachability Distance:
 *     reach-dist_k(p, o) = max( k-dist(o), d(p, o) )
 * - Local Reachability Density (LRD):
 *     lrd_k(p) = |N_k(p)| / max( sum_{o in N_k(p)} reach-dist_k(p, o), epsilon )
 * - Inductive Novelty Detection on Unseen Observation x:
 *     1. Query k nearest neighbors of x within stored training baseline D: N_k(x)
 *     2. reach-dist_k(x, o) = max( k-dist(o), d(x, o) ) for each o in N_k(x)
 *     3. lrd_k(x) = |N_k(x)| / max( sum_{o in N_k(x)} reach-dist_k(x, o), epsilon )
 *     4. LOF_k(x) = ( sum_{o in N_k(x)} [lrd_k(o) / lrd_k(x)] ) / |N_k(x)|
 *
 * Score Orientation: 'higher_is_more_anomalous'
 * - LOF ~ 1.0: Observation possesses similar local density to its baseline neighbors (normal).
 * - LOF >> 1.0: Observation has substantially lower local density than neighbors (anomalous).
 */

import {
  IAnomalyDetectionModel,
  ModelMetadata,
  AnomalyPrediction,
  ML_ORDERED_FEATURES,
} from '../types';
import { StandardScaler } from '../preprocessing';
import { calibrateThreshold } from '../calibration';

export interface LOFHyperparameters {
  nNeighbors?: number; // k: number of nearest neighbors (default: 5)
  targetFPR?: number; // Target FPR for conformal calibration (default: 0.05)
}

interface TrainingPointCache {
  point: number[];
  kDistance: number;
  lrd: number;
}

export class LocalOutlierFactorModel implements IAnomalyDetectionModel {
  public readonly modelName = 'Local Outlier Factor';
  public readonly modelFamily = 'density_based';
  public readonly version = '1.1.0-novelty-density';
  public readonly scoreOrientation = 'higher_is_more_anomalous' as const;

  private scaler: StandardScaler;
  private nNeighbors: number = 5;
  private effectiveK: number = 5;
  private targetFPR: number = 0.05;
  private calibratedThreshold: number | null = null;
  private nTrain: number = 0;
  private nCal: number = 0;
  private isFitted: boolean = false;
  private readonly epsilon: number = 1e-6;

  // Stored training points in standardized space with precalculated k-distances and LRDs
  private trainingCache: TrainingPointCache[] = [];

  constructor(options: LOFHyperparameters = {}) {
    this.scaler = new StandardScaler();
    if (options.nNeighbors !== undefined) this.nNeighbors = options.nNeighbors;
    if (options.targetFPR !== undefined) this.targetFPR = options.targetFPR;
  }

  /**
   * Fits LOF baseline on training sessions.
   * Standardizes data, computes pairwise distance matrix, k-distances,
   * reachability distances, and local reachability densities for all training points.
   */
  fit(trainingData: number[][]): void {
    if (!trainingData || trainingData.length === 0) {
      throw new Error(`[${this.modelName}] Training data cannot be empty.`);
    }

    this.scaler.fit(trainingData);
    const X_scaled = this.scaler.transform(trainingData);
    this.nTrain = X_scaled.length;

    // k must be <= nTrain - 1
    this.effectiveK = Math.max(1, Math.min(this.nNeighbors, this.nTrain - 1));

    // 1. Compute all pairwise Euclidean distances among training points
    const distances: number[][] = Array.from({ length: this.nTrain }, () =>
      new Array(this.nTrain).fill(0)
    );

    for (let i = 0; i < this.nTrain; i++) {
      for (let j = i + 1; j < this.nTrain; j++) {
        const d = this.euclideanDistance(X_scaled[i], X_scaled[j]);
        distances[i][j] = d;
        distances[j][i] = d;
      }
    }

    // 2. Find k-distance and k-nearest neighbors for each training point
    const kDistances: number[] = new Array(this.nTrain).fill(0);
    const kNeighbors: number[][] = Array.from({ length: this.nTrain }, () => []);

    for (let i = 0; i < this.nTrain; i++) {
      const neighborDistances: { idx: number; dist: number }[] = [];
      for (let j = 0; j < this.nTrain; j++) {
        if (i !== j) {
          neighborDistances.push({ idx: j, dist: distances[i][j] });
        }
      }
      neighborDistances.sort((a, b) => a.dist - b.dist);

      const kNN = neighborDistances.slice(0, this.effectiveK);
      kDistances[i] = kNN[this.effectiveK - 1].dist;
      kNeighbors[i] = kNN.map((item) => item.idx);
    }

    // 3. Compute local reachability density (lrd) for each training point
    const lrds: number[] = new Array(this.nTrain).fill(0);
    for (let i = 0; i < this.nTrain; i++) {
      let reachDistSum = 0;
      for (const neighborIdx of kNeighbors[i]) {
        const distToNeighbor = distances[i][neighborIdx];
        const reachDist = Math.max(kDistances[neighborIdx], distToNeighbor);
        reachDistSum += reachDist;
      }
      lrds[i] = this.effectiveK / Math.max(reachDistSum, this.epsilon);
    }

    // 4. Store training cache for novelty scoring of future unseen sessions
    this.trainingCache = X_scaled.map((point, idx) => ({
      point,
      kDistance: kDistances[idx],
      lrd: lrds[idx],
    }));

    this.isFitted = true;
  }

  /**
   * Scores an unseen observation using LOF Novelty Detection.
   * Compares the query point's density against its k nearest training baseline neighbors.
   */
  predict_score(observation: number[]): number {
    if (!this.isFitted || this.trainingCache.length === 0) {
      throw new Error(`[${this.modelName}] Model must be fitted before predict_score.`);
    }

    const z = this.scaler.transformVector(observation);

    // 1. Find the k nearest training neighbors of the query point
    const distancesToTraining: { idx: number; dist: number }[] = this.trainingCache.map(
      (entry, idx) => ({
        idx,
        dist: this.euclideanDistance(z, entry.point),
      })
    );
    distancesToTraining.sort((a, b) => a.dist - b.dist);

    const kNearest = distancesToTraining.slice(0, this.effectiveK);

    // 2. Compute reachability distance from query point z to each neighbor
    let reachDistSum = 0;
    for (const neighbor of kNearest) {
      const neighborCache = this.trainingCache[neighbor.idx];
      const reachDist = Math.max(neighborCache.kDistance, neighbor.dist);
      reachDistSum += reachDist;
    }

    // 3. Local reachability density of query point
    const queryLrd = this.effectiveK / Math.max(reachDistSum, this.epsilon);

    // 4. Calculate LOF score: average ratio of neighbors' LRD to query LRD
    let lrdRatioSum = 0;
    for (const neighbor of kNearest) {
      const neighborCache = this.trainingCache[neighbor.idx];
      lrdRatioSum += neighborCache.lrd / Math.max(queryLrd, this.epsilon);
    }

    const rawLof = lrdRatioSum / this.effectiveK;
    return Number(rawLof.toFixed(4));
  }

  /**
   * Calibrates threshold on held-out calibration sessions.
   */
  calibrate(calibrationData: number[][], targetFPR?: number): number {
    if (!this.isFitted) {
      throw new Error(`[${this.modelName}] Model must be fitted before calibration.`);
    }
    if (!calibrationData || calibrationData.length === 0) {
      throw new Error(`[${this.modelName}] Calibration data cannot be empty.`);
    }

    if (targetFPR !== undefined) this.targetFPR = targetFPR;
    this.nCal = calibrationData.length;

    const scores = calibrationData.map((obs) => this.predict_score(obs));
    const result = calibrateThreshold(scores, this.targetFPR, this.scoreOrientation);
    this.calibratedThreshold = result.calibratedThreshold;
    return this.calibratedThreshold;
  }

  /**
   * Evaluates prediction for an observation.
   */
  predict(
    observation: number[],
    sessionId: string = 'unknown_session',
    studentId: string = 'unknown_student',
    timestamp: string = new Date().toISOString()
  ): AnomalyPrediction {
    const rawScore = this.predict_score(observation);
    const threshold = this.calibratedThreshold ?? 1.5; // Theoretical LOF outlier threshold default
    const isAnomaly = rawScore > threshold;

    // Feature distance breakdown as explanation proxy
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
        nNeighbors: this.nNeighbors,
        effectiveK: this.effectiveK,
      },
      trainingObservationCount: this.nTrain,
      calibrationObservationCount: this.nCal,
      calibratedThreshold: this.calibratedThreshold,
      targetFPR: this.targetFPR,
    };
  }

  private euclideanDistance(a: number[], b: number[]): number {
    let sumSq = 0;
    for (let i = 0; i < a.length; i++) {
      const diff = a[i] - b[i];
      sumSq += diff * diff;
    }
    return Math.sqrt(sumSq);
  }
}

