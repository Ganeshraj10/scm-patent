-- =============================================================================
-- ExamGuard -- Migration 14: Auth provisioning and schema/RPC corrections
-- Forward-only correction for the authoritative migrations above.
-- =============================================================================

-- Migration 2 documented this relationship but did not create the FK.
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_id_fkey
  FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Provision application identity data in the same transaction as auth.users.
-- Only the roles exposed by the registration UI are accepted from user metadata;
-- admin is deliberately never self-assignable.
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role app_role := CASE
    WHEN NEW.raw_user_meta_data ->> 'role' = 'instructor' THEN 'instructor'::app_role
    ELSE 'student'::app_role
  END;
  v_full_name text := COALESCE(NULLIF(trim(NEW.raw_user_meta_data ->> 'full_name'), ''), NEW.email);
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role)
  VALUES (NEW.id, v_full_name, NEW.email, v_role);

  IF v_role = 'student' THEN
    INSERT INTO public.students (profile_id, student_identifier)
    VALUES (NEW.id, 'STU-' || upper(substr(replace(NEW.id::text, '-', ''), 1, 12)));
  ELSE
    INSERT INTO public.instructors (profile_id)
    VALUES (NEW.id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- Users may edit only their display name. In particular, an authenticated user
-- must never be able to promote their own profiles.role through PostgREST.
REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE (full_name) ON public.profiles TO authenticated;

-- create_exam_session_atomic stores aggregated features for graded sessions,
-- but migration 4 only allowed behavioral_sessions as a parent. Preserve the
-- existing table and add the missing, mutually-exclusive exam relationship.
ALTER TABLE public.behavioral_features
  ALTER COLUMN session_id DROP NOT NULL,
  ADD COLUMN exam_session_id UUID REFERENCES public.exam_sessions(id) ON DELETE CASCADE,
  ADD CONSTRAINT behavioral_features_exactly_one_session
    CHECK (num_nonnulls(session_id, exam_session_id) = 1);

CREATE INDEX idx_behavioral_features_exam_session_id
  ON public.behavioral_features (exam_session_id);

-- The review route upserts one instructor review per exam session.
ALTER TABLE public.reviews
  ADD CONSTRAINT reviews_exam_session_unique UNIQUE (exam_session_id);

-- Correct the enum literal and replace the graded-session feature write with
-- the relationship introduced above.
CREATE OR REPLACE FUNCTION public.create_exam_session_atomic(p_input JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student_id UUID := (p_input->>'student_id')::UUID;
  v_assessment_id UUID := NULLIF(p_input->>'assessment_id', '')::UUID;
  v_exam_session_id UUID;
  v_deviation_id UUID;
  v_feature JSONB;
  v_contribution JSONB;
  v_pos INTEGER := 0;
  v_deviation_score NUMERIC := (p_input->>'deviation_score')::NUMERIC;
  v_threshold NUMERIC := (p_input->>'personalized_threshold')::NUMERIC;
  v_confidence NUMERIC := (p_input->>'confidence')::NUMERIC;
  v_review_status review_status;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'unauthenticated' USING ERRCODE = '28000'; END IF;
  IF v_student_id IS NULL OR NOT EXISTS (SELECT 1 FROM students WHERE id = v_student_id AND profile_id = auth.uid()) THEN
    RAISE EXCEPTION 'forbidden: student does not belong to authenticated user' USING ERRCODE = '42501';
  END IF;
  IF (p_input->>'device_type') NOT IN ('desktop', 'mobile', 'tablet') THEN RAISE EXCEPTION 'invalid device_type' USING ERRCODE = '22023'; END IF;
  IF v_deviation_score IS NULL OR v_deviation_score < 0 THEN RAISE EXCEPTION 'deviation_score must be a non-negative number' USING ERRCODE = '22023'; END IF;
  IF v_confidence IS NULL OR v_confidence < 0 OR v_confidence > 100 THEN RAISE EXCEPTION 'confidence must be between 0 and 100' USING ERRCODE = '22023'; END IF;
  v_review_status := CASE WHEN (p_input->>'review_status') IN ('normal', 'review_required', 'verified', 'not_verified', 'disputed') THEN (p_input->>'review_status')::review_status ELSE 'normal'::review_status END;

  INSERT INTO exam_sessions (student_id, assessment_id, device_type, started_at, submitted_at, status, deviation_score, personalized_threshold, confidence, review_status)
  VALUES (v_student_id, v_assessment_id, (p_input->>'device_type')::device_type, (p_input->>'started_at')::TIMESTAMPTZ, COALESCE((p_input->>'submitted_at')::TIMESTAMPTZ, now()), 'analyzed', v_deviation_score, v_threshold, v_confidence, v_review_status)
  RETURNING id INTO v_exam_session_id;

  FOR v_feature IN SELECT * FROM jsonb_array_elements(COALESCE(p_input->'features', '[]'::jsonb)) LOOP
    INSERT INTO behavioral_features (exam_session_id, question_id, response_time, revision_count, pointer_movement, scroll_distance, paste_detected, device_type, question_difficulty, session_position, event_timestamp)
    VALUES (v_exam_session_id, NULLIF(v_feature->>'question_id', '')::UUID, GREATEST(0, COALESCE(NULLIF(v_feature->>'response_time', 'NaN')::NUMERIC, 0)), GREATEST(0, COALESCE((v_feature->>'revision_count')::INTEGER, 0)), GREATEST(0, COALESCE(NULLIF(v_feature->>'pointer_movement', 'NaN')::NUMERIC, 0)), GREATEST(0, COALESCE(NULLIF(v_feature->>'scroll_distance', 'NaN')::NUMERIC, 0)), COALESCE((v_feature->>'paste_detected')::BOOLEAN, false), COALESCE((v_feature->>'device_type')::device_type, (p_input->>'device_type')::device_type), NULLIF(v_feature->>'question_difficulty', '')::NUMERIC, v_pos, COALESCE((v_feature->>'event_timestamp')::TIMESTAMPTZ, now()));
    v_pos := v_pos + 1;
  END LOOP;

  INSERT INTO deviation_analyses (exam_session_id, deviation_score, personalized_threshold, status, analysis_method)
  VALUES (v_exam_session_id, v_deviation_score, v_threshold, CASE WHEN v_review_status = 'review_required' THEN 'review_required' ELSE 'normal' END, 'weighted_z_score')
  RETURNING id INTO v_deviation_id;

  FOR v_contribution IN SELECT * FROM jsonb_array_elements(COALESCE(p_input->'feature_contributions', '[]'::jsonb)) LOOP
    IF (v_contribution->>'direction') NOT IN ('higher_than_expected', 'lower_than_expected', 'within_expected_range') THEN RAISE EXCEPTION 'invalid feature direction' USING ERRCODE = '22023'; END IF;
    INSERT INTO feature_contributions (deviation_analysis_id, feature_name, observed_value, expected_value, deviation, contribution, direction)
    VALUES (v_deviation_id, v_contribution->>'feature', NULLIF(v_contribution->>'observed', 'NaN')::NUMERIC, NULLIF(v_contribution->>'expected', 'NaN')::NUMERIC, NULLIF(v_contribution->>'deviation', 'NaN')::NUMERIC, NULLIF(v_contribution->>'contribution', 'NaN')::NUMERIC, (v_contribution->>'direction')::feature_direction);
  END LOOP;
  RETURN jsonb_build_object('exam_session_id', v_exam_session_id, 'deviation_analysis_id', v_deviation_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.persist_behavioral_model(
  p_student_id UUID, p_device_type device_type, p_session_count INTEGER,
  p_model_status model_status, p_confidence NUMERIC, p_calibrated_threshold NUMERIC,
  p_target_fpr NUMERIC, p_training_count INTEGER, p_calibration_count INTEGER,
  p_expectations JSONB
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_model_id UUID; v_expectation JSONB;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT EXISTS (SELECT 1 FROM students WHERE id = p_student_id AND (profile_id = auth.uid() OR public.auth_is_instructor_for_student(id) OR public.auth_role() = 'admin')) THEN RAISE EXCEPTION 'Unauthorized: student is not available to this user'; END IF;
  INSERT INTO behavioral_models (student_id, device_type, session_count, model_status, confidence, calibrated_threshold, target_false_positive_rate, training_session_count, calibration_session_count)
  VALUES (p_student_id, p_device_type, p_session_count, p_model_status, p_confidence, p_calibrated_threshold, p_target_fpr, p_training_count, p_calibration_count)
  ON CONFLICT (student_id, device_type) DO UPDATE SET session_count = EXCLUDED.session_count, model_status = EXCLUDED.model_status, confidence = EXCLUDED.confidence, calibrated_threshold = EXCLUDED.calibrated_threshold, target_false_positive_rate = EXCLUDED.target_false_positive_rate, training_session_count = EXCLUDED.training_session_count, calibration_session_count = EXCLUDED.calibration_session_count, updated_at = now()
  RETURNING id INTO v_model_id;
  INSERT INTO calibration_results (behavioral_model_id, target_false_positive_rate, calibrated_threshold, training_session_count, calibration_session_count, calibration_method)
  VALUES (v_model_id, p_target_fpr, p_calibrated_threshold, p_training_count, p_calibration_count, 'conformal_style_empirical')
  ON CONFLICT (behavioral_model_id) DO UPDATE SET target_false_positive_rate = EXCLUDED.target_false_positive_rate, calibrated_threshold = EXCLUDED.calibrated_threshold, training_session_count = EXCLUDED.training_session_count, calibration_session_count = EXCLUDED.calibration_session_count, calibration_method = EXCLUDED.calibration_method;
  DELETE FROM feature_expectations WHERE behavioral_model_id = v_model_id;
  FOR v_expectation IN SELECT * FROM jsonb_array_elements(COALESCE(p_expectations, '[]'::jsonb)) LOOP
    INSERT INTO feature_expectations (behavioral_model_id, feature_name, expected_value, uncertainty, variance, standard_deviation, lower_bound, upper_bound)
    VALUES (v_model_id, v_expectation->>'feature_name', (v_expectation->>'expected_value')::NUMERIC, (v_expectation->>'uncertainty')::NUMERIC, (v_expectation->>'variance')::NUMERIC, (v_expectation->>'standard_deviation')::NUMERIC, (v_expectation->>'lower_bound')::NUMERIC, (v_expectation->>'upper_bound')::NUMERIC);
  END LOOP;
  RETURN jsonb_build_object('behavioral_model_id', v_model_id, 'status', 'success');
END;
$$;

-- Instructor reviews must update both records atomically. Direct UPDATE is not
-- granted to instructors because it would allow them to edit unrelated exam
-- fields through PostgREST.
CREATE OR REPLACE FUNCTION public.review_exam_session(
  p_exam_session_id UUID,
  p_decision review_decision,
  p_notes TEXT
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_instructor_id UUID; v_student_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'unauthenticated' USING ERRCODE = '28000'; END IF;
  SELECT id INTO v_instructor_id FROM instructors WHERE profile_id = auth.uid();
  IF v_instructor_id IS NULL THEN RAISE EXCEPTION 'instructor profile required' USING ERRCODE = '42501'; END IF;
  SELECT student_id INTO v_student_id FROM exam_sessions WHERE id = p_exam_session_id;
  IF v_student_id IS NULL OR NOT public.auth_is_instructor_for_student(v_student_id) THEN RAISE EXCEPTION 'not assigned to this student' USING ERRCODE = '42501'; END IF;
  UPDATE exam_sessions SET review_status = p_decision WHERE id = p_exam_session_id;
  INSERT INTO reviews (exam_session_id, instructor_id, decision, notes, reviewed_at)
  VALUES (p_exam_session_id, v_instructor_id, p_decision, p_notes, now())
  ON CONFLICT (exam_session_id) DO UPDATE SET decision = EXCLUDED.decision, notes = EXCLUDED.notes, reviewed_at = EXCLUDED.reviewed_at;
END;
$$;

GRANT EXECUTE ON FUNCTION public.review_exam_session(UUID, review_decision, TEXT) TO authenticated;

CREATE POLICY "audit_logs_insert_own" ON public.audit_logs FOR INSERT TO authenticated
WITH CHECK (actor_profile_id = auth.uid());
