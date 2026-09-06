import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

const SESSION_COOKIE = "fm_session";

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/transactions",
  "/budgets",
  "/goals",
  "/bills",
  "/subscriptions",
  "/reports",
  "/assistant",
  "/sandbox-payment",
  "/settings",
  "/admin",
];
const AUTH_PAGES = ["/login", "/signup"];

async function hasValidSessionCookie(req: NextRequest): Promise<boolean> {
  const jwt = req.cookies.get(SESSION_COOKIE)?.value;
  const secret = process.env.AUTH_SECRET;
  if (!jwt || !secret) return false;
  try {
    await jwtVerify(jwt, new TextEncoder().encode(secret));
    return true;
  } catch {
    return false;
  }
}

/**
 * Cheap first line of defence: checks the signed cookie only.
 * Pages and actions still validate the session against the database.
 */
export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isProtected = PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const isAuthPage = AUTH_PAGES.includes(pathname);
  if (!isProtected && !isAuthPage) return NextResponse.next();

  const authed = await hasValidSessionCookie(req);

  if (isProtected && !authed) {
    const url = new URL("/login", req.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  if (isAuthPage && authed) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
