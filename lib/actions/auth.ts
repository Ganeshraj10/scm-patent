'use server';

import { createClient } from '@/lib/supabase/server';
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
    // If no profile, they are in a weird state.
    // For now we will route them to login with error.
    await supabase.auth.signOut();
    return { error: 'No profile found for this user.' };
  }

  if (profile.role === 'student') {
    redirect('/student/dashboard');
  } else if (profile.role === 'instructor') {
    redirect('/instructor/dashboard');
  } else if (profile.role === 'admin') {
    redirect('/admin/dashboard');
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

  // 1. Sign up the user
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
      },
    },
  });

  if (authError) {
    return { error: authError.message };
  }

  if (!authData.user) {
    return { error: 'User creation failed' };
  }

  // 2. Create the profile
  const { error: profileError } = await supabase
    .from('profiles')
    .insert({
      id: authData.user.id,
      full_name: fullName,
      email: email,
      role: role,
    });

  if (profileError) {
    // Note: in a real production system we should handle rollback or rely on triggers
    console.error('Profile creation error:', profileError);
    return { error: 'Failed to create user profile.' };
  }

  // 3. Create role-specific record
  if (role === 'student') {
    const { error: studentError } = await supabase
      .from('students')
      .insert({
        profile_id: authData.user.id,
        student_identifier: `STU-${Math.floor(Math.random() * 100000).toString().padStart(5, '0')}`,
        current_device_type: 'desktop', // default for now
      });
      
    if (studentError) {
       console.error('Student creation error:', studentError);
       return { error: 'Failed to create student record.' };
    }
    
  } else if (role === 'instructor') {
    const { error: instructorError } = await supabase
      .from('instructors')
      .insert({
        profile_id: authData.user.id,
      });
      
    if (instructorError) {
       console.error('Instructor creation error:', instructorError);
       return { error: 'Failed to create instructor record.' };
    }
  }

  // 4. Redirect to appropriate dashboard
  if (role === 'student') {
    redirect('/student/dashboard');
  } else {
    redirect('/instructor/dashboard');
  }
}
