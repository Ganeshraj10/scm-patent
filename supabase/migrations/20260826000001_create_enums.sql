-- =============================================================================
-- ExamGuard — Migration 1: PostgreSQL Enums
-- All domain-level enumeration types used across the schema.
-- =============================================================================

-- Application role (aligns with profiles.role)
CREATE TYPE app_role AS ENUM (
  'student',
  'instructor',
  'admin'
);

-- Device class (aligns with types/index.ts DeviceType)
CREATE TYPE device_type AS ENUM (
  'desktop',
  'mobile',
  'tablet'
);

-- Behavioral model maturity (aligns with types/index.ts ModelStatus)
CREATE TYPE model_status AS ENUM (
  'cold_start',
  'active',
  'insufficient_data'
);

-- Session classification (aligns with types/index.ts SessionType)
CREATE TYPE session_type AS ENUM (
  'low_stakes',
  'graded_examination'
);

-- Review / integrity status across sessions and exam sessions
-- Aligns with types/index.ts ReviewStatus
CREATE TYPE review_status AS ENUM (
  'normal',
  'review_required',
  'verified',
  'not_verified',
  'disputed'
);

-- Lifecycle status of a graded exam attempt
CREATE TYPE exam_session_status AS ENUM (
  'in_progress',
  'submitted',
  'analyzed'
);

-- Instructor review decision (subset of review_status; no 'normal' or 'review_required')
CREATE TYPE review_decision AS ENUM (
  'verified',
  'not_verified',
  'disputed'
);

-- Direction of a feature deviation contribution
-- Aligns with deviationEngine.ts direction values
CREATE TYPE feature_direction AS ENUM (
  'higher_than_expected',
  'lower_than_expected',
  'within_expected_range'
);

-- Calibration algorithm identifier
-- NOTE: 'conformal_style_empirical' describes the prototype approach.
-- This is NOT a claim that the full patent mathematics is implemented.
CREATE TYPE calibration_method AS ENUM (
  'conformal_style_empirical'
);

-- Deviation analysis algorithm identifier
-- NOTE: 'weighted_z_score' describes the prototype computation.
CREATE TYPE analysis_method AS ENUM (
  'weighted_z_score'
);
