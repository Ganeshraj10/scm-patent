-- =============================================================================
-- ExamGuard — Migration 9: Indexes
-- =============================================================================

-- behavioral_sessions
CREATE INDEX idx_behavioral_sessions_student_id ON behavioral_sessions(student_id);
CREATE INDEX idx_behavioral_sessions_assessment_id ON behavioral_sessions(assessment_id);
CREATE INDEX idx_behavioral_sessions_type ON behavioral_sessions(session_type);
CREATE INDEX idx_behavioral_sessions_created_at ON behavioral_sessions(created_at);

-- behavioral_features
CREATE INDEX idx_behavioral_features_session_id ON behavioral_features(session_id);
CREATE INDEX idx_behavioral_features_question_id ON behavioral_features(question_id);

-- behavioral_models
CREATE INDEX idx_behavioral_models_student_id ON behavioral_models(student_id);
CREATE INDEX idx_behavioral_models_device_type ON behavioral_models(device_type);

-- feature_expectations
CREATE INDEX idx_feature_expectations_model_id ON feature_expectations(behavioral_model_id);

-- calibration_results
CREATE INDEX idx_calibration_results_model_id ON calibration_results(behavioral_model_id);

-- exam_sessions
CREATE INDEX idx_exam_sessions_student_id ON exam_sessions(student_id);
CREATE INDEX idx_exam_sessions_assessment_id ON exam_sessions(assessment_id);
CREATE INDEX idx_exam_sessions_review_status ON exam_sessions(review_status);
CREATE INDEX idx_exam_sessions_created_at ON exam_sessions(created_at);

-- deviation_analyses
CREATE INDEX idx_deviation_analyses_exam_session_id ON deviation_analyses(exam_session_id);

-- feature_contributions
CREATE INDEX idx_feature_contributions_analysis_id ON feature_contributions(deviation_analysis_id);

-- cryptographic_commitments
CREATE INDEX idx_cryptographic_commitments_exam_session_id ON cryptographic_commitments(exam_session_id);

-- reviews
CREATE INDEX idx_reviews_exam_session_id ON reviews(exam_session_id);
CREATE INDEX idx_reviews_instructor_id ON reviews(instructor_id);
CREATE INDEX idx_reviews_decision ON reviews(decision);

-- audit_logs
CREATE INDEX idx_audit_logs_actor_profile_id ON audit_logs(actor_profile_id);
CREATE INDEX idx_audit_logs_entity_id ON audit_logs(entity_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
