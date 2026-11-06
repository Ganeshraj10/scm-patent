/**
 * ============================================================================
 * EXAMGUARD — PHASE 2: SYNTHETIC DATASET GENERATION ENGINE
 * ============================================================================
 * Reproducible, scenario-driven synthetic examination dataset generator for
 * training and evaluating personalised behavioural anomaly-detection models.
 *
 * Design Specifications:
 * - 5 Canonical Features: responseTime (s), revisionCount, pointerMovement (px),
 *   scrollDistance (px), pasteDetected (%)
 * - 5 Scenario Categories: A (Normal), B (Legitimate Variations),
 *   C (Single-Feature Deviations), D (Multi-Feature Deviations),
 *   E (Behavioural & Data-Quality Scenarios)
 * - Deterministic reproducibility via seeded Mulberry32 PRNG
 * - Multivariate correlation modeling via Cholesky decomposition
 * - Chronological 3-way partition: Train (1-20), Calibration (21-30), Test (31-40)
 * - Zero external dependencies, 100% reproducible
 */

export const CANONICAL_FEATURES = [
  'responseTime',
  'revisionCount',
  'pointerMovement',
  'scrollDistance',
  'pasteDetected',
] as const;

export type CanonicalFeatureKey = (typeof CANONICAL_FEATURES)[number];

export type ScenarioCategory =
  | 'A_NORMAL'
  | 'B_LEGITIMATE_VARIATION'
  | 'C_SINGLE_FEATURE_DEVIATION'
  | 'D_MULTI_FEATURE_DEVIATION'
  | 'E_DATA_QUALITY_ANOMALY';

export type ScenarioSubtype =
  // A. Normal
  | 'A1_STANDARD_NORMAL'
  | 'A2_FAST_PACED'
  | 'A3_CAUTIOUS_REVIEW'
  | 'A4_VARIABLE_PACING'
  | 'A5_KEYBOARD_NAVIGATION'
  // B. Legitimate Variations (Non-anomalous)
  | 'B1_HARD_QUESTIONS'
  | 'B2_TEMPORARY_INTERRUPTION'
  | 'B3_DEVICE_SWITCH'
  | 'B4_EXAM_FATIGUE'
  | 'B5_METHODICAL_VERIFICATION'
  // C. Single-feature Deviations
  | 'C1_RESPONSE_TIME_FAST'
  | 'C2_REVISION_COUNT_SPIKE'
  | 'C3_POINTER_FROZEN'
  | 'C4_SCROLL_EXCESSIVE'
  | 'C5_PASTE_BURST'
  // D. Multi-feature Deviations
  | 'D1_FAST_AND_PASTE'
  | 'D2_FROZEN_POINTER_FAST_ANSWER'
  | 'D3_RAPID_PASTE_ZERO_REVISION'
  | 'D4_SIMULTANEOUS_MULTIVARIATE'
  | 'D5_UNSEEN_INTERACTION_PATTERN'
  // E. Behavioural and Data-quality
  | 'E1_GRADUAL_DRIFT'
  | 'E2_SUDDEN_STYLE_SHIFT'
  | 'E3_TEMPORARY_BURST'
  | 'E4_MISSING_SENSOR_STREAM'
  | 'E5_MEASUREMENT_NOISE'
  | 'E6_DUPLICATE_TELEMETRY'
  | 'E7_INVALID_BOUNDS';

export interface QuestionTelemetry {
  questionId: string;
  questionIndex: number;
  questionDifficulty: number; // [0.1, 0.9]
  responseTime: number; // seconds
  revisionCount: number;
  pointerMovement: number | null; // pixels (null if dropped/missing)
  scrollDistance: number | null; // pixels (null if dropped/missing)
  pasteDetected: boolean;
  deviceType: 'desktop' | 'laptop' | 'tablet';
  timestamp: string;
  isDuplicate?: boolean;
}

