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

  // We could implement more strict role checking here, but for now
  // we are handling it mainly by relying on the application routing
  // or verifying the role in the specific layout/pages.

  return supabaseResponse;
}
