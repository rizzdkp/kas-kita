# 0014 Ilustrasi isometrik di login, state kosong, dan momen tercapai

## Konteks

DESIGN dan komponen `EmptyState` semula menetapkan state kosong tanpa ilustrasi. Pemilik produk menilai app terlalu datar dan memutuskan memakai ilustrasi isometrik 3D di halaman masuk dan semua state kosong. Ilustrasi harus terhubung dengan uang rumah tangga berdua, bukan karakter generik.

## Keputusan

- Satu set komponen SVG inline di `src/components/illustrations/` yang disusun dari primitif isometrik 30° (`Box`, `Cylinder`, `CoinStack`, `Disc`, `Shadow`) di `iso.tsx`. Tidak ada file raster dan tidak ada teks di dalam gambar.
- Setiap permukaan punya tiga nada (atas terang, kiri sedang, kanan gelap) yang diturunkan dari token lewat `color-mix` di `illustrations.css`. Nada atas dicampur putih dan nada kanan dicampur hitam; ini perhitungan cahaya, bukan warna baru. Nada kertas dan lantai punya nilai gelap sendiri.
- Warna identitas masuk lewat props `meColor` dan `partnerColor`. Tanpa props, nada pemilik jatuh ke aksen dan emas supaya gambar tidak mengklaim warna orang yang salah. Koin memakai `--identity-gold` sebagai warna koin umum.
- Di state kosong ilustrasi dipasang `decorative` (aria-hidden) karena judul sudah menjelaskan; bila dipakai sendiri, ilustrasi punya `role="img"` dan label bahasa Indonesia.
- Gerak: fade-in sekali 220 ms, mati di `prefers-reduced-motion`. Tidak ada animasi berulang.

## Konsekuensi

- `EmptyState` punya prop opsional `illustration`; di layar kecil lebarnya 112 px supaya tombol aksi tetap terlihat.
- Aturan "aksen tidak untuk dekorasi" (DESIGN 2.1) dilonggarkan khusus di dalam ilustrasi.
- Ilustrasi baru wajib memakai primitif yang sama supaya sudut, bayangan, dan nada tetap satu sistem.
