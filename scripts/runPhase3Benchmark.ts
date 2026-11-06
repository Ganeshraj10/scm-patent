/**
 * ============================================================================
 * EXAMGUARD — PHASE 3: FOUR-MODEL BENCHMARK CLI RUNNER
 * ============================================================================
 * Fits, calibrates, and evaluates all four models across the 4,000 synthetic
 * sessions (100 students, 1,000 test sessions) and outputs comparative metrics.
 */

import fs from 'fs';
import path from 'path';
import { BenchmarkEngine } from '../lib/ml/benchmarkEngine';

async function main() {
  console.log('================================================================');
  console.log(' EXAMGUARD — PHASE 3: FOUR-MODEL COMPARATIVE BENCHMARK RUNNER');
  console.log('================================================================\n');

  const benchmark = new BenchmarkEngine();
  console.log('[1/3] Loading dataset partitions from data/synthetic/...');
  const tStart = Date.now();
  const report = benchmark.runBenchmark();
  const elapsed = ((Date.now() - tStart) / 1000).toFixed(2);

  console.log(`[2/3] Benchmark completed in ${elapsed}s across 100 students (1,000 test sessions).\n`);

  // Print Formatted Markdown Table
  console.log('| Model Name | Family | TPR (Sensitivity) | Overall FPR | Cat B FAR | Precision | F1-Score | AUC-ROC | Latency (ms) |');
  console.log('|---|---|---|---|---|---|---|---|---|');

  for (const [name, res] of Object.entries(report.models)) {
    const s = res.summary;
    console.log(
      `| ${s.modelName} | ${s.modelFamily} | ${(s.tpr * 100).toFixed(1)}% | ${(s.fprOverall * 100).toFixed(1)}% | ${(s.farLegitimateCategoryB * 100).toFixed(1)}% | ${(s.precision * 100).toFixed(1)}% | ${s.f1Score.toFixed(3)} | ${s.aucRoc.toFixed(3)} | ${s.avgInferenceLatencyMs.toFixed(3)}ms |`
    );
  }

  console.log('\n--- Scenario Breakdown (TPR by Anomaly Type & Legitimate FPR) ---');
  for (const [name, res] of Object.entries(report.models)) {
    const sb = res.scenarioBreakdown;
    console.log(`\nModel: ${name}`);
    console.log(`  - Category A Normal FPR: ${(sb.categoryA_Normal_FPR * 100).toFixed(1)}%`);
    console.log(`  - Category B Legitimate FAR: ${(sb.categoryB_Legitimate_FAR * 100).toFixed(1)}%`);
    console.log(`  - Category C Single-Dev TPR: ${(sb.categoryC_SingleDev_TPR * 100).toFixed(1)}%`);
    console.log(`  - Category D Multi-Dev TPR: ${(sb.categoryD_MultiDev_TPR * 100).toFixed(1)}%`);
    console.log(`  - Category E Drift/Noise TPR: ${(sb.categoryE_QualityDrift_TPR * 100).toFixed(1)}%`);
  }

  // Save JSON report
  const outputPath = path.resolve(process.cwd(), 'data/synthetic/model_comparison_results.json');
  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2), 'utf8');
  console.log(`\n[3/3] Detailed benchmark report saved to: ${outputPath}`);
  console.log('================================================================\n');
}

main().catch((err) => {
  console.error('[Benchmark Error]:', err);
  process.exit(1);
});

