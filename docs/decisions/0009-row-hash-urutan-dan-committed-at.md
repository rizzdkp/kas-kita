# 0009 Row hash dengan urutan kemunculan, dan import_rows.committed_at

## Konteks

DATA-MODEL mendefinisikan `row_hash = sha256(institution, account, tanggal, deskripsi ternormalisasi, nominal bertanda)` dengan unique parsial "row_hash untuk baris decision <> 'skip' di batch committed". Ada dua masalah:

1. Satu file bisa berisi dua transaksi yang benar-benar identik (misalnya dua kali parkir Rp 5.000 di hari yang sama). Dengan hash di atas keduanya bentrok di unique index, padahal keduanya harus diimpor.
2. Status `committed` ada di `import_batches`, sedangkan index ada di `import_rows`. Postgres tidak bisa membuat index parsial dengan syarat dari tabel lain.

## Keputusan

- Hash ditambah satu komponen: urutan kemunculan baris identik di file yang sama (1, 2, 3, ...). File yang diunggah ulang menghasilkan urutan yang sama, jadi tetap terdeteksi sebagai Duplikat pasti; dua baris identik di satu file tetap dua baris Baru.
- Deskripsi dinormalisasi: NFKC, huruf kecil, angka 6 digit atau lebih (nomor referensi) dibuang, tanda baca jadi spasi, spasi tunggal.
- Kolom baru `import_rows.committed_at` diisi saat commit untuk semua baris batch. Unique index `import_rows_committed_hash_uq` on `(row_hash) where decision <> 'skip' and committed_at is not null` (migrasi 0004).
- `file_sha256` yang sama ditolak bila pernah committed di akun mana pun. Batch lama dengan file sama yang belum committed (gagal atau ditinggal di tinjau) dihapus saat file diunggah ulang.

## Konsekuensi

- Kalau impor pertama hanya memuat satu dari dua baris identik dan impor berikutnya memuat keduanya, baris kedua tampil sebagai Baru. Ini benar karena memang ada transaksi kedua.
- Kandidat Kemungkinan duplikat hanya transaksi terkonfirmasi yang belum tertaut ke baris impor. Transaksi hasil impor CSV tidak dicocokkan dengan PDF periode yang sama dari bank yang sama kalau deskripsinya berbeda; itu di luar cakupan M4.
- Transfer manual ikut jadi pembanding (keluar dari akun impor atau masuk ke akun impor). Menautkan transfer hanya dicatat di `import_rows.matched_transaction_id`, tidak di `transactions.import_row_id`, supaya ujung lainnya tetap bisa ditautkan dari impor akun lawan.
