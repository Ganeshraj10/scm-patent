/**
 * ExamGuard — Student Longitudinal History & Coursework Service
 * 
 * Stage 4: Extracts and structures an individual student's historical coursework
 * and examination records without calculating baselines, risk scores, or cheating predictions.
 * 
 * Enforces strict student-level data isolation.
 */

import {
  getStudentPatentRecords,
  getStudent,
  getStudentSessions,
  getLowStakesSessions,
  getGradedSessions,
  getAllPatentRecords,
  PatentRecord,
} from '@/lib/services/datasetService';
import {
  getAllGradedExamSessions,
  getGradedExamSession,
} from '@/lib/services/examSessionService';
import { DatasetSession, QuestionInteraction } from '@/types';

export interface StudentCourseworkSummary {
  studentId: string;
  totalSessions: number;
  lowStakesSessionsCount: number;
  gradedSessionsCount: number;
  totalQuestionsAnswered: number;
  avgResponseTimeSec: number;
  avgAnswerRevisions: number;
  avgPointerSpeedPxS: number;
  avgScrollDistancePx: number;
  firstActivityDate: string;
  latestActivityDate: string;
  devicesUsed: string[];
}

export interface StudentSessionFilterOptions {
  sessionType?: 'all' | 'low_stakes' | 'graded';
  deviceType?: string | 'all';
  sortOrder?: 'newest_first' | 'oldest_first';
  search?: string;
}

export interface ReadableQuestionInteraction {
  recordId: string;
  questionId: string;
  timestamp: string;
  timeOfDay: string;
  questionDifficulty: number;
  responseTimeSec: number;
  answerRevisionCount: number;
  answerRevisionTimeSec: number;
  correctnessLabel: 'Correct' | 'Incorrect';
  pointerDistancePx: number;
  pointerAvgSpeedPxS: number;
  scrollDistancePx: number;
  scrollEvents: number;
  pasteLabel: 'Detected' | 'None';
  characterBurstLabel: 'Detected' | 'Normal';
  deviceType: string;
  sessionPosition: number;
}

export interface BehaviorTrendPoint {
  index: number;
  sessionId: string;
  sessionType: 'low_stakes' | 'graded';
  sessionTypeLabel: string;
  date: string;
  questionId: string;
  responseTimeSec: number;
  answerRevisionCount: number;
  pointerSpeedPxS: number;
  scrollDistancePx: number;
}

export interface DeviceUsageStat {
  deviceType: string;
  displayLabel: string;
  sessionCount: number;
  questionCount: number;
  lastUsedDate: string;
  percentage: number;
}

export interface TimeOfDayStat {
  period: 'Morning' | 'Afternoon' | 'Evening' | 'Night';
  timeRange: string;
  sessionCount: number;
  questionCount: number;
  percentage: number;
}

export interface TimelineEvent {
  sessionId: string;
  date: string;
  displayDate: string;
  sessionType: 'low_stakes' | 'graded';
  typeLabel: string;
  questionCount: number;
  avgResponseTimeSec: number;
  avgRevisions: number;
  deviceType: string;
  deviceLabel: string;
}

// ─── 1. Coursework Summary for Authenticated Student ─────────────────────────

export function getStudentCourseworkSummary(studentId: string): StudentCourseworkSummary | null {
  const records = getStudentPatentRecords(studentId);
  if (!records || records.length === 0) {
    return null;
  }

  const lowStakesRecords = records.filter((r) => r.session_type === 'low_stakes');
  const gradedRecords = records.filter((r) => r.session_type === 'graded');

  const uniqueLowStakesSessions = new Set(lowStakesRecords.map((r) => r.session_id)).size;
  const uniqueGradedSessions = new Set(gradedRecords.map((r) => r.session_id)).size;

  const totalResponseTime = records.reduce((sum, r) => sum + r.response_time_sec, 0);
  const totalRevisions = records.reduce((sum, r) => sum + r.answer_revision_count, 0);
  const totalPointerSpeed = records.reduce((sum, r) => sum + r.pointer_avg_speed_px_s, 0);
  const totalScrollDistance = records.reduce((sum, r) => sum + r.scroll_distance_px, 0);

  const sortedTimestamps = [...records].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  const uniqueDevices = Array.from(new Set(records.map((r) => r.device_type)));

  return {
    studentId,
    totalSessions: uniqueLowStakesSessions + uniqueGradedSessions,
    lowStakesSessionsCount: uniqueLowStakesSessions,
    gradedSessionsCount: uniqueGradedSessions,
    totalQuestionsAnswered: records.length,
    avgResponseTimeSec: Number((totalResponseTime / records.length).toFixed(1)),
    avgAnswerRevisions: Number((totalRevisions / records.length).toFixed(2)),
    avgPointerSpeedPxS: Number((totalPointerSpeed / records.length).toFixed(1)),
    avgScrollDistancePx: Number((totalScrollDistance / records.length).toFixed(1)),
    firstActivityDate: sortedTimestamps[0].timestamp,
    latestActivityDate: sortedTimestamps[sortedTimestamps.length - 1].timestamp,
    devicesUsed: uniqueDevices,
  };
}

