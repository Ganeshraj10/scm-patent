import {
  analyzeSession,
  analyzeQuestion,
  BEHAVIORAL_WEIGHTS_CONFIG,
  RISK_THRESHOLDS,
  clearAnalysisCache,
} from '../lib/services/behavioralAnalysisService';
import { getStudentBaseline } from '../lib/services/personalizedBaselineService';
import { ExamQuestionTelemetry } from '../types';

describe('Stage 8: Personalized Behavioral Deviation & Risk Analysis Engine', () => {
  beforeEach(() => {
    clearAnalysisCache();
  });

  // ─── TEST 1: S003 Normal Graded Session (Low Deviation) ───────────────────
  test('TEST 1: S003 normal exam session produces low deviation within personal pattern', () => {
    const analysis = analyzeSession('S003_EX01', 'instructor');

    expect(analysis.studentId).toBe('S003');
    expect(analysis.sessionId).toBe('S003_EX01');
    expect(analysis.modelStatus).toBe('established');
    expect(analysis.confidence).toBe('high');
    expect(analysis.riskLevel).toBe('low');
    expect(analysis.overallScore).toBeLessThan(RISK_THRESHOLDS.LOW_MAX);
    expect(analysis.riskStatusLabel).toBe('Within Personal Pattern');
    expect(analysis.questionAnalyses.length).toBeGreaterThan(0);
  });

  // ─── TEST 2: S003 Anomalous Demo Session (High Deviation) ──────────────────
  test('TEST 2: S003 anomalous demo exam produces higher deviation and Review Recommended status', () => {
    const analysis = analyzeSession('S003_EX02', 'instructor');

    expect(analysis.studentId).toBe('S003');
    expect(analysis.sessionId).toBe('S003_EX02');
    expect(analysis.overallScore).toBeGreaterThanOrEqual(RISK_THRESHOLDS.HIGH_MIN);
    expect(analysis.riskLevel).toBe('high');
    expect(analysis.riskStatusLabel).toBe('Review Recommended');
    expect(analysis.summaryExplanation).toContain('Review is recommended');
  });

  // ─── TEST 3: S001 Developing Baseline ─────────────────────────────────────
  test('TEST 3: S001 developing baseline produces moderate confidence analysis with developing label', () => {
    const analysis = analyzeSession('S001_EX01', 'instructor');

    expect(analysis.studentId).toBe('S001');
    expect(analysis.modelStatus).toBe('developing');
    expect(analysis.confidence).toBe('moderate');
    expect(analysis.confidenceLabel).toContain('Developing Baseline');
    expect(analysis.trainingSessionCount).toBe(4);
  });

  // ─── TEST 4: S002 Developing Baseline with Distinct Personal Pattern ──────
  test('TEST 4: S002 developing baseline evaluates against S002 deliberate personal pattern', () => {
    const analysisS002 = analyzeSession('S002_EX01', 'instructor');
    const analysisS001 = analyzeSession('S001_EX01', 'instructor');

    expect(analysisS002.studentId).toBe('S002');
    expect(analysisS001.studentId).toBe('S001');

    // Both are evaluated independently
    expect(analysisS002.trainingSessionCount).toBe(4);
    expect(analysisS001.trainingSessionCount).toBe(4);

    const expTimeS002 = analysisS002.featureDeviations['response_time_sec'].expectedValue;
    const expTimeS001 = analysisS001.featureDeviations['response_time_sec'].expectedValue;

    // S002's personal baseline expectation is distinct and deliberate
    expect(expTimeS002).not.toEqual(expTimeS001);
  });

  // ─── TEST 5: S004 Cold Start Protection (Insufficient Personal History) ───
  test('TEST 5: S004 cold start is protected from false high-risk conclusions', () => {
    const analysis = analyzeSession('S004_EX01', 'instructor');

    expect(analysis.studentId).toBe('S004');
    expect(analysis.modelStatus).toBe('cold_start');
    expect(analysis.riskLevel).toBe('limited_analysis');
    expect(analysis.riskStatusLabel).toBe('Insufficient Personal History');
    expect(analysis.confidence).toBe('low');
    expect(analysis.overallScore).toBeLessThanOrEqual(25); // Strictly capped
    expect(analysis.warnings.some((w) => w.includes('Insufficient'))).toBe(true);
  });

  // ─── TEST 6: Unexpected Device Context ─────────────────────────────────────
  test('TEST 6: Unexpected device triggers contextual device-change signal without misconduct label', () => {
    const baseline = getStudentBaseline('S003');
    const telemetry: ExamQuestionTelemetry = {
      recordId: 'TEST_Q01',
      studentId: 'S003',
      sessionId: 'TEST_SESSION_DEV',
      questionId: 'q101',
      questionDifficulty: 0.5,
      sessionPosition: 1,
      selectedAnswerIndex: 0,
      responseTimeSec: 25.0,
      answerRevisionCount: 0,
      answerRevisionTimeSec: 0,
      pointerDistancePx: 500,
      pointerAvgSpeedPxS: 220,
      scrollDistancePx: 400,
      scrollEvents: 4,
      pasteDetected: 0,
      characterBurstFlag: 0,
      deviceType: 'unknown_hardware_device',
      timeOfDay: '14:00',
      timestamp: '2026-02-01 14:00:00',
    };

    const questionAnalysis = analyzeQuestion(telemetry, baseline, 'unknown_hardware_device');
    expect(questionAnalysis).toBeDefined();
    expect(questionAnalysis.questionScore).toBeLessThan(RISK_THRESHOLDS.LOW_MAX);
  });

  // ─── TEST 7: Paste Signal Weighted Contribution ───────────────────────────
  test('TEST 7: Paste signal contributes according to configured weight without storing clipboard', () => {
    const baseline = getStudentBaseline('S003');
    const normalTelemetry: ExamQuestionTelemetry = {
      recordId: 'TEST_Q_NORMAL',
      studentId: 'S003',
      sessionId: 'TEST_SESS',
      questionId: 'q101',
      questionDifficulty: 0.5,
      sessionPosition: 1,
      selectedAnswerIndex: 0,
      responseTimeSec: 25.0,
      answerRevisionCount: 0,
      answerRevisionTimeSec: 0,
      pointerDistancePx: 500,
      pointerAvgSpeedPxS: 220,
      scrollDistancePx: 400,
      scrollEvents: 4,
      pasteDetected: 0,
      characterBurstFlag: 0,
      deviceType: 'web_desktop',
      timeOfDay: '14:00',
      timestamp: '2026-02-01 14:00:00',
    };

    const pasteTelemetry: ExamQuestionTelemetry = {
      ...normalTelemetry,
      pasteDetected: 1,
    };

    const normalRes = analyzeQuestion(normalTelemetry, baseline, 'web_desktop');
    const pasteRes = analyzeQuestion(pasteTelemetry, baseline, 'web_desktop');

    expect(pasteRes.questionScore).toBeGreaterThan(normalRes.questionScore);
    expect(pasteRes.featureDeviations['paste_detected'].observedValue).toBe(1);
    expect((pasteRes.featureDeviations['paste_detected'] as any).clipboardContent).toBeUndefined();
  });

  // ─── TEST 8: Character Burst Independent Signal ────────────────────────────
  test('TEST 8: Character burst contributes independently from paste', () => {
    const baseline = getStudentBaseline('S003');
    const burstTelemetry: ExamQuestionTelemetry = {
      recordId: 'TEST_Q_BURST',
      studentId: 'S003',
      sessionId: 'TEST_SESS',
      questionId: 'q101',
      questionDifficulty: 0.5,
      sessionPosition: 1,
      selectedAnswerIndex: 0,
      responseTimeSec: 25.0,
      answerRevisionCount: 0,
      answerRevisionTimeSec: 0,
      pointerDistancePx: 500,
      pointerAvgSpeedPxS: 220,
      scrollDistancePx: 400,
      scrollEvents: 4,
      pasteDetected: 0, // NO paste
      characterBurstFlag: 1, // Burst detected
      deviceType: 'web_desktop',
      timeOfDay: '14:00',
      timestamp: '2026-02-01 14:00:00',
    };

    const res = analyzeQuestion(burstTelemetry, baseline, 'web_desktop');
    expect(res.featureDeviations['paste_detected'].observedValue).toBe(0);
    expect(res.featureDeviations['character_burst_flag'].observedValue).toBe(1);
    expect(res.featureDeviations['character_burst_flag'].status).toBe('signal_triggered');
  });

  // ─── TEST 9: Small Paste without Burst ─────────────────────────────────────
  test('TEST 9: Small paste produces paste_detected = 1 while burst remains 0', () => {
    const baseline = getStudentBaseline('S003');
    const smallPasteTelemetry: ExamQuestionTelemetry = {
      recordId: 'TEST_Q_SMALL_PASTE',
      studentId: 'S003',
      sessionId: 'TEST_SESS',
      questionId: 'q101',
      questionDifficulty: 0.5,
      sessionPosition: 1,
      selectedAnswerIndex: 0,
      responseTimeSec: 25.0,
      answerRevisionCount: 0,
      answerRevisionTimeSec: 0,
      pointerDistancePx: 500,
      pointerAvgSpeedPxS: 220,
      scrollDistancePx: 400,
      scrollEvents: 4,
      pasteDetected: 1,
      characterBurstFlag: 0,
      deviceType: 'web_desktop',
      timeOfDay: '14:00',
      timestamp: '2026-02-01 14:00:00',
    };

    const res = analyzeQuestion(smallPasteTelemetry, baseline, 'web_desktop');
    expect(res.featureDeviations['paste_detected'].observedValue).toBe(1);
    expect(res.featureDeviations['character_burst_flag'].observedValue).toBe(0);
  });

  // ─── TEST 10: Missing/Incomplete Feature Robustness ────────────────────────
  test('TEST 10: Missing features do not cause errors and fallback safely', () => {
    const baseline = getStudentBaseline('S003');
    const incompleteTelemetry: ExamQuestionTelemetry = {
      recordId: 'TEST_Q_INCOMPLETE',
      studentId: 'S003',
      sessionId: 'TEST_SESS',
      questionId: 'q101',
      questionDifficulty: 0.5,
      sessionPosition: 1,
      selectedAnswerIndex: 0,
      responseTimeSec: 25.0,
      answerRevisionCount: 0,
      answerRevisionTimeSec: 0,
      pointerDistancePx: 0, // 0 pointer movement
      pointerAvgSpeedPxS: 0,
      scrollDistancePx: 0,
      scrollEvents: 0,
      pasteDetected: 0,
      characterBurstFlag: 0,
      deviceType: 'web_desktop',
      timeOfDay: '14:00',
      timestamp: '2026-02-01 14:00:00',
    };

    expect(() => analyzeQuestion(incompleteTelemetry, baseline, 'web_desktop')).not.toThrow();
  });

  // ─── TEST 11: Zero Uncertainty Numerical Safety ───────────────────────────
  test('TEST 11: Zero uncertainty features never produce NaN, Infinity, or undefined', () => {
    const baseline = getStudentBaseline('S003');
    const telemetry: ExamQuestionTelemetry = {
      recordId: 'TEST_Q_SAFETY',
      studentId: 'S003',
      sessionId: 'TEST_SESS',
      questionId: 'q101',
      questionDifficulty: 0.5,
      sessionPosition: 1,
      selectedAnswerIndex: 0,
      responseTimeSec: 25.0,
      answerRevisionCount: 0,
      answerRevisionTimeSec: 0,
      pointerDistancePx: 100,
      pointerAvgSpeedPxS: 50,
      scrollDistancePx: 50,
      scrollEvents: 1,
      pasteDetected: 0,
      characterBurstFlag: 0,
      deviceType: 'web_desktop',
      timeOfDay: '14:00',
      timestamp: '2026-02-01 14:00:00',
    };

    const res = analyzeQuestion(telemetry, baseline, 'web_desktop');
    expect(isNaN(res.questionScore)).toBe(false);
    expect(isFinite(res.questionScore)).toBe(true);

    Object.values(res.featureDeviations).forEach((fd) => {
      expect(isNaN(fd.standardizedDeviation)).toBe(false);
      expect(isFinite(fd.standardizedDeviation)).toBe(true);
      expect(isNaN(fd.difference)).toBe(false);
      expect(isFinite(fd.difference)).toBe(true);
    });
  });

  // ─── TEST 12: Security Access Control ──────────────────────────────────────
  test('TEST 12: Student cannot access another student session analysis', () => {
    // S001 attempting to analyze S003 session
    expect(() => {
      analyzeSession('S003_EX01', 'student', 'S001');
    }).toThrow(/Unauthorized|cannot access/i);
  });
});
