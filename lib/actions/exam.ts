'use server';

import { createClient } from '@/lib/supabase/server';
import { GradedExamSession } from '@/types';
import { ensureValidUuid } from '@/lib/services/supabaseSessionService';

/**
 * Server Action: Authoritatively persist a completed graded examination attempt
 * to the hosted Supabase database.
 * 
 * Runs in serverless environment on Vercel with direct access to session cookies.
 */
export async function persistExamSubmissionAction(
  session: GradedExamSession
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const supabase = await createClient();

    // 1. Resolve authenticated user from request session cookies
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    let studentUuid: string | null = null;
    let resolvedIdentifier: string = session.studentId || 'S001';

    const dbDeviceType = session.deviceType?.includes('mobile') ? 'mobile' : session.deviceType?.includes('tablet') ? 'tablet' : 'desktop';

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
          console.warn('[persistExamSubmissionAction] Auto-provision student note:', createStuErr.message);
        }

        if (newStudent?.id) {
          sRow = newStudent;
        }
      }

      if (sRow?.id) {
        studentUuid = sRow.id;
        resolvedIdentifier = sRow.student_identifier || resolvedIdentifier;
      }
    }

    if (!studentUuid && session.studentId) {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(session.studentId);
      if (isUuid) {
        studentUuid = session.studentId;
      } else {
        const { data: studentRow } = await supabase
          .from('students')
          .select('id, student_identifier')
          .or(`student_identifier.eq.${session.studentId},student_identifier.eq.STU-${session.studentId}`)
          .maybeSingle();

        if (studentRow?.id) {
          studentUuid = studentRow.id;
          resolvedIdentifier = studentRow.student_identifier || resolvedIdentifier;
        } else {
          studentUuid = ensureValidUuid(session.studentId);
        }
      }
    }

    if (!studentUuid) {
      studentUuid = ensureValidUuid(session.studentId || 'S001');
    }

    // 2. Format deterministic UUID for exam session
    const sessionUuid = ensureValidUuid(session.sessionId);

    // 3. Upsert exam_session record in public.exam_sessions
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
      console.error('[persistExamSubmissionAction] exam_sessions upsert failed:', examErr);
      return { success: false, error: `Failed to persist exam session: ${examErr.message}` };
    }

    const examId = examRow?.id || sessionUuid;

    // 4. Persist behavioral features telemetry
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
        console.warn('[persistExamSubmissionAction] Features insert notice:', featErr.message);
      }
    }

    return { success: true, id: examId };
  } catch (err: any) {
    console.error('[persistExamSubmissionAction] Unhandled exception:', err);
    return { success: false, error: err.message || 'Unknown server error during exam persistence' };
  }
}
