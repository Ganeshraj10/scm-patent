# ExamGuard — Database Security & RLS Model

This document describes the Row Level Security (RLS) and authorization architecture for the ExamGuard PostgreSQL database.

## 1. Identity and RLS Principles
All security resolves around the Supabase authenticated user (`auth.uid()`), which maps exactly to the `id` column in the `profiles` table.

The system relies on three overarching principles:
- **Student Privacy:** Students can only read/write their own records.
- **Instructor Least-Privilege:** Instructors can only read/write records for students they are explicitly assigned to (via `instructor_students`).
- **Server Authority:** The client is restricted from mutating sensitive algorithmic or administrative states.

## 2. Protected Server-Authoritative Fields
Row Level Security (RLS) primarily controls **which rows** a user can access, not which specific columns they can update within a permitted row. 

Therefore, several critical fields are strictly considered **server-authoritative**. These fields are intentionally excluded from client-side mutations. Any modification to these fields must be handled by trusted server-side API endpoints, database triggers, or restricted internal functions:

- `profiles.role` (prevents privilege escalation)
- `students.profile_id` (prevents ownership takeover)
- `exam_sessions.student_id`
- `exam_sessions.deviation_score`
- `exam_sessions.personalized_threshold`
- `exam_sessions.confidence`
- `exam_sessions.review_status`
- `behavioral_models.calibrated_threshold`
- `behavioral_models.confidence`
- `behavioral_models.model_status`

## 3. Helper Functions
To keep RLS policies performant and avoid recursive evaluation errors, we use specific `SECURITY DEFINER` helper functions:
- `public.auth_role()`: Retrieves the current user's role from `profiles`.
- `public.auth_student_id()`: Retrieves the current user's `student.id`.
- `public.auth_instructor_id()`: Retrieves the current user's `instructor.id`.
- `public.auth_is_instructor_for_student(student_id)`: Checks if the current user is an instructor explicitly assigned to the provided `student_id` via the `instructor_students` table.

These functions are strictly bound to `search_path = public` and do not expose arbitrary data.

## 4. Policy Model by Role

### Anonymous Users
- **No access** to any tables. 

### Students
- **`profiles`, `students`:** Can `SELECT` and `UPDATE` their own row.
- **Assessments:** Can `SELECT` from `assessments`, `questions`, and `assessment_questions`.
- **Behavioral Data:** Can `SELECT`, `INSERT`, and `UPDATE` sessions, features, and exams **only** if the `student_id` traces back to their `auth_student_id()`.
- **Restricted:** Cannot access another student's data. Cannot access instructor reviews, `instructor_students` assignments, or `audit_logs`.

### Instructors
- **`profiles`, `instructors`:** Can `SELECT` and `UPDATE` their own row.
- **Assessments:** Can `SELECT` assessments.
- **Behavioral Data:** Can `SELECT` behavioral data (sessions, models, exams, analyses) **only** if the data traces back to a student explicitly assigned to them via the `instructor_students` table.
- **`reviews`:** Can `SELECT`, `INSERT`, and `UPDATE` human review decisions (`verified`, `not_verified`, `disputed`) for their assigned students' exams.
- **Restricted:** Cannot arbitrarily assign themselves to students. Cannot view unassigned student data.

### Admins
- **Full Access:** Have `ALL` privileges on tables like `behavioral_models`, `assessments`, and `instructor_students` for administrative operations. Admins are the only role capable of directly viewing `audit_logs`.

## 5. Known Limitations & Future Enhancements
- **Assessment Ownership:** The current schema allows all students and instructors to view all `assessments`. Future iterations may require an `instructor_assessments` or `course_enrollments` mapping table to restrict assessment visibility by course or instructor ownership.
