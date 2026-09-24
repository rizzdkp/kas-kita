# Copy dan format

## 1. Suara

Bahasa Indonesia sehari-hari yang rapi. Menyapa dengan "kamu", menyebut pasangan dengan nama tampilannya, menyebut berdua dengan "kalian".

Tidak ada sapaan "Boss", tidak ada emoji, tidak ada tanda seru di pesan sistem, tidak ada kalimat penyemangat kosong ("You can do it!"). Satu bahasa: tidak mencampur "vs last month".

Error menjelaskan apa yang terjadi lalu apa yang bisa dilakukan. Konfirmasi memakai kata kerja lampau yang sama dengan tombolnya: tombol "Simpan", toast "Tersimpan".

## 2. Glosarium

Satu istilah untuk satu hal. Agen tidak boleh memakai sinonim.

| Istilah | Arti | Jangan pakai |
|---|---|---|
| Akun | Rekening, e-wallet, kartu, tunai, investasi | Dompet, rekening (untuk semua jenis) |
| Transaksi | Pemasukan, pengeluaran, atau transfer | Catatan, mutasi (kecuali untuk file bank) |
| Mutasi | File dari bank yang diimpor | |
| Cakupan | Saya, Partner, Gabungan | Mode, view |
| Bersama | Pemilik akun milik berdua | Joint, shared |
| Aman dibelanjakan | Metrik hero | Sisa uang, free cash |
| Tagihan | Kewajiban terjadwal | Bill |
| Target | Tujuan tabungan | Goal |
| Diisi oleh | Pencatat transaksi | Dibuat oleh, author |
| Periode | Rentang laporan | |

## 3. Format angka dan tanggal

| Konteks | Format | Contoh |
|---|---|---|
| Nominal lengkap | `Rp` + spasi + titik ribuan | Rp 1.250.000 |
| Nominal di daftar | Tanda + nominal | −Rp 25.000, +Rp 8.500.000 |
| Ringkas (sumbu, ruang sempit) | rb / jt / M, koma desimal, maksimal 2 desimal | 850 rb, 1,25 jt, 2,1 M |
| Sumbu nol dan negatif | Sama dengan ringkas | 0, −5 jt (tidak pernah "-5000000") |
| Persen | Koma desimal, maksimal 1 desimal | 30,8% |
| Tanggal pendek | D MMM | 12 Sep |
| Tanggal dengan tahun | D MMM YYYY | 12 Sep 2026 |
| Waktu | HH.mm | 09.12 |
| Relatif | Hari ini, Kemarin, lalu tanggal | |
| Hitung mundur | "3 hari lagi", "besok", "hari ini", "telat 2 hari" | |

Semua format lewat `src/lib/money.ts` dan `src/lib/dates.ts` memakai `Intl` dengan locale `id-ID`.

## 4. Microcopy

### Umum

| Elemen | Copy |
|---|---|
| Placeholder quick-add | kopi 25rb gopay |
| Placeholder quick-add (cakupan Partner) | Catat untuk [nama], misalnya makan 40rb |
| Toast simpan | Tersimpan |
| Toast simpan data partner | Tersimpan. [Nama] akan melihat perubahan ini di riwayat. |
| Tombol urungkan | Urungkan |
| Hapus transaksi, dialog | Hapus transaksi ini? Transaksi masuk ke Baru dihapus dan bisa dipulihkan selama 30 hari. |
| Tombol dialog hapus | Hapus transaksi / Batal |

### Hero dan metrik

| Elemen | Copy |
|---|---|
| Label hero (Saya) | Aman dibelanjakan sampai gajian, [n] hari lagi |
| Label hero (Partner) | [Nama]: aman dibelanjakan sampai gajian, [n] hari lagi |
| Label hero (Gabungan) | Kalian berdua: aman dibelanjakan sampai gajian terdekat, [n] hari lagi |
| Hero negatif | Kurang Rp [x] sampai gajian |
| Tombol rumus | Cara menghitung |
| Delta | ↑ 12% dari 1-10 Agu |
| Rasio tabungan tanpa pemasukan | Belum ada pemasukan periode ini |

### Error

| Situasi | Copy |
|---|---|
| Nominal kosong | Isi nominal, misalnya 25rb |
| Saldo tunai jadi negatif | Saldo Tunai tinggal Rp 40.000. Kurangi nominal atau catat dari akun lain. |
| Konflik edit | Transaksi ini baru diubah [nama] pukul [waktu]. Pilih versi yang dipakai. |
| AI tidak bisa dihubungi | Model AI tidak merespons. Cek pengaturan AI atau isi field yang kosong sendiri. |
| Model tidak mendukung gambar | Model [id] tidak bisa membaca gambar. Pilih model vision lain di pengaturan AI. |
| PDF tidak dikenali | Format mutasi ini belum dikenali. Coba impor CSV, atau baca dengan AI dan cek hasilnya baris per baris. |
| Password PDF salah | Password tidak cocok. Password e-statement biasanya dikirim bank lewat email atau SMS. |
| File sudah pernah diimpor | File ini sudah diimpor pada [tanggal]. Lihat hasil impornya. |
| Sesi habis | Sesimu berakhir. Masuk lagi untuk melanjutkan. |

### Pengaturan AI

| Elemen | Copy |
|---|---|
| Keterangan halaman | Foto struk dan teks transaksi dikirim ke penyedia yang kamu pasang di sini. Angka di dashboard selalu dihitung app, bukan AI. |
| Tombol | Ambil daftar model |
| Tombol | Tes koneksi |
| Hasil tes berhasil | Model teks dan model vision merespons |
| Key tersimpan | Tersimpan, berakhiran ••••[last4] |

### Cara membaca tabel per area

Tabel di bawah mencatat teks yang sudah dipakai di kode. Bagian dinamis ditulis sebagai placeholder: [nama] untuk nama orang, akun, tagihan, target, atau kategori; [n] untuk angka biasa; [Rp] untuk nominal yang lewat `formatRupiah`; [tanggal] untuk tanggal atau label rentang; [periode] untuk label periode seperti "1-30 Sep"; [persen] untuk persen yang lewat `formatPercent`; [waktu] untuk jam. Teks yang ditandai (aria) hanya dibaca screen reader. Kalau teks di kode berbeda dengan tabel ini, ikuti tabel dan catat perbedaannya di bagian 5.

### Login dan perangkat

