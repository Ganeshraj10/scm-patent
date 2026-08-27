-- =============================================================================
-- ExamGuard — Migration 10: Instructor Assignments
-- =============================================================================

-- ---------------------------------------------------------------------------
-- instructor_students
-- Establishes the authorization boundary for Phase 4 (RLS).
-- ---------------------------------------------------------------------------
CREATE TABLE instructor_students (
  instructor_id UUID        NOT NULL REFERENCES instructors(id) ON DELETE CASCADE,
  student_id    UUID        NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  assigned_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT instructor_students_pk PRIMARY KEY (instructor_id, student_id)
);

-- Index to quickly find an instructor's assigned students (and vice versa)
CREATE INDEX idx_instructor_students_student_id ON instructor_students(student_id);
-- The primary key automatically provides an index on (instructor_id, student_id),
-- so filtering by instructor_id is already fast.
