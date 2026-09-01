'use client';

import {
  AlertTriangle,
  CheckCircle,
  HelpCircle,
  Info,
  Shield,
  Clock,
  RotateCcw,
  MousePointer,
  ArrowDown,
  ClipboardX,
  Zap,
  Smartphone,
} from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { RiskReportData } from '@/lib/services/riskExplanation';

interface RiskReportProps {
  report: RiskReportData;
  showCardWrapper?: boolean;
}

const featureIcons: Record<string, React.ReactNode> = {
  'Response Time': <Clock size={15} className="text-indigo-400" />,
  'Answer Revisions': <RotateCcw size={15} className="text-amber-400" />,
  'Pointer Speed': <Zap size={15} className="text-cyan-400" />,
  'Pointer Distance': <MousePointer size={15} className="text-sky-400" />,
  'Scroll Activity': <ArrowDown size={15} className="text-emerald-400" />,
  'Paste Detection': <ClipboardX size={15} className="text-rose-400" />,
  'Character Burst': <Zap size={15} className="text-pink-400" />,
  'Device Usage': <Smartphone size={15} className="text-violet-400" />,
};

export function RiskReport({ report, showCardWrapper = true }: RiskReportProps) {
  const riskBadgeVariant =
    report.riskLevel === 'High'
      ? 'high'
      : report.riskLevel === 'Medium'
      ? 'medium'
      : 'low';

  const content = (
    <div className="space-y-6">
      {/* High-level status banner */}
      <div
        className={`p-4 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-4 ${
          report.riskLevel === 'High'
            ? 'bg-rose-500/10 border-rose-500/30 text-rose-200'
            : report.riskLevel === 'Medium'
            ? 'bg-amber-500/10 border-amber-500/30 text-amber-200'
            : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
        }`}
      >
        <div className="flex items-start gap-3">
          <div
            className={`p-2 rounded-lg flex-shrink-0 mt-0.5 ${
              report.riskLevel === 'High'
                ? 'bg-rose-500/20 text-rose-400'
                : report.riskLevel === 'Medium'
                ? 'bg-amber-500/20 text-amber-400'
                : 'bg-emerald-500/20 text-emerald-400'
            }`}
          >
            {report.riskLevel === 'High' ? (
              <AlertTriangle size={20} />
            ) : report.riskLevel === 'Medium' ? (
              <HelpCircle size={20} />
            ) : (
              <CheckCircle size={20} />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-sm font-semibold text-text-primary">
                {report.statusLabel}
              </h4>
              <Badge variant={riskBadgeVariant}>
                Risk Score: {report.riskScore}/100 · {report.riskLevel}
              </Badge>
            </div>
            <p className="text-xs text-text-secondary mt-1 leading-relaxed">
              {report.summaryText}
            </p>
          </div>
        </div>

        <div className="flex md:flex-col items-end justify-between md:justify-center border-t md:border-t-0 md:border-l border-border/50 pt-2 md:pt-0 md:pl-4">
          <span className="text-[11px] text-text-muted">Anomaly Magnitude</span>
          <span className="text-xl font-bold tabular-nums text-text-primary">
            {report.riskScore}<span className="text-xs text-text-muted font-normal">/100</span>
          </span>
        </div>
      </div>

      {/* Natural language explanation bullets */}
      {report.bullets.length > 0 && (
        <div className="space-y-2">
          <h5 className="text-xs font-semibold text-text-muted uppercase tracking-wider">
            Behavioral Observations & Telemetry Evidence
          </h5>
          <div className="grid gap-2">
            {report.bullets.map((b, i) => (
              <div
                key={i}
                className={`p-3 rounded-lg border text-xs flex items-start gap-3 ${
                  b.severity === 'critical'
                    ? 'bg-rose-500/10 border-rose-500/20 text-rose-300'
                    : b.severity === 'warning'
                    ? 'bg-amber-500/10 border-amber-500/20 text-amber-300'
                    : 'bg-indigo-500/10 border-indigo-500/20 text-indigo-300'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-text-primary">{b.title}</span>
                    {b.contributionPct > 0 && (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface-800/60 border border-border text-text-muted">
                        Weight: {b.contributionPct}%
                      </span>
                    )}
                  </div>
                  <p className="text-text-secondary mt-0.5 leading-relaxed">{b.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Explainable Risk Report Table */}
      <div>
        <h5 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
          Feature Residual Breakdown (Expected vs. Observed)
        </h5>
        <div className="rounded-xl bg-surface-800 border border-border overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-surface-700/60 text-text-muted border-b border-border font-medium">
                <tr>
                  <th className="py-2.5 px-3.5">Feature</th>
                  <th className="py-2.5 px-3.5">Expected (Baseline)</th>
                  <th className="py-2.5 px-3.5">Observed (Exam)</th>
                  <th className="py-2.5 px-3.5">Deviation</th>
                  <th className="py-2.5 px-3.5">Contribution</th>
                  <th className="py-2.5 px-3.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {report.tableRows.map((row, idx) => (
                  <tr key={idx} className="hover:bg-surface-700/30 transition-colors">
                    <td className="py-2.5 px-3.5 font-medium text-text-primary flex items-center gap-2">
                      {featureIcons[row.feature] || <Zap size={14} className="text-text-muted" />}
                      <span>{row.feature}</span>
                    </td>
                    <td className="py-2.5 px-3.5 text-text-secondary font-mono">{row.expected}</td>
                    <td className="py-2.5 px-3.5 text-text-primary font-mono font-semibold">{row.observed}</td>
                    <td className="py-2.5 px-3.5 font-mono text-indigo-400">{row.deviation}</td>
                    <td className="py-2.5 px-3.5 font-mono text-text-muted">{row.contribution}</td>
                    <td className="py-2.5 px-3.5">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                          row.status === 'Detected' || row.status === 'Review'
                            ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                            : row.status === 'Unusual'
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                            : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        }`}
                      >
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Mandatory Disclaimer */}
      <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-lg bg-surface-800/80 border border-border/80 text-[11px] text-text-muted">
        <Info size={13} className="text-indigo-400 flex-shrink-0" />
        <span>{report.disclaimer}</span>
      </div>
    </div>
  );

  if (!showCardWrapper) return content;

  return (
    <Card>
      <CardHeader
        title="Explainable Risk Report"
        subtitle={`Longitudinal behavioral comparison for session ${report.sessionId} (${report.studentId})`}
        badge={
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
            Prototype / Synthetic Dataset
          </span>
        }
      />
      <div className="mt-4">{content}</div>
    </Card>
  );
}
