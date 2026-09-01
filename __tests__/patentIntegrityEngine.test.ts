import {
  getAllPatentRecords,
  getPatentStudents,
  getStudentLowStakesRecords,
  getStudentGradedRecords,
  getDatasetSummary,
  PatentRecord,
} from '../lib/services/datasetService';
import {
  buildPersonalizedBaseline,
  calculateExpectedBehavior,
} from '../lib/services/behavioralModel';
import {
  evaluateSessionAnomaly,
  DEFAULT_SCORING_WEIGHTS,
} from '../lib/services/anomalyDetection';
import { generateRiskReport } from '../lib/services/riskExplanation';

describe('Patent Examination Integrity Engine & Dataset Service', () => {
  // ─── 1. Dataset Loading & Schema Integrity ─────────────────────────────────
  test('loads all 120 records from the prototype dataset accurately', () => {
    const records = getAllPatentRecords();
    expect(records.length).toBe(120);

    const summary = getDatasetSummary();
    expect(summary.totalRecords).toBe(120);
    expect(summary.totalStudents).toBe(10);
    expect(summary.lowStakesCount).toBe(80);
    expect(summary.gradedCount).toBe(40);
    expect(summary.flaggedCount).toBe(3); // S003_EX02, S010_EX01, S010_EX03
  });

  test('extracts 10 unique student IDs (S001 to S010)', () => {
    const students = getPatentStudents();
    expect(students).toEqual([
      'S001',
      'S002',
      'S003',
      'S004',
      'S005',
      'S006',
      'S007',
      'S008',
      'S009',
      'S010',
    ]);
  });

  test('verifies each student has 8 low-stakes and 4 graded records', () => {
    const students = getPatentStudents();
    students.forEach((stuId) => {
      const lowStakes = getStudentLowStakesRecords(stuId);
      const graded = getStudentGradedRecords(stuId);
      expect(lowStakes.length).toBe(8);
      expect(graded.length).toBe(4);
    });
  });

  // ─── 2. Personalized Baseline Modeling ──────────────────────────────────────
  test('builds accurate statistical baseline for student S001', () => {
    const baseline = buildPersonalizedBaseline('S001');
    expect(baseline.studentId).toBe('S001');
    expect(baseline.sessionCount).toBe(8);
    expect(baseline.isColdStart).toBe(false);
    expect(baseline.maturityStatus).toBe('mature');
    expect(baseline.confidence).toBeGreaterThan(80);

    // Response time mean for S001 low-stakes: (31.0+27.8+33.5+30.3+33.6+31.9+31.5+37.4)/8 = 32.125
    expect(baseline.responseTime.mean).toBeCloseTo(32.125, 2);
    expect(baseline.responseTime.stdDev).toBeGreaterThan(0);
    expect(baseline.historicalDevices).toContain('web_desktop');
    expect(baseline.historicalDevices).toContain('web_laptop');
    expect(baseline.historicalDevices).toContain('mobile');
  });

  // ─── 3. Contextual Expected Behavior with Question Difficulty ──────────────
  test('adjusts expected response time according to question difficulty', () => {
    const baseline = buildPersonalizedBaseline('S001');

    const easyRecord: Pick<PatentRecord, 'question_difficulty' | 'device_type' | 'session_position' | 'time_of_day'> = {
      question_difficulty: 0.2,
      device_type: 'web_desktop',
      session_position: 4,
      time_of_day: '10:00',
    };

    const hardRecord: Pick<PatentRecord, 'question_difficulty' | 'device_type' | 'session_position' | 'time_of_day'> = {
      question_difficulty: 0.9,
      device_type: 'web_desktop',
      session_position: 4,
      time_of_day: '10:00',
    };

    const easyExpected = calculateExpectedBehavior(baseline, easyRecord);
    const hardExpected = calculateExpectedBehavior(baseline, hardRecord);

    expect(hardExpected.expectedResponseTime).toBeGreaterThan(easyExpected.expectedResponseTime);
    expect(hardExpected.expectedRevisionCount).toBeGreaterThan(easyExpected.expectedRevisionCount);
  });

  // ─── 4. Scenario 1: Normal Graded Session ──────────────────────────────────
  test('Scenario 1: Normal graded examination produces Low/Medium risk', () => {
    const baseline = buildPersonalizedBaseline('S001');
    const normalGraded = getStudentGradedRecords('S001')[0]; // S001_EX01

    const evalResult = evaluateSessionAnomaly(normalGraded, baseline);
    expect(evalResult.riskLevel).toBe('Low');
    expect(evalResult.riskScore).toBeLessThan(40);
    expect(evalResult.reviewRecommended).toBe(false);

    const report = generateRiskReport(evalResult, normalGraded);
    expect(report.statusLabel).toBe('Normal');
  });

  // ─── 5. Scenario 2: High Deviation Session ─────────────────────────────────
  test('Scenario 2: Highly accelerated response + revisions + pointer anomalies produces High Risk', () => {
    const baseline = buildPersonalizedBaseline('S003');
    // S003_EX02 is flagged: response_time=3.8s, revisions=5, pointer_avg_speed=654.1 px/s, paste=1, burst=1
    const flaggedGraded = getStudentGradedRecords('S003').find((r) => r.session_id === 'S003_EX02')!;

    const evalResult = evaluateSessionAnomaly(flaggedGraded, baseline);
    expect(evalResult.riskLevel).toBe('High');
    expect(evalResult.riskScore).toBeGreaterThanOrEqual(70);
    expect(evalResult.reviewRecommended).toBe(true);
    expect(evalResult.pasteFlagged).toBe(true);
    expect(evalResult.burstFlagged).toBe(true);

    const report = generateRiskReport(evalResult, flaggedGraded);
    expect(report.statusLabel).toBe('High-risk behavioral deviation');
    
    // Check that explanation bullets contain key feature explanations
    const bulletTitles = report.bullets.map((b) => b.title);
    expect(bulletTitles).toContain('Significantly Accelerated Response Time');
    expect(bulletTitles).toContain('Elevated Pointer Velocity');
    expect(bulletTitles).toContain('Clipboard Paste Event Detected');
    expect(bulletTitles).toContain('Abnormal Character Burst Detected');
  });

  // ─── 6. Scenario 3: Device Change Detection ─────────────────────────────────
  test('Scenario 3: Exam on unobserved device triggers unexpected device warning', () => {
    // Custom student records with only desktop history
    const desktopOnlyRecords: PatentRecord[] = [
      {
        record_id: 'TEST_01',
        student_id: 'TEST_STU',
        session_id: 'TEST_LS01',
        session_type: 'low_stakes',
        question_id: 'q1',
        timestamp: '2026-01-01 10:00:00',
        question_difficulty: 0.5,
        response_time_sec: 30,
        answer_revision_count: 1,
        answer_revision_time_sec: 2,
        correctness: 1,
        pointer_distance_px: 500,
        pointer_avg_speed_px_s: 200,
        scroll_distance_px: 300,
        scroll_events: 3,
        paste_detected: 0,
        character_burst_flag: 0,
        device_type: 'web_desktop',
        session_position: 1,
        time_of_day: '10:00',
        source_dataset: 'mock',
        human_review_label: 'clean_mock',
      },
      {
        record_id: 'TEST_02',
        student_id: 'TEST_STU',
        session_id: 'TEST_LS02',
        session_type: 'low_stakes',
        question_id: 'q2',
        timestamp: '2026-01-02 10:00:00',
        question_difficulty: 0.5,
        response_time_sec: 32,
        answer_revision_count: 1,
        answer_revision_time_sec: 2,
        correctness: 1,
        pointer_distance_px: 520,
        pointer_avg_speed_px_s: 210,
        scroll_distance_px: 310,
        scroll_events: 3,
        paste_detected: 0,
        character_burst_flag: 0,
        device_type: 'web_desktop',
        session_position: 2,
        time_of_day: '10:00',
        source_dataset: 'mock',
        human_review_label: 'clean_mock',
      },
      {
        record_id: 'TEST_03',
        student_id: 'TEST_STU',
        session_id: 'TEST_LS03',
        session_type: 'low_stakes',
        question_id: 'q3',
        timestamp: '2026-01-03 10:00:00',
        question_difficulty: 0.5,
        response_time_sec: 31,
        answer_revision_count: 1,
        answer_revision_time_sec: 2,
        correctness: 1,
        pointer_distance_px: 510,
        pointer_avg_speed_px_s: 205,
        scroll_distance_px: 305,
        scroll_events: 3,
        paste_detected: 0,
        character_burst_flag: 0,
        device_type: 'web_desktop',
        session_position: 3,
        time_of_day: '10:00',
        source_dataset: 'mock',
        human_review_label: 'clean_mock',
      },
    ];

    const baseline = buildPersonalizedBaseline('TEST_STU', [], desktopOnlyRecords);
    expect(baseline.historicalDevices).toEqual(['web_desktop']);

    const mobileExamRecord: PatentRecord = {
      record_id: 'TEST_EX01',
      student_id: 'TEST_STU',
      session_id: 'TEST_EX01',
      session_type: 'graded',
      question_id: 'q99',
      timestamp: '2026-01-10 10:00:00',
      question_difficulty: 0.5,
      response_time_sec: 31,
      answer_revision_count: 1,
      answer_revision_time_sec: 2,
      correctness: 1,
      pointer_distance_px: 510,
      pointer_avg_speed_px_s: 205,
      scroll_distance_px: 305,
      scroll_events: 3,
      paste_detected: 0,
      character_burst_flag: 0,
      device_type: 'mobile_unknown',
      session_position: 1,
      time_of_day: '10:00',
      source_dataset: 'mock',
      human_review_label: 'clean_mock',
    };

    const evalResult = evaluateSessionAnomaly(mobileExamRecord, baseline);
    expect(evalResult.isUnexpectedDevice).toBe(true);

    const report = generateRiskReport(evalResult, mobileExamRecord);
    const bulletTitles = report.bullets.map((b) => b.title);
    expect(bulletTitles).toContain('Unexpected Device Type');
  });

  // ─── 7. Scenario 4: Cold Start (< 3 sessions) ──────────────────────────────
  test('Scenario 4: Student with < 3 low-stakes sessions triggers cold start & reduces confidence', () => {
    const twoSessionRecords = getStudentLowStakesRecords('S001').slice(0, 2);
    const coldBaseline = buildPersonalizedBaseline('S001', [], twoSessionRecords);

    expect(coldBaseline.isColdStart).toBe(true);
    expect(coldBaseline.maturityStatus).toBe('cold_start');
    expect(coldBaseline.confidence).toBeLessThanOrEqual(45);

    const gradedRecord = getStudentGradedRecords('S001')[0];
    const evalResult = evaluateSessionAnomaly(gradedRecord, coldBaseline);
    expect(evalResult.isColdStart).toBe(true);
    // Score should be attenuated
    expect(evalResult.riskScore).toBeLessThan(60);

    const report = generateRiskReport(evalResult, gradedRecord);
    expect(report.statusLabel).toBe('Insufficient History');
    expect(report.bullets[0].title).toBe('Immature Model / Cold Start');
  });

  // ─── 8. Model-Update Rule: Only Verified Clean Sessions update baseline ─────
  test('Model-Update Rule: Baseline excludes unverified/flagged sessions and updates only on verified clean', () => {
    const studentId = 'S003';
    
    // Default baseline built only with low_stakes
    const initialBaseline = buildPersonalizedBaseline(studentId);
    expect(initialBaseline.sessionCount).toBe(8);

    // Verify S003_EX01 (clean exam) is NOT in baseline until explicitly verified
    const withVerifiedBaseline = buildPersonalizedBaseline(studentId, ['S003_EX01']);
    expect(withVerifiedBaseline.sessionCount).toBe(9);

    // Unverified or flagged sessions should never be supplied
    const unverifiedBaseline = buildPersonalizedBaseline(studentId, []);
    expect(unverifiedBaseline.sessionCount).toBe(8);
  });
});
