/**
 * ExamGuard — Supabase Persistence & Cross-Device Synchronization Service
 * 
 * Authoritative persistence layer for coursework sessions, examination attempts,
 * behavioral telemetry features, and student longitudinal records.
 */

import { createClient as createBrowserClient } from '@/lib/supabase/client';
import { GradedExamSession, ExamQuestionTelemetry, DatasetSession, QuestionInteraction } from '@/types';
import { persistExamSubmissionAction } from '@/lib/actions/exam';

// ─── Deterministic RFC 4122 UUID Helper ──────────────────────────────────────

export function ensureValidUuid(id: string): string {
  if (!id) {
    return '00000000-0000-4000-8000-000000000001';
  }
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(id)) {
    return id.toLowerCase();
  }

  // Generate deterministic 128-bit hex string from string content (FNV-1a / DJB2 mix)
  let h1 = 0x811c9dc5;
  let h2 = 0x5a176843;
  let h3 = 0x9e3779b9;
  let h4 = 0x67452301;

  for (let i = 0; i < id.length; i++) {
    const c = id.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193);
    h2 = Math.imul(h2 ^ (c << 3), 0x27d4eb2d);
    h3 = Math.imul(h3 ^ (c >> 2), 0x59964b73);
    h4 = Math.imul(h4 ^ (c * 31), 0x1e35a7bd);
  }

  const hex = (h: number) => (h >>> 0).toString(16).padStart(8, '0');
  const raw = `${hex(h1)}${hex(h2)}${hex(h3)}${hex(h4)}`;

  // Format as RFC 4122 v4 compliant UUID: 8-4-4-4-12
  return `${raw.substring(0, 8)}-${raw.substring(8, 12)}-4${raw.substring(13, 16)}-a${raw.substring(17, 20)}-${raw.substring(20, 32)}`;
}

// ─── Cache Layer for Persistent Exam & Coursework Sessions ───────────────────

const cachedSupabaseExamSessions = new Map<string, GradedExamSession>();
const cachedSupabaseSessions = new Map<string, DatasetSession>();

export function getCachedSupabaseExamSession(sessionId: string): GradedExamSession | null {
  if (cachedSupabaseExamSessions.has(sessionId)) {
    return cachedSupabaseExamSessions.get(sessionId)!;
  }
  const uuid = ensureValidUuid(sessionId);
  if (cachedSupabaseExamSessions.has(uuid)) {
    return cachedSupabaseExamSessions.get(uuid)!;
  }
  return null;
}

export function getCachedSupabaseSession(sessionId: string): DatasetSession | null {
  if (cachedSupabaseSessions.has(sessionId)) {
    return cachedSupabaseSessions.get(sessionId)!;
  }
  const uuid = ensureValidUuid(sessionId);
  if (cachedSupabaseSessions.has(uuid)) {
    return cachedSupabaseSessions.get(uuid)!;
  }
  return null;
}

// ─── Helpers to get Supabase client safely ───────────────────────────────────

function getClient() {
  return createBrowserClient();
}

// ─── 1. Persist Graded Exam Session to Supabase ──────────────────────────────

