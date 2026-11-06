# EXAMGUARD: EXPERIMENTAL REPRODUCTION GUIDE & REPLICATION PACKAGE

**Paper Title:** ExamGuard: An Integrated Framework for Explainable and Privacy-Aware Personalised Behavioural Anomaly Detection in Online Examinations  
**Replication Artifact:** Phase 5 Comprehensive Evaluation Suite  
**Hardware Environment:** x86_64 CPU (Tested on Windows 11 / Node.js v24.19.0)  
**Dependencies:** Node.js >= 18.0.0, npm >= 9.0.0  

---

## 1. Quick Start Replication Commands

To reproduce all experimental results, figures, tables, and model comparisons from scratch:

```bash
# 1. Install dependencies
npm install

# 2. Generate the 4,000 synthetic examination sessions (Seed = 42)
npm run generate:dataset

# 3. Execute all 9 research experiments (E1 to E9)
npm run experiments:phase5

# 4. Run the full regression test suite (25 test suites, 273 tests)
npm test

# 5. Build the production application
npm run build
```

---

## 2. Experimental Scripts Inventory

| Script | Path | Purpose | Output File |
|---|---|---|---|
| **Synthetic Dataset Generator** | `scripts/generateSyntheticDataset.ts` | Generates 4,000 sessions (100 students, 40 sessions/student, Train=2000, Cal=1000, Test=1000) under Seed 42 | `data/synthetic/train_sessions.json`, `calibration_sessions.json`, `test_sessions.json`, `dataset_manifest.json` |
| **Phase 5 Comprehensive Suite** | `scripts/runPhase5Experiments.ts` | Executes Experiments E1 through E9: ANOVA variance, 4-model evaluation, scenario breakdown, severity sensitivity, false alarm analysis, XAI faithfulness/stability, noise robustness, profiling, and conformal calibration | `data/synthetic/phase5_experimental_results.json` |
| **Comparative Benchmark Runner** | `scripts/runPhase3Benchmark.ts` | Standalone CLI comparison table generator | `data/synthetic/model_comparison_results.json` |

---

## 3. Dataset Specification & Data Integrity

The experimental dataset is generated deterministically using a fixed pseudo-random seed ($42$):
- **Cohort Size:** $100$ simulated students.
- **Total Sessions:** $4,000$ chronological sessions ($20,005$ question interactions).
- **Partition Splitting (Strict Chronological, Zero Leakage):**
  - **Train Split (Sessions 1–20):** $2,000$ low-stakes coursework sessions ($100\%$ normal baseline).
  - **Calibration Split (Sessions 21–30):** $1,000$ low-stakes sessions ($100\%$ held-out normal baseline for split-conformal calibration at $\alpha = 0.05$).
  - **Test Split (Sessions 31–40):** $1,000$ high-stakes graded exam sessions ($818$ clean sessions, $182$ controlled anomalous deviations).

### Scenario Distribution in Evaluation Partition
- **Category A (Pure Normal Baseline):** $600$ sessions ($60.0\%$).
- **Category B (Legitimate Human Variations):** $200$ sessions ($20.0\%$).
  - B1: Difficult questions ($46$ sessions).
  - B2: Interruption / pauses ($51$ sessions).
  - B3: Device switch / touchscreen ($74$ sessions).
  - B4: Exam fatigue ($29$ sessions).
- **Category C (Single-Feature Controlled Deviations):** $100$ sessions ($10.0\%$).
- **Category D (Multiple-Feature Deviations):** $69$ sessions ($6.9\%$).
- **Category E (Data Quality and Drift Deviations):** $31$ sessions ($3.1\%$).

---

## 4. Model Hyperparameters & Configuration

All models are evaluated on the exact same five standardized behavioural features:
1. `response_time` (s)
2. `revision_count` (integer)
3. `pointer_movement` (px)
4. `scroll_distance` (px)
5. `paste_activity` (event rate)

### Model 1: Regularised Mahalanobis Distance
- **Regularisation:** $R_{\text{reg}} = (1 - \lambda)R + \lambda I + \epsilon I$
- **Ledoit-Wolf Shrinkage:** $\lambda \in [0, 1]$ computed analytically from sample covariance.
- **Ridge Epsilon:** $\epsilon = 10^{-4}$
- **Matrix Inversion:** Gauss-Jordan elimination with partial pivoting.
- **Threshold Calibration:** Split-conformal finite-sample $(1 - \alpha)$ quantile index $k = \lceil(m + 1)(1 - \alpha)\rceil$.

### Model 2: Isolation Forest
- **Number of Estimators:** $n_{\text{estimators}} = 100$
- **Subsample Size:** $\psi = 256$ (or $N$ if $N < 256$)
- **Splitting Strategy:** Axis-aligned uniform random cut with zero-variance bracket handling.
- **Path Length Normalization:** $c(n) = 2(\ln(n - 1) + 0.5772156649) - \frac{2(n - 1)}{n}$
- **Threshold Calibration:** Split-conformal $(1 - \alpha)$ quantile on held-out calibration scores.

### Model 3: Local Outlier Factor (LOF)
- **Neighbourhood Size:** $k = 5$ nearest neighbours.
- **Distance Metric:** Euclidean distance on standardized vectors ($z$-scores).
- **Novelty Detection:** Calibration reference set provides density anchors for query session.
- **Score Formulation:** $\text{LOF}(x) = \frac{\sum_{o \in N_k(x)} \frac{\text{lrd}(o)}{\text{lrd}(x)}}{k}$
- **Threshold Calibration:** Split-conformal $(1 - \alpha)$ quantile.

### Model 4: One-Class SVM
- **Kernel:** Radial Basis Function (RBF), $K(x, x') = \exp(-\gamma \|x - x'\|^2)$
- **Kernel Parameter:** $\gamma = 0.20$
- **Outlier Upper Bound:** $\nu = 0.05$
- **Decision Function:** $f(x) = \sum_{i=1}^{N_{sv}} \alpha_i K(x_i, x) - \rho$
- **Tail Regularization:** Gradient tail floor $\max(K(z_i, z), 10^{-3})$ prevents gradient vanishing on severe outliers.
- **Threshold Calibration:** Split-conformal calibrated threshold on anomaly score $s = \rho - \sum \alpha_i K$.

---

## 5. Verification Checklist

- [x] All 25 test suites pass (`npm test`).
- [x] Next.js 16 App Router compiles cleanly (`npm run build`).
- [x] Synthetic dataset reproduces identical sample counts under seed 42.
- [x] All metrics in the conference paper match `data/synthetic/phase5_experimental_results.json` to 3 decimal places.
- [x] No test labels are accessed during model training or threshold calibration.
- [x] Live web server responds with HTTP 200 on all instructor routes.

