-- Seed dev/local sahaja. Nilai config = Andaian/Cadangan CLAUDE.md bahagian 7 (belum disahkan Saiful).
-- ASSUMPTION: belum disahkan Saiful (semua nilai bertanda di bawah). Bab ialah penanda tempat.
insert into public.courses (slug, title, price, config) values (
  'kursus-elektrik', 'Kursus DIY Pendawaian Elektrik 1 FASA', 14900,
  '{"access_months":6,"access_start":"paid_at","pass_mark_mcq":70,"max_mcq_attempts":3,"mcq_count":40,
    "video_complete_pct":0.90,"refund_window_days":3,"refund_progress_max_pct":10,"sla_business_days":5,
    "claim_expiry_days":3,"schematic_max_mb":10,"telegram_member_delete_days":30,
    "identity_check_enabled":{"theory":false,"theory_practical":false},
    "certificate":{"wording_approved": false, "issuer_name": "AHZ TEKNIK ENTERPRISE", "issuer_reg_no": "NS0225882-U", "organiser": "AHZ TEKNIK ENTERPRISE", "address": ["No 10-2, Jalan BBN 6/3, Desa Cempaka", "Alpina Retail Avenue, Putra Nilai,", "71800 Nilai, Negeri Sembilan"], "signatory_name": "MUHAMAD AMIRUL HAKIM BIN MOHD SAIFUL AKMAL", "signatory_title": "Pengarah Latihan", "titles": {"theory": "SIJIL PENCAPAIAN TEORI", "theory_practical": "SIJIL LULUS UJIAN TEORI & PRAKTIKAL"}, "achievement_lines": {"theory": "Telah Menyertai Dan Lulus Ujian Teori Dengan Jayanya", "theory_practical": "Telah Menyertai Dan Lulus Ujian Dengan Jayanya"}, "disclaimer": "Sijil ini ialah sijil pencapaian AHZ Teknik Enterprise. Ia bukan perakuan kekompetenan di bawah Suruhanjaya Tenaga dan tidak melayakkan pemegangnya menjalankan kerja pendawaian elektrik yang dikawal selia."}}'::jsonb)
on conflict (slug) do nothing;
