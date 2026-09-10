/**
 * ExamGuard — Real-Time Behavioral Intelligence, Sequence Signatures & Scenarios A–F
 * 
 * Test Suite validating:
 * 1. All 9 Core Behavioral Features Preserved & Evaluated
 * 2. Behavioral Sequence Signatures (Order, timing, transitions, entropy, n-grams)
 * 3. Real-Time Integrity Opportunity Events (Visibility, blur, fullscreen, paste, copy)
 * 4. Continuous Behavioral Consistency Score (0–100)
 * 5. Context-Aware Behavioral State Inference (Observable states, zero emotion claims)
 * 6. Temporal Persistence (Isolated vs Short-lived vs Persistent)
 * 7. Scenarios A through F
 */

import {
  createSequenceEvent,
  extractSequenceSignature,
  calculateSequenceSimilarity,
  generateSyntheticSequenceEvents,
  ALL_BEHAVIORAL_EVENTS,
} from '../lib/services/behavioralSequenceEngine';
import {
  inferBehavioralState,
  calculateContinuousConsistency,
  evaluateTemporalPersistence,
  buildExamEventTimeline,
} from '../lib/services/behavioralStateEngine';
import {
  createInitialTelemetryState,
  finalizeQuestionTelemetry,
  recordMCQSelection,
  recordMultiSelectToggle,
  recordTextChange,
  recordCodeEdit,
  recordCodeRun,
  recordPasteEvent,
  recordIntegrityOpportunity,
  recordSequenceEvent,
  calculateInsertionRate,
} from '../lib/services/examFeatureExtractor';
import {
  analyzeQuestion,
  analyzeSession,
  clearAnalysisCache,
} from '../lib/services/behavioralAnalysisService';
import { generateRiskReport } from '../lib/services/behavioralReportService';
import { getStudentBaseline } from '../lib/services/personalizedBaselineService';
import {
  createGradedExamSession,
  saveQuestionTelemetry,
  completeGradedExamSession,
  getGradedExamSession,
} from '../lib/services/examSessionService';
import {
  ExamQuestionTelemetry,
  GradedExamSession,
  IntegrityOpportunityEvent,
  BehavioralSequenceEvent,
} from '../types';