// ─── 2. Coursework & History Sessions with Filters & Sorting ─────────────────

export function getStudentCourseworkSessions(
  studentId: string,
  options?: StudentSessionFilterOptions
): DatasetSession[] {
  let sessions = [...getStudentSessions(studentId)];

  // Merge live taken graded exams from examSessionService if in browser or memory
  const liveGraded = getAllGradedExamSessions(studentId);
  const seenSessionIds = new Set(sessions.map((s) => s.sessionId));

  liveGraded.forEach((lg) => {
    if (!seenSessionIds.has(lg.sessionId) && lg.studentId === studentId) {
      seenSessionIds.add(lg.sessionId);
      sessions.push({
        sessionId: lg.sessionId,
        studentId: lg.studentId,
        sessionType: 'graded',
        timestamp: lg.completedAt || lg.startedAt,
        deviceType: lg.deviceType,
        questionCount: lg.questionCount,
        avgResponseTimeSec: lg.avgResponseTimeSec || 0,
        avgRevisionCount: lg.avgRevisionCount || 0,
        avgPointerSpeed: 0,
        totalScrollDistance: 0,
        hasPasteEvent: lg.hasPasteEvent || false,
        hasBurstEvent: lg.hasBurstEvent || false,
        humanReviewLabel: 'clean_mock',
        interactions: lg.interactions.map((q) => ({
          questionId: q.questionId,
          recordId: q.recordId,
          difficulty: q.questionDifficulty,
          responseTimeSec: q.responseTimeSec,
          revisionCount: q.answerRevisionCount,
          revisionTimeSec: q.answerRevisionTimeSec,
          correctness: q.isAnswerCorrect ? 1 : 0,
          pointerDistancePx: q.pointerDistancePx,
          pointerAvgSpeedPxS: q.pointerAvgSpeedPxS,
          scrollDistancePx: q.scrollDistancePx,
          scrollEvents: q.scrollEvents,
          pasteDetected: q.pasteDetected === 1,
          characterBurstFlag: q.characterBurstFlag === 1,
          deviceType: q.deviceType,
          sessionPosition: q.sessionPosition,
          timeOfDay: q.timeOfDay,
          timestamp: q.timestamp,
          sourceDataset: 'live_examination',
          humanReviewLabel: 'clean_mock',
        })),
      });
    }
  });

  // Type filter
  if (options?.sessionType && options.sessionType !== 'all') {
    sessions = sessions.filter((s) => s.sessionType === options.sessionType);
  }

  // Device filter
  if (options?.deviceType && options.deviceType !== 'all') {
    sessions = sessions.filter((s) => s.deviceType === options.deviceType);
  }

  // Search
  if (options?.search && options.search.trim() !== '') {
    const q = options.search.toLowerCase().trim();
    sessions = sessions.filter(
      (s) =>
        s.sessionId.toLowerCase().includes(q) ||
        s.deviceType.toLowerCase().includes(q) ||
        s.timestamp.includes(q) ||
        ((s as any).date && (s as any).date.includes(q))
    );
  }

  // Sorting
  const sortOrder = options?.sortOrder || 'newest_first';
  sessions.sort((a, b) => {
    const timeA = new Date(a.timestamp || (a as any).date).getTime();
    const timeB = new Date(b.timestamp || (b as any).date).getTime();
    return sortOrder === 'newest_first' ? timeB - timeA : timeA - timeB;
  });

  return sessions;
}

// ─── 3. Detailed Question-Level Records with Readable Labels ─────────────────

