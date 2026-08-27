-- =============================================================================
-- ExamGuard — Migration 8: Audit Logs
-- =============================================================================

-- ---------------------------------------------------------------------------
-- audit_logs
-- ---------------------------------------------------------------------------
CREATE TABLE audit_logs (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_profile_id UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  action           TEXT        NOT NULL,
  entity_type      TEXT,
  entity_id        UUID,
  metadata         JSONB,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
