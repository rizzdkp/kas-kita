# Instruksi untuk coding agent

Baca file ini sebelum menulis kode. Kalau ada konflik antar dokumen, urutan otoritas: `PRD.md` > `DATA-MODEL.md` > `ARCHITECTURE.md` > `DESIGN.md` > `UX-FLOWS.md` > `COPY.md`. Catat konflik yang kamu temukan di `docs/decisions/`.

## Cara kerja

1. Kerjakan satu milestone dari `ROADMAP.md` dalam satu waktu, per ID fitur.
2. Sebelum menulis kode untuk satu fitur, tulis daftar AC-nya sebagai tes yang gagal.
3. Fitur selesai hanya kalau semua AC lolos, `pnpm check` lolos, dan tes e2e lolos di WebKit dan Chromium.
4. Kalau AC tidak bisa dipenuhi, berhenti dan jelaskan alasannya. Jangan menurunkan AC diam-diam.
5. Keputusan teknis yang menyimpang dari dokumen dicatat di `docs/decisions/NNNN-judul.md`: konteks, keputusan, konsekuensi.

## Perintah

| Perintah | Fungsi |
|---|---|
| `pnpm dev` | App dan worker lokal, database dari `docker compose -f docker/compose.dev.yml up db` |
| `pnpm db:generate` | Generate migrasi dari `schema.ts` |
| `pnpm db:migrate` | Jalankan migrasi |
| `pnpm db:seed` | Dua user contoh, akun, kategori, 6 bulan transaksi acak yang realistis |
| `pnpm check` | Typecheck, lint, unit test |
| `pnpm e2e` | Playwright, proyek `webkit` dan `chromium` |

## Aturan yang tidak boleh dilanggar

1. Uang selalu `bigint` rupiah. Tidak ada `number` untuk nominal di server. Di klien, nominal boleh `number` hanya setelah dipastikan di bawah `Number.MAX_SAFE_INTEGER`.
2. Query baca transaksi hanya lewat `src/server/queries/scope.ts`.
3. Tulis data hanya lewat `src/server/mutations/`, yang menangani versi dan audit.
4. AI tidak pernah menghasilkan angka yang tampil di dashboard. Lihat PRD F-AI-2.
5. API key, password PDF, nominal, dan isi prompt tidak pernah masuk log.
6. Warna, spasi, radius, dan durasi hanya dari token. Glass hanya lewat `<GlassSurface>`.
7. Teks UI hanya dari `COPY.md` atau mengikuti glosariumnya. Teks baru ditambahkan ke `COPY.md` dulu.
8. Setiap komponen interaktif bisa dipakai dengan keyboard dan punya label yang terbaca screen reader.

## Gaya kode

- TypeScript strict, tanpa `any`. `unknown` lalu dipersempit dengan Zod.
- Nama deskriptif dan konsisten: `getAccountBalances`, `createTransaction`, `parseQuickAddInput`. File kebab-case, komponen PascalCase.
- Satu modul satu tanggung jawab. File di atas 300 baris dipecah.
- Komentar menjelaskan alasan, bukan apa yang dilakukan kode. Satu baris pendek, hanya kalau alasannya tidak terlihat dari kode.

```ts
// dedupe window 2 hari karena bank sering membukukan transaksi e-wallet H+1
const DEDUPE_WINDOW_DAYS = 2;
```

- Tidak ada komentar yang mengulang nama fungsi.

## Tes wajib

| Area | Tes |
|---|---|
| `money.ts` | Parse "25rb", "1,5jt", "1.5jt", "25k", "Rp 25.000", "25.000,00"; format ringkas dan lengkap; negatif |
| Metrik | Setiap rumus PRD bagian 6 dengan fixture yang hasilnya dihitung manual di komentar tes |
| Cakupan | Transfer antar pemilik tampil benar di Saya, Partner, Gabungan dan tidak masuk pengeluaran |
| Audit | Setiap mutasi menulis `audit_log` dengan diff yang benar |
| Konflik | Dua update dengan versi sama, yang kedua ditolak |
| Dedupe | Tiga kelompok F-IN-6 dengan fixture yang mencakup selisih tanggal 0, 2, dan 3 hari |
| AI | Klien dengan server palsu yang menolak `json_schema`, menolak `json_object`, dan mengembalikan JSON rusak |
| Glass | Snapshot visual di WebKit dan Chromium, terang dan gelap, dan dengan `prefers-reduced-transparency` |

## Data contoh

Seed tidak memakai data asli. Nama bank di seed boleh nama asli (BCA, Bank Jago, GoPay) karena hanya label.
