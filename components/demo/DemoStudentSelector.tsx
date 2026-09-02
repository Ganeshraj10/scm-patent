'use client';

import React from 'react';
import Link from 'next/link';
import {
  getDemoStudentProfiles,
  DemoStudentProfile,
} from '@/lib/services/demoStudentService';
import { Badge } from '@/components/ui/Badge';
import { Brain, UserCheck, AlertTriangle, Sparkles, ArrowRight } from 'lucide-react';

interface DemoStudentSelectorProps {
  selectedStudentId?: string;
  onSelectStudent?: (studentId: string) => void;
  showNavigationLinks?: boolean;
}

export function DemoStudentSelector({
  selectedStudentId = 'S001',
  onSelectStudent,
  showNavigationLinks = false,
}: DemoStudentSelectorProps) {
  const profiles = getDemoStudentProfiles();

  const getMaturityColor = (maturity: string) => {
    switch (maturity) {
      case 'established':
        return 'border-emerald-500/40 text-emerald-400 bg-emerald-500/10';
      case 'developing':
        return 'border-amber-500/40 text-amber-400 bg-amber-500/10';
      case 'cold_start':
      default:
        return 'border-rose-500/40 text-rose-400 bg-rose-500/10';
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Brain size={16} className="text-indigo-400" />
          <span className="text-xs font-bold text-text-primary uppercase tracking-wider">
            Prototype Demo Student Profiles
          </span>
        </div>
        <span className="text-[11px] text-text-muted">
          Select a student to demonstrate different historical model maturity states
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {profiles.map((p) => {
          const isSelected = p.id === selectedStudentId;
          const maturityColor = getMaturityColor(p.modelMaturity);

          const cardContent = (
            <div
              className={`p-3.5 rounded-2xl border transition-all cursor-pointer text-left space-y-2.5 ${
                isSelected
                  ? 'bg-surface-800 border-indigo-500 ring-2 ring-indigo-500/30 shadow-lg shadow-indigo-500/10 scale-[1.02]'
                  : 'bg-surface-800/80 border-border hover:border-border-strong hover:bg-surface-800'
              }`}
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-1.5">
                <div>
                  <span className="text-[10px] font-mono font-bold text-sky-400 uppercase block">
                    {p.profileKey.replace('_', ' ')} · {p.id}
                  </span>
                  <span className="text-xs font-bold text-text-primary block">
                    {p.name}
                  </span>
                </div>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${maturityColor}`}
                >
                  {p.modelMaturity.replace('_', ' ')}
                </span>
              </div>

              {/* Behavioral Characteristics */}
              <div className="p-2 rounded-xl bg-surface-900/70 border border-border/60 text-[11px] space-y-1 font-mono">
                <div className="flex justify-between text-text-muted">
                  <span>Low-Stakes:</span>
                  <strong className="text-text-primary font-bold">{p.lowStakesSessionCount} Sessions</strong>
                </div>
                <div className="flex justify-between text-text-muted">
                  <span>Avg Response:</span>
                  <strong className="text-emerald-400 font-bold">{p.characteristics.avgResponseTimeSec}s</strong>
                </div>
                <div className="flex justify-between text-text-muted">
                  <span>Avg Revisions:</span>
                  <strong className="text-indigo-300 font-bold">{p.characteristics.avgRevisions}</strong>
                </div>
              </div>

              {/* Explanatory note */}
              <p className="text-[10px] text-text-muted leading-tight line-clamp-2">
                {p.demoExplanation}
              </p>
            </div>
          );

          if (showNavigationLinks) {
            return (
              <Link key={p.id} href={`/instructor/students/${p.id}`} className="block">
                {cardContent}
              </Link>
            );
          }

          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onSelectStudent && onSelectStudent(p.id)}
              className="w-full text-left"
            >
              {cardContent}
            </button>
          );
        })}
      </div>
    </div>
  );
}
