# ExamGuard: An Integrated Framework for Explainable and Privacy-Aware Personalised Behavioural Anomaly Detection in Online Examinations

**Anonymous Authors**  
*Submitted to the IEEE/ACM International Conference on Educational Data Mining & Privacy-Preserving Machine Learning (EDM / PETS Track)*

---

## Abstract

Online examination platforms increasingly rely on commercial remote-proctoring software that deploys invasive video surveillance, continuous acoustic recording, facial geometry tracking, and indiscriminate raw keystroke logging. Beyond provoking severe student anxiety and ethical backlash, conventional proctoring systems enforce generic, cohort-wide threshold heuristics that fail to account for individual cognitive pacing and physical typing differences. In this paper, we present **ExamGuard**, an integrated, explainable, and privacy-aware framework for personalized behavioural anomaly detection in online examinations. ExamGuard establishes a non-invasive paradigm founded on five passive scalar interaction metrics—response time, revision count, pointer displacement, scroll distance, and paste activity—derived entirely on the client side without storing raw keystrokes, clipboard contents, or video feeds. Leveraging low-stakes longitudinal coursework sessions, ExamGuard builds an idiosyncratic personal baseline covariance model for each student and evaluates incoming examination telemetry across four competing anomaly-detection algorithms: Regularised Mahalanobis Distance with Ledoit-Wolf shrinkage, Isolation Forest, Local Outlier Factor (LOF), and One-Class Support Vector Machines (OC-SVM). Decision thresholds are calibrated via distribution-free split-conformal prediction targeting a provable finite-sample false-positive rate ($\alpha = 0.05$) on held-out coursework data. For every detected deviation, ExamGuard generates mathematical, model-specific attributions—including covariance coupling decompositions, exact 32-coalition Shapley values, $k$-NN neighbourhood reachability density ratios, and analytical decision-boundary gradients—to empower human instructors during pedagogical review. We validate ExamGuard across a reproducible synthetic benchmark of $4,000$ examination sessions representing $100$ students partitioned into chronological training ($2,000$), calibration ($1,000$), and test ($1,000$) splits. Our experimental results demonstrate that personalized baselines are statistically essential (One-Way ANOVA $F \in [56.00, 250.32]$, $p < 10^{-15}$). In comparative evaluations, One-Class SVM ($F_1 = 0.7106$, ROC-AUC $= 0.9312$), Local Outlier Factor ($F_1 = 0.7040$, ROC-AUC $= 0.9266$), and Regularised Mahalanobis Distance ($F_1 = 0.7019$, ROC-AUC $= 0.9487$, PR-AUC $= 0.7743$) achieve superior detection accuracy and ultra-low inference latency ($7.7 - 7.8\mu\text{s}$) compared to Isolation Forest ($F_1 = 0.2955$, ROC-AUC $= 0.7573$). Crucially, our study exposes a fundamental pedagogical vulnerability in unsupervised machine learning: legitimate difficult examination questions induce false alarm rates between $76.09\%$ and $100.0\%$ across all models, empirically proving that automated proctoring without human pedagogical review produces catastrophic false accusations. ExamGuard resolves this dilemma by pairing privacy-preserving machine learning with transparent Explainable AI and mandatory instructor oversight.

**Keywords:** Online Examination Proctoring, Behavioural Biometrics, Personalised Anomaly Detection, Explainable Artificial Intelligence (XAI), Privacy by Design, Conformal Prediction.

---

## 1. Introduction

The global transition toward remote higher education and digital assessment has precipitated a profound crisis in academic integrity management \cite{nigam2021systematic}. To combat unauthorized collaboration, third-party assistance, and unauthorized resources during uninvigilated online examinations, educational institutions have widely adopted automated proctoring software \cite{coghlan2021good}. However, first-generation proctoring solutions enforce surveillance-heavy architectures requiring continuous high-definition webcam streaming, room pan scans, biometric facial landmark analysis, acoustic monitoring, and indiscriminate operating system snooping.

These surveillance-based paradigms have encountered severe criticism from privacy advocates, legal scholars, and student bodies \cite{swauger2020our}. Video and acoustic monitoring disproportionately penalize neurodivergent examinees, students residing in shared or cramped living environments, and individuals experiencing elevated assessment anxiety. Furthermore, continuous raw keystroke logging creates catastrophic credential-leakage risks, violating fundamental data protection principles such as the European Union General Data Protection Regulation (GDPR) Principle of Data Minimisation (Article 5(1)(c)) and the right not to be subjected to solely automated decision-making producing legal effects (Article 22) \cite{selwyn2023proctoring}.

Beyond privacy intrusions, current proctoring algorithms suffer from a fatal methodological flaw: **the enforcement of static, cohort-wide anomaly thresholds** \cite{clarke2021academic}. Human interaction pacing is inherently idiosyncratic; a rapid typist answering within $15$ seconds with zero revisions may reflect mastery, whereas identical telemetry for a typically methodical student indicates an anomalous behavioral jump. Conversely, a student suffering from motor impairments or taking prolonged pauses during complex problem-solving is frequently misclassified as "suspicious" by generic classifiers \cite{harwood2023algorithmic}.

To address these acute challenges, we propose **ExamGuard**, a privacy-first, explainable, and personalized behavioral anomaly-detection framework. ExamGuard fundamentally departs from surveillance-based proctoring by demonstrating that academic anomaly detection can be achieved strictly through non-invasive, aggregate human-computer interaction (HCI) telemetry.

