/**
 * ============================================================================
 * EXAMGUARD — PHASE 3: FOUR-MODEL BENCHMARK & COMPARISON ENGINE
 * ============================================================================
 * Executes rigorous, fair comparative benchmarking across:
 * - Model 1: Regularised Mahalanobis Distance
 * - Model 2: Isolation Forest
 * - Model 3: Local Outlier Factor (LOF)
 * - Model 4: One-Class SVM (OC-SVM)
 *
 * All models are trained on identical training sets, calibrated on identical
 * held-out calibration sets at target alpha = 0.05, and tested on identical
 * evaluation sets (1,000 sessions across 100 students).
 */

import fs from 'fs';
import path from 'path';
import {
  IAnomalyDetectionModel,
  ModelBenchmarkResult,
  ModelFamily,
} from './types';
import { StandardScaler } from './preprocessing';
import {
  RegularizedMahalanobisModel,
  IsolationForestModel,
  LocalOutlierFactorModel,
  OneClassSVMModel,
} from './models';
import { SyntheticSession } from '../services/syntheticDatasetGenerator';

export interface DetailedBenchmarkReport {
  timestamp: string;
  datasetStats: {
    trainCount: number;
    calibrationCount: number;
    testCount: number;
    studentCount: number;
    targetFPR: number;
  };
  models: {
    [modelName: string]: {
      summary: ModelBenchmarkResult;
      scenarioBreakdown: {
        categoryA_Normal_FPR: number; // False alarms on pure normal
        categoryB_Legitimate_FAR: number; // False alarms on fatigue/difficult/break
        categoryC_SingleDev_TPR: number; // Detection rate on 1-feature anomalies
        categoryD_MultiDev_TPR: number; // Detection rate on multi-feature anomalies
        categoryE_QualityDrift_TPR: number; // Detection rate on drift/noise
      };
      featureContributionProfile: Record<string, number>;
    };
  };
}

export class BenchmarkEngine {
  private dataDir: string;

  constructor(dataDir?: string) {
    this.dataDir = dataDir || path.resolve(process.cwd(), 'data/synthetic');
  }

  /**
   * Loads synthetic dataset splits from data/synthetic.
   */
  loadDatasetSplits(): {
    trainSessions: SyntheticSession[];
    calibrationSessions: SyntheticSession[];
    testSessions: SyntheticSession[];
  } {
    const trainPath = path.join(this.dataDir, 'train_sessions.json');
    const calPath = path.join(this.dataDir, 'calibration_sessions.json');
    const testPath = path.join(this.dataDir, 'test_sessions.json');

    if (!fs.existsSync(trainPath) || !fs.existsSync(calPath) || !fs.existsSync(testPath)) {
      throw new Error(
        `[BenchmarkEngine] Synthetic dataset files not found at ${this.dataDir}. Please run dataset generation first.`
      );
    }

    const trainSessions = JSON.parse(fs.readFileSync(trainPath, 'utf8')) as SyntheticSession[];
    const calibrationSessions = JSON.parse(fs.readFileSync(calPath, 'utf8')) as SyntheticSession[];
    const testSessions = JSON.parse(fs.readFileSync(testPath, 'utf8')) as SyntheticSession[];

    return { trainSessions, calibrationSessions, testSessions };
  }

  /**
   * Instantiates fresh model instances of all 4 types for a specific student.
   */
  createModelInstances(): { [name: string]: IAnomalyDetectionModel } {
    return {
      'Regularised Mahalanobis Distance': new RegularizedMahalanobisModel({
        ridgeEpsilon: 1e-4,
        targetFPR: 0.05,
      }),
      'Isolation Forest': new IsolationForestModel({
        nEstimators: 100,
        maxSamples: 256,
        seed: 42,
        targetFPR: 0.05,
      }),
      'Local Outlier Factor': new LocalOutlierFactorModel({
        nNeighbors: 5,
        targetFPR: 0.05,
      }),
      'One-Class SVM': new OneClassSVMModel({
        nu: 0.05,
        gamma: 0.2,
        targetFPR: 0.05,
      }),
    };
  }

