-- =============================================================================
-- ExamGuard — Migration 12: Server-Side Atomic Persistence RPCs
--
-- Two narrowly-scoped PostgreSQL functions for atomic session writes.
-- These execute within an implicit transaction so partial writes are impossible.
-- Both functions:
--   1. Verify the caller is authenticated
--   2. Verify the student record belongs to the authenticated user
--   3. Perform all inserts atomically
--   4. Return the created IDs
--
-- These are SECURITY DEFINER so they can see all rows needed for validation,
-- but they explicitly check ownership before any write.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. create_behavioral_session_with_features
--
-- Atomically creates one behavioral_sessions row + N behavioral_features rows.
-- Used for low-stakes practice sessions.
--
-- Parameters (JSONB):
--   student_id      UUID   – students.id (not profiles.id)
--   assessment_id   UUID?  – assessments.id (nullable)
--   session_type    text   – 'low_stakes' | 'graded_examination'
--   device_type     text   – 'desktop' | 'mobile' | 'tablet'
--   started_at      text   – ISO 8601 timestamp
--   completed_at    text   – ISO 8601 timestamp
--   features        JSONB  – array of feature objects
--
-- Returns: JSONB { session_id: UUID }
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_behavioral_session_with_features(
  p_input JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student_id       UUID;
  v_assessment_id    UUID;
  v_session_id       UUID;
  v_feature          JSONB;
  v_feature_arr      JSONB;
  v_pos              INTEGER := 0;
  v_response_time    NUMERIC;
  v_revision_count   INTEGER;
  v_pointer_movement NUMERIC;
  v_scroll_distance  NUMERIC;
  v_paste_detected   BOOLEAN;
  v_device_type      device_type;
BEGIN
  -- ── Auth check ─────────────────────────────────────────────
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING ERRCODE = '28000';
  END IF;

  -- ── Extract + validate student ownership ───────────────────
  v_student_id := (p_input->>'student_id')::UUID;

  IF v_student_id IS NULL THEN
    RAISE EXCEPTION 'student_id is required' USING ERRCODE = '22023';
  END IF;

  -- Verify the student's profile_id matches the caller
  IF NOT EXISTS (
    SELECT 1 FROM students WHERE id = v_student_id AND profile_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'forbidden: student does not belong to authenticated user'
      USING ERRCODE = '42501';
  END IF;

  -- ── Optional assessment reference ─────────────────────────
  IF p_input->>'assessment_id' IS NOT NULL THEN
    v_assessment_id := (p_input->>'assessment_id')::UUID;
  END IF;

  -- ── Validate enum values ───────────────────────────────────
  IF (p_input->>'session_type') NOT IN ('low_stakes', 'graded_examination') THEN
    RAISE EXCEPTION 'invalid session_type' USING ERRCODE = '22023';
  END IF;
  IF (p_input->>'device_type') NOT IN ('desktop', 'mobile', 'tablet') THEN
    RAISE EXCEPTION 'invalid device_type' USING ERRCODE = '22023';
  END IF;

  -- ── Insert behavioral_sessions ────────────────────────────
  INSERT INTO behavioral_sessions (
    student_id,
    assessment_id,
    session_type,
    device_type,
    started_at,
    completed_at,
    review_status
  ) VALUES (
    v_student_id,
    v_assessment_id,
    (p_input->>'session_type')::session_type,
    (p_input->>'device_type')::device_type,
    (p_input->>'started_at')::TIMESTAMPTZ,
    (p_input->>'completed_at')::TIMESTAMPTZ,
    'normal'
  )
  RETURNING id INTO v_session_id;

  -- ── Bulk insert behavioral_features ──────────────────────
  v_feature_arr := p_input->'features';
  IF v_feature_arr IS NOT NULL AND jsonb_array_length(v_feature_arr) > 0 THEN
    FOR v_feature IN SELECT * FROM jsonb_array_elements(v_feature_arr)
    LOOP
      -- Validate numeric fields: disallow NaN and Infinity via text check
      v_response_time    := NULLIF((v_feature->>'response_time')::TEXT, 'NaN')::NUMERIC;
      v_revision_count   := GREATEST(0, COALESCE((v_feature->>'revision_count')::INTEGER, 0));
      v_pointer_movement := GREATEST(0, COALESCE(NULLIF((v_feature->>'pointer_movement')::TEXT, 'NaN')::NUMERIC, 0));
      v_scroll_distance  := GREATEST(0, COALESCE(NULLIF((v_feature->>'scroll_distance')::TEXT, 'NaN')::NUMERIC, 0));
      v_paste_detected   := COALESCE((v_feature->>'paste_detected')::BOOLEAN, false);
      v_device_type      := COALESCE((v_feature->>'device_type')::device_type, (p_input->>'device_type')::device_type);

      IF v_response_time IS NOT NULL AND v_response_time < 0 THEN
        RAISE EXCEPTION 'response_time must be non-negative' USING ERRCODE = '22023';
      END IF;

      INSERT INTO behavioral_features (
        session_id,
        question_id,
        response_time,
        revision_count,
        pointer_movement,
        scroll_distance,
        paste_detected,
        device_type,
        question_difficulty,
        session_position,
        event_timestamp
      ) VALUES (
        v_session_id,
        NULLIF(v_feature->>'question_id', '')::UUID,
        v_response_time,
        v_revision_count,
        v_pointer_movement,
        v_scroll_distance,
        v_paste_detected,
        v_device_type,
        NULLIF(v_feature->>'question_difficulty', '')::NUMERIC,
        v_pos,
        COALESCE((v_feature->>'event_timestamp')::TIMESTAMPTZ, now())
      );

      v_pos := v_pos + 1;
    END LOOP;
  END IF;

  RETURN jsonb_build_object('session_id', v_session_id);
END;
$$;

COMMENT ON FUNCTION public.create_behavioral_session_with_features IS
  'Atomically creates a behavioral session with all its derived feature rows. '
  'Verifies authenticated user owns the student record before writing. '
  'Only stores aggregated/derived metrics — no raw keystrokes or answer content.';


-- ---------------------------------------------------------------------------
-- 2. create_exam_session_atomic
--
-- Atomically creates:
--   exam_sessions (1 row)
--   behavioral_features (N rows)
--   deviation_analyses (1 row)
--   feature_contributions (N rows)
--
-- All four inserts succeed or all fail together.
--
-- Parameters (JSONB):
--   student_id              UUID
--   assessment_id           UUID?
--   device_type             text
--   started_at              text
--   submitted_at            text
--   deviation_score         numeric
--   personalized_threshold  numeric
--   confidence              numeric
--   review_status           text
--   features                JSONB array
--   feature_contributions   JSONB array
--
-- Returns: JSONB { exam_session_id, deviation_analysis_id }
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_exam_session_atomic(
  p_input JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student_id           UUID;
  v_assessment_id        UUID;
  v_exam_session_id      UUID;
  v_deviation_id         UUID;
  v_feature              JSONB;
  v_contribution         JSONB;
  v_feature_arr          JSONB;
  v_contribution_arr     JSONB;
  v_pos                  INTEGER := 0;
  v_deviation_score      NUMERIC;
  v_threshold            NUMERIC;
  v_confidence           NUMERIC;
  v_review_status        review_status;
  v_response_time        NUMERIC;
  v_revision_count       INTEGER;
  v_pointer_movement     NUMERIC;
  v_scroll_distance      NUMERIC;
  v_paste_detected       BOOLEAN;
  v_device_type          device_type;
BEGIN
  -- ── Auth check ─────────────────────────────────────────────
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING ERRCODE = '28000';
  END IF;

  -- ── Extract + validate student ownership ───────────────────
  v_student_id := (p_input->>'student_id')::UUID;

  IF v_student_id IS NULL THEN
    RAISE EXCEPTION 'student_id is required' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM students WHERE id = v_student_id AND profile_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'forbidden: student does not belong to authenticated user'
      USING ERRCODE = '42501';
  END IF;

  -- ── Optional assessment reference ─────────────────────────
  IF p_input->>'assessment_id' IS NOT NULL THEN
    v_assessment_id := (p_input->>'assessment_id')::UUID;
  END IF;

  -- ── Validate enum values ───────────────────────────────────
  IF (p_input->>'device_type') NOT IN ('desktop', 'mobile', 'tablet') THEN
    RAISE EXCEPTION 'invalid device_type' USING ERRCODE = '22023';
  END IF;

  -- ── Validate authoritative numeric fields ─────────────────
  v_deviation_score := (p_input->>'deviation_score')::NUMERIC;
  v_threshold       := (p_input->>'personalized_threshold')::NUMERIC;
  v_confidence      := (p_input->>'confidence')::NUMERIC;

  IF v_deviation_score IS NULL OR v_deviation_score < 0 THEN
    RAISE EXCEPTION 'deviation_score must be a non-negative number' USING ERRCODE = '22023';
  END IF;
  IF v_confidence IS NULL OR v_confidence < 0 OR v_confidence > 100 THEN
    RAISE EXCEPTION 'confidence must be between 0 and 100' USING ERRCODE = '22023';
  END IF;

  -- ── Map review_status ──────────────────────────────────────
  IF (p_input->>'review_status') IN ('normal', 'review_required', 'verified', 'not_verified', 'disputed') THEN
    v_review_status := (p_input->>'review_status')::review_status;
  ELSE
    v_review_status := 'normal';
  END IF;

  -- ── Insert exam_sessions ──────────────────────────────────
  INSERT INTO exam_sessions (
    student_id,
    assessment_id,
    device_type,
    started_at,
    submitted_at,
    status,
    deviation_score,
    personalized_threshold,
    confidence,
    review_status
  ) VALUES (
    v_student_id,
    v_assessment_id,
    (p_input->>'device_type')::device_type,
    (p_input->>'started_at')::TIMESTAMPTZ,
    COALESCE((p_input->>'submitted_at')::TIMESTAMPTZ, now()),
    'analyzed',
    v_deviation_score,
    v_threshold,
    v_confidence,
    v_review_status
  )
  RETURNING id INTO v_exam_session_id;

  -- ── Bulk insert behavioral_features ──────────────────────
  v_feature_arr := p_input->'features';
  IF v_feature_arr IS NOT NULL AND jsonb_array_length(v_feature_arr) > 0 THEN
    FOR v_feature IN SELECT * FROM jsonb_array_elements(v_feature_arr)
    LOOP
      v_response_time    := GREATEST(0, COALESCE(NULLIF((v_feature->>'response_time')::TEXT, 'NaN')::NUMERIC, 0));
      v_revision_count   := GREATEST(0, COALESCE((v_feature->>'revision_count')::INTEGER, 0));
      v_pointer_movement := GREATEST(0, COALESCE(NULLIF((v_feature->>'pointer_movement')::TEXT, 'NaN')::NUMERIC, 0));
      v_scroll_distance  := GREATEST(0, COALESCE(NULLIF((v_feature->>'scroll_distance')::TEXT, 'NaN')::NUMERIC, 0));
      v_paste_detected   := COALESCE((v_feature->>'paste_detected')::BOOLEAN, false);
      v_device_type      := COALESCE((v_feature->>'device_type')::device_type, (p_input->>'device_type')::device_type);

      INSERT INTO behavioral_features (
        session_id,
        question_id,
        response_time,
        revision_count,
        pointer_movement,
        scroll_distance,
        paste_detected,
        device_type,
        question_difficulty,
        session_position,
        event_timestamp
      ) VALUES (
        v_exam_session_id,
        NULLIF(v_feature->>'question_id', '')::UUID,
        v_response_time,
        v_revision_count,
        v_pointer_movement,
        v_scroll_distance,
        v_paste_detected,
        v_device_type,
        NULLIF(v_feature->>'question_difficulty', '')::NUMERIC,
        v_pos,
        COALESCE((v_feature->>'event_timestamp')::TIMESTAMPTZ, now())
      );

      v_pos := v_pos + 1;
    END LOOP;
  END IF;

  -- ── Insert deviation_analyses ─────────────────────────────
  INSERT INTO deviation_analyses (
    exam_session_id,
    deviation_score,
    personalized_threshold,
    status,
    analysis_method
  ) VALUES (
    v_exam_session_id,
    v_deviation_score,
    v_threshold,
    CASE WHEN v_review_status = 'review_required' THEN 'review_required' ELSE 'normal' END,
    'weighted_z_score'
  )
  RETURNING id INTO v_deviation_id;

  -- ── Bulk insert feature_contributions ─────────────────────
  v_contribution_arr := p_input->'feature_contributions';
  IF v_contribution_arr IS NOT NULL AND jsonb_array_length(v_contribution_arr) > 0 THEN
    FOR v_contribution IN SELECT * FROM jsonb_array_elements(v_contribution_arr)
    LOOP
      -- Validate direction enum
      IF (v_contribution->>'direction') NOT IN (
        'higher_than_expected', 'lower_than_expected', 'within_expected_range'
      ) THEN
        RAISE EXCEPTION 'invalid feature direction: %', v_contribution->>'direction'
          USING ERRCODE = '22023';
      END IF;

      INSERT INTO feature_contributions (
        deviation_analysis_id,
        feature_name,
        observed_value,
        expected_value,
        deviation,
        contribution,
        direction
      ) VALUES (
        v_deviation_id,
        v_contribution->>'feature',
        NULLIF(v_contribution->>'observed', 'NaN')::NUMERIC,
        NULLIF(v_contribution->>'expected', 'NaN')::NUMERIC,
        NULLIF(v_contribution->>'deviation', 'NaN')::NUMERIC,
        NULLIF(v_contribution->>'contribution', 'NaN')::NUMERIC,
        (v_contribution->>'direction')::feature_direction
      );
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'exam_session_id',    v_exam_session_id,
    'deviation_analysis_id', v_deviation_id
  );
END;
$$;

COMMENT ON FUNCTION public.create_exam_session_atomic IS
  'Atomically persists a complete graded exam submission: exam_sessions, '
  'behavioral_features, deviation_analyses, and feature_contributions. '
  'Verifies authenticated user owns the student record. '
  'Authoritative fields (deviation_score, personalized_threshold, confidence, review_status) '
  'are validated server-side. No raw keystrokes or answer content is stored.';

-- Grant execute to authenticated role
GRANT EXECUTE ON FUNCTION public.create_behavioral_session_with_features(JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_exam_session_atomic(JSONB) TO authenticated;
