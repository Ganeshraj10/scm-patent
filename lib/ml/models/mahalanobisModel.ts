/**
 * ============================================================================
 * EXAMGUARD — MODEL 1: REGULARISED MAHALANOBIS STATISTICAL DISTANCE
 * ============================================================================
 * Core parametric benchmark model.
 *
 * Mathematical Specification:
 * - D_M(x) = sqrt( (x - mu)^T * Sigma_reg^-1 * (x - mu) )
 *          = sqrt( z^T * R_reg^-1 * z )
 * - Shrinkage Regularisation:
 *     R_reg = (1 - lambda) * R + lambda * I + epsilon * I
 *   where lambda in [0, 1] is the Ledoit-Wolf shrinkage intensity targeting
 *   the identity matrix in correlation space, and epsilon = 1e-4 is ridge loading.
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
import {
  computeSampleCovariance,
  computeSampleCorrelation,
  computeShrinkageIntensity,
  regularizeAndInvertCorrelation,
} from '@/lib/deviationEngine';

export class RegularizedMahalanobisModel implements IAnomalyDetectionModel {
  public readonly modelName = 'Regularised Mahalanobis Distance';
  public readonly modelFamily = 'parametric_statistical';
  public readonly version = '2.2.0-conformal-shrinkage';
  public readonly scoreOrientation = 'higher_is_more_anomalous' as const;

  private scaler: StandardScaler;
  private sampleCovariance: number[][] = [];
  private sampleCorrelation: number[][] = [];
  private regularizedCorrelation: number[][] = [];
  private inverseCorrelation: number[][] = [];
  private shrinkageLambda: number = 0.2;
  private ridgeEpsilon: number = 1e-4;
  private calibratedThreshold: number | null = null;
  private targetFPR: number = 0.05;
  private nTrain: number = 0;
  private nCal: number = 0;
  private isFitted: boolean = false;

  constructor(options: { ridgeEpsilon?: number; targetFPR?: number } = {}) {
    this.scaler = new StandardScaler();
    if (options.ridgeEpsilon !== undefined) this.ridgeEpsilon = options.ridgeEpsilon;
    if (options.targetFPR !== undefined) this.targetFPR = options.targetFPR;
  }

  fit(trainingData: number[][]): void {
    if (!trainingData || trainingData.length === 0) {
      throw new Error(`[${this.modelName}] Training data cannot be empty.`);
    }

    this.nTrain = trainingData.length;
    this.scaler.fit(trainingData);

    const means = this.scaler.means;
    const stdDevs = this.scaler.stdDevs;

    // 1. Covariance & Correlation estimation
    this.sampleCovariance = computeSampleCovariance(trainingData, means);
    this.sampleCorrelation = computeSampleCorrelation(this.sampleCovariance, stdDevs);

    // 2. Shrinkage intensity estimation
    this.shrinkageLambda = computeShrinkageIntensity(
      this.sampleCorrelation,
      trainingData,
      means,
      stdDevs
    );

    // 3. Regularisation: R_reg = (1 - lambda) * R + lambda * I + epsilon * I
    const regRes = regularizeAndInvertCorrelation(
      this.sampleCorrelation,
      this.shrinkageLambda
    );
    this.regularizedCorrelation = regRes.regularizedCorrelation;
    this.inverseCorrelation = regRes.inverseCorrelation;

    this.isFitted = true;
  }

  predict_score(observation: number[]): number {
    if (!this.isFitted) {
      throw new Error(`[${this.modelName}] Model must be fitted before scoring.`);
    }

    const p = ML_ORDERED_FEATURES.length;
    // Standardize observation vector: z = (x - mu) / sigma
    const z = this.scaler.transformVector(observation);

    // y = R_reg^-1 * z
    const y = new Array(p).fill(0);
    for (let i = 0; i < p; i++) {
      let sum = 0;
      for (let j = 0; j < p; j++) {
        sum += this.inverseCorrelation[i][j] * z[j];
      }
      y[i] = isFinite(sum) && !isNaN(sum) ? sum : z[i];
    }

    // Quadratic form: D_M^2 = z^T * y
    let dSquared = 0;
    for (let j = 0; j < p; j++) {
      dSquared += z[j] * y[j];
    }

    const safeDSquared = Math.max(0, isFinite(dSquared) && !isNaN(dSquared) ? dSquared : 0);
    return Number(Math.sqrt(safeDSquared).toFixed(4));
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

    const threshold = this.calibratedThreshold ?? 3.5;
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
        shrinkageLambda: this.shrinkageLambda,
        shrinkageIntensity: this.shrinkageLambda,
        regularizationFormula: 'R_reg = (1 - lambda)R + lambda I + epsilon I',
        ridgeEpsilon: this.ridgeEpsilon,
        featureDimension: ML_ORDERED_FEATURES.length,
      },
      trainingObservationCount: this.nTrain,
      calibrationObservationCount: this.nCal,
      calibratedThreshold: this.calibratedThreshold,
      targetFPR: this.targetFPR,
    };
  }
}

