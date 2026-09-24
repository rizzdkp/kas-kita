# Alur dan layar

## 1. Navigasi

Referensi punya 13 item navigasi. Kas Kita memakai 8, sisanya dipindah ke tempat yang lebih dekat dengan konteks pakainya.

| Item | Isi | Asal di referensi |
|---|---|---|
| Ringkasan | Dashboard | Dashboard |
| Transaksi | Daftar, filter, detail, riwayat edit | Riwayat Transaksi |
| Akun | Semua akun, saldo, rekonsiliasi | Daftar Akun |
| Anggaran | Anggaran per kategori, prediksi | Budgeting & Prediksi |
| Tagihan | Tagihan terjadwal, kartu kredit | Target & Tagihan (dipisah) |
| Target | Target tabungan | Target & Tagihan (dipisah) |
| Investasi | Akun investasi dan valuasi | Portofolio Investasi |
| Laporan | Laporan periode, ekspor | Laporan Keuangan |

Dipindah:
- Tambah Transaksi menjadi bar quick-add yang selalu ada, bukan halaman.
- Impor masuk ke menu tombol tambah dan ke halaman Akun.
- FlowAI Config, Panduan, dan Pengaturan digabung ke Pengaturan (ikon di bawah sidebar dan di menu avatar).

Layar kecil: tab bar glass di bawah berisi Ringkasan, Transaksi, tombol tambah (tengah), Anggaran, Lainnya. "Lainnya" membuka sheet berisi sisa item.

## 2. Shell

```
Besar (≥1024px)
┌──────────────────────────────────────────────────────────────┐
│ [ambient field di belakang semua]                            │
│ ┌──────────┐  ┌───────────────────────────────────────────┐  │
│ │ sidebar  │  │ toolbar glass: judul · [Saya|Partner|Gab] │  │
│ │ glass    │  │                 · periode · notif · avatar│  │
│ │          │  └───────────────────────────────────────────┘  │
│ │ nav      │                                                 │
│ │          │   konten (kartu solid)                          │
│ │          │                                                 │
│ │          │        ┌─────────────────────────────┐          │
│ │ ⚙        │        │ quick-add glass (melayang)  │          │
│ └──────────┘        └─────────────────────────────┘          │
└──────────────────────────────────────────────────────────────┘

Kecil (<600px)
┌──────────────────────────┐
│ [Saya|Partner|Gabungan]  │  glass, sticky
│                          │
│ konten                   │
│                          │
│ ┌──────────────────────┐ │
│ │ quick-add glass      │ │
│ └──────────────────────┘ │
│ ┌──────────────────────┐ │
│ │ tab bar glass   (+)  │ │
│ └──────────────────────┘ │
└──────────────────────────┘
```

Bar quick-add di desktop menempel di bawah tengah area konten, lebar maksimal 640px. Shortcut `/` atau `Ctrl/Cmd+K` memfokuskannya dari mana saja.

## 3. Ringkasan (dashboard)

Urutan dari atas, disusun dari pertanyaan yang paling sering diajukan:

1. **Hero tanpa kartu.** "Aman dibelanjakan sampai gajian, 12 hari lagi" dan angka besar. Di bawahnya satu baris: saldo likuid, tagihan sebelum gajian, setoran target. Tombol "Cara menghitung" membuka panel rumus.
2. **Perlu perhatian.** Hanya muncul kalau ada isinya: tagihan telat atau jatuh tempo 3 hari lagi, anggaran wajib lewat, transaksi draf menunggu konfirmasi, selisih rekonsiliasi. Maksimal 3 baris, sisanya "Lihat semua".
3. **Arus bulan ini.** Pemasukan, pengeluaran, dan rasio tabungan dalam satu baris, dengan delta ke periode setara. Di bawahnya grafik saldo kumulatif harian dengan garis putus-putus proyeksi sampai akhir periode.
4. **Anggaran.** Lima kategori dengan persentase terpakai tertinggi, batang horizontal dengan penanda hari ini.
5. **Pengeluaran per kategori.** Batang horizontal berurutan, label penuh.
6. **Tagihan mendatang** dan **Target** berdampingan (satu kolom di mobile).
7. **Akun.** Daftar ringkas saldo per akun, dikelompokkan likuid, kewajiban, aset.
8. **Cek kesehatan.** Empat pemeriksaan dengan rumusnya.
9. **Wawasan minggu ini.** Maksimal tiga kalimat, masing-masing dengan tautan "Lihat transaksi".

Di cakupan Gabungan, bagian 3 dan 5 menampilkan kontribusi per orang sebagai segmen berwarna identitas di setiap batang.

## 4. Alur quick-add

```
Fokus bar → ketik "kopi 25rb gopay" → Enter
  → parser lokal lengkap? ── ya ──► kartu pratinjau
                         └─ tidak ─► AI terkonfigurasi? ─ ya ─► spinner di bar (maks 30 dtk) ─► kartu pratinjau
                                                        └ tidak ► kartu pratinjau, field kosong ditandai
Kartu pratinjau: Pengeluaran · Rp 25.000 · GoPay (milik Rizz) · Kopi dan jajan · Hari ini 09.12 · Untuk: Saya
  → Enter / "Simpan" → toast "Tersimpan" dengan tombol "Urungkan" (5 detik)
  → klik field mana pun untuk mengubah sebelum simpan
```

