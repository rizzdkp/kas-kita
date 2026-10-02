# 0008 Parser PDF referensi "contoh-bank" sambil menunggu O-1

## Konteks

ARCHITECTURE 6 meminta parser PDF per institusi dengan fixture anonim dan tes snapshot. Daftar bank dan format unduhan (O-1 di docs/prd/README.md) belum dijawab. Menulis parser untuk format bank sungguhan tanpa contoh asli berarti menebak tata letak, dan tebakan yang salah lebih buruk daripada fallback AI yang jujur.

## Keputusan

- Kontrak `StatementParser { slug, canParse(text), parse(pages) }` di `src/server/import/pdf/types.ts`; daftar parser di `registry.ts`.
- Satu parser referensi `contoh-bank` (`parsers/contoh-bank.ts`) untuk format e-statement sintetis buatan sendiri ("BANK CONTOH / REKENING KORAN ELEKTRONIK", kolom TANGGAL, JAM, KETERANGAN, MUTASI, D/K, SALDO, keterangan lanjutan di baris berikutnya, dua halaman). Ini bukan format bank mana pun; gunanya menunjukkan kontrak dan pola.
- Fixture di `tests/fixtures/statements/` (sesuai ARCHITECTURE 6, bukan `tests/fixtures/imports/pdf/`), dihasilkan `tests/fixtures/statements/generate.ts` tanpa dependensi baru. Tes memastikan file di repo sama dengan hasil generate.
- `registry.parseStatement` membungkus `canParse` dan `parse` setiap parser dengan try/catch sendiri (F-IN-5 AC4). Log hanya slug, tahap, dan nama kelas error.
- Verifikasi saldo berjalan generik (`verify-balance.ts`) untuk semua parser: saldo sebelumnya + nominal = saldo; baris yang tidak cocok mendapat `raw.__balanceMismatch = "1"`, batch tetap review.
- Institusi batch dicari dari `institutions.slug` sama dengan slug parser; kalau baris institusi belum ada, `institution_id` null.

## Cara menambah parser bank (setelah O-1)

1. Minta satu e-statement asli, ganti nama, nomor rekening, dan nominal dengan data karangan, lalu buat fixture anonim di `tests/fixtures/statements/<slug>/` (salin tata letak lewat `pdf-writer.ts` atau anonimkan PDF asli).
2. Tulis `parsers/<slug>.ts` yang memenuhi kontrak; `canParse` hanya memakai teks halaman pertama; lempar error bila baris tidak sesuai harapan, jangan menebak.
3. Daftarkan di `statementParsers` dan tambah baris `institutions` dengan slug yang sama.
4. Tes snapshot seperti `tests/unit/pdf-contoh-bank-parser.test.ts`.

## Konsekuensi

- Saat ini e-statement bank sungguhan selalu jatuh ke "Format mutasi ini belum dikenali" dan fallback AI atau CSV.
- Parser referensi dapat dihapus dari registry setelah parser nyata pertama ada; fixture dan tesnya tetap berguna sebagai contoh.
