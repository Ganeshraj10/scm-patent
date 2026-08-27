-- =============================================================================
-- ExamGuard — Migration 3: Assessments, Questions, Assessment-Questions
--
-- assessments: an exam or quiz that students can take.
-- questions:   individual question items in the question bank.
-- assessment_questions: join table linking assessments to their questions.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- assessments
-- ---------------------------------------------------------------------------
CREATE TABLE assessments (
  id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  title             TEXT         NOT NULL,
  description       TEXT,
  assessment_code   TEXT         NOT NULL,   -- e.g. CS301-MID — matches ExamSession.examCode
  assessment_type   session_type NOT NULL,   -- low_stakes | graded_examination
  duration_minutes  SMALLINT     NOT NULL,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),

  CONSTRAINT assessments_code_unique       UNIQUE (assessment_code),
  CONSTRAINT assessments_duration_positive CHECK  (duration_minutes > 0)
);

COMMENT ON TABLE  assessments                  IS 'An exam or quiz that students sit.';
COMMENT ON COLUMN assessments.assessment_code  IS 'Short institutional code (e.g. CS301-MID). Matches app ExamSession.examCode.';
COMMENT ON COLUMN assessments.assessment_type  IS 'low_stakes sessions feed the behavioral model; graded_examination sessions are evaluated against it.';

CREATE TRIGGER set_updated_at_assessments
  BEFORE UPDATE ON assessments
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- ---------------------------------------------------------------------------
-- questions
-- Individual question items. Does NOT store correct answers in the same row
-- to avoid accidental exposure. Correct answers should be stored in a
-- separate protected table when security is a requirement.
-- ---------------------------------------------------------------------------
CREATE TABLE questions (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  question_text  TEXT        NOT NULL,
  difficulty     SMALLINT    NOT NULL DEFAULT 3,
  topic          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT questions_difficulty_range CHECK (difficulty BETWEEN 1 AND 5)
);

COMMENT ON TABLE  questions            IS 'Question bank items.';
COMMENT ON COLUMN questions.difficulty IS '1 (easy) to 5 (very hard).';

CREATE TRIGGER set_updated_at_questions
  BEFORE UPDATE ON questions
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- ---------------------------------------------------------------------------
-- assessment_questions
-- Join table: which questions appear in which assessment, and in what order.
-- ---------------------------------------------------------------------------
CREATE TABLE assessment_questions (
  assessment_id      UUID     NOT NULL REFERENCES assessments (id) ON DELETE CASCADE,
  question_id        UUID     NOT NULL REFERENCES questions    (id) ON DELETE CASCADE,
  question_position  SMALLINT NOT NULL,   -- 0-indexed position within the assessment

  CONSTRAINT assessment_questions_pk       PRIMARY KEY (assessment_id, question_id),
  CONSTRAINT assessment_questions_position CHECK       (question_position >= 0)
);

COMMENT ON TABLE  assessment_questions                   IS 'Many-to-many between assessments and questions with explicit ordering.';
COMMENT ON COLUMN assessment_questions.question_position IS '0-indexed position of the question within the assessment.';

-- Index to quickly retrieve questions for an assessment in order
CREATE INDEX idx_assessment_questions_position
  ON assessment_questions (assessment_id, question_position);
