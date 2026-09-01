'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { Filter, ArrowRight, Monitor, Smartphone, Laptop, Eye, Search, Layers, Clock, Activity } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { getAllGradedExamSessions } from '@/lib/services/examSessionService';
import { GradedExamSession } from '@/types';

export default function SessionsPage() {
  const [sessions, setSessions] = useState<GradedExamSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deviceFilter, setDeviceFilter] = useState('all');

  useEffect(() => {
    const data = getAllGradedExamSessions();
    setSessions(data);
    setLoading(false);
  }, []);

  const filtered = useMemo(() => {
    return sessions.filter((s) => {
      const matchSearch =
        search === '' ||
        s.sessionId.toLowerCase().includes(search.toLowerCase()) ||
        s.studentId.toLowerCase().includes(search.toLowerCase()) ||
        s.examTitle.toLowerCase().includes(search.toLowerCase());
      const matchDevice = deviceFilter === 'all' || s.deviceType === deviceFilter;
      return matchSearch && matchDevice;
    });
  }, [sessions, search, deviceFilter]);

  const getDeviceIcon = (dev: string) => {
    if (dev === 'mobile') return <Smartphone size={13} className="text-emerald-400" />;
    if (dev === 'web_laptop') return <Laptop size={13} className="text-sky-400" />;
    return <Monitor size={13} className="text-indigo-400" />;
  };

  return (
    <div className="space-y-5 max-w-7xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-text-primary">Graded Examination Sessions</h2>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              Stage 7 · Multi-Format Telemetry
            </span>
          </div>
          <p className="text-xs text-text-muted mt-0.5">
            {sessions.length} graded examination sessions recorded across students and live prototype test runs
          </p>
        </div>

        <Link href="/instructor/validation">
          <Button variant="secondary" size="sm" className="text-xs font-semibold">
            Open Behavior Validation Mode
            <ArrowRight size={13} className="ml-1.5" />
          </Button>
        </Link>
      </div>

      {/* Filter and Search */}
      <Card padding="sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-2 py-1">
          <div className="relative flex-1 max-w-md">
            <Search size={14} className="absolute left-3 top-2.5 text-text-muted" />
            <input
              type="text"
              placeholder="Search by session ID, student ID, or title..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-surface-700 border border-border rounded-lg text-xs text-text-primary placeholder-text-muted focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-text-muted">Device:</span>
            <select
              aria-label="Filter by Device"
              value={deviceFilter}
              onChange={(e) => setDeviceFilter(e.target.value)}
              className="bg-surface-700 border border-border text-text-primary text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-indigo-500"
            >
              <option value="all">All Devices</option>
              <option value="web_desktop">Web Desktop</option>
              <option value="web_laptop">Web Laptop</option>
              <option value="mobile">Mobile</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Sessions List */}
      <Card>
        <CardHeader
          title="Recorded Examination Sessions"
          subtitle={`Showing ${filtered.length} completed examination sessions`}
          badge={<Badge variant="active">{filtered.length} Sessions Available</Badge>}
        />
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-border bg-surface-700/30 text-text-muted text-[11px]">
                <th className="py-2.5 px-4 font-semibold">Session ID</th>
                <th className="py-2.5 px-3 font-semibold">Student ID</th>
                <th className="py-2.5 px-3 font-semibold">Date & Time</th>
                <th className="py-2.5 px-3 font-semibold">Questions</th>
                <th className="py-2.5 px-3 font-semibold">Avg Response</th>
                <th className="py-2.5 px-3 font-semibold">Avg Revisions</th>
                <th className="py-2.5 px-3 font-semibold">Device</th>
                <th className="py-2.5 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50 text-text-secondary">
              {filtered.map((s) => (
                <tr key={s.sessionId} className="hover:bg-surface-700/40 transition-colors">
                  <td className="py-3 px-4 font-mono font-bold text-text-primary text-xs">
                    {s.sessionId}
                  </td>
                  <td className="py-3 px-3">
                    <span className="font-mono text-sky-400 font-bold px-1.5 py-0.5 rounded bg-surface-700 border border-sky-500/20">
                      {s.studentId}
                    </span>
                  </td>
                  <td className="py-3 px-3 font-mono text-[11px] text-text-muted">
                    {s.startedAt}
                  </td>
                  <td className="py-3 px-3 font-mono text-text-primary">
                    {s.completedQuestionsCount} / {s.questionCount}
                  </td>
                  <td className="py-3 px-3 font-mono text-emerald-400 font-bold">
                    {s.avgResponseTimeSec || 0}s
                  </td>
                  <td className="py-3 px-3 font-mono text-indigo-300 font-bold">
                    {s.avgRevisionCount || 0}
                  </td>
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-1.5 text-text-muted text-[11px]">
                      {getDeviceIcon(s.deviceType)}
                      <span className="capitalize">{s.deviceType.replace('_', ' ')}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <Link href={`/instructor/sessions/${s.sessionId}`}>
                      <Button variant="secondary" size="sm" className="h-7 px-2.5 text-xs">
                        <Eye size={12} className="mr-1" />
                        Inspect Telemetry
                      </Button>
                    </Link>
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
