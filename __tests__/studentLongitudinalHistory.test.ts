import {
  getStudentCourseworkSummary,
  getStudentCourseworkSessions,
  getStudentSessionDetails,
  getStudentBehaviorTrends,
  getStudentTimeline,
  getStudentDeviceHistory,
  getStudentTimeOfDayHistory,
} from '../lib/services/studentHistoryService';

describe('Stage 4: Student Coursework, Session History & Longitudinal Behavioral Profile', () => {
  // ─── 1. Student Data Isolation & Scoping ────────────────────────────────────
  test('1. Enforces individual student scoping: S001 data is isolated from S002', () => {
    const summaryS001 = getStudentCourseworkSummary('S001');
    const summaryS002 = getStudentCourseworkSummary('S002');

    expect(summaryS001).not.toBeNull();
    expect(summaryS002).not.toBeNull();

    expect(summaryS001?.studentId).toBe('S001');
    expect(summaryS002?.studentId).toBe('S002');

    // Both have 12 interactions (8 low-stakes + 4 graded) in prototype dataset
    expect(summaryS001?.totalSessions).toBe(12);
    expect(summaryS002?.totalSessions).toBe(12);

    // Distinct statistical profiles
    expect(summaryS001?.avgResponseTimeSec).not.toEqual(summaryS002?.avgResponseTimeSec);
  });

  // ─── 2. Coursework Summary Statistics ───────────────────────────────────────
  test('2. Computes descriptive summary metrics accurately without risk scoring', () => {
    const summary = getStudentCourseworkSummary('S001');
    expect(summary).not.toBeNull();

    expect(summary!.lowStakesSessionsCount).toBe(8);
    expect(summary!.gradedSessionsCount).toBe(4);
    expect(summary!.totalQuestionsAnswered).toBe(12);
    expect(summary!.avgResponseTimeSec).toBeGreaterThan(0);
    expect(summary!.avgAnswerRevisions).toBeGreaterThanOrEqual(0);
    expect(summary!.avgPointerSpeedPxS).toBeGreaterThan(0);
    expect(summary!.avgScrollDistancePx).toBeGreaterThan(0);
    expect(summary!.devicesUsed.length).toBeGreaterThan(0);
  });

  // ─── 3. Filtering & Chronological Sorting ───────────────────────────────────
  test('3. Filters coursework sessions by type (low_stakes vs graded) and device', () => {
    const allSessions = getStudentCourseworkSessions('S001');
    expect(allSessions.length).toBe(12);

    const lowStakesOnly = getStudentCourseworkSessions('S001', { sessionType: 'low_stakes' });
    expect(lowStakesOnly.length).toBe(8);
    expect(lowStakesOnly.every((s) => s.sessionType === 'low_stakes')).toBe(true);

    const gradedOnly = getStudentCourseworkSessions('S001', { sessionType: 'graded' });
    expect(gradedOnly.length).toBe(4);
    expect(gradedOnly.every((s) => s.sessionType === 'graded')).toBe(true);

    const desktopOnly = getStudentCourseworkSessions('S001', { deviceType: 'web_desktop' });
    expect(desktopOnly.every((s) => s.deviceType === 'web_desktop')).toBe(true);
  });

  test('4. Sorts sessions chronologically (newest first vs oldest first)', () => {
    const newestFirst = getStudentCourseworkSessions('S001', { sortOrder: 'newest_first' });
    const oldestFirst = getStudentCourseworkSessions('S001', { sortOrder: 'oldest_first' });

    expect(newestFirst[0].sessionId).not.toEqual(oldestFirst[0].sessionId);

    const timeFirstNewest = new Date(newestFirst[0].timestamp || (newestFirst[0] as any).date).getTime();
    const timeLastNewest = new Date(newestFirst[newestFirst.length - 1].timestamp || (newestFirst[newestFirst.length - 1] as any).date).getTime();
    expect(timeFirstNewest).toBeGreaterThanOrEqual(timeLastNewest);
  });

  // ─── 4. Detailed Question-Level Inspection & Human-Readable Labels ──────────
  test('5. Formats human-readable question telemetry (Paste, Burst, Correctness)', () => {
    const detail = getStudentSessionDetails('S001', 'S001_LS01');
    expect(detail).not.toBeNull();
    expect(detail!.session.sessionId).toBe('S001_LS01');
    expect(detail!.questions.length).toBeGreaterThan(0);

    const q1 = detail!.questions[0];
    expect(q1.questionId).toBeDefined();
    expect(['Correct', 'Incorrect']).toContain(q1.correctnessLabel);
    expect(['Detected', 'None']).toContain(q1.pasteLabel);
    expect(['Detected', 'Normal']).toContain(q1.characterBurstLabel);
    expect(q1.responseTimeSec).toBeGreaterThan(0);
  });

  // ─── 5. Security & Ownership Boundary Enforcement ───────────────────────────
  test('6. Prevents cross-student access: Student S001 cannot query Student S002 session', () => {
    // S002_LS01 belongs to S002
    const unauthorizedAccess = getStudentSessionDetails('S001', 'S002_LS01');
    expect(unauthorizedAccess).toBeNull();
  });

  // ─── 6. Longitudinal Behavior Trends ("Behavior Over Time") ─────────────────
  test('7. Extracts 4 longitudinal trend series (Response Time, Revisions, Pointer, Scroll)', () => {
    const trends = getStudentBehaviorTrends('S001');
    expect(trends.length).toBe(12);

    // Verifies chronological ordering
    for (let i = 0; i < trends.length - 1; i++) {
      const currentDate = new Date(trends[i].date).getTime();
      const nextDate = new Date(trends[i + 1].date).getTime();
      expect(currentDate).toBeLessThanOrEqual(nextDate);
    }

    // Verifies data integrity
    trends.forEach((pt) => {
      expect(pt.responseTimeSec).toBeGreaterThan(0);
      expect(pt.answerRevisionCount).toBeGreaterThanOrEqual(0);
      expect(pt.pointerSpeedPxS).toBeGreaterThan(0);
      expect(pt.scrollDistancePx).toBeGreaterThanOrEqual(0);
    });
  });

  // ─── 7. Timeline Generation ─────────────────────────────────────────────────
  test('8. Builds chronological timeline events with readable dates and metrics', () => {
    const timeline = getStudentTimeline('S001');
    expect(timeline.length).toBe(12);
    expect(timeline[0].sessionId).toBeDefined();
    expect(timeline[0].displayDate).toBeDefined();
    expect(timeline[0].typeLabel).toBeDefined();
    expect(timeline[0].deviceLabel).toBeDefined();
  });

  // ─── 8. Device History & Time-of-Day Aggregation ────────────────────────────
  test('9. Aggregates device history and time-of-day distribution without suspicious flags', () => {
    const devices = getStudentDeviceHistory('S001');
    expect(devices.length).toBeGreaterThan(0);
    expect(devices[0].deviceType).toBeDefined();
    expect(devices[0].sessionCount).toBeGreaterThan(0);
    expect(devices[0].percentage).toBeGreaterThan(0);

    const timeStats = getStudentTimeOfDayHistory('S001');
    expect(timeStats.length).toBe(4); // Morning, Afternoon, Evening, Night
    const totalPct = timeStats.reduce((sum, s) => sum + s.percentage, 0);
    expect(totalPct).toBeCloseTo(100, -1);
  });

  // ─── 9. Empty / Unseeded Student Experience ────────────────────────────────
  test('10. Handles empty or newly registered students gracefully with zero history', () => {
    const emptySummary = getStudentCourseworkSummary('S_EMPTY_STUDENT');
    expect(emptySummary).toBeNull();

    const emptySessions = getStudentCourseworkSessions('S_EMPTY_STUDENT');
    expect(emptySessions).toEqual([]);

    const emptyTrends = getStudentBehaviorTrends('S_EMPTY_STUDENT');
    expect(emptyTrends).toEqual([]);

    const emptyDevices = getStudentDeviceHistory('S_EMPTY_STUDENT');
    expect(emptyDevices).toEqual([]);
  });
});
