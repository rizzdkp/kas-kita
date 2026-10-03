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
| Keterangan halaman | Foto struk dan teks transaksi dikirim ke penyedia yang kamu pasang di sini. Angka di Ringkasan selalu dihitung Kas Kita, bukan AI. |
| Tombol | Ambil daftar model |
| Tombol | Tes koneksi |
| Hasil tes berhasil | Model teks dan model vision merespons |
| Key tersimpan | Tersimpan, berakhiran ••••[last4] |
| Key tersimpan, petunjuk | Tersimpan, berakhiran ••••[last4]. Kosongkan kalau tidak diganti. |
| Key belum ada, petunjuk | Disimpan terenkripsi dan tidak pernah dikirim ke browser. |
| Label | Base URL / API key / Model teks / Model vision |
| Base URL, petunjuk | Alamat server yang kompatibel dengan OpenAI, biasanya diakhiri /v1. |
| Model teks, petunjuk | Membaca teks transaksi di bar bawah. |
| Model vision, petunjuk | Membaca foto struk. Pilih model yang bisa membaca gambar. |
| Kolom model, placeholder | Cari atau ketik ID model |
| Kolom model, tidak ada yang cocok | Tidak ada di daftar. ID yang kamu ketik tetap dipakai. |
| Daftar model, status | [n] model ditemukan. Pilih di bawah atau ketik ID model sendiri. / Atau ketik ID model langsung di kolom model. / Isi base URL dan API key untuk mengambil daftar model. |
| Daftar model kosong | Server tidak mengirim daftar model. Ketik ID model secara manual. |
| Daftar model gagal | Server AI tidak merespons. Cek base URL, atau ketik ID model secara manual. / Server membalas HTTP [n]: [pesan server]. Cek base URL dan API key, atau ketik ID model secara manual. |
| Belum dipasang | AI belum dipasang. Tidak ada data yang dikirim ke penyedia AI mana pun, dan Kas Kita membaca teks di bar bawah sendiri, tanpa AI. |
| Hasil tes, judul | Hasil tes koneksi |
| Hasil tes per model | Model teks / Model vision · [id]: Merespons / Model belum dipilih. / Model tidak mendukung gambar. / Tidak merespons. Cek base URL dan pastikan server AI menyala. / Server menolak permintaan. / Merespons, tetapi jawabannya bukan JSON yang sesuai. Coba model lain. / Pesan server: [pesan] |
| Tombol | Simpan / Hapus pengaturan AI |
| Dialog hapus | Hapus pengaturan AI?: Base URL, API key, dan pilihan model dihapus untuk kalian berdua. Kas Kita berhenti mengirim data ke penyedia AI, dan pencatatan tetap jalan tanpa AI. |
| Dialog hapus, tombol | Batal / Hapus pengaturan AI |
| Toast hapus | Pengaturan AI dihapus |
| Error base URL | Isi base URL yang diawali http:// atau https://, misalnya https://api.openai.com/v1 |
| Error API key | Isi API key dari penyedia AI |
| Error AI belum dipasang | Model AI belum dipasang. Pilih model di pengaturan AI. |
| Error server AI menolak | Model AI menolak permintaan (HTTP [n]). Cek pengaturan AI atau isi field yang kosong sendiri. |
| Error jawaban AI tidak terbaca | Jawaban model AI tidak terbaca utuh. Cek hasilnya dan isi field yang kosong sendiri. |

### Cara membaca tabel per area

Tabel di bawah mencatat teks yang sudah dipakai di kode. Bagian dinamis ditulis sebagai placeholder: [nama] untuk nama orang, akun, tagihan, target, atau kategori; [n] untuk angka biasa; [Rp] untuk nominal yang lewat `formatRupiah`; [tanggal] untuk tanggal atau label rentang; [periode] untuk label periode seperti "1-30 Sep"; [persen] untuk persen yang lewat `formatPercent`; [waktu] untuk jam. Teks yang ditandai (aria) hanya dibaca screen reader. Kalau teks di kode berbeda dengan tabel ini, ikuti tabel dan catat perbedaannya di bagian 5.

### Login dan perangkat

| Elemen | Copy |
|---|---|
| Judul halaman masuk | Kas Kita |
| Keterangan halaman masuk | Masuk untuk melihat keuangan kalian berdua. |
| Kalimat nilai produk di panel ilustrasi (layar besar) | Uang kalian berdua, dalam satu tempat. |
| Label | Email / Password |
| Tombol lihat password (aria) | Tampilkan password / Sembunyikan password |
| Pilihan ingat perangkat | Ingat perangkat ini (30 hari) |
| Tombol masuk | Masuk |
| Petunjuk mode pengembangan (hanya di luar produksi) | Mode pengembangan / [email] · [password] |
| Error form kosong | Isi email dan password untuk masuk. |
| Error email atau password | Email atau password salah. Cek lagi lalu coba lagi. |
| Error kunci login | Terlalu banyak percobaan masuk yang gagal. Coba lagi dalam [n] menit. |
| Error terlalu banyak percobaan | Terlalu banyak percobaan. Tunggu sebentar lalu coba lagi. |
| Error koneksi saat masuk | Tidak bisa masuk sekarang. Periksa koneksi lalu coba lagi. |
| Error password pendek | Password minimal [n] karakter. |
| Error password panjang | Password maksimal 128 karakter. |
| Error password beda | Kedua password belum sama. |

### Shell dan navigasi

