/**
 * ExamGuard — Patent Behavioral Model Service
 * 
 * Builds personalized behavioral baselines for each student using their longitudinal low-stakes sessions
 * and reviewer-verified clean examination sessions.
 * 
 * Features:
 * - Statistical baseline (mean & stdDev for response time, revisions, pointer distance/speed, scroll distance)
 * - Rate tracking (paste rate, character burst rate)
 * - Contextual adjustments (Question difficulty, session position, time of day)
 * - Device usage profiling (web_desktop, web_laptop, mobile)
 * - Cold-start evaluation (< 3 sessions threshold)
 */

import { PatentRecord, getStudentLowStakesRecords, getAllPatentRecords } from './datasetService';

export interface StudentStat {
  mean: number;
  stdDev: number;
  min: number;
  max: number;
  count: number;
}

export interface PersonalizedBaseline {
  studentId: string;
  sessionCount: number;
  isColdStart: boolean;
  maturityStatus: 'cold_start' | 'maturing' | 'mature';
  confidence: number; // 0–100
  lastUpdated: string;
  
  // Feature statistics
  responseTime: StudentStat;
  revisionCount: StudentStat;
  pointerDistance: StudentStat;
  pointerSpeed: StudentStat;
  scrollDistance: StudentStat;
  
  // Categorical / Rate features
  pasteRate: number; // 0–1
  characterBurstRate: number; // 0–1
  
  // Device & Temporal profiles
  historicalDevices: string[];
  deviceFrequencies: Record<string, number>;
  historicalTimeRange: { minHour: number; maxHour: number };
  sessionPositions: number[];
  
  // Eligible records used for training
  trainingRecords: PatentRecord[];
}

export interface ExpectedBehavior {
  expectedResponseTime: number;
  expectedRevisionCount: number;
  expectedPointerDistance: number;
  expectedPointerSpeed: number;
  expectedScrollDistance: number;
  expectedPasteRate: number;
  expectedBurstRate: number;
  isUnexpectedDevice: boolean;
  deviceNotes?: string;
  timeContextNotes?: string;
}

