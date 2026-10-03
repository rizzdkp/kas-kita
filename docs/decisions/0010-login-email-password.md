# 0010 Login cukup email + password

## Konteks

PRD F-AUTH-1 dan SECURITY.md menetapkan passkey sebagai login utama dengan password + TOTP sebagai cadangan (keputusan 0001-0003). Dalam pemakaian, alur itu terlalu panjang untuk dua orang: tautan pendaftaran sekali pakai, pendaftaran passkey per perangkat, lalu password dan TOTP. Pemilik produk memutuskan: "jangan diperibet pakai passkey, cukup email dan password saja."

## Keputusan

- Login hanya `/sign-in/email` Better Auth. Plugin `passkey` dan `twoFactor` dicabut dari konfigurasi; halaman `/daftar-perangkat`, tautan pendaftaran, dan langkah TOTP dihapus. Tabel `passkeys`, `two_factors`, dan kolom `users.two_factor_enabled` dibiarkan (tidak dipakai) supaya tidak perlu migrasi dan jalur kembali tetap murah.
- Akun dibuat lewat `pnpm user:create --email --name [--color] [--payday]`. Password diminta di terminal tanpa echo, atau lewat `--password-stdin` / `--password-env NAMA_ENV`, minimal 12 karakter, di-hash dengan `hashPassword` Better Auth (scrypt) ke `auth_accounts` (`provider_id = credential`). `--reset-password` mengganti password dan mencabut semua sesi pengguna itu (pemulihan). Pengguna ketiga dan warna kembar tetap ditolak.
- Ganti password di Pengaturan > Keamanan memakai `changePassword` dengan `revokeOtherSessions: true`; sesi pengganti mewarisi status tepercaya sesi yang dipakai.
- Durasi sesi memakai `rememberMe` bawaan Better Auth: dicentang = sesi 30 hari dan cookie 30 hari; tidak dicentang = sesi 12 jam, cookie sesi browser, dan cookie `dont_remember` sehingga Better Auth tidak me-refresh. Cookie `kaskita-ingat` (dulu dibutuhkan karena endpoint passkey tidak menerima `rememberMe`) dihapus. Pembatas `created_at + 12 jam` untuk sesi tidak tepercaya tetap ada.
- Rate limit 5 gagal / 15 menit per IP dan per email (0002) tetap, sekarang hanya menghitung respons 401 `/sign-in/email` (email atau password salah). Body tidak valid dan permintaan saat terkunci tidak dihitung.
- Data contoh lokal: `pnpm db:seed` menyetel password user seed dari `DEV_SEED_PASSWORD` (bawaan `kaskita-dev-123`) dan menolak melakukannya di `NODE_ENV=production`. Halaman masuk menampilkan petunjuk itu hanya di luar produksi.

## Konsekuensi dan penangkal yang tersisa

- Tanpa faktor kedua, password yang bocor (phishing, dipakai ulang di layanan lain, keylogger) cukup untuk masuk. Penangkal yang tersisa: password minimal 12 karakter, rate limit per IP dan per email, sesi 12 jam di perangkat yang tidak dicentang, daftar sesi dan cabut per sesi di Pengaturan, ganti password yang mengeluarkan perangkat lain, HTTPS + HSTS dan cookie `Secure`/`HttpOnly`/`SameSite=Lax`, dan tidak ada signup.
- Kunci per email tetap bisa dipakai orang lain untuk mengunci akun 15 menit. Dulu passkey menjadi jalan keluar; sekarang pemilik menunggu kunci berakhir atau masuk dari IP lain setelah 15 menit.
- Disarankan memakai password manager dan password unik.

## Jalur kembali

Plugin `twoFactor` (TOTP) atau `passkey` bisa dipasang lagi di `src/server/auth/auth.ts`; tabel dan kolomnya masih ada. Perlu: UI pendaftaran di Pengaturan, langkah kode di `/login`, dan hook rate limit untuk `/two-factor/verify-totp` (lihat riwayat git keputusan 0002 dan 0003).
