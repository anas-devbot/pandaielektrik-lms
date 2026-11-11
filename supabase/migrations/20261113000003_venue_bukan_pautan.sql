-- Lokasi sesi dipaparkan secara awam di landing (anon boleh baca course_sessions).
-- Pautan Google Meet dan Telegram dimaklumkan melalui group WhatsApp, BUKAN di sini.
-- Pengawal DB: lokasi tidak boleh mengandungi pautan. NOT VALID supaya rekod sedia ada tak menyekat migration;
-- VALIDATE selepas semak data produksi.
-- Belum dijalankan di produksi (perlu kelulusan Bos).

alter table public.course_sessions
  add constraint course_sessions_venue_no_link
  check (venue_or_link is null or venue_or_link !~* '(https?://|www\.|t\.me/|wa\.me/|meet\.google\.com|chat\.whatsapp\.com)')
  not valid;