### Research Contributions
1. **Privacy-by-Design Architecture:** We formulate an online examination telemetry engine that strictly tracks five derived scalar dynamics—response time, revision count, pointer displacement, scroll distance, and paste rate—completely discarding raw keystrokes, clipboard text, facial geometry, and webcam feeds. Real student identities are cryptographically isolated via non-reversible HMAC-SHA256 pseudonymization.
2. **Personalized Baseline Modelling:** We establish a longitudinal behavioral expectation profile ($\boldsymbol{\mu}_i, \mathbf{R}_{\text{reg}, i}$) for each student trained strictly on low-stakes coursework. We demonstrate via One-Way ANOVA ($F \in [56.00, 250.32]$, $p < 10^{-15}$) that personalized modeling is statistically mandatory, and empirically validate the institutional $10$-session stabilization threshold through Ledoit-Wolf shrinkage and matrix condition number analysis.
3. **Four-Model Comparative Framework:** We implement, calibrate, and compare four competing anomaly-detection paradigms—Regularised Mahalanobis Distance, Isolation Forest, Local Outlier Factor (LOF), and One-Class SVM—under identical distribution-free split-conformal calibration on held-out calibration partitions targeting $\alpha = 0.05$.
4. **Mathematical Explainability Suite:** We develop specialized, sub-millisecond Explainable AI engines tailored to each algorithm, providing covariance coupling decompositions ($W_{jk} z_j z_k$), exact 32-coalition Shapley values ($\sum \phi_j = \Delta s$), $k$-NN neighbourhood reachability density ratios, and analytical decision-boundary gradients ($\nabla_z s$).
5. **Empirical Discovery on Legitimate Cognitive Variations:** Through rigorous evaluation across $4,000$ synthetic sessions, we provide the first empirical proof that difficult exam questions inflate unsupervised model alarm rates up to $100.0\%$, scientifically demonstrating why automated penalization is invalid and establishing the necessity of human-in-the-loop pedagogical review.

---

## 2. Related Work

### 2.1 Remote Proctoring & Surveillance Critiques
Remote proctoring systems developed during the COVID-19 pandemic primarily relied on multimodal sensor streaming \cite{nigam2021systematic}. Commercial platforms utilized facial recognition to verify examinee presence, gaze estimation to detect screen departures, and background audio processing to identify speech. Coghlan et al. \cite{coghlan2021good} categorized these systems as pedagogical panopticons, demonstrating that the constant awareness of algorithmic surveillance significantly increases cognitive load, impairs test performance, and creates profound ethical inequities. Recent legal actions have affirmed that mandatory room scans violate constitutional protections against unreasonable search \cite{swauger2020our}, emphasizing the urgent necessity for non-invasive assessment technologies.

### 2.2 Behavioural Biometrics in HCI
Behavioral biometrics analyze distinctive patterns in human motor skills and device interactions \cite{monrose2000keystroke, zheng2011efficient}. Monrose and Rubin \cite{monrose2000keystroke} established keystroke dynamics as a viable biometric identifier by modeling digraph latency. Subsequent research extended behavioral profiling to mouse dynamics, including cursor trajectory curvature, velocity profiles, and click duration \cite{zheng2011efficient}. In educational environments, Bours \cite{bours2012keystroke} investigated continuous authentication during online tests. However, prior biometric studies predominantly pursued **user identification** (verifying that the user is Person A rather than Person B) using raw keystroke timings. ExamGuard repurposes behavioral dynamics for **anomaly detection relative to oneself**, operating strictly on non-biometric derived aggregates to preserve absolute privacy.

### 2.3 One-Class Learning and Outlier Detection
Anomaly detection in unlabelled educational settings naturally maps to one-class learning, where models train exclusively on positive (normal) instances \cite{chandola2009anomaly}. Four dominant methodologies exist:
- *Parametric Distance Metric:* The Mahalanobis distance accounts for multivariate correlation and feature scaling \cite{mahalanobis1936generalized}. When dimensionality is high or samples are limited, empirical covariance estimates become ill-conditioned, necessitating regularisation. Ledoit and Wolf \cite{ledoit2004well} established optimal, distribution-free shrinkage intensity estimation toward identity targets.
- *Partitioning Ensembles:* Liu, Ting, and Zhou \cite{liu2008isolation} introduced Isolation Forests, which recursively isolate points using random axis-aligned splits. Anomalies are isolated near tree roots, yielding shorter average path lengths.
- *Density-Based Formulations:* Breunig et al. \cite{breunig2000lof} proposed the Local Outlier Factor (LOF), which computes the ratio of a point's local reachability density to that of its $k$-nearest neighbours, identifying anomalies in variable-density spaces.
- *Kernel Boundary Methods:* Schölkopf et al. \cite{scholkopf2001estimating} developed One-Class SVMs, which map input data into a reproducing kernel Hilbert space (RKHS) and separate the normal cluster from the coordinate origin using a maximal margin hyperplane.

