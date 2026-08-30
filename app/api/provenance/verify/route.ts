import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logAudit } from '@/lib/services/audit';
import { buildCanonicalPayload, verifySessionCommitment } from '@/lib/cryptoEngine';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { sessionId } = await request.json();

    if (!sessionId) {
      return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });
    }

    // 1. Fetch exam session, features, and commitments
    const { data: examSession, error: examError } = await supabase
      .from('exam_sessions')
      .select(`
        id, student_id, device_type, started_at, submitted_at,
        behavioral_features (
          question_id, response_time, pointer_movement, scroll_distance,
          revision_count, paste_detected, device_type, question_difficulty,
          session_position, event_timestamp
        ),
        cryptographic_commitments (
          hash, algorithm, payload_version, created_at
        )
      `)
      .eq('id', sessionId)
      .single();

    if (examError || !examSession) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // 2. Extract commitment
    const commitments = examSession.cryptographic_commitments as any;
    const commitment = Array.isArray(commitments) ? commitments[0] : commitments;
    
    if (!commitment || !commitment.hash) {
      return NextResponse.json({ error: 'No commitment found for this session' }, { status: 404 });
    }

    // 3. Map features back to the array expected by the crypto engine
    const rawFeatures = (examSession.behavioral_features as any[]) || [];
    const mappedFeatures = rawFeatures.map((f, idx) => ({
      questionId: f.question_id || `q-${idx}`,
      responseTime: f.response_time ?? 0,
      revisionCount: f.revision_count ?? 0,
      pointerMovement: f.pointer_movement ?? 0,
      scrollDistance: f.scroll_distance ?? 0,
      pasteDetected: Boolean(f.paste_detected),
      deviceType: f.device_type || examSession.device_type,
      questionDifficulty: f.question_difficulty ?? undefined,
      sessionPosition: f.session_position ?? idx,
      eventTimestamp: f.event_timestamp ?? null,
    }));

    const sessionPayload: any = {
      id: examSession.id,
      studentId: examSession.student_id,
      deviceType: examSession.device_type,
      startTime: examSession.started_at,
      features: mappedFeatures,
    };

    // 4. Verify
    const payload = buildCanonicalPayload(sessionPayload);
    const isValid = await verifySessionCommitment(payload, commitment.hash);

    // 5. Audit Log
    await logAudit(
      user.id, 
      'provenance_verified', 
      'exam_sessions', 
      sessionId, 
      { valid: isValid, hash: commitment.hash }
    );

    return NextResponse.json({ verified: isValid });

  } catch (error: any) {
    console.error('[API Provenance Verify]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