| Elemen | Copy |
|---|---|
| Nama app dan judul tab | Kas Kita / [halaman] · Kas Kita |
| Menu utama | Ringkasan, Transaksi, Akun, Anggaran, Tagihan, Target, Investasi, Laporan, Pengaturan |
| Halaman di luar menu | Pengenalan, Notifikasi |
| Tautan lewati | Lewati ke konten |
| Navigasi (aria) | Navigasi utama |
| Tombol lipat navigasi | Lipat navigasi / Buka navigasi |
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
| Chip Untuk, pilihan | Kamu / [nama] / Bersama |
| Tambah catatan | Tambah catatan |
| Keterangan pencatat | Dicatat atas nama [nama], diisi oleh kamu |
| Buang baris (aria) | Buang baris [n] |
| Field belum lengkap | Lengkapi [field] dan [field] untuk menyimpan. |
| Field belum lengkap, banyak baris | Baris [n]: Lengkapi [field] untuk menyimpan. |
| Tombol | Simpan / Simpan semua / Batal / Selesai |
| Toast tersimpan offline | Tersimpan di perangkat. Dikirim otomatis saat koneksi kembali. |
| Penanda offline | Offline. Menampilkan data terakhir. |
| Halaman offline, judul | Kamu sedang offline |
| Halaman offline, isi | Halaman ini belum pernah dibuka di perangkat ini, jadi belum ada salinannya. Halaman yang sudah pernah dibuka, seperti Ringkasan, tetap tampil dengan data terakhir. / Transaksi yang kamu ketik di bar bawah disimpan di perangkat dan dikirim otomatis saat koneksi kembali. |
| Halaman offline, tombol | Coba lagi / Buka Ringkasan |
| Manifest PWA, keterangan | Keuangan berdua: berapa yang aman dibelanjakan sampai gajian berikutnya. |
| Toast antrean terkirim | Transaksi dari antrean tersimpan / [n] transaksi dari antrean tersimpan |
| Toast antrean gagal | Antrean belum terkirim. [pesan error] |
| Toast urungkan | Diurungkan |
| Toast urungkan gagal | Belum bisa diurungkan. [pesan error] |
| Error jaringan | Tidak bisa terhubung ke server. Periksa koneksi lalu coba lagi. |
| AI membaca (status di atas bar) | Model AI membaca baris yang belum lengkap. / Model AI membaca [n] baris yang belum lengkap. Esc untuk isi sendiri. |
| AI membaca, tombol | Isi sendiri |
| Tanda field hasil AI | AI / (aria) , diisi AI |
| Keterangan field hasil AI | Field bertanda AI diisi model AI. Cek sebelum menyimpan. |
| AI gagal atau lewat 30 detik | Model AI tidak merespons. Cek pengaturan AI atau isi field yang kosong sendiri. (atau pesan error dari klien AI) |
| Dialog foto struk, judul | Foto struk butuh model vision |
| Dialog foto struk, isi | Struk dibaca oleh model AI yang bisa membaca gambar. Pasang model vision di pengaturan AI, lalu tombol ini langsung membuka kamera. Sementara itu, ketik transaksinya di bar, misalnya kopi 25rb gopay. |
| Dialog foto struk, tombol | Buka pengaturan AI / Batal |
| Dialog foto struk offline, judul | Foto struk butuh koneksi |
| Dialog foto struk offline, isi | Foto struk dibaca oleh model AI lewat server, jadi tidak bisa diproses saat offline. Sambungkan internet lalu coba lagi, atau ketik transaksinya di bar, misalnya kopi 25rb gopay. Transaksi yang diketik tetap tersimpan di perangkat. |
| Dialog foto struk offline, tombol | Tutup |
| Struk, area unggah | Seret foto struk ke sini (layar sentuh: Ambil atau pilih foto struk) / Foto dikecilkan di perangkat ini sebelum diunggah, lalu dibaca model AI. Semua hasil bisa kamu ubah sebelum disimpan. / Pilih foto |
| Struk, progres | Mengunggah foto [n]% / Membaca struk… / Model AI membaca toko, tanggal, total, dan item. Biasanya kurang dari satu menit. |
| Struk, progres (aria) | Progres unggah / Membaca struk |
| Struk, foto | Perbesar / Perbesar foto struk (aria) / Foto struk (alt) / Foto struk ukuran penuh (alt) |
| Struk, label | Total struk, Tanggal dan waktu, Catatan, Akun, Untuk siapa, Cara simpan, Kategori |
| Struk, keterangan catatan | Nama toko dari struk |
| Struk, placeholder | Misalnya 192rb / Misalnya Indomaret / Nama item / Nominal |
| Struk, cara simpan | Simpan sebagai satu transaksi: Satu kategori untuk seluruh struk. / Pecah per kategori: Tetap satu transaksi, nominalnya dirinci per kategori item. |
| Struk, item | Item struk / Jumlah item [Rp] / Tambah item / Belum ada item terbaca. Tambahkan item kalau ingin memecah per kategori. |
| Struk, item (aria) | Nama item [n] / Nominal item [n] / Kategori item [n] / Buang item [n] |
| Struk, banner selisih | Jumlah item [Rp], total struk [Rp]. Cek item yang terlewat. |
| Struk, rincian | Rincian per kategori |
| Struk, selisih saat dipecah | Jumlah item selisih [Rp] dari total. Transaksi yang dipecah harus pas dengan totalnya. / Tambah item selisih / Pakai jumlah item sebagai total |
| Struk, nama item selisih | Selisih struk / Potongan |
| Struk, belum bisa simpan | Lengkapi [field] dan [field] untuk menyimpan. / Isi nominal setiap item, atau buang baris yang kosong. / Tambahkan item untuk memecah per kategori. / Pilih kategori untuk setiap item sebelum memecah per kategori. / Samakan jumlah item dengan total sebelum memecah per kategori. |
| Struk, error simpan | Jumlah item [Rp] belum sama dengan total [Rp]. Samakan dulu sebelum memecah per kategori. / Nominal per kategori harus lebih dari nol. Gabungkan potongan harga dengan item di kategori yang sama. / Foto struk ini sudah tersimpan di transaksi lain. |
| Struk, AI belum dipasang | Model vision belum dipasang. Isi field dari foto sendiri, atau pasang model vision di pengaturan AI. |
| Struk, AI tidak terhubung | Tidak bisa terhubung ke server. Isi field dari foto sendiri. |
| Struk, sudah tersimpan | Struk ini sudah tersimpan / Foto ini sudah jadi lampiran sebuah transaksi. Buka transaksinya untuk mengubah, atau baca struk lain. / Lihat transaksi / Foto struk lain |
| Unggah foto, error | Foto lebih dari 10 MB. Ambil ulang fotonya atau pilih foto yang lebih kecil. / File ini bukan foto JPEG, PNG, WebP, atau HEIC. Pilih foto struk. / Foto ini tidak bisa dibuka. Ambil ulang fotonya lalu coba lagi. / File kosong. Pilih foto struk. / Foto ini tidak ditemukan, mungkin sudah dihapus. Unggah ulang fotonya. / Permintaan ditolak. |

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
| Memuat | Memuat transaksi berikutnya / Memuat transaksi / Memuat formulir |
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
| Form, pilihan untuk | Kamu / [nama] / Bersama |
| Form, error | Isi nominal, misalnya 25rb / Isi tanggal dan waktu / Pilih akun / Pilih akun tujuan transfer / Akun tujuan harus berbeda dari akun asal / Pilih kategori |
| Jenis | Pengeluaran / Pemasukan / Transfer |
| Pemilik | Milik kamu / Milik [nama] / Milik Bersama |
| Opsi akun diarsipkan | [nama] (diarsipkan) |
| Status | Terkonfirmasi / Perlu dikonfirmasi / Dihapus |
| Sumber | Formulir / Bar catat / Foto struk / Impor CSV / Impor PDF / Transaksi berulang / Penyesuaian saldo |
| Detail, judul | Detail transaksi |
| Detail, label | Jenis, Tanggal, Akun, Dari akun, Ke akun, Kategori, Untuk, Catatan, Tag, Sumber, Diisi oleh, Terakhir diubah |
| Detail, nilai pencatat | [nama], [tanggal], [waktu] |
| Detail, tombol | Ubah / Hapus / Konfirmasi / Pulihkan |
| Detail, lampiran | Rincian per kategori / Lampiran / Belum ada lampiran. / Tambah lampiran / Mengunggah [n]% / Hapus lampiran |
| Detail, lampiran (aria dan alt) | Buka lampiran [n] / Lampiran [n] |
| Toast hapus dan pulihkan | Terhapus / Transaksi dipulihkan |
| Riwayat, judul | Riwayat |
| Riwayat, kosong | Belum ada perubahan tercatat. |
| Riwayat, aksi | [nama] mencatat transaksi ini / menghapus transaksi ini / memulihkan transaksi ini |
| Riwayat, tag kosong | tanpa tag |
| Konflik, pesan | Transaksi ini baru diubah [nama] pukul [waktu]. Pilih versi yang dipakai. |
| Konflik, tombol | Pakai versi terbaru / Pakai versi saya |
| Konflik, kolom | Bagian / Versi terbaru / Versi kamu |
| Konflik, nilai kosong | — |
| Konflik, penanda | Berbeda |
| Konflik, nilai tak dikenal | Akun lain / Kategori lain / orang lain |
| Baris, transaksi dipecah | dipecah ke [n] kategori |
| Kolom CSV | Tanggal, Waktu, Jenis, Nominal, Akun, Akun tujuan, Kategori, Rincian kategori, Catatan, Diisi oleh, Tag, Status |
| Rincian kategori di CSV | [kategori] [Rp]; [kategori] [Rp] (hanya transaksi yang dipecah; kosong selain itu) |
| Status di CSV | Terkonfirmasi / Perlu dikonfirmasi |
| Nama file CSV | kas-kita-transaksi-[tanggal]-sampai-[tanggal].csv / kas-kita-transaksi-sejak-[tanggal].csv |

