# 0001 Durasi sesi: 30 hari di perangkat tepercaya, 12 jam di perangkat lain

## Konteks

F-AUTH-1 AC3 meminta sesi 30 hari di perangkat yang ditandai tepercaya dan 12 jam di perangkat lain. Better Auth 1.7.5 hanya punya satu `session.expiresIn` dan opsi `rememberMe` di `/sign-in/email` (tidak diingat berarti 24 jam dan cookie sesi browser). Endpoint passkey (`/passkey/verify-authentication`) tidak menerima `rememberMe` sama sekali dan selalu membuat sesi dengan `expiresIn` penuh.

## Keputusan

- `session.expiresIn` = 30 hari, `updateAge` = 1 hari (sesi tepercaya bergeser selama dipakai).
- Checkbox "Ingat perangkat ini (30 hari)" di halaman masuk dan daftar perangkat menulis cookie `kaskita-ingat=1|0` (10 menit) sebelum passkey atau password dikirim. Untuk password, nilai yang sama juga dikirim sebagai `rememberMe`.
- `databaseHooks.session.create.before` membaca cookie itu dan menulis `sessions.trusted` serta `expires_at` = sekarang + 30 hari atau + 12 jam. Sesi yang dibuat ulang plugin (misalnya setelah TOTP pertama diaktifkan) mewarisi `trusted` sesi lama. Tanpa sinyal, sesi dianggap tidak tepercaya.
- Hook `after` global untuk `/passkey/verify-authentication` dan `/passkey/verify-registration` memasang ulang cookie sesi tanpa `Max-Age` beserta cookie `dont_remember` kalau sesi tidak tepercaya, sehingga Better Auth tidak me-refresh sesi itu.
- Pengaman tambahan: `databaseHooks.session.update.before` membatasi `expires_at` sesi tidak tepercaya ke `created_at + 12 jam`, jadi refresh apa pun tidak bisa memperpanjangnya.

## Konsekuensi

- Penanda tepercaya adalah pilihan pengguna di perangkat itu, bukan sidik perangkat. Itu sesuai AC ("ditandai tepercaya").
- Sesi tidak tepercaya berakhir tepat 12 jam setelah masuk, tidak bergeser walau aktif.
- Fitur `trustDevice` bawaan plugin twoFactor (melewati TOTP selama 30 hari) sengaja tidak dipakai: password selalu diikuti TOTP (lihat 0002).
