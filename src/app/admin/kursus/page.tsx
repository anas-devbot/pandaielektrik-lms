import { requireRole } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/admin";
import { CONFIG_FIELDS, cfgGet } from "@/lib/config-fields";
import { OpForm } from "../op-form";

export const dynamic = "force-dynamic";
const MY = "Asia/Kuala_Lumpur";
const toLocal = (iso: string | null) => iso ? new Date(new Date(iso).getTime() + 8 * 3600e3).toISOString().slice(0, 16) : "";
const STATUS = [{ v: "draft", l: "Draf (tidak dipaparkan)" }, { v: "open", l: "Dibuka" }, { v: "full", l: "Penuh" }, { v: "closed", l: "Ditutup" }];

export default async function Page() {
  await requireRole(["admin"]);
  const db = adminClient();
  const { data: course } = await db.from("courses").select("id, title, price, currency, config").order("created_at").limit(1).single();
  const { data: sessions } = await db.from("course_sessions").select("*").eq("course_id", course!.id).order("starts_at");
  const cfg = course!.config as Record<string, unknown>;
  const groups = [...new Set(CONFIG_FIELDS.map((f) => f.group))];
  const disp = (v: unknown) => v === undefined || v === null ? "(belum ditetapkan)" : typeof v === "string" ? (v.length > 80 ? `${v.slice(0, 80)}…` : v || "(kosong)") : String(v);

  return (
    <main className="py-4">
      <h1 className="text-2xl font-semibold">Kursus &amp; sesi live</h1>
      <p className="text-sm">{course!.title} · RM{(course!.price / 100).toFixed(2)} (harga ditetapkan di DB; tidak diubah daripada sini)</p>

      <h2 className="mt-6 text-lg font-medium">Sesi kursus live</h2>
      <p className="text-xs">Tarikh dipaparkan di landing tanpa deploy. Masa dianggap waktu Malaysia (UTC+8). Status &quot;Draf&quot; tidak dipaparkan.</p>
      {(sessions ?? []).map((x) => (
        <section key={x.id} className="mt-2 rounded border p-3"><h3 className="text-sm font-medium">{new Intl.DateTimeFormat("ms-MY", { dateStyle: "full", timeStyle: "short", timeZone: MY }).format(new Date(x.starts_at))} · {x.status}</h3>
          <OpForm op="session" hidden={{ id: x.id }} submit="Kemas kini sesi" fields={[
            { name: "starts_at", label: "Mula", type: "datetime-local", required: true, defaultValue: toLocal(x.starts_at) }, { name: "ends_at", label: "Tamat (pilihan)", type: "datetime-local", defaultValue: toLocal(x.ends_at) },
            { name: "venue", label: "Lokasi (cth: Google Meet). Jangan letak pautan di sini", defaultValue: x.venue_or_link ?? "" },{ name: "capacity", label: "Kuota (kosong = tiada had)", type: "number", defaultValue: x.capacity ?? "" },
            { name: "status", label: "Status", type: "select", options: STATUS, defaultValue: x.status }]} /></section>))}
      <section className="mt-3 rounded border border-dashed p-3"><h3 className="text-sm font-medium">Tambah sesi</h3>
        <OpForm op="session" submit="Tambah sesi" fields={[{ name: "starts_at", label: "Mula", type: "datetime-local", required: true }, { name: "ends_at", label: "Tamat (pilihan)", type: "datetime-local" },
          { name: "venue", label: "Lokasi (cth: Google Meet). Jangan letak pautan di sini" }, { name: "capacity", label: "Kuota (kosong = tiada had)", type: "number" }, { name: "status", label: "Status", type: "select", options: STATUS, defaultValue: "open" }]} /></section>
      <p className="mt-2 text-xs">Pautan Google Meet dan Telegram dimaklumkan kepada pelajar dalam group WhatsApp DIY ELEKTRIK, jadi tiada borang pautan di sini. Medan &quot;Lokasi&quot; sesi dipapar di landing: jangan letak pautan di situ.</p>

      <h2 className="mt-8 text-lg font-medium">Polisi dan teks (tanpa deploy)</h2>
      <p className="text-xs">Setiap perubahan direkod (nilai lama dan baharu) dan wajib bersebab. Nilai bertanda ASSUMPTION dalam CLAUDE.md belum disahkan Saiful.</p>
      {groups.map((g) => (
        <section key={g} className="mt-4"><h3 className="font-medium">{g}</h3>
          {CONFIG_FIELDS.filter((f) => f.group === g).map((f) => { const cur = cfgGet(cfg, f.key); return (
            <details key={f.key} className="mt-1 rounded border p-2 text-sm"><summary className="cursor-pointer">{f.label}: <b>{disp(cur)}</b></summary>
              {f.hint && <p className="mt-1 text-xs">{f.hint}</p>}
              <OpForm op="config" hidden={{ key: f.key }} submit="Simpan" fields={[
                f.kind === "bool" ? { name: "value", label: "Nilai", type: "select", options: [{ v: "true", l: "Ya" }, { v: "false", l: "Tidak" }], defaultValue: String(cur === true) }
                  : f.kind === "text" ? { name: "value", label: f.label, type: "textarea", defaultValue: typeof cur === "string" ? cur : "" }
                  : { name: "value", label: "Nilai", type: "number", required: true, defaultValue: typeof cur === "number" ? cur : "" },
                { name: "reason", label: "Sebab (wajib)", required: true }]} /></details>); })}
        </section>))}
    </main>
  );
}
