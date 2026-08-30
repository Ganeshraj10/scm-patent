'use server';

import { createClient } from '@/lib/supabase/server';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

export async function login(formData: FormData) {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;
  
  if (!email || !password) {
    return { error: 'Email and password are required' };
  }

  const supabase = await createClient();

  const { error, data } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: error.message };
  }
  
  // Find their role and redirect
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', data.user.id)
    .single();
    
  if (!profile) {
    // Auto-heal missing profile row if user was created before trigger
    const role = (data.user.user_metadata?.role as string) || 'student';
    const fullName = (data.user.user_metadata?.full_name as string) || data.user.email?.split('@')[0] || 'User';
    
    await supabase.from('profiles').upsert({
      id: data.user.id,
      email: data.user.email,
      full_name: fullName,
      role: role,
    });

    if (role === 'student') {
      await supabase.from('students').upsert({
        profile_id: data.user.id,
        student_identifier: `STU-${data.user.id.slice(0, 8).toUpperCase()}`,
        department: 'Computer Science',
        enrollment_year: new Date().getFullYear(),
        current_device_type: 'desktop'
      });
      redirect('/student/dashboard');
    } else {
      await supabase.from('instructors').upsert({
        profile_id: data.user.id
      });
      redirect('/instructor/dashboard');
    }
  }

  if (profile.role === 'student') {
    redirect('/student/dashboard');
  } else if (profile.role === 'instructor' || profile.role === 'admin') {
    redirect('/instructor/dashboard');
  }
  
  redirect('/');
}

export async function register(formData: FormData) {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;
  const fullName = formData.get('full_name') as string;
  const role = formData.get('role') as string;

  if (!email || !password || !fullName || !role) {
    return { error: 'All fields are required' };
  }
  
  if (role !== 'student' && role !== 'instructor') {
    return { error: 'Invalid role selection' };
  }

  const supabase = await createClient();
  const requestHeaders = await headers();
  const forwardedHost = requestHeaders.get('x-forwarded-host');
  const host = forwardedHost ?? requestHeaders.get('host');
  const protocol = requestHeaders.get('x-forwarded-proto') ?? 'http';
  const emailRedirectTo = host
    ? `${protocol}://${host}/auth/callback`
    : undefined;

  // The database trigger created by migration 14 provisions profiles and the
  // role-specific row. Keeping this out of the browser avoids duplicate rows
  // and works when email confirmation means there is no session yet.
  const { data: authData, error: authError } = await supabase.auth.signUp({
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

  if (authError) {
    return { error: authError.message };
  }

  if (!authData.user) {
    return { error: 'User creation failed' };
  }

  if (!authData.session) {
    return {
      message: 'Account created. Check your email to confirm your address, then sign in.',
    };
  }

  // A session is present only when email confirmation is disabled or has
  // already occurred. The trigger has provisioned the profile at this point.
  if (role === 'student') {
    redirect('/student/dashboard');
  } else {
    redirect('/instructor/dashboard');
  }
}
