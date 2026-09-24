import { NextResponse, type NextRequest } from "next/server";
import { ENROLL_PATH, LOGIN_PATH, PATHNAME_HEADER, SESSION_COOKIE_NAMES } from "@/server/auth/constants";

const PUBLIC_PREFIXES = [LOGIN_PATH, ENROLL_PATH, "/api/auth", "/api/health"];

function isPublic(pathname: string): boolean {
  return PUBLIC_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

// hanya cek keberadaan cookie; validasi sesi penuh tetap di requireViewer
export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (isPublic(pathname)) return NextResponse.next();
  if (SESSION_COOKIE_NAMES.some((name) => request.cookies.has(name))) {
    // layout server butuh path aktif untuk pengalihan onboarding tanpa kedipan
    const headers = new Headers(request.headers);
    headers.set(PATHNAME_HEADER, pathname);
    return NextResponse.next({ request: { headers } });
  }
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Sesimu berakhir. Masuk lagi untuk melanjutkan." }, { status: 401 });
  }
  const loginUrl = new URL(LOGIN_PATH, request.url);
  if (pathname !== "/") loginUrl.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|icons/|.*\\.(?:png|svg|ico|webp|jpg|woff2)$).*)"],
};
