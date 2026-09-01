'use client';

import { AlertCircle, Brain, Sparkles, Info } from 'lucide-react';

interface ColdStartStatusProps {
  sessionCount: number;
  minimumRequired?: number;
  confidence?: number;
  studentId?: string;
}

export function ColdStartStatus({
  sessionCount,
  minimumRequired = 3,
  confidence = 35,
  studentId,
}: ColdStartStatusProps) {
  const isColdStart = sessionCount < minimumRequired;

  if (!isColdStart) {
    return (
      <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-medium">
        <Sparkles size={14} className="text-emerald-400 flex-shrink-0" />
        <span>
          Personalized baseline active ({sessionCount} historical practice sessions, {confidence}% model confidence).
        </span>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-amber-500/10 border border-amber-500/25 p-4 text-amber-200">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400 flex-shrink-0 mt-0.5">
          <AlertCircle size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="text-sm font-semibold text-amber-300">
              Insufficient History · Cold-Start Baseline
            </h4>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 border border-amber-500/30 text-amber-300">
              {sessionCount} / {minimumRequired} low-stakes sessions
            </span>
          </div>
          <p className="text-xs text-amber-200/90 mt-1.5 leading-relaxed">
            {studentId ? `Student ${studentId}` : 'This student'} has completed fewer than {minimumRequired} low-stakes practice sessions.
            The personalized behavioral model is currently immature ({confidence}% confidence).
          </p>
          <div className="flex items-center gap-1.5 mt-2.5 text-[11px] text-amber-300/80">
            <Info size={12} />
            <span>High-risk flags are automatically attenuated to avoid premature mischaracterization.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
