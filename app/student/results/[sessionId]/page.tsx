'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { getExamSession } from '@/lib/services/sessions';
import { getSessionById } from '@/data/mockSessions';
import { CheckCircle, AlertTriangle, ShieldCheck, Clock, FileText } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

export default function ExamResultPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const router = useRouter();
  const { sessionId } = use(params);
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        // Try Supabase-backed session first, then fall back to mock data
        const data = await getExamSession(sessionId);
        if (!cancelled) {
          setSession(data || getSessionById(sessionId) || null);
        }
      } catch {
        if (!cancelled) {
          // If service throws (non-demo mode, network issue), still try mock
          setSession(getSessionById(sessionId) || null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [sessionId]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[60vh]">
        <div className="w-8 h-8 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="max-w-xl mx-auto mt-12 text-center">
        <AlertTriangle className="mx-auto text-amber-400 mb-4" size={48} />
        <h2 className="text-xl font-bold text-text-primary">Session Not Found</h2>
        <p className="text-text-muted mt-2">The requested examination session could not be located. ID: {sessionId}</p>
        <Button className="mt-6" onClick={() => router.push('/student/dashboard')}>Return to Dashboard</Button>
      </div>
    );
  }

  const isReviewRequired = session.reviewStatus === 'review_required';

  return (
    <div className="max-w-2xl mx-auto mt-8 space-y-6">
      <div className="text-center space-y-2 mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-500/10 mb-4">
          <CheckCircle className="text-emerald-400" size={32} />
        </div>
        <h1 className="text-2xl font-bold text-text-primary">EXAMINATION SUBMITTED</h1>
        <p className="text-text-muted">Your examination has been successfully submitted and saved.</p>
      </div>

      <Card padding="lg">
        <div className="space-y-6">
          <div className="flex justify-between items-center pb-4 border-b border-border">
            <div>
              <p className="text-xs text-text-muted uppercase tracking-wider font-semibold mb-1">Exam</p>
              <p className="text-text-primary font-medium">{session.examName}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-text-muted uppercase tracking-wider font-semibold mb-1">Date</p>
              <p className="text-text-secondary">{new Date(session.date).toLocaleDateString()}</p>
            </div>
          </div>

          <div className="bg-surface-900 rounded-xl p-5 border border-border">
            <h3 className="text-sm font-semibold text-text-primary mb-4 flex items-center gap-2">
              <ShieldCheck size={16} className="text-indigo-400" />
              Integrity Analysis
            </h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-text-muted mb-1">Analysis Status</p>
                <div className="flex items-center gap-1.5 text-emerald-400 font-medium text-sm">
                  <CheckCircle size={14} /> COMPLETED
                </div>
              </div>
              
              <div>
                <p className="text-xs text-text-muted mb-1">Review Status</p>
                {isReviewRequired ? (
                  <div className="flex items-center gap-1.5 text-amber-400 font-bold text-sm">
                    <AlertTriangle size={14} /> REVIEW REQUIRED
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-emerald-400 font-bold text-sm">
                    <CheckCircle size={14} /> NORMAL
                  </div>
                )}
              </div>
            </div>

            {isReviewRequired && (
              <div className="mt-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <p className="text-xs text-amber-200 leading-relaxed">
                  <strong>Notice:</strong> Your submission has been routed for instructor review due to behavioral deviations from your personalized model. 
                  <br className="my-1" />
                  <em>Review Required does not indicate a misconduct determination. The session is merely queued for human verification.</em>
                </p>
              </div>
            )}
            {!isReviewRequired && (
              <div className="mt-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                <p className="text-xs text-emerald-200/80 leading-relaxed">
                  Your behavioral patterns were consistent with your personalized model. No further review is required at this time.
                </p>
              </div>
            )}
          </div>
          
          <div className="flex justify-center pt-2">
            <Button variant="secondary" onClick={() => router.push('/student/dashboard')}>
              Return to Dashboard
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
