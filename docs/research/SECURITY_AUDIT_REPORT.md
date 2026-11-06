# ExamGuard — Phase A Security and Architecture Audit Report

**Document ID:** EXG-SEC-2026-V1  
**Classification:** Research Engineering & Security Audit  
**Status:** COMPLETE & VERIFIED  
**Date:** November 2026  

---

## 1. Executive Summary

This security audit investigated the authentication, authorization, session management, and database Row Level Security (RLS) architecture of the ExamGuard platform. The audit identified three critical security vulnerabilities in the pre-existing implementation:

1. **Unconditional Session Creation on Authentication Failure:** The server-side login action created cryptographically signed session tokens even when Supabase authentication failed or timed out.
2. **Client-Side Role Override Injection:** The login handler parsed an unvalidated `role` parameter from client `FormData`, allowing arbitrary role escalation to `instructor` or `admin`.
3. **Hardcoded Fallback Signing Secrets:** `lib/services/sessionAuth.ts` contained a static fallback string (`examguard_hmac_fallback_signing_secret_dev_2026`), permitting offline signature generation and violating cryptographic hygiene.

All three vulnerabilities have been corrected and verified against an expanded automated test suite of 22 security test cases.

---

## 2. Vulnerability Analysis & Technical Corrections

### 2.1 Issue 1: Authentication Bypass via Fallback Session Generation
- **Vulnerability:** When `supabase.auth.signInWithPassword` failed or timed out, the catch block fell back to local user mocking and issued a valid `examguard_session` cookie.
- **Root Cause:** Permissive demo fallback logic in `lib/actions/auth.ts`.
- **Correction:** The fallback logic was eliminated. The `login()` server action now strictly requires `supabase.auth.signInWithPassword` (or authorized automated provisioning for registered demo accounts) to succeed. If authentication fails, the function immediately terminates with `{ error: 'Invalid email or password' }` or service error, and no session cookies are created.

### 2.2 Issue 2: Role Escalation via Form Data Injection
- **Vulnerability:** `formData.get('role')` was inspected in `login()`, allowing an attacker to submit `role=admin`.
- **Root Cause:** Untrusted client input was merged into the role resolution hierarchy.
- **Correction:** `formData.get('role')` was completely removed from `login()`. The user's role is now strictly resolved server-side from `public.profiles` where `id = auth.uid()`. If no profile exists, it falls back only to verified user metadata with strict non-admin enforcement.

### 2.3 Issue 3: Hardcoded Fallback Signing Secret
- **Vulnerability:** `lib/services/sessionAuth.ts` fell back to a hardcoded string if `SESSION_SECRET` or `SUPABASE_SECRET_KEY` was missing from environment variables.
- **Root Cause:** Insecure default assignment in module scope.
- **Correction:** Implemented `getSessionSecret()`. It strictly checks `process.env.SESSION_SECRET` and `process.env.SUPABASE_SECRET_KEY`. If neither is configured, it throws a `[Security Exception] Missing mandatory session signing secret...` rather than defaulting to an insecure key. `verifySessionToken` fails securely by returning `null`.

### 2.4 Issue 4: Session Lifetime, Expiration, and Cookie Hardening
- **Correction:** 
  - Token payload explicitly embeds an expiration timestamp `exp: Date.now() + duration`.
  - `verifySessionToken` validates `Date.now() < payload.exp`. Expired tokens are rejected immediately.
  - Cookies (`examguard_session`, `examguard_role`, `examguard_user`) are issued with `httpOnly: true`, `sameSite: 'lax'`, and `secure: process.env.NODE_ENV === 'production'`.
  - The `logout()` action actively sets `maxAge: 0` for all session cookies, calls `cookies().delete()`, and invokes `supabase.auth.signOut()`.

---

## 3. Server-Side API Authorization Audit

Every API endpoint was audited to confirm independent server-side authentication and authorization:

| Endpoint | Method | Authentication Check | Authorization / Boundary Enforcement | Status |
|---|---|---|---|---|
| `/api/models/behavioral` | GET | `supabase.auth.getUser()` | Students restricted to their own `students.id`. Instructors verified via `instructor_students`. Foreign requests return `403 Forbidden`. | VERIFIED |
| `/api/reviews` | POST | `supabase.auth.getUser()` | Requires authenticated instructor row and explicit assignment to the session's student in `instructor_students`. | VERIFIED |
| `/api/sessions/exam` | POST | `supabase.auth.getUser()` | Derives `student_id` strictly from server `auth.uid()`. Ignores client `student_id`. Re-verified inside `create_exam_session_atomic` RPC. | VERIFIED |
| `/api/sessions/behavioral` | POST | `supabase.auth.getUser()` | Server derives authoritative `students.id` from `auth.uid()`. Re-verified in Postgres RPC. | VERIFIED |
| `/api/provenance` | GET | `supabase.auth.getUser()` | Cryptographic commitment fetch bounded to authorized user. | VERIFIED |
| `/api/provenance/verify` | POST | `supabase.auth.getUser()` | Verification re-computes SHA-256 canonical hash against tamper-evident DB record. | VERIFIED |

