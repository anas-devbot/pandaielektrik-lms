-- Hadkan lajur peribadi pada profiles untuk klien (authenticated).
-- Sebelum ini: RLS benarkan staf (is_staff) baca SEMUA lajur, termasuk telefon dan maklumat demografi pelajar.
-- Sekarang: klien hanya baca lajur yang diperlukan. Telefon, jantina, julat umur, negeri, daerah dan utm
-- dibaca oleh admin melalui server (adminClient, selepas requireRole(["admin"])).
-- Pelajar masih boleh KEMAS KINI telefon sendiri (grant update sedia ada tidak diubah).
-- Belum dijalankan di produksi (perlu kelulusan Bos).

revoke select on public.profiles from authenticated;
grant select (id, full_name, role, privacy_accepted_at, privacy_version, created_at) on public.profiles to authenticated;
