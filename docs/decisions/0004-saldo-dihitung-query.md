# 0004 Saldo akun dihitung query agregat, bukan materialized view

## Konteks

`DATA-MODEL.md` (tabel `accounts`) menyebut materialized view `account_balances` yang diperbarui trigger pada tabel `transactions` untuk performa.

Materialized view di PostgreSQL tidak bisa diperbarui sebagian. `REFRESH MATERIALIZED VIEW` selalu menghitung ulang seluruh view, dan varian `CONCURRENTLY` tidak bisa dipanggil dari dalam transaksi. Kalau refresh dipanggil trigger per baris, setiap simpan transaksi menghitung ulang saldo semua akun di dalam transaksi database yang sama. Hasilnya lebih lambat daripada menghitung langsung dan menambah lock di jalur tulis.

Selain itu, beberapa kebutuhan memerlukan saldo yang tidak bisa diambil dari view berisi saldo terakhir saja:

- saldo per tanggal: grafik saldo kumulatif harian (F-DASH-1 AC2) dan saldo saat cetak tagihan kartu kredit (F-BILL-1 AC3);
- saldo tanpa satu transaksi: validasi saldo Tunai saat mengedit transaksi (PRD 5.4);
- saldo yang harus konsisten di dalam transaksi database yang sedang menulis, misalnya saat rekonsiliasi dan validasi saldo.

## Keputusan

Saldo dihitung dengan satu query agregat di `src/server/queries/balances.ts`:

```
saldo = opening_balance + jumlah masuk - jumlah keluar
```

Transaksi yang dihitung hanya yang terkonfirmasi, tidak terhapus, dan terjadi pada atau setelah `opening_date` (tanggal WIB). Saldo awal diperlakukan sebagai delta pada `opening_date`, jadi saldo per tanggal dan grafik harian memakai sumber yang sama dengan saldo terakhir.

Tidak ada materialized view dan tidak ada trigger saldo. `drizzle-pending/data.sql` tidak menambahkan objek untuk saldo.

## Konsekuensi

- Tidak ada cache yang bisa basi. Saldo selalu sama dengan isi tabel `transactions`, termasuk di dalam transaksi yang belum di-commit.
- Index yang sudah ada, `(account_id, occurred_at desc)` dan `(to_account_id, occurred_at desc)`, cukup untuk query ini.
- Hasil ukur lokal dengan 20.000 transaksi di 4 akun: `getDashboard` 37-54 ms per cakupan, termasuk semua query dashboard. Daftar transaksi dengan filter teks 6-15 ms. Keduanya jauh di bawah target toggle 300 ms (PRD F-SCOPE-1 AC1).
- Kalau suatu saat data jauh melewati target PRD bagian 8, opsi berikutnya adalah tabel snapshot saldo bulanan yang ditulis job harian. Query saat itu cukup menjumlahkan snapshot ditambah delta sejak snapshot terakhir, tanpa mengubah API `getAccountBalances`.
