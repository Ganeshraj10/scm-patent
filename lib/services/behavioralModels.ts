import type { BehavioralModel, CalibrationResult, DeviceType, FeatureExpectation } from '@/types';
import { mockBehavioralModels } from '@/data/mockFeatures';
import { buildBehavioralModel } from '@/lib/modelingEngine';
import { getTrackedSessionsByStudent, getStudentSessions } from '@/lib/services/sessions';

const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

// ─── Retrieval ────────────────────────────────────────────────────────────────

export async function getBehavioralModel(studentId: string, deviceType: DeviceType = 'desktop'): Promise<BehavioralModel | null> {
  try {
    const response = await fetch(`/api/models/behavioral?deviceType=${deviceType}`);
    if (!response.ok) {
      if (response.status === 422 && isDemoMode) {
        return mockBehavioralModels[studentId] ?? mockBehavioralModels['stu-001'] ?? null;
      }
      throw new Error(`HTTP ${response.status}`);
    }

    const { data, error } = await response.json();
    if (error) throw new Error(error);

    if (!data) return null;

    return mapModelFromApi(data);
  } catch (error) {
    if (isDemoMode) {
      console.warn('[getBehavioralModel] Demo fallback', error);
      return mockBehavioralModels[studentId] ?? mockBehavioralModels['stu-001'] ?? null;
    }
    throw error;
  }
}

// ─── Persistence ──────────────────────────────────────────────────────────────

export async function saveBehavioralModel(
  studentId: string,
  deviceType: DeviceType,
  model: BehavioralModel,
  calibrationResult?: CalibrationResult | null
): Promise<void> {
  try {
    const payload = {
      device_type: deviceType,
      session_count: model.sessionCount,
      model_status: model.status,
      confidence: model.confidence,
      calibrated_threshold: calibrationResult?.derivedThreshold ?? null,
      target_fpr: calibrationResult?.targetFalsePositiveRate ?? null,
      training_count: model.sessionCount,
      calibration_count: calibrationResult?.calibrationSessionCount ?? null,
      expectations: model.expectations.map((e) => {
        const uncertainty = model.uncertainties.find(u => u.feature === e.feature)?.uncertainty ?? 0;
        return {
          feature_name: e.feature,
          expected_value: e.mean,
          uncertainty,
          variance: Math.pow(e.stdDev, 2),
          standard_deviation: e.stdDev,
          lower_bound: e.min,
          upper_bound: e.max,
        };
      }),
      mahalanobis_parameters: {
        feature_order: model.featureOrder ?? [
          'responseTime',
          'revisionCount',
          'pointerMovement',
          'scrollDistance',
          'pasteDetected',
        ],
        covariance_matrix: model.covarianceMatrix ?? null,
        correlation_matrix: model.correlationMatrix ?? null,
        inverse_correlation_matrix: model.inverseCorrelationMatrix ?? null,
        shrinkage_lambda: model.shrinkageLambda ?? null,
      },
    };

    const response = await fetch('/api/models/behavioral', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      if (response.status === 422 && isDemoMode) {
        return;
      }
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error ?? `HTTP ${response.status}`);
    }
  } catch (error) {
    if (isDemoMode) {
      console.warn('[saveBehavioralModel] Demo fallback', error);
      return;
    }
    throw error;
  }
}

// ─── Build + Persist ─────────────────────────────────────────────────────────

export async function buildAndPersistBehavioralModel(
  studentId: string,
  deviceType: DeviceType = 'desktop'
): Promise<BehavioralModel | null> {
  // 1. Fetch eligible sessions
  const trackedSessions = await getTrackedSessionsByStudent(studentId);
  const examSessions = await getStudentSessions(studentId);

  // Eligible: low_stakes or verified graded
  const eligibleTracked = trackedSessions.filter(s => s.type === 'low_stakes' || (s.type === 'graded_examination' && s.reviewStatus === 'verified'));
  const eligibleExams = examSessions.filter(s => s.type === 'low_stakes' || (s.type === 'graded_examination' && s.reviewStatus === 'verified'));

  // Combine and deduplicate
  const combined = [...eligibleTracked, ...eligibleExams];
  const uniqueSessions = Array.from(new Map(combined.map(s => [s.id, s])).values());
  
  // Filter by deviceType
  const deviceSessions = uniqueSessions.filter(s => s.deviceType === deviceType);

  if (deviceSessions.length === 0) {
    // Cannot build a model with zero sessions
    return null;
  }

  // 2. Build domain model
  const model = buildBehavioralModel(studentId, deviceSessions);

  // 3. Extract Calibration Result (already calculated in buildBehavioralModel)
  let calibrationResult: CalibrationResult | null = null;
  if (model.status === 'active' && model.calibratedThreshold !== undefined) {
    calibrationResult = {
      studentId,
      targetFalsePositiveRate: 0.05,
      calibrationSessionCount: model.sessionCount,
      derivedThreshold: model.calibratedThreshold,
      calibratedAt: model.lastUpdated,
    };
  }

  // 4. Persist
  await saveBehavioralModel(studentId, deviceType, model, calibrationResult);

  return model;
}

// ─── Mappers ──────────────────────────────────────────────────────────────────

function mapModelFromApi(row: any): BehavioralModel {
  const exps: FeatureExpectation[] = (row.feature_expectations ?? []).map((e: any) => ({
    feature: e.feature_name,
    label: e.feature_name,
    unit: '',
    mean: e.expected_value,
    stdDev: e.standard_deviation,
    min: e.lower_bound,
    max: e.upper_bound,
  }));

  const uncs = (row.feature_expectations ?? []).map((e: any) => ({
    feature: e.feature_name,
    uncertainty: e.uncertainty,
    sampleSize: row.session_count,
  }));

  const mp = row.mahalanobis_parameters;

  return {
    studentId: row.student_id,
    status: row.model_status,
    sessionCount: row.session_count,
    minimumSessionsRequired: 10,
    confidence: row.confidence,
    lastUpdated: row.updated_at,
    expectations: exps,
    uncertainties: uncs,
    calibratedThreshold: row.calibrated_threshold ?? undefined,
    covarianceMatrix: mp?.covariance_matrix ?? undefined,
    correlationMatrix: mp?.correlation_matrix ?? undefined,
    inverseCorrelationMatrix: mp?.inverse_correlation_matrix ?? undefined,
    shrinkageLambda: mp?.shrinkage_lambda ?? undefined,
    featureOrder: mp?.feature_order ?? undefined,
  };
}
