# 0003 Akun lewat CLI dan tautan pendaftaran sekali pakai

## Konteks

F-AUTH-1 AC1 dan DEPLOYMENT.md bagian 4: tidak ada signup, akun dibuat lewat CLI yang mencetak tautan sekali pakai (30 menit) untuk mendaftarkan passkey. Plugin passkey Better Auth mendukung pendaftaran tanpa sesi lewat `registration.requireSession = false`, `resolveUser`, dan parameter `context`.

## Keputusan

- `scripts/create-user.ts` menulis langsung ke tabel `users` (nama tampilan = nama, email huruf kecil, warna identitas, tanggal gajian), menangkap error trigger `users_max_two` (kode 23514) dan duplikat (23505) menjadi pesan Bahasa Indonesia. Opsi `--link` membuat tautan baru untuk pengguna yang sudah ada.
- Warna identitas unik dijaga dua lapis: cek di CLI dengan daftar warna yang masih bebas, dan unique index `users_identity_color_unique` di migrasi 0002.
- Token tautan 32 byte acak (base64url). Yang disimpan di `verifications` hanya `enroll:` + SHA-256 token, berlaku 30 menit. Tautan baru menghapus tautan lama pengguna yang sama.
- Halaman `/daftar-perangkat?token=...` mengirim token sebagai `context` passkey. `resolveUser` memvalidasi token, `afterVerification` menghapusnya dalam satu `DELETE ... RETURNING` (sekali pakai), lalu sesi dibuat (`createSession: true`).
- Setelah passkey terdaftar, pengguna bisa menyetel password (12+ karakter) dan TOTP cadangan memakai sesi itu, lewat server action yang memanggil `auth.api.setPassword`, `enableTwoFactor`, dan `verifyTOTP`. Password baru aktif setelah kode TOTP pertama benar.
- QR code tidak ditampilkan karena belum ada pustaka QR. Halaman menampilkan tautan `otpauth://` (membuka aplikasi autentikator di ponsel) dan secret base32 untuk diketik manual.

## Konsekuensi

- Tautan yang bocor dalam 30 menit bisa dipakai orang lain untuk mendaftarkan passkey. CLI hanya bisa dijalankan di server, dan tautan hilang setelah dipakai sekali.
- `pnpm user:create` tidak membaca `.env.local` sendiri; di lokal jalankan `set -a; . ./.env.local; set +a` dulu. Di produksi env berasal dari container.
