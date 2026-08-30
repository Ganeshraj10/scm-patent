/**
 * ExamGuard — API Route: POST /api/sessions/exam
 *
 * Server-side entry point for graded exam session persistence.
 * Calls the create_exam_session_atomic Postgres RPC which atomically inserts:
 *   exam_sessions + behavioral_features + deviation_analyses + feature_contributions
 *
 * All four tables succeed or all fail — no partial records.
 *
 * Security:
 * - Authenticates caller via Supabase Auth session cookie.
 * - Resolves the authoritative students.id from auth.uid() server-side.
 * - The client does NOT supply student_id — it is derived from the authenticated session.
 * - Ownership re-verified inside RPC via auth.uid() as additional defense.
 * - Authoritative fields (deviation_score, threshold, confidence, review_status)
 *   are validated inside the RPC — client cannot override them silently.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { evaluateSessionDeviation } from '@/lib/deviationEngine';
import { logAudit } from '@/lib/services/audit';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // ── Auth check ───────────────────────────────────────────
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized: not authenticated' }, { status: 401 });
    }

    // ── Resolve authoritative student UUID server-side ───────
    // The client does NOT supply student_id — we derive it from auth.uid().
    // This prevents any client from submitting under an arbitrary student UUID.
    const { data: studentRow, error: studentError } = await supabase
      .from('students')
      .select('id')
      .eq('profile_id', user.id)
      .single();

    if (studentError || !studentRow) {
      const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';
      if (isDemoMode && (studentError?.code === 'PGRST116' || !studentRow)) {
        return NextResponse.json(
          { error: 'No student profile found. Running in demo mode — session not persisted.' },
          { status: 422 }
        );
      }
      return NextResponse.json(
        { error: 'Student profile not found for authenticated user.' },
        { status: 403 }
      );
    }

    const authoritative_student_id = studentRow.id;

    // ── Parse body ───────────────────────────────────────────
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    // ── Required field validation ──────────────────────────────
    // Note: student_id is NOT required from the client — resolved above.
    const requiredFields = ['device_type', 'deviation_score',
                            'personalized_threshold', 'confidence', 'review_status'];
    for (const field of requiredFields) {
      if (body[field] === undefined || body[field] === null) {
        return NextResponse.json({ error: `${field} is required` }, { status: 400 });
      }
    }

    if (!Array.isArray(body.features)) {
      return NextResponse.json({ error: 'features must be an array' }, { status: 400 });
    }

    // ── Validate numeric authoritative fields client-side ────
    const deviationScore = Number(body.deviation_score);
    const threshold      = Number(body.personalized_threshold);
    const confidence     = Number(body.confidence);

    if (!isFinite(deviationScore) || deviationScore < 0) {
      return NextResponse.json({ error: 'deviation_score must be a non-negative finite number' }, { status: 400 });
    }
    if (!isFinite(threshold)) {
      return NextResponse.json({ error: 'personalized_threshold must be a finite number' }, { status: 400 });
    }
    if (!isFinite(confidence) || confidence < 0 || confidence > 100) {
      return NextResponse.json({ error: 'confidence must be between 0 and 100' }, { status: 400 });
    }

    // ── Sanitize features ─────────────────────────────────────
    const sanitizedFeatures = (body.features as Record<string, unknown>[]).map((f) => ({
      question_id:         f.question_id ?? null,
      response_time:       sanitizeNumeric(f.response_time),
      revision_count:      Math.max(0, sanitizeNumeric(f.revision_count) ?? 0),
      pointer_movement:    Math.max(0, sanitizeNumeric(f.pointer_movement) ?? 0),
      scroll_distance:     Math.max(0, sanitizeNumeric(f.scroll_distance) ?? 0),
      paste_detected:      Boolean(f.paste_detected),
      device_type:         body.device_type,
      question_difficulty: sanitizeNumeric(f.question_difficulty),
      event_timestamp:     typeof f.event_timestamp === 'string' ? f.event_timestamp : new Date().toISOString(),
    }));

    // ── Sanitize feature contributions ───────────────────────
    const rawContributions = Array.isArray(body.feature_contributions)
      ? body.feature_contributions as Record<string, unknown>[]
      : [];

    let finalContributions = rawContributions.map((c) => ({
      feature:      String(c.feature ?? ''),
      observed:     sanitizeNumeric(c.observed),
      expected:     sanitizeNumeric(c.expected),
      deviation:    sanitizeNumeric(c.deviation),
      contribution: sanitizeNumeric(c.contribution),
      direction:    validateDirection(c.direction),
    }));

    // ── Server-Side Authoritative Mahalanobis Recomputation ────
    let finalDeviationScore = deviationScore;
    let finalThreshold = threshold;
    let finalConfidence = confidence;
    let finalReviewStatus = body.review_status;

    // Query active behavioral model for student & device
    const { data: modelRow } = await supabase
      .from('behavioral_models')
      .select(`
        id, student_id, device_type, session_count, model_status, confidence,
        calibrated_threshold, mahalanobis_parameters,
        feature_expectations (
          feature_name, expected_value, standard_deviation, lower_bound, upper_bound
        )
      `)
      .eq('student_id', authoritative_student_id)
      .eq('device_type', body.device_type)
      .maybeSingle();

    if (modelRow && modelRow.feature_expectations && modelRow.feature_expectations.length > 0) {
      const exps = modelRow.feature_expectations.map((e: any) => ({
        feature: e.feature_name,
        label: e.feature_name,
        unit: '',
        mean: Number(e.expected_value),
        stdDev: Number(e.standard_deviation),
        min: Number(e.lower_bound),
        max: Number(e.upper_bound),
      }));

      const mp = modelRow.mahalanobis_parameters as any;
      const serverModel = {
        studentId: authoritative_student_id,
        status: modelRow.model_status,
        sessionCount: modelRow.session_count,
        minimumSessionsRequired: 10,
        confidence: Number(modelRow.confidence ?? 0),
        lastUpdated: new Date().toISOString(),
        expectations: exps,
        uncertainties: [],
        calibratedThreshold: modelRow.calibrated_threshold ? Number(modelRow.calibrated_threshold) : undefined,
        covarianceMatrix: mp?.covariance_matrix ?? undefined,
        correlationMatrix: mp?.correlation_matrix ?? undefined,
        inverseCorrelationMatrix: mp?.inverse_correlation_matrix ?? undefined,
        shrinkageLambda: mp?.shrinkage_lambda ? Number(mp.shrinkage_lambda) : undefined,
        featureOrder: mp?.feature_order ?? undefined,
      };

      const domainSession = {
        id: 'server-eval',
        studentId: authoritative_student_id,
        studentName: '',
        examName: '',
        examCode: '',
        type: 'graded_examination',
        startTime: typeof body.started_at === 'string' ? body.started_at : new Date().toISOString(),
        endTime: typeof body.submitted_at === 'string' ? body.submitted_at : new Date().toISOString(),
        duration: 0,
        questionCount: sanitizedFeatures.length,
        deviceType: body.device_type,
        features: sanitizedFeatures.map((f, idx) => ({
          questionId: (f.question_id as string) || `q-${idx}`,
          responseTime: f.response_time ?? 0,
          pointerMovement: f.pointer_movement ?? 0,
          scrollDistance: f.scroll_distance ?? 0,
          revisionCount: f.revision_count ?? 0,
          pasteDetected: f.paste_detected,
          deviceType: body.device_type,
        })),
        reviewStatus: 'normal',
      };

      const serverAnalysis = evaluateSessionDeviation(domainSession as any, serverModel as any);
      finalDeviationScore = serverAnalysis.deviationScore;
      finalThreshold = serverAnalysis.personalizedThreshold;
      finalConfidence = serverAnalysis.confidence;
      finalReviewStatus = serverAnalysis.reviewRequired ? 'review_required' : 'normal';
      finalContributions = serverAnalysis.featureContributions.map((fc) => ({
        feature: fc.feature,
        observed: fc.observed,
        expected: fc.expected,
        deviation: fc.deviation,
        contribution: fc.contribution,
        direction: validateDirection(fc.direction),
      }));
    }

    const rpcInput = {
      student_id:             authoritative_student_id, // server-resolved, never client-supplied
      assessment_id:          body.assessment_id ?? null,
      device_type:            body.device_type,
      started_at:             body.started_at ?? null,
      submitted_at:           body.submitted_at ?? new Date().toISOString(),
      deviation_score:        finalDeviationScore,
      personalized_threshold: finalThreshold,
      confidence:             finalConfidence,
      review_status:          finalReviewStatus,
      features:               sanitizedFeatures,
      feature_contributions:  finalContributions,
    };

    // ── Call the atomic Postgres RPC ─────────────────────────
    const { data, error } = await supabase.rpc(
      'create_exam_session_atomic',
      { p_input: rpcInput }
    );

    if (error) {
      console.error('[POST /api/sessions/exam] RPC error:', error);
      const status = error.code === '28000' ? 401
                   : error.code === '42501' ? 403
                   : 500;
      return NextResponse.json(
        { error: 'Failed to save exam session', detail: error.message },
        { status }
      );
    }

    // ── Audit Log ─────────────────────────────────────────────
    if (data?.exam_session_id) {
      await logAudit(
        user.id,
        'exam_session_submitted',
        'exam_sessions',
        data.exam_session_id,
        {
          deviation_score: finalDeviationScore,
          review_status: finalReviewStatus,
          confidence: finalConfidence,
        }
      );
    }

    // data contains { exam_session_id, deviation_analysis_id }
    return NextResponse.json(data, { status: 201 });

  } catch (err) {
    console.error('[POST /api/sessions/exam] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * GET /api/sessions/exam?studentId=...
 * Returns exam sessions visible to the authenticated user.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get('studentId');

    let query = supabase
      .from('exam_sessions')
      .select(`
        id,
        student_id,
        assessment_id,
        device_type,
        started_at,
        submitted_at,
        status,
        deviation_score,
        personalized_threshold,
        confidence,
        review_status,
        created_at,
        students ( profile_id, student_identifier,
          profiles ( full_name, email ) ),
        assessments ( assessment_code, title ),
        deviation_analyses ( id, deviation_score, personalized_threshold, status,
          feature_contributions ( feature_name, observed_value, expected_value,
            deviation, contribution, direction ) )
      `)
      .order('created_at', { ascending: false });

    if (studentId) {
      query = query.eq('student_id', studentId);
    }

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data ?? []);

  } catch (err) {
    console.error('[GET /api/sessions/exam] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sanitizeNumeric(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  if (!isFinite(n) || isNaN(n)) return null;
  return n;
}

function validateDirection(dir: unknown): string {
  const valid = ['higher_than_expected', 'lower_than_expected', 'within_expected_range'];
  return valid.includes(String(dir)) ? String(dir) : 'within_expected_range';
}
