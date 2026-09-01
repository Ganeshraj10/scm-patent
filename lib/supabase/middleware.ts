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

  // 1. Check Supabase authenticated user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 2. Check Session Role Cookie (for seamless 3-role switching and demo accounts)
  const cookieRole = request.cookies.get('examguard_role')?.value;

  const pathname = request.nextUrl.pathname;
  const isProtectedStudentRoute = pathname.startsWith('/student');
  const isProtectedInstructorRoute = pathname.startsWith('/instructor');
  const isProtectedAdminRoute = pathname.startsWith('/admin');
  const isProtectedRoute = isProtectedStudentRoute || isProtectedInstructorRoute || isProtectedAdminRoute;

  // Determine effective authenticated role
  let role: string | null = cookieRole || null;

  if (user && !role) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    role = profile?.role || 'student';
  }

  // If unauthenticated and trying to access protected route
  if (!user && !role && isProtectedRoute) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // Enforce role-based access control
  if (role && isProtectedRoute) {
    // Admin Routes: Only admin allowed
    if (isProtectedAdminRoute && role !== 'admin') {
      const url = request.nextUrl.clone();
      url.pathname = '/access-denied';
      return NextResponse.redirect(url);
    }

    // Instructor Routes: Only instructor and admin allowed
    if (isProtectedInstructorRoute && role !== 'instructor' && role !== 'admin') {
      const url = request.nextUrl.clone();
      url.pathname = '/access-denied';
      return NextResponse.redirect(url);
    }

    // Student Routes: Students (or admin oversight) allowed
    if (isProtectedStudentRoute && role !== 'student' && role !== 'admin') {
      const url = request.nextUrl.clone();
      url.pathname = '/access-denied';
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
