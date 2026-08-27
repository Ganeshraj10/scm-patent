/**
 * ExamGuard — Sessions Service
 *
 * Phase 5C: Behavioral sessions and exam sessions now persist to Supabase
 * via server-side API routes that call atomic Postgres RPC functions.
 *
 * Architecture:
 *   UI → sessions.ts (service) → /api/sessions/* (server route) → Postgres RPC → Supabase
 *
 * Remaining on localStorage (Phase 5C scope):
 *   - behavioral_models / calibration_results (next phase)
 *   - reviews (future phase)
 *   - cryptographic_commitments (future phase)
 *   - DemoTools reset data
 *
 * Data source rules:
 *   DEMO_MODE=true  → Supabase first, mock fallback permitted on error
 *   DEMO_MODE=false → Supabase is authoritative; no silent mock substitution
 */

import type { BehavioralSession, ExamSession, DeviationAnalysis } from '@/types';
import {
  appendTrackedSession,
  getTrackedSessions as storeGetTrackedSessions,
  saveExamSession as storeSaveExamSession,
  getExamSessions as storeGetExamSessions,
  getExamSession as storeGetExamSession,
  updateExamSession as storeUpdateExamSession,
  getReviewRequiredSessions as storeGetReviewRequiredSessions,
  clearAll as storeClearAll,
} from '@/lib/sessionStore';
import { mockSessions, getSessionById, getSessionsByStudentId } from '@/data/mockSessions';
import { createClient } from '@/lib/supabase/client';
import { buildAndPersistBehavioralModel } from '@/lib/services/behavioralModels';

const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

// ─── Types for API responses ──────────────────────────────────────────────────

export interface BehavioralSessionCreateInput {
  studentId: string;         // students.id UUID
  assessmentId?: string;
  sessionType: 'low_stakes' | 'graded_examination';
  deviceType: 'desktop' | 'mobile' | 'tablet';
  startedAt: string;         // ISO 8601
  completedAt: string;       // ISO 8601
  features: BehavioralFeatureInput[];
}

export interface BehavioralFeatureInput {
  questionId?: string;
  responseTime: number;       // ms
  revisionCount: number;
  pointerMovement: number;    // px
  scrollDistance: number;     // px
  pasteDetected: boolean;
  deviceType: 'desktop' | 'mobile' | 'tablet';
  questionDifficulty?: number;
  eventTimestamp?: string;
}

export interface ExamSessionCreateInput {
  studentId: string;          // students.id UUID
  assessmentId?: string;
  deviceType: 'desktop' | 'mobile' | 'tablet';
  startedAt: string;
  submittedAt?: string;
  deviationScore: number;
  personalizedThreshold: number;
  confidence: number;         // 0–100
  reviewStatus: string;
  features: BehavioralFeatureInput[];
  featureContributions: FeatureContributionInput[];
}

export interface FeatureContributionInput {
  feature: string;
  observed: number;
  expected: number;
  deviation: number;
  contribution: number;
  direction: 'higher_than_expected' | 'lower_than_expected' | 'within_expected_range';
}

export interface SessionCreateResult {
  sessionId: string;           // Supabase UUID for exam_sessions or behavioral_sessions
  deviationAnalysisId?: string;
}

// ─── Behavioral (Tracked) Sessions ──────────────────────────────────────────

/**
 * Persist a newly completed low-stakes behavioral session to Supabase.
 * Calls the server-side API route to invoke the atomic Postgres RPC.
 *
 * Falls back to localStorage in demo mode if the network request fails.
 * In production mode, returns an error on failure — does not silently
 * save to localStorage.
 */
export async function createBehavioralSession(
  input: BehavioralSessionCreateInput
): Promise<SessionCreateResult> {
  try {
    const response = await fetch('/api/sessions/behavioral', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        student_id:     input.studentId,
        assessment_id:  input.assessmentId ?? null,
        session_type:   input.sessionType,
        device_type:    input.deviceType,
        started_at:     input.startedAt,
        completed_at:   input.completedAt,
        features:       input.features.map(mapFeatureToApi),
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error ?? `HTTP ${response.status}`);
    }

    const result = await response.json();

    // Phase 6: Trigger model rebuild asynchronously
    buildAndPersistBehavioralModel(input.studentId, input.deviceType).catch((err) => {
      console.error('[createBehavioralSession] Model rebuild failed:', err);
    });

    return { sessionId: result.session_id };

  } catch (error) {
    if (isDemoMode) {
      console.warn('[createBehavioralSession] Supabase failed — demo localStorage fallback:', error);
      // Build a local representation for demo continuity
      const localSession = buildLocalBehavioralSession(input);
      appendTrackedSession(localSession);
      return { sessionId: localSession.id };
    }
    throw error;
  }
}