export async function persistExamSessionToSupabase(
  session: GradedExamSession
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    // 1. Try server action first for authoritative cookie-based server persistence
    try {
      if (typeof window !== 'undefined') {
        const actionResult = await persistExamSubmissionAction(session);
        if (actionResult.success) {
          cachedSupabaseExamSessions.set(session.sessionId, session);
          if (actionResult.id) {
            cachedSupabaseExamSessions.set(actionResult.id, session);
          }
          return actionResult;
        }
        console.warn('[SupabasePersistence] Server Action returned failure, falling back to client write:', actionResult.error);
      }
    } catch (actErr: any) {
      console.warn('[SupabasePersistence] Server Action error, falling back to browser client:', actErr?.message);
    }

    // 2. Direct browser client persistence fallback
    const supabase = getClient();
    const dbDeviceType = session.deviceType?.includes('mobile') ? 'mobile' : session.deviceType?.includes('tablet') ? 'tablet' : 'desktop';

    // Resolve authenticated student UUID
    let studentUuid: string | null = null;
    const { data: { user } } = await supabase.auth.getUser();

    if (user?.id) {
      let { data: sRow } = await supabase
        .from('students')
        .select('id, student_identifier')
        .eq('profile_id', user.id)
        .maybeSingle();

      if (!sRow?.id) {
        // Auto-provision student profile row if missing for authenticated user
        const stuIdent = session.studentId?.startsWith('S') || session.studentId?.startsWith('STU-')
          ? session.studentId
          : `STU-${user.id.substring(0, 8).toUpperCase()}`;

        const { data: newStudent, error: createStuErr } = await supabase
          .from('students')
          .upsert({
            profile_id: user.id,
            student_identifier: stuIdent,
            current_device_type: dbDeviceType,
          }, { onConflict: 'profile_id' })
          .select('id, student_identifier')
          .maybeSingle();

        if (createStuErr) {
          console.warn('[SupabasePersistence] Auto-provision student note:', createStuErr.message);
        }

        if (newStudent?.id) {
          sRow = newStudent;
        }
      }

      if (sRow?.id) {
        studentUuid = sRow.id;
      }
    }

    if (!studentUuid && session.studentId) {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(session.studentId);
      if (isUuid) {
        studentUuid = session.studentId;
      } else {
        const { data: studentRow } = await supabase
          .from('students')
          .select('id')
          .or(`student_identifier.eq.${session.studentId},student_identifier.eq.STU-${session.studentId}`)
          .maybeSingle();

        if (studentRow?.id) {
          studentUuid = studentRow.id;
        } else {
          studentUuid = ensureValidUuid(session.studentId);
        }
      }
    }

    if (!studentUuid) {
      studentUuid = ensureValidUuid(session.studentId || 'S001');
    }

    // Format deterministic UUID for exam session
    const sessionUuid = ensureValidUuid(session.sessionId);

    // Upsert exam_session record in public.exam_sessions
    const { data: examRow, error: examErr } = await supabase
      .from('exam_sessions')
      .upsert(
        {
          id: sessionUuid,
          student_id: studentUuid,
          device_type: dbDeviceType,
          status: 'analyzed',
          deviation_score: session.avgResponseTimeSec ? Number((session.avgResponseTimeSec / 100).toFixed(2)) : 0.25,
          confidence: 90,
          review_status: 'normal',
          started_at: session.startedAt || new Date().toISOString(),
          submitted_at: session.completedAt || new Date().toISOString(),
        },
        { onConflict: 'id' }
      )
      .select('id')
      .single();

    if (examErr) {
      console.error('[SupabasePersistence] exam_sessions upsert failed:', examErr);
      return { success: false, error: `Failed to persist exam session: ${examErr.message}` };
    }

    const examId = examRow?.id || sessionUuid;

    // Persist behavioral features telemetry
    if (examId && session.interactions && session.interactions.length > 0) {
      const featureRows = session.interactions.map((q, idx) => ({
        exam_session_id: examId,
        response_time: q.responseTimeSec || 25,
        revision_count: q.answerRevisionCount || 0,
        pointer_movement: q.pointerDistancePx || 450,
        scroll_distance: q.scrollDistancePx || 350,
        paste_detected: q.pasteDetected === 1,
        device_type: dbDeviceType,
        question_difficulty: q.questionDifficulty || 0.5,
        session_position: q.sessionPosition || idx + 1,
        event_timestamp: q.timestamp || new Date().toISOString(),
      }));

      const { error: featErr } = await supabase
        .from('behavioral_features')
        .insert(featureRows);

      if (featErr) {
        console.warn('[SupabasePersistence] Features insert notice:', featErr.message);
      }
    }

    cachedSupabaseExamSessions.set(session.sessionId, session);
    cachedSupabaseExamSessions.set(examId, session);

    return { success: true, id: examId };
  } catch (err: any) {
    console.error('[SupabasePersistence] Failed to persist exam session:', err);
    return { success: false, error: err.message || 'Unknown database error' };
  }
}