  /**
   * Executes the full benchmark across all 4 models and returns detailed metrics.
   */
  runBenchmark(): DetailedBenchmarkReport {
    const { trainSessions, calibrationSessions, testSessions } = this.loadDatasetSplits();

    // Group training and calibration data by student ID
    const trainByStudent = new Map<string, number[][]>();
    const calByStudent = new Map<string, number[][]>();

    for (const s of trainSessions) {
      const vec = StandardScaler.extractVector(s.aggregatedFeatures as any);
      if (!trainByStudent.has(s.studentId)) trainByStudent.set(s.studentId, []);
      trainByStudent.get(s.studentId)!.push(vec);
    }

    for (const s of calibrationSessions) {
      const vec = StandardScaler.extractVector(s.aggregatedFeatures as any);
      if (!calByStudent.has(s.studentId)) calByStudent.set(s.studentId, []);
      calByStudent.get(s.studentId)!.push(vec);
    }

    const studentIds = Array.from(trainByStudent.keys());

    // Fit and calibrate 4 models for every student
    // studentModels[modelName][studentId] = fitted & calibrated model
    const modelNames = [
      'Regularised Mahalanobis Distance',
      'Isolation Forest',
      'Local Outlier Factor',
      'One-Class SVM',
    ];

    const studentModels: Record<string, Map<string, IAnomalyDetectionModel>> = {
      'Regularised Mahalanobis Distance': new Map(),
      'Isolation Forest': new Map(),
      'Local Outlier Factor': new Map(),
      'One-Class SVM': new Map(),
    };

    for (const studentId of studentIds) {
      const trainData = trainByStudent.get(studentId) || [];
      const calData = calByStudent.get(studentId) || [];

      const instances = this.createModelInstances();

      for (const mName of modelNames) {
        const model = instances[mName];
        model.fit(trainData);
        model.calibrate(calData, 0.05);
        studentModels[mName].set(studentId, model);
      }
    }

    // Evaluate models on test sessions
    const report: DetailedBenchmarkReport = {
      timestamp: new Date().toISOString(),
      datasetStats: {
        trainCount: trainSessions.length,
        calibrationCount: calibrationSessions.length,
        testCount: testSessions.length,
        studentCount: studentIds.length,
        targetFPR: 0.05,
      },
      models: {},
    };

    for (const mName of modelNames) {
      let tp = 0;
      let fp = 0;
      let tn = 0;
      let fn = 0;

      let catA_total = 0;
      let catA_fp = 0;
      let catB_total = 0;
      let catB_fp = 0;
      let catC_total = 0;
      let catC_tp = 0;
      let catD_total = 0;
      let catD_tp = 0;
      let catE_total = 0;
      let catE_tp = 0;

      let totalLatencyMs = 0;
      const rawScores: { score: number; isTrueAnomaly: boolean }[] = [];
      const featureSums: Record<string, number> = {
        responseTime: 0,
        revisionCount: 0,
        pointerMovement: 0,
        scrollDistance: 0,
        pasteDetected: 0,
      };

      for (const testSession of testSessions) {
        const studentModel = studentModels[mName].get(testSession.studentId);
        if (!studentModel) continue;

        const vec = StandardScaler.extractVector(testSession.aggregatedFeatures as any);

        const t0 = performance.now();
        const pred = studentModel.predict(
          vec,
          testSession.sessionId,
          testSession.studentId,
          testSession.timestamp
        );
        const t1 = performance.now();
        totalLatencyMs += t1 - t0;

        const isTrueAnomaly = testSession.isAnomaly;
        const isPredAnomaly = pred.isAnomaly;

        rawScores.push({ score: pred.rawAnomalyScore, isTrueAnomaly });

        // Update confusion matrix
        if (isTrueAnomaly && isPredAnomaly) tp++;
        else if (!isTrueAnomaly && isPredAnomaly) fp++;
        else if (!isTrueAnomaly && !isPredAnomaly) tn++;
        else if (isTrueAnomaly && !isPredAnomaly) fn++;

        // Breakdown by scenario category
        const cat = testSession.scenarioCategory || '';
        if (cat.startsWith('A')) {
          catA_total++;
          if (isPredAnomaly) catA_fp++;
        } else if (cat.startsWith('B')) {
          catB_total++;
          if (isPredAnomaly) catB_fp++;
        } else if (cat.startsWith('C')) {
          catC_total++;
          if (isPredAnomaly) catC_tp++;
        } else if (cat.startsWith('D')) {
          catD_total++;
          if (isPredAnomaly) catD_tp++;
        } else if (cat.startsWith('E')) {
          catE_total++;
          if (isPredAnomaly) catE_tp++;
        }

        // Aggregate feature explanation contributions
        if (pred.featureContributions) {
          for (const [k, v] of Object.entries(pred.featureContributions)) {
            if (featureSums[k] !== undefined) featureSums[k] += v;
          }
        }
      }

      const totalEvaluated = testSessions.length;
      const tpr = tp + fn > 0 ? tp / (tp + fn) : 0;
      const fprOverall = fp + tn > 0 ? fp / (fp + tn) : 0;
      const fprCategoryA = catA_total > 0 ? catA_fp / catA_total : 0;
      const farLegitimateCategoryB = catB_total > 0 ? catB_fp / catB_total : 0;
      const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
      const f1Score =
        precision + tpr > 0 ? (2 * precision * tpr) / (precision + tpr) : 0;
      const aucRoc = this.computeAucRoc(rawScores);
      const avgInferenceLatencyMs = totalLatencyMs / totalEvaluated;

      const familyMap: Record<string, ModelFamily> = {
        'Regularised Mahalanobis Distance': 'parametric_statistical',
        'Isolation Forest': 'ensemble_isolation',
        'Local Outlier Factor': 'density_based',
        'One-Class SVM': 'support_vector_kernel',
      };

      report.models[mName] = {
        summary: {
          modelName: mName,
          modelFamily: familyMap[mName],
          totalEvaluated,
          truePositives: tp,
          falsePositives: fp,
          trueNegatives: tn,
          falseNegatives: fn,
          tpr: Number(tpr.toFixed(4)),
          fprOverall: Number(fprOverall.toFixed(4)),
          fprCategoryA: Number(fprCategoryA.toFixed(4)),
          farLegitimateCategoryB: Number(farLegitimateCategoryB.toFixed(4)),
          precision: Number(precision.toFixed(4)),
          f1Score: Number(f1Score.toFixed(4)),
          aucRoc: Number(aucRoc.toFixed(4)),
          avgInferenceLatencyMs: Number(avgInferenceLatencyMs.toFixed(4)),
        },
        scenarioBreakdown: {
          categoryA_Normal_FPR: Number(fprCategoryA.toFixed(4)),
          categoryB_Legitimate_FAR: Number(farLegitimateCategoryB.toFixed(4)),
          categoryC_SingleDev_TPR: Number(
            (catC_total > 0 ? catC_tp / catC_total : 0).toFixed(4)
          ),
          categoryD_MultiDev_TPR: Number(
            (catD_total > 0 ? catD_tp / catD_total : 0).toFixed(4)
          ),
          categoryE_QualityDrift_TPR: Number(
            (catE_total > 0 ? catE_tp / catE_total : 0).toFixed(4)
          ),
        },
        featureContributionProfile: {
          responseTime: Number((featureSums.responseTime / totalEvaluated).toFixed(3)),
          revisionCount: Number((featureSums.revisionCount / totalEvaluated).toFixed(3)),
          pointerMovement: Number((featureSums.pointerMovement / totalEvaluated).toFixed(3)),
          scrollDistance: Number((featureSums.scrollDistance / totalEvaluated).toFixed(3)),
          pasteDetected: Number((featureSums.pasteDetected / totalEvaluated).toFixed(3)),
        },
      };
    }

    return report;
  }

  /**
   * Computes Trapezoidal Area Under the ROC Curve (AUC-ROC)
   * on continuous raw scores.
   */
  private computeAucRoc(
    scores: { score: number; isTrueAnomaly: boolean }[]
  ): number {
    const sorted = [...scores].sort((a, b) => b.score - a.score);

    const P = scores.filter((s) => s.isTrueAnomaly).length;
    const N = scores.filter((s) => !s.isTrueAnomaly).length;

    if (P === 0 || N === 0) return 0.5;

    let tp = 0;
    let fp = 0;
    let prevFp = 0;
    let prevTp = 0;
    let auc = 0;

    for (const item of sorted) {
      if (item.isTrueAnomaly) {
        tp++;
      } else {
        fp++;
        // Trapezoidal integration step
        auc += (tp + prevTp) * (fp - prevFp) / 2.0;
        prevFp = fp;
        prevTp = tp;
      }
    }

    return auc / (P * N);
  }
}
