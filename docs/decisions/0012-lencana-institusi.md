# 0012 Lencana institusi dan warna kategori

## Konteks

Pemilik produk menilai app terasa datar dan meminta "semuanya agar hidup". Dua tempat yang paling sering dilihat, daftar akun dan baris transaksi, hanya memakai titik identitas dan ikon abu-abu di lingkaran `surface-sunken` (DESIGN 8). Akun BCA, GoPay, dan Tunai terlihat sama; kategori tidak bisa dikenali sekilas.

Logo resmi bank dan e-wallet adalah merek dagang. Memakai file logo butuh izin dan memperbarui aset bila merek berganti rupa.

## Keputusan

1. **Lencana institusi** (`src/components/brand/`): kotak 32px (radius `sm`) atau 20px (radius `xs`) berisi monogram teks pendek dengan warna yang dikenali dari merek (BCA biru, Jago kuning, GoPay biru muda, OVO ungu, Mandiri biru tua dengan teks kuning, dst). Bukan logo, bukan huruf tiruan logo. Peta `slug -> {label, short, token}` ada di `institutions.ts`; warnanya token `--inst-<slug>-bg/-fg` di `tokens.css`, sama di kedua mode.
   - Institusi tak dikenal: monogram dua huruf dari nama, warna netral.
   - Akun tanpa institusi: ikon jenis akun (Tunai uang, Investasi grafik, Aset lain permata, Kartu kredit kartu, Pinjaman tangan-koin) di lingkaran netral.
   - Bentuk kotak sengaja dibedakan dari lingkaran kategori supaya akun dan kategori tidak tertukar di satu baris.
   - Mode gelap: `--badge-ring` 1px putih 12% supaya lencana gelap (OVO, Mandiri, CIMB) tidak hilang di kanvas hitam dan lencana terang tidak "melompat".
   - Monogram dirender lewat `::before` dari `data-mono` dan seluruh lencana `aria-hidden`; nama akun selalu tampil sebagai teks di sebelahnya, jadi lencana tidak menambah teks ke nama aksesibel atau `textContent`.
   - Kontras monogram terhadap latar >= 4.5:1, dijaga tes `tests/unit/category-colors.test.ts`. Beberapa warna merek digelapkan sedikit untuk lolos (DANA `#0B6FC4`, ShopeePay `#D0391B`); BNI memakai oranye merek dengan teks gelap, bukan tosca, supaya tidak tertukar dengan `accent`.
2. **Warna kategori** (`src/components/categories/`): lingkaran tint lembut dengan ikon berwarna, menggantikan lingkaran `surface-sunken` di baris transaksi (menyimpang dari DESIGN 8). Dua belas nada `--cat-<nada>-bg/-fg` untuk terang dan gelap: oranye, mustard, biru langit, nila, ungu, merah muda, magenta, coklat, zaitun, kelabu biru, kelabu, pasir. Tidak ada merah, hijau, atau teal supaya tidak tertukar dengan `attention`, `positive`, dan `accent` (DESIGN 2.1). Kontras ikon terhadap tint >= 3:1 (komponen non-teks), terukur sekitar 5:1 terang dan 8:1 gelap.
   - Tanpa kolom baru: nada ditentukan dari nama kategori induk (peta seed), lalu ikon induk, lalu hash stabil nama induk. Anak mewarisi induk. Pemasukan selalu pasir; Transfer, Penyesuaian saldo, dan Lainnya netral.
   - Hash memakai nama, bukan id, karena baris transaksi hanya membawa nama induk. Konsekuensinya kategori buatan pengguna bisa berganti warna kalau namanya diubah.
   - Batang grafik kategori tetap netral atau bersegmen warna identitas di Gabungan; warna kategori hanya di ikon.
3. Di baris transaksi, lencana akun **tidak** ditambahkan ke keterangan: baris sudah membawa lingkaran kategori berwarna dan titik identitas, dan lencana ketiga per baris membuat daftar 56px terlalu ramai. Lencana tampil di detail transaksi (Akun, Ke akun) bersama ikon kategori.

## Konsekuensi

- DESIGN 8 "Baris transaksi" perlu diperbarui: lingkaran kategori memakai tint nada kategori, bukan `surface-sunken`.
- Nada kategori berbagi rentang hue dengan beberapa warna identitas (biru, ungu, merah muda). Bedanya dijaga lewat bentuk dan ukuran: identitas selalu titik 8px solid, kategori selalu lingkaran tint 20/32px dengan ikon.
- Menambah institusi baru cukup satu baris di `institutions.ts` dan dua token; tanpa migrasi.
- Kalau kelak ada izin memakai logo resmi, `InstitutionBadge` bisa diganti isi tanpa mengubah pemanggil.