| Elemen | Copy |
|---|---|
| Judul halaman masuk | Masuk ke Kas Kita |
| Tombol passkey | Masuk dengan passkey |
| Tombol passkey, menunggu | Menunggu passkey |
| Tautan ke password | Pakai password |
| Label | Email / Password |
| Tombol lanjut | Lanjut / Memeriksa |
| Pilihan ingat perangkat | Ingat perangkat ini (30 hari) |
| Langkah kode, judul | Masukkan kode |
| Langkah kode, keterangan | Buka aplikasi autentikator lalu masukkan 6 angka untuk Kas Kita. |
| Label kode | Kode autentikator |
| Tombol kode | Masuk / Memeriksa |
| Tombol kembali | Kembali |
| Daftar perangkat, judul halaman | Daftarkan perangkat |
| Daftar perangkat, sapaan | Hai, [nama] |
| Daftar perangkat, keterangan | Daftarkan passkey di perangkat ini untuk [email]. Setelah itu kamu masuk dengan Face ID, sidik jari, atau PIN perangkat, tanpa password. |
| Tombol daftar | Daftarkan passkey / Menunggu passkey |
| Nama perangkat | iPhone / iPad / Android / Mac / Windows / Perangkat |
| Berhasil, judul | Perangkat terdaftar |
| Berhasil, keterangan | Mulai sekarang kamu bisa masuk dengan passkey di perangkat ini. |
| Sudah aktif, keterangan | Passkey dan password cadangan sudah aktif untuk akunmu. |
| Tombol setelah berhasil | Buka Kas Kita |
| Tautan kedaluwarsa, judul | Tautan tidak berlaku |
| Tautan kedaluwarsa, keterangan | Tautan pendaftaran sudah dipakai atau kedaluwarsa. Tautan berlaku 30 menit dan hanya sekali pakai. Minta tautan baru lewat perintah user:create --link di server. |
| Tombol tautan kedaluwarsa | Ke halaman masuk |
| Password cadangan, judul | Password cadangan |
| Password cadangan, keterangan | Opsional. Password dan kode TOTP dipakai kalau passkey tidak tersedia, misalnya di perangkat baru. |
| Label | Password / Ulangi password |
| Petunjuk password | Minimal [n] karakter. |
| Tombol | Lanjut / Menyimpan / Lewati |
| TOTP, judul | Pasang TOTP |
| TOTP, keterangan | Tambahkan Kas Kita ke aplikasi autentikator (misalnya Google Authenticator, 1Password, atau Aegis), lalu masukkan kode 6 angka yang muncul. |
| TOTP, tautan | Buka di aplikasi autentikator |
| TOTP, kunci manual | Atau ketik kunci ini secara manual: |
| TOTP, tombol | Aktifkan / Memeriksa |
| Error password pendek | Password minimal [n] karakter. |
| Error password beda | Kedua password belum sama. |
| Error password panjang | Password maksimal 128 karakter. |
| Error kode bukan 6 angka | Kode terdiri dari 6 angka. |
| Error kode salah saat pasang | Kode tidak cocok. Pastikan jam ponselmu tepat lalu masukkan kode terbaru. |
| Error kode salah saat masuk | Kode dari aplikasi autentikator salah. Cek jam di ponselmu lalu coba lagi. |
| Error email atau password | Email atau password salah. |
| Error passkey dibatalkan (masuk) | Masuk dengan passkey dibatalkan. Coba lagi atau pakai password. |
| Error passkey dibatalkan (daftar) | Pendaftaran passkey dibatalkan. Coba lagi. |
| Error passkey sudah ada | Passkey ini sudah terdaftar di akunmu. |
| Error passkey belum ada | Passkey ini belum terdaftar. Pakai password, atau minta tautan pendaftaran baru. |
| Error verifikasi passkey | Passkey tidak bisa diverifikasi. Coba lagi. |
| Error waktu habis | Waktu verifikasi habis. Coba lagi. |
| Error langkah kedaluwarsa | Langkah verifikasi sudah kedaluwarsa. Masukkan email dan password lagi. |
| Error kode salah berulang | Terlalu banyak kode salah. Masukkan email dan password lagi. |
| Error kode dikunci | Terlalu banyak kode salah. Coba lagi dalam 15 menit. |
| Error terlalu banyak percobaan | Terlalu banyak percobaan. Tunggu sebentar lalu coba lagi. |
| Error kunci login | Terlalu banyak percobaan masuk yang gagal. Coba lagi dalam [n] menit. |
| Error koneksi saat masuk | Tidak bisa masuk sekarang. Periksa koneksi lalu coba lagi. |
| Error passkey belum didaftarkan | Daftarkan passkey dulu. Password dan TOTP cadangan disetel setelah passkey aktif. |
| Error cadangan sudah aktif | Password dan TOTP cadangan sudah aktif untuk akun ini. |
| Error TOTP gagal disiapkan | TOTP gagal disiapkan. Coba lagi. |
| Error cadangan gagal disetel | Password atau TOTP gagal disetel. Muat ulang halaman lalu coba lagi. |
| Error tautan pendaftaran | Tautan pendaftaran sudah dipakai atau kedaluwarsa. Minta tautan baru lewat perintah user:create --link. |

### Shell dan navigasi

| Elemen | Copy |
|---|---|
| Nama app dan judul tab | Kas Kita / [halaman] · Kas Kita |
| Menu utama | Ringkasan, Transaksi, Akun, Anggaran, Tagihan, Target, Investasi, Laporan, Pengaturan |
| Halaman di luar menu | Pengenalan, Notifikasi |
| Tautan lewati | Lewati ke konten |
| Navigasi (aria) | Navigasi utama |
| Tombol lipat navigasi | Lipat sidebar / Buka sidebar |
| Tombol tengah tab bar | Catat transaksi |
| Tab lainnya | Lainnya |
| Toggle cakupan (aria) | Cakupan |
| Pilihan cakupan | Saya / [nama] / Gabungan |
| Menu akun (aria) | Menu akun [nama] / Menu akun [nama], [n] notifikasi belum dibaca |
| Isi menu akun | Notifikasi / Notifikasi ([n] belum dibaca) / Pengaturan / Keluar |
| Tombol notifikasi (aria) | Notifikasi / Notifikasi, [n] belum dibaca |
| Tombol tutup | Tutup |
| Data tabel grafik | Tampilkan tabel data / Sembunyikan tabel data |

### Quick-add

| Elemen | Copy |
|---|---|
| Label bar (aria) | Catat transaksi |
| Keterangan atas nama partner | Dicatat atas nama [nama] |
| Petunjuk keyboard | Enter untuk pratinjau. Shift+Enter untuk baris baru, satu transaksi per baris. |
| Status proses | Memproses |
| Tombol kamera | Foto struk |
| Pratinjau, judul | Pratinjau transaksi / Pratinjau [n] transaksi |
| Pratinjau per kartu (aria) | Pratinjau transaksi [n] dari [n] |
| Chip | Jenis, Akun, Dari akun, Ke akun, Kategori, Untuk, Nominal, Tanggal, Jam, Catatan |
| Chip kosong | Isi [field] |
| Pilihan kosong | Pilih jenis / Pilih akun / Pilih akun tujuan / Pilih kategori |
| Label pemilik akun di chip | Bersama / milik [nama] |
| Tambah catatan | Tambah catatan |
| Keterangan pencatat | Dicatat atas nama [nama], diisi oleh kamu |
| Buang baris (aria) | Buang baris [n] |
| Field belum lengkap | Lengkapi [field] dan [field] untuk menyimpan. |
| Field belum lengkap, banyak baris | Baris [n]: Lengkapi [field] untuk menyimpan. |
| Tombol | Simpan / Simpan semua / Batal / Selesai |
| Toast tersimpan offline | Tersimpan di perangkat. Dikirim otomatis saat koneksi kembali. |
| Toast antrean terkirim | Transaksi dari antrean tersimpan / [n] transaksi dari antrean tersimpan |
| Toast antrean gagal | Antrean belum terkirim. [pesan error] |
| Toast urungkan | Diurungkan |
| Toast urungkan gagal | Belum bisa diurungkan. [pesan error] |
| Error jaringan | Tidak bisa terhubung ke server. Periksa koneksi lalu coba lagi. |
| Dialog foto struk, judul | Foto struk butuh model vision |
| Dialog foto struk, isi | Struk dibaca oleh model AI yang bisa membaca gambar. Pasang model vision di pengaturan AI, lalu tombol ini langsung membuka kamera. Sementara itu, ketik transaksinya di bar, misalnya kopi 25rb gopay. |
| Dialog foto struk, tombol | Buka pengaturan AI / Batal |

### Transaksi

