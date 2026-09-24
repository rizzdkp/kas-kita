# Arsitektur

## 1. Gambaran

```
Browser / PWA (Safari, Chrome, Edge)
        │ HTTPS
        ▼
Caddy (TLS otomatis, header keamanan, kompresi)
        │
        ▼
app: Next.js (App Router, server actions, route handlers)
        │                         │
        ▼                         ▼
PostgreSQL 16  ◄──────────  worker: pg-boss (impor, AI, jadwal)
        │                         │
        ▼                         ▼
volume: lampiran            Endpoint AI OpenAI-compatible (eksternal)
```

Satu VPS, empat container: `caddy`, `app`, `worker`, `db`. Tidak ada Redis. Antrean job memakai pg-boss di PostgreSQL yang sama.

## 2. Stack

| Lapisan | Pilihan | Alasan |
|---|---|---|
| Bahasa | TypeScript strict | Satu bahasa di frontend, backend, worker |
| Framework | Next.js 15 App Router | Server components mengurangi JS di mobile |
| Database | PostgreSQL 16 | Transaksi, constraint, trigger untuk audit |
| ORM | Drizzle | Skema sebagai kode, SQL tetap terlihat |
| Auth | Better Auth dengan plugin passkey dan two-factor | Passkey dan TOTP tanpa layanan eksternal |
| Validasi | Zod | Satu skema untuk form, API, dan output AI |
| UI primitif | Radix UI | Aksesibilitas keyboard dan ARIA, gaya ditulis sendiri |
| Styling | Tailwind CSS v4 dengan token dari `DESIGN.md` | Token jadi CSS variables |
| Grafik | Recharts dengan komponen tooltip dan sumbu sendiri | Cukup untuk garis, batang, area |
| Tanggal | date-fns + date-fns-tz | Zona waktu Asia/Jakarta |
| Antrean | pg-boss | Tanpa infrastruktur tambahan |
| PDF | pdfjs-dist (ekstraksi teks), qpdf (buka password) | Berjalan di worker |
| Gambar | sharp di server, canvas di browser untuk kompresi | |
| PWA | Serwist | Service worker untuk Next.js |
| Tes | Vitest (unit), Playwright (e2e, WebKit + Chromium) | WebKit wajib karena target Safari |

Kalau Better Auth atau library lain berubah API-nya saat implementasi, agen boleh mengganti dengan alternatif setara asalkan AC di `PRD.md` tetap terpenuhi, dan mencatat alasannya di `docs/decisions/`.

## 3. Struktur folder

```
kas-kita/
├── docker/
│   ├── Caddyfile
│   └── compose.yml
├── drizzle/                  # migrasi hasil generate
├── public/
├── scripts/
│   ├── create-user.ts        # satu-satunya cara membuat akun
│   └── restore-backup.sh
├── src/
│   ├── app/
│   │   ├── (auth)/login/
│   │   ├── (app)/
│   │   │   ├── layout.tsx    # shell: sidebar glass, toolbar, ambient field
│   │   │   ├── page.tsx      # Ringkasan
│   │   │   ├── transaksi/
│   │   │   ├── akun/
│   │   │   ├── anggaran/
│   │   │   ├── tagihan/
│   │   │   ├── target/
│   │   │   ├── investasi/
│   │   │   ├── laporan/
│   │   │   ├── impor/
│   │   │   └── pengaturan/
│   │   └── api/              # route handler: upload, SSE notifikasi, health
│   ├── components/
│   │   ├── glass/            # GlassSurface, ScopeToggle, QuickAddBar
│   │   ├── money/            # Amount, AmountInput, Delta
│   │   ├── charts/
│   │   └── ui/               # Button, Dialog, Sheet, Table, dst.
│   ├── server/
│   │   ├── db/schema.ts
│   │   ├── queries/          # semua query baca, lewat scope.ts
│   │   ├── mutations/        # semua tulis, lewat audit.ts
│   │   ├── metrics/          # rumus PRD bagian 6, satu file per metrik
│   │   ├── ai/
│   │   │   ├── client.ts     # klien OpenAI-compatible
│   │   │   ├── prompts/
│   │   │   └── schemas.ts    # skema Zod output AI
│   │   ├── import/
│   │   │   ├── csv/
│   │   │   ├── pdf/
│   │   │   │   ├── registry.ts
│   │   │   │   └── parsers/  # satu file per institusi
│   │   │   └── dedupe.ts
│   │   └── auth/
│   ├── lib/
│   │   ├── money.ts          # parse "25rb", format rupiah
│   │   ├── dates.ts
│   │   └── quick-add-parser.ts
│   ├── styles/
│   │   ├── tokens.css        # hasil dari DESIGN.md
│   │   └── glass.css
│   └── worker/
│       ├── index.ts
│       └── jobs/
└── tests/
    ├── unit/
    └── e2e/
```

## 4. Pola tulis data

Setiap mutasi melewati `src/server/mutations/`:

