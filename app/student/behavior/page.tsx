'use client';

import {
  Clock,
  RotateCcw,
  MousePointer,
  ArrowDown,
  ClipboardX,
  Brain,
  Info,
  TrendingUp,
} from 'lucide-react';
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
} from 'recharts';
import { Card, CardHeader } from '@/components/ui/Card';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { ChartContainer } from '@/components/ui/ChartContainer';
import { Badge } from '@/components/ui/Badge';
import { useState, useEffect } from 'react';
import { getBehavioralModel } from '@/lib/services/behavioralModels';
import { getCurrentStudentProfile } from '@/lib/services/students';
import type { BehavioralModel, Student } from '@/types';

// Demo mock fallbacks will be resolved per student UUID where possible

const featureIcons: Record<string, React.ReactNode> = {
  responseTime: <Clock size={16} />,
  revisionCount: <RotateCcw size={16} />,
  pointerMovement: <MousePointer size={16} />,
  scrollDistance: <ArrowDown size={16} />,
  pasteDetected: <ClipboardX size={16} />,
};

const featureDescriptions: Record<string, string> = {
  responseTime: 'Average time you spend on each question before answering.',
  revisionCount: 'How often you change your answer on a given question.',
  pointerMovement: 'Total distance your pointer travels per question.',
  scrollDistance: 'How much you scroll while reviewing each question.',
  pasteDetected: 'Frequency of clipboard paste events detected during sessions.',
};

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-surface-700 border border-border rounded-lg px-3 py-2 shadow-lg text-xs">
        <p className="text-text-muted">{label}</p>
        <p className="text-text-primary font-semibold">{payload[0].value}%</p>
      </div>
    );
  }
  return null;
};

// Session trend for bar chart (confidence growing over sessions)
const generateSessionTrend = (currentConfidence: number, count: number) => {
  if (count === 0) return [];
  if (count < 5) return [{ sessions: String(count), confidence: currentConfidence }];
  
  return [
    { sessions: '5', confidence: Math.min(currentConfidence, 52) },
    { sessions: '10', confidence: Math.min(currentConfidence, 67) },
    { sessions: '15', confidence: Math.min(currentConfidence, 78) },
    { sessions: '20', confidence: Math.min(currentConfidence, 87) },
    { sessions: String(count), confidence: currentConfidence },
  ];
};

