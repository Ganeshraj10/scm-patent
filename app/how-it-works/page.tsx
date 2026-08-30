import Link from 'next/link';
import { ArrowLeft, BookOpen, Brain, Calculator, Search, AlertCircle, Shield, UserCheck, RefreshCw, ChevronRight } from 'lucide-react';

export default function HowItWorksPage() {
  const steps = [
    {
      num: '01',
      title: 'Learn from coursework',
      desc: 'The system passively tracks routine interactions during low-stakes assignments.',
      icon: <BookOpen className="text-emerald-400" size={24} />,
    },
    {
      num: '02',
      title: 'Build personalized model',
      desc: 'Routine telemetry is assembled into a unique behavioral fingerprint for each student.',
      icon: <Brain className="text-emerald-400" size={24} />,
    },
    {
      num: '03',
      title: 'Calibrate individual threshold',
      desc: 'Conformal bounds are calculated from held-out calibration sessions to determine a personalized anomaly threshold.',
      icon: <Calculator className="text-emerald-400" size={24} />,
    },
    {
      num: '04',
      title: 'Analyze examination behavior',
      desc: 'High-stakes examination behavior is measured against the personalized model using cross-modal deviation scoring.',
      icon: <Search className="text-emerald-400" size={24} />,
    },
    {
      num: '05',
      title: 'Generate explainable review flag',
      desc: 'If deviation exceeds the calibrated threshold, the session is flagged for instructor review.',
      icon: <AlertCircle className="text-amber-400" size={24} />,
    },
    {
      num: '06',
      title: 'Verify provenance',
      desc: 'Deterministic Cryptographic Provenance & Integrity Verification ensures the behavioral payload is immutable and authentic.',
      icon: <Shield className="text-emerald-400" size={24} />,
    },
    {
      num: '07',
      title: 'Human review',
      desc: 'Instructors review the specific feature contributions and determine a final verified verdict.',
      icon: <UserCheck className="text-emerald-400" size={24} />,
    },
    {
      num: '08',
      title: 'Update model only after verification',
      desc: 'If verified free of misconduct, the high-stakes data enters the personalization dataset to rebuild the model.',
      icon: <RefreshCw className="text-emerald-400" size={24} />,
    },
  ];

  return (
    <div className="min-h-screen bg-surface-900 pb-20">
      <header className="sticky top-0 z-10 bg-surface-800/80 backdrop-blur-md border-b border-border">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center gap-4">
            <Link
              href="/"
              className="p-2 -ml-2 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-700 transition-colors"
            >
              <ArrowLeft size={20} />
            </Link>
            <h1 className="text-lg font-semibold text-text-primary">Patent Architecture</h1>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="space-y-6 mb-12">
          <h2 className="text-3xl font-bold text-text-primary">How ExamGuard Works</h2>
          <p className="text-text-secondary leading-relaxed max-w-2xl">
            ExamGuard demonstrates a patented personalized examination-integrity architecture. 
            Instead of comparing students against a universal average, the system learns how each student naturally works 
            and flags significant deviations from their own baseline.
          </p>
          
          <div className="p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-sm">
            <p className="font-semibold text-indigo-400 mb-1">Patented Behavioral Integrity Engine</p>
            <p className="text-indigo-200/80">
              ExamGuard implements the patented personalized examination-integrity architecture. 
              The multidimensional deviation engine utilizes shrinkage-regularized Mahalanobis distance across a full 5×5 covariance matrix to detect joint behavioral anomalies against a student&apos;s own baseline.
            </p>
          </div>
        </div>

        <div className="space-y-4 relative before:absolute before:inset-0 before:ml-6 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-border before:to-transparent">
          {steps.map((step, idx) => (
            <div key={step.num} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
              
              <div className="flex items-center justify-center w-12 h-12 rounded-full border-4 border-surface-900 bg-surface-800 text-text-primary shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                {step.icon}
              </div>
              
              <div className="w-[calc(100%-4rem)] md:w-[calc(50%-3rem)] p-4 rounded-xl border border-border bg-surface-800 shadow-sm">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-xs font-mono text-emerald-400 font-semibold">{step.num}</span>
                  <h3 className="font-bold text-text-primary text-lg">{step.title}</h3>
                </div>
                <p className="text-sm text-text-secondary leading-relaxed">
                  {step.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
        
        <div className="mt-16 flex justify-center">
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-emerald-500 text-surface-900 font-bold hover:bg-emerald-400 transition-colors shadow-lg shadow-emerald-500/20"
          >
            Experience Demo <ChevronRight size={18} />
          </Link>
        </div>
      </main>
    </div>
  );
}
