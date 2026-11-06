# EXAMGUARD: PRIVACY, DATA GOVERNANCE & SECURITY REPORT

**Document:** Research Security & Privacy Architecture Evaluation  
**Framework:** ExamGuard — Explainable and Privacy-Aware Behavioural Anomaly Detection in Online Examinations  
**Compliance Standard:** Principle of Data Minimisation (GDPR Art. 5(1)(c)), Right to Explanation (GDPR Art. 22), Right to Erasure (GDPR Art. 17)  
**Date:** November 2026  

---

## 1. Privacy-by-Design Architecture

Traditional online proctoring systems violate student privacy and dignity by capturing continuous video feeds of private living spaces, room scans, biometric facial geometry, and indiscriminate raw keystroke logging. ExamGuard establishes a non-invasive, privacy-preserving alternative based on mathematical behavioural dynamics.

```
Conventional Proctoring vs. ExamGuard Privacy Architecture
───────────────────────────────────────────────────────────────────────────────────
Feature                  Conventional Commercial Proctoring      ExamGuard Framework
───────────────────────────────────────────────────────────────────────────────────
Continuous Webcams       Yes (Intrusive home video capture)      No (Explicitly Excluded)
Microphone Recording     Yes (Continuous acoustic monitoring)    No (Explicitly Excluded)
Room 360° Pan Scans      Yes (Surveillance of private home)      No (Explicitly Excluded)
Raw Keystroke Log        Yes (Records typed credentials/content)  No (Derived cadence only)
Clipboard Snooping       Yes (Reads private system clipboard)    No (Event count/rate only)
Student Identifiers      Real student names exposed in queues    HMAC-SHA256 Pseudonyms
Evidence Visibility      Unchecked vendor employee access        Instructor role-gated
Student Redress          Opaque algorithmic score penalty        Explainable Review Hub
Right-to-be-Forgotten    Indefinite third-party cloud storage    Cryptographic purge protocol
───────────────────────────────────────────────────────────────────────────────────
```

---

## 2. Six Core Privacy Safeguards

### Safeguard 1: Strict Data Minimisation (Client-Side Derived Features Only)
ExamGuard strictly enforces data minimisation before telemetry leaves the student's browser.
- **Permitted Features:** Exactly five aggregate, scalar behavioural dynamics:
  1. `response_time`: Duration spent on question in seconds ($s$).
  2. `revision_count`: Count of answer choice modifications.
  3. `pointer_movement`: Total Euclidean cursor travel in pixels ($px$).
  4. `scroll_distance`: Vertical viewport displacement in pixels ($px$).
  5. `paste_activity`: Discrete count of insertion events ($N \ge 0$).
- **Strictly Prohibited & Rejected Telemetry:**
  - Raw character text, key codes, and typed answers.
  - Raw clipboard text or system pasteboard contents.
  - Webcam imagery, audio buffers, and facial embeddings.
  - Browser history, external application lists, or host filesystem state.

The server-side ingestion validation pipeline (`lib/privacy/privacyService.ts`) actively inspects incoming payloads and throws an unrecoverable validation error if raw strings or key sequences are detected.

### Safeguard 2: Pseudonymous Student Identifiers
To prevent cognitive bias, instructor stereotyping, or identity leakage in review queues:
- Real student identifiers (e.g., student IDs, legal names, email addresses) are never passed to the ML feature extractors or anomaly detection engines.
- Instead, every student identity is passed through a keyed HMAC-SHA256 cryptographic digest to produce a non-reversible pseudonymous review handle (`STU-XXXX`).
- *Important Cryptographic Note:* HMAC-SHA256 is explicitly documented as a **one-way pseudonymous hashing mechanism**, NOT encryption. Because it is non-reversible, even an unauthorized party inspecting model inference logs cannot reconstruct the student's identity without access to the server-side institutional key.

### Safeguard 3: Separation of Identity & Behavioural Telemetry
- Identity tables (`profiles`, `auth.users`) are logically and cryptographically partitioned from behavioral telemetry records (`student_sessions`, `behavioral_features`).
- Database foreign keys reference internal UUIDs rather than student university IDs.
- Instructors inspecting the Explainable AI Hub see only the pseudonymous ID during behavioral review, preventing confirmation bias.

### Safeguard 4: Role-Based Access Control (RBAC) & Database RLS
- All data access is governed by PostgreSQL Row-Level Security (RLS) policies:
  - **Students:** Can only read and submit telemetry for their own active sessions (`auth.uid() = user_id`). Students have zero access to baseline parameters, other students' sessions, or instructor review queues.
  - **Instructors:** Can read aggregated session features and explainability results for enrolled course cohorts, but cannot alter raw telemetry.
  - **Administrators:** Can audit system integrity and cryptographic logs, but cannot modify student review determinations.
- Authorization is cryptographically verified on the server side using HMAC-signed session tokens (`lib/services/sessionAuth.ts`). Client cookies are never trusted for role authorization.

### Safeguard 5: Comprehensive Cryptographic Audit Logging
Every human review determination is cryptographically logged with:
- Reviewer identifier (`reviewed_by`)
- Exact timestamp (`reviewed_at`)
- Specific decision category (`cleared_normal`, `verified_deviation`, `inconclusive`)
- Instructor pedagogical notes
- Hash of the evaluated feature vector and model prediction snapshot.

This tamper-evident audit trail guarantees academic due process and supports external student appeals.

### Safeguard 6: Right-to-be-Forgotten & Data Deletion
Under GDPR Article 17, ExamGuard provides a permanent purge protocol (`PrivacyService.purgeStudentRecords`):
- All historical coursework features and baseline covariance parameters are permanently deleted.
- Active baselines revert to cold-start status.
- Anonymized audit entries retain only the non-identifiable execution timestamp for institutional statistical compliance.

---

## 3. Threat Model & Security Analysis

| Threat / Attack Vector | Risk Level | ExamGuard Mitigation |
|---|---|---|
| **Client-Side Role Spoofing** | High | Sever-side cryptographic token verification (`verifySessionToken`); plaintext cookies ignored. |
| **Telemetry Injection / Forgery** | Medium | Timestamp continuity verification, question sequencing checks, and bounds validation (`min >= 0`). |
| **Credential & Clipboard Harvesting** | Critical | Architecture physically ignores clipboard content and keystroke strings; only discrete event counts are recorded. |
| **Instructor Bias in Flagging** | Medium | Review queue presents pseudonymous identifiers (`STU-XXXX`); full explainability breakdown forces objective evidence review. |
| **Algorithmic Disciplinary Penalty** | Critical | Fully prevented by architecture: no automated penalties or score reductions are permitted; human review is mandatory. |

---

## 4. Ethical Compliance & Academic Due Process

ExamGuard strictly complies with the **ACM Code of Ethics** and **IEEE Standards for Autonomous and Intelligent Systems**:
1. **No Automated Accusation:** Anomaly detection scores are statistical divergence indicators relative to individual history, NOT proof of cheating.
2. **Pedagogical Presumption of Innocence:** High cognitive load (difficult questions) causes legitimate behavioral deviations. All flagged sessions default to pending pedagogical review.
3. **Right to Explanation:** Students and faculty receive full feature attribution breakdowns detailing exactly which behavioral factors triggered review.

