/**
 * ExamGuard — Students Service
 *
 * Phase 5: Reads from Supabase PostgreSQL via the authenticated user's session.
 * Respects Phase 4 RLS — queries only return rows the authenticated user is
 * permitted to see.
 *
 * Demo mode: when NEXT_PUBLIC_DEMO_MODE=true, falls back to mock data ONLY
 * when Supabase is explicitly unavailable.
 * Production mode: Supabase is authoritative. Zero rows returns empty, not mock.
 */

import type { Student } from '@/types';
import { createClient } from '@/lib/supabase/client';
import { mockStudents, getStudentById as mockGetStudentById } from '@/data/mockStudents';

const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

// ─── Database row types ───────────────────────────────────────────────────────

interface StudentRow {
  id: string;
  profile_id: string;
  student_identifier: string;
  department: string | null;
  enrollment_year: number | null;
  current_device_type: string;
  created_at: string;
  updated_at: string;
  profiles: {
    full_name: string;
    email: string;
  } | null;
  behavioral_models?: Array<{
    model_status: string;
    confidence: number | null;
    session_count: number;
    updated_at: string;
    calibrated_threshold: number | null;
  }>;
  exam_sessions?: Array<{
    deviation_score: number | null;
    review_status: string;
  }>;
}

// ─── Mapper ───────────────────────────────────────────────────────────────────

/**
 * Maps a Supabase database row to the application-facing Student domain type.
 * Derived fields (modelStatus, sessionCount, etc.) are pulled from joined
 * behavioral_models and exam_sessions rows where available.
 */
export function mapStudentRowToDomain(row: StudentRow): Student {
  const model = row.behavioral_models?.[0] ?? null;
  const examSessions = row.exam_sessions ?? [];

  // Average deviation across recent exam sessions
  const scoredSessions = examSessions.filter(
    (s) => s.deviation_score !== null
  );
  const averageDeviationScore =
    scoredSessions.length > 0
      ? scoredSessions.reduce((sum, s) => sum + (s.deviation_score ?? 0), 0) /
        scoredSessions.length
      : 0;

  // Determine overall review status: surface worst-case status
  const reviewPriority = ['disputed', 'not_verified', 'review_required', 'verified', 'normal'];
  const reviewStatus =
    examSessions.reduce((worst, s) => {
      const wi = reviewPriority.indexOf(worst);
      const ci = reviewPriority.indexOf(s.review_status);
      return ci < wi ? (s.review_status as Student['reviewStatus']) : worst;
    }, 'normal' as Student['reviewStatus']);

  return {
    id: row.id,
    name: row.profiles?.full_name ?? 'Unknown',
    email: row.profiles?.email ?? '',
    studentId: row.student_identifier,
    department: row.department ?? '',
    enrollmentYear: row.enrollment_year ?? 0,
    deviceType: (row.current_device_type as Student['deviceType']) ?? 'desktop',
    modelStatus: (model?.model_status as Student['modelStatus']) ?? 'cold_start',
    sessionCount: model?.session_count ?? 0,
    modelConfidence: Math.round((model?.confidence ?? 0) * 100),
    lastActivity: model?.updated_at ?? row.updated_at,
    reviewStatus,
    averageDeviationScore: Math.round(averageDeviationScore * 10) / 10,
  };
}

// ─── Queries ─────────────────────────────────────────────────────────────────

/**
 * Retrieve all students visible to the authenticated user.
 *
 * - Student role: should not call this; use getStudentProfile() instead.
 * - Instructor role: returns only assigned students (enforced by RLS via
 *   instructor_students mapping table).
 * - Admin role: returns all permitted student rows.
 *
 * In DEMO MODE: falls back to mock data only if Supabase returns an error.
 * In PRODUCTION: zero rows is returned as-is.
 */
export async function getStudents(): Promise<Student[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('students')
    .select(`
      id,
      profile_id,
      student_identifier,
      department,
      enrollment_year,
      current_device_type,
      created_at,
      updated_at,
      profiles ( full_name, email ),
      behavioral_models ( model_status, confidence, session_count, updated_at, calibrated_threshold ),
      exam_sessions ( deviation_score, review_status )
    `)
    .order('created_at', { ascending: false });

  if (error) {
    if (isDemoMode) {
      console.warn('[getStudents] Supabase error — demo fallback active:', error.message);
      return mockStudents;
    }
    console.error('[getStudents] Supabase error:', error.message);
    throw new Error('Failed to load students. Please try again.');
  }

  // Type assertion: Supabase join types are opaque — cast to known shape
  return (data as unknown as StudentRow[]).map(mapStudentRowToDomain);
}

/**
 * Retrieve a single student by their internal UUID.
 * RLS ensures that the authenticated user may only access permitted students.
 *
 * Returns null when the student is not found or not permitted.
 */
export async function getStudent(studentId: string): Promise<Student | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('students')
    .select(`
      id,
      profile_id,
      student_identifier,
      department,
      enrollment_year,
      current_device_type,
      created_at,
      updated_at,
      profiles ( full_name, email ),
      behavioral_models ( model_status, confidence, session_count, updated_at, calibrated_threshold ),
      exam_sessions ( deviation_score, review_status )
    `)
    .eq('id', studentId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // Row not found or RLS denied — return null cleanly
      return null;
    }
    if (isDemoMode) {
      console.warn('[getStudent] Supabase error — demo fallback active:', error.message);
      return mockGetStudentById(studentId) ?? null;
    }
    console.error('[getStudent] Supabase error:', error.message);
    throw new Error('Failed to load student. Please try again.');
  }

  if (!data) return null;
  return mapStudentRowToDomain(data as unknown as StudentRow);
}

/**
 * Retrieve the authenticated user's own student profile.
 * Equivalent to getStudent() scoped to the current auth user.
 *
 * The query uses `profile_id = auth.uid()` implicitly through RLS.
 */
export async function getStudentProfile(studentId: string): Promise<Student | null> {
  return getStudent(studentId);
}

/**
 * Retrieve the student record for the currently authenticated user.
 * Uses profile_id = auth.uid() via Supabase Auth.
 */
export async function getCurrentStudentProfile(): Promise<Student | null> {
  const supabase = createClient();

  // First get the current user
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return mockStudents[0] ?? null;
  }

  const { data, error } = await supabase
    .from('students')
    .select(`
      id,
      profile_id,
      student_identifier,
      department,
      enrollment_year,
      current_device_type,
      created_at,
      updated_at,
      profiles ( full_name, email ),
      behavioral_models ( model_status, confidence, session_count, updated_at, calibrated_threshold ),
      exam_sessions ( deviation_score, review_status )
    `)
    .eq('profile_id', user.id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    if (isDemoMode) {
      console.warn('[getCurrentStudentProfile] demo fallback:', error.message);
      return mockStudents[0] ?? null;
    }
    console.error('[getCurrentStudentProfile] Supabase error:', error.message);
    return null;
  }

  if (!data) return null;
  return mapStudentRowToDomain(data as unknown as StudentRow);
}
