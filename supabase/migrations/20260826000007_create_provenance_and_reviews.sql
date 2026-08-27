-- =============================================================================
-- ExamGuard — Migration 7: Provenance and Reviews
-- =============================================================================

-- ---------------------------------------------------------------------------
-- cryptographic_commitments
-- Cryptographic Provenance & Integrity Verification
-- ---------------------------------------------------------------------------
CREATE TABLE cryptographic_commitments (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_session_id UUID        NOT NULL REFERENCES exam_sessions(id) ON DELETE CASCADE,
  hash            TEXT        NOT NULL,
  algorithm       TEXT        NOT NULL DEFAULT 'SHA-256',
  payload_version TEXT        NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT cryptographic_commitments_exam_session_unique UNIQUE (exam_session_id)
);

-- ---------------------------------------------------------------------------
-- reviews
-- ---------------------------------------------------------------------------
CREATE TABLE reviews (
  id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_session_id UUID            NOT NULL REFERENCES exam_sessions(id) ON DELETE CASCADE,
  instructor_id   UUID            NOT NULL REFERENCES instructors(id) ON DELETE CASCADE,
  decision        review_decision,
  notes           TEXT,
  reviewed_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ     NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ     NOT NULL DEFAULT now()
);

CREATE TRIGGER set_updated_at_reviews
  BEFORE UPDATE ON reviews
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
