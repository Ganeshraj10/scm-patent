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

// ─── Questions (Phase 2+ & Stage 7 Realistic Formats) ────────

export type QuestionType = 'mcq' | 'multiple_select' | 'short_answer' | 'coding' | 'debugging';

export interface QuestionTestCase {
  id: string;
  input: string;
  expectedOutput: string;
  description?: string;
  isHidden?: boolean;
}

export interface Question {
  id: string;
  examCode?: string;
  type?: QuestionType; // Defaults to 'mcq'
  title?: string;
  text: string;
  description?: string;
  difficulty: number; // 0.0–1.0 normalized
  topic: string;
  // Multiple Choice & Multiple Select
  options?: string[];
  correctIndex?: number;
  correctIndices?: number[];
  // Short Answer
  expectedAnswer?: string;
  minWordCount?: number;
  // Coding & Debugging
  starterCode?: string;
  solutionCode?: string;
  language?: 'python' | 'javascript';
  testCases?: QuestionTestCase[];
  explanation?: string;
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

// ─── Stage 2: Patent Prototype Dataset & Normalized Domain Models ────────────

export interface RawPatentRecord {
  record_id: string;
  student_id: string;
  session_id: string;
  session_type: 'low_stakes' | 'graded';
  question_id: string;
  timestamp: string;
  question_difficulty: number;
  response_time_sec: number;
  answer_revision_count: number;
  answer_revision_time_sec: number;
  correctness: number;
  pointer_distance_px: number;
  pointer_avg_speed_px_s: number;
  scroll_distance_px: number;
  scroll_events: number;
  paste_detected: number; // 0 or 1
  character_burst_flag: number; // 0 or 1
  device_type: 'web_desktop' | 'web_laptop' | 'mobile' | string;
  session_position: number;
  time_of_day: string;
  source_dataset: string;
  human_review_label: 'clean_mock' | 'flagged_mock' | string;
}

export interface QuestionInteraction {
  questionId: string;
  recordId: string;
  difficulty: number;
  responseTimeSec: number;
  revisionCount: number;
  revisionTimeSec: number;
  correctness: number;
  pointerDistancePx: number;
  pointerAvgSpeedPxS: number;
  scrollDistancePx: number;
  scrollEvents: number;
  pasteDetected: boolean;
  characterBurstFlag: boolean;
  deviceType: string;
  sessionPosition: number;
  timeOfDay: string;
  timestamp: string;
  sourceDataset: string;
  humanReviewLabel: string;
}

export interface DatasetSession {
  sessionId: string;
  studentId: string;
  sessionType: 'low_stakes' | 'graded';
  timestamp: string;
  deviceType: string;
  questionCount: number;
  avgResponseTimeSec: number;
  avgRevisionCount: number;
  avgPointerSpeed: number;
  totalScrollDistance: number;
  hasPasteEvent: boolean;
  hasBurstEvent: boolean;
  humanReviewLabel: string;
  interactions: QuestionInteraction[];
}

export interface StudentGroup {
  studentId: string;
  totalSessions: number;
  lowStakesCount: number;
  gradedCount: number;
  devices: string[];
  primaryDevice: string;
  avgResponseTimeSec: number;
  avgRevisionCount: number;
  avgPointerSpeed: number;
  avgScrollDistance: number;
  latestSessionDate: string;
  sessions: DatasetSession[];
  lowStakesSessions: DatasetSession[];
  gradedSessions: DatasetSession[];
}

export interface DataValidationIssue {
  recordId?: string;
  studentId?: string;
  sessionId?: string;
  field: string;
  value: any;
  severity: 'error' | 'warning';
  message: string;
}

export interface DataValidationReport {
  isValid: boolean;
  totalRecordsChecked: number;
  errorCount: number;
  warningCount: number;
  duplicateCount: number;
  issues: DataValidationIssue[];
  checkedAt: string;
}

export interface DatasetStatusSummary {
  totalRecords: number;
  totalStudents: number;
  totalSessions: number;
  lowStakesRecords: number;
  gradedRecords: number;
  deviceCounts: Record<string, number>;
  flaggedRecords: number;
  dataQualityStatus: '100% Valid' | 'Issues Detected';
  validationReport: DataValidationReport;
  sourceComposition: string;
  isSyntheticPrototype: true;
}

// ─── Stage 3: User Management, Roles & RBAC ─────────────────────────────────

export type UserRole = 'student' | 'instructor' | 'admin';
export type UserStatus = 'active' | 'disabled';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
  lastLogin: string;
  studentId?: string; // Mapped dataset student ID (e.g. S001) for students
  department?: string;
}