### Transaksi berulang

| Elemen | Copy |
|---|---|
| Tautan dari Transaksi | Transaksi berulang |
| Tautan kembali | Semua transaksi |
| Judul halaman | Transaksi berulang |
| Pengantar | Dibuat pada tanggalnya. Yang tanpa konfirmasi otomatis menunggu di Perlu dikonfirmasi sampai kamu mengonfirmasinya. |
| Kosong, judul | Belum ada transaksi berulang |
| Kosong, isi | Gaji, sewa, langganan, atau kiriman rutin. Kas Kita membuatnya pada tanggalnya dan menaruhnya di Perlu dikonfirmasi, atau langsung mencatatnya kalau konfirmasi otomatis dinyalakan. |
| Tombol | Tambah transaksi berulang |
| Daftar (aria) | Daftar transaksi berulang |
| Baris | [pengulangan] · [akun] · [kategori] / [pengulangan] · [akun] ke [akun] / Berikutnya [tanggal] · [hitung mundur] / [n] menunggu konfirmasi |
| Pengulangan | Harian / Mingguan, [hari] / Bulanan, tanggal [n] / Tahunan, [tanggal] / Setiap [n] [hari/minggu/bulan/tahun], ... |
| Penanda | Konfirmasi otomatis |
| Menu aksi | Aksi untuk [nama] / Ubah jadwal / Hapus jadwal |
| Sheet, judul | Tambah transaksi berulang / Ubah [nama] |
| Sheet, label | Jenis transaksi, Nama atau catatan, Nominal, Akun, Dari akun, Ke akun, Kategori, Untuk siapa, Pengulangan, Berikutnya pada, Konfirmasi otomatis, Tag |
| Sheet, petunjuk nama | Tampil di daftar jadwal dan di transaksi yang dibuat. |
| Sheet, placeholder | Misalnya sewa kos / Misalnya 25rb / Pilih akun / Pilih akun tujuan / Pilih kategori |
| Sheet, pengulangan | Harian / Mingguan / Bulanan / Tahunan |
| Sheet, petunjuk tanggal | [pengulangan]. Di bulan yang lebih pendek, transaksi dibuat di hari terakhirnya. / [pengulangan]. Di tahun yang bukan kabisat, transaksi dibuat tanggal 28 Feb. |
| Sheet, konfirmasi otomatis | Nyala: Transaksi langsung tercatat pada tanggalnya tanpa menunggu konfirmasi. / Mati: Transaksi masuk ke Perlu dikonfirmasi pada tanggalnya, lalu kamu yang mengonfirmasi. |
| Sheet, error | Isi nominal, misalnya 25rb / Pilih akun / Pilih akun tujuan transfer / Akun tujuan harus berbeda dari akun asal / Pilih kategori / Isi tanggal berikutnya / Tanggal berikutnya tidak boleh sebelum hari ini. |
| Sheet, konflik | Jadwal ini baru diubah di perangkat lain. Tutup lalu buka lagi untuk melihat versi terbaru. |
| Sheet, tombol | Simpan / Batal |
| Sheet, toast | Tersimpan / Tersimpan. [nama] akan melihat perubahan ini di riwayat. |
| Hapus, judul | Hapus jadwal [nama]? |
| Hapus, isi | Transaksi yang sudah dibuat dari jadwal ini tetap tersimpan. |
| Hapus, tombol | Hapus jadwal / Batal |
| Hapus, toast | Terhapus |
| Detail transaksi, tombol | Jadikan berulang |
| Objek notifikasi partner | Transaksi berulang [nama] |
| Notifikasi, berulang | Transaksi berulang [nama] [Rp], [tanggal], menunggu konfirmasi. / [n] transaksi berulang [nama] menunggu konfirmasi. |
| Notifikasi, tagihan | Tagihan [nama] [Rp] jatuh tempo [hitung mundur], [tanggal]. |
| Notifikasi, anggaran | Anggaran wajib [kategori] lewat [Rp] dari [Rp]. |

