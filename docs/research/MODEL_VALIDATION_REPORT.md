# ExamGuard — Phase E Four-Model Mathematical Validation Report

**Document ID:** EXG-MOD-2026-V1  
**Classification:** Machine Learning & Applied Mathematics Report  
**Status:** COMPLETE & VERIFIED  
**Date:** November 2026  

---

## 1. Executive Summary

This report provides the mathematical verification and implementation audit of the four core anomaly detection models in ExamGuard:
1. **Regularised Mahalanobis Statistical Distance** (Parametric baseline)
2. **Isolation Forest** (Tree-based ensemble)
3. **Local Outlier Factor (LOF)** (Density-based novelty detector)
4. **One-Class Support Vector Machine (OC-SVM)** (Non-linear kernel boundary detector)

All four models were audited for mathematical correctness, numerical stability, positive definiteness, boundary conditions, and invariant score orientations.

---

## 2. Model 1: Regularised Mahalanobis Distance

### 2.1 Mathematical Formulation
For an observed telemetry vector $\mathbf{x} \in \mathbb{R}^5$ evaluated against a student baseline with mean $\boldsymbol{\mu}$ and covariance $\boldsymbol{\Sigma}$:
$$D_M(\mathbf{x}) = \sqrt{(\mathbf{x} - \boldsymbol{\mu})^T \boldsymbol{\Sigma}_{\text{reg}}^{-1} (\mathbf{x} - \boldsymbol{\mu})} = \sqrt{\mathbf{z}^T \mathbf{R}_{\text{reg}}^{-1} \mathbf{z}}$$
where $\mathbf{z} = \mathbf{D}^{-1/2}(\mathbf{x} - \boldsymbol{\mu})$ is the coordinate-wise standardized vector ($z_j = (x_j - \mu_j) / \sigma_j$), and $\mathbf{R}_{\text{reg}}$ is the regularised correlation matrix.

### 2.2 Ledoit-Wolf Shrinkage Regularisation
To guarantee invertibility and mitigate small-sample estimation error ($N = 20$ training sessions), the sample correlation $\mathbf{R}$ is shrunk toward the identity matrix $\mathbf{I}$:
$$\mathbf{R}_{\text{reg}} = (1 - \lambda)\mathbf{R} + \lambda \mathbf{I} + \epsilon \mathbf{I}$$
where $\lambda \in [0, 1]$ is the analytically optimal Ledoit-Wolf shrinkage intensity, and $\epsilon = 10^{-4}$ is ridge loading ensuring strict positive definiteness:
$$\lambda_{\min}(\mathbf{R}_{\text{reg}}) \ge \lambda + \epsilon > 0$$

### 2.3 Matrix Inversion & Elimination of Silent Identity Fallback
- **Cholesky Inversion ($A = \mathbf{L}\mathbf{L}^T$):** The primary inversion uses Cholesky decomposition followed by forward substitution ($\mathbf{L}^{-1}$) and transposition ($\mathbf{R}_{\text{reg}}^{-1} = (\mathbf{L}^{-1})^T \mathbf{L}^{-1}$).
- **Ill-Conditioned Fallback:** In previous code, if Gauss-Jordan elimination encountered near-zero pivots ($< 10^{-12}$), it silently returned the identity matrix $\mathbf{I}$. This was corrected:
  - We implemented multi-tier **adaptive Tikhonov ridge regularization** ($\delta \in [10^{-4}, 10^{-3}, 10^{-2}, 10^{-1}, 1.0]$).
  - If a matrix cannot be inverted even under heavy ridge loading, the engine flags `isSingular = true` and reports an explicit failure state rather than silently zeroing out feature covariances.

---

## 3. Model 2: Isolation Forest

### 3.1 Mathematical Specification
Isolation Forest isolates observations by recursive random axis-aligned partitioning (Liu, Ting & Zhou, 2008).
- **Subsample Size:** $\psi = \min(256, N) = 20$.
- **Max Tree Height:** $h_{\max} = \lceil \log_2(\psi) \rceil = 5$.
- **Average Path Length Normalization:**
  $$c(n) = 2\left(\ln(n - 1) + \gamma\right) - \frac{2(n - 1)}{n}$$
  where $\gamma \approx 0.5772156649$ (Euler-Mascheroni constant).
- **Anomaly Score:**
  $$s(\mathbf{x}, n) = 2^{-\frac{E[h(\mathbf{x})]}{c(n)}} \in [0, 1]$$
  - $s \to 1.0$: Rapidly isolated outlier.
  - $s \to 0.5$: Normal cluster observation.
  - $s \to 0.0$: Dense cluster interior.