1. Validasi input dengan Zod.
2. Buka transaksi database.
3. Update dengan `WHERE version = :expected`. Nol baris berarti lempar `ConflictError` berisi versi terbaru.
4. Tulis `audit_log` di transaksi yang sama.
5. Kalau pemilik data berbeda dari aktor, buat `notifications` untuk pemilik.
6. Commit, lalu `revalidateTag` untuk cache terkait.

Tidak ada komponen atau route yang memanggil `db.update` langsung.

## 5. Klien AI

`src/server/ai/client.ts` membungkus endpoint OpenAI-compatible dengan `fetch`, tanpa SDK vendor, supaya kompatibel dengan server yang tidak lengkap.

| Fungsi | Endpoint | Catatan |
|---|---|---|
| `listModels()` | `GET /models` | Timeout 10 detik. Gagal atau kosong: UI menawarkan input ID manual. |
| `complete()` | `POST /chat/completions` | Timeout 30 detik untuk teks, 60 detik untuk vision |

Urutan strategi output terstruktur:

1. `response_format: { type: "json_schema", json_schema: ... }`.
2. Kalau server menolak parameter itu (HTTP 400 yang menyebut `response_format`), ulangi dengan `{ type: "json_object" }`.
3. Kalau masih ditolak, kirim tanpa `response_format` dengan instruksi JSON di system prompt.
4. Parse, validasi dengan Zod. Gagal validasi: satu kali retry dengan pesan error validasi dilampirkan. Gagal lagi: kembalikan hasil parsial ke pratinjau dengan field kosong ditandai.

Hasil deteksi strategi yang berhasil disimpan di `ai_settings.supports_json_schema` supaya request berikutnya tidak membuang percobaan.

Gambar dikirim sebagai `image_url` berisi data URL base64.

Prompt disimpan sebagai file di `src/server/ai/prompts/` dengan versi di nama file. Prompt quick-add menyertakan daftar nama akun dan kategori rumah tangga supaya model memilih dari daftar, bukan mengarang. Output yang merujuk akun atau kategori di luar daftar dianggap kosong.

Semua panggilan AI dari browser lewat server. Browser tidak pernah menerima API key atau base URL.

## 6. Pipeline impor

```
upload → simpan file sementara → job parse → import_rows (parsed)
       → job dedupe → layar tinjau → commit (transaksi DB tunggal)
```

**CSV.** Deteksi encoding (UTF-8, Windows-1252), pemisah (koma, titik koma, tab), baris header. Pemetaan kolom dari templat institusi atau dari langkah pemetaan manual.

**PDF.** `registry.ts` memetakan `institution.slug` ke parser. Kontrak parser:

```ts
interface StatementParser {
  slug: string;
  canParse(text: string): boolean;     // deteksi dari teks halaman pertama
  parse(pages: string[]): ParsedRow[]; // tanggal, deskripsi, nominal bertanda, saldo opsional
}
```

Kalau statement menyediakan saldo per baris, parser memverifikasi bahwa saldo berjalan konsisten. Ketidakcocokan menandai batch sebagai "perlu dicek" dan menampilkan baris yang tidak cocok.

Setiap parser wajib punya fixture PDF anonim di `tests/fixtures/statements/<slug>/` dan tes yang membandingkan hasil dengan snapshot. Daftar parser v1 menunggu item terbuka O-1.

Fallback AI untuk PDF: teks per halaman dikirim ke model teks dengan skema baris. Batch bertanda `ai_pdf` dan layar tinjau menampilkan peringatan.

**Dedupe.** Lihat PRD F-IN-6 dan `DATA-MODEL.md` tabel `import_rows`.

## 7. Job terjadwal (worker)

| Job | Jadwal (WIB) |
|---|---|
| Buat draf transaksi berulang | Setiap hari 00:10 |
| Salin anggaran bulan baru | Tanggal 1, 00:05 |
| Hitung tagihan kartu kredit | Setiap hari 01:00 |
| Notifikasi jatuh tempo | Setiap hari 08:00 |
| Wawasan mingguan | Senin 06:00 |
| Hapus permanen data terhapus > 30 hari | Setiap hari 03:00 |
| Hapus file impor sementara > 7 hari | Setiap hari 03:15 |

## 8. Realtime antar pengguna

Saat satu orang menyimpan transaksi, layar orang lain yang sedang terbuka perlu tahu. v1 memakai Server-Sent Events di `/api/events` yang mengirim `{entity, id}`. Klien memanggil `router.refresh()` dengan debounce 1 detik. PostgreSQL `LISTEN/NOTIFY` menjadi sumber event.

## 9. Offline dan PWA

- Service worker menyimpan cache shell app dan respons dashboard terakhir.
- Quick-add saat offline masuk IndexedDB dan dikirim saat online dengan `client_id` idempoten supaya tidak dobel.
- Foto struk tidak diproses saat offline. UI menjelaskan alasannya.

## 10. Observabilitas

- Log JSON ke stdout, dirotasi Docker (maksimal 50 MB per container).
- Endpoint `/api/health` mengecek koneksi database dan umur job terakhir.
- Isi transaksi, nominal, dan API key tidak pernah masuk log.