### Akun

| Elemen | Copy |
|---|---|
| Keterangan halaman | Akun Bersama selalu tampil di halaman ini, apa pun cakupannya. |
| Tombol tambah | Tambah akun |
| Kosong | Tambahkan akun pertama. Mulai dari akun yang paling sering kamu pakai. Saldonya bisa dicocokkan nanti. |
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
| Form, pemilik | Kamu / [nama] / Bersama |
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
| Hapus, toast | Terhapus / Diarsipkan |
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
| Hapus, toast | Terhapus |

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
| Toast batal tercapai | [nama] ditandai belum tercapai |
| Batal tercapai, progres penuh | Tandai belum tercapai (nonaktif) / Progres sudah mencapai nominal target. Naikkan nominal target untuk mengaktifkannya lagi. |
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
| Hero, komponen | Saldo likuid / Tagihan sebelum gajian / Setoran target sampai gajian / Sisa anggaran wajib |
| Hero, periode lalu | Dihitung dari posisi hari ini. |
| Hero negatif | Kurang [Rp] sampai gajian |
| Hero (aria) | Aman dibelanjakan / Hari menuju gajian: [n] hari |
| Kosong, belum ada akun | Tambahkan akun pertama. Mulai dari akun yang paling sering kamu pakai. Saldonya bisa dicocokkan nanti. / Tambah akun |
| Kosong, partner | [nama] belum mencatat transaksi. Kamu bisa mencatat atas namanya dari sini. / Catat untuk [nama] |
| Perlu perhatian, judul | Perlu perhatian |
| Perlu perhatian, tagihan telat | [Telat n hari] · Tagihan [nama] belum dibayar · [Rp] |
| Perlu perhatian, anggaran lewat | Lewat · Anggaran wajib [nama] lewat · [Rp] (nominal yang lewat) |
| Perlu perhatian, tagihan segera | [3 hari lagi] · Tagihan [nama] jatuh tempo · [Rp] |
| Perlu perhatian, perlu dikonfirmasi | Perlu dikonfirmasi · [n] transaksi perlu dikonfirmasi |
| Perlu perhatian, tombol | Lihat semua ([n]) / Tampilkan lebih sedikit |
| Arus, judul | Arus bulan ini / Arus periode ini / Arus bulan lalu / Arus periode lalu |
| Arus, pilihan periode | Bulan lalu / Bulan ini (bulan kalender) / Periode lalu / Periode ini (siklus gajian) |
| Arus, pilihan periode (aria) | Periode arus |
| Arus, label | Pemasukan / Pengeluaran / Rasio tabungan |
| Arus, tanpa pemasukan | Belum ada pemasukan periode ini / Belum ada pemasukan |
| Arus, perubahan | ↑ [persen] dari [periode] / ↑ [n] poin dari [periode] / Tidak ada pembanding di [periode] |
| Arus, nilai bersih | Posisi hari ini |
| Arus, tombol rumus (aria) | Cara menghitung pemasukan / Cara menghitung pengeluaran / Cara menghitung rasio tabungan / Cara menghitung nilai bersih |
| Arus, perubahan (aria) | naik / turun / tetap [persen] dari [periode] |
| Grafik saldo, judul | Saldo likuid [Rp] di akhir [periode] / Saldo likuid diperkirakan [Rp] di akhir [periode] / Belum ada saldo untuk digambar |
| Grafik saldo, keterangan | Garis putus-putus: proyeksi dari rata-rata pengeluaran harian dan tagihan terjadwal sampai [tanggal]. |
| Grafik saldo, legenda | Saldo likuid / Proyeksi saldo |
| Grafik saldo, tabel | Saldo likuid harian [periode]: Tanggal / Saldo likuid / Keterangan (Aktual, Proyeksi) |
| Grafik saldo, tombol rumus (aria) | Cara menghitung saldo likuid harian |
| Kategori, judul | Pengeluaran per kategori |
| Kategori, kosong | Belum ada pengeluaran |
| Kategori, tautan | Lihat semua kategori di Laporan |
| Kategori, pemisah pemilik | Warna pemilik |
| Tren, judul dan tautan | Tren 12 bulan / Buka Laporan |
| Anggaran, judul | Anggaran / Semua anggaran |
| Anggaran, kosong | Belum ada anggaran bulan ini. / Belum ada anggaran [periode]. / Atur anggaran |
| Anggaran, baris | Sesuai / Mendekati / Lewat, lebih cepat dari biasa · [persen] / [Rp] dari [Rp] · sisa [Rp] / · lewat [Rp] |
| Anggaran, tanpa nominal | belum ada nominal |
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
| Kesehatan, status | Aman / Pantau / Perlu dicek |
| Kesehatan, cek | Dana darurat / Rasio tabungan / Rasio cicilan / Tagihan lewat jatuh tempo |
| Wawasan, judul | Wawasan minggu ini |
| Wawasan, kosong | Belum ada transaksi 7 hari terakhir untuk dirangkum. |
| Wawasan, kategori naik | Pengeluaran [nama] 7 hari terakhir [Rp], naik [Rp] dari 7 hari sebelumnya. |
| Wawasan, kategori baru | Pengeluaran [nama] 7 hari terakhir [Rp], sebelumnya tidak ada. |
| Wawasan, anggaran lewat | Anggaran [nama] sudah lewat, terpakai [persen]. |
| Wawasan, anggaran cepat | Anggaran [nama] sudah terpakai [persen], padahal bulan baru berjalan [persen]. |
| Wawasan, total minggu | Total pengeluaran 7 hari terakhir [Rp] dari [n] transaksi. |
| Wawasan, tagihan | Tagihan [nama] [Rp] jatuh tempo [3 hari lagi]. |
| Wawasan mingguan (job), kategori naik | Pengeluaran [nama] minggu lalu [Rp], naik [persen] dari rata-rata 4 minggu sebelumnya [Rp] per minggu. |
| Wawasan mingguan (job), kategori baru | Pengeluaran [nama] minggu lalu [Rp], 4 minggu sebelumnya tidak ada. |
| Wawasan mingguan (job), anggaran lewat | Anggaran wajib [nama] sudah lewat, terpakai [persen]. |
| Wawasan mingguan (job), anggaran cepat | Anggaran wajib [nama] sudah terpakai [persen], padahal bulan baru berjalan [persen]. |
| Wawasan mingguan (job), tagihan | Tagihan [nama] [Rp] jatuh tempo [12 Okt]. |
| Wawasan mingguan (job), total minggu | Total pengeluaran minggu lalu [Rp] dari [n] transaksi. |
| Wawasan mingguan (AI) | Kalimat AI hanya diterima dengan placeholder; angka, nama, dan tanggal disisipkan kode. Ditolak (digit, kata bilangan, %, Rp, tanda seru, emoji, sapaan) → templat di atas. |
| Wawasan, tautan | Lihat transaksi |
| Cara menghitung, judul | Cara menghitung [metrik] |
| Cara menghitung, keterangan | Dihitung Kas Kita dari data kalian, bukan AI. |
| Cara menghitung, baris hasil | Hasil |