// ─── 2. Persist Coursework Session to Supabase ───────────────────────────────

export async function persistCourseworkSessionToSupabase(
  session: DatasetSession
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const supabase = await getClient();
    const dbDeviceType = session.deviceType?.includes('mobile') ? 'mobile' : session.deviceType?.includes('tablet') ? 'tablet' : 'desktop';

    // 1. Resolve student UUID
    const { data: { user } } = await supabase.auth.getUser();
    let studentUuid: string | null = null;

    if (user?.id) {
      const { data: sRow } = await supabase
        .from('students')
        .select('id')
        .eq('profile_id', user.id)
        .maybeSingle();

      if (sRow?.id) {
        studentUuid = sRow.id;
      }
    }

    if (!studentUuid && session.studentId) {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(session.studentId);
      if (isUuid) {
        studentUuid = session.studentId;
      } else {
        const { data: studentRow } = await supabase
          .from('students')
          .select('id')
          .or(`student_identifier.eq.${session.studentId},student_identifier.eq.STU-${session.studentId}`)
          .maybeSingle();

        if (studentRow?.id) {
          studentUuid = studentRow.id;
        } else {
          studentUuid = ensureValidUuid(session.studentId);
        }
      }
    }

    if (!studentUuid) {
      studentUuid = ensureValidUuid(session.studentId || 'S001');
    }

    const sessionUuid = ensureValidUuid(session.sessionId);

    const { data: behRow, error: behErr } = await supabase
      .from('behavioral_sessions')
      .upsert(
        {
          id: sessionUuid,
          student_id: studentUuid,
          session_type: session.sessionType === 'graded' ? 'graded_examination' : 'low_stakes',
          device_type: dbDeviceType,
          started_at: session.timestamp || new Date().toISOString(),
          completed_at: session.timestamp || new Date().toISOString(),
          review_status: 'normal',
        },
        { onConflict: 'id' }
      )
      .select('id')
      .maybeSingle();

    if (behErr) {
      console.warn('[SupabasePersistence] Behavioral session upsert notice:', behErr.message);
    }

    const sessionId = behRow?.id || sessionUuid;

    if (sessionId && session.interactions && session.interactions.length > 0) {
      const featureRows = session.interactions.map((q, idx) => ({
        session_id: sessionId,
        response_time: q.responseTimeSec || 25,
        revision_count: q.revisionCount || 0,
        pointer_movement: q.pointerDistancePx || 450,
        scroll_distance: q.scrollDistancePx || 350,
        paste_detected: Boolean(q.pasteDetected),
        device_type: dbDeviceType,
        question_difficulty: q.difficulty || 0.5,
        session_position: q.sessionPosition || idx + 1,
        event_timestamp: q.timestamp || new Date().toISOString(),
      }));

      const { error: featErr } = await supabase
        .from('behavioral_features')
        .insert(featureRows);

      if (featErr) {
        console.warn('[SupabasePersistence] Features insert notice:', featErr.message);
      }
    }

    cachedSupabaseSessions.set(session.sessionId, session);
    cachedSupabaseSessions.set(sessionId, session);

    return { success: true, id: sessionId };
  } catch (err: any) {
    console.warn('[SupabasePersistence] Failed to persist coursework session:', err.message);
    return { success: false, error: err.message };
  }
}

// ─── 3. Fetch Student Sessions from Supabase ─────────────────────────────────

