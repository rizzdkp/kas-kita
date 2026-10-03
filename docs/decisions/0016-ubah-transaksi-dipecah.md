# 0016 Nominal dan jenis transaksi yang dipecah tidak bisa diubah dari form

## Konteks

Transaksi dari foto struk yang disimpan dengan "Pecah per kategori" punya baris `transaction_splits` yang jumlahnya wajib sama dengan `transactions.amount` (trigger deferred `transaction_splits_sum` dan `transactions_splits_sum`, migrasi 0003). Keputusan 0015 menjadikan split sumber kebenaran untuk semua agregasi per kategori.

Form ubah transaksi (F-IN-1) dan `updateTransaction` tidak tahu soal split. Mengganti nominal transaksi yang dipecah lolos semua validasi lalu ditolak trigger saat commit dengan SQLSTATE 23514 yang tidak dipetakan, sehingga pengguna hanya melihat error umum. Mengganti jenis ke Pemasukan juga lolos tanpa error, padahal split tetap memakai kategori pengeluaran dan `categoryLines` akan menghitungnya sebagai pemasukan di kategori pengeluaran.

Opsi yang dipertimbangkan:

1. Tolak perubahan nominal dan jenis di mutasi dengan `ValidationError` dan pesan dari COPY.md.
2. Skala ulang split secara proporsional mengikuti nominal baru. Ditolak: angka per kategori berubah tanpa pengguna melihatnya, dan pembulatan rupiah perlu aturan sisa yang tidak ada di PRD.
3. Tampilkan dan ubah baris split di form ubah transaksi. Paling lengkap, tapi butuh UI baru (rincian per kategori, selisih, validasi jumlah) yang belum ada di UX-FLOWS dan COPY.md.

## Keputusan

Opsi 1, sampai ada desain untuk opsi 3.

- `updateTransaction` di `src/server/mutations/transactions.ts` memanggil `assertSplitsUnaffected` sebelum validasi referensi dan saldo. Kalau `amount` atau `kind` berubah dan transaksi punya split, mutasi melempar `ValidationError` sebelum menulis apa pun.
- Pesan nominal dikirim sebagai `fieldErrors.amount`, jadi tampil di bawah field Nominal. Pesan jenis tanpa `fieldErrors` karena form tidak punya slot error untuk jenis; tampil sebagai error form.
- Teks ada di COPY.md baris "Ubah transaksi dipecah, error" dan di `SPLIT_EDIT_MESSAGES`.
- Edit lain tetap bisa: tanggal, akun, catatan, tag, untuk siapa, status, dan kategori utama (yang menurut 0015 hanya untuk tampilan). Mengirim nominal yang sama tidak dianggap perubahan.
- 23514 dari trigger split tidak dipetakan di lapisan aksi. Satu-satunya jalur yang mengubah `transactions.amount` sekarang dijaga sebelum commit, jadi kalau trigger tetap menolak, itu bug yang harus terlihat, bukan disembunyikan jadi pesan pengguna.

## Konsekuensi

- Pengguna yang salah memasukkan total struk harus menghapus transaksi lalu mencatat ulang. Foto struk yang sudah jadi lampiran tidak otomatis bisa dibaca ulang dari transaksi yang dihapus.
- Ubah jenis ke Transfer juga ditolak, walaupun transfer tidak masuk `categoryLines`, supaya tidak ada split yatim di transaksi transfer.
- Tes integrasi `tests/integration/transaction-splits-edit.test.ts` menjaga perilaku ini: nominal dan jenis ditolak tanpa mengubah transaksi, split, atau audit; edit lain tetap jalan.
- Bila nanti form bisa mengubah split (opsi 3), pemeriksaan ini diganti dengan mutasi yang menulis transaksi dan split dalam satu transaksi database.
