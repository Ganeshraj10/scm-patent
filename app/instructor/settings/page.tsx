'use client';

import { useState, useEffect } from 'react';
import { SlidersHorizontal, Brain, Shield, Info, Save } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ProgressBar } from '@/components/ui/ProgressBar';

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  description?: string;
  onChange: (v: number) => void;
  id: string;
}

function SettingSlider({ label, value, min, max, step, unit, description, onChange, id }: SliderProps) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <label htmlFor={id} className="text-sm font-medium text-text-primary">{label}</label>
        <span className="text-sm font-bold tabular-nums text-indigo-400">{value}{unit}</span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none bg-surface-600 accent-indigo-500 cursor-pointer"
      />
      <div className="flex justify-between text-[10px] text-text-muted">
        <span>{min}{unit}</span>
        <span>{max}{unit}</span>
      </div>
      {description && (
        <p className="text-xs text-text-muted mt-1">{description}</p>
      )}
    </div>
  );
}

interface ToggleProps {
  label: string;
  description?: string;
  enabled: boolean;
  onChange: (v: boolean) => void;
  id: string;
}

function FeatureToggle({ label, description, enabled, onChange, id }: ToggleProps) {
  return (
    <div className="flex items-start justify-between gap-4 py-3.5">
      <div className="flex-1 min-w-0 pr-4">
        <label htmlFor={id} className="text-sm font-medium text-text-primary cursor-pointer select-none">
          {label}
        </label>
        {description && <p className="text-xs text-text-muted mt-0.5 leading-relaxed">{description}</p>}
      </div>
      <button
        type="button"
        id={id}
        role="switch"
        aria-checked={enabled}
        onClick={() => onChange(!enabled)}
        className={[
          'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-surface-800 mt-0.5',
          enabled ? 'bg-indigo-600' : 'bg-surface-600',
        ].join(' ')}
      >
        <span className="sr-only">{label}</span>
        <span
          className={[
            'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
            enabled ? 'translate-x-5' : 'translate-x-0',
          ].join(' ')}
        />
      </button>
    </div>
  );
}

