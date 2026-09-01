/**
 * ExamGuard — Assessments Service
 *
 * Phase 5: Reads from Supabase PostgreSQL.
 * Respects Phase 4 RLS — all authenticated users can SELECT assessments and
 * questions per policy.
 *
 * Demo mode: when NEXT_PUBLIC_DEMO_MODE=true, falls back to mock data ONLY
 * when Supabase is explicitly unavailable (error).
 * Production mode: Supabase is authoritative. Zero rows returns empty.
 */

import type { Question } from '@/types';
import { createClient } from '@/lib/supabase/client';
import { mockQuestions, getQuestionsByExam } from '@/data/mockQuestions';
import { mockSessions } from '@/data/mockSessions';

const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

// ─── Internal types ───────────────────────────────────────────────────────────

/**
 * A lightweight assessment descriptor.
 * In Phase 5 this maps to the `assessments` table row.
 */
export interface Assessment {
  id: string;
  examCode: string;
  examName: string;
  questionCount: number;
  durationMinutes: number;
}

interface AssessmentRow {
  id: string;
  assessment_code: string;
  title: string;
  duration_minutes: number;
  assessment_questions: Array<{ question_id: string }>;
}

interface QuestionRow {
  id: string;
  question_text: string;
  options: string[] | null;
  correct_index: number | null;
  difficulty: number;
  topic: string | null;
  // from assessment_questions join
  assessment_code?: string;
  question_position?: number;
}

// ─── Mappers ──────────────────────────────────────────────────────────────────

function mapAssessmentRowToDomain(row: AssessmentRow): Assessment {
  return {
    id: row.id,
    examCode: row.assessment_code,
    examName: row.title,
    questionCount: row.assessment_questions?.length ?? 0,
    durationMinutes: row.duration_minutes,
  };
}

function mapQuestionRowToDomain(row: QuestionRow, examCode: string): Question {
  return {
    id: row.id,
    examCode,
    text: row.question_text,
    options: row.options ?? [],
    correctIndex: row.correct_index ?? 0,
    difficulty: row.difficulty,
    topic: row.topic ?? '',
  };
}

// ─── Queries ─────────────────────────────────────────────────────────────────

/**
 * Retrieve all assessments in the system.
 * RLS permits all authenticated users to SELECT assessments.
 */
export async function getAssessments(): Promise<Assessment[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('assessments')
    .select(`
      id,
      assessment_code,
      title,
      duration_minutes,
      assessment_questions ( question_id )
    `)
    .order('created_at', { ascending: true });

  if (error) {
    if (isDemoMode) {
      console.warn('[getAssessments] Supabase error — demo fallback:', error.message);
      // Derive from mock sessions (Phase 1 behaviour)
      const seen = new Map<string, Assessment>();
      mockSessions.forEach((s) => {
        if (!seen.has(s.examCode)) {
          seen.set(s.examCode, {
            id: s.examCode,
            examCode: s.examCode,
            examName: s.examName,
            questionCount: s.questionCount,
            durationMinutes: 60,
          });
        }
      });
      return Array.from(seen.values());
    }
    console.error('[getAssessments] Supabase error:', error.message);
    throw new Error('Failed to load assessments. Please try again.');
  }

  return (data as unknown as AssessmentRow[]).map(mapAssessmentRowToDomain);
}

/**
 * Retrieve a single assessment by its UUID.
 * Returns null when not found or not permitted by RLS.
 */
export async function getAssessment(assessmentId: string): Promise<Assessment | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('assessments')
    .select(`
      id,
      assessment_code,
      title,
      duration_minutes,
      assessment_questions ( question_id )
    `)
    .eq('id', assessmentId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    if (isDemoMode) {
      console.warn('[getAssessment] Supabase error — demo fallback:', error.message);
      return null;
    }
    console.error('[getAssessment] Supabase error:', error.message);
    throw new Error('Failed to load assessment.');
  }

  if (!data) return null;
  return mapAssessmentRowToDomain(data as unknown as AssessmentRow);
}

/**
 * Retrieve all questions for a given assessment, ordered by question_position.
 * assessmentId is the UUID from the assessments table.
 */
export async function getQuestions(assessmentId: string): Promise<Question[]> {
  const supabase = createClient();

  // Join through assessment_questions to respect ordering
  const { data, error } = await supabase
    .from('assessment_questions')
    .select(`
      question_position,
      questions (
        id,
        question_text,
        options,
        correct_index,
        difficulty,
        topic
      ),
      assessments!inner ( assessment_code )
    `)
    .eq('assessment_id', assessmentId)
    .order('question_position', { ascending: true });

  if (error) {
    if (isDemoMode) {
      console.warn('[getQuestions] Supabase error — demo fallback:', error.message);
      // Try to match by examCode (the caller may be passing an examCode in demo mode)
      const specific = getQuestionsByExam(assessmentId);
      return specific.length > 0 ? specific : mockQuestions;
    }
    console.error('[getQuestions] Supabase error:', error.message);
    throw new Error('Failed to load questions. Please try again.');
  }

  if (!data || data.length === 0) return [];

  // Supabase returns nested objects for joined tables
  return data.map((aq) => {
    const q = (aq as unknown as {
      question_position: number;
      questions: QuestionRow;
      assessments: { assessment_code: string };
    });
    return mapQuestionRowToDomain(q.questions, q.assessments.assessment_code);
  });
}

/**
 * Retrieve the full question bank (all questions regardless of assessment).
 */
export async function getAllQuestions(): Promise<Question[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('questions')
    .select(`
      id,
      question_text,
      options,
      correct_index,
      difficulty,
      topic
    `)
    .order('created_at', { ascending: true });

  if (error || !data || data.length === 0) {
    if (error) console.warn('[getAllQuestions] Supabase error — fallback to mock:', error.message);
    return mockQuestions;
  }

  // Map without an examCode (unknown without joining)
  return (data as QuestionRow[]).map((q) => mapQuestionRowToDomain(q, ''));
}

/**
 * Retrieve questions for an assessment by its examCode string (used by legacy
 * code that uses examCode as the identifier, e.g. 'CS301-MID').
 * This first resolves the UUID then calls getQuestions().
 */
export async function getQuestionsByExamCode(examCode: string): Promise<Question[]> {
  const supabase = createClient();

  const { data: assessment, error } = await supabase
    .from('assessments')
    .select('id')
    .eq('assessment_code', examCode)
    .single();

  if (error || !assessment) {
    if (isDemoMode) {
      const specific = getQuestionsByExam(examCode);
      return specific.length > 0 ? specific : mockQuestions;
    }
    return [];
  }

  return getQuestions(assessment.id);
}
