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
          feature_name, observed_value, expected_value, deviation
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

    // 3. Map features back to the format expected by the crypto engine
    // The canonical payload uses: sessionId, features, etc.
    const rawFeatures = examSession.behavioral_features || [];
    
    // We map the array of features to the canonical format (or object format depending on cryptoEngine).
    // Let's format them as the `ExamSession` object expects.
    const featuresObj: Record<string, number> = {};
    (rawFeatures as any[]).forEach(f => {
      featuresObj[f.feature_name] = f.observed_value;
    });

    const sessionMock: any = {
      id: examSession.id,
      studentId: examSession.student_id,
      deviceType: examSession.device_type,
      date: examSession.started_at,
      features: featuresObj,
    };

    // 4. Verify
    const payload = buildCanonicalPayload(sessionMock);
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
