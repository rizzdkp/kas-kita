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