export type Permission =
  | 'VIEW_OWN_DASHBOARD'
  | 'VIEW_OWN_COURSEWORK'
  | 'VIEW_OWN_EXAMS'
  | 'VIEW_OWN_RESULTS'
  | 'TAKE_EXAM'
  | 'VIEW_INSTRUCTOR_DASHBOARD'
  | 'VIEW_ASSIGNED_STUDENTS'
  | 'VIEW_STUDENT_COURSEWORK'
  | 'VIEW_STUDENT_SESSIONS'
  | 'VIEW_BEHAVIORAL_ANALYSIS'
  | 'VIEW_REVIEW_QUEUE'
  | 'PERFORM_HUMAN_REVIEW'
  | 'VIEW_ADMIN_DASHBOARD'
  | 'MANAGE_USERS'
  | 'CHANGE_USER_ROLE'
  | 'TOGGLE_USER_STATUS'
  | 'VIEW_SYSTEM_STATUS'
  | 'MANAGE_APP_SETTINGS';

export interface UserFilterOptions {
  search?: string;
  role?: UserRole | 'all';
  status?: UserStatus | 'all';
}

export interface UserMutationInput {
  name: string;
  email: string;
  role: UserRole;
  status?: UserStatus;
  studentId?: string;
  department?: string;
}

// ─── Stage 5: Personalized Behavioral Baseline ──────────────────────────────

export type MaturityStatus = 'cold_start' | 'developing' | 'established';

export type AdjustmentMethod =
  | 'difficulty_adjusted'
  | 'student_mean_fallback'
  | 'student_overall_fallback';

export interface FeatureBaseline {
  featureName: string;
  displayName: string;
  expectedValue: number;
  mean: number;
  median: number;
  stdDev: number;
  min: number;
  max: number;
  sampleCount: number;
  uncertainty: number; // stdDev / sqrt(sampleCount)
  status: 'established' | 'limited_data' | 'insufficient_data';
  method: AdjustmentMethod;
  unit: string;
  difficultyRegression?: {
    slope: number;
    intercept: number;
    r2: number;
  };
}

export interface DeviceBaseline {
  deviceType: string;
  sessionCount: number;
  sampleCount: number;
  features: Record<string, FeatureBaseline>;
}

export interface PersonalizedBaseline {
  studentId: string;
  trainingSessionCount: number;
  totalInteractions: number;
  maturityStatus: MaturityStatus;
  maturityLabel: string;
  overallFeatures: Record<string, FeatureBaseline>;
  deviceBaselines: Record<string, DeviceBaseline>;
  timeOfDayDistribution: Record<string, number>;
  lastUpdated: string;
  eligibleLowStakesSessions: string[];
}

export interface BehaviorContext {
  difficulty?: number;
  deviceType?: string;
  sessionPosition?: number;
  timeOfDay?: string;
}

// ─── Stage 6: Graded Examination & Real-Time Feature Capture ─────────────────

export type ExamSessionStatus = 'not_started' | 'in_progress' | 'completed' | 'abandoned';

export interface ExamQuestionTelemetry {
  recordId: string;
  studentId: string;
  sessionId: string;
  questionId: string;
  questionType?: QuestionType;
  questionDifficulty: number;
  sessionPosition: number;
  selectedAnswerIndex: number | null;
  selectedAnswerIndices?: number[];
  isAnswerCorrect?: boolean;
  responseTimeSec: number;
  answerRevisionCount: number;
  answerRevisionTimeSec: number;
  codeRevisionCount?: number;
  timeToFirstEditSec?: number;
  codeRunCount?: number;
  testCasesPassed?: number;
  testCasesTotal?: number;
  textAnswerLength?: number;
  pointerDistancePx: number;
  pointerAvgSpeedPxS: number;
  scrollDistancePx: number;
  scrollEvents: number;
  pasteDetected: number; // 0 or 1 (content never stored)
  characterBurstFlag: number; // 0 or 1
  maxInsertionRate?: number; // peak chars/sec detected
  maxCharsInserted?: number; // maximum characters added in a single event
  burstThresholdUsed?: number; // chars/sec threshold configured
  burstReason?: string; // diagnostic explanation for burst flag
  deviceType: string;
  timeOfDay: string;
  timestamp: string;
  clientUserAgent?: string;
}

export interface GradedExamSession {
  sessionId: string;
  studentId: string;
  examId: string;
  examTitle: string;
  sessionType: 'graded';
  deviceType: string;
  status: ExamSessionStatus;
  startedAt: string;
  completedAt?: string;
  questionCount: number;
  completedQuestionsCount: number;
  avgResponseTimeSec?: number;
  avgRevisionCount?: number;
  totalCodeRevisions?: number;
  hasPasteEvent?: boolean;
  hasBurstEvent?: boolean;
  interactions: ExamQuestionTelemetry[];
  answersPayload?: Record<string, any>;
}