---

## 4. PostgreSQL Row Level Security (RLS) Audit

PostgreSQL policies across all 18 tables were reviewed:
- **`profiles`:** Authenticated users can only read/update their own profile (`id = auth.uid()`), except administrators.
- **`students`:** Read access restricted to the student himself, his assigned instructors (`auth_is_instructor_for_student()`), and admins.
- **`instructors`:** Instructors can only view/update their own profile.
- **`instructor_students`:** Read restricted to assigned instructor and admin. Insert/Update/Delete restricted to admin only.
- **`behavioral_sessions` & `behavioral_features`:** Students can only insert and select their own sessions (`student_id = auth_student_id()`).
- **`behavioral_models`:** Students have SELECT permissions only. Mutations are strictly reserved for server-authoritative RPCs and platform admins (`behavioral_models_admin_all`).
- **`audit_logs`:** Strictly readable only by platform admins (`public.auth_role() = 'admin'`).

---

## 5. Automated Security Test Results

All 22 security tests in `__tests__/securityAuthAudit.test.ts` passed:

1. **Middleware Role Verification & Forged Cookie Resistance:**
   - 1.1 Rejects forged `examguard_role=admin` cookie for unauthenticated requests and redirects to `/login`.
   - 1.2 Forbids authenticated student with forged `examguard_role=admin` cookie from accessing `/admin` routes.
   - 1.3 Forbids authenticated student from accessing `/instructor` routes.
   - 1.4 Forbids authenticated instructor from accessing `/admin` routes.
   - 1.5 Grants access to authorized instructor on `/instructor` routes.
   - 1.6 Grants access to platform administrator across admin and instructor routes.
   - 1.7 Authenticates and allows access via cryptographically signed session token when Supabase is offline.
   - 1.8 Forbids student with valid signed session token from accessing `/admin` routes.
   - 1.9 Rejects tampered session token and redirects to `/login`.
   - 1.10 Allows instructor with signed session token to access `/instructor` routes but denies `/admin` routes.
2. **Registration Privilege Escalation Prevention:**
   - 2.1 Rejects registration attempt requesting the admin role.
   - 2.2 Rejects registration with invalid arbitrary role.
3. **Behavioural Feature Standardisation & Missing Value Handling:**
   - 3.1 Standardises 5 canonical features in exact order with correct units.
   - 3.2 Normalises millisecond response times to seconds.
   - 3.3 Does NOT treat missing pointer or scroll values as genuine zero measurements.
   - 3.4 Imputes baseline expectations ($z=0$) for unmeasured features during Mahalanobis scoring.
4. **Architectural Separation: Engine A vs Engine B:**
   - 4.1 Engine A is designated as regularised Mahalanobis statistical anomaly detection.
   - 4.2 Engine B is designated as supplementary heuristic explainer and NOT an ML competitor.
5. **Cryptographic Session Token & Secret Enforcement:**
   - 5.1 Rejects expired session tokens.
   - 5.2 Rejects tampered signatures on session tokens.
   - 5.3 Fails securely when environment signing secret is missing.
   - 5.4 Rejects malformed tokens missing period or payload.

---

## 6. Remaining Risks & Security Limitations

While the authentication and authorization vulnerabilities have been resolved, the following residual risks remain inherent to the threat model:

1. **Stateless HMAC Token Revocation:** HMAC-SHA256 session tokens are stateless. If a token is stolen via physical compromise before expiration, it cannot be revoked before TTL without maintaining a server-side denylist or rotating the signing secret.
2. **Key Rotation Operations:** Rotating `SESSION_SECRET` invalidates all active sessions concurrently. In production, a dual-key grace window (current key + previous key) should be implemented.
3. **Client-Side Telemetry Tampering:** Client-side JavaScript telemetry (pointer movements, scroll, response times) can theoretically be simulated or modified by a motivated adversary using browser automation tools (e.g., Puppeteer). ExamGuard mitigates this through multimodal fusion, cryptographic payload hashing, and longitudinal consistency checks, but purely software-based behavioural proctoring cannot completely eliminate client spoofing.

