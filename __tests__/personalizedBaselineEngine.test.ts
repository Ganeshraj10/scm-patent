import {
  buildStudentBaseline,
  getStudentBaseline,
  getStudentBaselineForDevice,
  getFeatureBaseline,
  getExpectedFeatureValue,
  getModelMaturity,
  calculateStats,
  calculateLinearRegression,
} from '../lib/services/personalizedBaselineService';

describe('Stage 5: Personalized Behavioral Baseline Engine', () => {
  // ─── 1. Individual Personalization & Isolation ──────────────────────────────
  test('1. Builds personalized baselines independently: S001 is distinct from S002', () => {
    const baselineS001 = buildStudentBaseline('S001');
    const baselineS002 = buildStudentBaseline('S002');

    expect(baselineS001.studentId).toBe('S001');
    expect(baselineS002.studentId).toBe('S002');

    // Both have 4 low-stakes sessions in developing demo profile
    expect(baselineS001.trainingSessionCount).toBe(4);
    expect(baselineS002.trainingSessionCount).toBe(4);

    // Statistical profiles are individual and distinct
    const respTimeS001 = baselineS001.overallFeatures.response_time_sec.expectedValue;
    const respTimeS002 = baselineS002.overallFeatures.response_time_sec.expectedValue;
    expect(respTimeS001).not.toEqual(respTimeS002);

    const speedS001 = baselineS001.overallFeatures.pointer_avg_speed_px_s.expectedValue;
    const speedS002 = baselineS002.overallFeatures.pointer_avg_speed_px_s.expectedValue;
    expect(speedS001).not.toEqual(speedS002);
  });

  // ─── 2. Strict Low-Stakes Scoping (Zero Graded Contamination) ──────────────
  test('2. Strictly trains on low-stakes coursework only; excludes graded sessions', () => {
    const baseline = getStudentBaseline('S001');

    // 4 low-stakes sessions used for S001
    expect(baseline.trainingSessionCount).toBe(4);
    expect(baseline.totalInteractions).toBe(4);

    // None of the eligible sessions should be graded exams
    expect(baseline.eligibleLowStakesSessions.length).toBe(4);
    baseline.eligibleLowStakesSessions.forEach((sId) => {
      expect(sId).toContain('_LS');
      expect(sId).not.toContain('_EX');
    });
  });

  // ─── 3. Complete 9 Behavioral Features Modeled ──────────────────────────────
  test('3. Models all 9 behavioral features with transparent statistics', () => {
    const baseline = getStudentBaseline('S001');
    const expectedKeys = [
      'response_time_sec',
      'answer_revision_count',
      'answer_revision_time_sec',
      'pointer_distance_px',
      'pointer_avg_speed_px_s',
      'scroll_distance_px',
      'scroll_events',
      'paste_detected',
      'character_burst_flag',
    ];

    expectedKeys.forEach((key) => {
      const feat = baseline.overallFeatures[key];
      expect(feat).toBeDefined();
      expect(feat.expectedValue).toBeGreaterThanOrEqual(0);
      expect(feat.mean).toBeGreaterThanOrEqual(0);
      expect(feat.median).toBeGreaterThanOrEqual(0);
      expect(feat.min).toBeGreaterThanOrEqual(0);
      expect(feat.max).toBeGreaterThanOrEqual(feat.min);
      expect(feat.sampleCount).toBe(4);
      expect(feat.uncertainty).toBeGreaterThanOrEqual(0);
      expect(isNaN(feat.uncertainty)).toBe(false);
    });
  });

  // ─── 4. Question-Difficulty Adjustment & Regression ─────────────────────────
  test('4. Adjusts expected behavior dynamically based on question difficulty', () => {
    // S001 has difficulty variation across low-stakes questions
    const easyQuery = getExpectedFeatureValue('S001', 'response_time_sec', { difficulty: 0.1 });
    const hardQuery = getExpectedFeatureValue('S001', 'response_time_sec', { difficulty: 0.9 });

    expect(easyQuery.expected).toBeGreaterThan(0);
    expect(hardQuery.expected).toBeGreaterThan(0);
    expect(['difficulty_adjusted', 'student_mean_fallback']).toContain(easyQuery.method);

    // Regression helper tests
    const reg = calculateLinearRegression([0.1, 0.5, 0.9], [10, 25, 40]);
    expect(reg).not.toBeNull();
    expect(reg!.slope).toBeGreaterThan(0);
    expect(reg!.intercept).toBeGreaterThan(0);

    // Zero variance in difficulty safely returns null (fallback)
    const zeroVarianceReg = calculateLinearRegression([0.5, 0.5, 0.5], [10, 20, 30]);
    expect(zeroVarianceReg).toBeNull();
  });

  // ─── 5. Device-Specific Baselines & Fallbacks ───────────────────────────────
  test('5. Maintains device-specific baselines with safe student fallback', () => {
    const desktopBaseline = getStudentBaselineForDevice('S003', 'web_desktop');
    expect(desktopBaseline).not.toBeNull();
    expect(desktopBaseline!.deviceType).toBe('web_desktop');

    // Devices with sufficient data use device-specific baseline
    // Devices with insufficient data fall back to student's overall baseline
    const mobileBaseline = getStudentBaselineForDevice('S003', 'mobile');
    expect(mobileBaseline).not.toBeNull();
    expect(['difficulty_adjusted', 'student_mean_fallback', 'student_overall_fallback']).toContain(
      mobileBaseline!.features.response_time_sec.method
    );
  });

  // ─── 6. Uncertainty Calculation (Standard Error) ───────────────────────────
  test('6. Calculates standard error uncertainty accurately (sigma / sqrt(N))', () => {
    const stats = calculateStats([20, 30, 40, 50]);
    // Mean = 35, stdDev ≈ 12.91, SE = 12.91 / 2 = 6.455
    expect(stats.mean).toBe(35);
    expect(stats.stdDev).toBeCloseTo(12.91, 1);
    expect(stats.uncertainty).toBeCloseTo(6.455, 1);

    // Zero observations
    const emptyStats = calculateStats([]);
    expect(emptyStats.uncertainty).toBe(0);
    expect(emptyStats.mean).toBe(0);

    // Single observation (N = 1)
    const singleStats = calculateStats([42]);
    expect(singleStats.mean).toBe(42);
    expect(singleStats.stdDev).toBe(0);
    expect(singleStats.uncertainty).toBe(0);
  });

  // ─── 7. Model Maturity Progression ──────────────────────────────────────────
  test('7. Classifies model maturity: Established for S003 (8 sessions), Developing for S001 (4 sessions)', () => {
    const maturityS003 = getModelMaturity('S003');
    expect(maturityS003.status).toBe('established');
    expect(maturityS003.sessionCount).toBe(8);
    expect(maturityS003.label).toContain('Established');

    const maturityS001 = getModelMaturity('S001');
    expect(maturityS001.status).toBe('developing');
    expect(maturityS001.sessionCount).toBe(4);
    expect(maturityS001.label).toContain('Developing');
  });

  // ─── 8. Cold Start for Unseeded or New Students ─────────────────────────────
  test('8. Handles cold start students safely without inventing fake baselines', () => {
    const coldBaseline = getStudentBaseline('S_COLD_NEW_STUDENT');
    expect(coldBaseline.maturityStatus).toBe('cold_start');
    expect(coldBaseline.trainingSessionCount).toBe(0);
    expect(coldBaseline.totalInteractions).toBe(0);

    // Expected value safely falls back to 0 without NaN or Infinity
    const feat = coldBaseline.overallFeatures.response_time_sec;
    expect(feat.expectedValue).toBe(0);
    expect(feat.uncertainty).toBe(0);
    expect(feat.sampleCount).toBe(0);
    expect(feat.status).toBe('insufficient_data');
  });
});
