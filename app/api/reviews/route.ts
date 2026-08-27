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

    // 4. Update the review and the session in a safe way
    // First, update exam_sessions
    const { error: updateExamErr } = await supabase
      .from('exam_sessions')
      .update({ review_status: decision })
      .eq('id', sessionId);

    if (updateExamErr) {
      return NextResponse.json({ error: 'Failed to update session status' }, { status: 500 });
    }

    // Upsert the review record
    const { error: reviewErr } = await supabase
      .from('reviews')
      .upsert({
        exam_session_id: sessionId,
        instructor_id: instructorRow.id,
        decision,
        notes: notes || null,
        reviewed_at: new Date().toISOString()
      }, { onConflict: 'exam_session_id' });

    if (reviewErr) {
      console.error('[Review API] Review upsert failed', reviewErr);
      // Not fatal if session updated, but should log
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
        behavioral_features ( feature_name, observed_value )
      `)
      .eq('student_id', studentId);

    // 2. Fetch eligible exam sessions (low stakes or verified)
    const { data: examSessions } = await supabase
      .from('exam_sessions')
      .select(`
        id, student_id, device_type, started_at, status, review_status,
        assessments ( assessment_code ),
        behavioral_features ( feature_name, observed_value )
      `)
      .eq('student_id', studentId);

    // Map to domain format
    const domainSessions: any[] = [];
    
    (behavioralSessions || []).forEach((s: any) => {
      const features: Record<string, number> = {};
      s.behavioral_features.forEach((f: any) => { features[f.feature_name] = f.observed_value; });
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

      const features: Record<string, number> = {};
      s.behavioral_features.forEach((f: any) => { features[f.feature_name] = f.observed_value; });
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
      feature: e.feature,
      expected: e.mean,
      variance: Math.pow(e.stdDev, 2)
    }));

    const rpcInput = {
      student_id: studentId,
      device_type: 'desktop',
      model_status: model.status,
      confidence: model.confidence,
      calibrated_threshold: model.calibratedThreshold ?? null,
      session_count: model.sessionCount,
      feature_expectations: featuresArr
    };

    const { error: rpcErr } = await supabase.rpc('persist_behavioral_model', { p_input: rpcInput });

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
