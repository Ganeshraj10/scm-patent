'use client';

import React from 'react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { TimelineEvent } from '@/lib/services/studentHistoryService';
import {
  Clock,
  BookOpen,
  ClipboardList,
  Monitor,
  Laptop,
  Smartphone,
  ChevronRight,
  Calendar,
} from 'lucide-react';

interface StudentTimelineProps {
  timeline: TimelineEvent[];
  onSelectSession?: (sessionId: string) => void;
}

export function StudentTimeline({ timeline, onSelectSession }: StudentTimelineProps) {
  if (!timeline || timeline.length === 0) {
    return (
      <Card padding="md">
        <p className="text-center text-text-muted text-xs">
          No historical timeline events found. Complete practice sessions to see your longitudinal activity.
        </p>
      </Card>
    );
  }

  const getDeviceIcon = (deviceType: string) => {
    switch (deviceType) {
      case 'mobile':
        return <Smartphone size={13} className="text-emerald-400" />;
      case 'web_laptop':
        return <Laptop size={13} className="text-sky-400" />;
      case 'web_desktop':
      default:
        return <Monitor size={13} className="text-indigo-400" />;
    }
  };

  return (
    <Card>
      <CardHeader
        title="Coursework Session Timeline"
        subtitle="Chronological longitudinal record of all completed sessions"
        badge={
          <Badge variant="normal">
            {timeline.length} Sessions Logged
          </Badge>
        }
      />
      <div className="relative pl-6 sm:pl-8 space-y-4 mt-4 before:absolute before:left-3 sm:before:left-4 before:top-2 before:bottom-2 before:w-0.5 before:bg-border">
        {timeline.map((event, idx) => {
          const isLowStakes = event.sessionType === 'low_stakes';
          return (
            <div key={event.sessionId} className="relative group">
              {/* Timeline node icon */}
              <div
                className={`absolute -left-6 sm:-left-8 top-1.5 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-transform group-hover:scale-110 ${
                  isLowStakes
                    ? 'bg-surface-900 border-sky-500 text-sky-400'
                    : 'bg-surface-900 border-indigo-500 text-indigo-400'
                }`}
              >
                {isLowStakes ? <BookOpen size={11} /> : <ClipboardList size={11} />}
              </div>

              {/* Event card */}
              <div
                onClick={() => onSelectSession && onSelectSession(event.sessionId)}
                className="p-3.5 rounded-xl bg-surface-700/30 hover:bg-surface-700/70 border border-border transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-xs text-text-primary">
                      {event.displayDate}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                        isLowStakes
                          ? 'bg-sky-500/15 text-sky-300 border-sky-500/30'
                          : 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30'
                      }`}
                    >
                      {event.typeLabel}
                    </span>
                    <span className="font-mono text-[11px] text-text-muted">
                      {event.sessionId}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-text-secondary flex-wrap">
                    <span className="flex items-center gap-1 text-text-muted text-[11px]">
                      <span>{event.questionCount} Questions</span>
                    </span>
                    <span className="text-text-muted">·</span>
                    <span className="text-[11px]">
                      Avg Response: <strong className="text-emerald-400 font-mono">{event.avgResponseTimeSec}s</strong>
                    </span>
                    <span className="text-text-muted">·</span>
                    <span className="text-[11px]">
                      Avg Revisions: <strong className="text-indigo-300 font-mono">{event.avgRevisions}</strong>
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3 justify-between sm:justify-end">
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-800 border border-border text-[11px] text-text-secondary">
                    {getDeviceIcon(event.deviceType)}
                    <span>{event.deviceLabel}</span>
                  </div>
                  <ChevronRight size={14} className="text-text-muted group-hover:text-text-primary group-hover:translate-x-0.5 transition-all" />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
