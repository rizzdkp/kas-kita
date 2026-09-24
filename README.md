# Kas Kita

Web app keuangan untuk dua orang yang berbagi hidup tapi tetap punya uang masing-masing. Setiap kali dibuka, app menjawab satu pertanyaan: berapa yang aman dibelanjakan sampai gajian berikutnya, untuk kamu, untuk partner, dan untuk kalian berdua.

Spesifikasi lengkap ada di [`docs/prd/`](docs/prd/): PRD, model data, arsitektur, sistem desain, alur, copy, keamanan, dan deploy. Aturan kerja untuk coding agent ada di [`AGENTS.md`](AGENTS.md). Keputusan yang menyimpang dari dokumen dicatat di [`docs/decisions/`](docs/decisions/).

## Stack

Next.js 15 (App Router, server actions), TypeScript strict, PostgreSQL 16 + Drizzle, Better Auth (passkey, password + TOTP), Tailwind CSS v4 dengan token dari `DESIGN.md`, Radix UI, Recharts, Vitest, Playwright.

## Status terhadap roadmap

| Milestone | Status | Catatan |
|---|---|---|
| M0 Fondasi | Selesai | Skema, migrasi, auth passkey + password/TOTP, CLI buat user, token desain, shell glass G0/G1 |
| M1 Catat | Selesai | Akun, form transaksi, quick-add parser lokal (multi-baris, antrean offline), daftar transaksi virtual, audit, riwayat edit, dialog konflik, cakupan |
| M2 Lihat | Selesai | Rumus metrik dengan panel "Cara menghitung", Ringkasan, Anggaran, Tagihan, Target |
| M3 AI | Selesai | Pengaturan AI (F-AI-1), quick-add AI (F-IN-2), foto struk + lampiran (F-IN-3). Diuji terhadap server AI palsu `scripts/fake-ai-server.ts`, belum terhadap penyedia sungguhan |
| M4 Impor | Belum | Skema `import_batches`, `import_rows`, `import_templates` sudah ada |
| M5 Lengkap | Sebagian | Selesai: rekonsiliasi (F-ACC-2), investasi (F-INV-1), laporan + ekspor CSV/PDF (F-REP-1), notifikasi dalam app (F-NOT-1), wawasan berbasis templat (F-AI-2 AC4), prediksi akhir bulan (F-BUD-2). Belum: transaksi berulang (F-IN-7), web push, service worker PWA, glass G2 refraksi, realtime SSE |
| M6 Go-live | Belum | Checklist `SECURITY.md` bagian 6 |

Belum dijalankan: tes e2e di WebKit (Safari). Container pengembangan hanya punya Chromium; proyek `webkit` sudah dikonfigurasi di `playwright.config.ts` dan wajib dijalankan sebelum go-live.

## Menjalankan secara lokal

Kebutuhan: Node 22, pnpm, PostgreSQL 16.

```sh
pnpm install
docker compose -f docker/compose.dev.yml up -d db   # atau PostgreSQL lokal sendiri
cp .env.example .env.local                           # isi APP_ENCRYPTION_KEY dan AUTH_SECRET: openssl rand -base64 32
set -a; . ./.env.local; set +a
pnpm db:migrate
pnpm db:seed                                         # 2 user contoh, 10 akun, 6 bulan transaksi
pnpm dev
```

Masuk ke app:

- Akun sungguhan: `pnpm user:create --email kamu@contoh.id --name Rizz --color violet --payday 25`, lalu buka tautan sekali pakai yang dicetak untuk mendaftarkan passkey. Tautan baru untuk user yang sudah ada: `pnpm user:create --email kamu@contoh.id --link`.
- User seed tanpa passkey (hanya dev): `pnpm dev:session rizz@kaskita.local` mencetak cookie sesi `{name, value}` untuk dipasang di browser. Skrip ini menolak berjalan di `NODE_ENV=production`.

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
| `pnpm user:create` | Satu-satunya cara membuat akun |

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

## Deploy

Ikuti [`docs/prd/DEPLOYMENT.md`](docs/prd/DEPLOYMENT.md) dengan `docker/compose.yml`, `docker/Caddyfile`, dan `Dockerfile` di repo ini. Perbedaan dari dokumen:

- Container `worker` belum ada karena belum ada job terjadwal yang diimplementasikan.
- Migrasi dan pembuatan user dijalankan dengan tsx dari image app: `docker compose run --rm app node_modules/.bin/tsx scripts/migrate.ts` dan `docker compose run --rm app node_modules/.bin/tsx scripts/create-user.ts --email ... --name ...`.
- CSP di Caddyfile memakai `script-src 'self' 'unsafe-inline'` karena Next.js menyisipkan skrip inline; CSP berbasis nonce belum dibuat.
