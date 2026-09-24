# PRD: Kas Kita v1

Status: siap dieksekusi, dengan item terbuka O-1 sampai O-3 di `README.md`.
Pemilik produk: Rizz.

## 1. Ringkasan

Kas Kita adalah web app keuangan untuk dua orang yang berbagi hidup tapi tetap punya uang masing-masing. App ini menjawab satu pertanyaan setiap kali dibuka: berapa yang aman dibelanjakan sampai gajian berikutnya, untuk saya, untuk partner, dan untuk kami berdua.

App berjalan di VPS milik sendiri, diakses lewat browser di iPhone, Android, Mac, dan laptop Windows. App bisa dipasang sebagai PWA.

## 2. Masalah

Uang kalian tersebar di beberapa bank, e-wallet, kartu kredit, dan tunai. Aplikasi bank hanya melihat satu akun. Spreadsheet butuh disiplin input yang biasanya berhenti di minggu kedua.

Dashboard referensi (FinanceFlow) punya fitur lengkap tapi angkanya tidak bisa dipercaya: saldo tunai negatif ikut dijumlahkan, skor "100 Healthy" muncul saat pengeluaran naik 20%, dan grafik harian rusak oleh satu transaksi gaji. Kas Kita mengambil kelengkapan fiturnya dan menolak ketiga masalah itu.

## 3. Pengguna

| Pengguna | Kebutuhan utama |
|---|---|
| Rizz | Mencatat cepat, melihat posisi sendiri, sesekali mengisi transaksi atas nama partner |
| Partner | Sama, dengan hak setara. Tidak ada peran admin. |

Hak kedua akun setara. Keduanya bisa melihat dan mengedit semua data, dan setiap perubahan tercatat atas nama pelakunya.

## 4. Tujuan dan bukan tujuan

### Tujuan v1

- G1. Input satu transaksi selesai di bawah 10 detik lewat quick-add teks.
- G2. Angka di dashboard selalu bisa ditelusuri ke transaksi penyusunnya.
- G3. Kalian berdua tahu siapa mengubah apa, kapan, dan nilai sebelumnya.
- G4. Mutasi bank bisa diimpor tanpa menggandakan transaksi yang sudah dicatat manual.

### Bukan tujuan v1

- Koneksi langsung ke API bank (open banking). Tidak ada akses resmi yang realistis untuk dua orang.
- Multi-mata uang. Semua rupiah.
- Harga saham atau reksa dana real-time. Nilai investasi diisi manual.
- Bot Telegram, input suara, WhatsApp. Masuk fase 2 (`ROADMAP.md`).
- Lebih dari dua pengguna atau multi-rumah-tangga.

## 5. Konsep inti

### 5.1 Kepemilikan dan cakupan

Setiap akun keuangan punya satu pemilik: `me` dari sudut pandang pengguna yang login, `partner`, atau `shared` (Bersama). Di database, pemilik disimpan sebagai `user_id` atau `NULL` untuk Bersama (lihat `DATA-MODEL.md`).

Toggle cakupan di navigasi punya tiga posisi:

| Cakupan | Menampilkan |
|---|---|
| Saya | Akun milik pengguna yang login |
| Partner | Akun milik partner |
| Gabungan | Semua akun: milik Saya, Partner, dan Bersama |

Akun Bersama hanya muncul di Gabungan dan di halaman Akun. Pilihan ini mencegah akun bersama terhitung dua kali saat kalian membandingkan tampilan Saya dan Partner.

Cakupan tersimpan per pengguna dan per perangkat, dan default ke Saya setiap login baru.

### 5.2 Pemilik, pencatat, pengedit

Transaksi mewarisi pemilik dari akunnya. Selain itu setiap transaksi menyimpan `created_by` dan `updated_by`. Saat Rizz menambah transaksi di akun milik partner (cakupan Partner aktif), transaksi itu milik partner dan tercatat "diisi oleh Rizz".

Saat seseorang mengubah atau menghapus data milik orang lain, pemiliknya menerima notifikasi dalam app (F-NOT-1).

### 5.3 Jenis transaksi

| Jenis | Efek ke laporan |
|---|---|
| Pemasukan | Menambah saldo, masuk ke total pemasukan |
| Pengeluaran | Mengurangi saldo, masuk ke total pengeluaran dan kategori |
| Transfer | Memindah saldo antar akun. Tidak masuk pemasukan atau pengeluaran. |

