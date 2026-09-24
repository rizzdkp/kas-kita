# Roadmap

Setiap milestone selesai kalau semua fitur di dalamnya lolos AC di `PRD.md` dan tes e2e lolos di WebKit dan Chromium.

## Fase 1: v1

| Milestone | Isi | Fitur |
|---|---|---|
| M0 Fondasi | Repo, Docker, skema, auth, CLI buat user, token desain, shell dengan glass G0 dan G1 | F-AUTH-1 |
| M1 Catat | Akun, form transaksi, quick-add parser lokal, daftar transaksi, audit, konflik, cakupan | F-ACC-1, F-IN-1, F-IN-2 (tanpa AI), F-HIST-1..3, F-SCOPE-1 |
| M2 Lihat | Rumus metrik, dashboard, anggaran, tagihan, target | F-DASH-1, F-BUD-1, F-BILL-1, F-GOAL-1 |
| M3 AI | Pengaturan AI, quick-add AI, foto struk | F-AI-1, F-IN-2 (AI), F-IN-3 |
| M4 Impor | CSV, dedupe, PDF sesuai O-1, fallback AI PDF | F-IN-4..6 |
| M5 Lengkap | Berulang, rekonsiliasi, investasi, laporan, notifikasi, wawasan, prediksi, PWA offline, glass G2 | F-IN-7, F-ACC-2, F-INV-1, F-REP-1, F-NOT-1, F-AI-2, F-BUD-2 |
| M6 Go-live | Checklist `SECURITY.md` bagian 6, backup teruji, uji pakai berdua selama 2 minggu | |

Urutan ini sengaja menaruh AI setelah pencatatan manual jalan. Kalau AI bermasalah, app tetap bisa dipakai sejak M1.

## Fase 2: setelah dipakai 1-2 bulan

- Bot Telegram untuk quick-add dan foto struk, satu bot untuk berdua, akun Telegram dipetakan ke user.
- Input suara di PWA (Web Speech API), hasilnya lewat parser quick-add yang sama.
- Parser PDF untuk institusi tambahan.
- Aturan kategori otomatis ("deskripsi mengandung INDOMARET → Belanja dapur").

## Sengaja tidak direncanakan

- Open banking atau scraping aplikasi bank. Rawan diblokir dan melanggar ketentuan layanan bank.
- Lebih dari dua pengguna.
- Aplikasi native iOS atau Android. PWA cukup untuk kebutuhan ini.
