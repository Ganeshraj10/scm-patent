-- =============================================================================
-- ExamGuard — Migration 15: Add Mahalanobis Parameters to Behavioral Models
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Add mahalanobis_parameters JSONB column to behavioral_models table
-- ---------------------------------------------------------------------------
ALTER TABLE public.behavioral_models
  ADD COLUMN IF NOT EXISTS mahalanobis_parameters JSONB;

-- ---------------------------------------------------------------------------
-- 2. Update persist_behavioral_model RPC to store mahalanobis_parameters
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.persist_behavioral_model(
  p_student_id UUID,
  p_device_type device_type,
  p_session_count INTEGER,
  p_model_status model_status,
  p_confidence NUMERIC,
  p_calibrated_threshold NUMERIC,
  p_target_fpr NUMERIC,
  p_training_count INTEGER,
  p_calibration_count INTEGER,
  p_expectations JSONB,
  p_mahalanobis_parameters JSONB DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_model_id UUID;
  v_expectation JSONB;
BEGIN
  -- Authenticated check
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  -- Authorization check: student self, assigned instructor, or admin
  IF NOT EXISTS (
    SELECT 1 FROM students
    WHERE id = p_student_id
      AND (
        profile_id = auth.uid()
        OR public.auth_is_instructor_for_student(id)
        OR public.auth_role() = 'admin'
      )
  ) THEN
    RAISE EXCEPTION 'Unauthorized: student is not available to this user' USING ERRCODE = '42501';
  END IF;

  -- 1. Upsert behavioral_models record
  INSERT INTO behavioral_models (
    student_id,
    device_type,
    session_count,
    model_status,
    confidence,
    calibrated_threshold,
    target_false_positive_rate,
    training_session_count,
    calibration_session_count,
    mahalanobis_parameters
  ) VALUES (
    p_student_id,
    p_device_type,
    p_session_count,
    p_model_status,
    p_confidence,
    p_calibrated_threshold,
    p_target_fpr,
    p_training_count,
    p_calibration_count,
    p_mahalanobis_parameters
  )
  ON CONFLICT (student_id, device_type) DO UPDATE SET
    session_count = EXCLUDED.session_count,
    model_status = EXCLUDED.model_status,
    confidence = EXCLUDED.confidence,
    calibrated_threshold = EXCLUDED.calibrated_threshold,
    target_false_positive_rate = EXCLUDED.target_false_positive_rate,
    training_session_count = EXCLUDED.training_session_count,
    calibration_session_count = EXCLUDED.calibration_session_count,
    mahalanobis_parameters = EXCLUDED.mahalanobis_parameters,
    updated_at = now()
  RETURNING id INTO v_model_id;

  -- 2. Upsert calibration_results record
  INSERT INTO calibration_results (
    behavioral_model_id,
    target_false_positive_rate,
    calibrated_threshold,
    training_session_count,
    calibration_session_count,
    calibration_method
  ) VALUES (
    v_model_id,
    p_target_fpr,
    p_calibrated_threshold,
    p_training_count,
    p_calibration_count,
    'conformal_style_empirical'
  )
  ON CONFLICT (behavioral_model_id) DO UPDATE SET
    target_false_positive_rate = EXCLUDED.target_false_positive_rate,
    calibrated_threshold = EXCLUDED.calibrated_threshold,
    training_session_count = EXCLUDED.training_session_count,
    calibration_session_count = EXCLUDED.calibration_session_count,
    calibration_method = EXCLUDED.calibration_method;

  -- 3. Replace feature_expectations atomically
  DELETE FROM feature_expectations WHERE behavioral_model_id = v_model_id;

  FOR v_expectation IN SELECT * FROM jsonb_array_elements(COALESCE(p_expectations, '[]'::jsonb)) LOOP
    INSERT INTO feature_expectations (
      behavioral_model_id,
      feature_name,
      expected_value,
      uncertainty,
      variance,
      standard_deviation,
      lower_bound,
      upper_bound
    ) VALUES (
      v_model_id,
      v_expectation->>'feature_name',
      (v_expectation->>'expected_value')::NUMERIC,
      (v_expectation->>'uncertainty')::NUMERIC,
      (v_expectation->>'variance')::NUMERIC,
      (v_expectation->>'standard_deviation')::NUMERIC,
      (v_expectation->>'lower_bound')::NUMERIC,
      (v_expectation->>'upper_bound')::NUMERIC
    );
  END LOOP;

  RETURN jsonb_build_object('behavioral_model_id', v_model_id, 'status', 'success');
END;
$$;

GRANT EXECUTE ON FUNCTION public.persist_behavioral_model(UUID, device_type, INTEGER, model_status, NUMERIC, NUMERIC, NUMERIC, INTEGER, INTEGER, JSONB, JSONB) TO authenticated;
