'use client';

import React, { useState, useMemo } from 'react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import {
  getStudentCourseworkSessions,
  getStudentCourseworkSummary,
} from '@/lib/services/studentHistoryService';
import { StudentSessionDetailModal } from '@/components/integrity/StudentSessionDetailModal';
import {
  BookOpen,
  ClipboardList,
  Search,
  Filter,
  Eye,
  Clock,
  Activity,
  Monitor,
  Laptop,
  Smartphone,
  ChevronRight,
} from 'lucide-react';

export default function StudentCourseworkPage() {
  const [studentId, setStudentId] = useState<string>('S001');
  const [sessionType, setSessionType] = useState<'all' | 'low_stakes' | 'graded'>('all');
  const [deviceType, setDeviceType] = useState<string>('all');
  const [search, setSearch] = useState<string>('');
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  const sessions = useMemo(() => {
    return getStudentCourseworkSessions(studentId, {
      sessionType,
      deviceType,
      search,
      sortOrder: 'newest_first',
    });
  }, [studentId, sessionType, deviceType, search]);

  const summary = useMemo(() => getStudentCourseworkSummary(studentId), [studentId]);

  const getDeviceIcon = (dev: string) => {
    switch (dev) {
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
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-text-primary">My Coursework & Practice</h2>
            <Badge variant="active" size="sm">
              Student ID: {studentId}
            </Badge>
          </div>
          <p className="text-xs text-text-muted mt-0.5">
            Your longitudinal practice coursework and examination sessions (exclusively your records)
          </p>
        </div>

        {/* Demo Switcher */}
        <div className="flex items-center gap-1.5 bg-surface-800 p-1.5 rounded-xl border border-border text-xs">
          <span className="text-[11px] text-text-muted px-2">Student:</span>
          {['S001', 'S002', 'S003', 'S004'].map((sId) => (
            <button
              key={sId}
              onClick={() => setStudentId(sId)}
              className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all ${
                studentId === sId
                  ? 'bg-sky-500 text-navy-950 shadow-md shadow-sky-500/30'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              {sId}
            </button>
          ))}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <Card padding="sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 px-2 py-1">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search size={14} className="absolute left-3 top-2.5 text-text-muted" />
            <input
              type="text"
              placeholder="Search by session ID or date..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-surface-700 border border-border rounded-lg text-xs text-text-primary placeholder-text-muted focus:outline-none focus:border-sky-500 transition-colors"
            />
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-text-muted">Type:</span>
              <select
                aria-label="Filter by Session Type"
                value={sessionType}
                onChange={(e) => setSessionType(e.target.value as any)}
                className="bg-surface-700 border border-border text-text-primary text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-sky-500"
              >
                <option value="all">All Session Types</option>
                <option value="low_stakes">Practice / Low-Stakes</option>
                <option value="graded">Graded Examination</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-text-muted">Device:</span>
              <select
                aria-label="Filter by Device"
                value={deviceType}
                onChange={(e) => setDeviceType(e.target.value)}
                className="bg-surface-700 border border-border text-text-primary text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-sky-500"
              >
                <option value="all">All Devices</option>
                <option value="web_desktop">Web Desktop</option>
                <option value="web_laptop">Web Laptop</option>
                <option value="mobile">Mobile Device</option>
              </select>
            </div>

            {(search || sessionType !== 'all' || deviceType !== 'all') && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearch('');
                  setSessionType('all');
                  setDeviceType('all');
                }}
                className="text-[11px] h-7 px-2 text-sky-400 hover:text-sky-300"
              >
                Reset
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Coursework Table */}
      <Card>
        <CardHeader
          title="Completed Coursework Sessions"
          subtitle={`Showing ${sessions.length} sessions for student ${studentId}`}
          badge={
            <Badge variant="normal">
              {summary?.lowStakesSessionsCount || 0} Practice · {summary?.gradedSessionsCount || 0} Graded
            </Badge>
          }
        />

        {sessions.length === 0 ? (
          <div className="p-8 text-center text-text-muted text-xs">
            No coursework sessions match the selected filters for student {studentId}.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border text-text-muted bg-surface-700/30">
                  <th className="py-2.5 px-4 font-semibold">Session ID</th>
                  <th className="py-2.5 px-3 font-semibold">Date</th>
                  <th className="py-2.5 px-3 font-semibold">Session Type</th>
                  <th className="py-2.5 px-3 font-semibold">Questions</th>
                  <th className="py-2.5 px-3 font-semibold">Avg Response</th>
                  <th className="py-2.5 px-3 font-semibold">Avg Revisions</th>
                  <th className="py-2.5 px-3 font-semibold">Device</th>
                  <th className="py-2.5 px-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {sessions.map((s) => {
                  const isLowStakes = s.sessionType === 'low_stakes';
                  return (
                    <tr
                      key={s.sessionId}
                      className="hover:bg-surface-700/40 transition-colors text-text-secondary"
                    >
                      <td className="py-3 px-4 font-mono font-bold text-text-primary text-xs">
                        {s.sessionId}
                      </td>
                      <td className="py-3 px-3 font-mono text-[11px] text-text-muted">{s.timestamp}</td>
                      <td className="py-3 px-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold border inline-flex items-center gap-1 ${
                            isLowStakes
                              ? 'bg-sky-500/15 text-sky-300 border-sky-500/30'
                              : 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30'
                          }`}
                        >
                          {isLowStakes ? (
                            <>
                              <BookOpen size={10} /> Practice / Low-Stakes
                            </>
                          ) : (
                            <>
                              <ClipboardList size={10} /> Graded Examination
                            </>
                          )}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-mono text-text-primary">{s.questionCount}</td>
                      <td className="py-3 px-3 font-mono text-emerald-400 font-bold">
                        {s.avgResponseTimeSec}s
                      </td>
                      <td className="py-3 px-3 font-mono text-indigo-300 font-bold">
                        {s.avgRevisionCount}
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1.5 text-text-muted text-[11px]">
                          {getDeviceIcon(s.deviceType)}
                          <span>{s.deviceType}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedSessionId(s.sessionId)}
                          className="h-7 px-2.5 text-xs text-sky-400 hover:text-sky-300"
                        >
                          <Eye size={12} className="mr-1" />
                          Inspect Questions
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Question Detail Modal */}
      <StudentSessionDetailModal
        studentId={studentId}
        sessionId={selectedSessionId}
        onClose={() => setSelectedSessionId(null)}
      />
    </div>
  );
}
