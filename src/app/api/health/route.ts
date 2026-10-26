import { createClient } from "@supabase/supabase-js";

// Dipanggil cron VPS setiap hari: query sebenar supaya Supabase Free tak di-pause (CLAUDE.md bahagian 3).
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false },
    });
    const { error } = await db.from("courses").select("id").limit(1);
    if (error) throw error;
    return Response.json({ ok: true }, { headers: { "cache-control": "no-store" } });
  } catch {
    // Tiada butiran ralat dalam respons awam.
    return Response.json({ ok: false }, { status: 503, headers: { "cache-control": "no-store" } });
  }
}
