# Kas Kita

Web app keuangan untuk dua orang yang berbagi hidup tapi tetap punya uang masing-masing. Setiap kali dibuka, app menjawab satu pertanyaan: berapa yang aman dibelanjakan sampai gajian berikutnya, untuk kamu, untuk partner, dan untuk kalian berdua.

Spesifikasi lengkap ada di [`docs/prd/`](docs/prd/): PRD, model data, arsitektur, sistem desain, alur, copy, keamanan, dan deploy. Aturan kerja untuk coding agent ada di [`AGENTS.md`](AGENTS.md). Keputusan yang menyimpang dari dokumen dicatat di [`docs/decisions/`](docs/decisions/).

## Stack

Next.js 15 (App Router, server actions), TypeScript strict, PostgreSQL 16 + Drizzle, Better Auth (email + password), Tailwind CSS v4 dengan token dari `DESIGN.md`, Radix UI, Recharts, Vitest, Playwright.

## Status terhadap roadmap

| Milestone | Status | Catatan |
|---|---|---|
| M0 Fondasi | Selesai | Skema, migrasi, auth (sekarang email + password, keputusan 0010), CLI buat user, token desain, shell glass G0/G1 |
| M1 Catat | Selesai | Akun, form transaksi, quick-add parser lokal (multi-baris, antrean offline), daftar transaksi virtual, audit, riwayat edit, dialog konflik, cakupan |
| M2 Lihat | Selesai | Rumus metrik dengan panel "Cara menghitung", Ringkasan, Anggaran, Tagihan, Target |
| M3 AI | Selesai | Pengaturan AI (F-AI-1), quick-add AI (F-IN-2), foto struk + lampiran (F-IN-3). Diuji terhadap server AI palsu `scripts/fake-ai-server.ts`, belum terhadap penyedia sungguhan |
| M4 Impor | Selesai, kecuali parser PDF per bank | Impor CSV dengan pemetaan kolom dan templat per institusi (F-IN-4), impor PDF berpassword dan baca dengan AI lewat worker (F-IN-5), dedupe dan layar tinjau (F-IN-6). Parser PDF bank sungguhan menunggu item terbuka O-1; baru ada parser referensi `contoh-bank` |
| M5 Lengkap | Selesai | Transaksi berulang (F-IN-7), rekonsiliasi (F-ACC-2), investasi (F-INV-1), laporan + ekspor CSV/PDF (F-REP-1), notifikasi dalam app dan web push (F-NOT-1), wawasan mingguan (F-AI-2), prediksi akhir bulan (F-BUD-2), realtime SSE, PWA (Serwist), glass G2. Struk yang dipecah dihitung per kategori rincian (keputusan 0015) |
| M6 Go-live | Belum | Checklist `SECURITY.md` bagian 6 |

Belum dijalankan: tes e2e di WebKit (Safari). Container pengembangan hanya punya Chromium; proyek `webkit` sudah dikonfigurasi di `playwright.config.ts` dan wajib dijalankan sebelum go-live.

## Aset

Logo bank dan e-wallet dari idn-finlogos (CC BY-NC 4.0, hanya untuk pemakaian non-komersial) dan gambar 3D dari Microsoft Fluent Emoji (MIT), keputusan 0016. Daftar sumber dan lisensi di `public/assets/CREDITS.md` dan Pengaturan → Kredit. Kalau app dipakai komersial, logo bank harus diganti atau diminta izinnya.

## Menjalankan secara lokal

Kebutuhan: Node 22, pnpm, dan Docker (untuk PostgreSQL 16).

```sh
pnpm install
pnpm setup:local   # buat .env.local berisi kunci acak, nyalakan PostgreSQL di Docker, migrasi, isi data contoh
pnpm dev           # buka http://localhost:3000
```

Masuk dengan `rizz@kaskita.local` atau `nadia@kaskita.local`, password `kaskita-dev-123` (atur lewat `DEV_SEED_PASSWORD` di `.env.local`). `pnpm worker` di terminal lain menjalankan baca PDF dengan AI dan job terjadwal.

