import {
  getDemoStudentProfiles,
  getDemoStudentProfile,
  isDemoStudent,
  DEMO_STUDENT_PROFILES,
} from '../lib/services/demoStudentService';
import {
  buildStudentBaseline,
  getStudentBaseline,
  getModelMaturity,
} from '../lib/services/personalizedBaselineService';

describe('Demo Student Profiles & Model Maturity Progression', () => {
  // ─── 1. Four Dedicated Demo Profiles Configured ────────────────────────────
  test('1. Configures exactly 4 dedicated demo student profiles (S001 to S004)', () => {
    const profiles = getDemoStudentProfiles();
    expect(profiles.length).toBe(4);

    const ids = profiles.map((p) => p.id);
    expect(ids).toEqual(['S001', 'S002', 'S003', 'S004']);
  });

  // ─── 2. Student A: Developing History ──────────────────────────────────────
  test('2. Student A (S001) has 4 low-stakes sessions and Developing maturity', () => {
    const profile = getDemoStudentProfile('S001')!;
    expect(profile).toBeDefined();
    expect(profile.profileKey).toBe('STUDENT_A');
    expect(profile.modelMaturity).toBe('developing');
    expect(profile.lowStakesSessionCount).toBe(4);
    expect(profile.eligibleLowStakesSessions.length).toBe(4);

    const baseline = buildStudentBaseline('S001');
    expect(baseline.maturityStatus).toBe('developing');
    expect(baseline.trainingSessionCount).toBe(4);
    expect(baseline.eligibleLowStakesSessions.length).toBe(4);

    // Fast response pattern (~30s)
    const respTime = baseline.overallFeatures.response_time_sec.mean;
    expect(respTime).toBeGreaterThanOrEqual(25);
    expect(respTime).toBeLessThanOrEqual(35);
  });

  // ─── 3. Student B: Developing with Different Normal Baseline ────────────────
  test('3. Student B (S002) has 4 low-stakes sessions and distinct deliberate normal baseline', () => {
    const profile = getDemoStudentProfile('S002')!;
    expect(profile).toBeDefined();
    expect(profile.profileKey).toBe('STUDENT_B');
    expect(profile.modelMaturity).toBe('developing');
    expect(profile.lowStakesSessionCount).toBe(4);

    const baselineS002 = buildStudentBaseline('S002');
    const baselineS001 = buildStudentBaseline('S001');

    expect(baselineS002.maturityStatus).toBe('developing');
    expect(baselineS002.trainingSessionCount).toBe(4);

    // Deliberate response pattern (~44s)
    const respTimeS002 = baselineS002.overallFeatures.response_time_sec.mean;
    const respTimeS001 = baselineS001.overallFeatures.response_time_sec.mean;

    expect(respTimeS002).toBeGreaterThanOrEqual(40);
    expect(respTimeS002).toBeGreaterThan(respTimeS001); // Student B is visibly slower than Student A

    // Higher revision count
    const revsS002 = baselineS002.overallFeatures.answer_revision_count.mean;
    const revsS001 = baselineS001.overallFeatures.answer_revision_count.mean;
    expect(revsS002).toBeGreaterThan(revsS001);
  });

  // ─── 4. Student C: Established Mature Baseline ─────────────────────────────
  test('4. Student C (S003) has 8 low-stakes sessions and Established maturity', () => {
    const profile = getDemoStudentProfile('S003')!;
    expect(profile).toBeDefined();
    expect(profile.profileKey).toBe('STUDENT_C');
    expect(profile.modelMaturity).toBe('established');
    expect(profile.lowStakesSessionCount).toBe(8);

    const baseline = buildStudentBaseline('S003');
    expect(baseline.maturityStatus).toBe('established');
    expect(baseline.trainingSessionCount).toBe(8);
    expect(baseline.totalInteractions).toBe(8);
    expect(baseline.maturityLabel).toContain('Established');
  });

  // ─── 5. Student D: Cold Start Insufficient History ─────────────────────────
  test('5. Student D (S004) has 1 low-stakes session and Cold Start maturity', () => {
    const profile = getDemoStudentProfile('S004')!;
    expect(profile).toBeDefined();
    expect(profile.profileKey).toBe('STUDENT_D');
    expect(profile.modelMaturity).toBe('cold_start');
    expect(profile.lowStakesSessionCount).toBe(1);

    const baseline = buildStudentBaseline('S004');
    expect(baseline.maturityStatus).toBe('cold_start');
    expect(baseline.trainingSessionCount).toBe(1);
    expect(baseline.maturityLabel).toContain('Cold Start');

    // Does not borrow other students' data
    expect(baseline.studentId).toBe('S004');
    expect(baseline.eligibleLowStakesSessions).toEqual(['S004_LS01']);
  });

  // ─── 6. Data Isolation & No Population Baseline ────────────────────────────
  test('6. Baseline computations are strictly isolated across all 4 demo students', () => {
    const bA = buildStudentBaseline('S001');
    const bB = buildStudentBaseline('S002');
    const bC = buildStudentBaseline('S003');
    const bD = buildStudentBaseline('S004');

    // Confirm distinct training session counts and identities
    expect(bA.studentId).toBe('S001');
    expect(bB.studentId).toBe('S002');
    expect(bC.studentId).toBe('S003');
    expect(bD.studentId).toBe('S004');

    expect(bA.trainingSessionCount).toBe(4);
    expect(bB.trainingSessionCount).toBe(4);
    expect(bC.trainingSessionCount).toBe(8);
    expect(bD.trainingSessionCount).toBe(1);

    // No cross-contamination of eligible sessions
    expect(bA.eligibleLowStakesSessions.every((s) => s.startsWith('S001'))).toBe(true);
    expect(bB.eligibleLowStakesSessions.every((s) => s.startsWith('S002'))).toBe(true);
    expect(bC.eligibleLowStakesSessions.every((s) => s.startsWith('S003'))).toBe(true);
    expect(bD.eligibleLowStakesSessions.every((s) => s.startsWith('S004'))).toBe(true);
  });
});
