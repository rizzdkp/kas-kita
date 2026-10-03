# 0016 Aset unduhan: gambar 3D Fluent Emoji dan logo idn-finlogos

Menggantikan 0014 untuk ilustrasi, dan bagian monogram 0012 untuk institusi yang logonya tersedia.

## Konteks

Pemilik produk meminta aset tidak dibuat sendiri: "asetnya jangan buat sendiri, kamu harus download dari hasil research dan pasang semuanya, saya mau ada aset-aset di setiap page supaya ramai dan indah". Ilustrasi isometrik SVG buatan sendiri (0014) dan monogram institusi (0012) diganti. Permintaan ini mengikat dan mengalahkan aturan DESIGN 9 ("Tidak ada emoji di UI") dan anti-slop R-22 untuk gambar; disiplin lainnya tetap: setiap aset terkait isi tempatnya, angka tetap paling menonjol, aset tidak menutupi data, dan terbaca di mode terang dan gelap.

Container pengembangan hanya bisa mengakses GitHub dan registry npm, jadi sumber dipilih dari dua tempat itu.

## Keputusan

1. **Gambar 3D: Microsoft Fluent Emoji** (github.com/microsoft/fluentui-emoji, commit `1ffb34c7`, lisensi MIT). 71 gambar 3D dari folder `assets/<nama>/3D/` (PNG 256 px) diubah ke WebP 64, 128, dan 256 px oleh `scripts/assets/build-3d.mjs` ke `public/assets/3d/<nama>-<ukuran>.webp`. Total 213 berkas, sekitar 670 KB di repo; satu halaman memuat hanya ukuran yang cocok lewat `srcset`/`sizes`.
   - Komponen: `Asset3D` (`<img>` dengan `width`/`height`, `loading="lazy"`, `decoding="async"`, dekoratif kecuali diberi `alt`). Tanpa `next/image` karena berkas sudah dioptimalkan dan kecil.
   - Kepala halaman: `PageArt` dengan satu peta path ke aset (`page-art-map.ts`), dipasang terpusat di `AppShell` (kiri judul di kepala konten < 1024 px) dan `Toolbar` (kiri judul >= 1024 px), 40 px. Aset utama ditambah satu pendamping kecil bila memperjelas isi (Ringkasan kantong uang dan koin, Laporan grafik dan papan klip).
   - Kategori: `CategoryIcon` memakai aset 3D 24 px (15 px di ukuran kecil) di atas tint nada kategori 0012. Urutan pencarian: nama sendiri (induk seed), ikon sendiri, nama induk, ikon induk; tidak dikenal jatuh ke ikon Lucide. Semua kunci ikon yang bisa dipilih pengguna punya aset. Hadiah pemasukan memakai angpau, hadiah pengeluaran memakai kado.
   - Jenis akun tanpa institusi: dompet koin (tunai), grafik naik (investasi), permata (aset lain), kartu (kartu kredit/paylater), uang bersayap (pinjaman), bank, ponsel (e-wallet tanpa institusi).
   - State kosong dan momen tercapai memakai nama komponen yang sama dari `@/components/illustrations`, kini aset 3D dengan satu pendamping. Aset state kosong sengaja berbeda dari aset kepala halaman yang sama supaya satu layar tidak menampilkan gambar kembar.
   - Login: komposisi rumah berkebun, kantong uang, kartu, dan koin.
   - Ringkasan: aset 28 px di kepala kartu Tagihan mendatang, Target, Akun, dan Wawasan minggu ini saja; kartu angka (hero, metrik, grafik) tanpa aset supaya angka tetap paling menonjol.
2. **Logo bank dan e-wallet: idn-finlogos 2.5.0** (npm, aset CC BY-NC 4.0, logo milik pemilik merek). 14 SVG disalin ke `public/brands/<slug>.svg`. Varian simbol persegi dipilih bila paket menyediakannya (Jago, GoPay, BRI, Jenius, CIMB Niaga) karena wordmark lebar tidak terbaca di ubin 20-32 px; sisanya wordmark utama. Satu-satunya perubahan berkas: menambah `xmlns` supaya SVG tampil lewat `<img>`. Tanpa dependensi runtime.
   - Logo tampil di ubin putih (`--logo-tile`, putih di kedua mode) dengan ring 1 px (`--logo-tile-ring`) supaya warna asli logo benar di mode gelap dan ubin tidak menyatu dengan kartu putih di mode terang.
   - Monogram `--inst-*` tetap sebagai cadangan untuk tanda yang belum punya logo; institusi tak dikenal tetap monogram netral.
3. **Atribusi**: bagian "Tentang dan lisensi aset" di Pengaturan, `public/assets/CREDITS.md` (daftar berkas ke folder/berkas sumber), dan salinan lisensi di `public/assets/licenses/`.
4. Gambar halaman offline (`satellite-antenna` 128 dan 256) ikut precache service worker; batas cache gambar runtime dinaikkan dari 48 ke 240 entri karena jumlah berkas kecil bertambah.

## Konsekuensi

- **Logo hanya boleh dipakai non-komersial.** Kalau Kas Kita dikomersialkan atau dibuka untuk umum, logo idn-finlogos harus dihapus (cukup kosongkan `LOGOS` di `institutions.ts`; monogram 0012 kembali tampil) atau diganti dengan izin dari pemilik merek. Fluent Emoji (MIT) boleh tetap dipakai dengan menyertakan lisensinya.
- DESIGN 9 "Tidak ada emoji di UI" kini berarti: tidak ada karakter emoji di teks UI. Gambar 3D Fluent Emoji adalah aset gambar, bukan teks, dan tidak pernah menggantikan label.
- Tes `tests/unit/assets-3d.test.ts` menjaga daftar nama sama dengan skrip konversi, setiap berkas ada dan kecil, tidak ada berkas yatim, logo punya namespace, dan semua ikon kategori yang bisa dipilih punya aset.
- Menambah aset: tambah nama folder Fluent di `scripts/assets/build-3d.mjs` dan nama kebab-case di `asset-names.ts`, jalankan skrip terhadap clone sparse, perbarui `CREDITS.md`.
- Primitif isometrik 0014 (`iso.tsx`, `illustrations.css`) dihapus.
