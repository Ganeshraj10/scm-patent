/**
 * ExamGuard — API Route: POST /api/sessions/behavioral
 *
 * Server-side entry point for low-stakes behavioral session persistence.
 * Calls the create_behavioral_session_with_features Postgres RPC which
 * atomically inserts behavioral_sessions + behavioral_features in a single
 * server-side transaction.
 *
 * Security:
 * - Authenticates caller via Supabase Auth session cookie.
 * - Resolves the authoritative students.id from auth.uid() server-side.
 * - The client does NOT supply student_id — it is derived from the session.
 * - Ownership is re-verified inside the RPC via auth.uid() anyway.
 * - No credentials are ever exposed to the browser.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // ── Auth check ───────────────────────────────────────────
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized: not authenticated' },
        { status: 401 }
      );
    }

    // ── Resolve authoritative student UUID server-side ───────
    // Do NOT trust any student_id supplied by the client.
    // Look up the student whose profile_id matches the authenticated user.
    const { data: studentRow, error: studentError } = await supabase
      .from('students')
      .select('id')
      .eq('profile_id', user.id)
      .single();

    if (studentError || !studentRow) {
      const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';
      if (isDemoMode && (studentError?.code === 'PGRST116' || !studentRow)) {
        // Demo mode: no student row yet — return a controlled demo response
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

    // ── Basic required field validation ──────────────────────
    // Note: student_id is NOT required from the client — resolved above.
    if (!body.session_type || typeof body.session_type !== 'string') {
      return NextResponse.json({ error: 'session_type is required' }, { status: 400 });
    }
    if (!body.device_type || typeof body.device_type !== 'string') {
      return NextResponse.json({ error: 'device_type is required' }, { status: 400 });
    }
    if (!Array.isArray(body.features)) {
      return NextResponse.json({ error: 'features must be an array' }, { status: 400 });
    }

    // ── Sanitize feature data ─────────────────────────────────
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

    const rpcInput = {
      student_id:    authoritative_student_id,  // server-resolved, never client-supplied
      assessment_id: body.assessment_id ?? null,
      session_type:  body.session_type,
      device_type:   body.device_type,
      started_at:    body.started_at ?? null,
      completed_at:  body.completed_at ?? new Date().toISOString(),
      features:      sanitizedFeatures,
    };

    // ── Call the Postgres RPC ────────────────────────────────
    const { data, error } = await supabase.rpc(
      'create_behavioral_session_with_features',
      { p_input: rpcInput }
    );

    if (error) {
      console.error('[POST /api/sessions/behavioral] RPC error:', error);
      const status = error.code === '28000' ? 401
                   : error.code === '42501' ? 403
                   : 500;
      return NextResponse.json(
        { error: 'Failed to save behavioral session', detail: error.message },
        { status }
      );
    }

    return NextResponse.json(data, { status: 201 });

  } catch (err) {
    console.error('[POST /api/sessions/behavioral] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * GET /api/sessions/behavioral
 * Returns behavioral sessions visible to the authenticated user (via RLS).
 */
export async function GET() {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // RLS enforces visibility — students see own sessions, instructors see assigned
    const { data, error } = await supabase
      .from('behavioral_sessions')
      .select(`
        id,
        student_id,
        assessment_id,
        session_type,
        device_type,
        started_at,
        completed_at,
        review_status,
        created_at,
        behavioral_features ( id, question_id, response_time, revision_count,
          pointer_movement, scroll_distance, paste_detected, device_type,
          question_difficulty, session_position, event_timestamp )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data ?? []);

  } catch (err) {
    console.error('[GET /api/sessions/behavioral] Unexpected error:', err);
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