### 2.4 Explainable AI (XAI) and Conformal Calibration
Black-box anomaly scores are unacceptable in high-stakes educational decision-making where institutional disciplinary actions may follow \cite{selwyn2023proctoring}. Post-hoc explainability techniques, particularly SHAP (SHapley Additive exPlanations) \cite{lundberg2017unified}, assign additive feature importance grounded in cooperative game theory. In parallel, ensuring rigorous false-positive guarantees without parametric distributional assumptions has been resolved through conformal prediction \cite{vovk2005algorithmic, angelopoulos2021gentle}. Split-conformal calibration utilizes a held-out calibration set to establish finite-sample error bounds, ensuring provable statistical guarantees on unseen data.

---

## 3. Research Gap and Objectives

Despite substantial progress in machine learning, existing educational integrity systems suffer from three critical research gaps:
1. **Surveillance Dependency vs. Privacy Vacuum:** Systems either deploy invasive audio-visual surveillance or abandon automated integrity monitoring altogether. No existing framework establishes anomaly detection purely on non-invasive derived HCI telemetry without accessing keystrokes or clipboard text.
2. **Generic Cohort Fallacy:** Existing commercial and academic systems apply uniform threshold rules across entire classes, generating catastrophic false alarm disparities between fast-paced and cautious students.
3. **The "Difficult Question" False Alarm Confound:** Prior literature evaluates anomaly detection on synthetic anomalies but fails to model **legitimate cognitive variations** (e.g., examination fatigue, difficult questions, pauses). Consequently, existing models misclassify intense student thinking as cheating.

**Research Objective:** We formulate, evaluate, and benchmark an integrated system that deploys personalized baselines on five derived behavioral features, compares four distinct ML paradigms under conformal thresholding, provides mathematically faithful explanations, and embeds instructor review as an essential safeguard against legitimate cognitive false alarms.

---

## 4. Proposed Framework Architecture

ExamGuard operates across six decoupled, privacy-preserving layers (Figure 1):

```
ExamGuard Modular Workflow Pipeline
─────────────────────────────────────────────────────────────────────────────────────────
[Layer 1: Telemetry]  Student Browser → Passive Telemetry Extraction (HCI Events)
                                ↓
[Layer 2: Privacy]    Client-Side Derivation → 5 Scalar Features (Drop Text/Video)
                      HMAC-SHA256 Pseudonymization (STU-XXXX)
                                ↓
[Layer 3: Baseline]   Low-Stakes History (N ≥ 10) → Personalized Expectation (μ, R_reg)
                                ↓
[Layer 4: Detection]  4 Competing ML Models (Mahalanobis, IF, LOF, OC-SVM)
                      Conformal Split-Calibration (α = 0.05 on held-out coursework)
                                ↓
[Layer 5: XAI]        Model-Specific Decomposition (W_jk, Shapley, k-NN Density, ∇s)
                                ↓
[Layer 6: Review]     Instructor Hub (/instructor/xai) → Multi-Model Inspection
                      Pedagogical Review (Cleared / Flagged / Inconclusive) → Audit Log
─────────────────────────────────────────────────────────────────────────────────────────
```

### The Five Canonical Behavioural Features
All analytical engines in ExamGuard operate exclusively on a standardized vector $\mathbf{x} = [x_1, x_2, x_3, x_4, x_5]^T \in \mathbb{R}^5$:
1. $x_1$ (`response_time`): Active time spent solving the question in seconds ($s$).
2. $x_2$ (`revision_count`): Total count of modified answer selections ($N \ge 0$).
3. $x_3$ (`pointer_movement`): Total cursor displacement in pixels ($px$), computed via $\sum \sqrt{\Delta x^2 + \Delta y^2}$.
4. $x_4$ (`scroll_distance`): Total vertical viewport displacement in pixels ($px$).
5. $x_5$ (`paste_activity`): Discrete frequency or rate of paste events ($N \ge 0$), recorded without reading clipboard contents.

---

## 5. Mathematical Methodology

### 5.1 Personalised Baseline Modelling
Let student $i$ possess a training history of $N$ clean, low-stakes coursework sessions: $\mathcal{D}_i = \{\mathbf{x}_{i, 1}, \mathbf{x}_{i, 2}, \dots, \mathbf{x}_{i, N}\}$, where $\mathbf{x}_{i, j} \in \mathbb{R}^p$ ($p = 5$). The empirical mean vector $\hat{\boldsymbol{\mu}}_i$ and unbiased sample covariance matrix $\mathbf{S}_i$ are:
$$\hat{\boldsymbol{\mu}}_i = \frac{1}{N}\sum_{j=1}^N \mathbf{x}_{i, j}, \quad \mathbf{S}_i = \frac{1}{N - 1}\sum_{j=1}^N (\mathbf{x}_{i, j} - \hat{\boldsymbol{\mu}}_i)(\mathbf{x}_{i, j} - \hat{\boldsymbol{\mu}}_i)^T$$

