-- =============================================================================
-- ExamGuard — Migration 4: Behavioral Sessions and Features
-- =============================================================================

-- ---------------------------------------------------------------------------
-- behavioral_sessions
-- ---------------------------------------------------------------------------
CREATE TABLE behavioral_sessions (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id       UUID         NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  assessment_id    UUID         REFERENCES assessments(id) ON DELETE SET NULL,
  session_type     session_type NOT NULL,
  device_type      device_type  NOT NULL,
  session_position INTEGER,
  started_at       TIMESTAMPTZ,
  completed_at     TIMESTAMPTZ,
  review_status    review_status NOT NULL DEFAULT 'normal',
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE TRIGGER set_updated_at_behavioral_sessions
  BEFORE UPDATE ON behavioral_sessions
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- ---------------------------------------------------------------------------
-- behavioral_features
-- ---------------------------------------------------------------------------
CREATE TABLE behavioral_features (
  id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id          UUID         NOT NULL REFERENCES behavioral_sessions(id) ON DELETE CASCADE,
  question_id         UUID         REFERENCES questions(id) ON DELETE SET NULL,
  response_time       NUMERIC,
  revision_count      INTEGER,
  pointer_movement    NUMERIC,
  scroll_distance     NUMERIC,
  paste_detected      BOOLEAN      DEFAULT false,
  device_type         device_type  NOT NULL,
  question_difficulty NUMERIC,
  session_position    INTEGER,
  event_timestamp     TIMESTAMPTZ,
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT now()
);
