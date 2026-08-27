'use client';

import { useState } from 'react';
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
    <div className="flex items-start gap-3 py-3">
      <button
        id={id}
        role="switch"
        aria-checked={enabled}
        onClick={() => onChange(!enabled)}
        className={[
          'relative w-9 h-5 rounded-full border transition-all flex-shrink-0 mt-0.5',
          enabled
            ? 'bg-indigo-600 border-indigo-500'
            : 'bg-surface-600 border-border',
        ].join(' ')}
      >
        <span
          className={[
            'absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform',
            enabled ? 'translate-x-4' : 'translate-x-0.5',
          ].join(' ')}
        />
      </button>
      <div>
        <p className="text-sm font-medium text-text-primary">{label}</p>
        {description && <p className="text-xs text-text-muted mt-0.5">{description}</p>}
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const [fprTarget, setFprTarget] = useState(10);
  const [minSessions, setMinSessions] = useState(10);
  const [confidenceThreshold, setConfidenceThreshold] = useState(70);

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

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold text-text-primary">Settings & Calibration</h2>
        <p className="text-sm text-text-muted mt-0.5">
          Configure behavioral model parameters and threshold calibration. Placeholder controls — Phase 8 will implement real calibration.
        </p>
      </div>

      {/* Prototype notice */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-indigo-600/8 border border-indigo-500/15">
        <Info size={15} className="text-indigo-400 mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-sm font-semibold text-indigo-400">Phase 1 — UI Placeholder</p>
          <p className="text-xs text-text-secondary mt-0.5">
            These controls are non-functional in Phase 1. Phase 8 (Personalized Threshold) will wire these to the conformal calibration engine using held-out low-stakes sessions.
          </p>
        </div>
      </div>

      {/* Personalized Threshold */}
      <Card
        header={
          <CardHeader
            title="Personalized Threshold"
            subtitle="Calibration parameters for deviation scoring"
            action={<SlidersHorizontal size={16} className="text-text-muted" />}
          />
        }
        padding="md"
      >
        <div className="space-y-6">
          <SettingSlider
            id="fpr-target"
            label="Target False-Positive Rate"
            value={fprTarget}
            min={1}
            max={25}
            step={1}
            unit="%"
            description="Percentage of innocent sessions expected to exceed the threshold. Lower values mean fewer false flags but may miss genuine deviations."
            onChange={setFprTarget}
          />

          {/* Derived threshold preview */}
          <div className="p-3 rounded-lg bg-surface-700 border border-border">
            <p className="text-xs text-text-muted mb-2">Derived Threshold Preview (Phase 8)</p>
            <div className="flex items-center gap-4">
              <div>
                <p className="text-xs text-text-muted">Estimated threshold</p>
                <p className="text-xl font-bold tabular-nums text-text-primary">
                  {(30 + (25 - fprTarget) * 0.8).toFixed(1)}
                </p>
              </div>
              <div className="flex-1">
                <ProgressBar
                  value={fprTarget}
                  max={25}
                  color="indigo"
                  size="sm"
                  label={`FPR ${fprTarget}%`}
                />
              </div>
            </div>
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
            { key: 'responseTime' as const, label: 'Response Timing', description: 'Time spent on each question (ms). Normalized by question difficulty.' },
            { key: 'revisions' as const, label: 'Answer Revisions', description: 'Number of answer changes per question.' },
            { key: 'pointer' as const, label: 'Pointer Movement', description: 'Total pointer distance traveled (px) per question.' },
            { key: 'scrolling' as const, label: 'Scroll Distance', description: 'Total vertical scroll distance (px) per question.' },
            { key: 'paste' as const, label: 'Paste Detection', description: 'Binary flag for clipboard paste events. Strong signal.' },
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

      {/* Feature Weights */}
      <Card
        header={
          <CardHeader
            title="Feature Weights"
            subtitle={`Combined weight: ${totalWeight}% (should sum to 100%)`}
            action={
              <span
                className={[
                  'text-xs font-semibold tabular-nums',
                  totalWeight === 100 ? 'text-emerald-400' : 'text-amber-400',
                ].join(' ')}
              >
                {totalWeight}%
              </span>
            }
          />
        }
        padding="md"
      >
        <div className="space-y-5">
          {[
            { key: 'responseTime' as const, label: 'Response Time' },
            { key: 'revisions' as const, label: 'Revisions' },
            { key: 'pointer' as const, label: 'Pointer Movement' },
            { key: 'scrolling' as const, label: 'Scroll Distance' },
            { key: 'paste' as const, label: 'Paste Detection' },
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
      </Card>

      {/* Model Settings */}
      <Card
        header={
          <CardHeader
            title="Model Settings"
            subtitle="Cold start and model readiness parameters"
            action={<Brain size={16} className="text-text-muted" />}
          />
        }
        padding="md"
      >
        <div className="space-y-6">
          <SettingSlider
            id="min-sessions"
            label="Minimum Sessions for Active Model"
            value={minSessions}
            min={5}
            max={30}
            step={1}
            unit=" sessions"
            description="Number of low-stakes sessions required before the system enters Active Model status. Below this, the model is in Cold Start."
            onChange={setMinSessions}
          />
          <SettingSlider
            id="confidence-threshold"
            label="Confidence Threshold"
            value={confidenceThreshold}
            min={50}
            max={95}
            step={5}
            unit="%"
            description="Minimum model confidence required to trust deviation scores. Flags from models below this confidence level may be discounted."
            onChange={setConfidenceThreshold}
          />
        </div>
      </Card>

      {/* Save button */}
      <div className="flex items-center justify-between pt-2">
        <p className="text-xs text-text-muted flex items-center gap-1.5">
          <Shield size={12} />
          Settings are stored locally in Phase 1. Real persistence in Phase 4+.
        </p>
        <Button
          variant="primary"
          leftIcon={<Save size={14} />}
          onClick={() => alert('Settings saved (Phase 1 mock)')}
          id="save-settings-btn"
        >
          Save Settings
        </Button>
      </div>
    </div>
  );
}
