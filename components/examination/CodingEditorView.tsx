'use client';

import React, { useState } from 'react';
import { Question, QuestionTestCase } from '@/types';
import { executeCodeAgainstTestCases, CodeRunSummary } from '@/lib/services/codeRunner';
import { Button } from '@/components/ui/Button';
import {
  Play,
  RotateCcw,
  Trash2,
  CheckCircle2,
  XCircle,
  Code2,
  Bug,
  Terminal,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface CodingEditorViewProps {
  question: Question;
  codeAnswer: string;
  onCodeChange: (newCode: string) => void;
  onPaste: () => void;
  onCodeRun: (passed: number, total: number) => void;
}

export const CodingEditorView: React.FC<CodingEditorViewProps> = ({
  question,
  codeAnswer,
  onCodeChange,
  onPaste,
  onCodeRun,
}) => {
  const [language, setLanguage] = useState<'python' | 'javascript'>(
    (question.language as 'python' | 'javascript') || 'python'
  );
  const [isRunning, setIsRunning] = useState(false);
  const [runSummary, setRunSummary] = useState<CodeRunSummary | null>(null);
  const [showConsole, setShowConsole] = useState(true);

  const starterCode = question.starterCode || '# Write your code here\n';
  const currentCode = codeAnswer !== undefined && codeAnswer !== '' ? codeAnswer : starterCode;
  const testCases: QuestionTestCase[] = question.testCases || [];

  // Line numbers calculation
  const lineCount = Math.max(12, currentCode.split('\n').length);
  const lineNumbers = Array.from({ length: lineCount }, (_, i) => i + 1);

  const handleRunCode = () => {
    setIsRunning(true);
    setTimeout(() => {
      const summary = executeCodeAgainstTestCases(currentCode, testCases, language);
      setRunSummary(summary);
      setIsRunning(false);
      setShowConsole(true);
      onCodeRun(summary.passedTests, summary.totalTests);
    }, 150);
  };

  const handleResetCode = () => {
    onCodeChange(starterCode);
    setRunSummary(null);
  };

  const handleClearCode = () => {
    onCodeChange('');
    setRunSummary(null);
  };

  return (
    <div className="space-y-4">
      {/* Problem Specification & Constraints */}
      {question.description && (
        <div className="p-4 rounded-xl bg-surface-700/30 border border-border/80 text-xs text-text-secondary leading-relaxed space-y-3">
          <div className="flex items-center gap-2 font-bold text-text-primary text-xs uppercase tracking-wider">
            {question.type === 'debugging' ? (
              <Bug size={14} className="text-amber-400" />
            ) : (
              <Code2 size={14} className="text-sky-400" />
            )}
            <span>{question.type === 'debugging' ? 'Debugging Specification' : 'Problem Specification'}</span>
          </div>
          <div className="whitespace-pre-line font-sans text-xs">{question.description}</div>
        </div>
      )}

      {/* Code Editor Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface-800 p-3 rounded-xl border border-border">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-text-muted">Language:</span>
          <select
            aria-label="Programming Language"
            value={language}
            onChange={(e) => setLanguage(e.target.value as 'python' | 'javascript')}
            className="bg-surface-700 border border-border text-text-primary text-xs rounded-lg px-2.5 py-1 font-mono focus:outline-none focus:border-indigo-500"
          >
            <option value="python">Python 3</option>
            <option value="javascript">JavaScript (ES6)</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleResetCode}
            className="text-xs h-8 text-text-muted hover:text-text-primary"
            title="Reset code to original starter template"
          >
            <RotateCcw size={13} className="mr-1.5" />
            Reset
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearCode}
            className="text-xs h-8 text-rose-400/80 hover:text-rose-300"
            title="Clear all code"
          >
            <Trash2 size={13} className="mr-1.5" />
            Clear
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={handleRunCode}
            disabled={isRunning}
            className="text-xs h-8 bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-900/30 px-3.5 font-bold"
          >
            <Play size={13} className="mr-1.5 fill-current" />
            {isRunning ? 'Running...' : 'Run Code'}
          </Button>
        </div>
      </div>

      {/* Code Editor Body */}
      <div className="relative rounded-xl border border-border bg-surface-950 font-mono text-xs overflow-hidden shadow-2xl flex">
        {/* Line Numbers Gutter */}
        <div className="select-none py-4 px-3 text-right bg-surface-900/70 border-r border-border/50 text-text-muted/40 font-mono text-[11px] leading-5 shrink-0">
          {lineNumbers.map((num) => (
            <div key={num}>{num}</div>
          ))}
        </div>

        {/* Textarea Code Input */}
        <textarea
          aria-label="Code Editor"
          value={currentCode}
          onChange={(e) => onCodeChange(e.target.value)}
          onPaste={onPaste}
          rows={lineCount}
          spellCheck={false}
          className="flex-1 p-4 bg-transparent text-emerald-300/90 font-mono text-xs leading-5 resize-none focus:outline-none focus:ring-0 placeholder-text-muted/40 selection:bg-indigo-600/40"
          placeholder="# Write or paste your algorithm solution here..."
        />
      </div>

      {/* Test Execution & Output Console */}
      {testCases.length > 0 && (
        <div className="rounded-xl border border-border bg-surface-850 overflow-hidden shadow-lg">
          <div
            onClick={() => setShowConsole(!showConsole)}
            className="p-3 bg-surface-800 border-b border-border flex items-center justify-between cursor-pointer hover:bg-surface-750 transition-colors"
          >
            <div className="flex items-center gap-2 text-xs font-bold text-text-primary">
              <Terminal size={14} className="text-sky-400" />
              <span>Test Cases & Execution Console</span>
              {runSummary && (
                <span
                  className={`ml-2 px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                    runSummary.allPassed
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                  }`}
                >
                  {runSummary.passedTests} / {runSummary.totalTests} Passed
                </span>
              )}
            </div>
            <button type="button" className="text-text-muted hover:text-text-primary">
              {showConsole ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          </div>

          {showConsole && (
            <div className="p-4 space-y-3 text-xs font-mono">
              {runSummary ? (
                <div className="space-y-3">
                  {runSummary.results.map((r, idx) => (
                    <div
                      key={r.id || idx}
                      className={`p-3 rounded-lg border text-[11px] space-y-1.5 ${
                        r.passed
                          ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300'
                          : 'bg-rose-950/20 border-rose-500/30 text-rose-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 font-bold">
                          {r.passed ? (
                            <CheckCircle2 size={13} className="text-emerald-400" />
                          ) : (
                            <XCircle size={13} className="text-rose-400" />
                          )}
                          <span>Test Case {idx + 1} {r.description && `(${r.description})`}</span>
                        </div>
                        <span className="text-[10px] text-text-muted">{r.executionTimeMs} ms</span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-[10px]">
                        <div className="p-2 rounded bg-surface-900 border border-border/60">
                          <span className="text-text-muted block">Input:</span>
                          <span className="text-text-primary font-bold">{r.input}</span>
                        </div>
                        <div className="p-2 rounded bg-surface-900 border border-border/60">
                          <span className="text-text-muted block">Expected Output:</span>
                          <span className="text-text-primary font-bold">{r.expectedOutput}</span>
                        </div>
                      </div>

                      <div className="p-2 rounded bg-surface-900 border border-border/60 text-[10px]">
                        <span className="text-text-muted block">Actual Output:</span>
                        <span className={r.passed ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                          {r.actualOutput}
                        </span>
                        {r.error && <span className="text-rose-400 block mt-0.5 font-sans">Error: {r.error}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  <span className="text-text-muted text-[11px] block">Test cases to be verified:</span>
                  {testCases.map((tc, idx) => (
                    <div key={tc.id || idx} className="p-2.5 rounded-lg bg-surface-800 border border-border text-[11px] space-y-1">
                      <div className="flex justify-between text-text-muted text-[10px]">
                        <span>Test Case {idx + 1}: {tc.description}</span>
                        <span>Pending Run</span>
                      </div>
                      <div className="flex gap-4 text-[10px]">
                        <span>Input: <strong className="text-text-primary font-mono">{tc.input}</strong></span>
                        <span>Expected: <strong className="text-emerald-400 font-mono">{tc.expectedOutput}</strong></span>
                      </div>
                    </div>
                  ))}
                  <p className="text-[10px] text-text-muted pt-1">
                    Click <strong>Run Code</strong> to execute your solution against all test cases.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