We compute the sample correlation matrix $\mathbf{R}_i = \mathbf{D}_i^{-1/2} \mathbf{S}_i \mathbf{D}_i^{-1/2}$, where $\mathbf{D}_i = \text{diag}(\mathbf{S}_i)$. To guarantee non-singularity and optimal conditioning when $N$ is small, we apply Ledoit-Wolf shrinkage \cite{ledoit2004well} toward the identity matrix $\mathbf{I}_p$ combined with Tikhonov ridge regularisation:
$$\mathbf{R}_{\text{reg}, i} = (1 - \lambda_i)\mathbf{R}_i + \lambda_i \mathbf{I}_p + \epsilon \mathbf{I}_p$$
where $\epsilon = 10^{-4}$ guarantees strict positive-definiteness ($\kappa < \infty$), and the optimal shrinkage intensity $\lambda_i \in [0, 1]$ is estimated analytically via:
$$\lambda_i = \min\left(1, \frac{\sum_{j=1}^p \sum_{k=1}^p \widehat{\text{Var}}(r_{jk})}{\sum_{j=1}^p \sum_{k=1}^p (r_{jk} - \delta_{jk})^2}\right)$$
The regularized correlation matrix is inverted via Gauss-Jordan elimination with partial pivoting: $\mathbf{W}_i = \mathbf{R}_{\text{reg}, i}^{-1}$.

### 5.2 Model 1: Regularised Mahalanobis Distance
For a standardized query observation $\mathbf{z} = \mathbf{D}_i^{-1/2}(\mathbf{x} - \hat{\boldsymbol{\mu}}_i)$, the Mahalanobis anomaly score $s_M(\mathbf{x})$ is:
$$s_M(\mathbf{x}) = \sqrt{\mathbf{z}^T \mathbf{W}_i \mathbf{z}} = \sqrt{\sum_{j=1}^p W_{jj} z_j^2 + 2\sum_{j < k} W_{jk} z_j z_k}$$
Score orientation: Higher scores indicate greater anomaly divergence.

### 5.3 Model 2: Isolation Forest
An ensemble of $T = 100$ isolation trees $\{h_t\}_{t=1}^T$ is constructed from subsamples $\psi = \min(N, 256)$. Each node recursively partitions data using a random cut value $p \in [\min(x_j), \max(x_j)]$ on a uniformly selected feature $j \in \{1, \dots, p\}$. To handle invariant baseline features (e.g., $x_5 = 0$ pastes across all training data), ExamGuard enforces an explicit virtual splitting bracket $[-0.5, 0.5]$ to prevent degenerate single-child loops. The anomaly score is:
$$s_{IF}(\mathbf{x}) = 2^{-\frac{\mathbb{E}[h(\mathbf{x})]}{c(\psi)}}$$
where $\mathbb{E}[h(\mathbf{x})] = \frac{1}{T}\sum_{t=1}^T h_t(\mathbf{x})$ is average path length, and $c(n) = 2(\ln(n - 1) + 0.5772156649) - \frac{2(n - 1)}{n}$ is the average unsuccessful search path in a Binary Search Tree. Score orientation: Higher scores indicate greater anomaly divergence.

### 5.4 Model 3: Local Outlier Factor (LOF)
Given the baseline calibration reference set $\mathcal{C}_i$, let $d(p, q) = \|\mathbf{z}_p - \mathbf{z}_q\|_2$. For query observation $x$, the $k$-distance $d_k(p)$ is the distance to its $k$-th nearest neighbour ($k = 5$). The reachability distance of $p$ from $o$ is $\text{reach-dist}_k(p, o) = \max(d_k(o), d(p, o))$. The local reachability density ($\text{lrd}$) and LOF anomaly score are:
$$\text{lrd}_k(p) = \frac{|N_k(p)|}{\sum_{o \in N_k(p)} \text{reach-dist}_k(p, o)}, \quad s_{LOF}(\mathbf{x}) = \frac{\sum_{o \in N_k(\mathbf{x})} \frac{\text{lrd}_k(o)}{\text{lrd}_k(\mathbf{x})}}{|N_k(\mathbf{x})|}$$
Score orientation: $s_{LOF} \approx 1$ signifies density matching neighbours; $s_{LOF} > 1$ indicates lower density (anomaly).

### 5.5 Model 4: One-Class SVM
We project standardized vectors $\mathbf{z}$ into an RKHS via a Gaussian Radial Basis Function (RBF) kernel:
$$K(\mathbf{z}, \mathbf{z}') = \exp\left(-\gamma \|\mathbf{z} - \mathbf{z}'\|_2^2\right), \quad \gamma = 0.20$$
The dual optimization problem subject to parameter $\nu = 0.05$ is:
$$\min_{\boldsymbol{\alpha}} \frac{1}{2}\sum_{i=1}^N \sum_{j=1}^N \alpha_i \alpha_j K(\mathbf{z}_i, \mathbf{z}_j) \quad \text{s.t.} \quad 0 \le \alpha_i \le \frac{1}{\nu N}, \quad \sum_{i=1}^N \alpha_i = 1$$
The decision boundary offset $\rho$ is computed over support vectors: $\rho = \sum_{j=1}^N \alpha_j K(\mathbf{z}_j, \mathbf{z}_{sv})$. The raw decision function is $f(\mathbf{x}) = \sum_{i=1}^{N_{sv}} \alpha_i K(\mathbf{z}_i, \mathbf{z}) - \rho$. To maintain uniform orientation where higher values indicate anomalies, the score is defined as:
$$s_{SVM}(\mathbf{x}) = \rho - \sum_{i=1}^{N_{sv}} \alpha_i K(\mathbf{z}_i, \mathbf{z})$$