### Laporan

| Elemen | Copy |
|---|---|
| Navigasi bulan | Pilih bulan / Bulan sebelumnya, [bulan] / Bulan berikutnya, [bulan] |
| Tombol | Unduh CSV / Cetak / simpan PDF |
| Ringkasan, judul | Ringkasan [periode], dibanding [periode] |
| Ringkasan, label | Pemasukan / Pengeluaran / Selisih / Rasio tabungan [persen] |
| Ringkasan, tanpa pemasukan | Belum ada pemasukan periode ini |
| Ringkasan, perubahan kosong | Tidak ada pembanding di [periode] |
| Kategori, perubahan kosong | Tidak ada pembanding di [periode] |
| Kategori, judul | Pengeluaran per kategori / Pemasukan per kategori |
| Kategori, kosong | Belum ada pengeluaran [periode]. / Belum ada pemasukan [periode]. |
| Kategori, porsi | [persen] dari total |
| Tren, judul | Tren 12 bulan |
| Tren, kalimat | Pemasukan lebih besar dari pengeluaran di semua [n] bulan tercatat / Pengeluaran melebihi pemasukan di [n] dari [n] bulan tercatat / Belum ada transaksi 12 bulan terakhir |
| Tren, tabel | Pemasukan dan pengeluaran 12 bulan: Bulan / Pemasukan / Pengeluaran / Selisih |
| Cetak, judul | Laporan keuangan [periode] |
| Cetak, keterangan | Cakupan [cakupan] · periode [periode], dibanding [periode] · dicetak [tanggal] |
| Cetak, kolom | Kategori / Nominal / Porsi / Perubahan (— kalau tidak ada pembanding) |
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
| Kategori sistem | Kategori sistem: [nama] dan [nama] dipakai Kas Kita untuk transfer antar akun dan pencocokan saldo, jadi tidak bisa diubah atau diarsipkan. |
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
| Keamanan | Ganti password untuk masuk ke Kas Kita. Perangkat lain yang sedang masuk akan dikeluarkan. |
| Keamanan, label | Password sekarang / Password baru / Ulangi password baru |
| Keamanan, petunjuk | Minimal [n] karakter. |
| Keamanan, tombol | Ganti password |
| Keamanan, toast | Password diganti. Perangkat lain sudah dikeluarkan. |
| Keamanan, error | Isi password sekarang. / Password sekarang salah. / Password baru harus berbeda dari password sekarang. / Password gagal diganti. Muat ulang halaman lalu coba lagi. |
| Ekspor | Satu file zip berisi data.json (akun, transaksi, kategori, anggaran, tagihan, target, dan riwayat perubahan) beserta lampiran struk. Data login dan API key tidak ikut. |
| Ekspor, tombol | Ekspor semua data |
| Ekspor, lampiran hilang | Lampiran ini tidak ditemukan di penyimpanan saat ekspor. |
| Notifikasi | Kabar selalu muncul di panel Notifikasi. Aktifkan notifikasi perangkat supaya kabarnya juga sampai saat Kas Kita tertutup. |
| Notifikasi, status | Memeriksa perangkat ini / Belum aktif di perangkat ini. / Aktif di perangkat ini. |
| Notifikasi, privasi | Notifikasi perangkat tidak memuat nominal karena bisa terbaca di layar kunci. Detailnya ada di Kas Kita. |
| Notifikasi, tombol | Aktifkan notifikasi di perangkat ini / Matikan |
| Notifikasi, toast | Notifikasi perangkat aktif / Notifikasi perangkat dimatikan / Notifikasi perangkat belum bisa diaktifkan. Coba lagi. |
| Notifikasi, server belum siap | Notifikasi perangkat belum disiapkan di server ini. Kabar tetap muncul di panel Notifikasi. |
| Notifikasi, iPhone dan iPad | Di iPhone dan iPad, notifikasi perangkat hanya jalan setelah Kas Kita dipasang ke layar utama (iOS 16.4 ke atas). Di Safari, buka menu Bagikan, pilih Tambah ke Layar Utama, lalu buka Kas Kita dari ikon itu. |
| Notifikasi, tidak didukung | Browser ini belum mendukung notifikasi perangkat. Kabar tetap muncul di panel Notifikasi. |
| Notifikasi, service worker belum siap | Notifikasi perangkat belum siap di halaman ini. Muat ulang halaman lalu coba lagi. |
| Notifikasi, izin ditolak | Izin notifikasi untuk Kas Kita ditolak di browser ini. Izinkan notifikasi di pengaturan situs browser, lalu muat ulang halaman ini. |
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
| Langkah 2 | Akun pertama: Mulai dari akun yang paling sering kamu pakai, dengan saldonya hari ini. |
| Langkah 2, sudah ada | Sudah ada [n] akun. Tambahkan lagi kalau ada yang belum tercatat. |
| Langkah 2, label | Nama akun / Jenis / Pemilik / Saldo hari ini |
| Langkah 2, pemilik | Kamu / [nama] / Bersama |
| Langkah 2, placeholder | BCA gaji |
| Langkah 2, petunjuk saldo | Lihat di aplikasi bank atau e-wallet. Bisa dicocokkan lagi nanti. |
| Langkah 2, petunjuk utang | Tulis sisa utangnya. Kas Kita mencatatnya sebagai kewajiban. |
| Langkah 2, error | Isi nama akun / Isi saldo hari ini, misalnya 1,5jt |
| Langkah 2, tombol | Tambah akun |
| Langkah 2, toast | [nama] ditambahkan |
| Langkah 2, daftar (aria) | Akun yang baru ditambahkan |
| Langkah 3 | Pengaturan AI: Opsional. Semua fitur pencatatan tetap jalan tanpa AI. |
| Langkah 3, isi | Pencatatan tetap jalan tanpa AI. Ketik misalnya "kopi 25rb gopay" di bar bawah dan Kas Kita membacanya sendiri. |
| Langkah 3, status sementara | Membaca foto struk dengan AI belum tersedia di versi ini. Langkah ini dilewati dulu. |
| Tombol langkah | Lanjut / Lewati / Selesai |

