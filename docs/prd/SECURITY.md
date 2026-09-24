# Keamanan

Data di app ini adalah gambaran lengkap keuangan dua orang. Ancaman yang paling realistis bukan peretas canggih, melainkan: VPS yang lupa di-update, backup yang tidak pernah diuji, API key yang bocor lewat log, dan perangkat yang hilang dengan sesi masih aktif.

## 1. Ancaman dan penangkal

| Ancaman | Penangkal |
|---|---|
| Orang asing mendaftar | Tidak ada signup. Akun dibuat lewat CLI di server. Trigger database menolak user ketiga. |
| Tebak password | Passkey sebagai login utama. Password wajib 12+ karakter dan wajib TOTP. Rate limit 5 percobaan per 15 menit per IP dan per email. |
| Perangkat hilang | Daftar sesi di Pengaturan, cabut per sesi. Sesi perangkat tidak tepercaya 12 jam. |
| API key AI bocor | Dienkripsi di database, hanya didekripsi di server saat request, tidak pernah dikirim ke browser atau log |
| Password PDF bocor | Hanya di memori worker selama parsing, tidak disimpan dan tidak di-log |
| Database bocor dari backup | Backup dienkripsi sebelum keluar VPS |
| Lampiran diakses langsung | File di volume tanpa akses publik. Disajikan lewat route yang memeriksa sesi, dengan `Cache-Control: private` |
| XSS | React escape default, CSP ketat, tidak ada `dangerouslySetInnerHTML` kecuali konten statis |
| CSRF | Server actions Next.js dengan cek origin, cookie `SameSite=Lax`, `Secure`, `HttpOnly` |
| Upload berbahaya | Batas ukuran (struk 10 MB, mutasi 20 MB), cek magic bytes, gambar di-decode ulang dengan sharp, PDF diproses di worker tanpa eksekusi skrip |
| Prompt injection lewat struk atau deskripsi mutasi | Output AI hanya diterima lewat skema Zod. AI tidak punya tool dan tidak bisa menulis ke database. Semua hasil lewat pratinjau manusia. |
| VPS tidak ter-patch | `unattended-upgrades` untuk patch keamanan OS. Image container di-update bulanan (`DEPLOYMENT.md`). |

## 2. Enkripsi

- Transport: HTTPS lewat Caddy, HSTS 1 tahun.
- API key AI: AES-256-GCM, kunci dari env `APP_ENCRYPTION_KEY` (32 byte base64), IV acak per enkripsi, disimpan `iv || ciphertext || tag`.
- Rotasi kunci: perintah `scripts/rotate-key.ts` mendekripsi dengan kunci lama dan mengenkripsi ulang dengan kunci baru.
- Database dan lampiran di disk tidak dienkripsi di level aplikasi. Pakai enkripsi disk VPS kalau penyedia mendukung.
- Backup: `restic` dengan password repository dari env, target S3-compatible (Backblaze B2, Cloudflare R2, atau Wasabi).

## 3. Header HTTP (di Caddy)

```
Strict-Transport-Security: max-age=31536000; includeSubDomains
Content-Security-Policy: default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; font-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'
X-Content-Type-Options: nosniff
Referrer-Policy: same-origin
Permissions-Policy: camera=(self), microphone=(), geolocation=()
```

Browser tidak pernah menghubungi endpoint AI secara langsung, jadi `connect-src` cukup `'self'`.

## 4. Akses server

- SSH hanya dengan kunci, login root dimatikan, port SSH dibatasi `ufw`.
- Port publik hanya 80 dan 443. PostgreSQL tidak terekspos ke luar jaringan Docker.
- `fail2ban` untuk SSH.
- Role database aplikasi bukan superuser. Role terpisah untuk migrasi.

## 5. Data pribadi dan penyedia AI

- Teks quick-add, foto struk, dan (untuk fallback PDF) teks mutasi dikirim ke penyedia AI yang dipasang.
- `ai_calls` hanya mencatat metadata (model, token, latensi, status), bukan isi.
- Pengguna bisa mematikan AI sepenuhnya. App tetap berfungsi dengan parser lokal.

## 6. Checklist sebelum go-live

- [ ] Kedua akun memakai passkey dan punya TOTP cadangan
- [ ] `APP_ENCRYPTION_KEY` dan password restic disimpan di password manager, di luar VPS
- [ ] Backup pertama berhasil dan restore berhasil diuji ke database kosong
- [ ] CSP aktif tanpa error di konsol Safari dan Chrome
- [ ] `/api/health` dipantau layanan uptime eksternal
- [ ] Log dicek: tidak ada nominal, API key, atau isi prompt