| Elemen | Copy |
|---|---|
| Tab | Semua / Perlu dikonfirmasi ([n]) / Baru dihapus |
| Tombol tambah | Tambah transaksi |
| Daftar (aria) | Daftar transaksi |
| Grup tanggal | Hari ini / Kemarin / [tanggal] |
| Baris transfer | [akun] ke [akun] / Transfer ke [nama] / Transfer dari [nama] |
| Baris, pencatat | · diisi oleh [nama] |
| Baris, total grup | Total |
| Tombol konfirmasi | Konfirmasi |
| Toast konfirmasi | Dikonfirmasi |
| Memuat | Memuat transaksi berikutnya / Memuat transaksi / Memuat form |
| Tombol ulang | Coba lagi |
| Pencarian | Cari transaksi |
| Filter | Filter / Filter ([n]) / Filter transaksi / Filter aktif / Tampilkan hasil / Lainnya ([n]) |
| Filter, label | Jenis, Akun, Kategori, Diisi oleh, Tag, Dari tanggal, Sampai tanggal |
| Filter, pilihan semua | Semua jenis / Semua akun / Semua kategori / Siapa saja / Semua tag / Belum ada tag |
| Chip filter | Dari [tanggal] / Sampai [tanggal] / Diisi oleh [nama] / Tag [nama] |
| Hapus filter | Hapus filter [nama] / Hapus semua filter |
| Kosong, filter | Tidak ada transaksi yang cocok. Coba longgarkan filter, misalnya perlebar rentang tanggal atau hapus kata pencarian. |
| Kosong, Baru dihapus | Baru dihapus masih kosong. Transaksi yang dihapus tersimpan di sini selama 30 hari dan bisa dipulihkan. |
| Kosong, Perlu dikonfirmasi | Tidak ada yang perlu dikonfirmasi. Transaksi berulang yang menunggu konfirmasi akan muncul di sini pada tanggalnya. |
| Kosong, partner | [nama] belum mencatat transaksi. Kamu bisa mencatat atas namanya dari sini. / Catat untuk [nama] |
| Kosong, pertama | Catat transaksi pertama. Ketik di bar bawah, misalnya "makan siang 35rb bca". / Mulai mengetik |
| Form, judul | Tambah transaksi / Ubah transaksi |
| Form, label | Jenis transaksi, Nominal, Akun, Dari akun, Ke akun, Kategori, Tanggal dan waktu, Untuk siapa, Catatan, Tag |
| Form, placeholder | Misalnya 25rb / Misalnya belanja mingguan / Pilih akun / Pilih akun tujuan / Pilih kategori |
| Form, petunjuk tag | Pisahkan dengan koma, misalnya kantor, liburan |
| Form, pilihan untuk | Saya / [nama] / Bersama |
| Form, error | Isi nominal, misalnya 25rb / Isi tanggal dan waktu / Pilih akun / Pilih akun tujuan transfer / Akun tujuan harus berbeda dari akun asal / Pilih kategori |
| Jenis | Pengeluaran / Pemasukan / Transfer |
| Pemilik | Milik kamu / Milik [nama] / Milik Bersama |
| Opsi akun diarsipkan | [nama] (diarsipkan) |
| Status | Terkonfirmasi / Perlu dikonfirmasi / Dihapus |
| Sumber | Form / Quick-add / Foto struk / Impor CSV / Impor PDF / Transaksi berulang / Penyesuaian saldo |
| Detail, judul | Detail transaksi |
| Detail, label | Jenis, Tanggal, Akun, Dari akun, Ke akun, Kategori, Untuk, Catatan, Tag, Sumber, Diisi oleh, Terakhir diubah |
| Detail, nilai pencatat | [nama], [tanggal], [waktu] |
| Detail, tombol | Ubah / Hapus / Konfirmasi / Pulihkan |
| Toast hapus dan pulihkan | Transaksi dihapus / Transaksi dipulihkan |
| Riwayat, judul | Riwayat |
| Riwayat, kosong | Belum ada perubahan tercatat. |
| Riwayat, aksi | [nama] mencatat transaksi ini / menghapus transaksi ini / memulihkan transaksi ini |
| Riwayat, tag kosong | tanpa tag |
| Konflik, pesan | Transaksi ini baru diubah [nama] pukul [waktu]. Pilih versi yang dipakai. |
| Konflik, tombol | Pakai versi terbaru / Pakai versi saya |
| Konflik, kolom | Field / Versi terbaru / Versi kamu |
| Konflik, penanda | Berbeda |
| Konflik, nilai tak dikenal | Akun lain / Kategori lain / orang lain |
| Kolom CSV | Tanggal, Waktu, Jenis, Nominal, Akun, Akun tujuan, Kategori, Catatan, Diisi oleh, Tag, Status |
| Status di CSV | Terkonfirmasi / Draf |
| Nama file CSV | kas-kita-transaksi-[tanggal]-sampai-[tanggal].csv / kas-kita-transaksi-sejak-[tanggal].csv |

### Akun

| Elemen | Copy |
|---|---|
| Keterangan halaman | Akun Bersama selalu tampil di halaman ini, apa pun cakupannya. |
| Tombol tambah | Tambah akun |
| Kosong | Tambahkan akun pertama. Mulai dari rekening yang paling sering kamu pakai. Saldonya bisa dicocokkan nanti. |
| Grup | Likuid / Kewajiban / Aset tidak likuid / Subtotal / Diarsipkan ([n]) |
| Jenis akun | Bank, E-wallet, Tunai, Kartu kredit, PayLater, Pinjaman, Investasi, Aset lain |
| Baris, kartu kredit | Terpakai [persen] dari limit [Rp] / Lebih bayar [Rp] / Sisa utang |
| Baris, investasi | Nilai pasar / Belum ada nilai pasar |
| Baris, pencocokan | Dicocokkan [tanggal] / Belum pernah dicocokkan |
| Menu aksi (aria) | Aksi untuk [nama] |
| Menu aksi | Cocokkan saldo / Perbarui nilai / Ubah akun / Arsipkan / Pulihkan / Hapus akun |
| Toast arsip | Diarsipkan / Dipulihkan |
| Form, judul | Tambah akun / Ubah akun |
| Form, label | Nama akun, Jenis, Pemilik, Institusi, Tanggal saldo awal, Limit, Tanggal cetak tagihan, Tanggal jatuh tempo |
| Form, placeholder | BCA harian / misalnya 10jt / 1 sampai 31 / Tanpa institusi |
| Form, pemilik | Saya / [nama] / Bersama |
| Form, saldo awal | Saldo awal: Saldo di aplikasi bank pada tanggal saldo awal. |
| Form, modal awal | Modal awal: Uang yang sudah ditanam sebelum dicatat di sini. |
| Form, utang awal | Utang awal: Isi sisa utang sebagai angka positif, misalnya 2,5jt. Kas Kita menyimpannya sebagai saldo negatif. |
| Form, saldo negatif | Izinkan saldo negatif. Untuk rekening dengan fasilitas cerukan. Tanpa ini, transaksi yang membuat saldo minus ditolak. |
| Form, tunai | Saldo Tunai tidak pernah boleh negatif. |
| Form, error | Isi nama akun / Nominal belum terbaca, misalnya 2,5jt / Saldo Tunai tidak boleh negatif / Saldo awal negatif hanya untuk akun yang mengizinkan saldo negatif / Pilih tanggal saldo awal / Isi limit, misalnya 10jt / Tanggal 1 sampai 31 |
| Form, tombol | Simpan / Tambah akun / Batal |
| Konflik, tombol | Pakai versi saya / Pakai versi terbaru |
| Pindah pemilik, judul | Pindahkan [nama] ke [nama]? |
| Pindah pemilik, isi | Semua transaksi di akun ini ikut pindah pemilik ke [nama]. Perubahan tercatat di riwayat akun. |
| Pindah pemilik, tombol | Pindahkan / Batal |
| Hapus, judul | Hapus [nama]? / [nama] tidak bisa dihapus |
| Hapus, isi | Akun tanpa transaksi dihapus permanen dari daftar. Akun yang sudah punya transaksi hanya bisa diarsipkan. |
| Hapus, tombol | Hapus akun / Arsipkan / Batal |
| Hapus, toast | Akun dihapus / Diarsipkan |
| Cocokkan, judul | Cocokkan saldo [nama] |
| Cocokkan, keterangan | Terakhir dicocokkan [tanggal]. / Belum pernah dicocokkan. |
| Cocokkan, label | Saldo di aplikasi bank / Sisa tagihan di aplikasi bank |
| Cocokkan, petunjuk | Isi sebagai angka positif. |
| Cocokkan, ringkasan | Tercatat di Kas Kita / Sebenarnya / Selisih / belum diisi |
| Cocokkan, selisih besar | Selisihnya lebih dari 1% saldo. Cek dulu transaksi yang mungkin belum dicatat sebelum membuat penyesuaian. |
| Cocokkan, saldo sama | Saldo sudah sama. Menyimpan hanya mencatat tanggal pencocokan. |
| Cocokkan, penjelasan | Penyesuaian dicatat dengan kategori Penyesuaian saldo dan tidak masuk pemasukan, pengeluaran, atau rasio tabungan. |
| Cocokkan, tombol | Tandai sudah cocok / Buat penyesuaian / Batal |
| Cocokkan, toast | Saldo sudah cocok / Penyesuaian dibuat |
| Cocokkan, error | Isi saldo sebenarnya, misalnya 2,5jt |

### Investasi

