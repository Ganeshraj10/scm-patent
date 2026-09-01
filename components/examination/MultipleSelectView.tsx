'use client';

import React from 'react';
import { Question } from '@/types';
import { CheckSquare, Square } from 'lucide-react';

interface MultipleSelectViewProps {
  question: Question;
  selectedIndices: number[];
  onToggleOption: (index: number) => void;
}

export const MultipleSelectView: React.FC<MultipleSelectViewProps> = ({
  question,
  selectedIndices,
  onToggleOption,
}) => {
  const options = question.options || [];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">
          Select All Correct Options:
        </span>
        <span className="text-[11px] font-mono text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
          {selectedIndices.length} Selected
        </span>
      </div>

      <div className="space-y-2.5">
        {options.map((opt, idx) => {
          const isSelected = selectedIndices.includes(idx);
          const letter = String.fromCharCode(65 + idx);

          return (
            <div
              key={idx}
              onClick={() => onToggleOption(idx)}
              className={`p-4 rounded-xl border transition-all cursor-pointer flex items-center gap-3.5 group ${
                isSelected
                  ? 'bg-sky-600/15 border-sky-500 text-text-primary shadow-sm ring-1 ring-sky-500/30'
                  : 'bg-surface-700/40 border-border text-text-secondary hover:bg-surface-700/70 hover:border-border/80'
              }`}
            >
              <div className="shrink-0 text-sky-400">
                {isSelected ? (
                  <CheckSquare size={18} className="text-sky-400" />
                ) : (
                  <Square size={18} className="text-text-muted group-hover:text-text-secondary" />
                )}
              </div>
              <span className="w-5 font-mono font-bold text-xs text-text-muted">{letter}.</span>
              <span className="text-xs font-medium leading-relaxed">{opt}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