### Notifikasi

| Elemen | Copy |
|---|---|
| Judul | Notifikasi |
| Tombol | Tandai semua dibaca |
| Memuat | Memuat notifikasi |
| Gagal memuat | Notifikasi belum bisa dimuat. / Coba lagi |
| Kosong, panel | Belum ada notifikasi. Kabar muncul di sini saat [nama] mengubah data milikmu, tagihan jatuh tempo 3 hari lagi, atau anggaran wajib lewat. / Tanpa partner: Belum ada notifikasi. Kabar muncul di sini saat tagihan jatuh tempo 3 hari lagi atau anggaran wajib lewat. |
| Kosong, tombol shell | Belum ada notifikasi. |
| Daftar (aria) | Daftar notifikasi |
| Belum dibaca (aria) | Belum dibaca. |
| Waktu | Baru saja / [n] menit lalu / [tanggal] [waktu] |
| Perubahan oleh partner | [nama] mengubah [objek]. / [nama] mengubah [objek]: [nilai] menjadi [nilai]. / [nama] menghapus [objek]. / [nama] memulihkan [objek]. |
| Objek | [jenis] [tanggal] / nilai [nama] [tanggal] |
| Cadangan, partner | [nama] mengubah data milikmu. / Ada perubahan pada data milikmu. (kalau nama tidak ada) |
| Cadangan, tagihan | Ada tagihan yang jatuh tempo 3 hari lagi. |
| Cadangan, anggaran | Ada anggaran wajib yang lewat. |
| Cadangan, berulang | Ada transaksi berulang yang menunggu konfirmasi. |
| Notifikasi perangkat (web push), judul | Kas Kita |
| Notifikasi perangkat, isi | Tanpa nominal (docs/decisions/0011): [nama] mengubah [objek]. / [nama] menghapus [objek]. / [nama] memulihkan [objek]. / kalimat Cadangan untuk jenis lain / Ada notifikasi baru. (isi push rusak) |

### Impor mutasi

