import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

const PROTECTED_ADMIN_PATHS = ["/dashboard"];
const AUTH_PATHS = ["/login", "/signup"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const { supabase, user, supabaseResponse } = await updateSession(request);

  const isAdminRoute = PROTECTED_ADMIN_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );
  const isAuthRoute = AUTH_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );

  if (user) {
    // ── Redirect logged-in users away from auth pages (no DB needed) ──
    if (isAuthRoute) {
      const homeUrl = request.nextUrl.clone();
      homeUrl.pathname = "/";
      return NextResponse.redirect(homeUrl);
    }

    // ── Only query DB for protected admin routes (not every page) ─────
    if (isAdminRoute) {
      const { data: profile } = await supabase
        .from("users_profile")
        .select("is_banned, role")
        .eq("id", user.id)
        .single();

      if (profile?.is_banned) {
        await supabase.auth.signOut();
        const bannedUrl = request.nextUrl.clone();
        bannedUrl.pathname = "/login";
        bannedUrl.searchParams.set("error", "banned");
        return NextResponse.redirect(bannedUrl);
      }

      if (profile?.role !== "admin") {
        const homeUrl = request.nextUrl.clone();
        homeUrl.pathname = "/";
        return NextResponse.redirect(homeUrl);
      }
    }
  } else {
    // ── Unauthenticated users cannot access /dashboard ────────
    if (isAdminRoute) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/login";
      loginUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public assets (svg, png, jpg, etc.)
     */
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
