import { createClient as createServerClient } from '@/lib/supabase/server';
import { createClient as createBrowserClient } from '@/lib/supabase/client';
import { cookies } from 'next/headers';
import type { User } from '@supabase/supabase-js';

// Get current authenticated user
export async function getCurrentUser(): Promise<User | null> {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    return user;
  } catch (err) {
    return null;
  }
}

// Get the user's profile from the database or session cookie
export async function getCurrentProfile() {
  // 1. Try Supabase
  try {
    const user = await getCurrentUser();
    if (user) {
      const supabase = await createServerClient();
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (profile) return profile;
    }
  } catch (err) {
    // Continue to fallback
  }

  // 2. Cookie Session Fallback
  try {
    const cookieStore = await cookies();
    const userCookie = cookieStore.get('examguard_user')?.value;
    const roleCookie = cookieStore.get('examguard_role')?.value;

    if (userCookie) {
      const parsed = JSON.parse(userCookie);
      return {
        id: parsed.id || 'usr-active-session',
        email: parsed.email || 'demo@examguard.io',
        full_name: parsed.name || 'Demo User',
        role: parsed.role || roleCookie || 'student',
        created_at: new Date().toISOString(),
      };
    }

    if (roleCookie) {
      return {
        id: `usr-${roleCookie}`,
        email: `${roleCookie}@examguard.io`,
        full_name: roleCookie === 'student' ? 'Alex Chen' : roleCookie === 'instructor' ? 'Prof. Robert Davis' : 'Sarah Connor',
        role: roleCookie,
        created_at: new Date().toISOString(),
      };
    }
  } catch (err) {
    // Ignore cookie read failures in edge contexts
  }

  return null;
}

// Helper to check user role directly
export async function getCurrentRole(): Promise<string | null> {
  const profile = await getCurrentProfile();
  return profile?.role ?? null;
}

// Client-side variants for components that need them
export async function getCurrentUserClient() {
  try {
    const supabase = createBrowserClient();
    const { data: { user } } = await supabase.auth.getUser();
    return user;
  } catch (err) {
    return null;
  }
}

export async function getCurrentProfileClient() {
  const user = await getCurrentUserClient();
  if (!user) return null;

  try {
    const supabase = createBrowserClient();
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    return profile || null;
  } catch (err) {
    return null;
  }
}