export interface SyntheticSession {
  sessionId: string;
  studentId: string;
  sessionIndex: number; // 1 to 40
  sessionType: 'low_stakes' | 'graded_examination';
  split: 'train' | 'calibration' | 'test';
  timestamp: string;
  deviceType: 'desktop' | 'laptop' | 'tablet';
  scenarioCategory: ScenarioCategory;
  scenarioSubtype: ScenarioSubtype;
  isAnomaly: boolean; // True for C & D; False for A & B
  anomalySeverity?: 'none' | 'subtle' | 'moderate' | 'severe';
  deviatingFeatures?: CanonicalFeatureKey[];
  notes?: string;
  features: QuestionTelemetry[];
  aggregatedFeatures: Record<CanonicalFeatureKey, number>;
}

export interface StudentProfile {
  studentId: string;
  archetype: 'FastIntuitive' | 'MethodicalThorough' | 'DeliberateCautious' | 'KeyboardMinimalist';
  preferredDevice: 'desktop' | 'laptop' | 'tablet';
  baseMeans: Record<CanonicalFeatureKey, number>;
  baseStdDevs: Record<CanonicalFeatureKey, number>;
  correlationMatrix: number[][]; // 5x5 symmetric positive-definite
  choleskyL: number[][]; // 5x5 lower triangular
}

export interface GeneratorConfig {
  seed?: number;
  numStudents?: number;
  sessionsPerStudent?: number; // default 40
  trainSessionCount?: number; // default 20
  calSessionCount?: number; // default 10
  testSessionCount?: number; // default 10
  questionsPerSession?: number; // default 5
  startDate?: string; // e.g. "2026-01-05T09:00:00Z"
}

// ─── Deterministic Seeded Pseudo-Random Number Generator (Mulberry32) ─────────

export class SeededPRNG {
  private s: number;

  constructor(seed: number = 42) {
    this.s = seed >>> 0;
  }

  random(): number {
    let t = (this.s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  normal(mean: number = 0, stdDev: number = 1): number {
    let u1 = this.random();
    let u2 = this.random();
    while (u1 <= 1e-15) u1 = this.random();
    const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
    return mean + z0 * stdDev;
  }

  uniformInt(min: number, max: number): number {
    return Math.floor(min + this.random() * (max - min + 1));
  }

  uniformFloat(min: number, max: number): number {
    return min + this.random() * (max - min);
  }

  choice<T>(items: T[]): T {
    return items[Math.floor(this.random() * items.length)];
  }
}

// ─── Linear Algebra Helpers (Cholesky & Positive-Definite Generation) ─────────

export function computeCholesky5x5(A: number[][]): number[][] {
  const n = 5;
  const L: number[][] = Array.from({ length: n }, () => Array(n).fill(0));

  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let sum = 0;
      for (let k = 0; k < j; k++) {
        sum += L[i][k] * L[j][k];
      }

      if (i === j) {
        const val = A[i][i] - sum;
        L[i][j] = Math.sqrt(Math.max(val, 1e-6));
      } else {
        const diag = Math.max(L[j][j], 1e-6);
        L[i][j] = (A[i][j] - sum) / diag;
      }
    }
  }

  return L;
}

// ─── Student Profile Initializer ──────────────────────────────────────────────

