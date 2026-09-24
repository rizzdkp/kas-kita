# 0006 Ekspor PDF laporan lewat halaman cetak, bukan pustaka PDF

## Konteks

F-REP-1 AC3 meminta ekspor PDF ringkasan bulanan. Pustaka PDF di server (pdfkit, @react-pdf/renderer) atau browser headless menambah dependensi besar, butuh font Geist di-embed ulang, dan menduplikasi tata letak yang sudah ada sebagai komponen React. Satu VPS kecil tidak perlu menjalankan Chromium hanya untuk ini.

## Keputusan

- Rute `/laporan/cetak?bulan=YYYY-MM&scope=...` merender ringkasan bulanan sebagai dokumen tabel (ringkasan, pengeluaran per kategori, pemasukan per kategori, tren 12 bulan) dari `getMonthlyReport`, sama dengan halaman Laporan.
- Tombol "Cetak / simpan PDF" memanggil `window.print()`. Pengguna memilih "Simpan sebagai PDF" di dialog cetak browser (tersedia di Safari iOS/macOS, Chrome, Edge, Firefox).
- `src/components/reports/print.css` (`@media print`) hanya menampilkan `.kk-print-doc`: shell, medan ambien, bar quick-add, dan kontrol disembunyikan lewat `visibility`, jadi AppShell tidak perlu diubah. Kertas A4, margin 16 mm, warna dipaksa hitam di atas putih walau mode gelap aktif. Nilai hex di file itu khusus kertas, bukan token layar.
- Grafik tidak dicetak; tren 12 bulan tampil sebagai tabel, sesuai aturan tabel data alternatif (DESIGN 10).

## Konsekuensi

- Tanpa dependensi baru dan tanpa proses server tambahan. Isi PDF selalu sama dengan angka di layar karena memakai query yang sama.
- Nama file dan header/footer halaman ditentukan browser, bukan app. Header/footer bawaan browser bisa dimatikan pengguna di dialog cetak.
- Tidak ada unduhan PDF satu klik atau PDF terjadwal lewat email. Kalau nanti dibutuhkan, tambahkan renderer server di balik rute yang sama.