### 3.2 Handling Invariant / Zero-Variance Features
- **Issue Investigated:** How does the tree behave when a feature has zero variance across all training observations in a node (e.g. paste count is identically zero)?
- **Audit Finding:** The previous implementation added an ad-hoc virtual split bracket $[\min - 0.5, \max + 0.5]$. This altered the standard algorithm by creating empty partitions during training.
- **Correction:** In accordance with Liu et al. (2008), candidate features for splitting are filtered strictly to those with non-zero variance ($\max(x_j) - \min(x_j) > 10^{-6}$). If all features in a node have zero variance, the points are identical and terminate as a leaf node of size $n$.
- At test time, test points outside the baseline range are evaluated against existing tree splits; features with genuine variation across the student cohort isolate anomalies appropriately.

---

## 4. Model 3: Local Outlier Factor (Novelty Detection)

### 4.1 Inductive Novelty Detection Formulation
In standard transductive LOF, query points are evaluated within the dataset itself. For online exam proctoring, LOF must operate as an **inductive novelty detector** on unseen test sessions $\mathbf{x}_{\text{query}} \notin \mathcal{D}_{\text{train}}$:
1. Standardize query observation: $\mathbf{z} = \mathbf{D}^{-1/2}(\mathbf{x}_{\text{query}} - \boldsymbol{\mu})$.
2. Query the $k$-nearest neighbours $N_k(\mathbf{z})$ exclusively within the stored baseline cache $\mathcal{D}_{\text{train}}$ ($k = 5$).
3. Compute reachability distance to each baseline neighbour $o \in N_k(\mathbf{z})$:
   $$\text{reach-dist}_k(\mathbf{z}, o) = \max\left(k\text{-dist}(o), \|\mathbf{z} - o\|_2\right)$$
4. Compute local reachability density (LRD):
   $$\text{lrd}_k(\mathbf{z}) = \frac{k}{\sum_{o \in N_k(\mathbf{z})} \text{reach-dist}_k(\mathbf{z}, o)}$$
5. Compute inductive LOF score:
   $$\text{LOF}_k(\mathbf{z}) = \frac{1}{k} \sum_{o \in N_k(\mathbf{z})} \frac{\text{lrd}_k(o)}{\text{lrd}_k(\mathbf{z})}$$

### 4.2 Neighbourhood Isolation Verification
We verified that $\mathbf{x}_{\text{query}}$ is strictly excluded from its own reference neighbourhood ($N_k(\mathbf{z}) \subset \mathcal{D}_{\text{train}}$). Distance calculations do not evaluate self-distance $d(\mathbf{z}, \mathbf{z}) = 0$, preventing self-contamination.

---

## 5. Model 4: One-Class Support Vector Machine

### 5.1 Dual Quadratic Program & Platt's SMO
ExamGuard implements a complete One-Class SVM using Platt's Sequential Minimal Optimization (SMO) algorithm (Schölkopf et al., 1999).
- **Primal Problem:** Find a hyperplane in RKHS with maximum margin from the origin separating baseline data with fraction $\nu$ allowed outliers.
- **Dual Problem:**
  $$\min_{\boldsymbol{\alpha}} \frac{1}{2} \sum_{i=1}^l \sum_{j=1}^l \alpha_i \alpha_j K(\mathbf{x}_i, \mathbf{x}_j)$$
  $$\text{subject to } 0 \le \alpha_i \le \frac{1}{\nu l}, \quad \sum_{i=1}^l \alpha_i = 1$$
- **RBF Kernel:**
  $$K(\mathbf{x}_i, \mathbf{x}_j) = \exp\left(-\gamma \|\mathbf{x}_i - \mathbf{x}_j\|^2\right), \quad \gamma = \frac{1}{p} = 0.2$$
- **SMO Solver:**
  At each iteration, the solver identifies the maximum KKT-violating pair $(i, j)$:
  $$g_k = (\mathbf{K}\boldsymbol{\alpha})_k, \quad \min_{i: \alpha_i < C} g_i \ge \max_{j: \alpha_j > 0} g_j - \text{tol}$$
  and analytically computes the optimal 2-variable coordinate step subject to box constraints $[0, C]$.
- **Offset $\rho$:**
  Computed across free support vectors ($0 < \alpha_i < C$):
  $$\rho = \frac{1}{|SV_{\text{free}}|} \sum_{i \in SV_{\text{free}}} \sum_{k \in SV} \alpha_k K(\mathbf{x}_k, \mathbf{x}_i)$$
- **Score Orientation:**
  Raw decision function: $f(\mathbf{x}) = \sum_{i \in SV} \alpha_i K(\mathbf{x}_i, \mathbf{x}) - \rho$.
  Standardized anomaly score: $s(\mathbf{x}) = -f(\mathbf{x}) = \rho - \sum_{i \in SV} \alpha_i K(\mathbf{x}_i, \mathbf{x})$.
  This aligns with `higher_is_more_anomalous`.

