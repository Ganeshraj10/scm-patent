import {
  createGradedExamSession,
  saveQuestionTelemetry,
  completeGradedExamSession,
  getGradedExamSession,
  getAllGradedExamSessions,
} from '../lib/services/examSessionService';
import {
  createInitialTelemetryState,
  finalizeQuestionTelemetry,
} from '../lib/services/examFeatureExtractor';
import { ExamQuestionTelemetry } from '../types';

describe('Stage 6: Graded Examination Environment & Real-Time Feature Capture', () => {
  // ─── 1. Graded Exam Session Creation ────────────────────────────────────────
  test('1. Creates a graded examination session with correct metadata', () => {
    const session = createGradedExamSession({
      studentId: 'S001',
      examId: 'GRADED_MATH_01',
      examTitle: 'Core Mathematics Graded Exam',
      questionCount: 10,
      deviceType: 'web_desktop',
    });

    expect(session.sessionId).toContain('S001_EX_');
    expect(session.studentId).toBe('S001');
    expect(session.sessionType).toBe('graded');
    expect(session.status).toBe('in_progress');
    expect(session.questionCount).toBe(10);
    expect(session.completedQuestionsCount).toBe(0);
    expect(session.interactions).toEqual([]);
  });

  // ─── 2. Client-Side Telemetry State & Derived Feature Extraction ────────────
  test('2. Extracts derived behavioral features per question accurately', () => {
    const state = createInitialTelemetryState('Q01', 1, 0.75);
    state.startTimeMs = Date.now() - 15000; // 15 seconds elapsed
    state.totalTimeMs = 0;

    // Simulate answer selections (Initial A, revised to B, then C)
    state.selectedAnswerIndex = 2; // C
    state.initialAnswerTimeMs = state.startTimeMs + 5000; // at 5s
    state.lastRevisionTimeMs = state.startTimeMs + 12000; // at 12s
    state.revisionCount = 2;

    // Simulate pointer movement
    state.pointerDistancePx = 450.5;
    state.scrollDistancePx = 180.0;
    state.scrollEventsCount = 3;
    state.pasteDetected = 1;
    state.characterBurstFlag = 0;

    const telemetry = finalizeQuestionTelemetry(state, 'S001_EX_TEST', 'S001', 'web_desktop');

    expect(telemetry.questionId).toBe('Q01');
    expect(telemetry.sessionPosition).toBe(1);
    expect(telemetry.questionDifficulty).toBe(0.75);
    expect(telemetry.responseTimeSec).toBeCloseTo(15, -1);
    expect(telemetry.answerRevisionCount).toBe(2);
    expect(telemetry.answerRevisionTimeSec).toBe(7.0); // 12s - 5s
    expect(telemetry.pointerDistancePx).toBe(450.5);
    expect(telemetry.pointerAvgSpeedPxS).toBeGreaterThan(0);
    expect(telemetry.scrollDistancePx).toBe(180.0);
    expect(telemetry.scrollEvents).toBe(3);
    expect(telemetry.pasteDetected).toBe(1);
    expect(telemetry.characterBurstFlag).toBe(0);
    expect(telemetry.deviceType).toBe('web_desktop');
  });

  // ─── 3. Idempotent Question Telemetry Updates (No Duplicates on Revisiting) ─
  test('3. Idempotently updates question telemetry on revisiting without duplicating records', () => {
    const session = createGradedExamSession({
      studentId: 'S001',
      examId: 'GRADED_MATH_01',
      examTitle: 'Core Mathematics Exam',
      questionCount: 5,
      deviceType: 'web_desktop',
    });

    const stateQ1 = createInitialTelemetryState('Q01', 1, 0.4);
    stateQ1.totalTimeMs = 10000;
    stateQ1.selectedAnswerIndex = 0;
    const telem1 = finalizeQuestionTelemetry(stateQ1, session.sessionId, 'S001');

    saveQuestionTelemetry(session.sessionId, telem1);
    let currentSession = getGradedExamSession(session.sessionId)!;
    expect(currentSession.interactions.length).toBe(1);

    // Revisiting Q1 and changing answer
    stateQ1.revisionCount = 1;
    stateQ1.selectedAnswerIndex = 1;
    stateQ1.totalTimeMs = 18000;
    const telem1Updated = finalizeQuestionTelemetry(stateQ1, session.sessionId, 'S001');

    saveQuestionTelemetry(session.sessionId, telem1Updated);
    currentSession = getGradedExamSession(session.sessionId)!;

    // Must STILL have exactly 1 record for Q1, not 2
    expect(currentSession.interactions.length).toBe(1);
    expect(currentSession.interactions[0].answerRevisionCount).toBe(1);
    expect(currentSession.interactions[0].selectedAnswerIndex).toBe(1);
  });

  // ─── 4. Session Completion & Aggregations ────────────────────────────────────
  test('4. Finalizes and completes graded exam session with descriptive aggregates', () => {
    const session = createGradedExamSession({
      studentId: 'S001',
      examId: 'GRADED_MATH_01',
      examTitle: 'Core Mathematics Exam',
      questionCount: 2,
    });

    const telem1: ExamQuestionTelemetry = {
      recordId: `${session.sessionId}_Q01`,
      studentId: 'S001',
      sessionId: session.sessionId,
      questionId: 'Q01',
      questionDifficulty: 0.5,
      sessionPosition: 1,
      selectedAnswerIndex: 0,
      responseTimeSec: 20.0,
      answerRevisionCount: 1,
      answerRevisionTimeSec: 4.0,
      pointerDistancePx: 300,
      pointerAvgSpeedPxS: 15,
      scrollDistancePx: 50,
      scrollEvents: 2,
      pasteDetected: 0,
      characterBurstFlag: 0,
      deviceType: 'web_desktop',
      timeOfDay: '10:00:00',
      timestamp: '2026-08-30 10:00:00',
    };

    const telem2: ExamQuestionTelemetry = {
      recordId: `${session.sessionId}_Q02`,
      studentId: 'S001',
      sessionId: session.sessionId,
      questionId: 'Q02',
      questionDifficulty: 0.8,
      sessionPosition: 2,
      selectedAnswerIndex: 2,
      responseTimeSec: 40.0,
      answerRevisionCount: 3,
      answerRevisionTimeSec: 10.0,
      pointerDistancePx: 600,
      pointerAvgSpeedPxS: 15,
      scrollDistancePx: 100,
      scrollEvents: 4,
      pasteDetected: 1,
      characterBurstFlag: 0,
      deviceType: 'web_desktop',
      timeOfDay: '10:01:00',
      timestamp: '2026-08-30 10:01:00',
    };

    saveQuestionTelemetry(session.sessionId, telem1);
    saveQuestionTelemetry(session.sessionId, telem2);

    const completed = completeGradedExamSession(session.sessionId);
    expect(completed).not.toBeNull();
    expect(completed!.status).toBe('completed');
    expect(completed!.completedAt).toBeDefined();
    expect(completed!.avgResponseTimeSec).toBe(30.0); // (20 + 40) / 2
    expect(completed!.avgRevisionCount).toBe(2.0); // (1 + 3) / 2
    expect(completed!.hasPasteEvent).toBe(true);
  });

  // ─── 5. Privacy & Data Minimization Verification ───────────────────────────
  test('5. Adheres to privacy data minimization: schema contains zero raw streams', () => {
    const session = getGradedExamSession('S001_EX01');
    expect(session).not.toBeNull();

    // Verify question interaction schema does NOT have raw mouse coordinates, audio, video, or clipboard strings
    const q1 = session!.interactions[0];
    expect((q1 as any).rawMousePath).toBeUndefined();
    expect((q1 as any).rawKeystrokes).toBeUndefined();
    expect((q1 as any).clipboardContent).toBeUndefined();
    expect((q1 as any).audioRecording).toBeUndefined();
    expect((q1 as any).videoRecording).toBeUndefined();
  });

  // ─── 6. Instructor Retrieval of Graded Examination Telemetry ───────────────
  test('6. Allows instructor inspection of completed sessions without risk scoring', () => {
    const allSessions = getAllGradedExamSessions();
    expect(allSessions.length).toBeGreaterThan(0);

    const sessionS001 = getGradedExamSession('S001_EX01');
    expect(sessionS001).not.toBeNull();
    expect(sessionS001!.studentId).toBe('S001');
    expect(sessionS001!.sessionType).toBe('graded');
    expect(sessionS001!.interactions.length).toBeGreaterThan(0);

    // Verify features are present
    const q = sessionS001!.interactions[0];
    expect(q.responseTimeSec).toBeGreaterThan(0);
    expect(q.pointerAvgSpeedPxS).toBeGreaterThan(0);
  });
});
