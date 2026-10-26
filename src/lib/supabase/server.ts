import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Klien atas nama pengguna (anon key + cookie sesi): tertakluk RLS. Service-role JANGAN di sini.
export async function createClient() {
  const store = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => store.getAll(),
      setAll(list) {
        try { list.forEach(({ name, value, options }) => store.set(name, value, options)); }
        catch { /* dipanggil dari Server Component: middleware yang segarkan sesi */ }
      },
    },
  });
}
