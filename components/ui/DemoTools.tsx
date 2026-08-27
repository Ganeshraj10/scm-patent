'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldAlert, CheckCircle, RefreshCw, Settings2, X } from 'lucide-react';
import { clearAllSessions, saveExamSession } from '@/lib/services/sessions';
import { buildCanonicalPayload, generateSessionCommitment } from '@/lib/cryptoEngine';

export function DemoTools() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Do not render in production mode
  if (process.env.NEXT_PUBLIC_DEMO_MODE !== 'true') {
    return null;
  }

  const handleReset = () => {
    clearAllSessions();
    window.location.href = '/'; // Full reload to clear memory state
  };

  const simulateExam = async (type: 'normal' | 'anomalous') => {
    setLoading(true);
    
    const sessionId = `exam-${Date.now()}`;
    const studentId = 'stu-001'; // Default demo student
    const isAnomalous = type === 'anomalous';
    
    // Create base session
    const session: any = {
      id: sessionId,
      studentId,
      type: 'graded_examination',
      status: 'completed',
      date: new Date().toISOString(),
      duration: isAnomalous ? 1200 : 2400, // Anomalous is suspiciously fast
      score: 95,
      features: [
        {
          questionId: 'q1',
          responseTime: isAnomalous ? 8000 : 45000,
          pointerMovement: isAnomalous ? 1200 : 4500,
          scrollDistance: isAnomalous ? 0 : 800,
          revisionCount: isAnomalous ? 0 : 2,
          pasteDetected: isAnomalous ? true : false,
          deviceType: 'desktop',
          sessionPosition: 0
        },
        {
          questionId: 'q2',
          responseTime: isAnomalous ? 12000 : 52000,
          pointerMovement: isAnomalous ? 1500 : 5100,
          scrollDistance: isAnomalous ? 200 : 1100,
          revisionCount: isAnomalous ? 1 : 4,
          pasteDetected: isAnomalous ? true : false,
          deviceType: 'desktop',
          sessionPosition: 1
        }
      ],
      analysis: {
        behavioralIntegrity: isAnomalous ? 'flagged' : 'verified',
        confidenceScore: isAnomalous ? 84 : 92,
        anomalies: isAnomalous ? ['Excessive paste operations', 'Suspiciously rapid response times'] : [],
        flags: isAnomalous ? 2 : 0,
      },
      deviationScore: isAnomalous ? 3.21 : 1.15,
      personalizedThreshold: 2.17, // From patent demo narrative
      reviewStatus: isAnomalous ? 'review_required' : 'normal'
    };

    // Attach cryptographic provenance
    const payload = buildCanonicalPayload(session);
    const commitment = await generateSessionCommitment(payload);
    session.cryptographicCommitment = commitment;

    // Save
    saveExamSession(session);
    
    // Redirect to student result page
    router.push(`/student/results/${sessionId}`);
    setLoading(false);
    setIsOpen(false);
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2">
      {isOpen && (
        <div className="bg-surface-800 border border-border shadow-xl rounded-xl p-4 w-64 animate-fade-in">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
              <Settings2 size={16} /> Demo Controls
            </h3>
            <button onClick={() => setIsOpen(false)} className="text-text-muted hover:text-text-primary">
              <X size={16} />
            </button>
          </div>
          
          <div className="space-y-2">
            <button
              onClick={() => simulateExam('normal')}
              disabled={loading}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 rounded-lg transition-colors border border-emerald-500/20"
            >
              <CheckCircle size={14} /> Simulate Normal Exam
            </button>
            
            <button
              onClick={() => simulateExam('anomalous')}
              disabled={loading}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 rounded-lg transition-colors border border-amber-500/20"
            >
              <ShieldAlert size={14} /> Simulate Anomalous Exam
            </button>

            <div className="h-px bg-border my-2"></div>
            
            <button
              onClick={handleReset}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-text-secondary bg-surface-700 hover:bg-surface-600 rounded-lg transition-colors border border-border"
            >
              <RefreshCw size={14} /> Reset Demo Data
            </button>
          </div>
        </div>
      )}
      
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="flex items-center justify-center w-10 h-10 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full shadow-lg transition-transform hover:scale-105"
          title="Demo Controls"
        >
          <Settings2 size={18} />
        </button>
      )}
    </div>
  );
}
