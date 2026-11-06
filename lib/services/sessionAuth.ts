import { UserRole } from '@/types';

/**
 * Retrieves the cryptographic signing secret from environment variables.
 * Fails securely if no secret is configured in the environment.
 */
export function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET || process.env.SUPABASE_SECRET_KEY;
  if (!secret || secret.trim().length === 0) {
    throw new Error(
      '[Security Exception] Missing mandatory session signing secret in environment variables (SESSION_SECRET or SUPABASE_SECRET_KEY). Refusing to sign or verify tokens with insecure defaults.'
    );
  }
  return secret.trim();
}

export interface SessionPayload {
  userId: string;
  role: UserRole;
  email: string;
  exp: number;
}

function base64UrlEncode(str: string): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(str, 'utf8').toString('base64url');
  }
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(str: string): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(str, 'base64url').toString('utf8');
  }
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return atob(base64);
}

async function computeHmacSha256(data: string, secret: string): Promise<string> {
  if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.subtle) {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const key = await globalThis.crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const sig = await globalThis.crypto.subtle.sign('HMAC', key, encoder.encode(data));
    const bytes = new Uint8Array(sig);
    if (typeof Buffer !== 'undefined') {
      return Buffer.from(bytes).toString('base64url');
    }
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return base64UrlEncode(binary);
  } else {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const crypto = require('crypto');
    return crypto.createHmac('sha256', secret).update(data).digest('base64url');
  }
}

/**
 * Creates a cryptographically signed HMAC-SHA256 session token.
 * Prevents client-side role tampering and unauthorized access.
 * Throws a Security Exception if the signing secret is not configured.
 */
export async function signSessionToken(data: {
  userId: string;
  role: UserRole;
  email: string;
  durationMs?: number;
}): Promise<string> {
  const secret = getSessionSecret();
  const duration = data.durationMs || 1000 * 60 * 60 * 24 * 7; // 7 days
  const payload: SessionPayload = {
    userId: data.userId,
    role: data.role,
    email: data.email,
    exp: Date.now() + duration,
  };

  const payloadEncoded = base64UrlEncode(JSON.stringify(payload));
  const signature = await computeHmacSha256(payloadEncoded, secret);
  return `${payloadEncoded}.${signature}`;
}

/**
 * Verifies the cryptographic HMAC-SHA256 signature of a session token.
 * Returns the decoded payload if valid and unexpired; returns null otherwise.
 * Fails securely if the secret is missing or signature mismatch.
 */
export async function verifySessionToken(token: string | null | undefined): Promise<SessionPayload | null> {
  if (!token || typeof token !== 'string') return null;

  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [payloadEncoded, signature] = parts;
  try {
    let secret: string;
    try {
      secret = getSessionSecret();
    } catch {
      // Missing secret fails securely by rejecting verification
      return null;
    }

    const expectedSig = await computeHmacSha256(payloadEncoded, secret);
    if (signature !== expectedSig) {
      return null;
    }

    const jsonStr = base64UrlDecode(payloadEncoded);
    const payload = JSON.parse(jsonStr) as SessionPayload;

    if (!payload.userId || !payload.role || !payload.exp) {
      return null;
    }

    if (Date.now() >= payload.exp) {
      return null; // Expired session
    }

    return payload;
  } catch {
    return null;
  }
}

