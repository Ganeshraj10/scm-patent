import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  const url = (
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    'https://qkuwbsewryvbdoiyhrfd.supabase.co'
  ).trim();

  const key = (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    'sb_publishable_fq5yUjqffI_D-sYfQBOOcw_WS6Xervu'
  ).trim();

  return createBrowserClient(url, key);
}