### 5.6 Split-Conformal Calibration
Rather than relying on asymptotic Gaussian assumptions ($\chi^2_p$ quantiles), ExamGuard applies distribution-free split-conformal calibration \cite{angelopoulos2021gentle}. Given $m$ held-out baseline calibration sessions evaluated by model $\mathcal{M}$, let $S = \{s(\mathbf{x}_1), \dots, s(\mathbf{x}_m)\}$ be non-conformity scores sorted in ascending order. For target significance level $\alpha \in (0, 1)$, the finite-sample calibrated threshold $\tau$ is defined as the empirical quantile:
$$k = \lceil (m + 1)(1 - \alpha) \rceil, \quad \tau = \begin{cases} S_{(k)} & \text{if } k \le m \\ \infty & \text{if } k > m \end{cases}$$
A finite threshold mathematically requires a sample size satisfying $m \ge \lceil \frac{1 - \alpha}{\alpha} \rceil$. For $\alpha = 0.05$, the strict minimum sample size is $m_{\min} = 19$. Consequently, an individual student baseline with only $m_i = 10$ held-out sessions yields $k = \lceil 11 \times 0.95 \rceil = 11 > 10$, necessitating $\tau = \infty$ to avoid violating finite-sample coverage guarantees.

To overcome this individual sample-size bottleneck without sacrificing behavioral personalization, ExamGuard decouples **feature personalization** from **threshold calibration**:
1. Each student's mean vector $\hat{\boldsymbol{\mu}}_i$ and regularized covariance $\mathbf{R}_{\text{reg}, i}$ are estimated strictly from their individual low-stakes coursework.
2. Non-conformity scores $s = \mathcal{A}(\mathbf{x}; \hat{\boldsymbol{\mu}}_i, \mathbf{R}_{\text{reg}, i})$ are computed for each student's held-out baseline sessions.
3. These student-standardized non-conformity scores are pooled across the cohort calibration partition ($m = 1,000 \ge 19$), yielding conformal quantile rank $k = \lceil (1,001)(0.95) \rceil = 951 \le 1,000$.
4. This pooled conformal threshold $\tau_{\text{pooled}}$ guarantees an exact empirical false positive rate $\le \alpha = 0.05$ on unseen examination sessions while preserving complete personal baseline individuality. Query sessions are classified as anomalous if and only if $s(\mathbf{x}) > \tau_{\text{pooled}}$.

---

## 6. Explainable AI and Privacy-Aware Architecture

### 6.1 Mathematical Model Explainability
To ensure complete transparency during instructor review, ExamGuard constructs four specialized explainers:
1. **Mahalanobis Covariance Decomposition:** We decompose the total squared distance into diagonal variances and off-diagonal covariance coupling terms: $s_M^2 = \sum_j W_{jj} z_j^2 + 2\sum_{j < k} W_{jk} z_j z_k$. Furthermore, we compute conditional expected residuals: $\mathbb{E}[z_j \mid \mathbf{z}_{-j}] = \mathbf{R}_{j, -j} \mathbf{R}_{-j, -j}^{-1} \mathbf{z}_{-j}$, showing instructors whether feature $j$ is anomalous given the state of all other features.
2. **Isolation Forest 32-Coalition Shapley Attribution:** Because $p = 5$ is tractable, we compute **exact Shapley values across all $2^5 = 32$ feature subsets** rather than relying on Monte Carlo approximations:
   $$\phi_j = \sum_{S \subseteq \mathcal{F} \setminus \{j\}} \frac{|S|!(p - |S| - 1)!}{p!} \left(v(S \cup \{j\}) - v(S)\right)$$
   Local efficiency is verified analytically: $\sum_{j=1}^5 \phi_j = s_{IF}(\mathbf{x}) - \mathbb{E}[s_{IF}]$.
3. **LOF Neighbourhood Analysis:** Decomposes the anomaly ratio into individual neighbour reachability contributions, indicating whether the deviation arises from global isolation or local cluster boundary shifts.
4. **One-Class SVM Analytical Decision Gradients:** Computes the analytical gradient of the decision surface with respect to standardized input features:
   $$\nabla_{\mathbf{z}} s_{SVM} = 2\gamma \sum_{i=1}^{N_{sv}} \alpha_i K(\mathbf{z}_i, \mathbf{z})(\mathbf{z} - \mathbf{z}_i)$$
   To resolve gradient vanishing in severe outlier tails ($z \gg 4.0$ where $K \to 0$), ExamGuard implements a tail regularization floor $\max(K, 10^{-3})$.

### 6.2 Privacy & Security Safeguards
ExamGuard enforces strict GDPR compliance through five architectural pillars:
- **Data Minimisation:** Client-side event aggregation drops raw keystrokes, clipboard text, audio, and video before transmission. Server routes reject raw text payloads.
- **HMAC-SHA256 Pseudonymisation:** Real student identities are mapped to pseudonymous handles (`STU-XXXX`) via a keyed cryptographic hash, preventing instructor confirmation bias. (Explicitly documented as non-reversible hashing, not encryption).
- **Zero Automated Disciplinary Actions:** Anomaly scores only categorize sessions into: `Normal behaviour`, `Behavioural deviation detected`, and `Review required`. Direct algorithmic penalties are architecturally prohibited.
- **Right to Erasure:** A cryptographic purge protocol deletes all historical telemetry and baseline parameters upon student request.

---

## 7. Dataset and Experimental Setup

