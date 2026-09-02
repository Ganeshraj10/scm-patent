import {
  generateRiskReport,
  getExecutiveSummary,
  getFeatureExplanations,
  getQuestionAnalysis,
  determineFeatureStatusTag,
} from '../lib/services/behavioralReportService';
import { clearAnalysisCache } from '../lib/services/behavioralAnalysisService';

describe('Stage 9: Explainable Behavioral Risk Report Engine', () => {
  beforeEach(() => {
    clearAnalysisCache();
  });

  // ─── 1. S001 Developing Baseline Report ───────────────────────────────────
  test('1. S001 report reflects Developing model status and moderate confidence', () => {
    const report = generateRiskReport('S001_EX01', 'instructor');

    expect(report.studentId).toBe('S001');
    expect(report.modelStatus).toBe('developing');
    expect(report.modelMaturityLabel).toContain('Developing');
    expect(report.confidence).toBe('moderate');
    expect(report.trainingSessionCount).toBe(4);
    expect(report.executiveSummary).toContain('baseline is still developing');
  });

  // ─── 2. S002 Developing Baseline Independent Report ────────────────────────
  test('2. S002 report reflects independent deliberate baseline without comparison to S001', () => {
    const reportS002 = generateRiskReport('S002_EX01', 'instructor');
    const reportS001 = generateRiskReport('S001_EX01', 'instructor');

    expect(reportS002.studentId).toBe('S002');
    expect(reportS002.studentName).toContain('Priya');
    expect(reportS002.modelStatus).toBe('developing');

    // Both are evaluated independently
    expect(reportS002.featureReports.length).toBeGreaterThan(0);
    const respS002 = reportS002.featureReports.find((f) => f.featureKey === 'response_time_sec');
    const respS001 = reportS001.featureReports.find((f) => f.featureKey === 'response_time_sec');

    expect(respS002).toBeDefined();
    expect(respS001).toBeDefined();
    expect(respS002!.expected).not.toEqual(respS001!.expected);
  });

  // ─── 3. S003 Established Baseline Full Report ──────────────────────────────
  test('3. S003 report provides a complete, high-confidence behavioral report', () => {
    const report = generateRiskReport('S003_EX01', 'instructor');

    expect(report.studentId).toBe('S003');
    expect(report.modelStatus).toBe('established');
    expect(report.confidence).toBe('high');
    expect(report.trainingSessionCount).toBe(8);
    expect(report.featureReports.length).toBeGreaterThan(0);
    expect(report.questionReports.length).toBeGreaterThan(0);
    expect(report.disclaimer).toContain('Behavioral deviation is not proof of misconduct');
  });

  // ─── 4. S004 Cold Start Insufficient History ───────────────────────────────
  test('4. S004 cold-start report communicates insufficient history and low confidence', () => {
    const report = generateRiskReport('S004_EX01', 'instructor');

    expect(report.studentId).toBe('S004');
    expect(report.modelStatus).toBe('cold_start');
    expect(report.confidence).toBe('low');
    expect(report.riskLevel).toBe('limited_analysis');
    expect(report.riskStatusLabel).toBe('Insufficient Personal History');
    expect(report.executiveSummary).toContain('Insufficient personal history');
    expect(report.overallScore).toBeLessThanOrEqual(20);
    expect(report.isEligibleForHumanReview).toBe(false);
  });

  // ─── 5. Normal Exam (S003_EX01) Low Deviation ─────────────────────────────
  test('5. Normal exam produces Within Personal Pattern status and consistent summary', () => {
    const report = generateRiskReport('S003_EX01', 'instructor');

    expect(report.overallScore).toBeLessThan(30);
    expect(report.riskStatusLabel).toBe('Within Personal Pattern');
    expect(report.executiveSummary).toContain('consistent with the student\'s established historical pattern');
    expect(report.recommendedAction).toContain('No significant behavioral deviation detected');
  });

  // ─── 6. Anomalous Exam (S003_EX02) Review Recommended ─────────────────────
  test('6. Anomalous exam produces Review Recommended status and identifies top contributors', () => {
    const report = generateRiskReport('S003_EX02', 'instructor');

    expect(report.overallScore).toBeGreaterThanOrEqual(60);
    expect(report.riskStatusLabel).toBe('Review Recommended');
    expect(report.executiveSummary).toContain('Substantial behavioral deviation');
    expect(report.recommendedAction).toContain('Human review recommended');
    expect(report.isEligibleForHumanReview).toBe(true);
  });

  // ─── 7. Feature Status Tag Determination ──────────────────────────────────
  test('7. Correctly maps standardized deviations and binary signals to FeatureStatusTags', () => {
    expect(determineFeatureStatusTag('response_time_sec', 0.5, 25, false)).toBe('Within Baseline');
    expect(determineFeatureStatusTag('response_time_sec', 1.5, 35, false)).toBe('Mild Deviation');
    expect(determineFeatureStatusTag('response_time_sec', 3.2, 50, false)).toBe('Significant Deviation');
    expect(determineFeatureStatusTag('paste_detected', 2.5, 1, false)).toBe('Detected Signal');
    expect(determineFeatureStatusTag('paste_detected', 0, 0, false)).toBe('Within Baseline');
    expect(determineFeatureStatusTag('character_burst_flag', 3.0, 1, false)).toBe('Detected Signal');
    expect(determineFeatureStatusTag('response_time_sec', 0, 25, true)).toBe('Insufficient Data');
  });

  // ─── 8. Unexpected Device Context Signal ───────────────────────────────────
  test('8. Unexpected device context is documented without accusing student of misconduct', () => {
    const report = generateRiskReport('S004_EX01', 'instructor');

    if (report.deviceChangeDetected) {
      expect(report.deviceContextExplanation).toBeDefined();
      expect(report.deviceContextExplanation).toContain('differs from the student\'s historical device usage');
      expect(report.deviceContextExplanation).toContain('does NOT indicate misconduct');
    }
  });

  // ─── 9. Helper Extractors (Summary, Features, Questions) ──────────────────
  test('9. Helper extraction functions return structured report elements', () => {
    const summary = getExecutiveSummary('S003_EX01');
    expect(typeof summary).toBe('string');
    expect(summary.length).toBeGreaterThan(10);

    const features = getFeatureExplanations('S003_EX01');
    expect(Array.isArray(features)).toBe(true);
    expect(features.length).toBeGreaterThan(0);

    const questions = getQuestionAnalysis('S003_EX01');
    expect(Array.isArray(questions)).toBe(true);
    expect(questions.length).toBeGreaterThan(0);
  });

  // ─── 10. Student Role Authorization Restriction ───────────────────────────
  test('10. Student role cannot access another student risk report', () => {
    expect(() => {
      generateRiskReport('S003_EX01', 'student', 'S001');
    }).toThrow(/Unauthorized|cannot access/i);
  });
});
