# 0016 Nominal dan jenis transaksi yang dipecah tidak bisa diubah dari form

## Konteks

Transaksi dari foto struk yang disimpan dengan "Pecah per kategori" punya baris `transaction_splits` yang jumlahnya wajib sama dengan `transactions.amount` (trigger deferred `transaction_splits_sum` dan `transactions_splits_sum`, migrasi 0003). Keputusan 0015 menjadikan split sumber kebenaran untuk semua agregasi per kategori.

Form ubah transaksi (F-IN-1) dan `updateTransaction` semula tidak tahu soal split. Mengganti nominal transaksi yang dipecah lolos semua validasi lalu ditolak trigger saat commit dengan SQLSTATE 23514 yang tidak dipetakan, sehingga pengguna hanya melihat error umum. Mengganti jenis ke Pemasukan lolos tanpa error, padahal split tetap memakai kategori pengeluaran dan `categoryLines` akan menghitungnya sebagai pemasukan di kategori pengeluaran.

Opsi yang dipertimbangkan:

1. Tolak perubahan nominal dan jenis di mutasi dengan pesan dari COPY.md.
2. Skala ulang split secara proporsional mengikuti nominal baru. Ditolak: angka per kategori berubah tanpa pengguna melihatnya, dan pembulatan rupiah perlu aturan sisa yang tidak ada di PRD.
3. Tampilkan dan ubah baris split di form ubah transaksi. Paling lengkap, tapi butuh UI baru (rincian per kategori, selisih, validasi jumlah) yang belum ada di UX-FLOWS dan COPY.md.

## Keputusan

Opsi 1, sampai ada desain untuk opsi 3.

- `updateTransaction` di `src/server/mutations/transactions.ts` memanggil `assertSplitsStillValid`. Kalau `amount` atau `kind` berubah dan transaksi punya split, mutasi melempar `DomainError` dengan kode `split_locked` sebelum menulis apa pun.
- Satu pesan untuk nominal dan jenis, dari COPY.md baris "Ubah nominal atau jenis transaksi yang dipecah per kategori". Pesan tampil sebagai error form, bukan di bawah field Nominal.
- Edit lain tetap bisa: tanggal, akun, catatan, tag, untuk siapa, status, dan kategori utama (yang menurut 0015 hanya untuk tampilan). Mengirim nominal yang sama tidak dianggap perubahan.
- 23514 dari trigger split tidak dipetakan di lapisan aksi. Satu-satunya jalur yang mengubah `transactions.amount` dijaga sebelum commit, jadi kalau trigger tetap menolak, itu bug yang harus terlihat, bukan disembunyikan jadi pesan pengguna.

## Konsekuensi

- Pengguna yang salah memasukkan total struk harus menghapus transaksi lalu mencatat ulang. Pesan menyarankan "catat ulang dari foto struk", tetapi foto yang sudah jadi lampiran transaksi yang dihapus belum tentu bisa dibaca ulang; perlu dicek di alur struk.
- Ubah jenis ke Transfer juga ditolak, walaupun transfer tidak masuk `categoryLines`, supaya tidak ada split yatim di transaksi transfer.
- Tes integrasi `tests/integration/transaction-splits-edit.test.ts` menjaga perilaku ini: nominal dan jenis ditolak tanpa mengubah transaksi, split, atau audit; edit lain tetap jalan.
- Bila nanti form bisa mengubah split (opsi 3), pemeriksaan ini diganti dengan mutasi yang menulis transaksi dan split dalam satu transaksi database.
