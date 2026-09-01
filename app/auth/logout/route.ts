import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
  } catch (err) {
    // Ignore error
  }

  const cookieStore = await cookies();
  cookieStore.delete('examguard_role');
  cookieStore.delete('examguard_user');

  return NextResponse.redirect(new URL('/login', request.url));
}

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
  } catch (err) {
    // Ignore error
  }

  const cookieStore = await cookies();
  cookieStore.delete('examguard_role');
  cookieStore.delete('examguard_user');

  return NextResponse.redirect(new URL('/login', request.url));
}
