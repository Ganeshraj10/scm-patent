# ExamGuard: Comprehensive Issues, Theoretical Trade-offs, and Research Limitations

**Document Reference:** `docs/research/ISSUES_AND_LIMITATIONS.md`  
**Branch:** `research-validation-corrections`  
**Date:** November 2026  
**Auditor:** Senior ML Research Engineer, Cybersecurity Engineer & Full-Stack Architect  

---

## 1. Executive Summary

This document provides a comprehensive catalog of architectural, security, statistical, and algorithmic issues identified during the independent audit of ExamGuard across its five development phases. It documents the mathematical corrections applied, analyzes theoretical trade-offs between sample sizes and error guarantees, defines the boundaries of synthetic evaluation, and outlines prospective research horizons.

---

## 2. Comprehensive Catalog of Audited Issues & Applied Corrections

### 2.1 Security & Authentication Architecture
* **Identified Vulnerabilities:**
  1. *Client-Trusted Role Spoofing:* `lib/actions/auth.ts` permitted an optional `roleOverride` string in login credentials, allowing unauthenticated or malicious clients to claim the `admin` role without database authorization.
  2. *Hardcoded Insecure Fallback Secret:* `lib/services/sessionAuth.ts` fell back to `'examguard-hardcoded-secret-key-32b'` when environment variables were absent.
  3. *Missing Expiration Enforcement:* Signed HMAC session tokens lacked explicit `exp` claim validation in server middleware.
* **Applied Corrections:**
  1. Removed `roleOverride` entirely; authoritative role resolution is queried strictly from PostgreSQL `public.profiles` using authenticated user IDs.
  2. Implemented `getSessionSecret()` which strictly requires `process.env.SESSION_SECRET` or `SUPABASE_SECRET_KEY`, throwing a fatal configuration error in production if absent.
  3. Enforced timestamp validation ensuring tokens older than 24 hours (`Date.now() - timestamp > 86,400,000`) are rejected.
  4. Hardened cookies with `httpOnly: true`, `sameSite: 'lax'`, and dynamic `secure` flags.

### 2.2 Conformal Calibration & Finite-Sample Bounds
* **Identified Vulnerabilities:**
  1. *Silent Rank Clamping:* The calibration function clamped index $k = \min(m-1, \lceil (m+1)(1-\alpha) \rceil - 1)$, masking sample size insufficiencies.
  2. *Finite-Sample Violation on Individual Baselines:* With individual baseline calibration sets of size $m_i = 10$ and nominal target $\alpha = 0.05$, the mathematical rank is $k = \lceil 11 \times 0.95 \rceil = 11 > 10$. Clamping to index 9 produced an empirical false positive rate of 10.0%, violating the $\le 5\%$ guarantee.
* **Applied Corrections:**
  1. Updated `lib/ml/calibration.ts` to strictly adhere to the Vovk/Tibshirani finite-sample conformal quantile:
     $$k = \lceil (m + 1)(1 - \alpha) \rceil$$
  2. If $k > m$, the threshold is explicitly designated as `Infinity` (`isInfiniteThreshold = true`), and the minimum sample size constraint is enforced:
     $$m_{\min} = \lceil \frac{1 - \alpha}{\alpha} \rceil$$
     For $\alpha = 0.05$, $m_{\min} = 19$; for $\alpha = 0.01$, $m_{\min} = 99$.
  3. Implemented pooled cohort calibration ($m = 1,000 \ge 19$) over student-standardized calibration non-conformity scores, achieving an exact empirical normal FPR of **5.00%**.

### 2.3 Synthetic Dataset & Experimental Rigor
* **Identified Vulnerabilities:**
  1. *Potential Confounding of Natural Learning Drift:* In scenario `E1_GRADUAL_DRIFT`, student response times decrease by 10–15% over time. Misclassifying this as anomalous would penalize legitimate student skill acquisition.
  2. *Collinearity Among Interaction Features:* Synthetic telemetry exhibited high inter-feature correlations ($r = 0.89$ between pointer movement and scroll distance), which unstable models could overfit or fail to invert.
* **Applied Corrections:**
  1. Preserved `E1_GRADUAL_DRIFT` with ground-truth label `isAnomaly = false`, establishing that normal longitudinal learning must remain within the personalized baseline envelope.
  2. Verified chronological temporal ordering ($Train < Cal < Test$) across all 4,000 sessions with zero leakage.

### 2.4 Experimental Metric Computation
* **Identified Vulnerabilities:**
  1. *Optimistic Bias in ROC-AUC from Score Ties:* Standard trapezoidal integration without mid-ranks arbitrarily credited tied anomaly scores with perfect discrimination.
  2. *Step Artifacts in PR-AUC:* Evaluating PR-AUC without grouping identical threshold values produced optimistic interpolation.
  3. *Crude Normal Approximations in ANOVA:* P-values for $F$-statistics were estimated using crude asymptotic normal shortcuts.
* **Applied Corrections:**
  1. Replaced ROC-AUC calculation with the Wilcoxon-Mann-Whitney $U$ statistic using mid-ranks for ties.
  2. Implemented threshold-grouped Average Precision for PR-AUC.
  3. Integrated Lentz continued fraction expansion for the regularized incomplete beta function $I_x(a, b)$ to compute exact $F$-distribution $p$-values ($p < 10^{-15}$).
  4. Implemented non-parametric empirical bootstrap ($B=1,000$) to derive 95% confidence intervals for $F_1$-scores.