/**
 * Retrieve all tracked behavioral sessions.
 * In demo mode, merges localStorage with Supabase results.
 * In production, Supabase is authoritative — localStorage is ignored.
 */
export async function getTrackedSessions(): Promise<any[]> {
  try {
    const response = await fetch('/api/sessions/behavioral');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    return mapBehavioralSessionsFromApi(data);
  } catch (error) {
    if (isDemoMode) {
      console.warn('[getTrackedSessions] Supabase failed — demo localStorage fallback:', error);
      return storeGetTrackedSessions();
    }
    throw error;
  }
}

/**
 * Retrieve tracked sessions for a specific student (filter client-side after
 * RLS-scoped fetch).
 */
export async function getTrackedSessionsByStudent(studentId: string): Promise<any[]> {
  const sessions = await getTrackedSessions();
  return sessions.filter((s) => s.studentId === studentId);
}

// ─── Exam Sessions ───────────────────────────────────────────────────────────

/**
 * Persist a completed graded exam session to Supabase atomically.
 * Returns the Supabase-generated UUID for routing (replaces the temporary
 * client-side timestamp ID).
 *
 * Falls back to localStorage in demo mode.
 */
export async function saveExamSession(
  input: ExamSessionCreateInput
): Promise<SessionCreateResult> {
  try {
    const response = await fetch('/api/sessions/exam', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        student_id:             input.studentId,
        assessment_id:          input.assessmentId ?? null,
        device_type:            input.deviceType,
        started_at:             input.startedAt,
        submitted_at:           input.submittedAt ?? new Date().toISOString(),
        deviation_score:        input.deviationScore,
        personalized_threshold: input.personalizedThreshold,
        confidence:             input.confidence,
        review_status:          input.reviewStatus,
        features:               input.features.map(mapFeatureToApi),
        feature_contributions:  input.featureContributions.map(mapContributionToApi),
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error ?? `HTTP ${response.status}`);
    }

    const result = await response.json();
    return {
      sessionId: result.exam_session_id,
      deviationAnalysisId: result.deviation_analysis_id,
    };

  } catch (error) {
    if (isDemoMode) {
      console.warn('[saveExamSession] Supabase failed — demo localStorage fallback:', error);
      const localSession = buildLocalExamSession(input);
      storeSaveExamSession(localSession);
      return { sessionId: localSession.id };
    }
    throw error;
  }
}

/**
 * Retrieve a single exam session by its ID.
 * Checks Supabase first (RLS-scoped), falls back to localStorage in demo mode.
 */
export async function getSession(sessionId: string): Promise<ExamSession | null> {
  // First try Supabase
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('exam_sessions')
      .select(`
        id, student_id, assessment_id, device_type,
        started_at, submitted_at, status,
        deviation_score, personalized_threshold, confidence, review_status,
        created_at,
        students ( profile_id, student_identifier, profiles ( full_name ) ),
        assessments ( assessment_code, title ),
        deviation_analyses ( id, deviation_score, personalized_threshold, status,
          feature_contributions ( feature_name, observed_value, expected_value,
            deviation, contribution, direction ) )
      `)
      .eq('id', sessionId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }
    if (data) {
      return mapExamSessionFromApi(data as unknown as ExamSessionRow);
    }
  } catch (error) {
    if (!isDemoMode) throw error;
    console.warn('[getSession] Supabase error:', error);
  }

  // Fallback: localStorage + mock (demo mode or Supabase miss)
  const fromStore = storeGetExamSession(sessionId);
  if (fromStore) return fromStore as ExamSession;
  return getSessionById(sessionId) ?? null;
}

/**
 * Retrieve all exam sessions visible to the authenticated user.
 */
