-- Pembersihan: pautan Google Meet dan Telegram kini dimaklumkan melalui group WhatsApp DIY ELEKTRIK,
-- bukan dipapar dalam LMS. Objek yang dicipta oleh 20261111000000_urutan_meet_private.sql tidak digunakan lagi.
-- Migration 20261111000000 kekal tanpa diubah (sudah dijalankan di produksi).

-- 1. RPC pautan (tidak digunakan)
drop function if exists public.set_course_links(uuid, uuid, uuid, text, text, text);

-- 2. Jadual pautan Telegram (tidak digunakan)
drop table if exists public.course_private;

-- 3. Lajur pautan Meet (tidak digunakan). Lajur dan kebenaran lajur dibuang bersama.
alter table public.course_sessions drop column if exists meet_link;

-- 4. Kebenaran awam untuk sesi dikembalikan kepada bentuk asal (jadual, tanpa had lajur).
--    Tiada lajur sensitif dalam course_sessions sekarang.
grant select on public.course_sessions to anon, authenticated;

-- Rekod admin_actions dengan action 'config_changed' dan key 'course_links' dikekalkan (append-only).
