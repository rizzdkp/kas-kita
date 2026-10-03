# 0015 Transaksi yang dipecah dihitung per kategori split

## Konteks

Foto struk bisa disimpan dengan "Pecah per kategori" (F-IN-3 AC3): tetap satu transaksi, nominalnya dirinci di `transaction_splits`, dan `transactions.category_id` diisi kategori dengan bagian terbesar. Semua agregasi semula membaca `transactions.category_id`, jadi struk Rp 168.000 (Belanja dapur 120.000 + Kesehatan 48.000) masuk seluruhnya ke Belanja dapur. Anggaran Kesehatan tidak terpakai, sisa anggaran wajib di Aman dibelanjakan terlalu besar, dan prediksi menghitung bagian Kesehatan sebagai pengeluaran fleksibel. PRD dan DATA-MODEL tidak mengatur cara agregasi split.

## Keputusan

Pemilik produk memutuskan transaksi yang dipecah dihitung per kategori split di semua agregasi.

- Satu sumber kebenaran di `src/server/queries/scope.ts`: subquery `categoryLines` (`category_lines`). Setiap transaksi yang dihitung (terkonfirmasi, tidak dihapus, bukan transfer, kategori utamanya bukan kategori sistem) menghasilkan satu baris per split bila dipecah, selain itu satu baris dari `category_id` dan `amount` transaksinya. Kolom: `transactionId`, `categoryId`, `amount`, `kind`, `occurredAt`, `accountId`, `ownerId`. Pembantu: `lineInScope`, `lineInRange`, `lineOwnedBy`, dan `transactionHasCategory` untuk filter daftar.
- Jumlah baris per transaksi sama dengan nominal transaksinya karena trigger deferred `transaction_splits_sum` (migrasi 0003). Tes integrasi `tests/integration/category-lines.test.ts` menjaga invarian ini.
- Yang membaca `categoryLines`: pengeluaran dan pemasukan per kategori beserta kontribusi per pemilik (`lineTotalsByCategory`, `expenseByCategory`, `incomeByCategory`), terpakai anggaran (`expenseByOwnerAndCategory` → `listBudgets`, termasuk status, laju, sisa anggaran wajib di Aman dibelanjakan, dan notifikasi anggaran wajib lewat), pengeluaran fleksibel prediksi (bagian split di kategori beranggaran wajib dikecualikan per baris), wawasan (kategori naik, laju anggaran, id transaksi penyusun, tanpa menghitung satu struk dua kali), dan laporan bulanan.
- Total pemasukan dan pengeluaran periode, tren 12 bulan, dan kontribusi arus per pemilik tetap dijumlah per transaksi; hasilnya sama karena invarian di atas.
- Filter `/transaksi?kategori=<id>` menampilkan transaksi yang kategori utamanya atau salah satu split-nya ada di kategori itu atau anaknya. Tautan kategori dari Ringkasan, Laporan, dan wawasan memakai filter yang sama.

## Konsekuensi

- `transactions.category_id` tetap kategori utama. Kolom ini dipakai untuk tampilan baris transaksi, pencarian teks, default form, dan saran kategori (impor dan bar catat); split tidak mengubah perilaku itu.
- Baris transaksi yang dipecah menampilkan kategori utama plus penanda "dipecah ke [n] kategori"; rincian lengkap ada di detail transaksi.
- Ekspor CSV tetap satu baris per transaksi, dengan kolom baru "Rincian kategori" berisi "Kategori A Rp x; Kategori B Rp y" untuk transaksi yang dipecah.
- Kategori yang hanya dipakai split dihitung "sudah dipakai": tidak bisa dihapus (diarsipkan) dan jenisnya tidak bisa diganti.
- Anggaran pada kategori sistem (Penyesuaian saldo) tidak pernah terpakai karena baris kategori mengecualikan kategori sistem, sama dengan aturan F-ACC-2 untuk pengeluaran.
- Form ubah transaksi belum bisa mengubah split. Mengganti nominal atau jenis transaksi yang dipecah ditolak mutasi dengan pesan COPY.md (lihat 0016); mengganti kategori utamanya tidak mengubah agregasi karena split yang dihitung.
