# Kas Kita: paket PRD production

Kas Kita adalah nama kerja untuk dashboard keuangan pribadi dua orang (kamu dan partner). Ganti nama di `PRD.md` bagian 1 dan di `COPY.md` kalau sudah ada nama final.

Paket ini ditulis supaya bisa langsung dieksekusi coding agent (Antigravity, Claude Code, Cursor) atau developer manusia. Setiap fitur punya ID, acceptance criteria, dan rujukan ke skema data.

## Urutan baca

| File | Isi | Dibaca oleh |
|---|---|---|
| `AGENTS.md` | Aturan kerja coding agent, perintah, definisi selesai | Agen, wajib pertama |
| `PRD.md` | Masalah, scope v1, fitur, rumus metrik, acceptance criteria | Semua |
| `DATA-MODEL.md` | Skema PostgreSQL, aturan kepemilikan, audit, versioning | Backend |
| `ARCHITECTURE.md` | Stack, struktur folder, pipeline impor dan AI, job queue | Backend, frontend |
| `DESIGN.md` | Token visual terang dan gelap, liquid glass, komponen | Frontend |
| `UX-FLOWS.md` | Navigasi, layar, alur, state kosong dan error | Frontend |
| `COPY.md` | Glosarium, format angka dan tanggal, microcopy | Frontend |
| `SECURITY.md` | Auth, enkripsi, backup, ancaman yang dijaga | Backend, ops |
| `DEPLOYMENT.md` | Docker Compose, Caddy, backup, update di VPS | Ops |
| `ROADMAP.md` | Fase, milestone, apa yang sengaja ditunda | Semua |

## Keputusan yang sudah terkunci

1. Pengguna tepat dua akun. Signup publik tidak ada.
2. Tiga cakupan tampilan: Saya, Partner, Gabungan. Akun bisa dimiliki salah satu orang atau Bersama.
3. Setiap transaksi mencatat pemilik, pencatat, dan pengedit terakhir. Riwayat edit terlihat di UI.
4. Kanal input v1: quick-add teks, foto struk (AI), impor CSV dan PDF mutasi.
5. AI memakai endpoint OpenAI-compatible yang diisi sendiri (base URL, API key, pilih model dari daftar).
6. AI tidak pernah menghitung angka keuangan. Semua angka dihitung kode, AI hanya membaca input dan menulis kalimat dari angka yang sudah jadi.
7. Uang disimpan sebagai `BIGINT` rupiah. Tidak ada float di mana pun.
8. Tampilan terang dan gelap mengikuti sistem. Liquid glass hanya di lapisan navigasi.
9. Target browser: Safari (iOS, macOS), Chrome (Android, desktop), Edge.

## Item terbuka

| ID | Pertanyaan | Dampak kalau belum dijawab |
|---|---|---|
| O-1 | Daftar bank dan e-wallet beserta format unduhan (CSV, PDF, screenshot) | Parser PDF khusus per bank belum bisa ditulis. Impor CSV generik tetap jalan. |
| O-2 | Nama produk final | Hanya kosmetik |
| O-3 | Spesifikasi VPS (RAM, CPU, OS) | Menentukan apakah worker dan app dipisah container |

Isi item terbuka langsung di tabel ini, lalu minta agen memperbarui file terkait.