export async function fetchStudentSessionsFromSupabase(
  studentIdentifier?: string
): Promise<DatasetSession[]> {
  try {
    const supabase = await getClient();

    // 1. Resolve student UUID
    let studentUuid: string | null = null;
    const { data: { user } } = await supabase.auth.getUser();

    if (user?.id) {
      const { data: sRow } = await supabase
        .from('students')
        .select('id, student_identifier')
        .eq('profile_id', user.id)
        .maybeSingle();

      if (sRow?.id) {
        studentUuid = sRow.id;
      }
    }

    if (!studentUuid && studentIdentifier) {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(studentIdentifier);
      if (isUuid) {
        studentUuid = studentIdentifier;
      } else {
        const { data: studentRow } = await supabase
          .from('students')
          .select('id')
          .or(`student_identifier.eq.${studentIdentifier},student_identifier.eq.STU-${studentIdentifier}`)
          .maybeSingle();

        if (studentRow?.id) {
          studentUuid = studentRow.id;
        } else {
          studentUuid = ensureValidUuid(studentIdentifier);
        }
      }
    }

    if (!studentUuid) {
      return [];
    }

    const sessions: DatasetSession[] = [];

    // 2. Fetch exam_sessions
    const { data: examData, error: examErr } = await supabase
      .from('exam_sessions')
      .select('*, behavioral_features(*)')
      .eq('student_id', studentUuid)
      .order('created_at', { ascending: false });

    if (!examErr && examData) {
      examData.forEach((es: any) => {
        const features = es.behavioral_features || [];
        const count = features.length;
        const totalResp = features.reduce((sum: number, f: any) => sum + (f.response_time || 0), 0);
        const totalRevs = features.reduce((sum: number, f: any) => sum + (f.revision_count || 0), 0);

        const datasetSess: DatasetSession = {
          sessionId: es.id,
          studentId: studentIdentifier || 'S001',
          sessionType: 'graded',
          timestamp: es.submitted_at || es.started_at || es.created_at,
          deviceType: `web_${es.device_type}`,
          questionCount: count || 5,
          avgResponseTimeSec: count > 0 ? Number((totalResp / count).toFixed(1)) : 25.0,
          avgRevisionCount: count > 0 ? Number((totalRevs / count).toFixed(1)) : 0.5,
          avgPointerSpeed: 240,
          totalScrollDistance: 600,
          hasPasteEvent: features.some((f: any) => f.paste_detected),
          hasBurstEvent: false,
          humanReviewLabel: es.review_status === 'review_required' ? 'anomalous' : 'clean_mock',
          interactions: features.map((f: any, idx: number) => ({
            questionId: f.question_id || `q_${idx + 1}`,
            recordId: f.id,
            difficulty: f.question_difficulty || 0.5,
            responseTimeSec: f.response_time || 25,
            revisionCount: f.revision_count || 0,
            revisionTimeSec: 0,
            correctness: 1,
            pointerDistancePx: f.pointer_movement || 450,
            pointerAvgSpeedPxS: 240,
            scrollDistancePx: f.scroll_distance || 350,
            scrollEvents: 3,
            pasteDetected: f.paste_detected,
            characterBurstFlag: false,
            deviceType: `web_${f.device_type}`,
            sessionPosition: f.session_position || idx + 1,
            timeOfDay: '14:00',
            timestamp: f.event_timestamp || f.created_at,
            sourceDataset: 'supabase_persisted',
            humanReviewLabel: es.review_status === 'review_required' ? 'anomalous' : 'clean_mock',
          })),
        };

        sessions.push(datasetSess);
        cachedSupabaseSessions.set(es.id, datasetSess);

        // Also cache as GradedExamSession for detail view
        cachedSupabaseExamSessions.set(es.id, {
          sessionId: es.id,
          studentId: studentIdentifier || 'S001',
          examId: es.assessment_id || 'PROTOTYPE_EXAM_01',
          examTitle: 'Core Engineering Mathematics & Logic Examination',
          sessionType: 'graded',
          deviceType: `web_${es.device_type}`,
          status: es.status === 'analyzed' ? 'completed' : es.status,
          startedAt: es.started_at,
          completedAt: es.submitted_at,
          questionCount: count || 5,
          completedQuestionsCount: count || 5,
          avgResponseTimeSec: count > 0 ? Number((totalResp / count).toFixed(1)) : 25.0,
          avgRevisionCount: count > 0 ? Number((totalRevs / count).toFixed(1)) : 0.5,
          hasPasteEvent: features.some((f: any) => f.paste_detected),
          hasBurstEvent: false,
          interactions: features.map((f: any, idx: number) => ({
            recordId: f.id,
            studentId: studentIdentifier || 'S001',
            sessionId: es.id,
            questionId: f.question_id || `q_${idx + 1}`,
            questionDifficulty: f.question_difficulty || 0.5,
            sessionPosition: f.session_position || idx + 1,
            selectedAnswerIndex: 0,
            responseTimeSec: f.response_time || 25,
            answerRevisionCount: f.revision_count || 0,
            answerRevisionTimeSec: 0,
            pointerDistancePx: f.pointer_movement || 450,
            pointerAvgSpeedPxS: 240,
            scrollDistancePx: f.scroll_distance || 350,
            scrollEvents: 3,
            pasteDetected: f.paste_detected ? 1 : 0,
            characterBurstFlag: 0,
            deviceType: `web_${f.device_type}`,
            timeOfDay: '14:00',
            timestamp: f.event_timestamp || f.created_at,
            isAnswerCorrect: true,
          })),
        });
      });
    }

    // 3. Fetch behavioral_sessions (low-stakes coursework)
    const { data: behData, error: behErr } = await supabase
      .from('behavioral_sessions')
      .select('*, behavioral_features(*)')
      .eq('student_id', studentUuid)
      .order('created_at', { ascending: false });

    if (!behErr && behData) {
      behData.forEach((bs: any) => {
        const features = bs.behavioral_features || [];
        const count = features.length;
        const totalResp = features.reduce((sum: number, f: any) => sum + (f.response_time || 0), 0);
        const totalRevs = features.reduce((sum: number, f: any) => sum + (f.revision_count || 0), 0);

        const datasetSess: DatasetSession = {
          sessionId: bs.id,
          studentId: studentIdentifier || 'S001',
          sessionType: bs.session_type === 'graded_examination' ? 'graded' : 'low_stakes',
          timestamp: bs.completed_at || bs.started_at || bs.created_at,
          deviceType: `web_${bs.device_type}`,
          questionCount: count || 5,
          avgResponseTimeSec: count > 0 ? Number((totalResp / count).toFixed(1)) : 30.0,
          avgRevisionCount: count > 0 ? Number((totalRevs / count).toFixed(1)) : 0.5,
          avgPointerSpeed: 250,
          totalScrollDistance: 500,
          hasPasteEvent: features.some((f: any) => f.paste_detected),
          hasBurstEvent: false,
          humanReviewLabel: 'clean_mock',
          interactions: features.map((f: any, idx: number) => ({
            questionId: f.question_id || `q_${idx + 1}`,
            recordId: f.id,
            difficulty: f.question_difficulty || 0.5,
            responseTimeSec: f.response_time || 30,
            revisionCount: f.revision_count || 0,
            revisionTimeSec: 0,
            correctness: 1,
            pointerDistancePx: f.pointer_movement || 500,
            pointerAvgSpeedPxS: 250,
            scrollDistancePx: f.scroll_distance || 400,
            scrollEvents: 4,
            pasteDetected: f.paste_detected,
            characterBurstFlag: false,
            deviceType: `web_${f.device_type}`,
            sessionPosition: f.session_position || idx + 1,
            timeOfDay: '10:00',
            timestamp: f.event_timestamp || f.created_at,
            sourceDataset: 'supabase_persisted',
            humanReviewLabel: 'clean_mock',
          })),
        };

        sessions.push(datasetSess);
        cachedSupabaseSessions.set(bs.id, datasetSess);
      });
    }

    return sessions;
  } catch (err: any) {
    console.warn('[SupabasePersistence] Fetch sessions notice:', err.message);
    return [];
  }
}

// ─── 4. Realtime Subscription Channel ────────────────────────────────────────

export function subscribeToStudentSessions(
  studentIdentifier: string,
  onUpdate: () => void
): () => void {
  if (typeof window === 'undefined') return () => {};

  try {
    const supabase = createBrowserClient();
    const channel = supabase
      .channel(`student_sessions_${studentIdentifier}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'exam_sessions' },
        () => onUpdate()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'behavioral_sessions' },
        () => onUpdate()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  } catch (err) {
    return () => {};
  }
}
