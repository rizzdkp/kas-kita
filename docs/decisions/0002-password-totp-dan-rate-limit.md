# 0002 Password wajib TOTP, rate limit login di database

## Konteks

SECURITY.md: passkey login utama, password 12+ karakter dan wajib TOTP, rate limit 5 percobaan per 15 menit per IP dan per email. F-AUTH-1 AC2: setelah 5 percobaan gagal dalam 15 menit, login dikunci 15 menit. Rate limiter bawaan Better Auth memakai jendela geser pendek dan penyimpanan memori, jadi hilang saat restart dan tidak punya konsep "kunci".

## Keputusan

- Hook `before` global menolak `/sign-in/email` untuk pengguna yang `two_factor_enabled = false`, dengan pesan yang sama seperti password salah dan dihitung sebagai kegagalan. Password yang disetel tapi TOTP-nya belum dikonfirmasi tidak bisa dipakai.
- Rate limit memakai tabel `login_attempts` (`src/server/auth/rate-limit.ts`). Setiap kegagalan menulis baris `ip:<ip>` dan `email:<email>`. Saat satu kunci mencapai 5 kegagalan dalam 15 menit, ditulis baris `lock:<kunci>`; login terkunci selama ada baris lock berumur kurang dari 15 menit. Kegagalan lama kunci itu dihapus supaya hitungan mulai dari nol setelah kunci berakhir.
- Yang dihitung: password salah di `/sign-in/email` dan kode salah di `/two-factor/verify-totp` pada langkah masuk (email diambil dari cookie tantangan 2FA). Passkey yang gagal tidak dihitung (bukan tebakan rahasia), tetapi `/passkey/verify-authentication` tetap ditolak selama IP terkunci.
- Kegagalan ke-5 langsung membalas pesan kunci. Login berhasil menghapus hitungan email, bukan IP.
- IP dibaca dengan `getIP` Better Auth dari `X-Forwarded-For` (Caddy menulis satu IP klien). IPv6 dinormalisasi ke subnet oleh Better Auth.
- Endpoint yang tidak dipakai dimatikan lewat `disabledPaths`: sign-up, update/delete user, ganti email, reset password, OTP email, dan kode cadangan 2FA. Kode cadangan tidak diterbitkan; pemulihan akun lewat `pnpm user:create --email ... --link`.

## Konsekuensi

- Kunci per email bisa dipakai orang lain untuk mengunci akun selama 15 menit dengan sengaja. Passkey tidak terkena kunci email, hanya kunci IP, jadi pemilik akun tetap bisa masuk dari IP lain dengan passkey.
- Tanpa kode cadangan, kehilangan ponsel TOTP dan semua passkey berarti perlu akses server untuk membuat tautan baru. Untuk aplikasi dua orang di VPS sendiri ini dianggap wajar.