| Elemen | Copy |
|---|---|
| Ringkasan | Total nilai pasar / Total imbal hasil |
| Kosong, judul | Belum ada akun Investasi / [nama] belum punya akun Investasi |
| Kosong, isi | Buat akun jenis Investasi untuk reksa dana, saham, atau emas. Nilai pasarnya kamu perbarui sendiri di sini, lalu imbal hasil dihitung dari modal yang disetor. |
| Kosong, tombol | Tambah akun Investasi |
| Kartu, label | Nilai pasar / Modal disetor / Imbal hasil |
| Kartu, nilai pasar | per [tanggal] / Belum pernah diperbarui |
| Kartu, modal | Saldo awal + transfer masuk − transfer keluar |
| Kartu, imbal hasil | [persen] dari modal / Muncul setelah nilai pasar diisi |
| Grafik belum ada | Grafik nilai muncul setelah dua kali pembaruan nilai. |
| Grafik (aria) | Nilai pasar [nama] dari [tanggal] sampai [tanggal]. Rincian ada di riwayat nilai. |
| Riwayat | Riwayat nilai ([n]) / Riwayat nilai pasar, terbaru di atas |
| Riwayat, kolom | Tanggal / Nilai pasar / Catatan / Aksi |
| Riwayat, aksi (aria) | Ubah nilai [tanggal] / Hapus nilai [tanggal] |
| Tombol | Perbarui nilai |
| Sheet, judul | Perbarui nilai / Ubah nilai pasar |
| Sheet, keterangan | [nama]. Isi nilai pasar dari aplikasi investasimu pada tanggal itu. |
| Sheet, label | Tanggal / Nilai pasar / Catatan |
| Sheet, petunjuk catatan | Opsional, misalnya sumber angkanya. |
| Sheet, error | Isi nilai pasar, misalnya 14,5jt / Pilih tanggal / Tanggal nilai tidak boleh setelah hari ini |
| Sheet, tombol | Simpan / Batal / Pakai versi saya / Pakai versi terbaru |
| Hapus, judul | Hapus nilai [tanggal]? |
| Hapus, isi | Titik ini hilang dari grafik [nama]. Kalau ini nilai terbaru, imbal hasil dihitung dari nilai sebelumnya. |
| Hapus, tombol | Hapus nilai / Batal |
| Hapus, toast | Nilai dihapus |

### Anggaran

| Elemen | Copy |
|---|---|
| Navigasi bulan | Pilih bulan / Bulan sebelumnya / Bulan berikutnya / Bulan ini |
| Ringkasan | Total anggaran / Terpakai dari total anggaran / Sisa / Lewat / Hari ke-[n] |
| Tombol | Tambah anggaran / Salin anggaran / Buat anggaran |
| Toast salin | [n] anggaran disalin / Tidak ada anggaran yang perlu disalin |
| Kosong, judul | Belum ada anggaran di bulan ini / Atur anggaran bulan ini |
| Kosong, isi | Mulai dari dua atau tiga kategori terbesar. Anggaran bulan depan menyalin bulan ini. / Salin anggaran bulan sebelumnya, atau mulai dari dua atau tiga kategori terbesar. |
| Grup | Anggaran / Anggaran [nama] |
| Baris | Sisa [Rp] / Lewat [Rp] · [persen] terpakai |
| Jenis | Wajib / Fleksibel |
| Status | Sesuai / Mendekati / Lewat / Lebih cepat dari biasa |
| Pemilik | Milik [nama] / Milik Bersama / Pemilik lain |
| Sheet, judul | Tambah anggaran / Ubah anggaran [nama] |
| Sheet, label | Pemilik anggaran / Kategori pengeluaran / Nominal per bulan / Jenis anggaran |
| Sheet, penjelasan jenis | Sisa anggaran wajib mengurangi Aman dibelanjakan. Anggaran fleksibel tidak. |
| Sheet, error | Pilih kategori pengeluaran / Isi nominal, misalnya 25rb |
| Sheet, tombol | Simpan / Hapus anggaran |
| Hapus, judul | Hapus anggaran [nama]? |
| Hapus, isi | Transaksinya tidak ikut terhapus. Kamu bisa membuat anggaran ini lagi kapan saja. |
| Hapus, tombol | Hapus anggaran / Batal |
| Hapus, toast | Terhapus |
| Prediksi, belum ada | Prediksi muncul setelah [n] hari data. Saat ini ada data [n] hari. |
| Prediksi, judul | Prediksi pengeluaran sampai [tanggal] |
| Prediksi, rentang | [Rp] sampai [Rp] |
| Prediksi, rincian | Sudah terpakai [Rp], ditambah tagihan [Rp] yang belum dibayar dan [n] hari pengeluaran fleksibel. |
| Tombol rumus | Cara menghitung |

### Tagihan

| Elemen | Copy |
|---|---|
| Kosong, judul | Catat tagihan rutin |
| Kosong, isi | Listrik, internet, sewa, atau kartu kredit. Kas Kita menghitung mundur jatuh temponya dan memasukkannya ke Aman dibelanjakan. |
| Ringkasan | Jatuh tempo sampai akhir periode ([periode]) / [n] tagihan belum dibayar · [n] telat |
| Ringkasan kosong | Tidak ada tagihan yang belum dibayar di periode ini |
| Bagian | Berikutnya / Lunas periode ini |
| Lunas kosong | Belum ada tagihan yang dibayar di periode ini. |
| Baris lunas | Dibayar [tanggal] dari [nama] |
| Baris | Dari [nama] |
| Pengulangan | Bulanan, tanggal [n] / Mingguan, [hari] / Tahunan, [tanggal] |
| Keterangan kartu kredit | Dihitung otomatis dari saldo kartu saat ini / Dihitung otomatis dari transaksi siklus [periode] / Dihitung otomatis dari transaksi siklus cetak tagihan |
| Tombol | Tambah tagihan / Bayar |
| Menu aksi | Aksi untuk [nama] / Ubah tagihan / Riwayat pembayaran / Hapus tagihan |
| Sheet, judul | Tambah tagihan / Ubah [nama] |
| Sheet, label | Nama tagihan / Tagihan kartu kredit / Kartu kredit / Nominal / Nominal perkiraan / Kategori / Akun pembayar / Pengulangan / Jatuh tempo berikutnya / Pemilik tagihan |
| Sheet, placeholder | Listrik / Pilih kategori / Pilih akun |
| Sheet, kartu kredit | Nominal dihitung otomatis dari transaksi di siklus cetak tagihan. |
| Sheet, nominal perkiraan | Untuk tagihan yang berubah tiap bulan, misalnya listrik. Nominalnya bisa diubah saat membayar. |
| Sheet, pengulangan | Bulanan / Mingguan / Tahunan |
| Sheet, error | Isi nama tagihan / Pilih kartu kredit / Isi nominal, misalnya 25rb / Pilih kategori tagihan / Pilih akun pembayar / Isi tanggal jatuh tempo |
| Sheet, toast | Tersimpan / Tersimpan. [nama] akan melihat perubahan ini di riwayat. |
| Bayar, judul | Bayar [nama] |
| Bayar, keterangan kartu kredit | Dicatat sebagai transfer ke [nama], bukan pengeluaran. |
| Bayar, keterangan biasa | Dicatat sebagai pengeluaran [kategori]. |
| Bayar, nominal perkiraan | Nominal ini perkiraan. Sesuaikan dengan tagihan yang datang. |
| Bayar, label | Nominal / Dibayar dari / Tanggal bayar |
| Bayar, error | Isi nominal, misalnya 25rb / Isi tanggal bayar |
| Bayar, tombol | Bayar / Batal |
| Bayar, toast | [nama] dibayar. [Rp] dari [nama]. Jatuh tempo berikutnya [tanggal]. |
| Riwayat, judul | Riwayat [nama]. Pembayaran terbaru di atas. |
| Riwayat, kosong | Belum ada pembayaran untuk tagihan ini. Tekan Bayar saat tagihan sudah dilunasi. |
| Riwayat, kolom | Dibayar / Akun / Nominal |
| Riwayat, transaksi hilang | Transaksi dihapus |
| Hapus, judul | Hapus tagihan [nama]? |
| Hapus, isi | Transaksi pembayaran sebelumnya tetap tersimpan. |
| Hapus, tombol | Hapus tagihan / Batal |
| Hapus, toast | Terhapus |

### Target

