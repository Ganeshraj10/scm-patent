'use client';

import React from 'react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { TimeOfDayStat } from '@/lib/services/studentHistoryService';
import { Sun, Sunrise, Sunset, Moon } from 'lucide-react';

interface StudentTimeOfDayProps {
  stats: TimeOfDayStat[];
}

export function StudentTimeOfDay({ stats }: StudentTimeOfDayProps) {
  if (!stats || stats.length === 0) {
    return (
      <Card padding="md">
        <p className="text-center text-text-muted text-xs">
          No time-of-day records found.
        </p>
      </Card>
    );
  }

  const getPeriodIcon = (period: string) => {
    switch (period) {
      case 'Morning':
        return <Sunrise size={15} className="text-amber-400" />;
      case 'Afternoon':
        return <Sun size={15} className="text-sky-400" />;
      case 'Evening':
        return <Sunset size={15} className="text-indigo-400" />;
      case 'Night':
      default:
        return <Moon size={15} className="text-purple-400" />;
    }
  };

  return (
    <Card>
      <CardHeader
        title="Time-of-Day Activity"
        subtitle="Distribution of your interaction sessions across diurnal periods"
        badge={<Badge variant="active">Diurnal Breakdown</Badge>}
      />
      <div className="grid grid-cols-2 gap-3 mt-3">
        {stats.map((s) => (
          <div
            key={s.period}
            className="p-3 rounded-xl bg-surface-700/30 border border-border space-y-2"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-surface-800 border border-border">
                  {getPeriodIcon(s.period)}
                </div>
                <div>
                  <span className="text-xs font-bold text-text-primary block">
                    {s.period}
                  </span>
                  <span className="text-[10px] text-text-muted font-mono">
                    {s.timeRange}
                  </span>
                </div>
              </div>
              <span className="text-xs font-bold text-text-primary font-mono">
                {s.percentage}%
              </span>
            </div>

            <div className="flex items-center justify-between text-[11px] text-text-muted">
              <span>{s.sessionCount} sessions</span>
              <span>{s.questionCount} questions</span>
            </div>

            {/* Progress bar */}
            <div className="w-full bg-surface-800 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-emerald-500 h-1.5 rounded-full transition-all duration-500"
                style={{ width: `${s.percentage}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