export function getStudentSessionDetails(
  studentId: string,
  sessionId: string
): { session: DatasetSession; questions: ReadableQuestionInteraction[] } | null {
  // First check if this is a live graded exam session
  const liveSession = getGradedExamSession(sessionId);
  if (liveSession) {
    if (liveSession.studentId !== studentId) {
      console.warn(`[Security] Student ${studentId} attempted to access foreign session ${sessionId}`);
      return null;
    }

    const session: DatasetSession = {
      sessionId: liveSession.sessionId,
      studentId: liveSession.studentId,
      sessionType: 'graded',
      timestamp: liveSession.completedAt || liveSession.startedAt,
      deviceType: liveSession.deviceType,
      questionCount: liveSession.questionCount,
      avgResponseTimeSec: liveSession.avgResponseTimeSec || 0,
      avgRevisionCount: liveSession.avgRevisionCount || 0,
      avgPointerSpeed: 0,
      totalScrollDistance: 0,
      hasPasteEvent: liveSession.hasPasteEvent || false,
      hasBurstEvent: liveSession.hasBurstEvent || false,
      humanReviewLabel: 'clean_mock',
      interactions: [],
    };

    const questions: ReadableQuestionInteraction[] = liveSession.interactions.map((q) => ({
      recordId: q.recordId,
      questionId: q.questionId,
      timestamp: q.timestamp,
      timeOfDay: q.timeOfDay,
      questionDifficulty: q.questionDifficulty,
      responseTimeSec: q.responseTimeSec,
      answerRevisionCount: q.answerRevisionCount,
      answerRevisionTimeSec: q.answerRevisionTimeSec,
      correctnessLabel: q.isAnswerCorrect ? 'Correct' : 'Incorrect',
      pointerDistancePx: q.pointerDistancePx,
      pointerAvgSpeedPxS: q.pointerAvgSpeedPxS,
      scrollDistancePx: q.scrollDistancePx,
      scrollEvents: q.scrollEvents,
      pasteLabel: q.pasteDetected === 1 ? 'Detected' : 'None',
      characterBurstLabel: q.characterBurstFlag === 1 ? 'Detected' : 'Normal',
      deviceType: q.deviceType,
      sessionPosition: q.sessionPosition,
    }));

    return { session, questions };
  }

  // Otherwise check dataset records
  const allRecords = getAllPatentRecords();
  const rawRecords = allRecords.filter((r) => r.session_id === sessionId);
  if (!rawRecords || rawRecords.length === 0) return null;

  // Strict ownership verification
  if (rawRecords[0].student_id !== studentId) {
    console.warn(`[Security] Student ${studentId} attempted to access foreign session ${sessionId}`);
    return null;
  }

  const session = getStudentSessions(studentId).find((s) => s.sessionId === sessionId);
  if (!session) return null;

  const readableQuestions: ReadableQuestionInteraction[] = rawRecords.map((r) => ({
    recordId: r.record_id,
    questionId: r.question_id,
    timestamp: r.timestamp,
    timeOfDay: r.time_of_day,
    questionDifficulty: r.question_difficulty,
    responseTimeSec: r.response_time_sec,
    answerRevisionCount: r.answer_revision_count,
    answerRevisionTimeSec: r.answer_revision_time_sec,
    correctnessLabel: r.correctness === 1 ? 'Correct' : 'Incorrect',
    pointerDistancePx: r.pointer_distance_px,
    pointerAvgSpeedPxS: r.pointer_avg_speed_px_s,
    scrollDistancePx: r.scroll_distance_px,
    scrollEvents: r.scroll_events,
    pasteLabel: r.paste_detected === 1 ? 'Detected' : 'None',
    characterBurstLabel: r.character_burst_flag === 1 ? 'Detected' : 'Normal',
    deviceType: r.device_type,
    sessionPosition: r.session_position,
  }));

  return {
    session,
    questions: readableQuestions,
  };
}

// ─── 4. Longitudinal Behavior Trends ("Behavior Over Time") ─────────────────

export function getStudentBehaviorTrends(studentId: string): BehaviorTrendPoint[] {
  const records = getStudentPatentRecords(studentId);
  if (!records || records.length === 0) return [];

  // Sort strictly chronologically
  const sorted = [...records].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  return sorted.map((r, idx) => ({
    index: idx + 1,
    sessionId: r.session_id,
    sessionType: r.session_type,
    sessionTypeLabel: r.session_type === 'low_stakes' ? 'Practice' : 'Exam',
    date: r.timestamp.split(' ')[0],
    questionId: r.question_id,
    responseTimeSec: r.response_time_sec,
    answerRevisionCount: r.answer_revision_count,
    pointerSpeedPxS: r.pointer_avg_speed_px_s,
    scrollDistancePx: r.scroll_distance_px,
  }));
}

// ─── 5. Timeline of Coursework & Exam Events ────────────────────────────────

