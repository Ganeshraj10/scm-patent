// ============================================================
// ExamGuard — Core Domain Types
// Phase 1: Type definitions only — no behavioral tracking yet
// ============================================================

export type DeviceType = 'desktop' | 'mobile' | 'tablet';

export type ModelStatus = 'cold_start' | 'active' | 'insufficient_data';

export type ReviewStatus = 'normal' | 'review_required' | 'verified' | 'not_verified' | 'disputed';

export type SessionType = 'low_stakes' | 'graded_examination';

export type AlertSeverity = 'low' | 'medium' | 'high';

// ─── Student ────────────────────────────────────────────────

export interface Student {
  id: string;
  name: string;
  email: string;
  studentId: string;
  department: string;
  enrollmentYear: number;
  deviceType: DeviceType;
  modelStatus: ModelStatus;
  sessionCount: number;
  modelConfidence: number; // 0–100
  lastActivity: string; // ISO date string
  reviewStatus: ReviewStatus;
  averageDeviationScore: number;
}

// ─── Behavioral Features ────────────────────────────────────

export interface BehavioralFeature {
  questionId: string;
  responseTime: number;      // ms spent on question
  revisionCount: number;     // number of answer changes
  pointerMovement: number;   // total px traveled
  scrollDistance: number;    // total px scrolled
  pasteDetected: boolean;    // clipboard paste occurred
  deviceType: DeviceType;
  // Contextual covariates
  questionDifficulty?: number; // 1–5 scale
  sessionPosition?: number;    // 0-indexed question position
  timeOfDay?: number;          // hour 0–23
}

// ─── Behavioral Model ───────────────────────────────────────

export interface FeatureExpectation {
  feature: keyof Omit<BehavioralFeature, 'questionId' | 'deviceType' | 'questionDifficulty' | 'sessionPosition' | 'timeOfDay'>;
  label: string;
  unit: string;
  mean: number;
  stdDev: number;
  min: number;
  max: number;
}

export interface FeatureUncertainty {
  feature: string;
  uncertainty: number;  // 0–1
  sampleSize: number;
}

export interface BehavioralModel {
  studentId: string;
  status: ModelStatus;
  sessionCount: number;
  minimumSessionsRequired: number;
  confidence: number; // 0–100
  lastUpdated: string;
  expectations: FeatureExpectation[];
  uncertainties: FeatureUncertainty[];
  calibratedThreshold?: number; // Phase 6: Distribution-free conformal threshold
  covarianceMatrix?: number[][];
  correlationMatrix?: number[][];
  inverseCorrelationMatrix?: number[][];
  shrinkageLambda?: number;
  featureOrder?: string[];
}

// ─── Sessions ───────────────────────────────────────────────

export interface BehavioralSession {
  id: string;
  studentId: string;
  studentName: string;
  type: SessionType;
  examName: string;
  examCode: string;
  startTime: string;
  endTime: string;
  duration: number; // minutes
  questionCount: number;
  deviceType: DeviceType;
  features: BehavioralFeature[];
  reviewStatus: ReviewStatus;
  cryptographicCommitment?: CryptographicCommitment;
}

// ─── Deviation Analysis ─────────────────────────────────────

export interface FeatureContribution {
  feature: string;
  label: string;
  unit: string;
  expected: number;
  observed: number;
  deviation: number;        // absolute residual
  contribution: number;     // coordinate contribution to Mahalanobis distance
  direction?: 'higher_than_expected' | 'lower_than_expected' | 'within_expected_range';
}

export interface DeviationAnalysis {
  sessionId: string;
  studentId: string;
  deviationScore: number;
  personalizedThreshold: number;
  reviewRequired: boolean;
  confidence: number; // 0–100
  featureContributions: FeatureContribution[];
  computedAt: string;
}

// ─── Exam Session (combined view) ───────────────────────────

export interface ExamSession {
  id: string;
  studentId: string;
  studentName: string;
  examName: string;
  examCode: string;
  type: SessionType;
  date: string;
  duration: number;
  questionCount: number;
  deviceType: DeviceType;
  deviationScore: number;
  personalizedThreshold: number;
  reviewStatus: ReviewStatus;
  modelConfidence: number;
  analysis?: DeviationAnalysis;
  cryptographicCommitment?: CryptographicCommitment;
}

// ─── Calibration ────────────────────────────────────────────

export interface CalibrationResult {
  studentId: string;
  targetFalsePositiveRate: number; // 0–1
  calibrationSessionCount: number;
  derivedThreshold: number;
  calibratedAt: string;
}

// ─── Cryptographic Provenance (Phase 9 placeholder) ─────────

export interface CryptographicCommitment {
  hash: string;
  algorithm: 'SHA-256';
  createdAt: string;
  payloadVersion: string;
}

// ─── Review ─────────────────────────────────────────────────

export interface Review {
  id: string;
  sessionId: string;
  studentId: string;
  studentName: string;
  examName: string;
  deviationScore: number;
  personalizedThreshold: number;
  severity: AlertSeverity;
  status: ReviewStatus;
  createdAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  notes?: string;
}

// ─── Questions (Phase 2+) ────────────────────────────────────

export interface Question {
  id: string;
  examCode: string;
  text: string;
  options: string[];
  correctIndex: number;
  difficulty: number; // 1–5
  topic: string;
}

// ─── Chart helpers ──────────────────────────────────────────

export interface DeviationDataPoint {
  date: string;
  deviationScore: number;
  threshold: number;
  reviewRequired: boolean;
}

export interface FeatureRadarPoint {
  feature: string;
  expected: number;
  observed: number;
}
