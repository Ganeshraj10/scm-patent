-- =============================================================================
-- ExamGuard — Migration 6: Exam Sessions and Deviation Analyses
-- =============================================================================

-- ---------------------------------------------------------------------------
-- exam_sessions
-- ---------------------------------------------------------------------------
CREATE TABLE exam_sessions (
  id                     UUID                PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id             UUID                NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  assessment_id          UUID                REFERENCES assessments(id) ON DELETE SET NULL,
  device_type            device_type         NOT NULL,
  started_at             TIMESTAMPTZ,
  submitted_at           TIMESTAMPTZ,
  status                 exam_session_status NOT NULL DEFAULT 'in_progress',
  deviation_score        NUMERIC,
  personalized_threshold NUMERIC,
  confidence             NUMERIC,
  review_status          review_status       NOT NULL DEFAULT 'normal',
  created_at             TIMESTAMPTZ         NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ         NOT NULL DEFAULT now()
);

CREATE TRIGGER set_updated_at_exam_sessions
  BEFORE UPDATE ON exam_sessions
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- ---------------------------------------------------------------------------
-- deviation_analyses
-- ---------------------------------------------------------------------------
CREATE TABLE deviation_analyses (
  id                     UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_session_id        UUID            NOT NULL REFERENCES exam_sessions(id) ON DELETE CASCADE,
  deviation_score        NUMERIC,
  personalized_threshold NUMERIC,
  status                 TEXT,
  analysis_method        analysis_method,
  created_at             TIMESTAMPTZ     NOT NULL DEFAULT now(),

  CONSTRAINT deviation_analyses_exam_session_unique UNIQUE (exam_session_id)
);

-- ---------------------------------------------------------------------------
-- feature_contributions
-- ---------------------------------------------------------------------------
CREATE TABLE feature_contributions (
  id                    UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
  deviation_analysis_id UUID              NOT NULL REFERENCES deviation_analyses(id) ON DELETE CASCADE,
  feature_name          TEXT              NOT NULL,
  observed_value        NUMERIC,
  expected_value        NUMERIC,
  deviation             NUMERIC,
  contribution          NUMERIC,
  direction             feature_direction,
  created_at            TIMESTAMPTZ       NOT NULL DEFAULT now(),

  CONSTRAINT feature_contributions_analysis_feature_unique UNIQUE (deviation_analysis_id, feature_name)
);