export async function getExamSessions(): Promise<ExamSession[]> {
  try {
    const response = await fetch('/api/sessions/exam');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    return (data as ExamSessionRow[]).map(mapExamSessionFromApi);
  } catch (error) {
    if (isDemoMode) {
      console.warn('[getExamSessions] Supabase failed — demo fallback:', error);
      const dynamic = storeGetExamSessions() as ExamSession[];
      const combined = [...mockSessions, ...dynamic];
      const seen = new Map<string, ExamSession>();
      combined.forEach((s) => seen.set(s.id, s));
      return Array.from(seen.values());
    }
    throw error;
  }
}

/**
 * Retrieve a single exam session by ID.
 */
export async function getExamSession(sessionId: string): Promise<ExamSession | null> {
  return getSession(sessionId);
}

/**
 * Retrieve all exam sessions for a specific student.
 */
export async function getStudentSessions(studentId: string): Promise<ExamSession[]> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('exam_sessions')
      .select(`
        id, student_id, assessment_id, device_type,
        started_at, submitted_at, status,
        deviation_score, personalized_threshold, confidence, review_status,
        created_at,
        students ( profile_id, student_identifier, profiles ( full_name ) ),
        assessments ( assessment_code, title ),
        deviation_analyses ( id, deviation_score, personalized_threshold, status,
          feature_contributions ( feature_name, observed_value, expected_value,
            deviation, contribution, direction ) )
      `)
      .eq('student_id', studentId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data as unknown as ExamSessionRow[]).map(mapExamSessionFromApi);
  } catch (error) {
    if (isDemoMode) {
      console.warn('[getStudentSessions] Supabase failed — demo fallback:', error);
      return getSessionsByStudentId(studentId);
    }
    throw error;
  }
}

/**
 * Update fields on an existing exam session in localStorage.
 * (Reviews/status updates are still localStorage-based until reviews are migrated.)
 */
export function updateExamSession(sessionId: string, updates: Partial<ExamSession>): void {
  storeUpdateExamSession(sessionId, updates);
}

/**
 * Retrieve all sessions currently requiring review.
 * Merges Supabase results with localStorage (for unmigrated review status).
 */
export async function getReviewRequiredSessions(): Promise<ExamSession[]> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('exam_sessions')
      .select(`
        id, student_id, assessment_id, device_type,
        started_at, submitted_at, status,
        deviation_score, personalized_threshold, confidence, review_status,
        created_at,
        students ( profile_id, student_identifier, profiles ( full_name ) ),
        assessments ( assessment_code, title ),
        deviation_analyses ( id, deviation_score, personalized_threshold, status,
          feature_contributions ( feature_name, observed_value, expected_value,
            deviation, contribution, direction ) )
      `)
      .eq('review_status', 'review_required')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data as unknown as ExamSessionRow[]).map(mapExamSessionFromApi);
  } catch (error) {
    if (isDemoMode) {
      return storeGetReviewRequiredSessions() as ExamSession[];
    }
    throw error;
  }
}

// ─── Utility ─────────────────────────────────────────────────────────────────

/**
 * Clear all ExamGuard keys from localStorage.
 * Used by DemoTools to reset the prototype to its initial seed state.
 * Does NOT touch Supabase — intentionally scoped to local demo data.
 */
export function clearAllSessions(): void {
  storeClearAll();
}

// ─── Internal types for API row shapes ───────────────────────────────────────

interface ExamSessionRow {
  id: string;
  student_id: string;
  assessment_id: string | null;
  device_type: string;
  started_at: string | null;
  submitted_at: string | null;
  status: string;
  deviation_score: number | null;
  personalized_threshold: number | null;
  confidence: number | null;
  review_status: string;
  created_at: string;
  students: {
    profile_id: string;
    student_identifier: string;
    profiles: { full_name: string } | null;
  } | null;
  assessments: { assessment_code: string; title: string } | null;
  deviation_analyses: DeviationAnalysisRow[] | null;
}

interface DeviationAnalysisRow {
  id: string;
  deviation_score: number | null;
  personalized_threshold: number | null;
  status: string | null;
  feature_contributions: FeatureContributionRow[] | null;
}

interface FeatureContributionRow {
  feature_name: string;
  observed_value: number | null;
  expected_value: number | null;
  deviation: number | null;
  contribution: number | null;
  direction: string | null;
}

// ─── Mappers ──────────────────────────────────────────────────────────────────