Transfer antar pemilik berbeda (misalnya Rizz mengirim uang ke akun Bersama) tetap transfer. Di cakupan Saya, transfer keluar ditampilkan sebagai "Transfer ke Bersama" di arus kas, bukan sebagai pengeluaran. Di Gabungan, transfer antar akun sendiri saling meniadakan.

Pembayaran kartu kredit adalah transfer dari rekening ke akun kartu kredit.

### 5.4 Jenis akun

| Jenis | Tanda saldo | Masuk ke |
|---|---|---|
| Bank | Positif | Likuid |
| E-wallet | Positif | Likuid |
| Tunai | Tidak boleh negatif | Likuid |
| Kartu kredit / PayLater | Negatif (utang) | Kewajiban |
| Pinjaman | Negatif (utang) | Kewajiban |
| Investasi | Positif | Aset tidak likuid |
| Aset lain | Positif | Aset tidak likuid |

Validasi: transaksi yang membuat saldo akun Tunai negatif ditolak dengan pesan yang menjelaskan saldo saat ini. Akun Bank dan E-wallet boleh negatif hanya kalau pengguna menandai akun itu mengizinkan overdraft.

## 6. Rumus metrik

Semua rumus dihitung di server, dalam rupiah bulat, untuk cakupan yang aktif. Setiap angka di dashboard punya panel "Cara menghitung" yang menampilkan rumus ini dengan angka aslinya.

| Metrik | Rumus |
|---|---|
| Saldo likuid | Jumlah saldo akun likuid |
| Kewajiban | Jumlah nilai absolut saldo kartu kredit, PayLater, dan pinjaman |
| Nilai bersih | Saldo likuid + aset tidak likuid - kewajiban |
| Pemasukan periode | Jumlah transaksi Pemasukan di periode |
| Pengeluaran periode | Jumlah transaksi Pengeluaran di periode |
| Rasio tabungan | (Pemasukan - Pengeluaran) / Pemasukan. Tampil "belum ada pemasukan" kalau pemasukan 0. |
| Aman dibelanjakan | Saldo likuid - tagihan jatuh tempo sampai gajian berikutnya - setoran target yang direncanakan sampai gajian berikutnya - sisa anggaran wajib bulan ini |
| Hari menuju gajian | Tanggal gajian berikutnya dari pengaturan pengguna dikurangi hari ini (WIB) |

Tanggal gajian diatur per pengguna. Di cakupan Gabungan, "sampai gajian berikutnya" memakai tanggal gajian yang paling dekat dari kedua pengguna.

Periode default adalah bulan kalender. Pengguna bisa mengganti ke "siklus gajian" (tanggal gajian sampai sehari sebelum gajian berikutnya) di pengaturan.

Perbandingan "vs bulan lalu" selalu membandingkan periode yang sama panjangnya sampai hari yang sama. Tanggal 10 September dibandingkan dengan 1-10 Agustus, bukan seluruh Agustus.

## 7. Fitur v1

Setiap fitur punya ID. Coding agent mengerjakan per ID dan menandai selesai hanya kalau semua acceptance criteria (AC) lolos.

### 7.1 Autentikasi

**F-AUTH-1 Login.** Login dengan passkey. Password + TOTP tersedia sebagai cadangan.
- AC1. Tidak ada halaman signup. Akun dibuat lewat perintah CLI di server (`DEPLOYMENT.md`).
- AC2. Setelah 5 percobaan gagal dalam 15 menit, login dari IP tersebut dikunci 15 menit.
- AC3. Sesi berlaku 30 hari di perangkat yang ditandai tepercaya, 12 jam di perangkat lain.
- AC4. Halaman Pengaturan menampilkan daftar sesi aktif dan tombol "Keluar dari perangkat ini" per sesi.

### 7.2 Cakupan

**F-SCOPE-1 Toggle cakupan.** Kontrol segmented Saya / Partner / Gabungan di toolbar atas (desktop) dan di atas konten (mobile).
- AC1. Mengganti cakupan memperbarui semua angka di layar tanpa reload halaman, di bawah 300 ms untuk data sampai 20.000 transaksi.
- AC2. Label Partner memakai nama tampilan partner, bukan kata "Partner".
- AC3. Medan warna ambien di belakang halaman berganti ke warna cakupan (`DESIGN.md` bagian 6).
- AC4. Cakupan tersimpan di URL (`?scope=me|partner|all`) supaya tautan bisa dibagikan antar kalian.