| Elemen | Copy |
|---|---|
| PDF, error kosong | File kosong. Pilih file e-statement PDF. |
| PDF, error terlalu besar | File lebih dari 20 MB. Unduh e-statement per bulan lalu unggah satu per satu. |
| PDF, error bukan PDF | File ini bukan PDF. Pilih file e-statement berformat PDF. |
| PDF, error rusak | PDF ini tidak bisa dibuka. Unduh ulang e-statement dari bank lalu coba lagi. |
| PDF, error tanpa teks | PDF ini berisi gambar tanpa teks, jadi tidak bisa dibaca. Unduh e-statement versi teks dari bank atau impor CSV. |
| PDF AI, error terlalu banyak halaman | PDF ini lebih dari 30 halaman. Unduh e-statement per bulan lalu baca dengan AI satu per satu. |
| PDF AI, gagal tanpa baris | Model AI tidak menemukan baris transaksi di PDF ini. Coba impor CSV atau isi transaksi sendiri. |
| PDF AI, antrean gagal | Pembacaan dengan AI belum bisa dimulai. Coba lagi sebentar lagi. |
| Unggah, judul halaman dan tombol di Akun | Impor mutasi |
| Unggah, keterangan | Unggah mutasi CSV dari internet banking atau e-statement PDF. Semua baris kamu tinjau dulu sebelum masuk ke Transaksi. |
| Unggah, bagian | Akun tujuan / File mutasi |
| Unggah, akun bertemplat | Templat [nama] tersimpan |
| Unggah, area file | Seret file CSV atau PDF ke sini / Pilih file CSV atau PDF (layar sentuh) |
| Unggah, area file, petunjuk | Mutasi dari internet banking atau e-statement, maksimal 20 MB. PDF berpassword akan dimintai password-nya. |
| Unggah, tombol | Pilih file / Ganti file / Unggah |
| Unggah, petunjuk tombol | Pilih akun tujuan dan file mutasi. / Pilih file mutasi. |
| Unggah, progres | Mengunggah [n]% / Membaca mutasi… |
| Unggah, kosong | Belum ada akun untuk menerima mutasi: Mutasi diimpor ke akun bank, e-wallet, atau kartu kredit. Tambahkan akunnya dulu, lalu kembali ke sini. Tombol: Tambah akun |
| Unggah, password PDF | PDF ini berpassword: Password hanya dipakai untuk membuka file ini sekali dan tidak disimpan. Label: Password e-statement. Tombol: Batal / Buka PDF |
| Unggah, PDF tidak dikenali tanpa AI | Format mutasi ini belum dikenali. Coba impor CSV, atau pasang model AI di Pengaturan supaya PDF ini bisa dibaca dengan AI. Tombol: Buka pengaturan AI |
| Unggah, PDF tidak dikenali, tombol | Baca dengan AI |
| Unggah, error | File kosong. Pilih file CSV atau PDF mutasi dari bank. / File lebih dari 20 MB. Unduh mutasi per bulan lalu unggah satu per satu. / Pilih akun tujuan dulu. / File ini bukan CSV atau PDF. Pilih file mutasi dari bank. / File Excel belum bisa dibaca. Simpan sebagai CSV dari Excel lalu unggah lagi. / File ini tidak terbaca sebagai tabel CSV. Pilih file CSV atau PDF mutasi dari bank. / Impor mutasi hanya untuk akun bank, e-wallet, atau kartu kredit. Pilih akun lain. |
| Sudah diimpor, tautan | Lihat hasil impornya. (kalimat terakhir pesan "File sudah pernah diimpor" jadi tautan) |
| Pemetaan, keterangan | Petakan kolom mutasi untuk [nama] ([nama]). Pratinjau di bawah berubah mengikuti pilihanmu. / Unggah file lain |
| Pemetaan, dari templat | Pemetaan diisi dari templat [nama]. Ada baris yang tidak terbaca; cek daftarnya sebelum lanjut. |
| Pemetaan, petakan ulang | File ini sudah pernah dipetakan. Menerapkan pemetaan baru mengganti baris di layar tinjau. |
| Pemetaan, bagian | Isi file / Kolom / Hasil baca |
| Pemetaan, label | Baris header / Kolom tanggal / Format tanggal / Kolom deskripsi / Nominal / Kolom debit (keluar) / Kolom kredit (masuk) / Kolom nominal / Pemisah desimal / Kolom saldo (opsional) / Kolom jam (opsional) / Encoding / Pemisah kolom |
| Pemetaan, petunjuk | Baris berisi nama kolom. Baris di atasnya dilewati. / Terdeteksi dari isi kolom. Ubah kalau tanggalnya terbaca salah. / Akhiran CR dan DB dibaca otomatis sebagai masuk dan keluar. / Ganti kalau huruf seperti é tampil rusak. |
| Pemetaan, pilihan | Pilih kolom / Tidak dipakai / Tanpa baris header / Baris [n]: [isi] / Debit dan kredit / Satu kolom / Positif berarti masuk / Positif berarti keluar / Koma: 1.250.000,00 / Titik: 1,250,000.00 / Koma / Titik koma / Tab / UTF-8 / Windows-1252 (Excel lama) / Encoding dan pemisah kolom |
| Pemetaan, format tanggal | 31/12/2026 (hari/bulan/tahun) / 31-12-2026 (hari-bulan-tahun) / 2026-12-31 (tahun-bulan-hari) / 31 Des 2026 (nama bulan) / 12/31/2026 (bulan/hari/tahun) |
| Pemetaan, peran kolom | Tanggal / Deskripsi / Nominal / Debit / Kredit / Saldo / Jam |
| Pemetaan, isi file kosong | Tidak ada baris di bawah baris header. Pilih baris header lain. |
| Pemetaan, hasil | [n] baris terbaca · [n] baris dilewati / Tanpa deskripsi |
| Pemetaan, baris dilewati | [n] baris dilewati / Baris [n]: [alasan] / Menampilkan [n] dari [n] baris yang dilewati. |
| Pemetaan, baris dilewati, penjelasan | Baris ini tidak ikut diimpor. Kalau seharusnya transaksi, cek format tanggal, pemisah desimal, atau kolom nominal. / Baris ringkasan dan transaksi tertunda tidak ikut diimpor. Transaksi tertunda muncul di mutasi berikutnya setelah dibukukan bank. |
| Pemetaan, alasan dilewati | Tanggal "[isi]" tidak cocok dengan format [format] / Tanggal kosong / Transaksi masih tertunda di bank / Baris ringkasan, bukan transaksi / Nominal kosong / Nominal nol / Nominal "[isi]" tidak terbaca dengan pemisah desimal koma (titik) / Debit "[isi]" … / Kredit "[isi]" … / Debit dan kredit sama-sama terisi / Debit dan kredit kosong |
| Pemetaan, error | Pilih kolom tanggal / Pilih kolom deskripsi / Pilih kolom debit dan kredit, atau satu kolom nominal / Kolom debit dan kredit harus berbeda / Kolom "[nama]" tidak ada di file ini. Pilih ulang kolomnya. / Tidak ada baris yang terbaca dengan pemetaan ini. Cek kolom tanggal, format tanggal, dan kolom nominal. / File mutasi ini sudah tidak tersimpan. Unggah file-nya lagi. / Impor ini sudah tidak bisa dipetakan ulang. Unggah file mutasi lagi. |
| Pemetaan, tidak bisa dibuka | Pemetaan tidak bisa dibuka: [pesan]. Tombol: Unggah file mutasi |
| Pemetaan, templat | Simpan sebagai templat untuk [nama]: Impor CSV berikutnya dari [nama] langsung memakai pemetaan ini. / Akun ini tanpa institusi, jadi pemetaan tidak bisa disimpan sebagai templat. |
| Pemetaan, tombol | Lanjut ke tinjau |
| Tinjau, judul | Tinjau mutasi [akun] / [n] baris dari CSV (PDF, PDF, dibaca AI), [tanggal] sampai [tanggal] |
| Tinjau, kelompok | Baru ([n]) / Kemungkinan duplikat ([n]) / Duplikat pasti ([n]) |
| Tinjau, keterangan Baru | Belum ada di Kas Kita. Kategori diisi dari transaksi serupa sebelumnya; cek sebelum mengimpor. |
| Tinjau, keterangan Kemungkinan duplikat | Akun dan nominal sama dengan transaksi yang sudah tercatat, tanggalnya berselisih paling lama 2 hari. Tidak diimpor sampai kamu memilih. |
| Tinjau, Duplikat pasti terlipat | Duplikat pasti ([n]) / sudah pernah diimpor, tidak diimpor lagi |
| Tinjau, centang semua | Centang semua baris baru / [n] dari [n] |
| Tinjau, kolom | Tanggal / Deskripsi / Kategori dan untuk siapa / Nominal |
| Tinjau, placeholder kategori | Pilih kategori |
| Tinjau, pembanding | Dari mutasi / Sudah tercatat / Tanggal sama / Selisih [n] hari / diisi oleh [nama] |
| Tinjau, keputusan duplikat | Sama, tautkan / Beda, impor sebagai baru / Lewati |
| Tinjau, aria | Impor [deskripsi], [tanggal], keluar (masuk) Rp [x] / Kategori untuk [deskripsi] / Untuk siapa: [deskripsi] / Keputusan untuk [deskripsi] / Baris baru / Kemungkinan duplikat |
| Tinjau, ringkasan | [n] diimpor · [n] ditautkan · [n] dilewati / Centang baris yang ingin diimpor. |
| Tinjau, tombol | Impor [n] transaksi / Tautkan [n] transaksi / Batalkan impor |
| Tinjau, error kategori | Pilih kategori untuk [n] transaksi yang dicentang. / Pilih kategori (per baris) |
| Tinjau, peringatan AI | Mutasi ini dibaca model AI. Cek tanggal, deskripsi, dan nominal setiap baris sebelum mengimpor. |
| Tinjau, saldo tidak cocok | Saldo berjalan tidak cocok di [n] baris. Baris itu ditandai Perlu dicek; bandingkan dengan file mutasi sebelum mengimpor. / Perlu dicek (badge baris) |
| Tinjau, toast | [n] transaksi diimpor / [n] transaksi ditautkan / [n] transaksi diimpor, [n] ditautkan |
| Tinjau, dialog batal | Batalkan impor ini? / Baris dan pilihan di layar ini dihapus. File mutasinya bisa diunggah lagi kapan saja. / Kembali / Batalkan impor |
| Tinjau, membaca | Membaca mutasi… / Model AI membaca mutasi per halaman. Biasanya kurang dari dua menit. Halaman ini diperbarui sendiri. / Baris mutasi sedang dibaca dan dicocokkan dengan transaksi yang sudah tercatat. Halaman ini diperbarui sendiri. |
| Tinjau, gagal | Mutasi ini gagal dibaca / [pesan error batch] atau File tidak bisa dibaca. Cek formatnya lalu unggah lagi. Tombol: Unggah file lain |
| Tinjau, sudah disimpan | Impor ini sudah disimpan: Transaksinya ada di daftar transaksi dengan filter impor ini. Tombol: Lihat transaksi |
| Tinjau, tidak ditemukan | Impor ini tidak ditemukan: Impor ini mungkin sudah dibatalkan. Unggah file mutasi lagi untuk memulai. Tombol: Impor mutasi |
| Tinjau, file tanpa baris | File ini tidak berisi transaksi: Tidak ada baris mutasi yang terbaca. Cek rentang tanggal di file, lalu unggah lagi. Tombol: Unggah file lain |
| Tinjau, error domain | Impor ini sudah disimpan. Lihat hasilnya di daftar transaksi. / Impor ini belum siap ditinjau. Tunggu sebentar lalu muat ulang halaman. / Transaksi pembanding sudah berubah atau dihapus. Pilih Beda, impor sebagai baru, atau muat ulang halaman. / Impor ini tidak ditemukan, mungkin sudah dibatalkan. Unggah file mutasi lagi. / Baris impor tidak ditemukan. Muat ulang halaman lalu coba lagi. / Baris ini tidak punya transaksi pembanding. / File ini berisi lebih dari 5000 baris. Pecah per bulan lalu impor satu per satu. / Baris [n] di file belum terbaca. Cek format file lalu unggah lagi. |

