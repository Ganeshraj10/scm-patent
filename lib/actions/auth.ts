'use server';

import { createClient } from '@/lib/supabase/server';
import { headers, cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getUserByEmail, getUsersByRole, DEMO_ACCOUNTS } from '@/lib/services/userService';
import { UserRole } from '@/types';

/**
 * Signs in a user by email and password, setting role-based session cookies
 * and synchronizing with Supabase auth when available.
 */
export async function login(formData: FormData) {
  const email = (formData.get('email') as string)?.trim().toLowerCase();
  const password = formData.get('password') as string;
  const roleOverride = formData.get('role') as UserRole | null;

  if (!email) {
    return { error: 'Email address is required' };
  }

  const cookieStore = await cookies();

  // 1. Identify user and role
  const localUser = getUserByEmail(email);
  let resolvedRole: UserRole = roleOverride || localUser?.role || 'student';
  let resolvedName = localUser?.name || email.split('@')[0];
  let resolvedStudentId = localUser?.studentId || (resolvedRole === 'student' ? 'S001' : undefined);

  // If matching demo emails or explicit role keywords
  if (email.includes('admin') || roleOverride === 'admin') {
    resolvedRole = 'admin';
    resolvedName = resolvedName || 'Sarah Connor';
  } else if (email.includes('instructor') || email.includes('prof') || roleOverride === 'instructor') {
    resolvedRole = 'instructor';
    resolvedName = resolvedName || 'Prof. Robert Davis';
  } else if (email.includes('student') || roleOverride === 'student') {
    resolvedRole = 'student';
    resolvedName = resolvedName || 'Alex Chen';
    resolvedStudentId = resolvedStudentId || 'S001';
  }

  // 2. Set persistent HTTP session cookies for edge middleware & client state
  cookieStore.set('examguard_role', resolvedRole, {
    path: '/',
    httpOnly: false,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });

  cookieStore.set(
    'examguard_user',
    JSON.stringify({
      id: localUser?.id || `usr-${Date.now()}`,
      name: resolvedName,
      email: email,
      role: resolvedRole,
      studentId: resolvedStudentId,
    }),
    {
      path: '/',
      httpOnly: false,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
    }
  );

  // 3. Attempt Supabase Auth synchronization (non-blocking fallback)
  try {
    const supabase = await createClient();
    if (password) {
      const { data } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (data?.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role, full_name')
          .eq('id', data.user.id)
          .maybeSingle();

        if (profile?.role) {
          resolvedRole = profile.role as UserRole;
          cookieStore.set('examguard_role', resolvedRole, { path: '/', maxAge: 60 * 60 * 24 * 7 });
        }
      }
    }
  } catch (err) {
    // Graceful fallback to local role session in prototype mode
    console.log('[login] Supabase auth fallback to local role session:', resolvedRole);
  }

  // 4. Redirect to appropriate role dashboard
  if (resolvedRole === 'admin') {
    redirect('/admin/dashboard');
  } else if (resolvedRole === 'instructor') {
    redirect('/instructor/dashboard');
  } else {
    redirect('/student/dashboard');
  }
}

/**
 * 1-Click Instant Demo Authentication for the 3 distinct roles.
 */
export async function switchRole(role: UserRole) {
  const cookieStore = await cookies();

  let name = 'Alex Chen';
  let email = 'student_demo@examguard.io';
  let studentId = 'S001';

  if (role === 'admin') {
    name = 'Sarah Connor';
    email = 'admin_demo@examguard.io';
    studentId = '';
  } else if (role === 'instructor') {
    name = 'Prof. Robert Davis';
    email = 'instructor_demo@examguard.io';
    studentId = '';
  }

  cookieStore.set('examguard_role', role, {
    path: '/',
    httpOnly: false,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
  });

  cookieStore.set(
    'examguard_user',
    JSON.stringify({
      id: `usr-demo-${role}`,
      name,
      email,
      role,
      studentId: role === 'student' ? studentId : undefined,
    }),
    {
      path: '/',
      httpOnly: false,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
    }
  );

  if (role === 'admin') {
    redirect('/admin/dashboard');
  } else if (role === 'instructor') {
    redirect('/instructor/dashboard');
  } else {
    redirect('/student/dashboard');
  }
}

export async function demoLogin(role: string) {
  return switchRole(role as UserRole);
}

/**
 * Log out and clear all role and session cookies.
 */
export async function logout() {
  const cookieStore = await cookies();
  cookieStore.delete('examguard_role');
  cookieStore.delete('examguard_user');

  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
  } catch (e) {
    // Ignore signOut errors on client disconnect
  }

  redirect('/login');
}

/**
 * Register a new user account across any of the 3 roles.
 */
export async function register(formData: FormData) {
  const email = (formData.get('email') as string)?.trim().toLowerCase();
  const password = formData.get('password') as string;
  const fullName = (formData.get('full_name') as string)?.trim();
  const role = (formData.get('role') as string)?.trim() as UserRole;

  if (!email || !password || !fullName || !role) {
    return { error: 'All fields are required' };
  }

  if (role !== 'student' && role !== 'instructor' && role !== 'admin') {
    return { error: 'Invalid role selection' };
  }

  const cookieStore = await cookies();

  // Set session cookies
  cookieStore.set('examguard_role', role, {
    path: '/',
    httpOnly: false,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
  });

  cookieStore.set(
    'examguard_user',
    JSON.stringify({
      id: `usr-${Date.now()}`,
      name: fullName,
      email,
      role,
      studentId: role === 'student' ? 'S001' : undefined,
    }),
    {
      path: '/',
      httpOnly: false,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
    }
  );

  // Attempt Supabase registration
  try {
    const supabase = await createClient();
    const requestHeaders = await headers();
    const forwardedHost = requestHeaders.get('x-forwarded-host');
    const host = forwardedHost ?? requestHeaders.get('host');
    const protocol = requestHeaders.get('x-forwarded-proto') ?? 'http';
    const emailRedirectTo = host ? `${protocol}://${host}/auth/callback` : undefined;

    await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          role,
        },
        ...(emailRedirectTo ? { emailRedirectTo } : {}),
      },
    });
  } catch (err) {
    console.log('[register] Supabase registration note:', err);
  }

  if (role === 'admin') {
    redirect('/admin/dashboard');
  } else if (role === 'student') {
    redirect('/student/dashboard');
  } else {
    redirect('/instructor/dashboard');
  }
}