export function getStudentTimeline(studentId: string): TimelineEvent[] {
  const sessions = getStudentSessions(studentId);
  if (!sessions || sessions.length === 0) return [];

  // Chronological sorting (newest first for timeline)
  const sorted = [...sessions].sort(
    (a, b) => new Date(b.timestamp || (b as any).date).getTime() - new Date(a.timestamp || (a as any).date).getTime()
  );

  const deviceLabelMap: Record<string, string> = {
    web_desktop: 'Web Desktop',
    web_laptop: 'Web Laptop',
    mobile: 'Mobile Device',
  };

  return sorted.map((s) => {
    const rawDate = s.timestamp || (s as any).date;
    return {
      sessionId: s.sessionId,
      date: rawDate,
      displayDate: new Date(rawDate).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
      sessionType: s.sessionType,
      typeLabel: s.sessionType === 'low_stakes' ? 'Practice / Low-Stakes' : 'Graded Examination',
      questionCount: s.questionCount,
      avgResponseTimeSec: s.avgResponseTimeSec || (s as any).avgResponseTime,
      avgRevisions: s.avgRevisionCount || (s as any).avgRevisions,
      deviceType: s.deviceType,
      deviceLabel: deviceLabelMap[s.deviceType] || s.deviceType,
    };
  });
}

// ─── 6. Device History Breakdown ────────────────────────────────────────────

export function getStudentDeviceHistory(studentId: string): DeviceUsageStat[] {
  const records = getStudentPatentRecords(studentId);
  if (!records || records.length === 0) return [];

  const deviceGroups: Record<string, { sessions: Set<string>; questions: number; lastDate: string }> = {};

  records.forEach((r) => {
    if (!deviceGroups[r.device_type]) {
      deviceGroups[r.device_type] = {
        sessions: new Set(),
        questions: 0,
        lastDate: r.timestamp,
      };
    }
    deviceGroups[r.device_type].sessions.add(r.session_id);
    deviceGroups[r.device_type].questions += 1;
    if (new Date(r.timestamp) > new Date(deviceGroups[r.device_type].lastDate)) {
      deviceGroups[r.device_type].lastDate = r.timestamp;
    }
  });

  const totalQuestions = records.length;
  const labelMap: Record<string, string> = {
    web_desktop: 'Web Desktop Workstation',
    web_laptop: 'Web Laptop Browser',
    mobile: 'Mobile Device Application',
  };

  return Object.entries(deviceGroups).map(([devKey, data]) => ({
    deviceType: devKey,
    displayLabel: labelMap[devKey] || devKey,
    sessionCount: data.sessions.size,
    questionCount: data.questions,
    lastUsedDate: data.lastDate,
    percentage: Math.round((data.questions / totalQuestions) * 100),
  }));
}

// ─── 7. Time-of-Day Activity Breakdown ──────────────────────────────────────

export function getStudentTimeOfDayHistory(studentId: string): TimeOfDayStat[] {
  const records = getStudentPatentRecords(studentId);
  if (!records || records.length === 0) return [];

  const periods: Record<'Morning' | 'Afternoon' | 'Evening' | 'Night', { sessions: Set<string>; questions: number; range: string }> = {
    Morning: { sessions: new Set(), questions: 0, range: '06:00 – 11:59' },
    Afternoon: { sessions: new Set(), questions: 0, range: '12:00 – 16:59' },
    Evening: { sessions: new Set(), questions: 0, range: '17:00 – 21:59' },
    Night: { sessions: new Set(), questions: 0, range: '22:00 – 05:59' },
  };

  records.forEach((r) => {
    let hour = 12;
    if (r.time_of_day && r.time_of_day.includes(':')) {
      hour = parseInt(r.time_of_day.split(':')[0], 10);
    } else {
      const parsedDate = new Date(r.timestamp);
      if (!isNaN(parsedDate.getTime())) {
        hour = parsedDate.getHours();
      }
    }

    let period: 'Morning' | 'Afternoon' | 'Evening' | 'Night';
    if (hour >= 6 && hour < 12) {
      period = 'Morning';
    } else if (hour >= 12 && hour < 17) {
      period = 'Afternoon';
    } else if (hour >= 17 && hour < 22) {
      period = 'Evening';
    } else {
      period = 'Night';
    }

    periods[period].sessions.add(r.session_id);
    periods[period].questions += 1;
  });

  const totalQuestions = records.length;

  return (Object.keys(periods) as Array<'Morning' | 'Afternoon' | 'Evening' | 'Night'>).map((pKey) => ({
    period: pKey,
    timeRange: periods[pKey].range,
    sessionCount: periods[pKey].sessions.size,
    questionCount: periods[pKey].questions,
    percentage: Math.round((periods[pKey].questions / totalQuestions) * 100),
  }));
}
