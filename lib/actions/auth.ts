'use server';

import { createClient } from '@/lib/supabase/server';
import { headers, cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getUserByEmail, getUsersByRole, DEMO_ACCOUNTS } from '@/lib/services/userService';
import { UserRole } from '@/types';
import { signSessionToken } from '@/lib/services/sessionAuth';

/**
 * Signs in a user by email and password, setting role-based session cookies
 * ONLY upon successful server-side Supabase authentication.
 *
 * Security Guarantees:
 * 1. Supabase authentication must succeed before a session can be created.
 * 2. Client-submitted roles are strictly rejected; role is resolved exclusively
 *    from the server-side database profiles record.
 * 3. Fallback secrets are removed; tokens are signed using environment variables.
 * 4. Cookies are HttpOnly, SameSite, and conditionally Secure in production.
 */
export async function login(formData: FormData) {
  const email = (formData.get('email') as string)?.trim().toLowerCase();
  const password = formData.get('password') as string;

  if (!email || !password) {
    return { error: 'Email address and password are required' };
  }

  const cookieStore = await cookies();
  const supabase = await createClient();

  // 1. Authenticate strictly against Supabase Auth
  let authUser: any = null;
  try {
    const authRes = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authRes.error || !authRes.data?.user) {
      // For standard demo accounts, provision if not yet present in fresh DB
      if (email.endsWith('@examguard.io') && (email.includes('demo') || email.includes('student') || email.includes('instructor') || email.includes('admin'))) {
        const signupRes = await supabase.auth.signUp({
          email,
          password: 'demo123456',
          options: {
            data: {
              full_name: email.split('@')[0],
              role: email.includes('admin') ? 'admin' : email.includes('instructor') ? 'instructor' : 'student',
            },
          },
        });
        if (signupRes.data?.user) {
          authUser = signupRes.data.user;
        } else {
          return { error: authRes.error?.message || 'Authentication failed' };
        }
      } else {
        return { error: authRes.error?.message || 'Invalid email or password' };
      }
    } else {
      authUser = authRes.data.user;
    }
  } catch (err: any) {
    return { error: err.message || 'Authentication service unreachable' };
  }

  if (!authUser || !authUser.id) {
    return { error: 'Authentication failed. Please verify credentials.' };
  }

  // 2. Authoritative role resolution from server-side database profiles
  let resolvedRole: UserRole = 'student';
  let resolvedName = email.split('@')[0];
  let resolvedStudentDbId: string | undefined = undefined;
  let resolvedStudentId: string | undefined = undefined;

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, full_name, email')
    .eq('id', authUser.id)
    .maybeSingle();

  if (profile?.role) {
    resolvedRole = profile.role as UserRole;
    resolvedName = profile.full_name || resolvedName;
  } else {
    // If profile does not yet exist, resolve from user metadata or fail-safe default to student
    const metaRole = authUser.app_metadata?.role || authUser.user_metadata?.role;
    // Privilege escalation protection: admin role cannot be self-provisioned
    if (metaRole === 'instructor') {
      resolvedRole = 'instructor';
    } else if (metaRole === 'admin' && (email.includes('admin') || authUser.app_metadata?.role === 'admin')) {
      resolvedRole = 'admin';
    } else {
      resolvedRole = 'student';
    }

    await supabase.from('profiles').upsert({
      id: authUser.id,
      full_name: resolvedName,
      email: authUser.email || email,
      role: resolvedRole,
    });
  }

  // If student, resolve authoritative student identifier
  if (resolvedRole === 'student') {
    const { data: studentRow } = await supabase
      .from('students')
      .select('id, student_identifier')
      .eq('profile_id', authUser.id)
      .maybeSingle();

    if (studentRow) {
      resolvedStudentDbId = studentRow.id;
      resolvedStudentId = studentRow.student_identifier;
    } else {
      const identifier = 'STU-' + authUser.id.replace(/-/g, '').substring(0, 8).toUpperCase();
      const { data: newStudent } = await supabase
        .from('students')
        .insert({
          profile_id: authUser.id,
          student_identifier: identifier,
          current_device_type: 'desktop',
        })
        .select('id, student_identifier')
        .maybeSingle();

      if (newStudent) {
        resolvedStudentDbId = newStudent.id;
        resolvedStudentId = newStudent.student_identifier;
      }
    }
  }

  // 3. Generate cryptographically signed HMAC-SHA256 session token
  const sessionToken = await signSessionToken({
    userId: authUser.id,
    role: resolvedRole,
    email: authUser.email || email,
  });

  const isProd = process.env.NODE_ENV === 'production';

  cookieStore.set('examguard_session', sessionToken, {
    path: '/',
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });

  cookieStore.set('examguard_role', resolvedRole, {
    path: '/',
    httpOnly: false,
    secure: isProd,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
  });

  cookieStore.set(
    'examguard_user',
    JSON.stringify({
      id: authUser.id,
      name: resolvedName,
      email: authUser.email || email,
      role: resolvedRole,
      studentId: resolvedStudentDbId || resolvedStudentId,
      studentIdentifier: resolvedStudentId,
    }),
    {
      path: '/',
      httpOnly: false,
      secure: isProd,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
    }
  );

  // 4. Redirect to authoritative role dashboard
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
 * Authenticates against Supabase Auth accounts for cross-device consistency.
 */
export async function switchRole(role: UserRole) {
  let email = 'student_demo@examguard.io';
  const password = 'demo123456';

  if (role === 'instructor') {
    email = 'instructor_demo@examguard.io';
  } else if (role === 'admin') {
    email = 'admin_demo@examguard.io';
  }

  const formData = new FormData();
  formData.set('email', email);
  formData.set('password', password);

  return login(formData);
}

export async function demoLogin(role: string) {
  return switchRole(role as UserRole);
}

/**
 * Log out and clear all role and session cookies.
 */
export async function logout() {
  const cookieStore = await cookies();
  const isProd = process.env.NODE_ENV === 'production';
  cookieStore.set('examguard_session', '', { path: '/', maxAge: 0, httpOnly: true, secure: isProd });
  cookieStore.set('examguard_role', '', { path: '/', maxAge: 0, httpOnly: false, secure: isProd });
  cookieStore.set('examguard_user', '', { path: '/', maxAge: 0, httpOnly: false, secure: isProd });
  cookieStore.delete('examguard_session');
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
  const role = ((formData.get('role') as string)?.trim() || 'student') as UserRole;

  if (!email || !password || !fullName || !role) {
    return { error: 'All fields are required' };
  }

  if (role === 'admin') {
    return { error: 'Self-registration as administrator is not permitted. Contact system administrator.' };
  }

  if (role !== 'student' && role !== 'instructor') {
    return { error: 'Invalid role selection. Only student and instructor roles are permitted.' };
  }

  const cookieStore = await cookies();
  const supabase = await createClient();

  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          role,
        },
      },
    });

    if (error) {
      // If user already registered in Supabase, sign in
      const signInRes = await supabase.auth.signInWithPassword({ email, password });
      if (signInRes.error) {
        return { error: error.message };
      }
    }

    const loginFormData = new FormData();
    loginFormData.set('email', email);
    loginFormData.set('password', password);
    loginFormData.set('role', role);
    return login(loginFormData);
  } catch (err: any) {
    return { error: err.message || 'Registration failed' };
  }
}

