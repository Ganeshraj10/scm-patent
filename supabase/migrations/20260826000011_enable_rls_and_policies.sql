-- =============================================================================
-- ExamGuard — Migration 11: Row Level Security and Policies
-- =============================================================================

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Safely retrieve the current user's role without causing recursion
CREATE OR REPLACE FUNCTION public.auth_role()
RETURNS app_role
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$;

-- Safely retrieve the current user's student ID
CREATE OR REPLACE FUNCTION public.auth_student_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT id FROM students WHERE profile_id = auth.uid();
$$;

-- Safely retrieve the current user's instructor ID
CREATE OR REPLACE FUNCTION public.auth_instructor_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT id FROM instructors WHERE profile_id = auth.uid();
$$;

-- Check if the current instructor is authorized for a specific student
CREATE OR REPLACE FUNCTION public.auth_is_instructor_for_student(check_student_id UUID)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM instructor_students
    WHERE instructor_id = public.auth_instructor_id()
      AND student_id = check_student_id
  );
$$;

-- ============================================================================
-- ENABLE RLS ON ALL 18 TABLES
-- ============================================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE instructors ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessment_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE behavioral_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE behavioral_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE behavioral_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_expectations ENABLE ROW LEVEL SECURITY;
ALTER TABLE calibration_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE deviation_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE cryptographic_commitments ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE instructor_students ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- POLICIES: PROFILES
-- ============================================================================
CREATE POLICY "profiles_select_own_or_admin" ON profiles FOR SELECT TO authenticated
USING (id = auth.uid() OR public.auth_role() = 'admin');

-- Note: Column protection for `role` should be handled by server-side business logic, 
-- but we restrict row-level update to the owner.
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE TO authenticated
USING (id = auth.uid());

-- ============================================================================
-- POLICIES: STUDENTS
-- ============================================================================
CREATE POLICY "students_select_own_instructor_admin" ON students FOR SELECT TO authenticated
USING (
  profile_id = auth.uid() 
  OR public.auth_is_instructor_for_student(id)
  OR public.auth_role() = 'admin'
);

CREATE POLICY "students_update_own" ON students FOR UPDATE TO authenticated
USING (profile_id = auth.uid());

-- ============================================================================
-- POLICIES: INSTRUCTORS
-- ============================================================================
CREATE POLICY "instructors_select_own_admin" ON instructors FOR SELECT TO authenticated
USING (profile_id = auth.uid() OR public.auth_role() = 'admin');

CREATE POLICY "instructors_update_own" ON instructors FOR UPDATE TO authenticated
USING (profile_id = auth.uid());

-- ============================================================================
-- POLICIES: INSTRUCTOR_STUDENTS
-- ============================================================================
CREATE POLICY "instructor_students_select" ON instructor_students FOR SELECT TO authenticated
USING (
  instructor_id = public.auth_instructor_id()
  OR public.auth_role() = 'admin'
);

CREATE POLICY "instructor_students_admin_all" ON instructor_students FOR ALL TO authenticated
USING (public.auth_role() = 'admin');

-- ============================================================================
-- POLICIES: ASSESSMENTS & QUESTIONS
-- ============================================================================
-- Students and Instructors can read. Admins can manage.
CREATE POLICY "assessments_select" ON assessments FOR SELECT TO authenticated USING (true);
CREATE POLICY "assessments_admin_all" ON assessments FOR ALL TO authenticated USING (public.auth_role() = 'admin');

CREATE POLICY "questions_select" ON questions FOR SELECT TO authenticated USING (true);
CREATE POLICY "questions_admin_all" ON questions FOR ALL TO authenticated USING (public.auth_role() = 'admin');

CREATE POLICY "assessment_questions_select" ON assessment_questions FOR SELECT TO authenticated USING (true);
CREATE POLICY "assessment_questions_admin_all" ON assessment_questions FOR ALL TO authenticated USING (public.auth_role() = 'admin');

-- ============================================================================
-- POLICIES: BEHAVIORAL SESSIONS
-- ============================================================================
CREATE POLICY "behavioral_sessions_select" ON behavioral_sessions FOR SELECT TO authenticated
USING (
  student_id = public.auth_student_id()
  OR public.auth_is_instructor_for_student(student_id)
  OR public.auth_role() = 'admin'
);

CREATE POLICY "behavioral_sessions_insert_own" ON behavioral_sessions FOR INSERT TO authenticated
WITH CHECK (student_id = public.auth_student_id());

CREATE POLICY "behavioral_sessions_update_own" ON behavioral_sessions FOR UPDATE TO authenticated
USING (student_id = public.auth_student_id());

-- ============================================================================
-- POLICIES: BEHAVIORAL FEATURES
-- ============================================================================
CREATE POLICY "behavioral_features_select" ON behavioral_features FOR SELECT TO authenticated
USING (
  session_id IN (
    SELECT id FROM behavioral_sessions 
    WHERE student_id = public.auth_student_id() 
       OR public.auth_is_instructor_for_student(student_id)
  )
  OR public.auth_role() = 'admin'
);

CREATE POLICY "behavioral_features_insert_own" ON behavioral_features FOR INSERT TO authenticated
WITH CHECK (
  session_id IN (
    SELECT id FROM behavioral_sessions WHERE student_id = public.auth_student_id()
  )
);

-- ============================================================================
-- POLICIES: BEHAVIORAL MODELS
-- ============================================================================
CREATE POLICY "behavioral_models_select" ON behavioral_models FOR SELECT TO authenticated
USING (
  student_id = public.auth_student_id()
  OR public.auth_is_instructor_for_student(student_id)
  OR public.auth_role() = 'admin'
);

