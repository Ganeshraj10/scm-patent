'use client';

import { useState } from 'react';
import Link from 'next/link';
import { login } from '@/lib/actions/auth';
import { Button } from '@/components/ui/Button';
import { ShieldCheck, AlertCircle } from 'lucide-react';

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError(null);
    const result = await login(formData);
    
    // login action redirects on success. It only returns if there is an error.
    if (result?.error) {
      setError(result.error);
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-navy-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="w-12 h-12 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-600/30">
            <ShieldCheck size={24} className="text-white" />
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-text-primary tracking-tight">
          Sign in to your account
        </h2>
        <p className="mt-2 text-center text-sm text-text-secondary">
          Or{' '}
          <Link href="/register" className="font-medium text-indigo-400 hover:text-indigo-300">
            register a new account
          </Link>
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-surface-800 py-8 px-4 shadow-xl border border-border sm:rounded-xl sm:px-10">
          <form action={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-start gap-3">
                <AlertCircle size={18} className="text-rose-400 shrink-0 mt-0.5" />
                <p className="text-sm text-rose-400">{error}</p>
              </div>
            )}

            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-text-secondary mb-1.5"
              >
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="block w-full appearance-none rounded-lg border border-border bg-surface-900 px-3 py-2 text-text-primary placeholder-text-muted focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 sm:text-sm transition-colors"
                placeholder="you@university.edu"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-text-secondary mb-1.5"
              >
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="block w-full appearance-none rounded-lg border border-border bg-surface-900 px-3 py-2 text-text-primary placeholder-text-muted focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 sm:text-sm transition-colors"
              />
            </div>

            <Button type="submit" variant="primary" className="w-full justify-center" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign in'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
