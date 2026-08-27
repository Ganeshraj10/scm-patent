import { BehavioralSession, CryptographicCommitment } from '@/types';

const PAYLOAD_VERSION = 'examguard-provenance-v1';

/**
 * Deterministically constructs the canonical provenance payload for a session.
 * Excludes all typed answers, raw content, and audio/video to align with the patent.
 */
export function buildCanonicalPayload(session: BehavioralSession): string {
  // Extract strictly the provenance-relevant metadata
  const features = session.features || [];
  
  // Sort deterministically (by sessionPosition, then questionId as fallback)
  const sortedFeatures = [...features].sort((a, b) => {
    if (a.sessionPosition !== undefined && b.sessionPosition !== undefined) {
      return a.sessionPosition - b.sessionPosition;
    }
    return a.questionId.localeCompare(b.questionId);
  });

  const canonicalObject = {
    sessionId: session.id,
    studentId: session.studentId,
    payloadVersion: PAYLOAD_VERSION,
    features: sortedFeatures.map(f => ({
      questionId: f.questionId,
      responseTime: f.responseTime,
      revisionCount: f.revisionCount,
      pointerMovement: f.pointerMovement,
      scrollDistance: f.scrollDistance,
      pasteDetected: f.pasteDetected,
      deviceType: f.deviceType,
      questionDifficulty: f.questionDifficulty,
      sessionPosition: f.sessionPosition,
      // Handle missing optional timestamp gracefully in deterministic fashion
      eventTimestamp: (f as any).eventTimestamp || null,
    })),
  };

  // Convert to JSON string deterministically
  return JSON.stringify(canonicalObject);
}

/**
 * Generates a one-way cryptographic SHA-256 commitment for the session payload.
 * 
 * @param payload The deterministic JSON string from buildCanonicalPayload
 */
export async function generateSessionCommitment(payload: string): Promise<CryptographicCommitment> {
  // Ensure we are using the environment's crypto implementation
  const encoder = new TextEncoder();
  const data = encoder.encode(payload);
  
  let hashBuffer: ArrayBuffer;
  if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.subtle) {
    hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', data);
  } else {
    // Fallback for older environments or specific test runners without global WebCrypto
    const crypto = require('crypto');
    hashBuffer = crypto.createHash('sha256').update(payload).digest();
  }

  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  return {
    hash: hashHex,
    algorithm: 'SHA-256',
    createdAt: new Date().toISOString(),
    payloadVersion: PAYLOAD_VERSION,
  };
}

/**
 * Verifies if a given payload matches the expected stored hash.
 * 
 * @param payload The deterministic JSON string from buildCanonicalPayload
 * @param expectedHash The expected SHA-256 hash string
 */
export async function verifySessionCommitment(payload: string, expectedHash: string): Promise<boolean> {
  const recomputed = await generateSessionCommitment(payload);
  return recomputed.hash === expectedHash;
}
