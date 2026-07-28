import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  SESSION_START_COOKIE,
  SESSION_WALL_MS,
} from "@/lib/session-constants";

type MiddlewareUser = {
  id: string;
  email?: string;
};

function noStore(res: NextResponse) {
  res.headers.set(
    "Cache-Control",
    "private, no-store, max-age=0, must-revalidate"
  );
  return res;
}

function loginUrl(request: NextRequest): URL {
  const redirectUrl = request.nextUrl.clone();
  redirectUrl.pathname = "/login";
  redirectUrl.search = "";
  return redirectUrl;
}

/** Na Vercel (ou com AUTH_MIDDLEWARE_NETWORK=1) valida no Auth API. */
function useNetworkAuth(): boolean {
  return (
    process.env.VERCEL === "1" ||
    process.env.AUTH_MIDDLEWARE_NETWORK === "1"
  );
}

/**
 * Lê access_token dos cookies sb-*-auth-token (inclui chunks .0/.1…)
 * sem chamar a rede — evita spam de fetch failed atrás de proxy corporativo.
 */
function readAccessTokenFromCookies(request: NextRequest): string | null {
  const cookies = request.cookies.getAll();
  const tokenCookies = cookies.filter((c) =>
    /auth-token(\.\d+)?$/i.test(c.name)
  );
  if (tokenCookies.length === 0) return null;

  const single = tokenCookies.find((c) => !/\.\d+$/.test(c.name));
  const chunks = tokenCookies
    .filter((c) => /\.\d+$/.test(c.name))
    .sort((a, b) => {
      const na = Number(a.name.slice(a.name.lastIndexOf(".") + 1));
      const nb = Number(b.name.slice(b.name.lastIndexOf(".") + 1));
      return na - nb;
    });

  const raw = single?.value ?? chunks.map((c) => c.value).join("");
  if (!raw) return null;

  try {
    let text = raw;
    if (text.startsWith("base64-")) {
      const b64 = text.slice("base64-".length).replace(/-/g, "+").replace(/_/g, "/");
      text = atob(b64);
    } else {
      try {
        text = decodeURIComponent(text);
      } catch {
        /* já é texto */
      }
    }

    const data = JSON.parse(text) as
      | { access_token?: string }
      | [{ access_token?: string }];
    if (Array.isArray(data)) {
      return data[0]?.access_token?.trim() || null;
    }
    return data.access_token?.trim() || null;
  } catch {
    return null;
  }
}

function userFromAccessToken(token: string): MiddlewareUser | null {
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    const b64 = part.replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
    const payload = JSON.parse(atob(b64 + pad)) as {
      sub?: string;
      email?: string;
      exp?: number;
    };
    if (typeof payload.sub !== "string" || !payload.sub) return null;
    if (
      typeof payload.exp === "number" &&
      payload.exp * 1000 < Date.now()
    ) {
      return null;
    }
    return {
      id: payload.sub,
      email: typeof payload.email === "string" ? payload.email : undefined,
    };
  } catch {
    return null;
  }
}

async function signOutOnResponse(
  request: NextRequest,
  response: NextResponse,
  supabaseUrl: string,
  anonKey: string
) {
  response.cookies.delete(SESSION_START_COOKIE);

  // Limpa cookies de auth localmente (sem rede).
  for (const c of request.cookies.getAll()) {
    if (/auth-token/i.test(c.name)) {
      response.cookies.set(c.name, "", { path: "/", maxAge: 0 });
    }
  }

  if (!useNetworkAuth()) return;

  try {
    const supabase = createServerClient(supabaseUrl, anonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    });
    await supabase.auth.signOut();
  } catch {
    // Rede/proxy: cookies locais já foram limpos.
  }
}

async function signOutAndRedirectToLogin(
  request: NextRequest,
  supabaseUrl: string,
  anonKey: string
) {
  const redirectRes = noStore(NextResponse.redirect(loginUrl(request)));
  await signOutOnResponse(request, redirectRes, supabaseUrl, anonKey);
  return redirectRes;
}

async function resolveUser(
  request: NextRequest,
  supabaseUrl: string,
  anonKey: string,
  onCookiesUpdated: (response: NextResponse) => void
): Promise<MiddlewareUser | null> {
  if (!useNetworkAuth()) {
    const token = readAccessTokenFromCookies(request);
    return token ? userFromAccessToken(token) : null;
  }

  let supabaseResponse = NextResponse.next({ request });
  const supabase = createServerClient(supabaseUrl, anonKey, {
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
        onCookiesUpdated(supabaseResponse);
      },
    },
  });

  try {
    const { data, error } = await supabase.auth.getUser();
    if (error) {
      console.warn(
        "[middleware] Supabase auth indisponível; seguindo sem sessão.",
        error.message
      );
      return null;
    }
    const u = data.user;
    if (!u) return null;
    return { id: u.id, email: u.email ?? undefined };
  } catch (e) {
    console.warn(
      "[middleware] Supabase auth indisponível; seguindo sem sessão.",
      e instanceof Error ? e.message : e
    );
    return null;
  }
}

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

  if (!url || !anon) {
    return supabaseResponse;
  }

  const user = await resolveUser(request, url, anon, (res) => {
    supabaseResponse = res;
  });

  const path = request.nextUrl.pathname;
  const isLogin = path === "/login";
  const isPublicAuth =
    isLogin ||
    path === "/esqueci-senha" ||
    path === "/atualizar-senha";

  const isProtected =
    path === "/" ||
    path.startsWith("/nova-pauta") ||
    path.startsWith("/pauta/") ||
    path.startsWith("/admin") ||
    path.startsWith("/escala") ||
    path.startsWith("/radar-pautas") ||
    path.startsWith("/ronda-rss") ||
    path.startsWith("/ronda") ||
    path.startsWith("/api/ronda-rss") ||
    path.startsWith("/api/ronda");

  let sessionStartTs: number | null = null;
  let sessionExpired = false;
  if (user) {
    const startRaw = request.cookies.get(SESSION_START_COOKIE)?.value;
    sessionStartTs =
      startRaw && /^\d{10,}$/.test(startRaw) ? Number(startRaw) : null;
    sessionExpired =
      sessionStartTs != null &&
      Date.now() - sessionStartTs > SESSION_WALL_MS;

    if (sessionExpired) {
      if (isLogin) {
        const res = noStore(NextResponse.next({ request }));
        await signOutOnResponse(request, res, url, anon);
        return res;
      }
      return signOutAndRedirectToLogin(request, url, anon);
    }
  }

  if (!user && isProtected && !isPublicAuth) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("next", path);
    const r = noStore(NextResponse.redirect(redirectUrl));
    r.cookies.delete(SESSION_START_COOKIE);
    return r;
  }

  if (user && isLogin) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/";
    redirectUrl.searchParams.delete("next");
    return noStore(NextResponse.redirect(redirectUrl));
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

  if (isPublicAuth) {
    noStore(supabaseResponse);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