export function generateStudentProfiles(
  numStudents: number,
  prng: SeededPRNG
): StudentProfile[] {
  const archetypes: StudentProfile['archetype'][] = [
    'FastIntuitive',
    'MethodicalThorough',
    'DeliberateCautious',
    'KeyboardMinimalist',
  ];

  const devices: ('desktop' | 'laptop' | 'tablet')[] = ['desktop', 'laptop', 'desktop', 'laptop', 'tablet'];

  return Array.from({ length: numStudents }, (_, i) => {
    const studentId = `STU-${String(i + 1).padStart(4, '0')}`;
    const archetype = archetypes[i % archetypes.length];
    const preferredDevice = devices[i % devices.length];

    // Base means & stdDevs adapted to archetype with individual student dispersion (+/- 12%)
    let baseTime = 25;
    let baseRev = 1.5;
    let basePointer = 500;
    let baseScroll = 350;
    let basePaste = 1.0;

    if (archetype === 'FastIntuitive') {
      baseTime = prng.uniformFloat(14, 20);
      baseRev = prng.uniformFloat(0.5, 1.2);
      basePointer = prng.uniformFloat(300, 450);
      baseScroll = prng.uniformFloat(150, 250);
      basePaste = prng.uniformFloat(0.2, 1.5);
    } else if (archetype === 'MethodicalThorough') {
      baseTime = prng.uniformFloat(30, 42);
      baseRev = prng.uniformFloat(1.8, 2.8);
      basePointer = prng.uniformFloat(650, 850);
      baseScroll = prng.uniformFloat(400, 550);
      basePaste = prng.uniformFloat(0.5, 2.0);
    } else if (archetype === 'DeliberateCautious') {
      baseTime = prng.uniformFloat(45, 60);
      baseRev = prng.uniformFloat(3.2, 4.8);
      basePointer = prng.uniformFloat(800, 1050);
      baseScroll = prng.uniformFloat(550, 750);
      basePaste = prng.uniformFloat(0.5, 3.0);
    } else if (archetype === 'KeyboardMinimalist') {
      baseTime = prng.uniformFloat(22, 32);
      baseRev = prng.uniformFloat(1.2, 2.0);
      basePointer = prng.uniformFloat(90, 160);
      baseScroll = prng.uniformFloat(200, 320);
      basePaste = prng.uniformFloat(0.3, 1.5);
    }

    const baseMeans: Record<CanonicalFeatureKey, number> = {
      responseTime: baseTime,
      revisionCount: baseRev,
      pointerMovement: basePointer,
      scrollDistance: baseScroll,
      pasteDetected: basePaste,
    };

    const baseStdDevs: Record<CanonicalFeatureKey, number> = {
      responseTime: Math.max(2.5, baseTime * prng.uniformFloat(0.18, 0.28)),
      revisionCount: Math.max(0.4, baseRev * prng.uniformFloat(0.25, 0.40)),
      pointerMovement: Math.max(25, basePointer * prng.uniformFloat(0.16, 0.26)),
      scrollDistance: Math.max(20, baseScroll * prng.uniformFloat(0.18, 0.28)),
      pasteDetected: Math.max(0.2, basePaste * 0.5),
    };

    // Realistic correlation structure between behavioural features
    // 0: responseTime, 1: revisionCount, 2: pointerMovement, 3: scrollDistance, 4: pasteDetected
    const rTimePointer = prng.uniformFloat(0.55, 0.72);
    const rTimeScroll = prng.uniformFloat(0.42, 0.60);
    const rPointerScroll = prng.uniformFloat(0.48, 0.68);
    const rTimeRev = prng.uniformFloat(0.30, 0.48);
    const rRevPaste = prng.uniformFloat(0.08, 0.20);

    const R: number[][] = [
      [1.0, rTimeRev, rTimePointer, rTimeScroll, 0.05],
      [rTimeRev, 1.0, 0.22, 0.18, rRevPaste],
      [rTimePointer, 0.22, 1.0, rPointerScroll, 0.04],
      [rTimeScroll, 0.18, rPointerScroll, 1.0, 0.02],
      [0.05, rRevPaste, 0.04, 0.02, 1.0],
    ];

    // Ensure positive-definiteness via slight diagonal loading
    for (let k = 0; k < 5; k++) {
      R[k][k] = 1.05;
    }

    const choleskyL = computeCholesky5x5(R);

    return {
      studentId,
      archetype,
      preferredDevice,
      baseMeans,
      baseStdDevs,
      correlationMatrix: R,
      choleskyL,
    };
  });
}

// ─── Correlated Multivariate Residual Generator ───────────────────────────────

function sampleCorrelatedResiduals(choleskyL: number[][], prng: SeededPRNG): number[] {
  const u = [
    prng.normal(0, 1),
    prng.normal(0, 1),
    prng.normal(0, 1),
    prng.normal(0, 1),
    prng.normal(0, 1),
  ];

  const z = [0, 0, 0, 0, 0];
  for (let i = 0; i < 5; i++) {
    let sum = 0;
    for (let j = 0; j <= i; j++) {
      sum += choleskyL[i][j] * u[j];
    }
    z[i] = sum;
  }
  return z;
}

// ─── Scenario Behavioral Perturbations ────────────────────────────────────────

interface PerturbationSpec {
  timeMultiplier: number;
  revShift: number;
  pointerMultiplier: number;
  scrollMultiplier: number;
  pasteProbability: number;
  dropPointer?: boolean;
  dropScroll?: boolean;
  injectInvalid?: boolean;
  duplicateQuestion?: boolean;
}