describe('Real-Time Behavioral Intelligence & Sequence Signatures', () => {
  beforeEach(() => {
    clearAnalysisCache();
  });

  // ─── 1. Preservation of All 9 Core Features ───────────────────────────────
  test('1. All 9 low-level behavioral measurements remain strictly captured and preserved', () => {
    const state = createInitialTelemetryState('Q1', 1, 0.5, 'mcq');
    
    // Simulate user interaction
    recordMCQSelection(state, 1);
    recordMCQSelection(state, 2); // 1 revision
    state.pointerDistancePx = 450;
    state.scrollDistancePx = 300;
    state.scrollEventsCount = 3;
    recordPasteEvent(state);
    
    // Fast insertion burst
    const burst = calculateInsertionRate(70, 200);
    expect(burst.isBurst).toBe(true);
    state.characterBurstFlag = 1;

    const telemetry = finalizeQuestionTelemetry(state, 'S003_TEST_EXAM', 'S003', 'web_desktop', true);

    // 1. Response Time
    expect(telemetry).toHaveProperty('responseTimeSec');
    expect(telemetry.responseTimeSec).toBeGreaterThan(0);

    // 2. Answer Revision Count
    expect(telemetry).toHaveProperty('answerRevisionCount');
    expect(telemetry.answerRevisionCount).toBe(1);

    // 3. Answer Revision Time
    expect(telemetry).toHaveProperty('answerRevisionTimeSec');
    expect(typeof telemetry.answerRevisionTimeSec).toBe('number');

    // 4. Pointer Distance
    expect(telemetry).toHaveProperty('pointerDistancePx');
    expect(telemetry.pointerDistancePx).toBe(450);

    // 5. Pointer Average Speed
    expect(telemetry).toHaveProperty('pointerAvgSpeedPxS');
    expect(telemetry.pointerAvgSpeedPxS).toBeGreaterThan(0);

    // 6. Scroll Distance
    expect(telemetry).toHaveProperty('scrollDistancePx');
    expect(telemetry.scrollDistancePx).toBe(300);

    // 7. Scroll Events
    expect(telemetry).toHaveProperty('scrollEvents');
    expect(telemetry.scrollEvents).toBe(3);

    // 8. Paste Detected
    expect(telemetry).toHaveProperty('pasteDetected');
    expect(telemetry.pasteDetected).toBe(1);

    // 9. Character Burst Flag
    expect(telemetry).toHaveProperty('characterBurstFlag');
    expect(telemetry.characterBurstFlag).toBe(1);
  });

  // ─── 2. Behavioral Sequence Signature Engine ──────────────────────────────
  test('2. Sequence Signature accurately captures action ordering, inter-event timing, transitions, and entropy', () => {
    const t0 = 1000000;
    const events: BehavioralSequenceEvent[] = [
      createSequenceEvent('question_view', null, t0, 'Q1', 1),
      createSequenceEvent('pause', t0, t0 + 4000, 'Q1', 1, 4000),
      createSequenceEvent('typing', t0 + 4000, t0 + 5500, 'Q1', 1, 1500),
      createSequenceEvent('answer_select', t0 + 5500, t0 + 6700, 'Q1', 1, 1200),
      createSequenceEvent('answer_change', t0 + 6700, t0 + 7400, 'Q1', 1, 700),
      createSequenceEvent('revision', t0 + 7400, t0 + 7500, 'Q1', 1, 100),
      createSequenceEvent('navigation', t0 + 7500, t0 + 8100, 'Q1', 1, 600),
    ];

    const signature = extractSequenceSignature(events, 'TEST_SESSION', 'S003');

    expect(signature.totalEvents).toBe(7);
    expect(signature.transitionMatrix['question_view']).toBeDefined();
    expect(signature.transitionMatrix['question_view']['pause']).toBe(1);
    expect(signature.transitionMatrix['pause']['typing']).toBe(1);
    expect(signature.topTransitions.length).toBeGreaterThan(0);
    expect(signature.transitionEntropy).toBeGreaterThan(0);
    expect(signature.avgInterEventLatencyMs).toBeGreaterThan(0);
    expect(signature.commonNGrams.length).toBeGreaterThan(0);

    // Test sequence similarity against identical baseline
    const similarity = calculateSequenceSimilarity(signature, signature);
    expect(similarity).toBeCloseTo(1.0, 2);
  });

  // ─── 3. SCENARIO A — Normal Student ───────────────────────────────────────
  test('3. SCENARIO A: Normal student matching personal baseline -> High Consistency (>=80), Stable Interaction, Low Concern', () => {
    // S003 has an established baseline
    const baseline = getStudentBaseline('S003');
    expect(baseline.maturityStatus).toBe('established');

    const expResp = baseline.overallFeatures.response_time_sec.expectedValue; // ~23s
    const expRev = baseline.overallFeatures.answer_revision_count.expectedValue; // ~0.7

    const normalTelemetries: ExamQuestionTelemetry[] = [1, 2, 3].map((pos) => ({
      recordId: `S003_SCEN_A_Q${pos}`,
      studentId: 'S003',
      sessionId: 'S003_SCEN_A_EXAM',
      questionId: `q${pos}`,
      questionDifficulty: 0.5,
      sessionPosition: pos,
      selectedAnswerIndex: 0,
      responseTimeSec: expResp + 0.5,
      answerRevisionCount: Math.round(expRev),
      answerRevisionTimeSec: 2.0,
      pointerDistancePx: 500,
      pointerAvgSpeedPxS: 220,
      scrollDistancePx: 380,
      scrollEvents: 3,
      pasteDetected: 0,
      characterBurstFlag: 0,
      deviceType: 'web_desktop',
      timeOfDay: '14:00',
      timestamp: new Date().toISOString(),
      isAnswerCorrect: true,
    }));

    const consistency = calculateContinuousConsistency(normalTelemetries, baseline);
    expect(consistency.overallScore).toBeGreaterThanOrEqual(80);

    const state = inferBehavioralState({
      responseTimeSec: expResp,
      expectedResponseTimeSec: expResp,
      revisionCount: Math.round(expRev),
      expectedRevisionCount: expRev,
      questionDifficulty: 0.5,
      pasteDetected: false,
      characterBurst: false,
    });

    expect(state.state).toBe('Stable Interaction');

    const persistence = evaluateTemporalPersistence(normalTelemetries, []);
    expect(persistence.persistenceTier).toBe('isolated');
  });

  // ─── 4. SCENARIO B — Nervous / Uncertain Student ──────────────────────────
  test('4. SCENARIO B: Nervous/Uncertain student with high response times and revisions -> Inferred as Hesitation / Increased Uncertainty, NOT Cheating', () => {
    const baseline = getStudentBaseline('S003');
    const expResp = baseline.overallFeatures.response_time_sec.expectedValue;
    const expRev = baseline.overallFeatures.answer_revision_count.expectedValue;

    // Slower response time and 3 revisions on a difficult question
    const state = inferBehavioralState({
      responseTimeSec: expResp * 1.8,
      expectedResponseTimeSec: expResp,
      revisionCount: 3,
      expectedRevisionCount: Math.round(expRev),
      questionDifficulty: 0.8,
      pasteDetected: false,
      characterBurst: false,
    });

    expect(['Hesitation', 'Increased Uncertainty', 'Possible Confusion']).toContain(state.state);
    // Explicitly confirm it is NOT an automated cheating verdict
    expect(state.state).not.toBe('Abrupt Behavioral Change');
    expect(state.reasoning).not.toContain('cheating');
  });

  // ─── 5. SCENARIO C — Isolated Integrity Event ─────────────────────────────
  test('5. SCENARIO C: Single isolated fullscreen exit or tab blur -> Recorded event, isolated persistence, limited impact', () => {
    const isolatedEvents: IntegrityOpportunityEvent[] = [
      {
        id: 'INT_01',
        eventType: 'fullscreen_exit',
        timestamp: new Date().toISOString(),
        questionId: 'q1',
        sessionPosition: 1,
        isIsolated: true,
        occurrenceIndex: 1,
        contextSummary: 'Exam window exited fullscreen mode (isolated)',
      },
    ];

    const normalTelemetries: ExamQuestionTelemetry[] = [1, 2, 3, 4].map((pos) => ({
      recordId: `S003_SCEN_C_Q${pos}`,
      studentId: 'S003',
      sessionId: 'S003_SCEN_C_EXAM',
      questionId: `q${pos}`,
      questionDifficulty: 0.5,
      sessionPosition: pos,
      selectedAnswerIndex: 0,
      responseTimeSec: 24.0,
      answerRevisionCount: 1,
      answerRevisionTimeSec: 2.0,
      pointerDistancePx: 500,
      pointerAvgSpeedPxS: 220,
      scrollDistancePx: 380,
      scrollEvents: 3,
      pasteDetected: 0,
      characterBurstFlag: 0,
      deviceType: 'web_desktop',
      timeOfDay: '14:00',
      timestamp: new Date().toISOString(),
      isAnswerCorrect: true,
    }));

    const persistence = evaluateTemporalPersistence(normalTelemetries, isolatedEvents);
    expect(persistence.persistenceTier).toBe('isolated');
    expect(persistence.isolatedEventCount).toBe(1);
    expect(persistence.repeatedEventCount).toBe(0);
  });

  // ─── 6. SCENARIO D — Persistent Suspicious Sequence ───────────────────────
  test('6. SCENARIO D: Persistent suspicious sequence (repeated navigations + paste attempt + burst insertion) -> Inferred as Abrupt Behavioral Change & Persistent Deviation', () => {
    const suspiciousEvents: IntegrityOpportunityEvent[] = [
      {
        id: 'INT_D1',
        eventType: 'navigation_away',
        timestamp: new Date(Date.now() - 40000).toISOString(),
        questionId: 'q2',
        sessionPosition: 2,
        isIsolated: false,
        occurrenceIndex: 2,
        contextSummary: 'Navigation away from question window (Occurrence 2)',
      },
      {
        id: 'INT_D2',
        eventType: 'paste_attempt',
        timestamp: new Date(Date.now() - 20000).toISOString(),
        questionId: 'q2',
        sessionPosition: 2,
        isIsolated: true,
        occurrenceIndex: 1,
        contextSummary: 'Clipboard paste attempt intercepted on question',
      },
    ];

    const suspiciousTelemetries: ExamQuestionTelemetry[] = [
      {
        recordId: 'S003_SCEN_D_Q1',
        studentId: 'S003',
        sessionId: 'S003_SCEN_D_EXAM',
        questionId: 'q1',
        questionDifficulty: 0.5,
        sessionPosition: 1,
        selectedAnswerIndex: 0,
        responseTimeSec: 24.0,
        answerRevisionCount: 1,
        answerRevisionTimeSec: 2.0,
        pointerDistancePx: 500,
        pointerAvgSpeedPxS: 220,
        scrollDistancePx: 380,
        scrollEvents: 3,
        pasteDetected: 0,
        characterBurstFlag: 0,
        deviceType: 'web_desktop',
        timeOfDay: '14:00',
        timestamp: new Date().toISOString(),
        isAnswerCorrect: true,
      },
      {
        recordId: 'S003_SCEN_D_Q2',
        studentId: 'S003',
        sessionId: 'S003_SCEN_D_EXAM',
        questionId: 'q2',
        questionDifficulty: 0.7,
        sessionPosition: 2,
        selectedAnswerIndex: 0,
        responseTimeSec: 4.2, // Superhuman speed
        answerRevisionCount: 0,
        answerRevisionTimeSec: 0,
        pointerDistancePx: 100,
        pointerAvgSpeedPxS: 25,
        scrollDistancePx: 50,
        scrollEvents: 1,
        pasteDetected: 1,
        characterBurstFlag: 1,
        deviceType: 'web_desktop',
        timeOfDay: '14:02',
        timestamp: new Date().toISOString(),
        isAnswerCorrect: true,
      },
    ];

    const state = inferBehavioralState({
      responseTimeSec: 4.2,
      expectedResponseTimeSec: 25.0,
      revisionCount: 0,
      expectedRevisionCount: 1,
      questionDifficulty: 0.7,
      pasteDetected: true,
      characterBurst: true,
      sequenceSimilarity: 0.35,
      rapidNavigationsInWindow: 2,
    });

    expect(state.state).toBe('Abrupt Behavioral Change');

    const persistence = evaluateTemporalPersistence(suspiciousTelemetries, suspiciousEvents);
    expect(persistence.persistenceTier).toBe('persistent');
    expect(persistence.persistenceScore).toBeGreaterThanOrEqual(80);
  });

  // ─── 7. SCENARIO E — Historically Normal Student Cheats During Exam ─────────
  test('7. SCENARIO E: Student with normal historical baseline cheats in current exam -> Detected by real-time behavioral telemetry', () => {
    // S003 has an established clean low-stakes baseline
    const baseline = getStudentBaseline('S003');
    expect(baseline.maturityStatus).toBe('established');

    // Create a graded session for S003 containing paste & character burst
    const session = createGradedExamSession({
      studentId: 'S003',
      examId: 'SCENARIO_E_EXAM',
      examTitle: 'Scenario E Validation Exam',
      questionCount: 2,
    });

    // Q1: Normal interaction
    saveQuestionTelemetry(session.sessionId, {
      recordId: `${session.sessionId}_Q1`,
      studentId: 'S003',
      sessionId: session.sessionId,
      questionId: 'q1',
      questionDifficulty: 0.5,
      sessionPosition: 1,
      selectedAnswerIndex: 0,
      responseTimeSec: 23.5,
      answerRevisionCount: 1,
      answerRevisionTimeSec: 3.0,
      pointerDistancePx: 520,
      pointerAvgSpeedPxS: 225,
      scrollDistancePx: 400,
      scrollEvents: 4,
      pasteDetected: 0,
      characterBurstFlag: 0,
      deviceType: 'web_desktop',
      timeOfDay: '14:00',
      timestamp: new Date().toISOString(),
      isAnswerCorrect: true,
    });

    // Q2: Pasted external code with burst insertion
    saveQuestionTelemetry(session.sessionId, {
      recordId: `${session.sessionId}_Q2`,
      studentId: 'S003',
      sessionId: session.sessionId,
      questionId: 'q2',
      questionDifficulty: 0.9,
      sessionPosition: 2,
      selectedAnswerIndex: 0,
      responseTimeSec: 3.8,
      answerRevisionCount: 0,
      answerRevisionTimeSec: 0,
      pointerDistancePx: 80,
      pointerAvgSpeedPxS: 20,
      scrollDistancePx: 20,
      scrollEvents: 1,
      pasteDetected: 1,
      characterBurstFlag: 1,
      deviceType: 'web_desktop',
      timeOfDay: '14:01',
      timestamp: new Date().toISOString(),
      isAnswerCorrect: true,
    });

    const completed = completeGradedExamSession(session.sessionId);
    expect(completed).toBeDefined();
    expect(completed!.hasPasteEvent).toBe(true);
    expect(completed!.hasBurstEvent).toBe(true);

    // Run Stage 8 Personalized Analysis
    const analysis = analyzeSession(session.sessionId, 'instructor');
    expect(analysis.overallScore).toBeGreaterThanOrEqual(60); // Flagged for review
    expect(analysis.riskLevel).toBe('high');

    // Generate Stage 9 Explainable Risk Report
    const report = generateRiskReport(session.sessionId, 'instructor');
    expect(report.overallScore).toBeGreaterThanOrEqual(60);
    expect(report.recommendedAction).toContain('Human review recommended');
    expect(report.behavioralConsistencyScore).toBeLessThan(75);
    expect(report.examEventTimeline).toBeDefined();
    expect(report.examEventTimeline!.length).toBeGreaterThan(0);
  });

  // ─── 8. SCENARIO F — Cross-Device Data Availability ────────────────────────
  test('8. SCENARIO F: Session created on Device A retains sequence signature, integrity events, and state in storage', () => {
    const session = createGradedExamSession({
      studentId: 'S003',
      examId: 'CROSS_DEV_01',
      examTitle: 'Cross-Device Persistence Test',
      questionCount: 1,
      deviceType: 'web_laptop',
    });

    saveQuestionTelemetry(session.sessionId, {
      recordId: `${session.sessionId}_Q1`,
      studentId: 'S003',
      sessionId: session.sessionId,
      questionId: 'q1',
      questionDifficulty: 0.5,
      sessionPosition: 1,
      selectedAnswerIndex: 0,
      responseTimeSec: 22.0,
      answerRevisionCount: 1,
      answerRevisionTimeSec: 2.5,
      pointerDistancePx: 480,
      pointerAvgSpeedPxS: 215,
      scrollDistancePx: 350,
      scrollEvents: 3,
      pasteDetected: 0,
      characterBurstFlag: 0,
      deviceType: 'web_laptop',
      timeOfDay: '15:00',
      timestamp: new Date().toISOString(),
      isAnswerCorrect: true,
    });

    const completed = completeGradedExamSession(session.sessionId);
    expect(completed).toBeDefined();

    // Verify session retrieval via getGradedExamSession
    const retrieved = getGradedExamSession(session.sessionId);
    expect(retrieved).toBeDefined();
    expect(retrieved!.sessionId).toBe(session.sessionId);
    expect(retrieved!.sequenceSignature).toBeDefined();
    expect(retrieved!.behavioralConsistencyScore).toBeDefined();
    expect(retrieved!.behavioralStateInference).toBeDefined();
    expect(retrieved!.examEventTimeline).toBeDefined();
  });
});
