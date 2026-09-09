-- =============================================================================
-- ExamGuard — Migration 16: Fix Behavioral Features RLS for Exam Sessions
-- =============================================================================

-- Drop old policies on behavioral_features if they only reference session_id
DROP POLICY IF EXISTS "behavioral_features_select" ON public.behavioral_features;
DROP POLICY IF EXISTS "behavioral_features_insert_own" ON public.behavioral_features;

-- Updated SELECT policy allowing reading features linked to either behavioral_sessions or exam_sessions
CREATE POLICY "behavioral_features_select" ON public.behavioral_features FOR SELECT TO authenticated
USING (
  session_id IN (
    SELECT id FROM public.behavioral_sessions 
    WHERE student_id = public.auth_student_id() 
       OR public.auth_is_instructor_for_student(student_id)
  )
  OR exam_session_id IN (
    SELECT id FROM public.exam_sessions 
    WHERE student_id = public.auth_student_id() 
       OR public.auth_is_instructor_for_student(student_id)
  )
  OR public.auth_role() = 'admin'
);

-- Updated INSERT policy allowing inserting features linked to own behavioral_sessions or exam_sessions
CREATE POLICY "behavioral_features_insert_own" ON public.behavioral_features FOR INSERT TO authenticated
WITH CHECK (
  session_id IN (
    SELECT id FROM public.behavioral_sessions WHERE student_id = public.auth_student_id()
  )
  OR exam_session_id IN (
    SELECT id FROM public.exam_sessions WHERE student_id = public.auth_student_id()
  )
);
