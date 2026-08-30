-- =============================================================================
-- ExamGuard — Migration 13: Persist Model RPC
-- =============================================================================

CREATE OR REPLACE FUNCTION persist_behavioral_model(
  p_student_id                 UUID,
  p_device_type                device_type,
  p_session_count              INTEGER,
  p_model_status               model_status,
  p_confidence                 NUMERIC,
  p_calibrated_threshold       NUMERIC,
  p_target_fpr                 NUMERIC,
  p_training_count             INTEGER,
  p_calibration_count          INTEGER,
  p_expectations               JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_model_id UUID;
  v_expectation JSONB;
BEGIN
  -- 1. Verify auth user is not null
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 2. Verify ownership
  IF NOT EXISTS (
    SELECT 1 FROM students
    WHERE id = p_student_id AND profile_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Student ID does not belong to the authenticated user';
  END IF;

  -- 3. Upsert into behavioral_models
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
    updated_at
  )
  VALUES (
    p_student_id,
    p_device_type,
    p_session_count,
    p_model_status,
    p_confidence,
    p_calibrated_threshold,
    p_target_fpr,
    p_training_count,
    p_calibration_count,
    now()
  )
  ON CONFLICT (student_id, device_type)
  DO UPDATE SET
    session_count = EXCLUDED.session_count,
    model_status = EXCLUDED.model_status,
    confidence = EXCLUDED.confidence,
    calibrated_threshold = EXCLUDED.calibrated_threshold,
    target_false_positive_rate = EXCLUDED.target_false_positive_rate,
    training_session_count = EXCLUDED.training_session_count,
    calibration_session_count = EXCLUDED.calibration_session_count,
    updated_at = now()
  RETURNING id INTO v_model_id;

  -- 4. Upsert into calibration_results
  -- Only upsert calibration if it was provided (or just upsert nulls if cold start)
  INSERT INTO calibration_results (
    behavioral_model_id,
    target_false_positive_rate,
    calibrated_threshold,
    training_session_count,
    calibration_session_count,
    calibration_method
  )
  VALUES (
    v_model_id,
    p_target_fpr,
    p_calibrated_threshold,
    p_training_count,
    p_calibration_count,
    'conformal_style_empirical'::calibration_method
  )
  ON CONFLICT (behavioral_model_id)
  DO UPDATE SET
    target_false_positive_rate = EXCLUDED.target_false_positive_rate,
    calibrated_threshold = EXCLUDED.calibrated_threshold,
    training_session_count = EXCLUDED.training_session_count,
    calibration_session_count = EXCLUDED.calibration_session_count,
    calibration_method = 'conformal_style_empirical'::calibration_method;

  -- 5. Replace feature_expectations deterministically
  DELETE FROM feature_expectations WHERE behavioral_model_id = v_model_id;

  IF jsonb_typeof(p_expectations) = 'array' THEN
    FOR v_expectation IN SELECT * FROM jsonb_array_elements(p_expectations)
    LOOP
      INSERT INTO feature_expectations (
        behavioral_model_id,
        feature_name,
        expected_value,
        uncertainty,
        variance,
        standard_deviation,
        lower_bound,
        upper_bound
      )
      VALUES (
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
  END IF;

  RETURN jsonb_build_object(
    'behavioral_model_id', v_model_id,
    'status', 'success'
  );
END;
$$;
