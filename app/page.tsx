import Link from 'next/link';
import {
  ShieldCheck,
  Brain,
  Eye,
  Users,
  ArrowRight,
  BookOpen,
  BarChart3,
  CheckCircle,
  AlertTriangle,
  Lock,
} from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-navy-900 flex flex-col">
      {/* ─── Nav ─────────────────────────────────────────────── */}
      <header className="border-b border-border bg-surface-900/80 backdrop-blur-sm sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-5 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-600/30">
              <ShieldCheck size={18} className="text-white" />
            </div>
            <span className="text-sm font-bold text-text-primary tracking-tight">ExamGuard</span>
          </div>
          <nav className="hidden md:flex items-center gap-6">
            <a href="#how-it-works" className="text-sm text-text-secondary hover:text-text-primary transition-colors">How It Works</a>
            <a href="#features" className="text-sm text-text-secondary hover:text-text-primary transition-colors">Features</a>
            <a href="#privacy" className="text-sm text-text-secondary hover:text-text-primary transition-colors">Privacy</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link
              href="/instructor/dashboard"
              className="text-sm text-text-secondary hover:text-text-primary transition-colors font-medium"
            >
              Instructor Demo
            </Link>
            <Link
              href="/instructor/dashboard"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors shadow-lg shadow-indigo-600/20"
            >
              Get Started
              <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* ─── Hero ────────────────────────────────────────────── */}
        <section className="relative pt-24 pb-20 px-5 overflow-hidden">
          {/* Background glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" aria-hidden="true" />
          <div className="absolute top-20 left-1/4 w-64 h-64 bg-indigo-600/5 rounded-full blur-2xl pointer-events-none" aria-hidden="true" />

          <div className="max-w-4xl mx-auto text-center relative">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 text-xs font-medium mb-8">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
              Patent-Based Prototype · Behavioral Integrity Research
            </div>

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-text-primary leading-tight tracking-tight mb-6">
              Personalized{' '}
              <span className="gradient-text">Examination</span>
              <br />
              Integrity
            </h1>

            <p className="text-lg md:text-xl text-text-secondary max-w-2xl mx-auto mb-10 leading-relaxed">
              Compare examination behavior against a behavioral model built from each
              student&apos;s own learning history — not a population average.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/instructor/dashboard"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-all shadow-lg shadow-indigo-600/25 text-sm"
                id="instructor-demo-btn"
              >
                <Users size={16} />
                Instructor Demo
              </Link>
              <Link
                href="/student"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-surface-700 hover:bg-surface-600 text-text-primary border border-border-strong font-semibold transition-all text-sm"
                id="student-demo-btn"
              >
                <BookOpen size={16} />
                Student Demo
              </Link>
            </div>
          </div>
        </section>

        {/* ─── Flow Diagram ─────────────────────────────────────── */}
        <section id="how-it-works" className="py-20 px-5">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12">
              <p className="text-xs font-semibold text-indigo-400 uppercase tracking-widest mb-3">How It Works</p>
              <h2 className="text-2xl md:text-3xl font-bold text-text-primary">
                A student&apos;s own history becomes the baseline
              </h2>
              <p className="text-text-secondary mt-3 max-w-xl mx-auto text-sm">
                The system never compares one student against others. Every judgment is relative to that individual&apos;s own behavioral history.
              </p>
            </div>

            {/* Flow steps */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 items-center">
              {[
                { icon: <BookOpen size={20} />, label: 'Coursework', sub: 'Low-stakes sessions', color: 'indigo' },
                { icon: <BarChart3 size={20} />, label: 'Behavioral Features', sub: 'Timing, scroll, paste…', color: 'sky' },
                { icon: <Brain size={20} />, label: 'Personalized Model', sub: 'Mean & variance', color: 'indigo' },
                { icon: <CheckCircle size={20} />, label: 'Examination', sub: 'Graded session', color: 'emerald' },
                { icon: <AlertTriangle size={20} />, label: 'Deviation', sub: 'vs. personalized model', color: 'amber' },
                { icon: <Eye size={20} />, label: 'Human Review', sub: 'Instructor decision', color: 'rose' },
              ].map((step, i) => (
                <div key={i} className="flex flex-col items-center text-center gap-3">
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                      step.color === 'indigo'
                        ? 'bg-indigo-500/15 text-indigo-400'
                        : step.color === 'sky'
                        ? 'bg-sky-500/15 text-sky-400'
                        : step.color === 'emerald'
                        ? 'bg-emerald-500/15 text-emerald-400'
                        : step.color === 'amber'
                        ? 'bg-amber-500/15 text-amber-400'
                        : 'bg-rose-500/15 text-rose-400'
                    }`}
                  >
                    {step.icon}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-text-primary">{step.label}</p>
                    <p className="text-xs text-text-muted mt-0.5">{step.sub}</p>
                  </div>
                  {i < 5 && (
                    <ArrowRight
                      size={16}
                      className="text-text-muted hidden lg:block absolute translate-x-24"
                      aria-hidden="true"
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── Feature Cards ─────────────────────────────────────── */}
        <section id="features" className="py-20 px-5 bg-surface-900/30">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12">
              <p className="text-xs font-semibold text-indigo-400 uppercase tracking-widest mb-3">Core Principles</p>
              <h2 className="text-2xl md:text-3xl font-bold text-text-primary">
                Built on four pillars
              </h2>
            </div>

            <div className="grid md:grid-cols-2 gap-5">
              {[
                {
                  icon: <Brain size={22} />,
                  title: 'Personalized',
                  description:
                    'Every student is compared only against their own behavioral history — never against a population average or other students.',
                  color: 'indigo',
                },
                {
                  icon: <Lock size={22} />,
                  title: 'Privacy First',
                  description:
                    'No keystrokes, audio, or video are captured. Only behavioral metadata: timing, scroll, pointer patterns, and device context.',
                  color: 'sky',
                },
                {
                  icon: <BarChart3 size={22} />,
                  title: 'Explainable',
                  description:
                    'Every deviation score is broken down by feature contribution. Instructors see exactly which behavioral signals drove the result.',
                  color: 'emerald',
                },
                {
                  icon: <Eye size={22} />,
                  title: 'Human Reviewed',
                  description:
                    'The system never punishes automatically. All flagged sessions require a human review decision by a qualified instructor.',
                  color: 'amber',
                },
              ].map((card, i) => (
                <div
                  key={i}
                  className="p-6 rounded-xl bg-surface-800 border border-border hover:border-border-strong transition-colors"
                >
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center mb-4 ${
                      card.color === 'indigo'
                        ? 'bg-indigo-500/10 text-indigo-400'
                        : card.color === 'sky'
                        ? 'bg-sky-500/10 text-sky-400'
                        : card.color === 'emerald'
                        ? 'bg-emerald-500/10 text-emerald-400'
                        : 'bg-amber-500/10 text-amber-400'
                    }`}
                  >
                    {card.icon}
                  </div>
                  <h3 className="text-sm font-semibold text-text-primary mb-2">{card.title}</h3>
                  <p className="text-sm text-text-secondary leading-relaxed">{card.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── Privacy Notice ─────────────────────────────────────── */}
        <section id="privacy" className="py-20 px-5">
          <div className="max-w-3xl mx-auto text-center">
            <div className="w-12 h-12 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center mx-auto mb-6">
              <Lock size={22} />
            </div>
            <h2 className="text-2xl font-bold text-text-primary mb-4">
              No surveillance. No raw content.
            </h2>
            <p className="text-text-secondary leading-relaxed text-sm mb-8">
              ExamGuard does not capture keystrokes, record audio, activate cameras, or transmit
              answer content. Behavioral features — such as response timing, revision count, and
              scroll distance — are summarized locally and never expose the underlying interaction
              stream.
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'No keystroke logging' },
                { label: 'No audio capture' },
                { label: 'No video recording' },
                { label: 'No raw answer data' },
              ].map((item, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-surface-800 border border-emerald-500/15"
                >
                  <CheckCircle size={14} className="text-emerald-400 flex-shrink-0" />
                  <span className="text-xs text-text-secondary">{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── CTA Banner ─────────────────────────────────────────── */}
        <section className="py-16 px-5">
          <div className="max-w-2xl mx-auto text-center">
            <div className="p-8 rounded-2xl bg-indigo-600/5 border border-indigo-500/15">
              <h2 className="text-xl font-bold text-text-primary mb-3">
                Explore the prototype
              </h2>
              <p className="text-sm text-text-secondary mb-6">
                View the instructor dashboard, student behavioral profiles, and the review queue.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link
                  href="/instructor/dashboard"
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors"
                  id="cta-instructor-btn"
                >
                  <Users size={15} />
                  Instructor Demo
                  <ArrowRight size={13} />
                </Link>
                <Link
                  href="/student"
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-surface-700 hover:bg-surface-600 border border-border-strong text-text-primary text-sm font-medium transition-colors"
                  id="cta-student-btn"
                >
                  <BookOpen size={15} />
                  Student Demo
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ─── Footer ──────────────────────────────────────────────── */}
      <footer className="border-t border-border py-8 px-5">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-lg bg-indigo-600 flex items-center justify-center">
              <ShieldCheck size={13} className="text-white" />
            </div>
            <span className="text-sm font-bold text-text-primary">ExamGuard</span>
          </div>
          <p className="text-xs text-text-muted text-center">
            A functional prototype based on personalized examination integrity patent concepts.
            For demonstration and research purposes only.
          </p>
          <p className="text-xs text-text-muted">Phase 1 — UI Foundation</p>
        </div>
      </footer>
    </div>
  );
}
