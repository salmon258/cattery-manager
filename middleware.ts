import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { persistAuthCookieOptions } from '@/lib/supabase/cookie-options';

const PUBLIC_PATHS = ['/login', '/auth/callback', '/auth/signout'];

// Matches every chunk of the Supabase auth cookie (`sb-<ref>-auth-token` plus
// `sb-<ref>-auth-token.0`, `.1`, … when the JWT is large enough to chunk).
const SESSION_COOKIE_RE = /^sb-.*-auth-token(\.\d+)?$/;

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet: { name: string; value: string; options: CookieOptions }[]) => {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, persistAuthCookieOptions(name, options))
          );
        }
      }
    }
  );

  const {
    data: { user },
    error: authError
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'));

  // If getUser() failed but the session cookies are still sitting on the
  // request, it's almost always a refresh-token rotation race from parallel
  // requests (another concurrent request just rotated the refresh token out
  // from under this one). Bouncing the sitter to /login here wipes them out
  // mid-action. Letting the request through is safe — the route handler
  // will revalidate on its own, and the browser client's auto-refresh will
  // heal the state on the next tick.
  const hasSessionCookie = request.cookies
    .getAll()
    .some((c) => SESSION_COOKIE_RE.test(c.name));

  if (!user && authError && hasSessionCookie && !isPublic) {
    return response;
  }

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('redirect', pathname);
    return NextResponse.redirect(url);
  }

  if (user && pathname === '/login') {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$|api/public).*)']
};