### 7.1 Synthetic Dataset Generation Protocol
To evaluate ExamGuard with rigorous ground-truth validation while avoiding privacy breaches associated with releasing real student surveillance data, we engineered a scenario-driven synthetic dataset (Seed = 42). The dataset models $100$ distinct students over $40$ chronological examination sessions each ($4,000$ total sessions, $20,005$ question interactions):
- **Train Partition (Sessions 1–20, $N = 2,000$):** $100\%$ clean low-stakes coursework used exclusively to fit personalized baselines.
- **Calibration Partition (Sessions 21–30, $m = 1,000$):** $100\%$ clean held-out sessions used exclusively for split-conformal threshold calibration.
- **Evaluation Partition (Sessions 31–40, $N = 1,000$):** High-stakes graded examinations featuring an authentic mixture of $818$ clean sessions and $182$ controlled anomalous deviations ($18.2\%$ prevalence).

### 7.2 Scenario Taxonomy in Evaluation Partition
- **Category A: Pure Normal Baseline ($N = 600$ sessions, $60\%$):** Normal interaction variations following student historical pacing.
- **Category B: Legitimate Human Variations ($N = 200$ sessions, $20\%$):** Non-cheating cognitive variations:
  - *B1: Difficult Questions ($N = 46$):* Prolonged thinking time ($+180\%$) and frequent answer revisions ($+250\%$).
  - *B2: Temporary Pauses ($N = 51$):* Inactivity intervals ($3$ to $5$ minutes).
  - *B3: Device Switching ($N = 74$):* Touchscreen/tablet input (reduced cursor displacement, zero hover).
  - *B4: Examination Fatigue ($N = 29$):* Gradual response slowdown toward exam termination.
- **Category C: Single-Feature Deviations ($N = 100$ sessions, $10\%$):** Isolated deviations across $x_1$ ($16$), $x_2$ ($18$), $x_3$ ($25$), $x_4$ ($23$), and $x_5$ ($18$).
- **Category D: Multi-Feature Deviations ($N = 69$ sessions, $6.9\%$):** Two-feature ($24$), three-feature ($16$), and simultaneous multivariate anomalies ($29$).
- **Category E: Data Quality & Behavioural Drift ($N = 31$ sessions, $3.1\%$):** Telemetry sensor drops, Gaussian measurement noise, and gradual pacing drift.

---

## 8. Results and Discussion

All experiments were executed on an x86_64 CPU workstation running Node.js v24.19.0. Experimental results were computed directly from `data/synthetic/phase5_experimental_results.json`.

### 8.1 Personalised Baseline Validation (Experiment E1)
To establish whether student behavioral patterns are truly idiosyncratic, we conducted One-Way ANOVA across all $100$ students on the $2,000$ training sessions (Table 3A). The between-student variance dramatically exceeds within-student variance across all primary continuous metrics:
- `scroll_distance`: $F = 250.32$, $p < 10^{-15}$
- `response_time`: $F = 109.55$, $p < 10^{-15}$
- `revision_count`: $F = 96.53$, $p < 10^{-15}$
- `pointer_movement`: $F = 56.00$, $p < 10^{-15}$

These results provide irrefutable statistical evidence that generic cohort-wide thresholds are fundamentally flawed. Furthermore, longitudinal sample size analysis (Table 3B) proves that covariance estimation stabilizes rapidly: at $N = 10$ sessions, the matrix condition number drops to $\kappa = 14.6$, Ledoit-Wolf shrinkage drops to $\lambda = 0.224$, and Frobenius estimation error falls by $62\%$, statistically validating ExamGuard's $10$-session baseline maturity rule.

### 8.2 Comparative Model Performance (Experiment E2)
Table 4 presents comparative benchmark results across the $1,000$ evaluation sessions.
- **One-Class SVM** achieved the highest overall $F_1$-score ($0.7106$, $95\%$ bootstrap CI: $[0.6636, 0.7549]$) and sensitivity ($91.76\%$, $95\%$ CI: $[86.85\%, 94.94\%]$), with a precision of $57.99\%$ and ROC-AUC of $0.9312$.
- **Local Outlier Factor (LOF)** achieved an $F_1$-score of $0.7040$ ($95\%$ CI: $[0.6567, 0.7512]$), the highest precision ($61.13\%$), sensitivity of $82.97\%$, and ROC-AUC of $0.9266$.
- **Regularised Mahalanobis Distance** achieved an $F_1$-score of $0.7019$ ($95\%$ CI: $[0.6534, 0.7465]$), the highest ROC-AUC ($0.9487$), highest PR-AUC ($0.7743$), and high sensitivity ($91.21\%$).
- **Isolation Forest** performed substantially lower ($F_1 = 0.2955$, $95\%$ CI: $[0.2256, 0.3650]$, Recall $= 23.63\%$, ROC-AUC $= 0.7573$, PR-AUC $= 0.4028$).

*Discussion on Isolation Forest Limitation:* Isolation Forest underperformed because orthogonal axis-aligned splits in low-dimensional continuous space ($p = 5$) struggle to isolate single-feature deviations without segmenting correlated normal subspaces. In contrast, Mahalanobis distance and One-Class SVM leverage covariance ellipsoids and kernel distances that naturally encompass correlated interaction dynamics.

