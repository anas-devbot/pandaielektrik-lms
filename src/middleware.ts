import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Segarkan sesi dan halang tetamu daripada kawasan log masuk. Semakan PERANAN dibuat dalam setiap halaman (requireRole).
export async function middleware(req: NextRequest) {
  let res = NextResponse.next({ request: req });
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
    const url = req.nextUrl.clone();
    url.pathname = "/log-masuk";
    url.search = `?next=${encodeURIComponent(req.nextUrl.pathname)}`;
    return NextResponse.redirect(url);
  }
  return res;
}

export const config = { matcher: ["/dashboard/:path*", "/staff/:path*", "/admin/:path*"] };