| Elemen | Copy |
|---|---|
| Kosong, judul | Buat target tabungan pertama / Semua target sudah tercapai |
| Kosong, isi | Misalnya dana darurat atau liburan. Beri tenggat supaya Kas Kita menghitung setoran bulanan yang dibutuhkan. |
| Bagian | Target aktif / Tercapai |
| Tombol | Tambah target / Tambah setoran |
| Baris | Sisa / Setoran bulanan yang dibutuhkan / Tenggat [tanggal] / Tenggat [tanggal] sudah lewat |
| Baris, sumber progres | Progres dari setoran manual / Progres dari saldo [nama] |
| Menu aksi | Aksi untuk [nama] / Ubah target / Riwayat setoran / Tandai tercapai / Tandai belum tercapai / Hapus target |
| Baris tercapai | Tercapai [tanggal] |
| Toast tercapai | Target [nama] tercapai. Target ini pindah ke bagian Tercapai. |
| Toast batal tercapai | [nama] kembali aktif |
| Sheet, judul | Tambah target / Ubah [nama] |
| Sheet, label | Nama target / Nominal target / Tenggat / Akun penampung / Pemilik target |
| Sheet, placeholder | Dana darurat / Tanpa akun, catat setoran manual |
| Sheet, petunjuk tenggat | Opsional. Dengan tenggat, Kas Kita menghitung setoran bulanan yang dibutuhkan. |
| Sheet, petunjuk akun | Kalau ada, progres diambil dari saldo akun ini. Tanpa akun, progres dari setoran yang kamu catat. |
| Sheet, error | Isi nama target / Isi nominal, misalnya 25rb / Tenggat harus setelah hari ini |
| Setor, judul | Setor ke [nama]. Sisa [Rp] lagi. |
| Setor, label | Nominal setoran / Tanggal |
| Setor, tombol | Simpan setoran / Batal |
| Setor, toast | Tersimpan. Setoran [Rp] ke [nama]. |
| Riwayat setoran | Riwayat setoran [nama]. Setoran terbaru di atas. |
| Riwayat setoran, kosong | Belum ada setoran. Tekan Tambah setoran untuk mencatat yang pertama. |
| Riwayat setoran, kolom | Tanggal / Diisi oleh / Nominal |
| Hapus, judul | Hapus target [nama]? |
| Hapus, isi | Akun penampung dan saldonya tidak ikut terhapus. Riwayat setorannya ikut tersembunyi bersama target ini. |
| Hapus, tombol | Hapus target / Batal |
| Hapus, toast | Terhapus |

### Ringkasan

| Elemen | Copy |
|---|---|
| Hero, komponen | Saldo likuid / Tagihan sebelum gajian / Setoran target / Sisa anggaran wajib |
| Hero negatif | Kurang [Rp] sampai gajian |
| Hero (aria) | Aman dibelanjakan / Hari menuju gajian: [n] hari |
| Kosong, belum ada akun | Tambahkan akun pertama. Mulai dari rekening yang paling sering kamu pakai. Saldonya bisa dicocokkan nanti. / Tambah akun |
| Kosong, partner | [nama] belum mencatat transaksi. Kamu bisa mencatat atas namanya dari sini. / Catat untuk [nama] |
| Perlu perhatian, judul | Perlu perhatian |
| Perlu perhatian, tagihan telat | [Telat n hari] · Tagihan [nama] [Rp] belum dibayar |
| Perlu perhatian, anggaran lewat | Lewat · Anggaran wajib [nama]: terpakai [Rp] dari [Rp] |
| Perlu perhatian, tagihan segera | [3 hari lagi] · Tagihan [nama] [Rp] jatuh tempo |
| Perlu perhatian, draf | Draf · [n] transaksi draf menunggu konfirmasi |
| Perlu perhatian, tombol | Lihat semua ([n]) / Tampilkan lebih sedikit |
| Arus, judul | Arus bulan ini / Arus periode ini |
| Arus, label | Pemasukan / Pengeluaran / Rasio tabungan |
| Arus, tanpa pemasukan | Belum ada pemasukan periode ini / Belum ada pemasukan |
| Arus, perubahan | ↑ [persen] dari [periode] / ↑ [n] poin dari [periode] / Tidak ada di [periode] |
| Arus, perubahan (aria) | naik / turun / tetap [persen] dari [periode] |
| Grafik saldo, judul | Saldo likuid [Rp] di akhir [periode] / Saldo likuid diperkirakan [Rp] di akhir [periode] / Belum ada saldo untuk digambar |
| Grafik saldo, keterangan | Garis putus-putus: proyeksi dari rata-rata pengeluaran harian dan tagihan terjadwal sampai [tanggal]. |
| Grafik saldo, legenda | Saldo likuid / Proyeksi saldo |
| Grafik saldo, tabel | Saldo likuid harian [periode]: Tanggal / Saldo likuid / Keterangan (Aktual, Proyeksi) |
| Kategori, judul | Pengeluaran per kategori |
| Kategori, kosong | Belum ada pengeluaran |
| Kategori, tautan | Lihat semua kategori di Laporan |
| Kategori, pemisah pemilik | Warna pemilik |
| Anggaran, judul | Anggaran |
| Anggaran, kosong | Belum ada anggaran bulan ini. / Atur anggaran |
| Anggaran, baris | Sesuai / Mendekati / Lewat, lebih cepat dari biasa · [persen] / [Rp] dari [Rp] · sisa [Rp] / · lewat [Rp] |
| Anggaran, penanda | Garis tegak: hari ini, [persen] bulan sudah berjalan |
| Akun, judul | Akun / Semua akun |
| Akun, label | Saldo likuid / Kewajiban / Aset / Nilai bersih / Milik [nama] |
| Tagihan, judul | Tagihan mendatang / Semua tagihan |
| Tagihan, kosong | Belum ada tagihan terjadwal. |
| Tagihan, penanda | · perkiraan |
| Target, judul | Target / Semua target |
| Target, kosong | Belum ada target tabungan. |
| Target, baris | · setoran [Rp] per bulan |
| Kesehatan, judul | Cek kesehatan |
| Kesehatan, status | Aman / Pantau / Perlu perhatian |
| Kesehatan, cek | Dana darurat / Rasio tabungan / Rasio cicilan / Tagihan lewat jatuh tempo |
| Wawasan, judul | Wawasan minggu ini |
| Wawasan, kosong | Belum ada transaksi 7 hari terakhir untuk dirangkum. |
| Wawasan, kategori naik | Pengeluaran [nama] 7 hari terakhir [Rp], naik [Rp] dari 7 hari sebelumnya. |
| Wawasan, kategori baru | Pengeluaran [nama] 7 hari terakhir [Rp], sebelumnya tidak ada. |
| Wawasan, anggaran lewat | Anggaran [nama] sudah lewat, terpakai [persen]. |
| Wawasan, anggaran cepat | Anggaran [nama] sudah terpakai [persen], padahal bulan baru berjalan [persen]. |
| Wawasan, total minggu | Total pengeluaran 7 hari terakhir [Rp] dari [n] transaksi. |
| Wawasan, tagihan | Tagihan [nama] [Rp] jatuh tempo [3 hari lagi]. |
| Wawasan, tautan | Lihat transaksi |
| Cara menghitung, judul | Cara menghitung [metrik] |
| Cara menghitung, keterangan | Dihitung app dari data kalian, bukan AI. |
| Cara menghitung, baris hasil | Hasil |

### Laporan

| Elemen | Copy |
|---|---|
| Navigasi bulan | Pilih bulan / Bulan sebelumnya, [bulan] / Bulan berikutnya, [bulan] |
| Tombol | Unduh CSV / Cetak / simpan PDF |
| Ringkasan, judul | Ringkasan [periode], dibanding [periode] |
| Ringkasan, label | Pemasukan / Pengeluaran / Selisih / Rasio tabungan [persen] |
| Ringkasan, tanpa pemasukan | Belum ada pemasukan periode ini |
| Ringkasan, perubahan kosong | Tidak ada di [periode] |
| Kategori, judul | Pengeluaran per kategori / Pemasukan per kategori |
| Kategori, kosong | Belum ada pengeluaran [periode]. / Belum ada pemasukan [periode]. |
| Kategori, porsi | [persen] dari total |
| Tren, judul | Tren 12 bulan |
| Tren, kalimat | Pemasukan lebih besar dari pengeluaran di semua [n] bulan tercatat / Pengeluaran melebihi pemasukan di [n] dari [n] bulan tercatat / Belum ada transaksi 12 bulan terakhir |
| Tren, tabel | Pemasukan dan pengeluaran 12 bulan: Bulan / Pemasukan / Pengeluaran / Selisih |
| Cetak, judul | Laporan keuangan [periode] |
| Cetak, keterangan | Cakupan [cakupan] · periode [periode], dibanding [periode] · dicetak [tanggal] |
| Cetak, kolom | Kategori / Nominal / Porsi / Perubahan |
| Cetak, catatan kaki | Semua angka dihitung Kas Kita dari transaksi terkonfirmasi, tanpa transfer dan Penyesuaian saldo. |
| Cetak, tautan | Kembali ke laporan |