// ─── Stage 8: Behavioral Deviation & Risk Analysis Engine ────────────────────

export type RiskLevel = 'low' | 'medium' | 'high' | 'limited_analysis';
export type ConfidenceLevel = 'high' | 'moderate' | 'low';
export type DeviationDirection = 'higher' | 'lower' | 'expected' | 'signal_detected';

export interface FeatureDeviation {
  featureKey: string;
  displayName: string;
  observedValue: number;
  expectedValue: number;
  difference: number;
  uncertainty: number;
  standardizedDeviation: number; // z-score
  direction: DeviationDirection;
  contributionWeight: number;
  contributionPct: number;
  unit: string;
  status: 'evaluated' | 'insufficient_data' | 'signal_triggered';
  explanation: string;
}

export interface QuestionAnalysis {
  questionId: string;
  sessionPosition: number;
  questionDifficulty: number;
  questionScore: number; // 0–100
  isAnomalous: boolean;
  featureDeviations: Record<string, FeatureDeviation>;
  primaryContributingFeature?: string;
  explanation: string;
}

export interface FeatureContributionSummary {
  featureKey: string;
  displayName: string;
  rawContribution: number;
  percentage: number;
  direction: DeviationDirection;
  unit: string;
}

export interface BehavioralAnalysisResult {
  analysisId: string;
  studentId: string;
  sessionId: string;
  examTitle: string;
  evaluatedAt: string;
  modelStatus: MaturityStatus;
  modelMaturityLabel: string;
  trainingSessionCount: number;

  // Overall scoring (0–100)
  overallScore: number;
  riskLevel: RiskLevel;
  riskStatusLabel: string;
  confidence: ConfidenceLevel;
  confidenceLabel: string;

  // Context & Device Signals
  examDeviceType: string;
  deviceChangeDetected: boolean;
  deviceContextNote?: string;

  // Question & Feature breakdowns
  questionAnalyses: QuestionAnalysis[];
  featureDeviations: Record<string, FeatureDeviation>;
  featureContributions: FeatureContributionSummary[];

  // Student-centric explanations
  summaryExplanation: string;
  warnings: string[];
  isEligibleForReport: boolean;
}

// ─── Stage 9: Explainable Behavioral Risk Report ─────────────────────────────

export type FeatureStatusTag =
  | 'Within Baseline'
  | 'Mild Deviation'
  | 'Significant Deviation'
  | 'Detected Signal'
  | 'Insufficient Data';

export interface FeatureReportItem {
  featureKey: string;
  displayName: string;
  expected: number;
  observed: number;
  difference: number;
  uncertainty: number;
  standardizedDeviation: number; // z-score
  contributionPct: number;
  unit: string;
  status: FeatureStatusTag;
  direction: DeviationDirection;
  explanation: string;
  rangeMin?: number;
  rangeMax?: number;
}

export interface QuestionReportItem {
  questionId: string;
  sessionPosition: number;
  difficulty: number;
  responseTimeObs: number;
  responseTimeExp: number;
  revisionCountObs: number;
  revisionCountExp: number;
  pointerSpeedObs: number;
  scrollDistanceObs: number;
  pasteDetected: number;
  characterBurstFlag: number;
  questionScore: number;
  deviationTier: 'Low' | 'Moderate' | 'High';
  explanation: string;
}

export interface BehavioralRiskReport {
  reportId: string;
  studentId: string;
  studentName: string;
  department: string;
  sessionId: string;
  examId: string;
  examTitle: string;
  generatedAt: string;

  // Orthogonal Model Maturity
  modelStatus: MaturityStatus;
  modelMaturityLabel: string;
  trainingSessionCount: number;

  // Behavioral Deviation & Risk
  overallScore: number; // 0–100
  riskLevel: RiskLevel;
  riskStatusLabel: string;
  confidence: ConfidenceLevel;
  confidenceLabel: string;

  // Executive Narrative & Recommendation
  executiveSummary: string;
  recommendedAction: string;

  // Structured breakdowns
  featureReports: FeatureReportItem[];
  questionReports: QuestionReportItem[];

  // Hardware Context
  examDeviceType: string;
  historicalDevices: string[];
  deviceChangeDetected: boolean;
  deviceContextExplanation?: string;

  // Transparency & Audit
  analysisMethod: string;
  disclaimer: string;
  warnings: string[];
  isEligibleForHumanReview: boolean;
}




