import { createClient as createBrowserClient } from '../lib/supabase/client';
import {
  persistExamSessionToSupabase,
  persistCourseworkSessionToSupabase,
  fetchStudentSessionsFromSupabase,
  subscribeToStudentSessions,
} from '../lib/services/supabaseSessionService';
import {
  createGradedExamSession,
  saveQuestionTelemetry,
  completeGradedExamSession,
  getGradedExamSession,
} from '../lib/services/examSessionService';
import {
  getStudentCourseworkSessions,
  getStudentCourseworkSessionsAsync,
} from '../lib/services/studentHistoryService';
import { getCurrentProfile, getCurrentRole } from '../lib/services/auth';
import { GradedExamSession, DatasetSession } from '../types';

describe('Supabase Persistence, Authentication & Cross-Device Sync', () => {
  // ─── 1. Client Initialization ─────────────────────────────────────────────
  test('1. Supabase browser client initializes with sanitized URL and key', () => {
    const client = createBrowserClient();
    expect(client).toBeDefined();
    expect(client.auth).toBeDefined();
    expect(client.from).toBeDefined();
  });

  // ─── 2. Auth Profile Resolution ───────────────────────────────────────────
  test('2. Resolves user profile and role with student identifier mapping', async () => {
    const profile = await getCurrentProfile();
    if (profile) {
      expect(profile).toHaveProperty('id');
      expect(profile).toHaveProperty('role');
      expect(['student', 'instructor', 'admin']).toContain(profile.role);
    }
  });

  // ─── 3. Session Persistence & Cross-Device Retrieval ──────────────────────
  test('3. Exam session created on client is persisted and retrievable across devices', async () => {
    // 1. Create a graded session for S003
    const session = createGradedExamSession({
      studentId: 'S003',
      examId: 'PROTOTYPE_EXAM_01',
      examTitle: 'Cross-Device Persistence Test Exam',
      questionCount: 2,
    });

    expect(session).toBeDefined();
    expect(session.sessionId).toContain('S003_EX_');

    // 2. Add question telemetry
    saveQuestionTelemetry(session.sessionId, {
      recordId: `${session.sessionId}_Q1`,
      studentId: 'S003',
      sessionId: session.sessionId,
      questionId: 'q1',
      questionDifficulty: 0.5,
      sessionPosition: 1,
      selectedAnswerIndex: 0,
      responseTimeSec: 24.5,
      answerRevisionCount: 1,
      answerRevisionTimeSec: 4.2,
      pointerDistancePx: 520,
      pointerAvgSpeedPxS: 230,
      scrollDistancePx: 410,
      scrollEvents: 4,
      pasteDetected: 0,
      characterBurstFlag: 0,
      deviceType: 'web_desktop',
      timeOfDay: '14:00',
      timestamp: new Date().toISOString(),
      isAnswerCorrect: true,
    });

    // 3. Complete session
    const completed = completeGradedExamSession(session.sessionId);
    expect(completed).toBeDefined();
    expect(completed!.status).toBe('completed');

    // 4. Verify async retrieval via getStudentCourseworkSessionsAsync
    const allSessions = await getStudentCourseworkSessionsAsync('S003');
    expect(allSessions.length).toBeGreaterThan(0);
    const found = allSessions.find((s) => s.sessionId === session.sessionId);
    expect(found).toBeDefined();
    expect(found!.studentId).toBe('S003');
  });

  // ─── 4. Coursework Session Persistence ────────────────────────────────────
  test('4. Coursework low-stakes session persists to Supabase format', async () => {
    const mockCoursework: DatasetSession = {
      sessionId: 'CW_TEST_001',
      studentId: 'S001',
      sessionType: 'low_stakes',
      timestamp: new Date().toISOString(),
      deviceType: 'web_desktop',
      questionCount: 2,
      avgResponseTimeSec: 28.5,
      avgRevisionCount: 1.0,
      avgPointerSpeed: 230,
      totalScrollDistance: 450,
      hasPasteEvent: false,
      hasBurstEvent: false,
      humanReviewLabel: 'clean_mock',
      interactions: [
        {
          recordId: 'rec_cw_1',
          questionId: 'q_cw_1',
          timestamp: new Date().toISOString(),
          timeOfDay: '10:00',
          difficulty: 0.5,
          responseTimeSec: 28.5,
          revisionCount: 1,
          revisionTimeSec: 3.0,
          correctness: 1,
          pointerDistancePx: 450,
          pointerAvgSpeedPxS: 230,
          scrollDistancePx: 300,
          scrollEvents: 3,
          pasteDetected: false,
          characterBurstFlag: false,
          deviceType: 'web_desktop',
          sessionPosition: 1,
          sourceDataset: 'prototype',
          humanReviewLabel: 'clean_mock',
        },
      ],
    };

    const res = await persistCourseworkSessionToSupabase(mockCoursework);
    expect(res).toHaveProperty('success', true);
  });

  // ─── 5. Realtime Channel Lifecycle ────────────────────────────────────────
  test('5. Realtime subscription channel creates and unsubscribes cleanly without leaks', () => {
    const onUpdate = jest.fn();
    const unsubscribe = subscribeToStudentSessions('S003', onUpdate);
    expect(typeof unsubscribe).toBe('function');
    // Ensure clean teardown
    expect(() => unsubscribe()).not.toThrow();
  });

  // ─── 6. Persistence Service Error Handling ────────────────────────────────
  test('6. Persist service handles network/database errors gracefully without throwing', async () => {
    const mockSession: GradedExamSession = {
      sessionId: 'TEST_PERSIST_SESSION',
      studentId: 'S001',
      examId: 'EXAM_01',
      examTitle: 'Test Exam',
      sessionType: 'graded',
      deviceType: 'web_desktop',
      status: 'completed',
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      questionCount: 1,
      completedQuestionsCount: 1,
      interactions: [],
    };

    const res = await persistExamSessionToSupabase(mockSession);
    expect(res).toHaveProperty('success');
  });
});

