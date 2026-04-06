import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  SESSION_START_COOKIE,
  SESSION_WALL_MS,
} from "@/lib/session-constants";

async function signOutAndRedirectToLogin(
  request: NextRequest,
  supabaseUrl: string,
  anonKey: string
) {
  const redirectRes = NextResponse.redirect(new URL("/login", request.url));
  redirectRes.cookies.delete(SESSION_START_COOKIE);

  const supabase = createServerClient(supabaseUrl, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) =>
          redirectRes.cookies.set(name, value, options)
        );
      },
    },
  });

  await supabase.auth.signOut();
  return redirectRes;
}

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

  if (!url || !anon) {
    return supabaseResponse;
  }

  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isLogin = path === "/login";

  const isProtected =
    path === "/" ||
    path.startsWith("/nova-pauta") ||
    path.startsWith("/pauta/") ||
    path.startsWith("/admin") ||
    path.startsWith("/escala") ||
    path.startsWith("/radar-pautas") ||
    path.startsWith("/ronda") ||
    path.startsWith("/api/ronda");

  let sessionStartTs: number | null = null;
  if (user) {
    const startRaw = request.cookies.get(SESSION_START_COOKIE)?.value;
    sessionStartTs =
      startRaw && /^\d{10,}$/.test(startRaw) ? Number(startRaw) : null;

    if (sessionStartTs != null && Date.now() - sessionStartTs > SESSION_WALL_MS) {
      return signOutAndRedirectToLogin(request, url, anon);
    }
  }

  if (!user && isProtected && !isLogin) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("next", path);
    const r = NextResponse.redirect(redirectUrl);
    r.cookies.delete(SESSION_START_COOKIE);
    return r;
  }

  if (user && isLogin) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/";
    redirectUrl.searchParams.delete("next");
    return NextResponse.redirect(redirectUrl);
  }

  if (!user && request.cookies.has(SESSION_START_COOKIE)) {
    supabaseResponse.cookies.delete(SESSION_START_COOKIE);
  }

  if (user && sessionStartTs == null && !isLogin && isProtected) {
    supabaseResponse.cookies.set(SESSION_START_COOKIE, String(Date.now()), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: Math.floor(SESSION_WALL_MS / 1000),
    });
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
