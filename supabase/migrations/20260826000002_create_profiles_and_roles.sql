-- =============================================================================
-- ExamGuard — Migration 2: Profiles, Students, Instructors
--
-- profiles: one row per authenticated user, references auth.users(id).
-- students: one row per enrolled student, references profiles.
-- instructors: one row per instructor, references profiles.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- profiles
-- Central identity table. id must match the Supabase Auth UUID so that
-- auth.uid() == profiles.id in future RLS policies.
-- ---------------------------------------------------------------------------
CREATE TABLE profiles (
  id            UUID        PRIMARY KEY,  -- Must equal auth.users.id
  full_name     TEXT        NOT NULL,
  email         TEXT        NOT NULL,
  role          app_role    NOT NULL DEFAULT 'student',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE  profiles          IS 'One row per authenticated user. id equals auth.users.id.';
COMMENT ON COLUMN profiles.role     IS 'Application role: student, instructor, or admin.';
COMMENT ON COLUMN profiles.email    IS 'Denormalized from auth.users for query convenience; must stay in sync.';

-- ---------------------------------------------------------------------------
-- students
-- Application-level student data, separate from the auth identity.
-- ---------------------------------------------------------------------------
CREATE TABLE students (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id           UUID        NOT NULL REFERENCES profiles (id) ON DELETE RESTRICT,
  student_identifier   TEXT        NOT NULL,  -- Institutional ID (e.g. U2021034)
  department           TEXT,
  enrollment_year      SMALLINT,
  current_device_type  device_type NOT NULL DEFAULT 'desktop',
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT students_profile_id_unique       UNIQUE (profile_id),
  CONSTRAINT students_identifier_unique       UNIQUE (student_identifier),
  CONSTRAINT students_enrollment_year_range   CHECK  (enrollment_year BETWEEN 1900 AND 2200)
);

COMMENT ON TABLE  students                        IS 'One student per enrolled user. Separate from auth identity.';
COMMENT ON COLUMN students.student_identifier     IS 'Institutional student ID, globally unique.';
COMMENT ON COLUMN students.current_device_type    IS 'Most recently observed device. Influences model selection.';

-- ---------------------------------------------------------------------------
-- instructors
-- Application-level instructor data.
-- ---------------------------------------------------------------------------
CREATE TABLE instructors (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id  UUID        NOT NULL REFERENCES profiles (id) ON DELETE RESTRICT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT instructors_profile_id_unique UNIQUE (profile_id)
);

COMMENT ON TABLE instructors IS 'One row per instructor. Links to the auth identity via profiles.';

-- ---------------------------------------------------------------------------
-- updated_at auto-update trigger
-- Applied to profiles, students, instructors.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_updated_at_profiles
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at_students
  BEFORE UPDATE ON students
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at_instructors
  BEFORE UPDATE ON instructors
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