- PostgreSQL sendiri tanpa Docker: isi `DATABASE_URL` di `.env.local`, lalu `pnpm setup:local --no-docker`. Di container pengembangan, `./scripts/dev-db-up.sh` juga bisa dipakai.
- Semua skrip `db:*`, `user:create`, dan `dev:*` membaca `.env.local` sendiri.
- Database yang di-seed sebelum ada login password: `pnpm dev:passwords` menyetel password kedua user seed (ditolak di `NODE_ENV=production`).
- Akun sungguhan: `pnpm user:create --email kamu@contoh.id --name Rizz --color violet --payday 25`. Password diminta di terminal tanpa ditampilkan (minimal 12 karakter); untuk skrip pakai `--password-stdin` atau `--password-env NAMA_ENV`. Lupa password: `pnpm user:create --email kamu@contoh.id --reset-password`.
- Cookie sesi tanpa form (dev dan e2e): `pnpm dev:session rizz@kaskita.local` mencetak `{name, value}`. Ditolak di `NODE_ENV=production`.

`pnpm db:seed` mengosongkan data dan sesi, lalu mengisi ulang.

## Perintah

| Perintah | Fungsi |
|---|---|
| `pnpm dev` | Server pengembangan |
| `pnpm check` | Typecheck, lint, tes unit dan integrasi |
| `pnpm e2e` | Playwright (lihat bagian tes) |
| `pnpm db:generate` | Generate migrasi dari skema |
| `pnpm db:migrate` | Jalankan migrasi |
| `pnpm db:seed` | Data contoh |
| `pnpm setup:local` | Siapkan lingkungan lokal dari nol |
| `pnpm user:create` | Satu-satunya cara membuat akun dan memulihkan password |

## Tes

- Unit dan integrasi (`pnpm check`) memakai database `TEST_DATABASE_URL` dan `kaskita_test_auth`; jalankan migrasi ke keduanya dulu.
- E2E paling stabil terhadap build produksi:

  ```sh
  set -a; . ./.env.local; set +a
  NEXT_DIST_DIR=.next-e2e pnpm build
  KASKITA_DEV_PAGES=1 NEXT_DIST_DIR=.next-e2e pnpm start -p 3400 &
  E2E_BASE_URL=http://localhost:3400 pnpm e2e --project='chromium*' --workers=2
  ```

  `KASKITA_DEV_PAGES=1` membuka galeri komponen `/dev/komponen` yang dipakai tes visual. Jangan pernah menyetelnya di produksi. `NEXT_DIST_DIR` memisahkan folder build supaya beberapa server tidak saling menimpa. Data berawalan "E2E " dan pengaturan AI yang menunjuk server AI palsu dibersihkan otomatis sebelum dan sesudah run. Tes AI (proyek `chromium-ai`) menjalankan server AI palsu sendiri dan berjalan satu per satu setelah tes lain, karena pengaturan AI satu baris untuk seluruh rumah tangga.

## PWA dan web push

- Service worker (`src/app/sw.ts`, Serwist) hanya dibangun di `next build`; `pnpm dev` tidak memasangnya. Uji dengan build produksi (`next build` lalu `next start`). Shell app di-precache; halaman app disimpan NetworkFirst sebagai data terakhir untuk offline; `/api/*` (lampiran, ekspor) tidak pernah disimpan; halaman yang belum pernah dibuka menampilkan `/~offline`. Salinan halaman dihapus saat sesi berakhir (kembali ke login).
- Web push opsional. Buat kunci sekali: `npx tsx scripts/generate-vapid.ts`, lalu isi `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (mailto: atau https://) di `.env`. Tanpa kunci, bagian Pengaturan → Notifikasi hanya menampilkan keterangan. Isi push tidak memuat nominal; lihat `docs/decisions/0011-isi-web-push.md`. Di iPhone/iPad push butuh iOS 16.4+ dan app dipasang ke layar utama.
- Tes e2e PWA (`tests/e2e/pwa.spec.ts`) dilewati otomatis di `next dev`; jalankan terhadap build produksi seperti contoh di bagian Tes.

## Deploy

Ikuti [`docs/prd/DEPLOYMENT.md`](docs/prd/DEPLOYMENT.md) dengan `docker/compose.yml`, `docker/Caddyfile`, dan `Dockerfile` di repo ini. Perbedaan dari dokumen:

- Container `worker` menjalankan pg-boss: baca PDF dengan AI, hapus file impor sementara > 7 hari (03.15 WIB), hapus lampiran pratinjau yatim > 7 hari (03.30 WIB). Tambahkan `IMPORTS_DIR=/data/imports` di `.env` produksi.
- Migrasi dan pembuatan user dijalankan dengan tsx dari image app: `docker compose run --rm app node_modules/.bin/tsx scripts/migrate.ts` dan `docker compose run --rm app node_modules/.bin/tsx scripts/create-user.ts --email ... --name ...`.
- CSP di Caddyfile memakai `script-src 'self' 'unsafe-inline'` karena Next.js menyisipkan skrip inline; CSP berbasis nonce belum dibuat.
