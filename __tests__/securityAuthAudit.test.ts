import { NextRequest } from 'next/server';
import { updateSession } from '../lib/supabase/middleware';
import { register } from '../lib/actions/auth';
import { signSessionToken, verifySessionToken } from '../lib/services/sessionAuth';
import {
  extractAveragedFeatureVector,
  calculateMahalanobisDetails,
  ORDERED_FEATURES,
  ENGINE_TYPE as ENGINE_A_TYPE,
} from '../lib/deviationEngine';
import { ENGINE_TYPE as ENGINE_B_TYPE } from '../lib/services/behavioralAnalysisService';
import { BehavioralModel } from '../types';

// Mock Supabase SSR client for middleware testing
const mockGetUser = jest.fn();
const mockProfileSelect = jest.fn();

jest.mock('@supabase/ssr', () => ({
  createServerClient: jest.fn(() => ({
    auth: {
      getUser: () => mockGetUser(),
    },
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () => mockProfileSelect(),
          single: () => mockProfileSelect(),
        }),
      }),
    }),
  })),
}));

// Mock Next.js cookies() for server actions
const mockCookieSet = jest.fn();
const mockCookieDelete = jest.fn();
jest.mock('next/headers', () => ({
  cookies: jest.fn(async () => ({
    set: mockCookieSet,
    delete: mockCookieDelete,
    get: jest.fn(),
  })),
  headers: jest.fn(async () => new Headers()),
}));

