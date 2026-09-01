'use client';

import React from 'react';
import { Question } from '@/types';
import { FileText, Sparkles } from 'lucide-react';

interface ShortAnswerViewProps {
  question: Question;
  textAnswer: string;
  onChange: (value: string) => void;
  onPaste: () => void;
}

export const ShortAnswerView: React.FC<ShortAnswerViewProps> = ({
  question,
  textAnswer,
  onChange,
  onPaste,
}) => {
  const wordCount = textAnswer.trim() ? textAnswer.trim().split(/\s+/).length : 0;
  const charCount = textAnswer.length;
  const minWords = question.minWordCount || 10;

  return (
    <div className="space-y-4">
      {/* Problem Description & Context */}
      {question.description && (
        <div className="p-4 rounded-xl bg-surface-700/30 border border-border/80 text-xs text-text-secondary leading-relaxed whitespace-pre-line">
          {question.description}
        </div>
      )}

      {/* Answer Input Section */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <label htmlFor="short-answer-input" className="font-semibold text-text-muted uppercase tracking-wider flex items-center gap-1.5">
            <FileText size={13} className="text-sky-400" />
            Your Answer Explanation
          </label>
          <div className="flex items-center gap-3 text-[11px] font-mono">
            <span className={wordCount < minWords ? 'text-amber-400' : 'text-emerald-400 font-bold'}>
              {wordCount} Words {wordCount < minWords && `(Suggested: ${minWords}+)`}
            </span>
            <span className="text-text-muted">·</span>
            <span className="text-text-muted">{charCount} Characters</span>
          </div>
        </div>

        <textarea
          id="short-answer-input"
          value={textAnswer}
          onChange={(e) => onChange(e.target.value)}
          onPaste={onPaste}
          rows={6}
          placeholder="Type your structured explanation here. Focus on precise algorithmic reasoning..."
          className="w-full p-4 rounded-xl bg-surface-800 border border-border text-xs text-text-primary placeholder-text-muted/60 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 leading-relaxed font-sans transition-all resize-y shadow-inner"
        />
      </div>
    </div>
  );
};
