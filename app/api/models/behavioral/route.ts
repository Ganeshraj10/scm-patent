import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // 1. Auth check
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized: not authenticated' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const deviceType = searchParams.get('deviceType') || 'desktop';
    const queryStudentId = searchParams.get('studentId');

    let targetStudentId = queryStudentId;

    if (!targetStudentId) {
      // 2. Resolve authoritative student UUID for the current user
      const { data: studentRow, error: studentError } = await supabase
        .from('students')
        .select('id')
        .eq('profile_id', user.id)
        .single();

      if (studentError || !studentRow) {
        const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';
        if (isDemoMode) {
          return NextResponse.json(
            { error: 'Demo mode fallback.' },
            { status: 422 }
          );
        }
        return NextResponse.json(
          { error: 'Student profile not found for authenticated user.' },
          { status: 403 }
        );
      }
      targetStudentId = studentRow.id;
    }

    // 3. Fetch model
    const { data: model, error: modelError } = await supabase
      .from('behavioral_models')
      .select(`
        id, student_id, device_type, session_count, model_status, confidence,
        calibrated_threshold, target_false_positive_rate, training_session_count,
        calibration_session_count, updated_at,
        feature_expectations (
          feature_name, expected_value, uncertainty, variance, standard_deviation, lower_bound, upper_bound
        ),
        calibration_results (
          target_false_positive_rate, calibrated_threshold, training_session_count, calibration_session_count, calibration_method
        )
      `)
      .eq('student_id', targetStudentId)
      .eq('device_type', deviceType)
      .maybeSingle();

    if (modelError) {
      return NextResponse.json({ error: modelError.message }, { status: 500 });
    }

    if (!model) {
      return NextResponse.json({ data: null });
    }

    return NextResponse.json({ data: model });
  } catch (error) {
    console.error('[API GET /models/behavioral]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // 1. Auth check
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized: not authenticated' }, { status: 401 });
    }

    // 2. Resolve authoritative student UUID
    const { data: studentRow, error: studentError } = await supabase
      .from('students')
      .select('id')
      .eq('profile_id', user.id)
      .single();

    if (studentError || !studentRow) {
      const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';
      if (isDemoMode) {
        return NextResponse.json(
          { error: 'Demo mode fallback.' },
          { status: 422 }
        );
      }
      return NextResponse.json(
        { error: 'Student profile not found for authenticated user.' },
        { status: 403 }
      );
    }

    const authoritative_student_id = studentRow.id;
    let body: Record<string, any>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const {
      device_type,
      session_count,
      model_status,
      confidence,
      calibrated_threshold,
      target_fpr,
      training_count,
      calibration_count,
      expectations,
    } = body;

    if (!device_type || !['desktop', 'mobile', 'tablet'].includes(device_type)) {
      return NextResponse.json({ error: 'Invalid device type' }, { status: 400 });
    }

    // 3. Call RPC
    const { data: rpcData, error: rpcError } = await supabase.rpc('persist_behavioral_model', {
      p_student_id: authoritative_student_id,
      p_device_type: device_type,
      p_session_count: session_count ?? 0,
      p_model_status: model_status ?? 'cold_start',
      p_confidence: confidence ?? 0,
      p_calibrated_threshold: calibrated_threshold ?? null,
      p_target_fpr: target_fpr ?? null,
      p_training_count: training_count ?? null,
      p_calibration_count: calibration_count ?? null,
      p_expectations: expectations ?? [],
    });

    if (rpcError) {
      return NextResponse.json({ error: rpcError.message }, { status: 500 });
    }

    return NextResponse.json(rpcData);
  } catch (error) {
    console.error('[API POST /models/behavioral]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