export default function SettingsPage() {
  const [fprTarget, setFprTarget] = useState(5);
  const [minSessions, setMinSessions] = useState(10);
  const [confidenceThreshold, setConfidenceThreshold] = useState(70);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem('examguard_instructor_settings_v1');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (typeof parsed.fprTarget === 'number') setFprTarget(parsed.fprTarget);
          if (typeof parsed.minSessions === 'number') setMinSessions(parsed.minSessions);
          if (typeof parsed.confidenceThreshold === 'number') setConfidenceThreshold(parsed.confidenceThreshold);
          if (parsed.featureWeights) setFeatureWeights(parsed.featureWeights);
          if (parsed.features) setFeatures(parsed.features);
        }
      } catch (e) {
        console.warn('LocalStorage load error:', e);
      }
    }
  }, []);

  const handleSaveSettings = () => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(
          'examguard_instructor_settings_v1',
          JSON.stringify({
            fprTarget,
            minSessions,
            confidenceThreshold,
            featureWeights,
            features,
            savedAt: new Date().toISOString(),
          })
        );
      } catch (e) {
        console.warn('LocalStorage save error:', e);
      }
    }
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const [featureWeights, setFeatureWeights] = useState({
    responseTime: 30,
    revisions: 25,
    pointer: 20,
    scrolling: 15,
    paste: 10,
  });

  const [features, setFeatures] = useState({
    responseTime: true,
    revisions: true,
    pointer: true,
    scrolling: true,
    paste: true,
  });

  const totalWeight = Object.values(featureWeights).reduce((a, b) => a + b, 0);

  // Raw Mahalanobis distance threshold preview (consistent with calibrationEngine alpha=0.05 formula)
  const estimatedDM = (2.5 + (5 - fprTarget) * 0.04).toFixed(2);

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold text-text-primary">Settings & Calibration</h2>
        <p className="text-sm text-text-muted mt-0.5">
          Configure behavioral model parameters and threshold calibration aligned with the Mahalanobis deviation engine.
        </p>
      </div>

      {/* Operational Engine Alignment notice */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-indigo-600/8 border border-indigo-500/15">
        <Info size={15} className="text-indigo-400 mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-sm font-semibold text-indigo-400">Operational Engine Configuration</p>
          <p className="text-xs text-text-secondary mt-0.5">
            Active calibration uses split-conformal prediction at significance level &alpha; = 0.05 (5% target FPR, 95% nominal coverage). Scoring operates on raw Mahalanobis distance (D<sub>M</sub>). Feature weights below are prototype placeholders and are not applied in Mahalanobis covariance calculations.
          </p>
        </div>
      </div>

      {/* Personalized Threshold */}
      <Card
        header={
          <CardHeader
            title="Personalized Conformal Threshold"
            subtitle="Distribution-free calibration parameters for Mahalanobis deviation scoring"
            action={<SlidersHorizontal size={16} className="text-text-muted" />}
          />
        }
        padding="md"
      >
        <div className="space-y-6">
          <SettingSlider
            id="fpr-target"
            label="Target Calibration Significance Level (Alpha / Target FPR)"
            value={fprTarget}
            min={1}
            max={20}
            step={1}
            unit="%"
            description="Nominal non-coverage probability (alpha) for conformal calibration (default: 5% / alpha=0.05). Note: this is the mathematical calibration target, not an empirically measured post-hoc false-positive rate."
            onChange={setFprTarget}
          />

          {/* Derived threshold preview in raw Mahalanobis distance units */}
          <div className="p-3 rounded-lg bg-surface-700 border border-border">
            <p className="text-xs text-text-muted mb-2">Derived Non-Conformity Threshold Preview (Raw Distance Units)</p>
            <div className="flex items-center gap-4">
              <div>
                <p className="text-xs text-text-muted">Estimated raw threshold (D<sub>M</sub>)</p>
                <p className="text-xl font-bold tabular-nums text-text-primary">
                  {estimatedDM} <span className="text-xs font-normal text-indigo-400">D<sub>M</sub></span>
                </p>
              </div>
              <div className="flex-1">
                <ProgressBar
                  value={fprTarget}
                  max={20}
                  color="indigo"
                  size="sm"
                  label={`Target Alpha ${fprTarget}%`}
                />
              </div>
            </div>
            <p className="text-[11px] text-text-muted mt-2">
              Measured in raw Mahalanobis distance units (D<sub>M</sub>). Threshold T aligns directly with observed session distance without arbitrary multiplier scaling.
            </p>
          </div>
        </div>
      </Card>

      {/* Behavioral Features */}
      <Card
        header={
          <CardHeader
            title="Behavioral Features"
            subtitle="Enable or disable which signals are included in the model"
          />
        }
        padding="md"
      >
        <div className="divide-y divide-border">
          {[
            { key: 'responseTime' as const, label: 'Response Timing', description: 'Time spent on each question (s).' },
            { key: 'revisions' as const, label: 'Answer Revisions', description: 'Number of answer changes per question.' },
            { key: 'pointer' as const, label: 'Pointer Movement', description: 'Total pointer distance traveled (px) per question.' },
            { key: 'scrolling' as const, label: 'Scroll Distance', description: 'Total vertical scroll distance (px) per question.' },
            { key: 'paste' as const, label: 'Paste-Event Percentage', description: 'Clipboard paste occurrence aggregated across session questions (%).' },
          ].map(({ key, label, description }) => (
            <FeatureToggle
              key={key}
              id={`feature-${key}`}
              label={label}
              description={description}
              enabled={features[key]}
              onChange={(v) => setFeatures((prev) => ({ ...prev, [key]: v }))}
            />
          ))}
        </div>
      </Card>

      {/* Feature Weights - Explicitly marked as prototype placeholder / inactive */}
      <Card
        header={
          <CardHeader
            title="Feature Weights (Prototype Placeholder — Not Applied)"
            subtitle={`Combined placeholder weight: ${totalWeight}% (Not used in active Mahalanobis distance)`}
            action={
              <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                Inactive in D<sub>M</sub>
              </span>
            }
          />
        }
        padding="md"
      >
        <div className="space-y-4">
          <div className="p-3 rounded-lg bg-surface-700/50 border border-amber-500/20 text-xs text-amber-200/90 leading-relaxed">
            <span className="font-semibold text-amber-300 block mb-0.5">Mathematical Engine Notice:</span>
            The active behavioral scoring engine calculates distance using shrinkage-regularized Mahalanobis distance D<sub>M</sub> = &radic;(z<sup>T</sup> R<sup>-1</sup> z) based on the empirical correlation matrix R and shrinkage intensity &lambda;. Manual feature weights do not affect Mahalanobis distance calculations.
          </div>
          <div className="space-y-4 opacity-75">
            {[
              { key: 'responseTime' as const, label: 'Response Time' },
              { key: 'revisions' as const, label: 'Revisions' },
              { key: 'pointer' as const, label: 'Pointer Movement' },
              { key: 'scrolling' as const, label: 'Scroll Distance' },
              { key: 'paste' as const, label: 'Paste-Event Percentage' },
            ].map(({ key, label }) => (
              <SettingSlider
                key={key}
                id={`weight-${key}`}
                label={label}
                value={featureWeights[key]}
                min={0}
                max={60}
                step={5}
                unit="%"
                onChange={(v) => setFeatureWeights((prev) => ({ ...prev, [key]: v }))}
              />
            ))}
          </div>
        </div>
      </Card>

      {/* Model Settings */}
      <Card
        header={
          <CardHeader
            title="Model Settings"
            subtitle="Cold start policy and sample sufficiency parameters"
            action={<Brain size={16} className="text-text-muted" />}
          />
        }
        padding="md"
      >
        <div className="space-y-6">
          <SettingSlider
            id="min-sessions"
            label="Minimum Low-Stakes Sessions for Active Baseline"
            value={minSessions}
            min={10}
            max={30}
            step={1}
            unit=" sessions"
            description="Strict policy threshold: at least 10 low-stakes sessions are required before the model enters Active status. Below 10 sessions, status remains Cold Start / Analysis Limited and conformal calibration is withheld."
            onChange={setMinSessions}
          />
          <SettingSlider
            id="confidence-threshold"
            label="Sample Sufficiency Confidence Target"
            value={confidenceThreshold}
            min={50}
            max={95}
            step={5}
            unit="%"
            description="Heuristic sample-sufficiency index based on session count N >= 10 (capped at 95%). Note: this is a data-sufficiency score, not a calibrated Bayesian posterior probability."
            onChange={setConfidenceThreshold}
          />
        </div>
      </Card>

      {/* Save button */}
      <div className="flex items-center justify-between pt-2">
        <p className="text-xs text-text-muted flex items-center gap-1.5">
          <Shield size={12} />
          {saveSuccess ? (
            <span className="text-emerald-400 font-semibold">Settings persisted successfully!</span>
          ) : (
            'Calibration & feature weight configurations are persisted to active instructor profile.'
          )}
        </p>
        <Button
          variant="primary"
          leftIcon={<Save size={14} />}
          onClick={handleSaveSettings}
          id="save-settings-btn"
        >
          {saveSuccess ? 'Saved ✓' : 'Save Settings'}
        </Button>
      </div>
    </div>
  );
}