export default function BehaviorProfilePage() {
  const [loading, setLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [model, setModel] = useState<BehavioralModel | null>(null);

  useEffect(() => {
    let active = true;
    getCurrentStudentProfile().then(profile => {
      if (!active) return;
      if (!profile) {
        setProfileError('Student profile not found');
        setLoading(false);
        return;
      }
      
      const studentId = profile.id;
      
      // Phase 6: Fetch model from persistence
      getBehavioralModel(studentId, 'desktop')
        .then(persistedModel => {
          if (!active) return;
          setModel(persistedModel);
          setLoading(false);
        })
        .catch(err => {
          if (active) {
            setProfileError('Failed to load behavioral model');
            setLoading(false);
          }
        });
    }).catch(err => {
      if (active) {
        setProfileError(err.message);
        setLoading(false);
      }
    });
    
    return () => { active = false; };
  }, []);

  if (loading) {
    return <div className="p-8 text-center text-text-muted">Loading behavior profile...</div>;
  }
  if (profileError || !model) {
    return <div className="p-8 text-center text-rose-400">{profileError || 'Unable to load profile'}</div>;
  }

  const radarData = model.expectations.map((exp) => {
    const unc = model.uncertainties.find((u) => u.feature === exp.feature);
    return {
      feature: exp.label.split(' ')[0],
      confidence: Math.round((1 - (unc?.uncertainty ?? 0)) * 100),
    };
  });

  const sessionTrendData = generateSessionTrend(model.confidence, model.sessionCount);

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-text-primary">My Behavior Profile</h2>
          <p className="text-sm text-text-muted mt-0.5">
            Your personalized behavioral model — built from your own practice history.
          </p>
        </div>
        <Badge variant={model.status === 'active' ? 'active' : 'cold_start'} dot className="flex-shrink-0">
          {model.status === 'active' ? 'ACTIVE MODEL' : 'COLD START'}
        </Badge>
      </div>

      {/* Explanation banner */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-indigo-600/6 border border-indigo-500/15">
        <Info size={15} className="text-indigo-400 mt-0.5 flex-shrink-0" />
        <p className="text-xs text-text-secondary leading-relaxed">
          This profile shows the behavioral patterns ExamGuard has learned from your {model.sessionCount} practice sessions.
          These are <span className="text-indigo-400 font-medium">your personal expectations</span> — not averages from other students.
          During examinations, your behavior is compared against these values to detect genuine anomalies.
        </p>
      </div>

      {/* Summary metrics */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl bg-surface-800 border border-border p-4 text-center">
          <p className="text-2xl font-bold tabular-nums text-text-primary">{model.sessionCount}</p>
          <p className="text-xs text-text-muted mt-1">Training sessions</p>
        </div>
        <div className="rounded-xl bg-surface-800 border border-border p-4 text-center">
          <p className="text-2xl font-bold tabular-nums text-indigo-400">{model.confidence}%</p>
          <p className="text-xs text-text-muted mt-1">Model confidence</p>
          <ProgressBar value={model.confidence} color="indigo" size="xs" className="mt-2" />
        </div>
        <div className="rounded-xl bg-surface-800 border border-border p-4 text-center">
          <p className="text-2xl font-bold tabular-nums text-emerald-400">{model.expectations.length}</p>
          <p className="text-xs text-text-muted mt-1">Tracked features</p>
        </div>
      </div>

      {/* Feature cards */}
      <div>
        <h3 className="text-sm font-semibold text-text-primary mb-3">Behavioral Feature Expectations</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {model.expectations.map((exp) => {
            const unc = model.uncertainties.find((u) => u.feature === exp.feature);
            const confidence = Math.round((1 - (unc?.uncertainty ?? 0)) * 100);
            return (
              <div
                key={exp.feature}
                className="rounded-xl bg-surface-800 border border-border p-4 hover:border-border-strong transition-colors"
              >
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-indigo-400">{featureIcons[exp.feature]}</span>
                  <span className="text-xs font-semibold text-text-primary">{exp.label}</span>
                </div>

                <p className="text-xl font-bold text-text-primary tabular-nums mb-0.5">
                  {exp.feature === 'responseTime'
                    ? `${(exp.mean / 1000).toFixed(1)}s`
                    : exp.feature === 'pasteDetected'
                    ? `${exp.mean}%`
                    : exp.feature === 'pointerMovement' || exp.feature === 'scrollDistance'
                    ? `${(exp.mean / 1000).toFixed(1)}k px`
                    : exp.mean.toFixed(1)}
                </p>
                <p className="text-[10px] text-text-muted mb-3">
                  ± {exp.feature === 'responseTime'
                    ? `${(exp.stdDev / 1000).toFixed(1)}s`
                    : exp.stdDev.toFixed(1)} expected variation
                </p>

                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] text-text-muted">
                    <span>Model confidence</span>
                    <span>{confidence}%</span>
                  </div>
                  <ProgressBar value={confidence} colorThresholds={{ low: 70, high: 85 }} size="xs" />
                </div>

                <p className="text-[10px] text-text-muted mt-2 leading-snug">
                  {featureDescriptions[exp.feature]}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Charts row */}
      <div className="grid lg:grid-cols-2 gap-5">
        {/* Radar */}
        <ChartContainer
          title="Feature Confidence Radar"
          subtitle="How confident the model is in each behavioral feature"
          height={260}
        >
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={radarData}>
              <PolarGrid stroke="rgba(255,255,255,0.06)" />
              <PolarAngleAxis dataKey="feature" tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <Radar
                name="Confidence"
                dataKey="confidence"
                stroke="#6366f1"
                fill="#6366f1"
                fillOpacity={0.15}
                strokeWidth={2}
              />
            </RadarChart>
          </ResponsiveContainer>
        </ChartContainer>

        {/* Confidence over sessions */}
        <ChartContainer
          title="Model Confidence Growth"
          subtitle="Confidence improves as more sessions are added"
          height={260}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={sessionTrendData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
              <XAxis dataKey="sessions" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} label={{ value: 'Sessions', position: 'insideBottom', offset: -2, fill: '#64748b', fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="confidence" name="Confidence" radius={[4, 4, 0, 0]}>
                {sessionTrendData.map((entry, idx) => (
                  <Cell
                    key={idx}
                    fill={idx === sessionTrendData.length - 1 ? '#6366f1' : '#6366f1'}
                    fillOpacity={0.4 + (idx / sessionTrendData.length) * 0.6}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartContainer>
      </div>

      {/* How is this used? */}
      <Card header={<CardHeader title="How this profile is used during examinations" />} padding="md">
        <div className="grid sm:grid-cols-3 gap-4 text-xs">
          {[
            {
              icon: <Brain size={16} />,
              title: 'Baseline comparison',
              desc: 'Your exam behavior is compared against these expected values, not against other students.',
              color: 'text-indigo-400',
            },
            {
              icon: <TrendingUp size={16} />,
              title: 'Z-score deviation',
              desc: 'Each feature produces a deviation score: how many standard deviations away from your own mean.',
              color: 'text-sky-400',
            },
            {
              icon: <Info size={16} />,
              title: 'Human review only',
              desc: 'High deviation scores are flagged for instructor review — no automatic action is ever taken.',
              color: 'text-amber-400',
            },
          ].map((item, i) => (
            <div key={i} className="flex flex-col gap-2 p-3 rounded-lg bg-surface-700 border border-border">
              <span className={item.color}>{item.icon}</span>
              <p className="font-semibold text-text-primary">{item.title}</p>
              <p className="text-text-muted leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
