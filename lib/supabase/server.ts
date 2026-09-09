import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createClient() {
  let cookieStore: any = null;
  try {
    cookieStore = await cookies();
  } catch (e) {
    // Graceful handling when called outside request scope (e.g. In unit tests)
  }

  const url = (
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    'https://qkuwbsewryvbdoiyhrfd.supabase.co'
  ).trim();

  const key = (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    'sb_publishable_fq5yUjqffI_D-sYfQBOOcw_WS6Xervu'
  ).trim();

  return createServerClient(
    url,
    key,
    {
      cookies: {
        getAll() {
          return cookieStore ? cookieStore.getAll() : [];
        },
        setAll(cookiesToSet) {
          if (cookieStore) {
            try {
              cookiesToSet.forEach(({ name, value, options }: any) =>
                cookieStore.set(name, value, options)
              );
            } catch {
              // The `setAll` method was called from a Server Component.
            }
          }
        },
      },
    }
  );
}