### Pengaturan

| Elemen | Copy |
|---|---|
| Bagian (aria) | Bagian pengaturan |
| Profil | Nama dan warna yang menandai data milikmu. |
| Profil, label | Nama tampilan / Warna identitas |
| Profil, petunjuk nama | Nama ini yang dilihat [nama] di cakupan dan riwayat. / Nama ini tampil di cakupan dan riwayat. |
| Profil, petunjuk warna | Menandai data milikmu: titik di transaksi, cincin avatar, dan warna latar saat cakupan Saya. |
| Profil, warna dipakai | Dipakai / [warna], dipakai [nama] |
| Nama warna | Violet, Mawar, Emas, Biru laut, Plum, Kelabu |
| Profil, tombol | Simpan / Ulangi pengenalan |
| Gajian dan periode | Dipakai untuk hitung mundur Aman dibelanjakan dan rentang anggaran serta laporan. |
| Gajian, label | Tanggal gajian / Awal periode |
| Gajian, petunjuk | Tanggal yang tidak ada di bulan tertentu jatuh ke hari terakhir bulan itu, misalnya 31 menjadi 30 September. |
| Awal periode | Bulan kalender: Tanggal 1 sampai akhir bulan. / Siklus gajian: Dari tanggal gajian sampai sehari sebelum gajian berikutnya. |
| Periode sekarang | Periode sekarang: [periode] / Isi tanggal gajian untuk melihat periode sekarang. |
| Gajian, error | Isi tanggal gajian 1 sampai 31 |
| Tampilan, tema | Tema: Ikuti sistem / Terang / Gelap |
| Tampilan, transparansi | Kurangi transparansi. Navigasi, menu, dan panel memakai latar solid, bukan kaca buram. |
| Tampilan, catatan | Tema dan transparansi berlaku di perangkat ini saja. |
| Kategori | Kategori dipakai kalian berdua. Kategori yang diarsipkan tidak muncul di pilihan baru, tetapi transaksi lamanya tetap. |
| Kategori, jenis | Jenis kategori: Pengeluaran / Pemasukan |
| Kategori, daftar | Kategori pengeluaran / Kategori pemasukan / Belum ada kategori / Diarsipkan ([n]) |
| Kategori, tombol | Tambah kategori / Pulihkan / Ubah [nama] / Arsipkan [nama] |
| Kategori, toast | [nama] diarsipkan. Transaksi lama tetap memakai kategori ini. / [nama] dipulihkan |
| Kategori sistem | Kategori sistem: [nama] dan [nama] dipakai app untuk transfer antar akun dan pencocokan saldo, jadi tidak bisa diubah atau diarsipkan. |
| Dialog kategori, judul | Tambah kategori pengeluaran / Tambah kategori pemasukan / Ubah kategori |
| Dialog kategori, label | Nama / Induk / Ikon |
| Dialog kategori, induk kosong | Tidak ada, jadikan kategori utama |
| Dialog kategori, petunjuk | Kategori maksimal dua tingkat. / Kategori ini punya subkategori, jadi tetap jadi kategori utama. |
| Dialog kategori, tombol | Simpan / Batal |
| Nama ikon | Makan, Makan di luar, Belanja dapur, Kopi, Mobil, Motor, Angkutan umum, Bensin, Parkir, Perjalanan, Rumah, Sewa, Listrik, Air, Internet, Pulsa, Tagihan, Kesehatan, Olahraga, Pendidikan, Buku, Belanja, Pakaian, Hiburan, Hadiah, Keluarga, Anak, Hewan peliharaan, Bank, Dokumen, Kerja, Bonus, Usaha, Imbal hasil, Tabungan, Uang saku, Uang tunai, Pengembalian, Lainnya, Umum |
| Sesi | Perangkat yang sedang masuk dengan akunmu. Keluarkan perangkat yang hilang atau tidak kamu kenali. |
| Sesi, daftar | Sesi aktif / Perangkat ini |
| Sesi, baris | [browser] di [sistem] / Perangkat tepercaya, sesi 30 hari / Sesi 12 jam · IP [ip] / Aktif terakhir [tanggal] [waktu] · Berakhir [tanggal] [waktu] |
| Sesi, perangkat tak dikenal | Perangkat tidak dikenal / Browser |
| Sesi, kosong | Tidak ada sesi aktif lain. Muat ulang halaman kalau baru masuk dari perangkat lain. |
| Sesi, tombol | Keluar dari perangkat ini |
| Sesi, toast | [perangkat] sudah keluar |
| AI, status sementara | Pemasangan penyedia AI (alamat server, API key, dan pilihan model) hadir di tahap berikutnya. Sampai saat itu belum ada data yang dikirim ke penyedia mana pun, dan quick-add membaca teksmu dengan parser di app. |
| Ekspor | Satu file zip berisi data.json (akun, transaksi, kategori, anggaran, tagihan, target, dan riwayat perubahan) beserta lampiran struk. Data login dan API key tidak ikut. |
| Ekspor, tombol | Ekspor semua data |
| Ekspor, lampiran hilang | Lampiran ini tidak ditemukan di penyimpanan saat ekspor. |
| Toast simpan | Tersimpan |

### Pengenalan

| Elemen | Copy |
|---|---|
| Judul | Siapkan Kas Kita |
| Keterangan | Semua bisa diubah lagi di Pengaturan. |
| Tombol lewati semua | Lewati pengenalan |
| Penanda langkah (aria) | Langkah pengenalan / Langkah [n] |
| Langkah 1 | Profil kamu: Nama, warna yang menandai data milikmu, dan tanggal gajian. |
| Langkah 1, petunjuk nama | Nama yang dilihat [nama] di cakupan dan riwayat. / Nama yang tampil di cakupan dan riwayat. |
| Langkah 1, error | Isi tanggal gajian 1 sampai 31 |
| Langkah 2 | Akun pertama: Mulai dari rekening yang paling sering kamu pakai, dengan saldonya hari ini. |
| Langkah 2, sudah ada | Sudah ada [n] akun. Tambahkan lagi kalau ada yang belum tercatat. |
| Langkah 2, label | Nama akun / Jenis / Pemilik / Saldo hari ini |
| Langkah 2, placeholder | BCA gaji |
| Langkah 2, petunjuk saldo | Lihat di aplikasi bank atau dompet. Bisa dicocokkan lagi nanti. |
| Langkah 2, petunjuk utang | Tulis sisa utangnya. App mencatatnya sebagai kewajiban. |
| Langkah 2, error | Isi nama akun / Isi saldo hari ini, misalnya 1,5jt |
| Langkah 2, tombol | Tambah akun |
| Langkah 2, toast | [nama] ditambahkan |
| Langkah 2, daftar (aria) | Akun yang baru ditambahkan |
| Langkah 3 | Pengaturan AI: Opsional. Semua fitur pencatatan tetap jalan tanpa AI. |
| Langkah 3, isi | Quick-add tetap jalan tanpa AI. Ketik misalnya "kopi 25rb gopay" di bar bawah dan app membacanya sendiri. |
| Langkah 3, status sementara | Pemasangan penyedia AI untuk membaca foto struk hadir di tahap berikutnya, di Pengaturan bagian AI. Langkah ini dilewati dulu. |
| Tombol langkah | Lanjut / Lewati / Selesai |

### Notifikasi