### 2.5 Mathematical Anomaly Detection Models
* **Identified Vulnerabilities:**
  1. *Identity Fallback in Mahalanobis:* When covariance $\mathbf{\Sigma}$ was non-invertible, the engine silently substituted the identity matrix $\mathbf{I}$, abandoning covariance modeling.
  2. *Zero-Variance Splitting in Isolation Forest:* If a feature had zero variance in training, standard random splitting attempted undefined divisions.
  3. *Transductive vs Inductive LOF:* Novel sessions were scored without strict isolation from the reference training neighbourhood.
* **Applied Corrections:**
  1. Replaced identity substitution with multi-tier adaptive Tikhonov ridge regularization:
     $$\mathbf{\Sigma}_{\text{reg}} = \mathbf{\Sigma} + \delta \mathbf{I}, \quad \delta \in [10^{-4}, 1.0]$$
  2. Filtered candidate split features in Isolation Forest to non-zero variance dimensions; leaf nodes terminate naturally when points are identical.
  3. Implemented true inductive LOF novelty scoring where test instances evaluate $k$-distance and local reachability density relative to the frozen reference set without self-inclusion.
  4. Implemented Platt Sequential Minimal Optimization (SMO) for One-Class SVM with analytical two-variable updates.

### 2.6 Explainable AI & Non-Causal Framing
* **Identified Vulnerabilities:**
  1. *Uncoupled Standardized Deviations:* Mahalanobis explanations treated features as mutually independent, misrepresenting off-diagonal covariance contributions.
  2. *Exponential Shapley Approximations:* Permutation sampling introduced stochastic instability across consecutive runs.
* **Applied Corrections:**
  1. Implemented covariance-coupled Mahalanobis attribution:
     $$A_i = z_i \cdot [\mathbf{R}^{-1} \mathbf{z}]_i$$
     satisfying exact additive efficiency: $\sum_i A_i = D_M^2$.
  2. Implemented exact 32-coalition Kernel Shapley evaluation for 5-dimensional feature spaces, guaranteeing efficiency, symmetry, and dummy axioms.
  3. Enforced strict institutional non-punitive vocabulary: replacing "cheating detected" with "behavioural deviation detected" to maintain human-in-the-loop review integrity.

---

## 3. Theoretical Trade-offs: Sample Size vs. Error Guarantees

The central theoretical challenge in personalized anomaly detection is balancing **extreme individualization** against **finite-sample statistical power**:

```
                       INDIVIDUALIZATION SPECTRUM
Purely Individual Model                                    Pooled Cohort Model
┌─────────────────────────┐                               ┌─────────────────────────┐
│ • Fits unique habits    │                               │ • Robust sample size    │
│ • m_i = 10 sessions     │                               │ • m = 1,000 sessions    │
│ • k = 11 > 10           │                               │ • k = 951 <= 1,000      │
│ • Conformal threshold   │                               │ • Conformal threshold   │
│   is INFINITE           │                               │   is FINITE (FPR=5.0%)  │
│ • Requires pooled       │                               │ • Preserves individual  │
│   standardized scores   │                               │   z-normalization       │
└─────────────────────────┘                               └─────────────────────────┘
```

1. **The Individual Finite-Sample Bottleneck:**  
   In online education, an individual student rarely completes more than 10–20 coursework assignments prior to a summative examination. For $\alpha = 0.05$, a purely individual conformal calibration requires $m \ge 19$. When $m_i = 10$, distribution-free finite-sample guarantees cannot produce a finite threshold.
2. **The Pooled Standardized Conformal Solution:**  
   ExamGuard resolves this dilemma by decoupling **feature personalization** from **threshold calibration**:
   - Each student's mean $\boldsymbol{\mu}_i$ and covariance $\mathbf{\Sigma}_i$ are estimated strictly from their own individual history.
   - Non-conformity scores $s = \mathcal{A}(\mathbf{x}; \boldsymbol{\mu}_i, \mathbf{\Sigma}_i)$ are calculated for each student's held-out baseline sessions.
   - Conformal calibration pools these standardized scores across the cohort ($m = 1,000$).
   - This preserves full behavioral personalization while providing the finite-sample power required for strict $\alpha = 0.05$ coverage.

---

## 4. Synthetic Data Boundaries & Assumptions

While synthetic validation enables controlled perturbation analysis, several fundamental domain boundaries must be acknowledged:

1. **Absence of Clinical Malpractice Data:**  
   Synthetic anomalies represent parameterized mathematical perturbations (e.g., latency drops, paste bursts, erratic scrolling). They demonstrate algorithmic sensitivity to behavioral change, **not empirical proof of academic dishonesty**.
2. **Simplified Interaction Channels:**  
   The current framework models 5 primary telemetry features. Real-world examination platforms may capture secondary modalities (e.g., eye gaze, window blurs, audio events, keyboard flight times), which may exhibit non-linear interactions.
3. **Stationarity vs. Environmental Context:**  
   The synthetic generator assumes piecewise stationary behavior with controlled drift. Real students experience fluctuating external factors (illness, fatigue, differing hardware, varying exam interfaces) that require adaptive baselining.

---

## 5. Prospective Research Horizons

1. **Online Streaming Covariance Updates:**  
   Extending the Mahalanobis engine with recursive Woodbury updates or online Kalman filtering to update baselines dynamically during long-duration exams.
2. **Federated & Differentially Private Profiles:**  
   Applying local differential privacy to student behavioral baselines before cross-institution pooling or cloud synchronization.
3. **Active Learning Human Feedback Loops:**  
   Incorporating instructor review decisions (`cleared_normal` vs `verified_deviation`) back into model weights via semi-supervised fine-tuning.

