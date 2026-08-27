-- =============================================================================
-- ExamGuard — Migration 5: Behavioral Models
-- =============================================================================

-- ---------------------------------------------------------------------------
-- behavioral_models
-- ---------------------------------------------------------------------------
CREATE TABLE behavioral_models (
  id                         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id                 UUID         NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  device_type                device_type  NOT NULL,
  session_count              INTEGER      NOT NULL DEFAULT 0,
  model_status               model_status NOT NULL DEFAULT 'cold_start',
  confidence                 NUMERIC,
  calibrated_threshold       NUMERIC,
  target_false_positive_rate NUMERIC,
  training_session_count     INTEGER,
  calibration_session_count  INTEGER,
  created_at                 TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at                 TIMESTAMPTZ  NOT NULL DEFAULT now(),

  CONSTRAINT behavioral_models_student_device_unique UNIQUE (student_id, device_type)
);

CREATE TRIGGER set_updated_at_behavioral_models
  BEFORE UPDATE ON behavioral_models
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- ---------------------------------------------------------------------------
-- feature_expectations
-- ---------------------------------------------------------------------------
CREATE TABLE feature_expectations (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  behavioral_model_id UUID        NOT NULL REFERENCES behavioral_models(id) ON DELETE CASCADE,
  feature_name        TEXT        NOT NULL,
  expected_value      NUMERIC,
  uncertainty         NUMERIC,
  variance            NUMERIC,
  standard_deviation  NUMERIC,
  lower_bound         NUMERIC,
  upper_bound         NUMERIC,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT feature_expectations_model_feature_unique UNIQUE (behavioral_model_id, feature_name)
);

CREATE TRIGGER set_updated_at_feature_expectations
  BEFORE UPDATE ON feature_expectations
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- ---------------------------------------------------------------------------
-- calibration_results
-- ---------------------------------------------------------------------------
CREATE TABLE calibration_results (
  id                         UUID               PRIMARY KEY DEFAULT gen_random_uuid(),
  behavioral_model_id        UUID               NOT NULL REFERENCES behavioral_models(id) ON DELETE CASCADE,
  target_false_positive_rate NUMERIC,
  calibrated_threshold       NUMERIC,
  training_session_count     INTEGER,
  calibration_session_count  INTEGER,
  calibration_method         calibration_method,
  created_at                 TIMESTAMPTZ        NOT NULL DEFAULT now(),

  CONSTRAINT calibration_results_model_unique UNIQUE (behavioral_model_id)
);