| Elemen | Copy |
|---|---|
| Judul | Notifikasi |
| Tombol | Tandai semua dibaca |
| Memuat | Memuat notifikasi |
| Gagal memuat | Notifikasi belum bisa dimuat. / Coba lagi |
| Kosong, panel | Belum ada notifikasi. Kabar muncul di sini saat [nama] mengubah data milikmu, tagihan jatuh tempo 3 hari lagi, atau anggaran wajib lewat. |
| Kosong, tombol shell | Belum ada notifikasi. |
| Daftar (aria) | Daftar notifikasi |
| Belum dibaca (aria) | Belum dibaca. |
| Waktu | Baru saja / [n] menit lalu / [tanggal] [waktu] |
| Perubahan oleh partner | [nama] mengubah [objek]. / [nama] mengubah [objek]: [nilai] menjadi [nilai]. / [nama] menghapus [objek]. / [nama] memulihkan [objek]. |
| Objek | [jenis] [tanggal] / nilai [nama] [tanggal] |
| Cadangan, partner | Partner mengubah data milikmu. |
| Cadangan, tagihan | Ada tagihan yang jatuh tempo 3 hari lagi. |
| Cadangan, anggaran | Ada anggaran wajib yang lewat. |
| Cadangan, berulang | Ada transaksi berulang yang menunggu konfirmasi. |

### Error domain

| Situasi | Copy |
|---|---|
| Error server umum | Terjadi kesalahan di server. Coba lagi sebentar lagi. |
| Data tidak ditemukan | Data [entitas] [id] tidak ditemukan. Muat ulang halaman lalu coba lagi. |
| Konflik edit, umum | [Subjek] baru diubah [nama] pukul [waktu]. Pilih versi yang dipakai. |
| Subjek konflik | Transaksi ini, Akun ini, Kategori ini, Anggaran ini, Tagihan ini, Target ini, Setoran ini, Nilai ini, Data ini |
| Validasi umum | Data tidak valid |
| Format tanggal | Format tanggal YYYY-MM-DD |
| Nominal kosong | Isi nominal, misalnya 25rb |
| Saldo tidak cukup | Saldo [nama] tinggal [Rp]. Kurangi nominal atau catat dari akun lain. |
| Akun, nama kosong | Isi nama akun |
| Akun, pemilik | Pemilik akun harus kamu, partner, atau Bersama |
| Akun, saldo awal tunai | Saldo awal Tunai tidak boleh negatif |
| Akun, hapus ditolak | Akun ini punya transaksi, jadi tidak bisa dihapus. Arsipkan supaya riwayatnya tetap ada. |
| Cocokkan, saldo negatif | Saldo [nama] tidak boleh negatif |
| Transaksi, akun hilang | Akun tidak ditemukan. Pilih akun lain. |
| Transaksi, kategori hilang | Kategori tidak ditemukan. Pilih kategori lain. |
| Transaksi, kategori salah jenis | Kategori tidak cocok dengan jenis transaksi |
| Transaksi, transfer | Pilih akun tujuan transfer / Akun tujuan harus berbeda dari akun asal |
| Transaksi, pulihkan kedaluwarsa | Transaksi ini dihapus lebih dari 30 hari lalu dan tidak bisa dipulihkan. |
| Tagihan, nama kosong | Isi nama tagihan |
| Tagihan, pengulangan | Pengulangan tidak dikenali |
| Tagihan, kategori | Pilih kategori tagihan |
| Tagihan, tidak ada nominal | Tidak ada nominal yang perlu dibayar untuk periode ini. |
| Tagihan, sudah dibayar | Tagihan periode ini sudah dibayar. |
| Anggaran, pemilik | Pemilik anggaran tidak dikenal |
| Kategori, nama kosong | Isi nama kategori |
| Kategori, induk diri sendiri | Kategori tidak bisa jadi induk dirinya sendiri |
| Kategori, kedalaman | Kategori maksimal dua tingkat |
| Kategori, jenis induk | Jenis subkategori harus sama dengan induknya |
| Kategori, sistem | Kategori sistem tidak bisa diubah atau dihapus. |
| Kategori, ganti jenis | Jenis kategori yang sudah dipakai transaksi tidak bisa diganti |
| Kategori, hapus ditolak | Kategori ini sudah dipakai transaksi. Arsipkan supaya riwayatnya tetap ada. |
| Target, nama kosong | Isi nama target |
| Target, akun penampung | Target ini punya akun penampung. Catat setoran sebagai transfer ke akun itu. |
| Investasi, tanggal | Tanggal nilai tidak boleh setelah hari ini |
| Investasi, negatif | Nilai pasar tidak boleh negatif |
| Investasi, catatan | Catatan maksimal 200 karakter |
| Investasi, jenis akun | Nilai pasar hanya untuk akun Investasi |
| Profil, nama | Isi nama tampilan / Nama tampilan maksimal 40 karakter |
| Profil, gajian | Isi tanggal gajian 1 sampai 31 |
| Profil, warna | Warna [warna] sudah dipakai [nama]. Pilih warna lain. |
| Sesi, tidak ditemukan | Sesi tidak ditemukan. / Sesi tidak ditemukan. Mungkin sudah berakhir. |
| Sesi habis | Sesimu berakhir. Masuk lagi untuk melanjutkan. |

Pesan CLI `user:create` (dibaca admin di terminal, bukan di app): "Email tidak valid.", "Nama tidak boleh kosong.", "Nama maksimal 40 karakter.", "Tanggal gajian 1 sampai 31.", "Warna harus salah satu dari: [warna].", "Warna [warna] sudah dipakai pengguna lain. Pilih salah satu: [warna].", "Semua warna identitas sudah dipakai.", "Kas Kita sudah punya dua pengguna. Pengguna ketiga tidak bisa dibuat.", "Email [email] sudah terdaftar. Pakai --link untuk membuat tautan pendaftaran baru.", "Pengguna gagal dibuat.", "Belum ada pengguna dengan email [email]."

## 5. Temuan audit copy

Hasil audit teks di kode terhadap bagian 1 sampai 4, per 24 Sep 2026. Urutan tabel sesuai prioritas: yang paling atas paling perlu diperbaiki. Setelah usulan diterapkan, perbarui tabel per area di bagian 4 lalu hapus barisnya dari sini.

