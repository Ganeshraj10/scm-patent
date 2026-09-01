/**
 * ExamGuard — Graded Examination Session Persistence Service
 * 
 * Stage 6: Manages graded examination session lifecycle, idempotent question
 * telemetry updates, and session completion without calculating risk scores.
 */

import { GradedExamSession, ExamQuestionTelemetry } from '@/types';
import { getAllPatentRecords, getGradedSessions } from '@/lib/services/datasetService';
import { detectDeviceType } from '@/lib/services/examFeatureExtractor';

const inMemoryExamSessions = new Map<string, GradedExamSession>();

const STORAGE_PREFIX = 'examguard_graded_session_';

// ─── Storage Helpers ────────────────────────────────────────────────────────

function loadSessionFromStorage(sessionId: string): GradedExamSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${sessionId}`);
    if (raw) {
      return JSON.parse(raw) as GradedExamSession;
    }
  } catch (e) {
    console.warn('[ExamSessionService] Storage load error:', e);
  }
  return null;
}

function saveSessionToStorage(session: GradedExamSession) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${session.sessionId}`, JSON.stringify(session));
  } catch (e) {
    console.warn('[ExamSessionService] Storage save error:', e);
  }
}

// ─── Session Lifecycle Methods ──────────────────────────────────────────────

export function createGradedExamSession(params: {
  studentId: string;
  examId: string;
  examTitle: string;
  questionCount: number;
  deviceType?: string;
}): GradedExamSession {
  const deviceType = params.deviceType || detectDeviceType();
  const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);

  // Generate a distinct session ID
  const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
  const sessionId = `${params.studentId}_EX_${randomSuffix}`;

  const session: GradedExamSession = {
    sessionId,
    studentId: params.studentId,
    examId: params.examId,
    examTitle: params.examTitle,
    sessionType: 'graded',
    deviceType,
    status: 'in_progress',
    startedAt: timestamp,
    questionCount: params.questionCount,
    completedQuestionsCount: 0,
    interactions: [],
  };

  inMemoryExamSessions.set(sessionId, session);
  saveSessionToStorage(session);
  return session;
}

export function saveQuestionTelemetry(
  sessionId: string,
  telemetry: ExamQuestionTelemetry
): GradedExamSession | null {
  const session = getGradedExamSession(sessionId);
  if (!session) return null;

  // Idempotent update: replace existing question record if already recorded, else append
  const existingIdx = session.interactions.findIndex(
    (q) => q.questionId === telemetry.questionId || q.sessionPosition === telemetry.sessionPosition
  );

  if (existingIdx >= 0) {
    session.interactions[existingIdx] = telemetry;
  } else {
    session.interactions.push(telemetry);
  }

  session.completedQuestionsCount = session.interactions.length;
  inMemoryExamSessions.set(sessionId, session);
  saveSessionToStorage(session);
  return session;
}

export function completeGradedExamSession(sessionId: string): GradedExamSession | null {
  const session = getGradedExamSession(sessionId);
  if (!session) return null;

  const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
  session.status = 'completed';
  session.completedAt = now;

  // Compute aggregate descriptive statistics
  const count = session.interactions.length;
  if (count > 0) {
    const totalResp = session.interactions.reduce((sum, q) => sum + q.responseTimeSec, 0);
    const totalRev = session.interactions.reduce((sum, q) => sum + q.answerRevisionCount, 0);
    const totalCodeRevs = session.interactions.reduce((sum, q) => sum + (q.codeRevisionCount || 0), 0);
    session.avgResponseTimeSec = Number((totalResp / count).toFixed(1));
    session.avgRevisionCount = Number((totalRev / count).toFixed(1));
    session.totalCodeRevisions = totalCodeRevs;
    session.hasPasteEvent = session.interactions.some((q) => q.pasteDetected === 1);
    session.hasBurstEvent = session.interactions.some((q) => q.characterBurstFlag === 1);
  }

  inMemoryExamSessions.set(sessionId, session);
  saveSessionToStorage(session);
  return session;
}

