'use client';

import { use, useMemo } from 'react';
import Link from 'next/link';
import { ArrowLeft, AlertCircle } from 'lucide-react';
import { generateRiskReport } from '@/lib/services/behavioralReportService';
import { BehavioralRiskReportView } from '@/components/integrity/BehavioralRiskReportView';
import { Button } from '@/components/ui/Button';

export default function SessionReportPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = use(params);

  const report = useMemo(() => {
    try {
      return generateRiskReport(sessionId, 'instructor');
    } catch (err) {
      return null;
    }
  }, [sessionId]);

  if (!report) {
    return (
      <div className="max-w-3xl mx-auto py-16 text-center space-y-4">
        <div className="p-3 rounded-full bg-rose-500/10 text-rose-400 w-12 h-12 flex items-center justify-center mx-auto">
          <AlertCircle size={24} />
        </div>
        <h2 className="text-lg font-bold text-text-primary">Report Not Found</h2>
        <p className="text-xs text-text-muted">
          Could not find telemetry records for examination session <code className="font-mono text-indigo-400">{sessionId}</code>.
        </p>
        <Link href="/instructor/reports">
          <Button variant="secondary" size="sm" className="mt-2 text-xs">
            <ArrowLeft size={14} className="mr-1" />
            Back to Reports Directory
          </Button>
        </Link>
      </div>
    );
  }

  return <BehavioralRiskReportView report={report} />;
}
