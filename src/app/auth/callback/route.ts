import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/auth";

// Pautan dalam emel (pengesahan daftar dan tetapan semula kata laluan) tiba di sini dengan ?code= (PKCE).
// Tukar kod kepada sesi, kemudian ke `next` (hanya laluan dalaman, lihat safeNext).
export async function GET(req: NextRequest) {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? req.url;
  const code = req.nextUrl.searchParams.get("code");
  const next = safeNext(req.nextUrl.searchParams.get("next")) ?? "/dashboard";
  if (!code) return NextResponse.redirect(new URL("/log-masuk", base));
  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(new URL("/lupa-kata-laluan?ralat=pautan", base));
  return NextResponse.redirect(new URL(next, base));
}
