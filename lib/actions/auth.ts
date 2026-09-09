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
  const password = (formData.get('password') as string) || 'password123';
  const roleOverride = formData.get('role') as UserRole | null;

  if (!email) {
    return { error: 'Email address is required' };
  }

  const cookieStore = await cookies();
  const supabase = await createClient();

  let authUserId: string | null = null;
  const localUser = getUserByEmail(email);
  let resolvedRole: UserRole = roleOverride || localUser?.role || 'student';
  let resolvedName = localUser?.name || email.split('@')[0];
  let resolvedStudentId = localUser?.studentId || (resolvedRole === 'student' ? 'S001' : undefined);
  let resolvedStudentDbId: string | undefined = undefined;

  // 1. Authenticate with Supabase Auth
  try {
    let authRes = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    // Fallback: If demo user password or credential mismatch, try standard password or auto-provision
    if (authRes.error && (email.includes('examguard') || email.includes('demo') || email.includes('student') || email.includes('instructor') || email.includes('admin'))) {
      const altPassword = password === 'demo123456' ? 'password123' : 'demo123456';
      authRes = await supabase.auth.signInWithPassword({
        email,
        password: altPassword,
      });

      if (authRes.error) {
        const signupRes = await supabase.auth.signUp({
          email,
          password: 'password123',
          options: {
            data: {
              full_name: resolvedName,
              role: resolvedRole,
            },
          },
        });
        if (signupRes.data?.user) {
          authRes = { data: signupRes.data, error: null } as any;
        }
      }
    }

    if (authRes.data?.user) {
      const user = authRes.data.user;
      authUserId = user.id;

      // Ensure profile exists in public.profiles
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (profile) {
        resolvedRole = profile.role as UserRole;
        resolvedName = profile.full_name || resolvedName;
      } else {
        await supabase.from('profiles').upsert({
          id: user.id,
          full_name: resolvedName,
          email: user.email || email,
          role: resolvedRole,
        });
      }

      // If student, ensure public.students record exists
      if (resolvedRole === 'student') {
        const { data: studentRow } = await supabase
          .from('students')
          .select('id, student_identifier')
          .eq('profile_id', user.id)
          .maybeSingle();

        if (studentRow) {
          resolvedStudentDbId = studentRow.id;
          resolvedStudentId = studentRow.student_identifier;
        } else {
          const identifier = resolvedStudentId || ('STU-' + user.id.replace(/-/g, '').substring(0, 8).toUpperCase());
          const { data: newStudent } = await supabase
            .from('students')
            .insert({
              profile_id: user.id,
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
    }
  } catch (err: any) {
    console.warn('[login] Supabase auth notice:', err.message);
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
      id: authUserId || localUser?.id || `usr-${resolvedRole}`,
      name: resolvedName,
      email: email,
      role: resolvedRole,
      studentId: resolvedStudentDbId || resolvedStudentId,
      studentIdentifier: resolvedStudentId,
    }),
    {
      path: '/',
      httpOnly: false,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
    }
  );

  // 3. Redirect to appropriate role dashboard
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
  let email = 'student1@examguard.com';
  let password = 'password123';

  if (role === 'instructor') {
    email = 'instructor@examguard.com';
    password = 'password123';
  } else if (role === 'admin') {
    email = 'admin@examguard.com';
    password = 'password123';
  }

  const formData = new FormData();
  formData.set('email', email);
  formData.set('password', password);
  formData.set('role', role);

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

  if (role !== 'student' && role !== 'instructor' && role !== 'admin') {
    return { error: 'Invalid role selection' };
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

