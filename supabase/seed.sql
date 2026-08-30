-- Demo Login and Data Set for ExamGuard
-- Passwords for all users are "password123"

-- Seed users
-- Instructor
INSERT INTO auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token)
VALUES ('11111111-1111-1111-1111-111111111111', 'authenticated', 'authenticated', 'instructor@examguard.com', crypt('password123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"role": "instructor"}', now(), now(), '', '', '', '');
-- Student 1
INSERT INTO auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token)
VALUES ('22222222-2222-2222-2222-222222222222', 'authenticated', 'authenticated', 'student1@examguard.com', crypt('password123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"role": "student"}', now(), now(), '', '', '', '');
-- Student 2
INSERT INTO auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token)
VALUES ('33333333-3333-3333-3333-333333333333', 'authenticated', 'authenticated', 'student2@examguard.com', crypt('password123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"role": "student"}', now(), now(), '', '', '', '');

INSERT INTO auth.identities (id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
VALUES
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', format('{"sub":"%s","email":"%s"}', '11111111-1111-1111-1111-111111111111', 'instructor@examguard.com')::jsonb, 'email', current_timestamp, current_timestamp, current_timestamp),
  (gen_random_uuid(), '22222222-2222-2222-2222-222222222222', format('{"sub":"%s","email":"%s"}', '22222222-2222-2222-2222-222222222222', 'student1@examguard.com')::jsonb, 'email', current_timestamp, current_timestamp, current_timestamp),
  (gen_random_uuid(), '33333333-3333-3333-3333-333333333333', format('{"sub":"%s","email":"%s"}', '33333333-3333-3333-3333-333333333333', 'student2@examguard.com')::jsonb, 'email', current_timestamp, current_timestamp, current_timestamp);


-- Profiles
INSERT INTO public.profiles (id, full_name, email, role) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Dr. Alan Turing', 'instructor@examguard.com', 'instructor'),
  ('22222222-2222-2222-2222-222222222222', 'Alice Smith', 'student1@examguard.com', 'student'),
  ('33333333-3333-3333-3333-333333333333', 'Bob Johnson', 'student2@examguard.com', 'student');

-- Instructors & Students
-- Instructors
INSERT INTO public.instructors (id, profile_id) VALUES
  ('10000000-0000-0000-0000-100000000000', '11111111-1111-1111-1111-111111111111');

-- Students
INSERT INTO public.students (id, profile_id, student_identifier, department, enrollment_year, current_device_type) VALUES
  ('20000000-0000-0000-0000-200000000000', '22222222-2222-2222-2222-222222222222', 'STU-001', 'Computer Science', 2024, 'desktop'),
  ('30000000-0000-0000-0000-300000000000', '33333333-3333-3333-3333-333333333333', 'STU-002', 'Computer Science', 2024, 'desktop');

-- Instructor Student relation
INSERT INTO public.instructor_students (instructor_id, student_id) VALUES
  ('10000000-0000-0000-0000-100000000000', '20000000-0000-0000-0000-200000000000'),
  ('10000000-0000-0000-0000-100000000000', '30000000-0000-0000-0000-300000000000');

-- Assessments
INSERT INTO public.assessments (id, title, description, assessment_code, assessment_type, duration_minutes) VALUES
  ('44444444-4444-4444-4444-444444444444', 'CS301 Midterm Exam', 'Midterm examination covering data structures and algorithms.', 'CS301-MID', 'graded_examination', 60);

-- Questions
INSERT INTO public.questions (id, question_text, difficulty, topic) VALUES
  ('55555555-5555-5555-5555-555555555551', 'What is the time complexity of quicksort in the worst case?', 2, 'Algorithms'),
  ('55555555-5555-5555-5555-555555555552', 'Explain the difference between a stack and a queue.', 1, 'Data Structures'),
  ('55555555-5555-5555-5555-555555555553', 'Describe Dijkstra''s algorithm.', 3, 'Algorithms');

-- Assessment Questions
INSERT INTO public.assessment_questions (assessment_id, question_id, question_position) VALUES
  ('44444444-4444-4444-4444-444444444444', '55555555-5555-5555-5555-555555555551', 0),
  ('44444444-4444-4444-4444-444444444444', '55555555-5555-5555-5555-555555555552', 1),
  ('44444444-4444-4444-4444-444444444444', '55555555-5555-5555-5555-555555555553', 2);

-- Exam Sessions
INSERT INTO public.exam_sessions (id, student_id, assessment_id, device_type, status, deviation_score, personalized_threshold, confidence, review_status, started_at, submitted_at) VALUES
  ('66666666-6666-6666-6666-666666666661', '20000000-0000-0000-0000-200000000000', '44444444-4444-4444-4444-444444444444', 'desktop', 'analyzed', 0.85, 0.70, 0.92, 'review_required', now() - interval '2 hours', now() - interval '1 hour'),
  ('66666666-6666-6666-6666-666666666662', '30000000-0000-0000-0000-300000000000', '44444444-4444-4444-4444-444444444444', 'desktop', 'analyzed', 0.15, 0.75, 0.95, 'normal', now() - interval '2 hours', now() - interval '1 hour');

-- Deviation Analyses
INSERT INTO public.deviation_analyses (id, exam_session_id, deviation_score, personalized_threshold, status, analysis_method) VALUES
  ('77777777-7777-7777-7777-777777777771', '66666666-6666-6666-6666-666666666661', 0.85, 0.70, 'flagged', 'weighted_z_score'),
  ('77777777-7777-7777-7777-777777777772', '66666666-6666-6666-6666-666666666662', 0.15, 0.75, 'normal', 'weighted_z_score');

-- Feature contributions for the flagged session
INSERT INTO public.feature_contributions (deviation_analysis_id, feature_name, observed_value, expected_value, deviation, contribution, direction) VALUES
  ('77777777-7777-7777-7777-777777777771', 'flight_time_mean', 120, 200, 80, 0.45, 'lower_than_expected'),
  ('77777777-7777-7777-7777-777777777771', 'dwell_time_mean', 150, 140, 10, 0.05, 'higher_than_expected');

-- Behavioral Models
INSERT INTO public.behavioral_models (id, student_id, device_type, model_status, features_json, sample_count) VALUES
  (gen_random_uuid(), '20000000-0000-0000-0000-200000000000', 'desktop', 'active', '{"flight_time_mean": 200, "dwell_time_mean": 140}', 1500),
  (gen_random_uuid(), '30000000-0000-0000-0000-300000000000', 'desktop', 'active', '{"flight_time_mean": 210, "dwell_time_mean": 135}', 1600);
