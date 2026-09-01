'use client';

import React from 'react';
import { Question } from '@/types';

interface MCQViewProps {
  question: Question;
  selectedIndex: number | null;
  onSelectOption: (index: number) => void;
}

export const MCQView: React.FC<MCQViewProps> = ({
  question,
  selectedIndex,
  onSelectOption,
}) => {
  const options = question.options || [];

  return (
    <div className="space-y-3">
      <div className="text-xs font-semibold text-text-muted uppercase tracking-wider">
        Select One Option:
      </div>
      <div className="space-y-2.5">
        {options.map((opt, idx) => {
          const isSelected = selectedIndex === idx;
          const letter = String.fromCharCode(65 + idx);

          return (
            <div
              key={idx}
              onClick={() => onSelectOption(idx)}
              className={`p-4 rounded-xl border transition-all cursor-pointer flex items-center gap-3.5 group ${
                isSelected
                  ? 'bg-indigo-600/15 border-indigo-500 text-text-primary shadow-sm ring-1 ring-indigo-500/30'
                  : 'bg-surface-700/40 border-border text-text-secondary hover:bg-surface-700/70 hover:border-border/80'
              }`}
            >
              <div
                className={`w-6 h-6 rounded-full border flex items-center justify-center text-xs font-bold shrink-0 transition-colors ${
                  isSelected
                    ? 'border-indigo-500 bg-indigo-600 text-white shadow-sm'
                    : 'border-border text-text-muted group-hover:border-text-secondary'
                }`}
              >
                {letter}
              </div>
              <span className="text-xs font-medium leading-relaxed">{opt}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