| Lokasi | Teks sekarang | Masalah | Usulan |
|---|---|---|---|
| src/server/errors.ts:24 | Data [entitas] [id] tidak ditemukan. Muat ulang halaman lalu coba lagi. | Menampilkan nama tabel dan UUID ke pengguna, misalnya "Data accounts 3f2a… tidak ditemukan" (audit.ts:117 dan :133 mengirim nama tabel). | Pakai subjek dari `ENTITY_SUBJECT`, tanpa id: "[Subjek] tidak ditemukan, mungkin sudah dihapus. Muat ulang halaman lalu coba lagi." Tambahkan "Pengguna ini" untuk entitas pengguna. |
| src/server/mutations/_shared.ts:37, src/server/actions/transactions.ts:47 | Data tidak valid | Tidak menjelaskan apa yang salah atau apa yang bisa dilakukan. | "Ada isian yang belum benar. Cek bagian yang ditandai lalu simpan lagi." |
| src/server/mutations/_shared.ts:26 | Format tanggal YYYY-MM-DD | Pesan teknis, sampai ke pengguna lewat `parseInput`. | "Tanggal belum terbaca. Pilih tanggal lagi." |
| src/server/actions/notifications.ts:43 | Partner mengubah data milikmu. | Suara: pasangan disebut dengan nama tampilannya. | "[nama] mengubah data milikmu." Kalau nama tidak ada: "Ada perubahan pada data milikmu." |
| src/components/notifications/notifications-panel.tsx:86 | …saat {partnerName ?? "partner"} mengubah data milikmu… | Fallback "partner" huruf kecil; pasangan disebut dengan nama. | Kalau partner belum ada, hapus bagian itu: "Belum ada notifikasi. Kabar muncul di sini saat tagihan jatuh tempo 3 hari lagi atau anggaran wajib lewat." |
| src/components/onboarding/account-step.tsx:100 | Lihat di aplikasi bank atau dompet. Bisa dicocokkan lagi nanti. | Glosarium: "dompet" dilarang. | "Lihat di aplikasi bank atau e-wallet. Bisa dicocokkan lagi nanti." |
| src/app/(app)/page.tsx:62, src/components/accounts/accounts-view.tsx:109, src/components/onboarding/onboarding-flow.tsx:16 | Mulai dari rekening yang paling sering kamu pakai… | Glosarium: "rekening" untuk semua jenis akun. Akun pertama bisa e-wallet atau tunai. | "Mulai dari akun yang paling sering kamu pakai. Saldonya bisa dicocokkan nanti." dan "Mulai dari akun yang paling sering kamu pakai, dengan saldonya hari ini." |
| src/components/accounts/delete-account-dialog.tsx:34, src/components/transactions/transaction-detail-sheet.tsx:94, src/components/investments/investments-view.tsx:82 | Akun dihapus / Transaksi dihapus / Nilai dihapus | Toast untuk tombol yang sama ditulis beda: tagihan, anggaran, dan target memakai "Terhapus" (bills-view.tsx:179, budgets-view.tsx:169, goals-view.tsx:147). | Satu pola seperti "Tersimpan": "Terhapus" di semua toast hapus. Label status di riwayat tagihan (bill-history.tsx:24 "Transaksi dihapus") tetap. |
| src/components/dashboard/attention-items.ts:46 dan :48, src/app/api/export/_lib/csv.ts:19 | Draf / [n] transaksi draf menunggu konfirmasi | Status yang sama di layar lain bernama "Perlu dikonfirmasi" (tab Transaksi, labels.ts:63). | Status: "Perlu dikonfirmasi". Kalimat: "[n] transaksi perlu dikonfirmasi". CSV: "Perlu dikonfirmasi". |
| src/components/dashboard/formula-explainer.tsx:62, src/components/onboarding/account-step.tsx:100, src/components/onboarding/ai-step.tsx:9, src/components/settings/categories-section.tsx:119, src/app/(app)/pengaturan/page.tsx:72 | Dihitung app… / App mencatatnya… / app membacanya sendiri / dipakai app… / Angka di dashboard selalu dihitung app | Campur bahasa, dan app menyebut dirinya dengan dua cara ("app" dan "Kas Kita"). "Dashboard" tidak ada di menu; halamannya bernama Ringkasan. | Pakai "Kas Kita": "Dihitung Kas Kita dari data kalian, bukan AI." / "Kas Kita mencatatnya sebagai kewajiban." / "…dan Kas Kita membacanya sendiri." / "…dipakai Kas Kita untuk transfer antar akun…". Keterangan halaman AI (juga di tabel Pengaturan AI): "Angka di Ringkasan selalu dihitung Kas Kita, bukan AI." |
| src/components/shell/sidebar.tsx:44 | Lipat sidebar / Buka sidebar | Campur bahasa Inggris. | "Lipat navigasi" / "Buka navigasi" |
| src/components/transactions/conflict-dialog.tsx:90 | Field | Kata Inggris dijadikan judul kolom. | "Bagian". Bagian lain dialog sudah memakai kata Indonesia. |
| src/components/transactions/transaction-form.tsx:67, src/components/transactions/labels.ts:66 dan :67 | Memuat form / Form / Quick-add | Campur bahasa. Teks lain menyebut bar itu "bar bawah". | "Memuat formulir" / sumber "Formulir" / sumber "Bar catat" |
| src/components/onboarding/ai-step.tsx:9, src/app/(app)/pengaturan/page.tsx:75 | Quick-add tetap jalan tanpa AI… / …quick-add membaca teksmu dengan parser di app. | Istilah internal dan bahasa Inggris ("quick-add", "parser", "app"). | "Pencatatan tetap jalan tanpa AI. Ketik misalnya "kopi 25rb gopay" di bar bawah dan Kas Kita membacanya sendiri." / "…dan Kas Kita membaca teks di bar bawah sendiri, tanpa AI." |
| src/app/(app)/pengaturan/page.tsx:75, src/components/onboarding/ai-step.tsx:12 | …hadir di tahap berikutnya… | Bahasa roadmap; pengguna tidak tahu "tahap" apa. | "Pengaturan penyedia AI belum tersedia di versi ini. Sampai tersedia, tidak ada data yang dikirim ke penyedia AI mana pun." / "Membaca foto struk dengan AI belum tersedia di versi ini. Langkah ini dilewati dulu." |
| src/components/dashboard/flow-section.tsx:23, src/components/reports/summary-card.tsx:10, src/components/reports/category-list.tsx:71 | Tidak ada di [periode] | Kurang jelas: yang tidak ada adalah nilai pembanding, bukan data periode ini. | "Tidak ada pembanding di [periode]" |
| src/server/metrics/safe-to-spend.ts:61, net-worth.ts:23, savings-rate.ts:8, days-to-payday.ts:30-31, cumulative-daily-balance.ts:52 | saldo likuid - tagihan… | Rumus di "Cara menghitung" memakai tanda hubung sebagai minus. | Ganti " - " dengan " − " di semua rumus yang tampil. |
| src/components/transactions/conflict-dialog.tsx:24, :35, :44, :45; src/components/reports/print-report.tsx:10; src/components/dashboard/budget-section.tsx:30 dan :58 | - | Tanda hubung sebagai isian kosong mudah dibaca sebagai minus di dekat angka. | "—" untuk sel kosong. Di anggaran tanpa nominal, tulis "belum ada nominal". |
| src/server/mutations/accounts.ts:34 | Pemilik akun harus kamu, partner, atau Bersama | "partner" bukan nama, dan pesannya tidak mengatakan apa yang harus dilakukan. | "Pilih pemilik akun: kamu, [nama], atau Bersama." |
| src/server/mutations/budgets.ts:31 | Pemilik anggaran tidak dikenal | Tidak mengatakan apa yang harus dilakukan. | "Pemilik anggaran tidak dikenal. Pilih pemilik lagi." |
| src/server/mutations/bills.ts:24 | Pengulangan tidak dikenali | Tidak mengatakan apa yang harus dilakukan. | "Pengulangan tidak dikenali. Pilih Bulanan, Mingguan, atau Tahunan." |
| src/server/auth/actions.ts:19 | Sesi tidak ditemukan. | Tidak mengatakan apa yang harus dilakukan; bedanya dengan baris 21 tidak berguna bagi pengguna. | Satukan: "Sesi ini sudah berakhir. Muat ulang halaman untuk melihat daftar terbaru." |
| src/server/auth/hooks.ts:14 | Email atau password salah. | Tidak mengatakan apa yang bisa dilakukan. | "Email atau password salah. Cek lagi, atau masuk dengan passkey." |
| src/server/auth/enrollment-actions.ts:34 dan :60 | Password tidak valid. / Kode tidak valid. | Tidak menjelaskan syaratnya. | "Password minimal [n] karakter." / "Kode terdiri dari 6 angka. Masukkan kode terbaru dari aplikasi autentikator." |
| src/components/goals/goals-view.tsx:52 | [nama] kembali aktif | Toast tidak memakai kata kerja tombolnya ("Tandai belum tercapai"). | "[nama] ditandai belum tercapai" |
| src/components/dashboard/health-section.tsx:12 | Perlu perhatian | Label status kesehatan sama dengan judul bagian "Perlu perhatian" (attention-list.tsx:27), padahal artinya lain. | Status kesehatan: "Perlu dicek" |
| src/app/(auth)/daftar-perangkat/backup-setup.tsx:53 | Pasang TOTP | Istilah teknis untuk judul. | "Pasang kode autentikator". Keterangan boleh tetap menyebut TOTP. |
| src/components/accounts/account-form-fields.tsx:38, src/components/onboarding/account-step.tsx:49, src/components/budgets/owner.tsx:31, src/components/transactions/transaction-form-fields.tsx:33, src/components/quick-add/preview-card.tsx:77 | Saya | Pilihan pemilik ditulis "Saya" di form, tetapi "Milik kamu" di daftar pilihan akun (option-groups.tsx:20) dan nama sendiri di chip akun quick-add (preview-card.tsx:26). | Pilihan pemilik di form memakai "Kamu". "Saya" hanya untuk nama cakupan. |
| src/components/dashboard/hero.tsx:21 | Setoran target | Nama komponen di hero beda dengan input rumus "Setoran target sampai gajian" (safe-to-spend.ts:51). | Samakan: "Setoran target sampai gajian", atau pendekkan keduanya jadi "Setoran target". |

Tidak ditemukan: emoji, tanda seru di pesan sistem, sapaan selain "kamu", label kapital semua, istilah "Rekonsiliasi", "mode", "view", "goal", "bill", atau "joint" di teks yang tampil. Istilah "Cocokkan saldo" dan "pencocokan" sudah konsisten.
