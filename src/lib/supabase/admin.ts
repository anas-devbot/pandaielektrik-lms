import "server-only";
import { createClient } from "@supabase/supabase-js";

// Service-role: BYPASS RLS. Server sahaja (CLAUDE.md #5). Jangan import dalam komponen klien.
export function adminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
}