### 7.3 Akun

**F-ACC-1 Kelola akun.** Tambah, ubah, arsipkan akun dengan nama, jenis, pemilik, institusi, saldo awal, dan tanggal saldo awal.
- AC1. Akun tidak bisa dihapus kalau punya transaksi. Opsinya arsip.
- AC2. Mengubah pemilik akun memindahkan semua transaksinya ke pemilik baru dan tercatat di riwayat.
- AC3. Kartu kredit punya tanggal cetak tagihan, tanggal jatuh tempo, dan limit.

**F-ACC-2 Rekonsiliasi saldo.** Pengguna memasukkan saldo sebenarnya dari aplikasi bank. App menampilkan selisih dan menawarkan transaksi penyesuaian.
- AC1. Transaksi penyesuaian memakai kategori sistem "Penyesuaian saldo" dan tidak masuk rasio tabungan.
- AC2. Tanggal rekonsiliasi terakhir tampil di kartu akun.

### 7.4 Input transaksi

**F-IN-1 Form transaksi.** Field: jenis, nominal, akun, kategori, tanggal-waktu, catatan, untuk siapa (Saya / Partner / Bersama), tag, lampiran.
- AC1. Nominal menerima format "25rb", "25.000", "1,5jt", "1.5jt", "25k". Semua disimpan sebagai rupiah bulat.
- AC2. Akun dan kategori terakhir dipakai menjadi default.
- AC3. Form bisa dikirim dengan Enter di desktop.

**F-IN-2 Quick-add teks.** Satu kolom teks di bar quick-add. Contoh input: "kopi 25rb gopay", "gaji 8,5jt bca kemarin", "listrik 500rb bca untuk bersama".
- AC1. Parser aturan lokal berjalan dulu (nominal, nama akun, kata tanggal relatif: hari ini, kemarin, nama hari). Kalau semua field wajib terisi, AI tidak dipanggil.
- AC2. Kalau parser lokal gagal mengisi field wajib dan AI terkonfigurasi, app memanggil model teks.
- AC3. Hasil selalu tampil sebagai kartu pratinjau yang bisa diedit sebelum disimpan. Tidak ada simpan otomatis.
- AC4. Input bisa berisi beberapa transaksi dipisah baris baru. Pratinjau menampilkan semuanya.
- AC5. Tanpa konfigurasi AI, quick-add tetap jalan dengan parser lokal dan menandai field yang kosong.

**F-IN-3 Foto struk.** Unggah atau ambil foto struk dari kamera.
- AC1. Gambar dikompres di browser ke sisi terpanjang 1600 px, JPEG kualitas 0,8, sebelum diunggah.
- AC2. Model vision mengembalikan merchant, tanggal, total, dan daftar item. App memvalidasi bahwa jumlah item mendekati total (selisih di atas 2% ditandai).
- AC3. Pratinjau menampilkan foto di samping field hasil. Pengguna bisa menyimpan sebagai satu transaksi atau memecah per item ke kategori berbeda.
- AC4. Foto tersimpan sebagai lampiran transaksi.
- AC5. Kalau model vision belum dikonfigurasi, tombol foto struk tetap tampil dan membuka pengaturan AI dengan penjelasan.

**F-IN-4 Impor CSV.** Unggah CSV mutasi dari bank mana pun.
- AC1. Langkah pemetaan kolom: tanggal, deskripsi, debit, kredit, atau satu kolom nominal bertanda.
- AC2. Pemetaan tersimpan sebagai templat per institusi dan dipakai otomatis di impor berikutnya.
- AC3. Deteksi format tanggal (DD/MM/YYYY, YYYY-MM-DD, DD MMM YYYY) dan pemisah desimal Indonesia.
- AC4. Setelah parsing, alur deduplikasi F-IN-6 wajib berjalan.

**F-IN-5 Impor PDF.** Unggah PDF e-statement.
- AC1. Parser PDF berbentuk modul per institusi (`ARCHITECTURE.md` bagian 6). Daftar institusi v1 menunggu O-1.
- AC2. PDF berpassword: app meminta password, memakainya di memori, dan tidak pernah menyimpannya.
- AC3. Kalau parser khusus tidak ada atau gagal, app menawarkan ekstraksi lewat model AI dengan peringatan bahwa hasil wajib dicek baris per baris.
- AC4. Kegagalan parser satu institusi tidak memengaruhi impor lain.