function resolvePerturbation(
  category: ScenarioCategory,
  subtype: ScenarioSubtype,
  difficulty: number,
  questionIdx: number,
  totalQuestions: number,
  sessionIdx: number,
  prng: SeededPRNG
): PerturbationSpec {
  // Baseline context adjustment: higher difficulty legitimately increases time, revisions, and scrolling
  const diffFactor = 0.8 + 0.5 * difficulty; // [0.85, 1.25]
  let spec: PerturbationSpec = {
    timeMultiplier: diffFactor,
    revShift: difficulty > 0.7 ? 1 : 0,
    pointerMultiplier: diffFactor * 0.95,
    scrollMultiplier: diffFactor * 1.05,
    pasteProbability: 0.03,
  };

  // Stage of exam: fatigue slightly increases time on late questions
  const stage = (questionIdx + 1) / totalQuestions;
  if (stage > 0.8) {
    spec.timeMultiplier *= 1.1;
    spec.scrollMultiplier *= 1.12;
  }

  switch (subtype) {
    // ── Category A: Normal Behaviour ──
    case 'A1_STANDARD_NORMAL':
      break;
    case 'A2_FAST_PACED':
      spec.timeMultiplier *= 0.82;
      spec.pointerMultiplier *= 0.85;
      break;
    case 'A3_CAUTIOUS_REVIEW':
      spec.timeMultiplier *= 1.22;
      spec.revShift += 1;
      spec.scrollMultiplier *= 1.2;
      break;
    case 'A4_VARIABLE_PACING':
      if (questionIdx % 2 === 0) spec.timeMultiplier *= 0.85;
      else spec.timeMultiplier *= 1.25;
      break;
    case 'A5_KEYBOARD_NAVIGATION':
      spec.pointerMultiplier *= 0.35;
      spec.scrollMultiplier *= 1.15;
      break;

    // ── Category B: Legitimate Variations (Non-Anomalous) ──
    case 'B1_HARD_QUESTIONS':
      // Very hard questions legitimately double time & scroll, zero paste
      spec.timeMultiplier *= 1.95;
      spec.revShift += 2;
      spec.scrollMultiplier *= 1.75;
      spec.pointerMultiplier *= 1.5;
      spec.pasteProbability = 0.0;
      break;
    case 'B2_TEMPORARY_INTERRUPTION':
      // One question experiences an innocent 45s pause / stretch
      if (questionIdx === 2) {
        spec.timeMultiplier *= 2.4;
        spec.pointerMultiplier *= 0.6; // mouse idle during pause
      }
      break;
    case 'B3_DEVICE_SWITCH':
      // Switched to laptop trackpad: pointer movement drops, scrolling increases
      spec.pointerMultiplier *= 0.55;
      spec.scrollMultiplier *= 1.25;
      break;
    case 'B4_EXAM_FATIGUE':
      // Significant late-exam fatigue
      if (stage > 0.6) {
        spec.timeMultiplier *= 1.35;
        spec.revShift += 1;
        spec.scrollMultiplier *= 1.3;
      }
      break;
    case 'B5_METHODICAL_VERIFICATION':
      // Thorough answer checking
      spec.timeMultiplier *= 1.45;
      spec.revShift += 2;
      spec.pasteProbability = 0.0;
      break;

    // ── Category C: Single-Feature Deviations ──
    case 'C1_RESPONSE_TIME_FAST':
      // Abnormally rapid response (3.5 sigma fast on complex item)
      spec.timeMultiplier = 0.22;
      break;
    case 'C2_REVISION_COUNT_SPIKE':
      // Sudden burst of 12-18 revisions
      spec.revShift += 14;
      break;
    case 'C3_POINTER_FROZEN':
      // Completely motionless pointer (0px movement)
      spec.pointerMultiplier = 0.0;
      break;
    case 'C4_SCROLL_EXCESSIVE':
      // Hyperactive erratic scrolling
      spec.scrollMultiplier = 4.5;
      break;
    case 'C5_PASTE_BURST':
      // Sudden paste insertion event
      spec.pasteProbability = 0.95;
      break;

    // ── Category D: Multiple-Feature Deviations ──
    case 'D1_FAST_AND_PASTE':
      // Ultra-fast response + paste burst
      spec.timeMultiplier = 0.25;
      spec.pasteProbability = 0.92;
      break;
    case 'D2_FROZEN_POINTER_FAST_ANSWER':
      // Zero cursor travel + fast answer completion
      spec.pointerMultiplier = 0.0;
      spec.timeMultiplier = 0.3;
      break;
    case 'D3_RAPID_PASTE_ZERO_REVISION':
      // Superhuman insertion rate, paste, and zero revisions
      spec.timeMultiplier = 0.2;
      spec.pasteProbability = 0.95;
      spec.revShift = -10; // clamps to 0
      break;
    case 'D4_SIMULTANEOUS_MULTIVARIATE':
      // All 5 features deviate simultaneously
      spec.timeMultiplier = 0.22;
      spec.pointerMultiplier = 0.05;
      spec.scrollMultiplier = 3.8;
      spec.revShift = 12;
      spec.pasteProbability = 0.9;
      break;
    case 'D5_UNSEEN_INTERACTION_PATTERN':
      // High scroll + zero pointer + fast time
      spec.scrollMultiplier = 4.0;
      spec.pointerMultiplier = 0.0;
      spec.timeMultiplier = 0.28;
      break;

    // ── Category E: Behavioural and Data-Quality Scenarios ──
    case 'E1_GRADUAL_DRIFT': {
      // Natural longitudinal learning drift across 30 sessions (-15% response time)
      const driftProgress = sessionIdx / 40;
      spec.timeMultiplier *= 1.0 - 0.2 * driftProgress;
      break;
    }
    case 'E2_SUDDEN_STYLE_SHIFT':
      if (sessionIdx >= 35) {
        spec.timeMultiplier *= 0.65;
        spec.revShift += 3;
      }
      break;
    case 'E3_TEMPORARY_BURST':
      if (questionIdx === 1) {
        spec.timeMultiplier *= 0.35;
        spec.pasteProbability = 0.8;
      }
      break;
    case 'E4_MISSING_SENSOR_STREAM':
      spec.dropPointer = true;
      break;
    case 'E5_MEASUREMENT_NOISE':
      spec.timeMultiplier *= prng.uniformFloat(0.5, 1.8);
      spec.scrollMultiplier *= prng.uniformFloat(0.4, 2.0);
      break;
    case 'E6_DUPLICATE_TELEMETRY':
      if (questionIdx === 2) spec.duplicateQuestion = true;
      break;
    case 'E7_INVALID_BOUNDS':
      if (questionIdx === 0) spec.injectInvalid = true;
      break;
  }

  return spec;
}