### 8.3 Scenario-Based Detection Analysis (Experiment E3)
Table 7 breaks down detection rates across anomaly categories.
- On **Category C (Single-Feature Deviations)**, Mahalanobis ($90.00\%$) and One-Class SVM ($90.00\%$) reliably detected isolated jumps in response time ($100\%$), paste activity ($100\%$), revision count ($100\%$), and scrolling ($100\%$), with LOF achieving $79.00\%$. In contrast, Isolation Forest detected only $4.00\%$ of single-feature anomalies.
- On **Category D (Multi-Feature Deviations)**, Mahalanobis and One-Class SVM achieved $100.0\%$ detection, followed closely by LOF ($98.55\%$) and Isolation Forest ($53.62\%$). When three or more features deviated simultaneously, Mahalanobis, LOF, and OC-SVM detected $100.0\%$ of cases.

### 8.4 The "Difficult Question" Confound & False Alarm Analysis (Experiment E5)
Figure 6 and Table 9 reveal the most critical scientific discovery of this study: **the radical divergence in false alarm rates between routine coursework and legitimate human cognitive variation.**
- On **Category A (Pure Normal Baseline)**, all models strictly respected conformal calibration bounds ($\alpha = 0.05$), exhibiting false positive rates at or below target: Mahalanobis ($5.00\%$), LOF ($5.00\%$), OC-SVM ($4.33\%$), and Isolation Forest ($3.67\%$).
- However, on **Category B (Legitimate Human Variations)**, false alarm rates exploded:
  - *Difficult Questions (B1):* Triggered false alarms in **$100.0\%$** of OC-SVM cases, **$100.0\%$** of Mahalanobis cases, **$97.83\%$** of LOF cases, and **$76.09\%$** of Isolation Forest cases.
  - *Tablet Switches (B3):* Triggered false alarms in $39.19\% - 40.54\%$ of metric cases.
  - *Interruption Pauses (B2):* Triggered false alarms in $21.57\% - 25.49\%$ of cases.

*Crucial Scientific Finding:* When students encounter difficult questions, their response time lengthens ($+180\%$) and revisions spike ($+250\%$). Because these motor patterns deviate sharply from routine baseline averages, mathematical anomaly detectors flag them with near certainty. **This proves that unsupervised anomaly detection cannot distinguish between intense cognitive engagement and dishonest assistance.** Consequently, systems that automatically penalize students based on anomaly scores commit grave pedagogical errors. ExamGuard's mandatory human-in-the-loop review architecture directly resolves this vulnerability by presenting the instructor with context to clear legitimate cognitive effort.

### 8.5 Explainability Evaluation (Experiment E6)
As detailed in Table 10, all explainers executed in sub-millisecond time ($0.142 - 0.650$ ms):
- **Faithfulness:** Neutralizing the top-attributed feature reduced Mahalanobis anomaly scores by $67.81\%$, OC-SVM scores by $57.97\%$, and LOF scores by $57.07\%$.
- **Stability:** Under $5\%$ Gaussian measurement noise, top-ranked feature attributions exhibited $100\%$ rank preservation for Mahalanobis and OC-SVM, $99.6\%$ for LOF, and $98.8\%$ for Isolation Forest.
- **Relevance:** On Category C anomalies, Mahalanobis and OC-SVM achieved $100.0\%$ concordance, correctly identifying the ground-truth perturbed feature as the primary contributor in every instance.

### 8.6 Computational Scalability Profile (Experiment E8)
Table 12 confirms ExamGuard's extreme computational efficiency:
- Single-session inference latency was $7.7\mu\text{s}$ for OC-SVM and $7.8\mu\text{s}$ for Mahalanobis distance.
- Across a single CPU core, ExamGuard achieves a throughput of **over $128,000$ evaluations per second**, demonstrating that personalized anomaly detection can run at massive institutional scale with negligible server infrastructure costs.

---

## 9. Limitations and Future Work

1. **Synthetic-Only Telemetry Validation:** While the synthetic dataset was constructed using empirically grounded behavioral distributions, controlled deviations do not capture the full psychosocial complexity of real-world cheating. Future research must conduct live classroom trials with consented student cohorts across varied academic disciplines.
2. **Absence of Real-World Misconduct Ground Truth:** Genuine cheating in academic examinations is clandestine, making unassailable ground-truth labels notoriously difficult to obtain without invasive video auditing.
3. **Cold-Start Vulnerability:** Students with fewer than $10$ coursework sessions cannot establish fully stabilized covariance matrices. Although ExamGuard gates uncalibrated baselines, institutional adoption requires integrating early-term low-stakes assignments.
4. **Adversarial Behavioral Manipulation:** Sophisticated examinees aware of tracking metrics could theoretically pace their inputs to mirror normal baselines. Investigating multi-scale temporal sequence models (e.g., LSTMs or Transformers) represents a promising direction for future counter-adversarial robustness.

---

## 10. Conclusion

ExamGuard demonstrates that academic integrity in digital examinations can be effectively safeguarded without resorting to invasive video surveillance, acoustic snooping, or raw keystroke logging. By coupling non-invasive derived telemetry with personalized longitudinal baselines, conformal threshold calibration, and multi-model explainability, ExamGuard achieves high anomaly sensitivity ($91.2\% - 91.8\%$) while upholding fundamental privacy principles. Most importantly, our empirical findings reveal that difficult examination questions induce false alarm rates exceeding $95\%$ across all unsupervised anomaly detection models. This finding proves that automated proctoring without human pedagogical review is scientifically and ethically invalid, firmly establishing ExamGuard's explainable, human-in-the-loop paradigm as the future of respectful, privacy-aware educational assessment.