export function getGradedExamSession(sessionId: string): GradedExamSession | null {
  // 1. Check in-memory
  if (inMemoryExamSessions.has(sessionId)) {
    return inMemoryExamSessions.get(sessionId)!;
  }

  // 2. Check local storage
  const fromStorage = loadSessionFromStorage(sessionId);
  if (fromStorage) {
    inMemoryExamSessions.set(sessionId, fromStorage);
    return fromStorage;
  }

  // 3. Fallback: Check prototype dataset graded sessions
  const allRecords = getAllPatentRecords();
  const datasetRecords = allRecords.filter((r) => r.session_id === sessionId && r.session_type === 'graded');

  if (datasetRecords.length > 0) {
    const r0 = datasetRecords[0];
    const interactions: ExamQuestionTelemetry[] = datasetRecords.map((r) => ({
      recordId: r.record_id,
      studentId: r.student_id,
      sessionId: r.session_id,
      questionId: r.question_id,
      questionDifficulty: r.question_difficulty,
      sessionPosition: r.session_position,
      selectedAnswerIndex: r.correctness === 1 ? 0 : 1,
      responseTimeSec: r.response_time_sec,
      answerRevisionCount: r.answer_revision_count,
      answerRevisionTimeSec: r.answer_revision_time_sec,
      pointerDistancePx: r.pointer_distance_px,
      pointerAvgSpeedPxS: r.pointer_avg_speed_px_s,
      scrollDistancePx: r.scroll_distance_px,
      scrollEvents: r.scroll_events,
      pasteDetected: r.paste_detected,
      characterBurstFlag: r.character_burst_flag,
      deviceType: r.device_type,
      timeOfDay: r.time_of_day,
      timestamp: r.timestamp,
    }));

    const session: GradedExamSession = {
      sessionId: r0.session_id,
      studentId: r0.student_id,
      examId: 'PROTOTYPE_EXAM_01',
      examTitle: 'Core Engineering Mathematics & Logic Examination',
      sessionType: 'graded',
      deviceType: r0.device_type,
      status: 'completed',
      startedAt: r0.timestamp,
      completedAt: r0.timestamp,
      questionCount: datasetRecords.length,
      completedQuestionsCount: datasetRecords.length,
      avgResponseTimeSec: Number(
        (datasetRecords.reduce((sum, r) => sum + r.response_time_sec, 0) / datasetRecords.length).toFixed(1)
      ),
      avgRevisionCount: Number(
        (datasetRecords.reduce((sum, r) => sum + r.answer_revision_count, 0) / datasetRecords.length).toFixed(1)
      ),
      hasPasteEvent: datasetRecords.some((r) => r.paste_detected === 1),
      hasBurstEvent: datasetRecords.some((r) => r.character_burst_flag === 1),
      interactions,
    };

    inMemoryExamSessions.set(sessionId, session);
    return session;
  }

  return null;
}

export function getAllGradedExamSessions(studentId?: string): GradedExamSession[] {
  const result: GradedExamSession[] = [];
  const seenIds = new Set<string>();

  // 1. In-memory sessions
  inMemoryExamSessions.forEach((s) => {
    if (!studentId || s.studentId === studentId) {
      if (!seenIds.has(s.sessionId)) {
        seenIds.add(s.sessionId);
        result.push(s);
      }
    }
  });

  // 2. Storage sessions (browser client)
  if (typeof window !== 'undefined') {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(STORAGE_PREFIX)) {
          const raw = localStorage.getItem(key);
          if (raw) {
            const s = JSON.parse(raw) as GradedExamSession;
            if (!studentId || s.studentId === studentId) {
              if (!seenIds.has(s.sessionId)) {
                seenIds.add(s.sessionId);
                inMemoryExamSessions.set(s.sessionId, s);
                result.push(s);
              }
            }
          }
        }
      }
    } catch (e) {
      console.warn('[ExamSessionService] Storage scan error:', e);
    }
  }

  // 3. Prototype dataset sessions
  const datasetSessions = getGradedSessions(studentId || '');
  if (!studentId) {
    const allRecords = getAllPatentRecords().filter((r) => r.session_type === 'graded');
    const uniqueSessionIds = Array.from(new Set(allRecords.map((r) => r.session_id)));
    uniqueSessionIds.forEach((sId) => {
      if (!seenIds.has(sId)) {
        const sess = getGradedExamSession(sId);
        if (sess) {
          seenIds.add(sId);
          result.push(sess);
        }
      }
    });
  } else {
    datasetSessions.forEach((ds) => {
      if (!seenIds.has(ds.sessionId)) {
        const sess = getGradedExamSession(ds.sessionId);
        if (sess) {
          seenIds.add(ds.sessionId);
          result.push(sess);
        }
      }
    });
  }

  return result.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
}
