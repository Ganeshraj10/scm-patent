import {
  getAllRecords,
  getAllPatentRecords,
  getStudents,
  getStudent,
  getStudentSessions,
  getSession,
  getLowStakesSessions,
  getGradedSessions,
  getRecordsForSession,
  validateDataset,
  getDatasetStatus,
  SOURCE_DATASET_COMPOSITION,
  PatentRecord,
} from '../lib/services/datasetService';
import type { DatasetSession, DataValidationIssue } from '../types';

describe('Stage 2: Dataset Integration, Normalized Models & Exploration', () => {
  // ─── 1. CSV Loading & Parsing ──────────────────────────────────────────────
  test('1. CSV loads successfully with exactly 120 records', () => {
    const records = getAllRecords();
    expect(records).toBeDefined();
    expect(records.length).toBe(120);
  });

  // ─── 2. Schema Recognition & All 22 Columns ────────────────────────────────
  test('2. Recognizes and types all 22 expected columns in the dataset schema', () => {
    const first = getAllRecords()[0];
    expect(first.record_id).toBe('R0001');
    expect(first.student_id).toBe('S001');
    expect(first.session_id).toBe('S001_LS01');
    expect(first.session_type).toBe('low_stakes');
    expect(first.question_id).toBe('q4598');
    expect(first.timestamp).toBe('2026-01-11 10:29:00');
    expect(typeof first.question_difficulty).toBe('number');
    expect(typeof first.response_time_sec).toBe('number');
    expect(typeof first.answer_revision_count).toBe('number');
    expect(typeof first.answer_revision_time_sec).toBe('number');
    expect(typeof first.correctness).toBe('number');
    expect(typeof first.pointer_distance_px).toBe('number');
    expect(typeof first.pointer_avg_speed_px_s).toBe('number');
    expect(typeof first.scroll_distance_px).toBe('number');
    expect(typeof first.scroll_events).toBe('number');
    expect(typeof first.paste_detected).toBe('number');
    expect(typeof first.character_burst_flag).toBe('number');
    expect(first.device_type).toBe('web_desktop');
    expect(typeof first.session_position).toBe('number');
    expect(first.time_of_day).toBe('10:29');
    expect(first.source_dataset).toContain('EdNet/Junyi');
    expect(first.human_review_label).toBe('clean_mock');
  });

  // ─── 3. Student Grouping ───────────────────────────────────────────────────
  test('3. Groups records into 10 unique student cohorts (S001 to S010)', () => {
    const students = getStudents();
    expect(students.length).toBe(10);
    const studentIds = students.map((s) => s.studentId);
    expect(studentIds).toEqual([
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

  // ─── 4. Session Grouping ───────────────────────────────────────────────────
  test('4. Correctly associates sessions with question-level interactions without data loss', () => {
    const student = getStudent('S001');
    expect(student).toBeDefined();
    expect(student?.sessions.length).toBe(12);

    const firstSession = student?.sessions[0];
    expect(firstSession?.sessionId).toBe('S001_LS01');
    expect(firstSession?.interactions.length).toBe(1);
    expect(firstSession?.interactions[0].questionId).toBe('q4598');
    expect(firstSession?.interactions[0].responseTimeSec).toBe(31.0);
  });

  // ─── 5. Low-Stakes Filtering ───────────────────────────────────────────────
  test('5. Low-stakes filtering returns exactly 80 coursework records (8 per student)', () => {
    const students = getStudents();
    let totalLowStakes = 0;
    students.forEach((stu) => {
      const lowStakes = getLowStakesSessions(stu.studentId);
      expect(lowStakes.length).toBe(8);
      totalLowStakes += lowStakes.length;
    });
    expect(totalLowStakes).toBe(80);
  });

  // ─── 6. Graded Filtering ───────────────────────────────────────────────────
  test('6. Graded filtering returns exactly 40 exam records (4 per student)', () => {
    const students = getStudents();
    let totalGraded = 0;
    students.forEach((stu) => {
      const graded = getGradedSessions(stu.studentId);
      expect(graded.length).toBe(4);
      totalGraded += graded.length;
    });
    expect(totalGraded).toBe(40);
  });

  // ─── 7. Student Detail Query ───────────────────────────────────────────────
  test('7. getStudent returns accurate aggregates and primary device', () => {
    const s1 = getStudent('S001');
    expect(s1).toBeDefined();
    expect(s1?.lowStakesCount).toBe(8);
    expect(s1?.gradedCount).toBe(4);
    expect(s1?.devices).toContain('web_desktop');
    expect(s1?.devices).toContain('web_laptop');
    expect(s1?.devices).toContain('mobile');
    expect(s1?.avgResponseTimeSec).toBeGreaterThan(0);
    expect(s1?.latestSessionDate).toBe('2026-01-18 13:35:00');
  });

  // ─── 8. Session Detail Query & Interaction Telemetry ───────────────────────
  test('8. getSession returns question interactions with paste, burst, and speed telemetry', () => {
    // S003_EX02 is a known flagged mock session
    const session = getSession('S003_EX02');
    expect(session).toBeDefined();
    expect(session?.studentId).toBe('S003');
    expect(session?.sessionType).toBe('graded');
    expect(session?.hasPasteEvent).toBe(true);
    expect(session?.hasBurstEvent).toBe(true);
    expect(session?.humanReviewLabel).toBe('flagged_mock');

    const records = getRecordsForSession('S003_EX02');
    expect(records.length).toBe(1);
    expect(records[0].pointerAvgSpeedPxS).toBe(654.1);
    expect(records[0].revisionCount).toBe(5);
    expect(records[0].pasteDetected).toBe(true);
    expect(records[0].characterBurstFlag).toBe(true);
  });

  // ─── 9. Dynamic Filtering Logic ────────────────────────────────────────────
  test('9. Dynamic multi-attribute filtering works across session type and device', () => {
    const student = getStudent('S001')!;
    const desktopSessions = student.sessions.filter((s: DatasetSession) => s.deviceType === 'web_desktop');
    const mobileSessions = student.sessions.filter((s: DatasetSession) => s.deviceType === 'mobile');
    const gradedDesktop = student.sessions.filter(
      (s: DatasetSession) => s.sessionType === 'graded' && s.deviceType === 'web_desktop'
    );

    expect(desktopSessions.length).toBeGreaterThan(0);
    expect(mobileSessions.length).toBeGreaterThan(0);
    expect(gradedDesktop.length).toBe(3); // EX01, EX02, EX03
  });

  // ─── 10. Data Validation Engine ────────────────────────────────────────────
  test('10. Data validation verifies 100% clean prototype data and catches corrupted records', () => {
    // 10a: Validate clean dataset
    const status = getDatasetStatus();
    expect(status.dataQualityStatus).toBe('100% Valid');
    expect(status.validationReport.isValid).toBe(true);
    expect(status.validationReport.errorCount).toBe(0);
    expect(status.sourceComposition).toBe(SOURCE_DATASET_COMPOSITION);

    // 10b: Validate synthetic corrupted records
    const corruptRecords: PatentRecord[] = [
      {
        record_id: 'R9999',
        student_id: '', // Missing student_id
        session_id: 'S999_LS01',
        session_type: 'invalid_type' as any, // Invalid session_type
        question_id: 'q999',
        timestamp: 'invalid-date', // Malformed date
        question_difficulty: 2.5, // Difficulty > 1.0
        response_time_sec: -10, // Negative response time
        answer_revision_count: 0,
        answer_revision_time_sec: 0,
        correctness: 1,
        pointer_distance_px: 100,
        pointer_avg_speed_px_s: 100,
        scroll_distance_px: 100,
        scroll_events: 1,
        paste_detected: 99 as any, // Invalid binary
        character_burst_flag: 99 as any, // Invalid binary
        device_type: 'desktop',
        session_position: 1,
        time_of_day: '10:00',
        source_dataset: 'test',
        human_review_label: 'clean_mock',
      },
      {
        record_id: 'R9999', // Duplicate record_id
        student_id: 'S999',
        session_id: 'S999_LS02',
        session_type: 'low_stakes',
        question_id: 'q998',
        timestamp: '2026-01-01 10:00:00',
        question_difficulty: 0.5,
        response_time_sec: 20,
        answer_revision_count: 0,
        answer_revision_time_sec: 0,
        correctness: 1,
        pointer_distance_px: 100,
        pointer_avg_speed_px_s: 100,
        scroll_distance_px: 100,
        scroll_events: 1,
        paste_detected: 0,
        character_burst_flag: 0,
        device_type: 'desktop',
        session_position: 2,
        time_of_day: '10:00',
        source_dataset: 'test',
        human_review_label: 'clean_mock',
      },
    ];

    const corruptValidation = validateDataset(corruptRecords);
    expect(corruptValidation.isValid).toBe(false);
    expect(corruptValidation.errorCount).toBeGreaterThanOrEqual(4);
    expect(corruptValidation.duplicateCount).toBe(1);

    const issueFields = corruptValidation.issues.map((i: DataValidationIssue) => i.field);
    expect(issueFields).toContain('student_id');
    expect(issueFields).toContain('session_type');
    expect(issueFields).toContain('response_time_sec');
    expect(issueFields).toContain('paste_detected');
    expect(issueFields).toContain('character_burst_flag');
    expect(issueFields).toContain('record_id');
  });
});