**F-IN-6 Deduplikasi.** Berlaku untuk impor CSV, PDF, dan struk.
- AC1. Kandidat duplikat: akun sama, nominal sama, tanggal selisih maksimal 2 hari.
- AC2. Layar tinjau impor mengelompokkan baris: Baru, Kemungkinan duplikat (dengan transaksi pembanding), Duplikat pasti (hash baris impor sudah pernah masuk).
- AC3. Default: Baru dicentang, Kemungkinan duplikat tidak dicentang, Duplikat pasti disembunyikan.
- AC4. Mengonfirmasi kemungkinan duplikat sebagai sama akan menautkan baris impor ke transaksi manual, bukan membuat transaksi baru.

**F-IN-7 Transaksi berulang.** Jadwal harian, mingguan, bulanan, tahunan.
- AC1. Transaksi berulang dibuat sebagai draf pada tanggalnya dan muncul di kotak "Perlu dikonfirmasi". Pengguna bisa menyetel auto-konfirmasi per jadwal.

### 7.5 Riwayat dan audit

**F-HIST-1 Daftar transaksi.** Filter: cakupan, akun, kategori, jenis, rentang tanggal, pencatat, tag, teks.
- AC1. Virtualisasi daftar, tetap mulus di 20.000 baris.
- AC2. Setiap baris menampilkan titik warna pemilik dan, kalau berbeda dari pemilik, "diisi oleh [nama]".

**F-HIST-2 Riwayat edit.** Panel riwayat di detail transaksi.
- AC1. Menampilkan setiap perubahan: siapa, kapan, field, nilai lama, nilai baru.
- AC2. Transaksi yang dihapus masuk "Baru dihapus" selama 30 hari dan bisa dipulihkan.

**F-HIST-3 Konflik edit.** Setiap baris punya nomor versi.
- AC1. Menyimpan dengan versi lama ditolak. UI menampilkan kedua versi dan tombol "Pakai versi saya" atau "Pakai versi terbaru".

### 7.6 Anggaran

**F-BUD-1 Anggaran bulanan per kategori**, per cakupan (Saya, Partner, Bersama).
- AC1. Tiap anggaran ditandai wajib atau fleksibel. Hanya sisa anggaran wajib yang mengurangi "Aman dibelanjakan".
- AC2. Status: sesuai, mendekati (80%), lewat. Warna perhatian hanya dipakai untuk "lewat".
- AC3. Laju pengeluaran: app membandingkan persentase anggaran terpakai dengan persentase hari yang sudah lewat dan memberi label "lebih cepat dari biasa" bila selisih di atas 15 poin.

**F-BUD-2 Prediksi akhir bulan.** Proyeksi pengeluaran akhir periode dari rata-rata harian pengeluaran fleksibel 90 hari terakhir ditambah tagihan terjadwal.
- AC1. Tampil sebagai rentang (rendah-tinggi), bukan satu angka.
- AC2. Butuh minimal 30 hari data. Sebelum itu tampil penjelasan kapan prediksi tersedia.

### 7.7 Tagihan

**F-BILL-1 Tagihan terjadwal.** Nama, nominal (tetap atau perkiraan), akun pembayar, jatuh tempo, pengulangan, pemilik.
- AC1. "Bayar" membuat transaksi pengeluaran (atau transfer untuk kartu kredit) dan menandai tagihan periode itu lunas.
- AC2. Hitung mundur tampil dalam hari. Warna perhatian hanya untuk tagihan lewat jatuh tempo.
- AC3. Tagihan kartu kredit otomatis dihitung dari transaksi di siklus cetak tagihan.

### 7.8 Target tabungan

**F-GOAL-1 Target.** Nama, nominal target, tenggat opsional, akun penampung opsional, pemilik.
- AC1. Progres dari saldo akun penampung, atau dari setoran manual kalau tidak ada akun.
- AC2. Kalau ada tenggat, app menampilkan setoran bulanan yang dibutuhkan.
- AC3. Target yang tercapai pindah ke bagian "Tercapai" dan tidak lagi makan tempat di dashboard.

### 7.9 Investasi

**F-INV-1 Akun investasi manual.** Nilai pasar diperbarui manual dengan tanggal.
- AC1. Grafik nilai dari riwayat pembaruan. Modal disetor dihitung dari transfer masuk dan keluar.
- AC2. Imbal hasil tampil sebagai nilai dan persen terhadap modal disetor.

### 7.10 Dashboard

