# 0007 PDF berpassword dibuka langsung oleh pdfjs, tanpa qpdf

## Konteks

F-IN-5 AC2: PDF e-statement berpassword dibuka dengan password dari pengguna, dipakai di memori, dan tidak pernah disimpan. Rencana awal menyebut qpdf untuk mendekripsi sebelum ekstraksi teks. qpdf adalah biner sistem yang harus dipasang di image dan dipanggil lewat proses anak (password lewat argumen atau stdin, file hasil dekripsi di disk).

## Keputusan

- Ekstraksi teks memakai `pdfjs-dist` v5 build legacy (`src/server/import/pdf/extract-text.ts`). `getDocument({ data, password })` mendekripsi handler standar (RC4 40/128-bit, AES-128, AES-256) di memori.
- `PasswordException` dipetakan ke `needs_password` dengan `wrongPassword` = kode `INCORRECT_PASSWORD`. Route unggah meminta password lewat dialog dan mengirim ulang file bersama password dalam satu request.
- Password tidak pernah ditulis ke disk, database, log, atau job worker. Untuk fallback AI, app mengekstrak teks dengan password lalu hanya teks per halaman yang dikirim ke antrean `import.pdf-ai`.
- Ekstraksi berjalan di proses app untuk parser lokal (cepat, < 1 detik untuk e-statement biasa); worker hanya menjalankan panggilan AI. Ini menyimpang dari SECURITY.md ("password hanya di memori worker"): password tetap hanya di memori, tetapi memori proses app.
- pdfjs dimuat dengan worker di thread utama (`globalThis.pdfjsWorker`) supaya Next.js tidak perlu menyelesaikan path file worker saat dibundel; tanpa render, tanpa font sistem, tanpa skrip PDF.
- Fixture berpassword dibuat tanpa alat luar: `tests/fixtures/statements/pdf-writer.ts` menulis PDF minimal dengan enkripsi standar RC4 128-bit (R3) memakai `node:crypto` (MD5) dan RC4 yang ditulis sendiri.

## Konsekuensi

- Tidak ada biner tambahan di image dan tidak ada file hasil dekripsi di disk.
- Format enkripsi yang tidak didukung pdfjs (handler non-standar, sertifikat publik) gagal sebagai "PDF ini tidak bisa dibuka". Belum ditemukan kasus nyata; bila muncul, qpdf bisa ditambahkan di worker.
- PDF besar diproses di proses app; batas 20 MB dan 200 halaman mencegah request terlalu berat.
