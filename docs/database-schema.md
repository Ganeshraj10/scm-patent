# ExamGuard — Database Schema (Phase 2.5)

This document describes the complete PostgreSQL schema for the ExamGuard application, designed for Supabase.

## Overview
The database uses a completely normalized relational structure to track students, instructors, behavioral metrics, cryptographic provenance, and human reviews.

### Identity & Profiles
- **`profiles`**: The central application identity. `id` matches `auth.users.id`. Contains `role`, `email`, and `full_name`.
- **`students`**: Application-level student profile, linking to `profiles` via `profile_id`. Contains institutional identifier and current device type.
- **`instructors`**: Application-level instructor profile, linking to `profiles` via `profile_id`.

### Assessment Structure
- **`assessments`**: Defines an exam or quiz (e.g., `CS301-MID`). Tracks `duration_minutes` and `assessment_type` (`low_stakes` vs `graded_examination`).
- **`questions`**: Individual question items in the bank (does not store correct answers for security).
- **`assessment_questions`**: A join table mapping `questions` to `assessments` with an explicit `question_position`.

### Behavioral Data
- **`behavioral_sessions`**: High-level tracking of a session (either training or graded). Contains device type, timing, and review status.
- **`behavioral_features`**: Granular behavioral metrics associated with a session and question. Includes derived metrics like `response_time`, `revision_count`, `pointer_movement`, `scroll_distance`, and `paste_detected`. *Crucially, does not store raw keystrokes, audio, or video to maintain privacy.*

### Behavioral Modeling & Calibration
- **`behavioral_models`**: Tracks a student's personalized behavioral model for a specific `device_type`. Includes confidence, status, and thresholds.
- **`feature_expectations`**: Defines the expected behavior variance, lower bound, and upper bound for a given model and feature.
- **`calibration_results`**: Stores the output of the prototype `conformal_style_empirical` calibration algorithm.

### Examination & Deviation
- **`exam_sessions`**: Tracks a graded exam attempt. Stores final `deviation_score`, `personalized_threshold`, and `review_status`.
- **`deviation_analyses`**: The result of comparing an `exam_session` against a `behavioral_model`. Uses `weighted_z_score` analysis.
- **`feature_contributions`**: A detailed breakdown of which features caused a deviation during the analysis, categorized by `direction`.

### Provenance & Review
- **`cryptographic_commitments`**: Stores the SHA-256 hash of the exam session payload for Cryptographic Provenance & Integrity Verification.
- **`reviews`**: Human instructor review decisions (`verified`, `not_verified`, `disputed`). *There are no automatic penalties or "cheating" labels.*

### System Logs
- **`audit_logs`**: Tracks actions taken by users (or system) for auditing purposes.

### Authorization
- **`instructor_students`**: A mapping table linking `instructors` to `students`. This establishes the authorization boundary for instructors.

## Future RLS Authorization Model
In Phase 4, Row Level Security (RLS) will be enabled across all tables based on the following ownership model:
- **Student**: Has read (and limited write) access only to data that traces back to their `auth.uid()` via the `students` table.
- **Instructor**: Has read/write access to student data **only** if an explicit relationship exists in the `instructor_students` table linking their `auth.uid()` to the student's ID.
- **Admin**: Has controlled administrative access.

## Constraints & Cascades
The schema heavily utilizes foreign keys and `ON DELETE CASCADE` where appropriate (e.g., deleting an exam session cascades to its deviation analyses and cryptographic commitments). Core identity data (students/instructors) uses `RESTRICT` to prevent accidental loss of historical records.
