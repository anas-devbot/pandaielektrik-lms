import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { REF_COOKIE, REF_COOKIE_MAX_AGE_SEC, encodeRefCookie, parseRefParam } from "@/lib/affiliate";

// Laluan yang perlu log masuk. Laluan lain (landing, /affiliate) hanya terima atribusi ?ref=.
const PROTECTED = /^\/(dashboard|staff|admin|beli|pesanan|belajar|kuiz|bahagian2|praktikal|refund|affiliate\/dashboard)(\/|$)/;

// Segarkan sesi dan halang tetamu daripada kawasan log masuk. Semakan PERANAN dibuat dalam setiap halaman (requireRole).
export async function middleware(req: NextRequest) {
  let res = NextResponse.next({ request: req });
  if (!PROTECTED.test(req.nextUrl.pathname)) return withRef(res, req);

  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll(list) {
        list.forEach(({ name, value }) => req.cookies.set(name, value));
        res = NextResponse.next({ request: req });
        list.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
      },
    },
  });
  const { data: { user } } = await supabase.auth.getUser(); // getUser (sahkan ke server auth), bukan getSession
  if (!user) {
    // Asas dari NEXT_PUBLIC_SITE_URL: di belakang nginx, nextUrl.host ialah 127.0.0.1:3100 (standalone), bukan domain awam.
    const url = new URL(`/log-masuk?next=${encodeURIComponent(req.nextUrl.pathname)}`, process.env.NEXT_PUBLIC_SITE_URL ?? req.url);
    return NextResponse.redirect(url);
  }
  return withRef(res, req);
}

// ?ref=KODE → cookie "ref" (last-click, first-party, set di server). Kod tak sah diabaikan senyap.
// Tempoh sebenar (config affiliate_cookie_days) disemak semasa checkout, bukan di sini.
function withRef(res: NextResponse, req: NextRequest) {
  const code = parseRefParam(req.nextUrl.searchParams.get("ref"));
  if (code) {
    res.cookies.set(REF_COOKIE, encodeRefCookie(code, Math.floor(Date.now() / 1000)), {
      httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: REF_COOKIE_MAX_AGE_SEC,
    });
  }
  return res;
}

export const config = { matcher: ["/", "/affiliate", "/dashboard/:path*", "/staff/:path*", "/admin/:path*", "/beli/:path*", "/pesanan/:path*", "/belajar/:path*", "/kuiz/:path*", "/bahagian2/:path*", "/praktikal/:path*", "/refund/:path*", "/affiliate/dashboard/:path*"] };
