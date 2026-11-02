# pandaielektrik (kod LMS)

LMS 1 kursus elektrik untuk AHZ Teknik. Next.js 15 (standalone) + Supabase + Bayarcash + Cloudflare R2 + Resend.

Repo ini hanya **kod**. Peraturan, PRD, pelan deploy dan bahan AHZ ada di folder bersebelahan `../pandaielektrik-LMS/` (bukan repo git). Mulakan di `../pandaielektrik-LMS/CLAUDE.md` bahagian 0.

## Susun atur
- `src/app` halaman dan route, `src/lib` logik (bayarcash, quiz, sijil, emel, storage), `src/middleware.ts`
- `supabase/migrations` skema, `supabase/tests` ujian SQL (RLS dll.), `supabase/seed.sql`
- `scripts/` deploy, backup, restore, create-staff, import soalan, `test-*.mjs`
- `.env.example` senarai pembolehubah (nama sahaja); salin ke `.env.local` (jangan commit)

## Local
```bash
npm run db:start      # Supabase local (Docker)
npm run dev           # 127.0.0.1:3100
```
Ujian: `scripts/test-*.mjs` dan `supabase/tests/*.sql` (jalankan fail cleanup-* sebelum ulang). Deploy: lihat `../pandaielektrik-LMS/docs/DEPLOY-PLAN.md`; `scripts/deploy.sh` tidak dijalankan tanpa kelulusan Bos.