describe('ExamGuard Security, Authentication & Architectural Boundaries Audit', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('1. Middleware Role Verification & Forged Cookie Resistance', () => {
    it('1.1 Rejects forged examguard_role=admin cookie for unauthenticated requests and redirects to /login', async () => {
      // Mock Supabase getUser returning null (unauthenticated)
      mockGetUser.mockResolvedValue({ data: { user: null }, error: new Error('No session') });

      const req = new NextRequest('http://localhost:3000/admin/dashboard', {
        headers: {
          cookie: 'examguard_role=admin',
        },
      });

      const res = await updateSession(req);

      // Must redirect to /login
      expect(res.status).toBe(307);
      const location = res.headers.get('location') || '';
      expect(location).toContain('/login');
      expect(location).toContain('redirect=%2Fadmin%2Fdashboard');
    });

    it('1.2 Forbids authenticated student with forged examguard_role=admin cookie from accessing /admin routes', async () => {
      // Mock Supabase getUser returning genuine student user
      mockGetUser.mockResolvedValue({
        data: {
          user: { id: 'usr-student-001', email: 'student@university.edu' },
        },
      });
      // Database profile confirms student role
      mockProfileSelect.mockResolvedValue({
        data: { role: 'student', full_name: 'Student User' },
      });

      const req = new NextRequest('http://localhost:3000/admin/dashboard', {
        headers: {
          cookie: 'examguard_role=admin', // Forged role in cookie
        },
      });

      const res = await updateSession(req);

      // Must reject student and redirect to /access-denied
      expect(res.status).toBe(307);
      const location = res.headers.get('location') || '';
      expect(location).toContain('/access-denied');
    });

    it('1.3 Forbids authenticated student from accessing /instructor routes', async () => {
      mockGetUser.mockResolvedValue({
        data: {
          user: { id: 'usr-student-001', email: 'student@university.edu' },
        },
      });
      mockProfileSelect.mockResolvedValue({
        data: { role: 'student', full_name: 'Student User' },
      });

      const req = new NextRequest('http://localhost:3000/instructor/dashboard');
      const res = await updateSession(req);

      expect(res.status).toBe(307);
      const location = res.headers.get('location') || '';
      expect(location).toContain('/access-denied');
    });

    it('1.4 Forbids authenticated instructor from accessing /admin routes', async () => {
      mockGetUser.mockResolvedValue({
        data: {
          user: { id: 'usr-inst-001', email: 'instructor@university.edu' },
        },
      });
      mockProfileSelect.mockResolvedValue({
        data: { role: 'instructor', full_name: 'Prof. Miller' },
      });

      const req = new NextRequest('http://localhost:3000/admin/users');
      const res = await updateSession(req);

      expect(res.status).toBe(307);
      const location = res.headers.get('location') || '';
      expect(location).toContain('/access-denied');
    });

    it('1.5 Grants access to authorized instructor on /instructor routes', async () => {
      mockGetUser.mockResolvedValue({
        data: {
          user: { id: 'usr-inst-001', email: 'instructor@university.edu' },
        },
      });
      mockProfileSelect.mockResolvedValue({
        data: { role: 'instructor', full_name: 'Prof. Miller' },
      });

      const req = new NextRequest('http://localhost:3000/instructor/dashboard');
      const res = await updateSession(req);

      // Allowed (NextResponse.next returns 200)
      expect(res.status).toBe(200);
      expect(res.headers.get('location')).toBeNull();
    });

    it('1.6 Grants access to platform administrator across admin and instructor routes', async () => {
      mockGetUser.mockResolvedValue({
        data: {
          user: { id: 'usr-admin-001', email: 'admin@university.edu' },
        },
      });
      mockProfileSelect.mockResolvedValue({
        data: { role: 'admin', full_name: 'Platform Admin' },
      });

      const reqAdmin = new NextRequest('http://localhost:3000/admin/dashboard');
      const resAdmin = await updateSession(reqAdmin);
      expect(resAdmin.status).toBe(200);

      const reqInst = new NextRequest('http://localhost:3000/instructor/dashboard');
      const resInst = await updateSession(reqInst);
      expect(resInst.status).toBe(200);
    });

    it('1.7 Authenticates and allows access via cryptographically signed session token when Supabase is offline', async () => {
      mockGetUser.mockResolvedValue({ data: { user: null }, error: new Error('Supabase offline') });

      const studentToken = await signSessionToken({
        userId: 'usr-student-001',
        role: 'student',
        email: 'student@university.edu',
      });

      const req = new NextRequest('http://localhost:3000/student/dashboard', {
        headers: {
          cookie: `examguard_session=${studentToken}`,
        },
      });

      const res = await updateSession(req);
      expect(res.status).toBe(200);
    });

    it('1.8 Forbids student with valid signed session token from accessing /admin routes', async () => {
      mockGetUser.mockResolvedValue({ data: { user: null }, error: new Error('Supabase offline') });

      const studentToken = await signSessionToken({
        userId: 'usr-student-001',
        role: 'student',
        email: 'student@university.edu',
      });

      const req = new NextRequest('http://localhost:3000/admin/dashboard', {
        headers: {
          cookie: `examguard_session=${studentToken}`,
        },
      });

      const res = await updateSession(req);
      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toContain('/access-denied');
    });

    it('1.9 Rejects tampered session token and redirects to /login', async () => {
      mockGetUser.mockResolvedValue({ data: { user: null }, error: new Error('Supabase offline') });

      const studentToken = await signSessionToken({
        userId: 'usr-student-001',
        role: 'student',
        email: 'student@university.edu',
      });

      // Tamper with the token (change signature)
      const tamperedToken = studentToken.slice(0, -5) + 'XXXXX';

      const req = new NextRequest('http://localhost:3000/student/dashboard', {
        headers: {
          cookie: `examguard_session=${tamperedToken}`,
        },
      });

      const res = await updateSession(req);
      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toContain('/login');
    });

    it('1.10 Allows instructor with signed session token to access /instructor routes but denies /admin routes', async () => {
      mockGetUser.mockResolvedValue({ data: { user: null }, error: new Error('Supabase offline') });

      const instructorToken = await signSessionToken({
        userId: 'usr-inst-001',
        role: 'instructor',
        email: 'prof@university.edu',
      });

      const reqInst = new NextRequest('http://localhost:3000/instructor/dashboard', {
        headers: {
          cookie: `examguard_session=${instructorToken}`,
        },
      });
      const resInst = await updateSession(reqInst);
      expect(resInst.status).toBe(200);

      const reqAdmin = new NextRequest('http://localhost:3000/admin/dashboard', {
        headers: {
          cookie: `examguard_session=${instructorToken}`,
        },
      });
      const resAdmin = await updateSession(reqAdmin);
      expect(resAdmin.status).toBe(307);
      expect(resAdmin.headers.get('location')).toContain('/access-denied');
    });
  });

  describe('2. Registration Privilege Escalation Prevention', () => {
    it('2.1 Rejects registration attempt requesting the admin role', async () => {
      const formData = new FormData();
      formData.set('email', 'attacker@domain.com');
      formData.set('password', 'SuperSecretPass123!');
      formData.set('full_name', 'Mallory Malicious');
      formData.set('role', 'admin');

      const result = await register(formData);
      expect(result).toBeDefined();
      expect(result?.error).toContain('Self-registration as administrator is not permitted');
    });

    it('2.2 Rejects registration with invalid arbitrary role', async () => {
      const formData = new FormData();
      formData.set('email', 'attacker@domain.com');
      formData.set('password', 'SuperSecretPass123!');
      formData.set('full_name', 'Mallory Malicious');
      formData.set('role', 'super_root');

      const result = await register(formData);
      expect(result).toBeDefined();
      expect(result?.error).toContain('Invalid role selection');
    });
  });

  describe('3. Behavioural Feature Standardisation & Missing Value Handling', () => {
    it('3.1 Standardises 5 canonical features in exact order with correct units', () => {
      expect(ORDERED_FEATURES).toEqual([
        'responseTime',
        'revisionCount',
        'pointerMovement',
        'scrollDistance',
        'pasteDetected',
      ]);
    });

    it('3.2 Normalises millisecond response times to seconds', () => {
      const telemetry = [
        { responseTime: 12500, revisionCount: 2, pointerMovement: 150, scrollDistance: 50, pasteDetected: 0 },
        { responseTime: 15500, revisionCount: 1, pointerMovement: 250, scrollDistance: 150, pasteDetected: 1 },
      ];

      const vector = extractAveragedFeatureVector(telemetry);
      // 12.5s and 15.5s -> mean 14.0s
      expect(vector.responseTime).toBeCloseTo(14.0, 1);
      expect(vector.revisionCount).toBe(1.5);
      expect(vector.pasteDetected).toBe(50); // 1 out of 2 = 50%
    });

    it('3.3 Does NOT treat missing pointer or scroll values as genuine zero measurements', () => {
      // 3 questions, but question 2 and 3 did not record pointerMovement (null/undefined)
      const telemetryWithMissing = [
        { responseTime: 10, revisionCount: 1, pointerMovement: 300, scrollDistance: 100, pasteDetected: 0 },
        { responseTime: 12, revisionCount: 1, pointerMovement: null, scrollDistance: 200, pasteDetected: 0 },
        { responseTime: 14, revisionCount: 1, pointerMovement: undefined, scrollDistance: 300, pasteDetected: 0 },
      ];

      const vector = extractAveragedFeatureVector(telemetryWithMissing);
      // pointerMovement should be 300 / 1 = 300, NOT 300 / 3 = 100
      expect(vector.pointerMovement).toBe(300);
      // scrollDistance was recorded on all 3: (100 + 200 + 300) / 3 = 200
      expect(vector.scrollDistance).toBe(200);
    });

    it('3.4 Imputes baseline expectations (z=0) for unmeasured features during Mahalanobis scoring', () => {
      const mockModel: BehavioralModel = {
        studentId: 'STU-001',
        sessionCount: 10,
        minimumSessionsRequired: 10,
        status: 'active',
        confidence: 90,
        lastUpdated: new Date().toISOString(),
        calibratedThreshold: 3.5,
        calibrationAvailable: true,
        shrinkageLambda: 0.2,
        uncertainties: [],
        expectations: [
          { feature: 'responseTime', label: 'Response Time', unit: 's', mean: 20, stdDev: 4, min: 10, max: 30 },
          { feature: 'revisionCount', label: 'Revision Count', unit: 'revisions', mean: 2, stdDev: 0.5, min: 1, max: 3 },
          { feature: 'pointerMovement', label: 'Pointer Movement', unit: 'px', mean: 500, stdDev: 50, min: 400, max: 600 },
          { feature: 'scrollDistance', label: 'Scroll Distance', unit: 'px', mean: 300, stdDev: 30, min: 200, max: 400 },
          { feature: 'pasteDetected', label: 'Paste-event percentage', unit: '%', mean: 0, stdDev: 0.1, min: 0, max: 0 },
        ],
        correlationMatrix: Array.from({ length: 5 }, (_, i) =>
          Array.from({ length: 5 }, (_, j) => (i === j ? 1 : 0))
        ),
        inverseCorrelationMatrix: Array.from({ length: 5 }, (_, i) =>
          Array.from({ length: 5 }, (_, j) => (i === j ? 1 : 0))
        ),
        covarianceMatrix: Array.from({ length: 5 }, (_, i) =>
          Array.from({ length: 5 }, (_, j) => (i === j ? 1 : 0))
        ),
      };

      // Session completely missing pointerMovement and scrollDistance (undefined)
      const observedWithMissing: Record<string, number> = {
        responseTime: 20, // exactly at mean -> z = 0
        revisionCount: 2, // exactly at mean -> z = 0
        pasteDetected: 0, // exactly at mean -> z = 0
      };

      const result = calculateMahalanobisDetails(observedWithMissing, mockModel);
      // Since all observed match mean and missing features are imputed to mean (z=0),
      // Mahalanobis distance D_M should be 0, NOT an explosive anomaly from treating missing as 0px!
      expect(result.mahalanobisDistance).toBeCloseTo(0, 4);
    });
  });

  describe('4. Architectural Separation: Engine A vs Engine B', () => {
    it('4.1 Engine A is designated as regularised Mahalanobis statistical anomaly detection', () => {
      expect(ENGINE_A_TYPE).toBe('ENGINE_A_REGULARIZED_MAHALANOBIS');
    });

    it('4.2 Engine B is designated as supplementary heuristic explainer and NOT an ML competitor', () => {
      expect(ENGINE_B_TYPE).toBe('ENGINE_B_SUPPLEMENTARY_HEURISTIC_EXPLAINER');
      expect(ENGINE_A_TYPE).not.toEqual(ENGINE_B_TYPE);
    });
  });
});
