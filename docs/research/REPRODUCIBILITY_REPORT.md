# ExamGuard: Experimental Reproducibility Report

**Document Reference:** `docs/research/REPRODUCIBILITY_REPORT.md`  
**Branch:** `research-validation-corrections`  
**Date:** November 2026  
**Auditor:** Senior ML Research Engineer, Cybersecurity Engineer & Full-Stack Architect  

---

## 1. System Specifications & Computational Environment

All experiments, statistical analyses, unit tests, and production builds were executed in the following local environment:

| Attribute | Specification |
|---|---|
| **Operating System** | Windows 11 Pro 64-bit |
| **Node.js Runtime** | Node.js `v24.19.0` |
| **Next.js Engine** | Next.js `16.3.1` (Turbopack Engine) |
| **Language / Compiler** | TypeScript `5.8.2` (`target: ES2022`, strict typing) |
| **Test Runner** | Jest `29.7.0` (with `ts-jest` preset) |
| **Linear Algebra & Stats** | Math.js `14.4.0` / Custom numerical routines (Lanczos series, Continued Fraction Beta, Platt SMO) |
| **Deterministic Seed** | PRNG Seed `42` (Mulberry32 generator) |

---

## 2. Deterministic Dataset Generation

The experimental cohort was generated using `scripts/generateSyntheticDataset.ts` with a fixed pseudo-random number generator:

```bash
cmd.exe /c "npx tsx scripts/generateSyntheticDataset.ts"
```

### Dataset Parameters & Artifact Verification
- **Total Synthesized Cohort:** 100 distinct students (`STU-0001` through `STU-0100`).
- **Total Synthesized Sessions:** Exactly 4,000 sessions (40 sessions per student).
- **Temporal Partitions:**
  - **Baseline Calibration Training (Sessions 1–20):** 2,000 sessions (Jan 5 – Feb 2, 2026). Anomaly rate: 0.00%.
  - **Conformal Calibration Set (Sessions 21–30):** 1,000 sessions (Feb 4 – Feb 17, 2026). Anomaly rate: 0.00%.
  - **Evaluation Test Set (Sessions 31–40):** 1,000 sessions (Feb 19 – Mar 4, 2026). Ground-truth deviations: 182 sessions (18.20%).
- **Five Telemetry Features:**
  1. `response_time` (seconds)
  2. `revision_count` (integer count)
  3. `pointer_movement` (pixels Euclidean displacement)
  4. `scroll_distance` (vertical pixel offset)
  5. `paste_activity` (character length / rate)

---

## 3. Formal Benchmark Execution

The Phase 5 experimental evaluation benchmark was executed via `scripts/runPhase5Experiments.ts`:

```bash
cmd.exe /c "npx tsx scripts/runPhase5Experiments.ts"
```

### Mathematical & Algorithmic Corrections Applied
1. **Wilcoxon-Mann-Whitney ROC-AUC ($U$-Statistic with Mid-Ranks):** Corrected ranking ties to assign average ranks $\frac{rank_{start} + rank_{end}}{2}$, preventing optimistic inflation of discrimination metrics.
2. **Threshold-Grouped Average Precision (PR-AUC):** Grouped tied classifier scores to evaluate single-point recall increments, eliminating artificial staircase stepping.
3. **Exact Regularized Incomplete Beta Function:** Replaced crude normal approximation with the Lentz continued fraction expansion of $I_x(a, b)$ for $F$-distribution survival functions.
4. **Finite-Sample Split-Conformal Pooled Cohort Calibration:** Pooled held-out standardized calibration non-conformity scores ($m = 1,000 \ge 19$) to obtain exact conformal quantile threshold at rank $k = \lceil (1,000 + 1)(1 - 0.05) \rceil = 951$.
5. **Non-Parametric Empirical Bootstrap ($B = 1,000$):** Resampled test cohort predictions with replacement (Seed 42) to calculate rigorous 95% empirical confidence intervals for $F_1$-scores.

### Summary of Experimental Results (`data/synthetic/phase5_experimental_results.json`)

