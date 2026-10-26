-- Seed dev/local sahaja. Nilai config = Andaian/Cadangan CLAUDE.md bahagian 7 (belum disahkan Saiful).
-- ASSUMPTION: belum disahkan Saiful (semua nilai bertanda di bawah). Tajuk kursus dan bab ialah penanda tempat.
insert into public.courses (slug, title, price, config) values (
  'kursus-elektrik', 'PLACEHOLDER: tajuk kursus (tunggu AHZ)', 14900,
  '{"access_months":6,"access_start":"paid_at","pass_mark_mcq":70,"max_mcq_attempts":3,"mcq_count":40,
    "video_complete_pct":0.90,"refund_window_days":3,"refund_progress_max_pct":10,"sla_business_days":5,
    "claim_expiry_days":3,"schematic_max_mb":10,"telegram_member_delete_days":30,
    "identity_check_enabled":{"theory":false,"theory_practical":false}}'::jsonb)
on conflict (slug) do nothing;
