import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logAudit } from '@/lib/services/audit';
import { buildBehavioralModel } from '@/lib/modelingEngine';

// Server-side orchestration for Closed-Loop update
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { sessionId, decision, notes } = await request.json();

    if (!sessionId || !decision) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (!['verified', 'not_verified', 'disputed'].includes(decision)) {
      return NextResponse.json({ error: 'Invalid decision' }, { status: 400 });
    }

    // 1. Verify instructor profile exists
    const { data: instructorRow } = await supabase
      .from('instructors')
      .select('id')
      .eq('profile_id', user.id)
      .single();

    if (!instructorRow) {
      return NextResponse.json({ error: 'Unauthorized instructor' }, { status: 403 });
    }

    // 2. Fetch session and determine student
    const { data: sessionData, error: sessionError } = await supabase
      .from('exam_sessions')
      .select('id, student_id')
      .eq('id', sessionId)
      .single();

    if (sessionError || !sessionData) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const studentId = sessionData.student_id;

    // 3. Verify instructor is assigned to this student
    const { data: assignment } = await supabase
      .from('instructor_students')
      .select('*')
      .eq('instructor_id', instructorRow.id)
      .eq('student_id', studentId)
      .single();

    if (!assignment) {
      return NextResponse.json({ error: 'Not assigned to this student' }, { status: 403 });
    }

    // 4. The RPC keeps the session status and review row in one transaction.
    const { error: reviewError } = await supabase.rpc('review_exam_session', {
      p_exam_session_id: sessionId,
      p_decision: decision,
      p_notes: notes || null,
    });

    if (reviewError) {
      return NextResponse.json({ error: 'Failed to save review' }, { status: 500 });
    }

    await logAudit(user.id, 'review_submitted', 'exam_sessions', sessionId, { decision });

    let rebuildResult = null;

    // 5. Trigger closed-loop update if verified
    if (decision === 'verified') {
      rebuildResult = await rebuildModelForStudent(supabase, studentId);
      
      if (!rebuildResult.success) {
        // Record failure
        await logAudit(user.id, 'model_rebuild_failed', 'students', studentId, { error: rebuildResult.error });
        // The instructions say: "do not falsely represent the model as updated"
        return NextResponse.json({
          success: true,
          modelUpdated: false,
          error: rebuildResult.error
        });
      }

      await logAudit(user.id, 'model_rebuild_success', 'students', studentId, { 
        confidence: rebuildResult.confidence,
        threshold: rebuildResult.calibratedThreshold
      });
    }

    return NextResponse.json({ 
      success: true, 
      modelUpdated: decision === 'verified' && rebuildResult?.success,
      modelData: rebuildResult?.modelData 
    });

  } catch (error: any) {
    console.error('[API Reviews POST]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// ─── Server-Side Orchestration ────────────────────────────────────────────────

async function rebuildModelForStudent(supabase: any, studentId: string) {
  try {
    // 1. Fetch eligible behavioral sessions
    const { data: behavioralSessions } = await supabase
      .from('behavioral_sessions')
      .select(`
        id, student_id, device_type, created_at,
        behavioral_features ( response_time, pointer_movement, scroll_distance, revision_count, paste_detected )
      `)
      .eq('student_id', studentId);

    // 2. Fetch eligible exam sessions (low stakes or verified)
    const { data: examSessions } = await supabase
      .from('exam_sessions')
      .select(`
        id, student_id, device_type, started_at, status, review_status,
        assessments ( assessment_code ),
        behavioral_features ( response_time, pointer_movement, scroll_distance, revision_count, paste_detected )
      `)
      .eq('student_id', studentId);

    // Map to domain format
    const domainSessions: any[] = [];
    
    (behavioralSessions || []).forEach((s: any) => {
      const features = aggregateFeatures(s.behavioral_features || []);
      domainSessions.push({
        id: s.id,
        studentId: s.student_id,
        deviceType: s.device_type,
        date: s.created_at,
        type: 'low_stakes',
        features
      });
    });

    (examSessions || []).forEach((s: any) => {
      // Must be eligible
      const isExam = !!s.assessments;
      const type = isExam ? 'graded_examination' : 'low_stakes';
      if (type === 'graded_examination' && s.review_status !== 'verified') return; // Skip ineligible

      const features = aggregateFeatures(s.behavioral_features || []);
      domainSessions.push({
        id: s.id,
        studentId: s.student_id,
        deviceType: s.device_type,
        date: s.started_at,
        type,
        features
      });
    });

    const deviceSessions = domainSessions.filter(s => s.deviceType === 'desktop');
    
    if (deviceSessions.length === 0) {
      return { success: false, error: 'No eligible sessions found to build model' };
    }

    // 3. Build model using existing modeling engine
    const model = buildBehavioralModel(studentId, deviceSessions);

    if (model.status !== 'active') {
      return { success: false, error: 'Insufficient data for active model' };
    }

    // 4. Persist via the atomic RPC
    const featuresArr = model.expectations.map(e => ({
      feature_name: e.feature,
      expected_value: e.mean,
      uncertainty: model.uncertainties.find(u => u.feature === e.feature)?.uncertainty ?? null,
      variance: Math.pow(e.stdDev, 2),
      standard_deviation: e.stdDev,
      lower_bound: e.min,
      upper_bound: e.max,
    }));

    const { error: rpcErr } = await supabase.rpc('persist_behavioral_model', {
      p_student_id: studentId,
      p_device_type: 'desktop',
      p_session_count: model.sessionCount,
      p_model_status: model.status,
      p_confidence: model.confidence,
      p_calibrated_threshold: model.calibratedThreshold ?? null,
      p_target_fpr: null,
      p_training_count: model.sessionCount,
      p_calibration_count: null,
      p_expectations: featuresArr,
    });

    if (rpcErr) {
      console.error('[RebuildModel] RPC failed:', rpcErr);
      return { success: false, error: 'Database persistence failed' };
    }

    return { 
      success: true, 
      confidence: model.confidence, 
      calibratedThreshold: model.calibratedThreshold,
      modelData: model
    };

  } catch (err: any) {
    console.error('[RebuildModel] Exception:', err);
    return { success: false, error: err.message };
  }
}

function aggregateFeatures(features: Array<{
  response_time?: number | null;
  pointer_movement?: number | null;
  scroll_distance?: number | null;
  revision_count?: number | null;
  paste_detected?: boolean | null;
}>) {
  const count = features.length || 1;
  return features.reduce(
    (total, feature) => ({
      responseTime: total.responseTime + (feature.response_time ?? 0) / count,
      pointerMovement: total.pointerMovement + (feature.pointer_movement ?? 0) / count,
      scrollDistance: total.scrollDistance + (feature.scroll_distance ?? 0) / count,
      revisionCount: total.revisionCount + (feature.revision_count ?? 0) / count,
      pasteDetected: total.pasteDetected + (feature.paste_detected ? 100 / count : 0),
    }),
    { responseTime: 0, pointerMovement: 0, scrollDistance: 0, revisionCount: 0, pasteDetected: 0 }
  );
}
