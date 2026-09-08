import { jwtVerify } from "jose";
import { NextResponse, type NextRequest } from "next/server";

// Edge-safe auth gate. Public: /login, /checkin/*, static assets.
// Everything else needs a valid session cookie. Mutations must come from
// our own origin (CSRF guard, build-spec §3 screen 1).
const COOKIE = "na_session";

async function valid(token: string | undefined) {
  if (!token) return false;
  try {
    await jwtVerify(token, new TextEncoder().encode(process.env.SESSION_SECRET ?? ""), {
      algorithms: ["HS256"],
    });
    return true;
  } catch {
    return false;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (req.method !== "GET" && req.method !== "HEAD") {
    const origin = req.headers.get("origin");
    const host = req.headers.get("host");
    if (origin && host && new URL(origin).host !== host) {
      return new NextResponse("Cross-origin request blocked", { status: 403 });
    }
  }

  const isPublic = pathname === "/login" || pathname === "/api/health" || pathname.startsWith("/checkin/");
  const authed = await valid(req.cookies.get(COOKIE)?.value);

  if (!isPublic && !authed) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  if (pathname === "/login" && authed) {
    return NextResponse.redirect(new URL("/", req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|ico|woff2?)$).*)"],
};
