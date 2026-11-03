import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const url = (
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    'https://qkuwbsewryvbdoiyhrfd.supabase.co'
  ).trim();

  const key = (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    'sb_publishable_fq5yUjqffI_D-sYfQBOOcw_WS6Xervu'
  ).trim();

  const supabase = createServerClient(
    url,
    key,
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

  // 1. Check Session Role Cookie (for seamless 3-role switching and demo accounts)
  const cookieRole = request.cookies.get('examguard_role')?.value;

  const pathname = request.nextUrl.pathname;
  const isProtectedStudentRoute = pathname.startsWith('/student');
  const isProtectedInstructorRoute = pathname.startsWith('/instructor');
  const isProtectedAdminRoute = pathname.startsWith('/admin');
  const isProtectedRoute = isProtectedStudentRoute || isProtectedInstructorRoute || isProtectedAdminRoute;

  // Determine effective authenticated role
  let role: string | null = cookieRole || null;
  let user: any = null;

  // Only query Supabase auth if role is not already established by cookie and route is protected
  if (!role && isProtectedRoute) {
    try {
      const authPromise = supabase.auth.getUser();
      const timeoutPromise = new Promise<any>((resolve) =>
        setTimeout(() => resolve({ data: { user: null } }), 1200)
      );
      const { data: authData } = await Promise.race([authPromise, timeoutPromise]);
      user = authData?.user;

      if (user) {
        const profilePromise = supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .maybeSingle();
        const profileTimeout = new Promise<any>((resolve) =>
          setTimeout(() => resolve({ data: null }), 1000)
        );
        const { data: profile } = await Promise.race([profilePromise, profileTimeout]);
        role = profile?.role || 'student';
      }
    } catch {
      // Supabase unreachable or offline, proceed with role resolution
    }
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