// ─── Session Generator ────────────────────────────────────────────────────────

export function generateSyntheticDataset(config: GeneratorConfig = {}): {
  students: StudentProfile[];
  trainSessions: SyntheticSession[];
  calibrationSessions: SyntheticSession[];
  testSessions: SyntheticSession[];
  allSessions: SyntheticSession[];
  manifest: Record<string, any>;
} {
  const seed = config.seed ?? 42;
  const numStudents = config.numStudents ?? 100;
  const sessionsPerStudent = config.sessionsPerStudent ?? 40;
  const trainCount = config.trainSessionCount ?? 20;
  const calCount = config.calSessionCount ?? 10;
  const testCount = config.testSessionCount ?? 10;
  const numQuestions = config.questionsPerSession ?? 5;
  const startDate = new Date(config.startDate || '2026-01-05T09:00:00Z');

  const prng = new SeededPRNG(seed);
  const students = generateStudentProfiles(numStudents, prng);

  const trainSessions: SyntheticSession[] = [];
  const calibrationSessions: SyntheticSession[] = [];
  const testSessions: SyntheticSession[] = [];

  students.forEach((student) => {
    // 40 sessions chronologically spaced (e.g. 1 session every 1.5 days)
    for (let sIdx = 1; sIdx <= sessionsPerStudent; sIdx++) {
      const sessionDate = new Date(
        startDate.getTime() + (sIdx - 1) * 1.5 * 24 * 3600 * 1000 + prng.uniformInt(-3600, 3600) * 1000
      );

      let split: 'train' | 'calibration' | 'test' = 'train';
      let sessionType: 'low_stakes' | 'graded_examination' = 'low_stakes';

      if (sIdx <= trainCount) {
        split = 'train';
        sessionType = 'low_stakes';
      } else if (sIdx <= trainCount + calCount) {
        split = 'calibration';
        sessionType = 'low_stakes';
      } else {
        split = 'test';
        sessionType = 'graded_examination';
      }

      // Determine Scenario Assignment
      let category: ScenarioCategory = 'A_NORMAL';
      let subtype: ScenarioSubtype = 'A1_STANDARD_NORMAL';
      let isAnomaly = false;
      let severity: SyntheticSession['anomalySeverity'] = 'none';
      let deviatingFeatures: CanonicalFeatureKey[] = [];

      if (split === 'train') {
        // Training data is strictly normal baseline sessions
        if (sIdx > 12 && prng.random() < 0.25) {
          category = 'E_DATA_QUALITY_ANOMALY';
          subtype = 'E1_GRADUAL_DRIFT'; // natural learning curve drift
        } else {
          category = 'A_NORMAL';
          subtype = prng.choice([
            'A1_STANDARD_NORMAL',
            'A2_FAST_PACED',
            'A3_CAUTIOUS_REVIEW',
            'A4_VARIABLE_PACING',
            'A5_KEYBOARD_NAVIGATION',
          ]);
        }
      } else if (split === 'calibration') {
        // Calibration data is held-out normal baseline sessions
        category = 'A_NORMAL';
        subtype = prng.choice([
          'A1_STANDARD_NORMAL',
          'A2_FAST_PACED',
          'A3_CAUTIOUS_REVIEW',
          'A4_VARIABLE_PACING',
        ]);
      } else {
        // Test Set: Controlled distribution of scenarios across the 10 test sessions
        // 1 to 6 (60%): Normal A
        // 7 to 8 (20%): Legitimate B
        // 9 (10%): Single deviation C
        // 10 (10%): Multi deviation D or Data Quality E
        const testRelativeIdx = sIdx - (trainCount + calCount); // 1 to 10
        if (testRelativeIdx <= 6) {
          category = 'A_NORMAL';
          subtype = prng.choice([
            'A1_STANDARD_NORMAL',
            'A2_FAST_PACED',
            'A3_CAUTIOUS_REVIEW',
            'A4_VARIABLE_PACING',
          ]);
        } else if (testRelativeIdx === 7 || testRelativeIdx === 8) {
          category = 'B_LEGITIMATE_VARIATION';
          subtype = prng.choice([
            'B1_HARD_QUESTIONS',
            'B2_TEMPORARY_INTERRUPTION',
            'B3_DEVICE_SWITCH',
            'B4_EXAM_FATIGUE',
            'B5_METHODICAL_VERIFICATION',
          ]);
          isAnomaly = false; // Legitimate variations are NOT anomalies!
        } else if (testRelativeIdx === 9) {
          category = 'C_SINGLE_FEATURE_DEVIATION';
          subtype = prng.choice([
            'C1_RESPONSE_TIME_FAST',
            'C2_REVISION_COUNT_SPIKE',
            'C3_POINTER_FROZEN',
            'C4_SCROLL_EXCESSIVE',
            'C5_PASTE_BURST',
          ]);
          isAnomaly = true;
          severity = prng.choice(['subtle', 'moderate', 'severe']);
          if (subtype === 'C1_RESPONSE_TIME_FAST') deviatingFeatures = ['responseTime'];
          if (subtype === 'C2_REVISION_COUNT_SPIKE') deviatingFeatures = ['revisionCount'];
          if (subtype === 'C3_POINTER_FROZEN') deviatingFeatures = ['pointerMovement'];
          if (subtype === 'C4_SCROLL_EXCESSIVE') deviatingFeatures = ['scrollDistance'];
          if (subtype === 'C5_PASTE_BURST') deviatingFeatures = ['pasteDetected'];
        } else {
          // testRelativeIdx === 10
          if (prng.random() < 0.65) {
            category = 'D_MULTI_FEATURE_DEVIATION';
            subtype = prng.choice([
              'D1_FAST_AND_PASTE',
              'D2_FROZEN_POINTER_FAST_ANSWER',
              'D3_RAPID_PASTE_ZERO_REVISION',
              'D4_SIMULTANEOUS_MULTIVARIATE',
              'D5_UNSEEN_INTERACTION_PATTERN',
            ]);
            isAnomaly = true;
            severity = prng.choice(['moderate', 'severe']);
            if (subtype === 'D1_FAST_AND_PASTE') deviatingFeatures = ['responseTime', 'pasteDetected'];
            if (subtype === 'D2_FROZEN_POINTER_FAST_ANSWER')
              deviatingFeatures = ['pointerMovement', 'responseTime'];
            if (subtype === 'D3_RAPID_PASTE_ZERO_REVISION')
              deviatingFeatures = ['responseTime', 'pasteDetected', 'revisionCount'];
            if (subtype === 'D4_SIMULTANEOUS_MULTIVARIATE')
              deviatingFeatures = [...CANONICAL_FEATURES];
            if (subtype === 'D5_UNSEEN_INTERACTION_PATTERN')
              deviatingFeatures = ['scrollDistance', 'pointerMovement', 'responseTime'];
          } else {
            category = 'E_DATA_QUALITY_ANOMALY';
            subtype = prng.choice([
              'E2_SUDDEN_STYLE_SHIFT',
              'E3_TEMPORARY_BURST',
              'E4_MISSING_SENSOR_STREAM',
              'E5_MEASUREMENT_NOISE',
              'E6_DUPLICATE_TELEMETRY',
              'E7_INVALID_BOUNDS',
            ]);
            isAnomaly = subtype === 'E2_SUDDEN_STYLE_SHIFT' || subtype === 'E3_TEMPORARY_BURST';
            if (isAnomaly) severity = 'moderate';
          }
        }
      }

      // Generate Question Telemetry
      const questions: QuestionTelemetry[] = [];
      let totalTime = 0, countTime = 0;
      let totalRev = 0, countRev = 0;
      let totalPointer = 0, countPointer = 0;
      let totalScroll = 0, countScroll = 0;
      let totalPaste = 0, countPaste = 0;

      for (let qIdx = 0; qIdx < numQuestions; qIdx++) {
        const difficulty = prng.uniformFloat(0.2, 0.85);
        const qDate = new Date(sessionDate.getTime() + qIdx * 180 * 1000);

        const pert = resolvePerturbation(
          category,
          subtype,
          difficulty,
          qIdx,
          numQuestions,
          sIdx,
          prng
        );

        // Sample multivariate correlated residuals
        const residuals = sampleCorrelatedResiduals(student.choleskyL, prng);

        // 1. Response Time (seconds)
        let rt =
          student.baseMeans.responseTime * pert.timeMultiplier +
          student.baseStdDevs.responseTime * residuals[0];
        if (pert.injectInvalid) rt = -15.0; // Invalid bounds testing
        rt = Math.max(pert.injectInvalid ? -15.0 : 2.5, rt);

        // 2. Revision Count (integer count)
        let rev = Math.round(
          student.baseMeans.revisionCount +
            pert.revShift +
            student.baseStdDevs.revisionCount * residuals[1]
        );
        rev = Math.max(0, rev);

        // 3. Pointer Movement (pixels)
        let pm: number | null = null;
        if (!pert.dropPointer) {
          pm = Math.max(
            0,
            student.baseMeans.pointerMovement * pert.pointerMultiplier +
              student.baseStdDevs.pointerMovement * residuals[2]
          );
          if (pert.pointerMultiplier === 0) pm = 0;
        }

        // 4. Scroll Distance (pixels)
        let sd: number | null = null;
        if (!pert.dropScroll) {
          sd = Math.max(
            0,
            student.baseMeans.scrollDistance * pert.scrollMultiplier +
              student.baseStdDevs.scrollDistance * residuals[3]
          );
        }

        // 5. Paste Detected (boolean flag)
        const isPaste = prng.random() < pert.pasteProbability;

        const question: QuestionTelemetry = {
          questionId: `Q-${String(qIdx + 1).padStart(2, '0')}`,
          questionIndex: qIdx + 1,
          questionDifficulty: Number(difficulty.toFixed(2)),
          responseTime: Number(rt.toFixed(2)),
          revisionCount: rev,
          pointerMovement: pm !== null ? Number(pm.toFixed(1)) : null,
          scrollDistance: sd !== null ? Number(sd.toFixed(1)) : null,
          pasteDetected: isPaste,
          deviceType: student.preferredDevice,
          timestamp: qDate.toISOString(),
        };

        questions.push(question);

        // Aggregate statistics (filtering missing/null properly)
        if (rt >= 0) {
          totalTime += rt;
          countTime++;
        }
        totalRev += rev;
        countRev++;

        if (pm !== null) {
          totalPointer += pm;
          countPointer++;
        }
        if (sd !== null) {
          totalScroll += sd;
          countScroll++;
        }
        if (isPaste) totalPaste++;
        countPaste++;

        // Duplicate telemetry simulation
        if (pert.duplicateQuestion) {
          questions.push({ ...question, isDuplicate: true });
        }
      }

      const aggregatedFeatures: Record<CanonicalFeatureKey, number> = {
        responseTime: countTime > 0 ? Number((totalTime / countTime).toFixed(2)) : 0,
        revisionCount: countRev > 0 ? Number((totalRev / countRev).toFixed(2)) : 0,
        pointerMovement: countPointer > 0 ? Number((totalPointer / countPointer).toFixed(1)) : 0,
        scrollDistance: countScroll > 0 ? Number((totalScroll / countScroll).toFixed(1)) : 0,
        pasteDetected: countPaste > 0 ? Number(((totalPaste / countPaste) * 100).toFixed(1)) : 0,
      };

      const session: SyntheticSession = {
        sessionId: `${student.studentId}_SES${String(sIdx).padStart(2, '0')}`,
        studentId: student.studentId,
        sessionIndex: sIdx,
        sessionType,
        split,
        timestamp: sessionDate.toISOString(),
        deviceType: student.preferredDevice,
        scenarioCategory: category,
        scenarioSubtype: subtype,
        isAnomaly,
        anomalySeverity: severity,
        deviatingFeatures: deviatingFeatures.length > 0 ? deviatingFeatures : undefined,
        features: questions,
        aggregatedFeatures,
      };

      if (split === 'train') trainSessions.push(session);
      else if (split === 'calibration') calibrationSessions.push(session);
      else testSessions.push(session);
    }
  });

  const allSessions = [...trainSessions, ...calibrationSessions, ...testSessions];

  const manifest = {
    version: '2.0.0-phase2-synthetic',
    generatedAt: new Date().toISOString(),
    seed,
    numStudents,
    totalSessions: allSessions.length,
    totalQuestions: allSessions.reduce((acc, s) => acc + s.features.length, 0),
    splits: {
      train: {
        sessionCount: trainSessions.length,
        sessionRange: [1, trainCount],
        sessionType: 'low_stakes',
        anomalyCount: 0,
      },
      calibration: {
        sessionCount: calibrationSessions.length,
        sessionRange: [trainCount + 1, trainCount + calCount],
        sessionType: 'low_stakes',
        anomalyCount: 0,
      },
      test: {
        sessionCount: testSessions.length,
        sessionRange: [trainCount + calCount + 1, sessionsPerStudent],
        sessionType: 'graded_examination',
        anomalyCount: testSessions.filter((s) => s.isAnomaly).length,
        cleanCount: testSessions.filter((s) => !s.isAnomaly).length,
      },
    },
    scenarioBreakdown: {
      categoryA_normal: testSessions.filter((s) => s.scenarioCategory === 'A_NORMAL').length,
      categoryB_legitimate_variations: testSessions.filter(
        (s) => s.scenarioCategory === 'B_LEGITIMATE_VARIATION'
      ).length,
      categoryC_single_feature_deviations: testSessions.filter(
        (s) => s.scenarioCategory === 'C_SINGLE_FEATURE_DEVIATION'
      ).length,
      categoryD_multi_feature_deviations: testSessions.filter(
        (s) => s.scenarioCategory === 'D_MULTI_FEATURE_DEVIATION'
      ).length,
      categoryE_data_quality_anomalies: testSessions.filter(
        (s) => s.scenarioCategory === 'E_DATA_QUALITY_ANOMALY'
      ).length,
    },
  };

  return {
    students,
    trainSessions,
    calibrationSessions,
    testSessions,
    allSessions,
    manifest,
  };
}