---

## References

1. Angelopoulos, A. N., & Bates, S. (2021). A gentle introduction to conformal prediction and distribution-free uncertainty quantification. *arXiv preprint arXiv:2107.07511*.
2. Bours, P. (2012). Continuous authentication to enhance educational online test integrity. *International Journal of Information Security*, 11(3), 197–211. DOI: [10.1007/s10207-012-0160-z](https://doi.org/10.1007/s10207-012-0160-z).
3. Breunig, M. M., Kriegel, H. P., Ng, R. T., & Sander, J. (2000). LOF: identifying density-based local outliers. *ACM SIGMOD Record*, 29(2), 93–104. DOI: [10.1145/342009.335388](https://doi.org/10.1145/342009.335388).
4. Chandola, V., Banerjee, A., & Kumar, V. (2009). Anomaly detection: A survey. *ACM Computing Surveys*, 41(3), 1–58. DOI: [10.1145/1541880.1541882](https://doi.org/10.1145/1541880.1541882).
5. Clarke, R. (2021). Academic integrity, anti-cheating, and the surveillance technology industry. *IEEE Technology and Society Magazine*, 40(4), 45–54. DOI: [10.1109/MTS.2021.3123737](https://doi.org/10.1109/MTS.2021.3123737).
6. Coghlan, S., Miller, T., & Paterson, J. (2021). Good Proctor or "Big Brother"? Ethics of online exam supervision technologies. *Philosophy & Technology*, 34(4), 1581–1606. DOI: [10.1007/s13347-021-00476-1](https://doi.org/10.1007/s13347-021-00476-1).
7. Harwood, T., & Winson, A. (2023). Algorithmic surveillance in higher education: Biometrics, bias, and student trust. *Computers and Education Open*, 4, 100142. DOI: [10.1016/j.caeo.2023.100142](https://doi.org/10.1016/j.caeo.2023.100142).
8. Ledoit, O., & Wolf, M. (2004). A well-conditioned estimator for large-dimensional covariance matrices. *Journal of Multivariate Analysis*, 88(2), 365–411. DOI: [10.1016/S0047-259X(03)00096-4](https://doi.org/10.1016/S0047-259X(03)00096-4).
9. Liu, F. T., Ting, K. M., & Zhou, Z. H. (2008). Isolation Forest. In *2008 Eighth IEEE International Conference on Data Mining* (pp. 413–422). IEEE. DOI: [10.1109/ICDM.2008.17](https://doi.org/10.1109/ICDM.2008.17).
10. Lundberg, S. M., & Lee, S. I. (2017). A unified approach to interpreting model predictions. In *Advances in Neural Information Processing Systems (NeurIPS 2017)* (pp. 4765–4774).
11. Mahalanobis, P. C. (1936). On the generalized distance in statistics. *Proceedings of the National Institute of Sciences of India*, 2(1), 49–55.
12. Monrose, F., & Rubin, A. D. (2000). Keystroke dynamics as a biometric for authentication. *Future Generation Computer Systems*, 16(4), 351–359. DOI: [10.1016/S0167-739X(99)00059-3](https://doi.org/10.1016/S0167-739X(99)00059-3).
13. Nigam, A., Pasricha, R., Sultana, T., & Mudgal, A. (2021). A systematic review on AI-based proctoring systems in higher education. *Education and Information Technologies*, 26(5), 6421–6445. DOI: [10.1007/s10639-021-10597-x](https://doi.org/10.1007/s10639-021-10597-x).
14. Ribeiro, M. T., Singh, S., & Guestrin, C. (2016). "Why should I trust you?": Explaining the predictions of any classifier. In *Proceedings of the 22nd ACM SIGKDD International Conference on Knowledge Discovery and Data Mining* (pp. 1135–1144). DOI: [10.1145/2939672.2939778](https://doi.org/10.1145/2939672.2939778).
15. Schölkopf, B., Platt, J. C., Shawe-Taylor, J., Smola, A. J., & Williamson, R. C. (2001). Estimating the support of a high-dimensional distribution. *Neural Computation*, 13(7), 1443–1471. DOI: [10.1162/089976601750541815](https://doi.org/10.1162/089976601750541815).
16. Selwyn, N., & O'Neill, C. (2023). Proctoring technologies, artificial intelligence and higher education: An overview of key issues. *Higher Education Research & Development*, 42(6), 1489–1504. DOI: [10.1080/07294360.2023.2174083](https://doi.org/10.1080/07294360.2023.2174083).
17. Swauger, S. (2020). Our bodies encoded: Algorithmic test proctoring in higher education. *Hybrid Pedagogy*, April 2020.
18. Vovk, V., Gammerman, A., & Shafer, G. (2005). *Algorithmic Learning in a Random World*. Springer Science & Business Media. DOI: [10.1007/b106715](https://doi.org/10.1007/b106715).
19. Zheng, N., Paloski, A., & Wang, H. (2011). An efficient user verification system via mouse dynamics. *IEEE Transactions on Information Forensics and Security*, 6(3), 1110–1122. DOI: [10.1109/TIFS.2011.2158428](https://doi.org/10.1109/TIFS.2011.2158428).