function mapExamSessionFromApi(row: ExamSessionRow): ExamSession {
  const analysis = row.deviation_analyses?.[0] ?? null;
  const contributions = analysis?.feature_contributions?.map((c) => ({
    feature:      c.feature_name,
    label:        c.feature_name,
    unit:         '',
    expected:     c.expected_value ?? 0,
    observed:     c.observed_value ?? 0,
    deviation:    c.deviation ?? 0,
    contribution: c.contribution ?? 0,
  })) ?? [];

  const deviationAnalysis: DeviationAnalysis | undefined = analysis ? {
    sessionId:            row.id,
    studentId:            row.student_id,
    deviationScore:       analysis.deviation_score ?? 0,
    personalizedThreshold: analysis.personalized_threshold ?? 0,
    reviewRequired:       row.review_status === 'review_required',
    confidence:           row.confidence ?? 0,
    featureContributions: contributions,
    computedAt:           row.created_at,
  } : undefined;

  const duration = row.started_at && row.submitted_at
    ? Math.round((new Date(row.submitted_at).getTime() - new Date(row.started_at).getTime()) / 60000)
    : 0;

  return {
    id:                   row.id,
    studentId:            row.student_id,
    studentName:          row.students?.profiles?.full_name ?? 'Unknown',
    examName:             row.assessments?.title ?? 'Examination',
    examCode:             row.assessments?.assessment_code ?? '',
    type:                 'graded_examination',
    date:                 row.submitted_at ?? row.created_at,
    duration,
    questionCount:        0,
    deviceType:           (row.device_type as ExamSession['deviceType']) ?? 'desktop',
    deviationScore:       row.deviation_score ?? 0,
    personalizedThreshold: row.personalized_threshold ?? 0,
    reviewStatus:         (row.review_status as ExamSession['reviewStatus']) ?? 'normal',
    modelConfidence:      row.confidence ?? 0,
    analysis:             deviationAnalysis,
  };
}

function mapBehavioralSessionsFromApi(data: any[]): any[] {
  return data.map((row) => ({
    id:          row.id,
    studentId:   row.student_id,
    type:        row.session_type,
    deviceType:  row.device_type,
    startedAt:   row.started_at,
    completedAt: row.completed_at,
    reviewStatus: row.review_status,
    features:    row.behavioral_features ?? [],
  }));
}

function mapFeatureToApi(f: BehavioralFeatureInput) {
  return {
    question_id:         f.questionId ?? null,
    response_time:       safeNum(f.responseTime),
    revision_count:      Math.max(0, f.revisionCount),
    pointer_movement:    Math.max(0, safeNum(f.pointerMovement) ?? 0),
    scroll_distance:     Math.max(0, safeNum(f.scrollDistance) ?? 0),
    paste_detected:      f.pasteDetected,
    device_type:         f.deviceType,
    question_difficulty: f.questionDifficulty ?? null,
    event_timestamp:     f.eventTimestamp ?? new Date().toISOString(),
  };
}

function mapContributionToApi(c: FeatureContributionInput) {
  return {
    feature:      c.feature,
    observed:     safeNum(c.observed),
    expected:     safeNum(c.expected),
    deviation:    safeNum(c.deviation),
    contribution: safeNum(c.contribution),
    direction:    c.direction,
  };
}

function safeNum(value: unknown): number | null {
  const n = Number(value);
  return isFinite(n) && !isNaN(n) ? n : null;
}

// ─── Local session builders (demo/fallback only) ──────────────────────────────

function buildLocalBehavioralSession(input: BehavioralSessionCreateInput) {
  return {
    id:          `ses-local-${Date.now()}`,
    studentId:   input.studentId,
    type:        input.sessionType,
    deviceType:  input.deviceType,
    startedAt:   input.startedAt,
    completedAt: input.completedAt,
    reviewStatus: 'normal',
    features:    input.features,
    _local:      true,
  };
}

function buildLocalExamSession(input: ExamSessionCreateInput): ExamSession {
  return {
    id:                   `exam-local-${Date.now()}`,
    studentId:            input.studentId,
    studentName:          'Demo Student',
    examName:             'Examination',
    examCode:             '',
    type:                 'graded_examination',
    date:                 input.submittedAt ?? new Date().toISOString(),
    duration:             0,
    questionCount:        input.features.length,
    deviceType:           input.deviceType,
    deviationScore:       input.deviationScore,
    personalizedThreshold: input.personalizedThreshold,
    reviewStatus:         (input.reviewStatus as ExamSession['reviewStatus']),
    modelConfidence:      input.confidence,
  };
}
