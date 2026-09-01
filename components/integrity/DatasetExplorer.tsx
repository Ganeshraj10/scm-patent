'use client';

import React, { useState, useMemo } from 'react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import {
  getStudents,
  getAllRecords,
  getStudent,
  getSession,
  SOURCE_DATASET_COMPOSITION,
} from '@/lib/services/datasetService';
import { StudentGroup, DatasetSession, QuestionInteraction } from '@/types';
import {
  Users,
  Layers,
  Filter,
  Monitor,
  Laptop,
  Smartphone,
  ChevronRight,
  Eye,
  Clock,
  Edit3,
  MousePointer,
  ArrowDown,
  ClipboardX,
  Zap,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Sparkles,
} from 'lucide-react';

export function DatasetExplorer() {
  const allStudents = useMemo(() => getStudents(), []);
  const allRecords = useMemo(() => getAllRecords(), []);

  // Filter States
  const [selectedStudentId, setSelectedStudentId] = useState<string>('S001');
  const [sessionTypeFilter, setSessionTypeFilter] = useState<'all' | 'low_stakes' | 'graded'>('all');
  const [deviceFilter, setDeviceFilter] = useState<string>('all');
  const [labelFilter, setLabelFilter] = useState<string>('all');

  // Selected Session for Question-Level Telemetry Inspection
  const [inspectedSessionId, setInspectedSessionId] = useState<string | null>(null);

  // Active Student details
  const activeStudent: StudentGroup | undefined = useMemo(() => {
    return getStudent(selectedStudentId) || allStudents[0];
  }, [selectedStudentId, allStudents]);

  // Filtered Sessions for the active student
  const filteredSessions: DatasetSession[] = useMemo(() => {
    if (!activeStudent) return [];
    return activeStudent.sessions.filter((s) => {
      if (sessionTypeFilter !== 'all' && s.sessionType !== sessionTypeFilter) return false;
      if (deviceFilter !== 'all' && s.deviceType !== deviceFilter) return false;
      if (labelFilter !== 'all' && s.humanReviewLabel !== labelFilter) return false;
      return true;
    });
  }, [activeStudent, sessionTypeFilter, deviceFilter, labelFilter]);

  // Inspected Session details for modal
  const inspectedSession: DatasetSession | undefined = useMemo(() => {
    if (!inspectedSessionId) return undefined;
    return getSession(inspectedSessionId);
  }, [inspectedSessionId]);

  const renderDeviceIcon = (device: string) => {
    if (device.includes('mobile')) return <Smartphone size={14} className="text-emerald-400" />;
    if (device.includes('laptop')) return <Laptop size={14} className="text-indigo-400" />;
    return <Monitor size={14} className="text-sky-400" />;
  };

  return (
    <div className="space-y-6">
      {/* ─── Filter Bar ─────────────────────────────────────────────── */}
      <Card padding="sm" className="bg-surface-800/80 border-border">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 px-2 py-1">
          <div className="flex items-center gap-2 text-xs font-semibold text-text-muted uppercase tracking-wider">
            <Filter size={14} className="text-indigo-400" />
            <span>Dataset Filters:</span>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Student Selector */}
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-text-muted">Student:</span>
              <select
                aria-label="Filter by Student ID"
                value={selectedStudentId}
                onChange={(e) => setSelectedStudentId(e.target.value)}
                className="bg-surface-700 border border-border text-text-primary text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-indigo-500 font-mono"
              >
                {allStudents.map((stu) => (
                  <option key={stu.studentId} value={stu.studentId}>
                    {stu.studentId} ({stu.lowStakesCount} low-stakes / {stu.gradedCount} graded)
                  </option>
                ))}
              </select>
            </div>

            {/* Session Type Selector */}
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-text-muted">Session Type:</span>
              <select
                aria-label="Filter by Session Type"
                value={sessionTypeFilter}
                onChange={(e) => setSessionTypeFilter(e.target.value as any)}
                className="bg-surface-700 border border-border text-text-primary text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-indigo-500"
              >
                <option value="all">All Types (12)</option>
                <option value="low_stakes">Low-Stakes Coursework (8)</option>
                <option value="graded">Graded Exam (4)</option>
              </select>
            </div>

            {/* Device Selector */}
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-text-muted">Device:</span>
              <select
                aria-label="Filter by Device Type"
                value={deviceFilter}
                onChange={(e) => setDeviceFilter(e.target.value)}
                className="bg-surface-700 border border-border text-text-primary text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-indigo-500"
              >
                <option value="all">All Devices</option>
                <option value="web_desktop">Desktop</option>
                <option value="web_laptop">Laptop</option>
                <option value="mobile">Mobile</option>
              </select>
            </div>

            {/* Label Selector */}
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-text-muted">Review Label:</span>
              <select
                aria-label="Filter by Review Label"
                value={labelFilter}
                onChange={(e) => setLabelFilter(e.target.value)}
                className="bg-surface-700 border border-border text-text-primary text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-indigo-500"
              >
                <option value="all">All Mock Labels</option>
                <option value="clean_mock">Clean Mock (117)</option>
                <option value="flagged_mock">Flagged Mock (3)</option>
              </select>
            </div>

            {(sessionTypeFilter !== 'all' || deviceFilter !== 'all' || labelFilter !== 'all') && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSessionTypeFilter('all');
                  setDeviceFilter('all');
                  setLabelFilter('all');
                }}
                className="text-[11px] h-7 px-2 text-indigo-400 hover:text-indigo-300"
              >
                Reset Filters
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* ─── Top Level: Student Cohort Overview Table ───────────────── */}
      <Card>
        <CardHeader
          title="Student Cohort Data Exploration"
          subtitle={`10 Unique Students · Grouped Longitudinal Coursework and Graded Sessions`}
          badge={
            <span className="text-xs text-text-muted">
              Click a student row to inspect their session history
            </span>
          }
        />
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-border text-text-muted bg-surface-700/30">
                <th className="py-2.5 px-4 font-semibold">Student ID</th>
                <th className="py-2.5 px-3 font-semibold">Low-Stakes</th>
                <th className="py-2.5 px-3 font-semibold">Graded Exams</th>
                <th className="py-2.5 px-3 font-semibold">Primary Device</th>
                <th className="py-2.5 px-3 font-semibold">Avg Response Time</th>
                <th className="py-2.5 px-3 font-semibold">Avg Revisions</th>
                <th className="py-2.5 px-3 font-semibold">Avg Pointer Speed</th>
                <th className="py-2.5 px-3 font-semibold">Latest Session</th>
                <th className="py-2.5 px-3 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {allStudents.map((stu) => {
                const isSelected = stu.studentId === selectedStudentId;
                return (
                  <tr
                    key={stu.studentId}
                    onClick={() => setSelectedStudentId(stu.studentId)}
                    className={`cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-indigo-950/40 text-text-primary font-medium'
                        : 'hover:bg-surface-700/40 text-text-secondary'
                    }`}
                  >
                    <td className="py-3 px-4 font-mono font-bold text-indigo-300 flex items-center gap-2">
                      <Users size={13} className="text-indigo-400" />
                      {stu.studentId}
                      {isSelected && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-sans">
                          Active
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 tabular-nums">
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold">
                        {stu.lowStakesCount} sessions
                      </span>
                    </td>
                    <td className="py-3 px-3 tabular-nums">
                      <span className="px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-semibold">
                        {stu.gradedCount} exams
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1.5">
                        {renderDeviceIcon(stu.primaryDevice)}
                        <span className="capitalize">{stu.primaryDevice.replace('web_', '')}</span>
                      </div>
                    </td>
                    <td className="py-3 px-3 tabular-nums">{stu.avgResponseTimeSec}s</td>
                    <td className="py-3 px-3 tabular-nums">{stu.avgRevisionCount}</td>
                    <td className="py-3 px-3 tabular-nums">{stu.avgPointerSpeed} px/s</td>
                    <td className="py-3 px-3 text-text-muted font-mono text-[11px]">
                      {stu.latestSessionDate}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <Button
                        size="sm"
                        variant={isSelected ? 'primary' : 'ghost'}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedStudentId(stu.studentId);
                        }}
                        className="text-xs h-7 px-2.5"
                      >
                        {isSelected ? 'Selected' : 'View Sessions'}
                        <ChevronRight size={13} className="ml-1" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ─── Second Level: Selected Student Session History ─────────── */}
      {activeStudent && (
        <Card>
          <CardHeader
            title={`Session History for ${activeStudent.studentId}`}
            subtitle={`Total: ${activeStudent.sessions.length} sessions (${activeStudent.lowStakesCount} low-stakes practice + ${activeStudent.gradedCount} graded exams)`}
            badge={
              <div className="flex items-center gap-2">
                <Badge variant="active" size="sm">
                  {filteredSessions.length} Matching Filter
                </Badge>
              </div>
            }
          />
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border text-text-muted bg-surface-700/30">
                  <th className="py-2.5 px-4 font-semibold">Session ID</th>
                  <th className="py-2.5 px-3 font-semibold">Type</th>
                  <th className="py-2.5 px-3 font-semibold">Timestamp</th>
                  <th className="py-2.5 px-3 font-semibold">Device</th>
                  <th className="py-2.5 px-3 font-semibold">Questions</th>
                  <th className="py-2.5 px-3 font-semibold">Avg Response Time</th>
                  <th className="py-2.5 px-3 font-semibold">Avg Revisions</th>
                  <th className="py-2.5 px-3 font-semibold">Special Events</th>
                  <th className="py-2.5 px-3 font-semibold">Review Label</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {filteredSessions.map((session) => {
                  const isGraded = session.sessionType === 'graded';
                  const isFlagged = session.humanReviewLabel === 'flagged_mock';
                  return (
                    <tr
                      key={session.sessionId}
                      className="hover:bg-surface-700/40 transition-colors text-text-secondary"
                    >
                      <td className="py-3 px-4 font-mono font-bold text-text-primary">
                        {session.sessionId}
                      </td>
                      <td className="py-3 px-3">
                        <Badge
                          variant={isGraded ? 'graded' : 'low_stakes'}
                          size="sm"
                        >
                          {isGraded ? 'Graded Exam' : 'Low-Stakes'}
                        </Badge>
                      </td>
                      <td className="py-3 px-3 font-mono text-[11px] text-text-muted">
                        {session.timestamp}
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1.5">
                          {renderDeviceIcon(session.deviceType)}
                          <span className="capitalize">{session.deviceType.replace('web_', '')}</span>
                        </div>
                      </td>
                      <td className="py-3 px-3 tabular-nums font-medium text-text-primary">
                        {session.questionCount}
                      </td>
                      <td className="py-3 px-3 tabular-nums font-mono">
                        {session.avgResponseTimeSec}s
                      </td>
                      <td className="py-3 px-3 tabular-nums">{session.avgRevisionCount}</td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {session.hasPasteEvent && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1">
                              <ClipboardX size={10} /> Paste
                            </span>
                          )}
                          {session.hasBurstEvent && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-pink-500/20 text-pink-300 border border-pink-500/30 flex items-center gap-1">
                              <Zap size={10} /> Burst
                            </span>
                          )}
                          {!session.hasPasteEvent && !session.hasBurstEvent && (
                            <span className="text-text-muted text-[11px]">—</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <Badge variant={isFlagged ? 'high' : 'verified'} size="sm">
                          {isFlagged ? 'Flagged Mock' : 'Clean Mock'}
                        </Badge>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => setInspectedSessionId(session.sessionId)}
                          className="text-xs h-7 px-2.5"
                        >
                          <Eye size={12} className="mr-1 text-indigo-400" />
                          Inspect Telemetry
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ─── Third Level: Question-Level Telemetry Inspector Modal ──── */}
      {inspectedSession && (
        <Modal
          open={!!inspectedSessionId}
          onClose={() => setInspectedSessionId(null)}
          title={`Question-Level Telemetry Inspector — ${inspectedSession.sessionId}`}
          size="xl"
        >
          <div className="space-y-4 text-xs">
            {/* Session Header Info */}
            <div className="p-3 rounded-xl bg-surface-700/50 border border-border grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <span className="text-text-muted text-[11px] block">Student ID</span>
                <span className="font-mono font-bold text-indigo-300">{inspectedSession.studentId}</span>
              </div>
              <div>
                <span className="text-text-muted text-[11px] block">Session Type</span>
                <Badge variant={inspectedSession.sessionType === 'graded' ? 'graded' : 'low_stakes'} size="sm">
                  {inspectedSession.sessionType === 'graded' ? 'Graded Examination' : 'Low-Stakes Coursework'}
                </Badge>
              </div>
              <div>
                <span className="text-text-muted text-[11px] block">Device</span>
                <div className="flex items-center gap-1 font-medium text-text-primary mt-0.5">
                  {renderDeviceIcon(inspectedSession.deviceType)}
                  <span>{inspectedSession.deviceType}</span>
                </div>
              </div>
              <div>
                <span className="text-text-muted text-[11px] block">Session Timestamp</span>
                <span className="font-mono text-text-secondary">{inspectedSession.timestamp}</span>
              </div>
            </div>

            {/* Question-Level Table */}
            <div className="overflow-x-auto border border-border rounded-xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border text-text-muted bg-surface-700/40">
                    <th className="py-2.5 px-3 font-semibold">Question ID</th>
                    <th className="py-2.5 px-2.5 font-semibold">Difficulty</th>
                    <th className="py-2.5 px-2.5 font-semibold">Response Time</th>
                    <th className="py-2.5 px-2.5 font-semibold">Revisions</th>
                    <th className="py-2.5 px-2.5 font-semibold">Rev Time</th>
                    <th className="py-2.5 px-2.5 font-semibold">Correct</th>
                    <th className="py-2.5 px-2.5 font-semibold">Pointer Distance</th>
                    <th className="py-2.5 px-2.5 font-semibold">Pointer Speed</th>
                    <th className="py-2.5 px-2.5 font-semibold">Scroll Dist</th>
                    <th className="py-2.5 px-2.5 font-semibold">Paste</th>
                    <th className="py-2.5 px-2.5 font-semibold">Burst</th>
                    <th className="py-2.5 px-2.5 font-semibold">Source</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {inspectedSession.interactions.map((q) => (
                    <tr key={q.recordId} className="hover:bg-surface-700/30 text-text-secondary font-mono">
                      <td className="py-2.5 px-3 font-bold text-text-primary">
                        {q.questionId}
                        <span className="text-[10px] text-text-muted block">Pos #{q.sessionPosition}</span>
                      </td>
                      <td className="py-2.5 px-2.5">
                        <span className="px-1.5 py-0.5 rounded bg-surface-600 text-text-primary text-[11px]">
                          {q.difficulty.toFixed(2)}
                        </span>
                      </td>
                      <td className="py-2.5 px-2.5 font-semibold text-text-primary">
                        {q.responseTimeSec}s
                      </td>
                      <td className="py-2.5 px-2.5">{q.revisionCount}</td>
                      <td className="py-2.5 px-2.5">{q.revisionTimeSec}s</td>
                      <td className="py-2.5 px-2.5">
                        {q.correctness === 1 ? (
                          <span className="text-emerald-400 font-bold">1 (✓)</span>
                        ) : (
                          <span className="text-rose-400 font-bold">0 (✗)</span>
                        )}
                      </td>
                      <td className="py-2.5 px-2.5">{q.pointerDistancePx} px</td>
                      <td className="py-2.5 px-2.5">{q.pointerAvgSpeedPxS} px/s</td>
                      <td className="py-2.5 px-2.5">{q.scrollDistancePx} px ({q.scrollEvents} ev)</td>
                      <td className="py-2.5 px-2.5">
                        {q.pasteDetected ? (
                          <span className="text-rose-400 font-bold">Yes (1)</span>
                        ) : (
                          <span className="text-text-muted">No (0)</span>
                        )}
                      </td>
                      <td className="py-2.5 px-2.5">
                        {q.characterBurstFlag ? (
                          <span className="text-pink-400 font-bold">Yes (1)</span>
                        ) : (
                          <span className="text-text-muted">No (0)</span>
                        )}
                      </td>
                      <td className="py-2.5 px-2.5 text-[10px] text-text-muted truncate max-w-[140px]" title={q.sourceDataset}>
                        {q.sourceDataset}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Source Transparency Note */}
            <div className="p-3 rounded-lg bg-surface-700/30 border border-border text-[11px] text-text-muted">
              <span className="font-semibold text-indigo-300">Telemetry Provenance: </span>
              {SOURCE_DATASET_COMPOSITION}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
