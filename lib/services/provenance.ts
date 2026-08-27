/**
 * ExamGuard — Provenance Service
 *
 * Coordinates access to and verification of cryptographic commitments.
 * All hashing logic remains in lib/cryptoEngine.ts untouched.
 */

import type { CryptographicCommitment } from '@/types';
import {
  buildCanonicalPayload,
  generateSessionCommitment,
} from '@/lib/cryptoEngine';
import { getSessionById } from '@/data/mockSessions';

const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

// ─── Retrieval ────────────────────────────────────────────────────────────────

export async function getCommitment(sessionId: string): Promise<CryptographicCommitment | null> {
  try {
    const response = await fetch(`/api/provenance?sessionId=${sessionId}`);
    if (!response.ok) {
      if (isDemoMode && response.status === 422) {
        return getSessionById(sessionId)?.cryptographicCommitment ?? null;
      }
      throw new Error(`HTTP ${response.status}`);
    }
    const result = await response.json();
    return result.commitment || null;
  } catch (error) {
    if (isDemoMode) {
      console.warn('[getCommitment] Demo fallback', error);
      return getSessionById(sessionId)?.cryptographicCommitment ?? null;
    }
    throw error;
  }
}

// ─── Persistence ─────────────────────────────────────────────────────────────

export async function saveCommitment(
  sessionId: string,
  commitment: CryptographicCommitment,
): Promise<void> {
  try {
    const response = await fetch('/api/provenance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, commitment }),
    });

    if (!response.ok) {
      if (isDemoMode && response.status === 422) {
        return; // Silent fail in demo mode
      }
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error ?? `HTTP ${response.status}`);
    }
  } catch (error) {
    if (isDemoMode) {
      console.warn('[saveCommitment] Demo fallback', error);
      return;
    }
    throw error;
  }
}

// ─── Verification ─────────────────────────────────────────────────────────────

export async function verifyCommitment(sessionId: string): Promise<boolean> {
  try {
    const response = await fetch('/api/provenance/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId }),
    });

    if (!response.ok) {
      if (isDemoMode && response.status === 422) {
        return true; // Simplified demo mode fallback
      }
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    return data.verified;
  } catch (error) {
    if (isDemoMode) {
      console.warn('[verifyCommitment] Demo fallback', error);
      return true;
    }
    return false; // Fail safe
  }
}

// ─── Generation helper ────────────────────────────────────────────────────────

export async function generateAndSaveCommitment(session: any): Promise<CryptographicCommitment> {
  const payload = buildCanonicalPayload(session);
  const commitment = await generateSessionCommitment(payload);
  
  // Attach locally for immediate use
  session.cryptographicCommitment = commitment;
  
  // Persist asynchronously (no blocking)
  saveCommitment(session.id, commitment).catch((err) => {
    console.error('[generateAndSaveCommitment] Failed to save commitment:', err);
  });
  
  return commitment;
}