- Akun default mengikuti cakupan aktif: di cakupan Partner, akun default adalah akun milik partner yang terakhir dipakai.
- Kalau cakupan Partner aktif, kartu pratinjau menampilkan "Dicatat atas nama [partner], diisi oleh kamu".
- Beberapa baris input menghasilkan beberapa kartu dengan tombol "Simpan semua".

## 5. Alur foto struk

1. Tombol kamera di bar quick-add atau menu tombol tambah.
2. Mobile: buka kamera belakang langsung (`capture="environment"`). Desktop: pilih file atau seret.
3. Kompres di browser, unggah, tampilkan progres unggah lalu "Membaca struk…".
4. Layar pratinjau dua kolom (mobile: foto di atas, bisa diperbesar): foto, dan field hasil. Item struk tampil sebagai daftar dengan kategori per item.
5. Pilihan simpan: "Simpan sebagai satu transaksi" atau "Pecah per kategori".
6. Kalau total item tidak cocok dengan total struk, banner di atas field: "Jumlah item Rp 187.000, total struk Rp 192.000. Cek item yang terlewat."

## 6. Alur impor mutasi

1. Pilih akun tujuan (atau dari halaman akun: "Impor mutasi").
2. Unggah CSV atau PDF. PDF berpassword: dialog password dengan penjelasan bahwa password tidak disimpan.
3. CSV tanpa templat: layar pemetaan kolom dengan pratinjau 5 baris pertama. Simpan sebagai templat untuk institusi ini.
4. Layar tinjau, tiga kelompok (PRD F-IN-6). Setiap kemungkinan duplikat menampilkan baris impor dan transaksi pembanding berdampingan.
5. Kategori untuk baris baru disarankan dari riwayat deskripsi yang mirip. Baris tanpa saran ditandai "Pilih kategori".
6. "Impor 42 transaksi" menyimpan dalam satu transaksi database. Toast menautkan ke daftar transaksi dengan filter batch.

## 7. Alur toggle cakupan

- Toggle berpindah, ambien crossfade, semua angka berganti dengan crossfade 120ms (tanpa animasi hitung naik kecuali angka hero).
- Judul halaman tidak berubah. Label di hero berubah: "Aman dibelanjakan sampai gajian" (Saya), "[Nama partner]: aman dibelanjakan sampai gajian" (Partner), "Kalian berdua: aman dibelanjakan sampai gajian terdekat" (Gabungan).

## 8. Alur mengedit data milik partner

1. Rizz membuka transaksi milik partner. Header detail menampilkan titik identitas partner dan "Milik [nama partner]".
2. Rizz mengubah nominal, simpan. Toast: "Tersimpan. [Nama partner] akan melihat perubahan ini di riwayat."
3. Partner menerima notifikasi: "Rizz mengubah Belanja dapur 12 Sep: Rp 185.000 menjadi Rp 158.000." Tautan membuka detail dengan riwayat terbuka.

## 9. Alur konflik edit

Dua orang membuka transaksi yang sama. Orang kedua menyimpan setelah orang pertama.

Dialog: "Transaksi ini baru diubah [nama] pukul 20.14." Dua kolom, versi terbaru dan versi kamu, field yang berbeda disorot. Tombol: "Pakai versi saya" dan "Pakai versi terbaru".

## 10. State kosong

| Layar | Judul | Isi | Aksi |
|---|---|---|---|
| Ringkasan tanpa akun | Tambahkan akun pertama | Mulai dari rekening yang paling sering kamu pakai. Saldonya bisa dicocokkan nanti. | Tambah akun |
| Transaksi kosong | Catat transaksi pertama | Ketik di bar bawah, misalnya "makan siang 35rb bca". | Fokuskan quick-add |
| Anggaran kosong | Atur anggaran bulan ini | Mulai dari dua atau tiga kategori terbesar. Anggaran bulan depan menyalin bulan ini. | Buat anggaran |
| Prediksi belum ada | Prediksi muncul setelah 30 hari data | Saat ini ada data 12 hari. | - |
| Partner belum mencatat | [Nama] belum mencatat transaksi | Kamu bisa mencatat atas namanya dari sini. | Catat untuk [nama] |

## 11. Onboarding pertama

Tiga langkah, bisa dilewati, lalu bisa diulang dari Pengaturan:

1. Nama tampilan, warna identitas, tanggal gajian.
2. Tambah akun (minimal satu) dengan saldo hari ini.
3. Pengaturan AI (bisa dilewati, quick-add tetap jalan tanpa AI).

Pengguna kedua yang login pertama kali melihat akun yang sudah dibuat pengguna pertama dan hanya diminta langkah 1.
