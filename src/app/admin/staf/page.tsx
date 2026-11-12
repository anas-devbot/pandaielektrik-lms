import { requireRole } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/admin";
import { NyahaktifForm, TambahStafForm, UbahPerananForm } from "./forms";

export const dynamic = "force-dynamic";
const fmt = (iso?: string | null) => (iso ? new Intl.DateTimeFormat("ms-MY", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kuala_Lumpur" }).format(new Date(iso)) : "belum pernah");
const ORDER: Record<string, number> = { admin: 0, approver: 1, reviewer: 2 };

export default async function Page() {
  const me = await requireRole(["admin"]);
  const db = adminClient();
  const { data: profs } = await db.from("profiles").select("id, full_name, role").in("role", ["admin", "approver", "reviewer"]);
  // Staf sedikit: ambil emel dan log masuk terakhir satu demi satu (auth.users tidak boleh dibaca melalui REST).
  const rows = await Promise.all((profs ?? []).map(async (p) => {
    const { data } = await db.auth.admin.getUserById(p.id);
    return { ...p, email: data.user?.email ?? "-", last: data.user?.last_sign_in_at ?? null };
  }));
  rows.sort((a, b) => (ORDER[a.role] - ORDER[b.role]) || a.full_name.localeCompare(b.full_name));

  return (
    <main>
      <h1 className="font-serif text-2xl font-semibold">Staf</h1>
      <p className="mt-0.5 text-sm text-muted">{rows.length} staf. Hanya admin boleh menambah dan mengubah. Menyahaktif membuang peranan dan menyekat log masuk; akaun dan rekod tidak dipadam.</p>

      <section className="mt-5 overflow-hidden rounded-lg border border-border bg-surface">
        <h2 className="border-b border-border px-3.5 py-3 text-[15px] font-semibold">Senarai staf</h2>
        {rows.length === 0 && <p className="px-3.5 py-3 text-sm text-muted">Tiada staf.</p>}
        {rows.map((r) => (
          <div key={r.id} className="border-b border-border px-3.5 py-3 last:border-b-0">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <p className="font-semibold">{r.full_name}{r.id === me.id && <span className="ml-2 text-xs font-normal text-muted">(anda)</span>}</p>
              <span className="rounded-full border border-border bg-paper px-2 py-0.5 text-xs font-semibold">{r.role}</span>
            </div>
            <p className="break-words text-sm text-muted">{r.email} · log masuk terakhir: {fmt(r.last)}</p>
            {r.id !== me.id ? (
              <details className="mt-2">
                <summary className="inline-flex min-h-10 cursor-pointer items-center text-sm font-semibold text-gold-text underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-info">Ubah peranan atau nyahaktif</summary>
                <div className="mt-2 grid gap-5 rounded-lg border border-border bg-paper p-3 md:grid-cols-2">
                  <UbahPerananForm target={r.id} role={r.role} />
                  <NyahaktifForm target={r.id} />
                </div>
              </details>
            ) : <p className="mt-1 text-xs text-muted">Anda tidak boleh mengubah akaun sendiri.</p>}
          </div>
        ))}
      </section>

      <section className="mt-6 rounded-lg border border-border bg-surface p-4">
        <h2 className="text-[15px] font-semibold">Tambah staf</h2>
        <p className="mb-3 mt-1 text-xs text-muted">Akaun dicipta dengan kata laluan sementara yang dipaparkan sekali kepada anda sahaja (tidak disimpan dan tidak masuk log). Hanya peranan admin (bukan approver) boleh menggunakan halaman ini.</p>
        <TambahStafForm />
      </section>
    </main>
  );
}
