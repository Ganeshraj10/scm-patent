import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { verifySessionToken } from '@/lib/services/sessionAuth';

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

  const pathname = request.nextUrl.pathname;
  const isProtectedStudentRoute = pathname.startsWith('/student');
  const isProtectedInstructorRoute = pathname.startsWith('/instructor');
  const isProtectedAdminRoute = pathname.startsWith('/admin');
  const isProtectedRoute = isProtectedStudentRoute || isProtectedInstructorRoute || isProtectedAdminRoute;

  // 1. Authenticate with Supabase identity (never trust unverified client cookies for authorization)
  let user: any = null;
  let verifiedRole: string | null = null;

  try {
    const authPromise = supabase.auth.getUser();
    const timeoutPromise = new Promise<any>((resolve) =>
      setTimeout(() => resolve({ data: { user: null }, error: new Error('Auth timeout') }), 1000)
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

      if (profile?.role) {
        verifiedRole = profile.role;
      } else {
        // Fall back to cryptographically signed JWT claims, never unverified cookies
        verifiedRole = user.app_metadata?.role || user.user_metadata?.role || 'student';
      }
    }
  } catch {
    user = null;
  }

  // 2. If Supabase session is not present or offline, verify cryptographic signed session token.
  // The raw plaintext cookie 'examguard_role' is NEVER trusted for authorization.
  if (!verifiedRole) {
    const sessionCookie = request.cookies.get('examguard_session')?.value;
    if (sessionCookie) {
      const sessionPayload = await verifySessionToken(sessionCookie);
      if (sessionPayload) {
        verifiedRole = sessionPayload.role;
        user = {
          id: sessionPayload.userId,
          email: sessionPayload.email,
          role: sessionPayload.role,
        };
      }
    }
  }

  // 3. Reject unauthenticated access to protected routes
  if (isProtectedRoute && (!user || !verifiedRole)) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('redirect', pathname);
    const redirectResponse = NextResponse.redirect(url);
    // Erase untrusted/forged cookies
    redirectResponse.cookies.delete('examguard_session');
    redirectResponse.cookies.delete('examguard_role');
    redirectResponse.cookies.delete('examguard_user');
    return redirectResponse;
  }

  // 4. Overwrite client display cookie with authoritative server-verified role
  if (verifiedRole) {
    supabaseResponse.cookies.set('examguard_role', verifiedRole, {
      path: '/',
      httpOnly: false,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
    });
  }

  // 5. Enforce strict role-based access control (RBAC) on protected routes
  if (isProtectedRoute && verifiedRole) {
    // Admin Routes: Strictly admin only
    if (isProtectedAdminRoute && verifiedRole !== 'admin') {
      const url = request.nextUrl.clone();
      url.pathname = '/access-denied';
      return NextResponse.redirect(url);
    }

    // Instructor Routes: Instructor and Admin only
    if (isProtectedInstructorRoute && verifiedRole !== 'instructor' && verifiedRole !== 'admin') {
      const url = request.nextUrl.clone();
      url.pathname = '/access-denied';
      return NextResponse.redirect(url);
    }

    // Student Routes: Student and Admin only
    if (isProtectedStudentRoute && verifiedRole !== 'student' && verifiedRole !== 'admin') {
      const url = request.nextUrl.clone();
      url.pathname = '/access-denied';
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
