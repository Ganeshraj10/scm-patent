'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  BookOpen,
  Code2,
  Bug,
  CheckSquare,
  FileText,
  Sliders,
  ShieldCheck,
  Zap,
  Activity,
  Layers,
  Search,
} from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import {
  validationExamQuestions,
  VALIDATION_EXAM_CODE,
  VALIDATION_EXAM_TITLE,
} from '@/data/validationExamQuestions';
import { Question, QuestionType } from '@/types';

export default function AdminExamsPage() {
  const [questions, setQuestions] = useState<Question[]>(validationExamQuestions);
  const [selectedType, setSelectedType] = useState<string>('all');
  const [search, setSearch] = useState<string>('');

  const filtered = questions.filter((q) => {
    const matchType = selectedType === 'all' || q.type === selectedType;
    const matchSearch =
      search === '' ||
      q.id.toLowerCase().includes(search.toLowerCase()) ||
      (q.title && q.title.toLowerCase().includes(search.toLowerCase())) ||
      q.topic.toLowerCase().includes(search.toLowerCase());
    return matchType && matchSearch;
  });

  const getTypeIcon = (type?: QuestionType) => {
    switch (type) {
      case 'multiple_select':
        return <CheckSquare size={13} className="text-sky-400" />;
      case 'short_answer':
        return <FileText size={13} className="text-amber-400" />;
      case 'coding':
        return <Code2 size={13} className="text-emerald-400" />;
      case 'debugging':
        return <Bug size={13} className="text-rose-400" />;
      default:
        return <BookOpen size={13} className="text-indigo-400" />;
    }
  };

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-text-primary">Assessment & Question Bank Management</h2>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              Stage 7 Administrator Control
            </span>
          </div>
          <p className="text-xs text-text-muted mt-0.5">
            Configure multi-format examinations, inspect difficulty covariates, and monitor feature-collection health.
          </p>
        </div>
      </div>

      {/* Telemetry Feature Health Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
        <div className="p-3.5 rounded-xl bg-surface-800 border border-border space-y-1">
          <div className="flex items-center justify-between text-text-muted text-[11px]">
            <span>Telemetry Extractor</span>
            <ShieldCheck size={14} className="text-emerald-400" />
          </div>
          <span className="text-sm font-bold text-emerald-400">Active & Hooked</span>
          <p className="text-[10px] text-text-muted">Real-time client DOM events</p>
        </div>

        <div className="p-3.5 rounded-xl bg-surface-800 border border-border space-y-1">
          <div className="flex items-center justify-between text-text-muted text-[11px]">
            <span>Paste Detection</span>
            <Activity size={14} className="text-indigo-400" />
          </div>
          <span className="text-sm font-bold text-text-primary">Content-Minimized</span>
          <p className="text-[10px] text-text-muted">Binary signal (0/1) only</p>
        </div>

        <div className="p-3.5 rounded-xl bg-surface-800 border border-border space-y-1">
          <div className="flex items-center justify-between text-text-muted text-[11px]">
            <span>Character Burst</span>
            <Zap size={14} className="text-amber-400" />
          </div>
          <span className="text-sm font-bold text-amber-400">&gt;35 chars / 250ms</span>
          <p className="text-[10px] text-text-muted">High-cadence input detection</p>
        </div>

        <div className="p-3.5 rounded-xl bg-surface-800 border border-border space-y-1">
          <div className="flex items-center justify-between text-text-muted text-[11px]">
            <span>Active Validation Exam</span>
            <Layers size={14} className="text-sky-400" />
          </div>
          <span className="text-sm font-bold text-sky-400">8 Multi-Type Qs</span>
          <p className="text-[10px] text-text-muted">{VALIDATION_EXAM_CODE}</p>
        </div>
      </div>

      {/* Filter and Search */}
      <Card padding="sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-2 py-1">
          <div className="relative flex-1 max-w-md">
            <Search size={14} className="absolute left-3 top-2.5 text-text-muted" />
            <input
              type="text"
              placeholder="Search questions by ID, title, or topic..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-surface-700 border border-border rounded-lg text-xs text-text-primary placeholder-text-muted focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-text-muted">Question Type:</span>
            <select
              aria-label="Filter Question Type"
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="bg-surface-700 border border-border text-text-primary text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-indigo-500"
            >
              <option value="all">All Types</option>
              <option value="mcq">MCQ</option>
              <option value="multiple_select">Multiple Select</option>
              <option value="short_answer">Short Answer</option>
              <option value="coding">Coding</option>
              <option value="debugging">Debugging</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Question Bank Table */}
      <Card>
        <CardHeader
          title="Validation Examination Question Inventory"
          subtitle={`Showing ${filtered.length} configured multi-format questions for ${VALIDATION_EXAM_TITLE}`}
          badge={<Badge variant="active">{filtered.length} Questions</Badge>}
        />
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-border bg-surface-700/40 text-text-muted text-[11px]">
                <th className="py-2.5 px-4 font-semibold">Question ID</th>
                <th className="py-2.5 px-3 font-semibold">Type</th>
                <th className="py-2.5 px-4 font-semibold">Title & Topic</th>
                <th className="py-2.5 px-3 font-semibold">Difficulty</th>
                <th className="py-2.5 px-3 font-semibold">Language / Format</th>
                <th className="py-2.5 px-3 font-semibold">Test Cases</th>
                <th className="py-2.5 px-4 font-semibold text-right">Telemetry Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40 text-text-secondary">
              {filtered.map((q) => (
                <tr key={q.id} className="hover:bg-surface-700/30 transition-colors">
                  <td className="py-3 px-4 font-mono font-bold text-sky-400">{q.id}</td>
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-1.5 text-text-primary text-[11px]">
                      {getTypeIcon(q.type)}
                      <span className="capitalize font-medium">{(q.type || 'mcq').replace('_', ' ')}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="space-y-0.5">
                      <span className="font-bold text-text-primary text-xs block">{q.title || q.text.substring(0, 45)}</span>
                      <span className="text-[11px] text-text-muted">{q.topic}</span>
                    </div>
                  </td>
                  <td className="py-3 px-3 font-mono font-bold text-indigo-300">
                    {q.difficulty.toFixed(2)}
                  </td>
                  <td className="py-3 px-3 font-mono text-[11px] text-text-muted">
                    {q.language ? <span className="capitalize text-emerald-400">{q.language}</span> : 'Standard'}
                  </td>
                  <td className="py-3 px-3 font-mono text-text-primary">
                    {q.testCases ? `${q.testCases.length} Cases` : 'N/A'}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                      Telemetry Hooked
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
