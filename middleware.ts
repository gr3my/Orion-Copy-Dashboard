import { NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE = "orion_session";

// Exact public pages (no session required).
const PUBLIC_PAGES = new Set(["/", "/status", "/login", "/favicon.ico", "/icon.svg"]);

// Explicit public API allowlist. Every other /api/* route requires a session
// cookie here AND authentication + permission checks in its handler.
const PUBLIC_API = new Set([
  "/api/session", // login / logout
  "/api/status", // public status snapshot
  "/api/me", // auth probe (returns { loggedIn: false } when signed out)
]);

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/_next")) return NextResponse.next();
  if (PUBLIC_PAGES.has(pathname)) return NextResponse.next();
  if (pathname.startsWith("/api/")) {
    if (PUBLIC_API.has(pathname)) return NextResponse.next();
    if (!req.cookies.get(SESSION_COOKIE)) {
      return NextResponse.json({ error: "Not signed in." }, { status: 401 });
    }
    return NextResponse.next();
  }
  if (!req.cookies.get(SESSION_COOKIE)) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/((?!_next/static|_next/image).*)"] };
