import { createClient as createBrowserClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';

// Helper to read cookies in browser or server context safely
function getCookieValue(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp('(^|;\\s*)(' + name + ')=([^;]*)'));
  return match ? decodeURIComponent(match[3]) : null;
}

// Get current authenticated user
export async function getCurrentUser(): Promise<User | null> {
  try {
    const supabase = createBrowserClient();
    const { data: { user } } = await supabase.auth.getUser();
    return user;
  } catch (err) {
    return null;
  }
}

// Get the user's profile from the database or session cookie
export async function getCurrentProfile() {
  // 1. Try Supabase Auth & Database
  try {
    const user = await getCurrentUser();
    if (user) {
      const supabase = createBrowserClient();
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (profile) {
        let studentIdentifier = 'S001';
        let studentDbId = user.id;

        if (profile.role === 'student') {
          const { data: studentRow } = await supabase
            .from('students')
            .select('*')
            .eq('profile_id', user.id)
            .maybeSingle();

          if (studentRow) {
            studentDbId = studentRow.id;
            studentIdentifier = studentRow.student_identifier || 'S001';
          }
        }

        return {
          id: user.id,
          student_id: studentDbId,
          student_identifier: studentIdentifier,
          email: user.email || profile.email,
          full_name: profile.full_name || 'Authenticated User',
          role: profile.role,
          created_at: profile.created_at,
        };
      }
    }
  } catch (err) {
    // Continue to fallback
  }

  // 2. Cookie Session Fallback (Client-side)
  try {
    const userCookie = getCookieValue('examguard_user');
    const roleCookie = getCookieValue('examguard_role');

    if (userCookie) {
      const parsed = JSON.parse(userCookie);
      return {
        id: parsed.id || 'usr-active-session',
        student_id: parsed.studentId || 'S001',
        student_identifier: parsed.studentId || 'S001',
        email: parsed.email || 'demo@examguard.io',
        full_name: parsed.name || 'Demo User',
        role: parsed.role || roleCookie || 'student',
        created_at: new Date().toISOString(),
      };
    }

    if (roleCookie) {
      return {
        id: `usr-${roleCookie}`,
        student_id: roleCookie === 'student' ? 'S001' : '',
        student_identifier: roleCookie === 'student' ? 'S001' : '',
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

    if (profile) {
      let studentIdentifier = 'S001';
      let studentDbId = user.id;

      if (profile.role === 'student') {
        const { data: studentRow } = await supabase
          .from('students')
          .select('*')
          .eq('profile_id', user.id)
          .maybeSingle();

        if (studentRow) {
          studentDbId = studentRow.id;
          studentIdentifier = studentRow.student_identifier || 'S001';
        }
      }

      return {
        id: user.id,
        student_id: studentDbId,
        student_identifier: studentIdentifier,
        email: user.email || profile.email,
        full_name: profile.full_name,
        role: profile.role,
        created_at: profile.created_at,
      };
    }

    return null;
  } catch (err) {
    return null;
  }
}