| Model | ROC-AUC | PR-AUC | Conformal Empirical FPR ($\alpha=0.05$) | True Positive Rate (Recall) | Precision | $F_1$-Score (95% CI) |
|---|---|---|---|---|---|---|
| **Regularised Mahalanobis Distance** | **0.949** | **0.774** | **5.00%** | **91.21%** | 57.09% | **0.702** [0.653, 0.746] |
| **One-Class SVM (RBF Kernel)** | 0.931 | 0.666 | 4.28% | 91.76% | 58.60% | **0.711** [0.664, 0.755] |
| **Local Outlier Factor (LOF)** | 0.927 | 0.744 | 5.01% | 82.97% | 61.13% | **0.704** [0.657, 0.751] |
| **Isolation Forest ($T=50$)** | 0.757 | 0.403 | 3.67% | 23.63% | 39.09% | **0.295** [0.226, 0.365] |

---

## 4. Full Test Suite Verification

The complete Jest automated test suite spanning all 5 research phases was run:

```bash
cmd.exe /c "npx jest --runInBand"
```

### Execution Outcome:
- **Test Suites:** **25 passed**, 25 total (100% pass rate)
- **Tests:** **280 passed**, 280 total (100% pass rate)
- **Snapshots:** 0 total
- **Execution Time:** 22.46 seconds

### Suites Verified:
1. `__tests__/securityAuthAudit.test.ts` (Phase A security, RBAC, tokens, cookie security)
2. `__tests__/fourModelsAnomalyDetection.test.ts` (Phase B & E mathematical models and conformal calibration)
3. `__tests__/explainabilityAndPrivacy.test.ts` (Phase F XAI Shapley, LOF neighbourhood, OCSVM sensitivity)
4. `__tests__/syntheticDatasetAndBaseline.test.ts` (Phase C dataset scenarios, noise, drift)
5. `__tests__/instructorWebsiteAndXAI.test.ts` (Website integration, human review persistence)
6. `__tests__/gradedExamEnvironment.test.ts` (Student exam interface, telemetry extraction)
7. `__tests__/behavioralReportEngine.test.ts` (PDF/JSON behavioral evidence generator)
8. `__tests__/personalizedBaselineEngine.test.ts` (Student baseline profile calculation)
9. `__tests__/mahalanobisPersistence.test.ts` (Covariance matrix storage and inversion)
10. `__tests__/productionSecurity.test.ts` (Secret sanitization, timing attacks)
11. `__tests__/cryptoEngine.test.ts` (SHA-256 telemetry hashing and provenance)
12. `__tests__/authRolesAndAccess.test.ts` (Middleware routing and access control)
13. `__tests__/datasetIntegration.test.ts` (Dataset loading and pipeline compatibility)
14. `__tests__/mahalanobisEngine.test.ts` (Numerical stability, Cholesky, Woodbury)
15. `__tests__/cameraAndMultimodalFusion.test.ts` (Multimodal presence telemetry)
16. `__tests__/demoStudentProfiles.test.ts` (Profiles and demo credentials)
17. `__tests__/behavioralValidationExam.test.ts` (Live validation session telemetry)
18. `__tests__/calibrationEngine.test.ts` (Conformal and heuristic threshold calibration)
19. `__tests__/patentIntegrityEngine.test.ts` (System integrity checks)
20. `__tests__/supabasePersistence.test.ts` (PostgreSQL / Supabase persistence)
21. `__tests__/studentLongitudinalHistory.test.ts` (Student history ownership and RLS)
22. `__tests__/behavioralSequenceAndIntelligence.test.ts` (Temporal sequence extraction)
23. `__tests__/behavioralAnalysisEngine.test.ts` (Deviation analysis)
24. `__tests__/adminDashboard.test.ts` (Administrative controls)
25. `__tests__/roleBasedNavigation.test.ts` (Role-specific UI routing)

---

## 5. Next.js Production Build Verification

The complete production build was compiled and verified:

```bash
cmd.exe /c "npm run build"
```

### Build Outcome:
- **Build Engine:** Next.js 16.3.1 (Turbopack)
- **Compilation Status:** `✓ Compiled successfully in 7.6s`
- **TypeScript Typecheck:** `✓ Finished TypeScript in 7.9s with 0 errors`
- **Static Page Optimization:** `✓ Generating static pages using 7 workers (39/39) in 3.2s`
- **Exit Code:** `0` (Success)
- **All 39 static and dynamic routes compiled cleanly.**
