/**
 * ExamGuard — Calibration Service
 *
 * Coordinates conformal calibration threshold retrieval and computation.
 * The algorithm itself remains in lib/calibrationEngine.ts untouched.
 */

import type { CalibrationResult } from '@/types';
import { getBehavioralModel, buildAndPersistBehavioralModel } from '@/lib/services/behavioralModels';

// ─── Retrieval ────────────────────────────────────────────────────────────────

/**
 * Retrieve the current calibration result for a student.
 * Retrieves the persisted model from Supabase.
 */
export async function getCalibrationResult(studentId: string): Promise<CalibrationResult | null> {
  try {
    const model = await getBehavioralModel(studentId);
    if (!model || model.calibratedThreshold === undefined) return null;

    return {
      studentId,
      targetFalsePositiveRate: 0.05,
      calibrationSessionCount: model.sessionCount,
      derivedThreshold: model.calibratedThreshold,
      calibratedAt: model.lastUpdated,
    };
  } catch {
    return null;
  }
}

// ─── Build + Retrieve ─────────────────────────────────────────────────────────

/**
 * (Re-)calculate the conformal calibration threshold for a student and return
 * the result. Delegates to buildAndPersistBehavioralModel which handles persistence.
 */
export async function calculateAndGetCalibration(studentId: string): Promise<CalibrationResult | null> {
  try {
    const model = await buildAndPersistBehavioralModel(studentId);
    if (!model || model.calibratedThreshold === undefined) return null;

    return {
      studentId,
      targetFalsePositiveRate: 0.05,
      calibrationSessionCount: model.sessionCount,
      derivedThreshold: model.calibratedThreshold,
      calibratedAt: model.lastUpdated,
    };
  } catch {
    return null;
  }
}
