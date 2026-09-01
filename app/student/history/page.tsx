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
  BarChart3,
  Search,
  ArrowUpDown,
  Filter,
  Eye,
  Clock,
  Activity,
  MousePointer2,
  Scroll,
  BookOpen,
  ClipboardList,
  Monitor,
  Laptop,
  Smartphone,
  Calendar,
} from 'lucide-react';

export default function StudentHistoryPage() {
  const [studentId, setStudentId] = useState<string>('S001');
  const [sortOrder, setSortOrder] = useState<'newest_first' | 'oldest_first'>('newest_first');
  const [sessionType, setSessionType] = useState<'all' | 'low_stakes' | 'graded'>('all');
  const [deviceType, setDeviceType] = useState<string>('all');
  const [search, setSearch] = useState<string>('');
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  const sessions = useMemo(() => {
    return getStudentCourseworkSessions(studentId, {
      sortOrder,
      sessionType,
      deviceType,
      search,
    });
  }, [studentId, sortOrder, sessionType, deviceType, search]);

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
            <h2 className="text-xl font-bold text-text-primary">Longitudinal Session History</h2>
            <Badge variant="active" size="sm">
              Student: {studentId}
            </Badge>
          </div>
          <p className="text-xs text-text-muted mt-0.5">
            Chronological audit log of all completed practice and examination interactions
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

      {/* Filter and Sorting Controls */}
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

          {/* Sort & Filter Selectors */}
          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Sort Order */}
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-text-muted">Sort:</span>
              <select
                aria-label="Sort Order"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as any)}
                className="bg-surface-700 border border-border text-text-primary text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-sky-500"
              >
                <option value="newest_first">Newest First</option>
                <option value="oldest_first">Oldest First</option>
              </select>
            </div>

            {/* Type */}
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-text-muted">Type:</span>
              <select
                aria-label="Filter by Session Type"
                value={sessionType}
                onChange={(e) => setSessionType(e.target.value as any)}
                className="bg-surface-700 border border-border text-text-primary text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-sky-500"
              >
                <option value="all">All Sessions</option>
                <option value="low_stakes">Practice Only</option>
                <option value="graded">Exams Only</option>
              </select>
            </div>

            {/* Device */}
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

            {(search || sessionType !== 'all' || deviceType !== 'all' || sortOrder !== 'newest_first') && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearch('');
                  setSessionType('all');
                  setDeviceType('all');
                  setSortOrder('newest_first');
                }}
                className="text-[11px] h-7 px-2 text-sky-400 hover:text-sky-300"
              >
                Reset
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* History Session Cards Grid */}
      <div className="space-y-3">
        {sessions.map((s) => {
          const isLowStakes = s.sessionType === 'low_stakes';
          return (
            <Card key={s.sessionId} padding="sm" className="hover:border-sky-500/30 transition-all">
              <div className="p-3 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                {/* Left meta */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="font-bold text-sm text-text-primary font-mono">
                      {s.sessionId}
                    </span>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border inline-flex items-center gap-1 ${
                        isLowStakes
                          ? 'bg-sky-500/15 text-sky-300 border-sky-500/30'
                          : 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30'
                      }`}
                    >
                      {isLowStakes ? <BookOpen size={10} /> : <ClipboardList size={10} />}
                      {isLowStakes ? 'Practice / Low-Stakes' : 'Graded Examination'}
                    </span>
                    <span className="text-xs text-text-muted font-mono">{s.timestamp}</span>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-text-muted">
                    <span>{s.questionCount} Questions Answered</span>
                    <span>·</span>
                    <div className="flex items-center gap-1">
                      {getDeviceIcon(s.deviceType)}
                      <span className="capitalize">{s.deviceType.replace('_', ' ')}</span>
                    </div>
                  </div>
                </div>

                {/* Right Metrics Grid */}
                <div className="flex items-center gap-6 justify-between lg:justify-end border-t lg:border-t-0 pt-2 lg:pt-0 border-border/50">
                  <div className="text-right">
                    <span className="text-[10px] text-text-muted block">Avg Response</span>
                    <span className="text-sm font-bold text-emerald-400 font-mono">
                      {s.avgResponseTimeSec}s
                    </span>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] text-text-muted block">Avg Revisions</span>
                    <span className="text-sm font-bold text-indigo-300 font-mono">
                      {s.avgRevisionCount}
                    </span>
                  </div>

                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setSelectedSessionId(s.sessionId)}
                    className="text-xs shrink-0"
                  >
                    <Eye size={12} className="mr-1.5" />
                    Inspect Details
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Question Detail Modal */}
      <StudentSessionDetailModal
        studentId={studentId}
        sessionId={selectedSessionId}
        onClose={() => setSelectedSessionId(null)}
      />
    </div>
  );
}