**F-DASH-1 Ringkasan.** Isi dan urutan dijelaskan di `UX-FLOWS.md` bagian 3.
- AC1. Angka hero: Aman dibelanjakan sampai gajian, dengan panel "Cara menghitung".
- AC2. Grafik arus kas memakai saldo kumulatif harian, bukan batang harian. Lonjakan gaji tidak membuat hari lain tidak terbaca.
- AC3. Semua label sumbu memakai format ringkas yang sama (`COPY.md` bagian 3).
- AC4. Tidak ada skor kesehatan tunggal. Bagian "Cek kesehatan" menampilkan empat pemeriksaan yang masing-masing punya rumus: dana darurat (bulan pengeluaran tertutup), rasio tabungan, rasio cicilan terhadap pemasukan, jumlah tagihan lewat jatuh tempo.

### 7.11 Laporan

**F-REP-1 Laporan periode.** Pemasukan, pengeluaran per kategori, perbandingan periode, tren 12 bulan.
- AC1. Klik kategori membuka daftar transaksi dengan filter terpasang.
- AC2. Ekspor CSV transaksi dengan filter aktif.
- AC3. Ekspor PDF ringkasan bulanan.

### 7.12 Wawasan AI

**F-AI-1 Pengaturan model.** Base URL, API key, tombol "Ambil daftar model", pilihan model teks dan model vision, tombol "Tes koneksi".
- AC1. Daftar model diambil dari `GET {base_url}/models`. Ada kolom cari dan opsi ketik ID model manual.
- AC2. Tes koneksi mengirim satu prompt teks ke model teks dan satu gambar contoh ke model vision. Hasil per model: berhasil, gagal dengan pesan dari server, atau model tidak mendukung gambar.
- AC3. API key hanya tampil 4 karakter terakhir setelah disimpan.
- AC4. Konfigurasi berlaku untuk rumah tangga. Perubahan tercatat di riwayat.
- AC5. Halaman menampilkan kalimat bahwa foto struk dan teks transaksi dikirim ke penyedia yang dipasang.

**F-AI-2 Wawasan mingguan.** Maksimal tiga wawasan per minggu per cakupan.
- AC1. Kode menghitung fakta (kategori naik paling tinggi, tagihan baru, laju anggaran). AI hanya mengubah fakta menjadi kalimat.
- AC2. Setiap angka dalam kalimat disisipkan oleh kode dari fakta, bukan ditulis AI. Kalimat dengan angka yang tidak berasal dari fakta ditolak.
- AC3. Setiap wawasan punya tautan ke transaksi penyusunnya.
- AC4. Tanpa AI, wawasan tampil dari templat kalimat tetap.

### 7.13 Notifikasi

**F-NOT-1 Notifikasi dalam app.** Pemicu: data milikmu diubah partner, tagihan jatuh tempo 3 hari lagi, anggaran wajib lewat, transaksi berulang menunggu konfirmasi.
- AC1. Web push opsional untuk PWA terpasang (iOS 16.4+ perlu dipasang ke layar utama).

### 7.14 Pengaturan

**F-SET-1** Nama tampilan, warna identitas (dari 6 pilihan di `DESIGN.md`), tanggal gajian, awal periode, kategori, templat impor, AI, sesi, ekspor semua data (JSON + lampiran dalam zip).

## 8. Kebutuhan non-fungsional

| Area | Target |
|---|---|
| Performa | LCP di bawah 2 detik di 4G untuk dashboard. Interaksi toggle di bawah 300 ms. |
| Data | 20.000 transaksi dan 2.000 lampiran tanpa degradasi |
| Ketersediaan | Satu VPS. Pemulihan dari backup di bawah 1 jam, diuji tiap bulan. |
| Aksesibilitas | WCAG 2.2 AA. Semua fitur bisa dipakai dengan keyboard dan screen reader. |
| Zona waktu | Asia/Jakarta untuk semua perhitungan tanggal |
| Bahasa | Bahasa Indonesia |
| Offline | PWA menampilkan data terakhir dan menyimpan quick-add ke antrean saat offline |

## 9. Metrik keberhasilan (dipantau sendiri)

- Kalian berdua mencatat transaksi di minimal 20 dari 30 hari pertama.
- Selisih rekonsiliasi rata-rata di bawah 1% saldo akun setelah bulan kedua.
- Nol kejadian angka dashboard yang tidak bisa dijelaskan oleh panel "Cara menghitung".
