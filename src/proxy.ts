/**
 * Route protection (Next.js 16 "proxy" convention — formerly middleware.ts).
 * Only verifies the JWT signature/expiry — never touches the database.
 * Real, database-backed authorization happens in requireUser()/requireAdmin().
 */
import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

const PUBLIC_PREFIXES = ["/login", "/s/", "/api/cron"];
export const ADMIN_ONLY_PREFIXES = ["/staff", "/settings"];

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p))) {
    return NextResponse.next();
  }
  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = pathname !== "/" ? `?next=${encodeURIComponent(pathname)}` : "";
    return NextResponse.redirect(url);
  }
  if (session.role !== "admin" && ADMIN_ONLY_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    const url = req.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = `?error=${encodeURIComponent("That area is restricted to administrators.")}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|svg|jpg|ico|css|js)$).*)"],
};