function calculateStat(values: number[]): StudentStat {
  const count = values.length;
  if (count === 0) {
    return { mean: 0, stdDev: 1, min: 0, max: 0, count: 0 };
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const mean = values.reduce((sum, v) => sum + v, 0) / count;

  if (count === 1) {
    return { mean, stdDev: Math.max(mean * 0.2, 1), min, max, count: 1 };
  }

  const variance =
    values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / (count - 1);
  const stdDev = Math.max(Math.sqrt(variance), 0.001);

  return { mean, stdDev, min, max, count };
}

/**
 * Builds a personalized baseline for a student.
 * 
 * MODEL-UPDATE RULE:
 * Only low_stakes records OR graded records explicitly verified as clean (passed in verifiedSessionIds)
 * are eligible to build or update the baseline.
 */
export function buildPersonalizedBaseline(
  studentId: string,
  verifiedSessionIds: string[] = [],
  customRecords?: PatentRecord[]
): PersonalizedBaseline {
  let records: PatentRecord[];

  if (customRecords) {
    records = customRecords.filter((r) => r.student_id === studentId);
  } else {
    const all = getAllPatentRecords().filter((r) => r.student_id === studentId);
    // Eligible records: all low_stakes + any explicitly verified clean graded records
    records = all.filter((r) => {
      if (r.session_type === 'low_stakes') return true;
      if (r.session_type === 'graded' && verifiedSessionIds.includes(r.session_id)) {
        return true;
      }
      return false;
    });
  }

  const sessionCount = records.length;
  const isColdStart = sessionCount < 3;
  const maturityStatus = sessionCount < 3 ? 'cold_start' : sessionCount < 7 ? 'maturing' : 'mature';
  const confidence = sessionCount === 0
    ? 10
    : sessionCount < 3
    ? Math.min(45, Math.round(sessionCount * 18))
    : Math.min(95, Math.round(55 + sessionCount * 4.5));

  const responseTimes = records.map((r) => r.response_time_sec);
  const revisionCounts = records.map((r) => r.answer_revision_count);
  const pointerDistances = records.map((r) => r.pointer_distance_px);
  const pointerSpeeds = records.map((r) => r.pointer_avg_speed_px_s);
  const scrollDistances = records.map((r) => r.scroll_distance_px);

  const pasteCount = records.filter((r) => r.paste_detected === 1).length;
  const burstCount = records.filter((r) => r.character_burst_flag === 1).length;

  const pasteRate = sessionCount > 0 ? pasteCount / sessionCount : 0;
  const characterBurstRate = sessionCount > 0 ? burstCount / sessionCount : 0;

  const deviceFrequencies: Record<string, number> = {};
  const hours: number[] = [];
  const sessionPositions: number[] = [];

  records.forEach((r) => {
    deviceFrequencies[r.device_type] = (deviceFrequencies[r.device_type] || 0) + 1;
    sessionPositions.push(r.session_position);

    if (r.time_of_day) {
      const hour = parseInt(r.time_of_day.split(':')[0], 10);
      if (!isNaN(hour)) hours.push(hour);
    }
  });

  const historicalDevices = Object.keys(deviceFrequencies);
  const minHour = hours.length > 0 ? Math.min(...hours) : 9;
  const maxHour = hours.length > 0 ? Math.max(...hours) : 18;

  return {
    studentId,
    sessionCount,
    isColdStart,
    maturityStatus,
    confidence,
    lastUpdated: records[records.length - 1]?.timestamp || new Date().toISOString(),
    responseTime: calculateStat(responseTimes),
    revisionCount: calculateStat(revisionCounts),
    pointerDistance: calculateStat(pointerDistances),
    pointerSpeed: calculateStat(pointerSpeeds),
    scrollDistance: calculateStat(scrollDistances),
    pasteRate,
    characterBurstRate,
    historicalDevices,
    deviceFrequencies,
    historicalTimeRange: { minHour, maxHour },
    sessionPositions,
    trainingRecords: records,
  };
}

/**
 * Calculates contextual expected behavior for a given question and session metadata.
 * Adjusts expectations dynamically for Question Difficulty, Time of Day, and Device Type.
 */
export function calculateExpectedBehavior(
  baseline: PersonalizedBaseline,
  record: Pick<
    PatentRecord,
    'question_difficulty' | 'device_type' | 'session_position' | 'time_of_day'
  >
): ExpectedBehavior {
  // Question difficulty adjustment factor: d in [0, 1]
  // Higher difficulty expects longer response times, slightly more revisions and scrolling.
  const d = Math.max(0.1, Math.min(1.0, record.question_difficulty || 0.5));
  
  // Multipliers based on question difficulty d
  const timeMultiplier = 0.6 + 0.8 * d; // d=0.2 -> 0.76x, d=0.5 -> 1.0x, d=0.9 -> 1.32x
  const revisionMultiplier = 0.7 + 0.6 * d; // harder questions expect slightly more revisions
  const pointerDistMultiplier = 0.8 + 0.4 * d;
  const pointerSpeedMultiplier = 0.9 + 0.2 * d;
  const scrollMultiplier = 0.75 + 0.5 * d;

  const expectedResponseTime = baseline.responseTime.mean * timeMultiplier;
  const expectedRevisionCount = baseline.revisionCount.mean * revisionMultiplier;
  const expectedPointerDistance = baseline.pointerDistance.mean * pointerDistMultiplier;
  const expectedPointerSpeed = baseline.pointerSpeed.mean * pointerSpeedMultiplier;
  const expectedScrollDistance = baseline.scrollDistance.mean * scrollMultiplier;

  // Device check
  const isUnexpectedDevice =
    baseline.historicalDevices.length > 0 &&
    !baseline.historicalDevices.includes(record.device_type);

  let deviceNotes: string | undefined;
  if (isUnexpectedDevice) {
    deviceNotes = `Device '${record.device_type}' was not observed during baseline low-stakes practice (history: ${baseline.historicalDevices.join(', ')}).`;
  }

  let timeContextNotes: string | undefined;
  if (record.time_of_day) {
    const hour = parseInt(record.time_of_day.split(':')[0], 10);
    if (
      !isNaN(hour) &&
      (hour < baseline.historicalTimeRange.minHour - 2 ||
        hour > baseline.historicalTimeRange.maxHour + 2)
    ) {
      timeContextNotes = `Session completed at ${record.time_of_day}, outside normal learning hours (${baseline.historicalTimeRange.minHour}:00–${baseline.historicalTimeRange.maxHour}:00).`;
    }
  }

  return {
    expectedResponseTime,
    expectedRevisionCount,
    expectedPointerDistance,
    expectedPointerSpeed,
    expectedScrollDistance,
    expectedPasteRate: baseline.pasteRate,
    expectedBurstRate: baseline.characterBurstRate,
    isUnexpectedDevice,
    deviceNotes,
    timeContextNotes,
  };
}
