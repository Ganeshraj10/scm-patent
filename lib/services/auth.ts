import { createClient as createServerClient } from '@/lib/supabase/server';
import { createClient as createBrowserClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';

// Get current authenticated user
export async function getCurrentUser(): Promise<User | null> {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

// Get the user's profile from the database
export async function getCurrentProfile() {
  const user = await getCurrentUser();
  if (!user) return null;

  const supabase = await createServerClient();
  
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (error || !profile) {
    console.error('Error fetching profile:', error);
    return null;
  }
  
  return profile;
}

// Helper to check user role directly
export async function getCurrentRole(): Promise<string | null> {
  const profile = await getCurrentProfile();
  return profile?.role ?? null;
}

// Client-side variants for components that need them (optional, typically we use server components for auth logic)
export async function getCurrentUserClient() {
  const supabase = createBrowserClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function getCurrentProfileClient() {
  const user = await getCurrentUserClient();
  if (!user) return null;

  const supabase = createBrowserClient();
  
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (error || !profile) {
    return null;
  }
  
  return profile;
}
