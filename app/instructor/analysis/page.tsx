'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { BehavioralAnalysisWorkbench } from '@/components/integrity/BehavioralAnalysisWorkbench';

function AnalysisContent() {
  const searchParams = useSearchParams();
  const studentId = searchParams.get('student') || 'S003';
  const sessionId = searchParams.get('session') || undefined;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <BehavioralAnalysisWorkbench initialStudentId={studentId} initialSessionId={sessionId} />
    </div>
  );
}

export default function AnalysisPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-24">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <AnalysisContent />
    </Suspense>
  );
}