-- Models are updated via server-authoritative logic. No client UPDATE/INSERT for students.
CREATE POLICY "behavioral_models_admin_all" ON behavioral_models FOR ALL TO authenticated
USING (public.auth_role() = 'admin');

-- ============================================================================
-- POLICIES: FEATURE EXPECTATIONS
-- ============================================================================
CREATE POLICY "feature_expectations_select" ON feature_expectations FOR SELECT TO authenticated
USING (
  behavioral_model_id IN (
    SELECT id FROM behavioral_models 
    WHERE student_id = public.auth_student_id() 
       OR public.auth_is_instructor_for_student(student_id)
  )
  OR public.auth_role() = 'admin'
);
CREATE POLICY "feature_expectations_admin_all" ON feature_expectations FOR ALL TO authenticated USING (public.auth_role() = 'admin');

-- ============================================================================
-- POLICIES: CALIBRATION RESULTS
-- ============================================================================
CREATE POLICY "calibration_results_select" ON calibration_results FOR SELECT TO authenticated
USING (
  behavioral_model_id IN (
    SELECT id FROM behavioral_models 
    WHERE student_id = public.auth_student_id() 
       OR public.auth_is_instructor_for_student(student_id)
  )
  OR public.auth_role() = 'admin'
);
CREATE POLICY "calibration_results_admin_all" ON calibration_results FOR ALL TO authenticated USING (public.auth_role() = 'admin');

-- ============================================================================
-- POLICIES: EXAM SESSIONS
-- ============================================================================
CREATE POLICY "exam_sessions_select" ON exam_sessions FOR SELECT TO authenticated
USING (
  student_id = public.auth_student_id()
  OR public.auth_is_instructor_for_student(student_id)
  OR public.auth_role() = 'admin'
);

CREATE POLICY "exam_sessions_insert_own" ON exam_sessions FOR INSERT TO authenticated
WITH CHECK (student_id = public.auth_student_id());

CREATE POLICY "exam_sessions_update_own" ON exam_sessions FOR UPDATE TO authenticated
USING (student_id = public.auth_student_id());

-- ============================================================================
-- POLICIES: DEVIATION ANALYSES
-- ============================================================================
CREATE POLICY "deviation_analyses_select" ON deviation_analyses FOR SELECT TO authenticated
USING (
  exam_session_id IN (
    SELECT id FROM exam_sessions 
    WHERE student_id = public.auth_student_id() 
       OR public.auth_is_instructor_for_student(student_id)
  )
  OR public.auth_role() = 'admin'
);
CREATE POLICY "deviation_analyses_admin_all" ON deviation_analyses FOR ALL TO authenticated USING (public.auth_role() = 'admin');

-- ============================================================================
-- POLICIES: FEATURE CONTRIBUTIONS
-- ============================================================================
CREATE POLICY "feature_contributions_select" ON feature_contributions FOR SELECT TO authenticated
USING (
  deviation_analysis_id IN (
    SELECT d.id FROM deviation_analyses d
    JOIN exam_sessions e ON d.exam_session_id = e.id
    WHERE e.student_id = public.auth_student_id()
       OR public.auth_is_instructor_for_student(e.student_id)
  )
  OR public.auth_role() = 'admin'
);
CREATE POLICY "feature_contributions_admin_all" ON feature_contributions FOR ALL TO authenticated USING (public.auth_role() = 'admin');

-- ============================================================================
-- POLICIES: CRYPTOGRAPHIC COMMITMENTS
-- ============================================================================
CREATE POLICY "cryptographic_commitments_select" ON cryptographic_commitments FOR SELECT TO authenticated
USING (
  exam_session_id IN (
    SELECT id FROM exam_sessions 
    WHERE student_id = public.auth_student_id()
       OR public.auth_is_instructor_for_student(student_id)
  )
  OR public.auth_role() = 'admin'
);
CREATE POLICY "cryptographic_commitments_admin_all" ON cryptographic_commitments FOR ALL TO authenticated USING (public.auth_role() = 'admin');

-- ============================================================================
-- POLICIES: REVIEWS
-- ============================================================================
CREATE POLICY "reviews_select" ON reviews FOR SELECT TO authenticated
USING (
  instructor_id = public.auth_instructor_id()
  OR public.auth_role() = 'admin'
);

CREATE POLICY "reviews_insert_instructor" ON reviews FOR INSERT TO authenticated
WITH CHECK (
  instructor_id = public.auth_instructor_id()
  AND exam_session_id IN (
    SELECT id FROM exam_sessions WHERE public.auth_is_instructor_for_student(student_id)
  )
);

CREATE POLICY "reviews_update_instructor" ON reviews FOR UPDATE TO authenticated
USING (
  instructor_id = public.auth_instructor_id()
  AND exam_session_id IN (
    SELECT id FROM exam_sessions WHERE public.auth_is_instructor_for_student(student_id)
  )
);
CREATE POLICY "reviews_admin_all" ON reviews FOR ALL TO authenticated USING (public.auth_role() = 'admin');

-- ============================================================================
-- POLICIES: AUDIT LOGS
-- ============================================================================
CREATE POLICY "audit_logs_select_admin" ON audit_logs FOR SELECT TO authenticated
USING (public.auth_role() = 'admin');
-- System-level inserts only.

-- ============================================================================
-- END
-- ============================================================================