### Error domain

| Situasi | Copy |
|---|---|
| Error server umum | Terjadi kesalahan di server. Coba lagi sebentar lagi. |
| Ubah nominal atau jenis transaksi yang dipecah per kategori | Transaksi ini dipecah ke beberapa kategori, jadi nominal dan jenisnya tidak bisa diubah dari sini. Hapus transaksi lalu catat ulang dari foto struk, atau ubah kategori dan catatannya saja. |
| Data tidak ditemukan | [Subjek] tidak ditemukan, mungkin sudah dihapus. Muat ulang halaman lalu coba lagi. |
| Konflik edit, umum | [Subjek] baru diubah [nama] pukul [waktu]. Pilih versi yang dipakai. |
| Subjek konflik dan tidak ditemukan | Transaksi ini, Akun ini, Kategori ini, Anggaran ini, Tagihan ini, Target ini, Setoran ini, Nilai ini, Pengguna ini, Data ini |
| Validasi umum | Ada isian yang belum benar. Cek bagian yang ditandai lalu simpan lagi. |
| Format tanggal | Tanggal belum terbaca. Pilih tanggal lagi. |
| Nominal kosong | Isi nominal, misalnya 25rb |
| Saldo tidak cukup | Saldo [nama] tinggal [Rp]. Kurangi nominal atau catat dari akun lain. |
| Akun, nama kosong | Isi nama akun |
| Akun, pemilik | Pilih pemilik akun: kamu, [nama], atau Bersama. / Pilih pemilik akun: kamu atau Bersama. (tanpa partner) |
| Akun, saldo awal tunai | Saldo awal Tunai tidak boleh negatif |
| Akun, hapus ditolak | Akun ini punya transaksi, jadi tidak bisa dihapus. Arsipkan supaya riwayatnya tetap ada. |
| Cocokkan, saldo negatif | Saldo [nama] tidak boleh negatif |
| Transaksi, akun hilang | Akun tidak ditemukan. Pilih akun lain. |
| Transaksi, kategori hilang | Kategori tidak ditemukan. Pilih kategori lain. |
| Transaksi, kategori salah jenis | Kategori tidak cocok dengan jenis transaksi |
| Transaksi, transfer | Pilih akun tujuan transfer / Akun tujuan harus berbeda dari akun asal |
| Transaksi, pulihkan kedaluwarsa | Transaksi ini dihapus lebih dari 30 hari lalu dan tidak bisa dipulihkan. |
| Tagihan, nama kosong | Isi nama tagihan |
| Tagihan, pengulangan | Pengulangan tidak dikenali. Pilih Bulanan, Mingguan, atau Tahunan. |
| Tagihan, kategori | Pilih kategori tagihan |
| Tagihan, tidak ada nominal | Tidak ada nominal yang perlu dibayar untuk periode ini. |
| Tagihan, sudah dibayar | Tagihan periode ini sudah dibayar. |
| Anggaran, pemilik | Pemilik anggaran tidak dikenal. Pilih pemilik lagi. |
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
| Sesi, tidak ditemukan | Sesi ini sudah berakhir. Muat ulang halaman untuk melihat daftar terbaru. |
| Sesi habis | Sesimu berakhir. Masuk lagi untuk melanjutkan. |

Pesan CLI `user:create` (dibaca admin di terminal, bukan di app): "Email tidak valid.", "Nama tidak boleh kosong.", "Nama maksimal 40 karakter.", "Tanggal gajian 1 sampai 31.", "Warna harus salah satu dari: [warna].", "Warna [warna] sudah dipakai pengguna lain. Pilih salah satu: [warna].", "Semua warna identitas sudah dipakai.", "Kas Kita sudah punya dua pengguna. Pengguna ketiga tidak bisa dibuat.", "Email [email] sudah terdaftar. Pakai --link untuk membuat tautan pendaftaran baru.", "Pengguna gagal dibuat.", "Belum ada pengguna dengan email [email]."

## 5. Temuan audit copy

Hasil audit teks di kode terhadap bagian 1 sampai 4, per 24 Sep 2026. Urutan tabel sesuai prioritas: yang paling atas paling perlu diperbaiki. Setelah usulan diterapkan, perbarui tabel per area di bagian 4 lalu hapus barisnya dari sini.

| Lokasi | Teks sekarang | Masalah | Usulan |
|---|---|---|---|

Semua 29 temuan audit 24 Sep 2026 sudah diterapkan dan tabel di bagian 4 sudah diperbarui.

Tidak ditemukan: emoji, tanda seru di pesan sistem, sapaan selain "kamu", label kapital semua, istilah "Rekonsiliasi", "mode", "view", "goal", "bill", atau "joint" di teks yang tampil. Istilah "Cocokkan saldo" dan "pencocokan" sudah konsisten.
