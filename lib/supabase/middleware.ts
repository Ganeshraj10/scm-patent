import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // refreshing the auth token
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Basic routing protection
  // Determine if this is a protected route
  const isProtectedStudentRoute = request.nextUrl.pathname.startsWith('/student');
  const isProtectedInstructorRoute = request.nextUrl.pathname.startsWith('/instructor');

  if (!user && (isProtectedStudentRoute || isProtectedInstructorRoute)) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  if (user && (isProtectedStudentRoute || isProtectedInstructorRoute)) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    const canUseStudentArea = profile?.role === 'student';
    const canUseInstructorArea = profile?.role === 'instructor' || profile?.role === 'admin';

    if ((isProtectedStudentRoute && !canUseStudentArea) ||
        (isProtectedInstructorRoute && !canUseInstructorArea)) {
      const url = request.nextUrl.clone();
      url.pathname = profile?.role === 'student' ? '/student/dashboard' : '/instructor/dashboard';
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
