# 0013 Wawasan mingguan (F-AI-2) dan realtime SSE

## Konteks

DATA-MODEL hanya menyebut `insights.scope` sebagai teks. Cakupan Saya dan Partner relatif terhadap viewer, jadi nilai `me` saja tidak cukup untuk baris yang dibuat job tanpa viewer. PRD F-AI-2 AC2 menuntut angka di kalimat tidak ditulis AI. ARCHITECTURE 8 meminta SSE dari LISTEN/NOTIFY tanpa merinci titik publikasi.

## Keputusan

- `insights.scope` berisi `me:<user id>` atau `all`. Partner dibaca dari baris `me:<id partner>`. `week_start` = Senin minggu yang dirangkum. Dashboard membaca baris dengan `week_start` = Senin minggu lalu. Kalau barisnya belum ada, dashboard menghitung templat 7 hari terakhir seperti sebelumnya.
- Fakta dihitung kode: kategori dengan kenaikan rupiah terbesar dibanding rata-rata mingguan 4 minggu sebelumnya, anggaran wajib yang lewat atau lajunya lebih cepat (dihitung saat job berjalan), tagihan yang jatuh tempo dalam 7 hari sejak job berjalan, dan total pengeluaran minggu lalu. Paling banyak 3 fakta, dengan urutan prioritas seperti daftar tadi.
- AI tidak menerima nilai fakta. Model hanya menerima nama placeholder dan artinya, lalu mengembalikan kalimat ber-placeholder. Kode menolak kalimat yang mengandung digit, `%`, kata bilangan atau satuan (`dua`, `ribu`, `persen`, `Rp`), placeholder asing, atau placeholder wajib yang tidak dipakai. Kode juga menolak tanda seru, emoji, dan sapaan. Kalimat yang ditolak diganti templat untuk wawasan itu saja.
- Wawasan dibuat sistem: tidak punya aktor dan versi, jadi tidak ditulis ke `audit_log`. Job mengganti baris per cakupan per minggu sehingga aman dijalankan ulang.
- `writeAudit` memanggil `publishChange`, yaitu `pg_notify('kaskita_changes', {entity, id})`, di dalam transaksi mutasi. Postgres mengirim NOTIFY saat commit dan membuangnya saat rollback. Setiap proses server memakai satu koneksi LISTEN bersama.
- Klien menunda `router.refresh()` selama Dialog atau Sheet terbuka, atau selama kolom yang fokus berisi perubahan yang belum disimpan. Refresh juga ditunda selama tab tersembunyi.

## Konsekuensi

- Semua mutasi yang menulis audit otomatis memicu refresh di layar lain, tanpa perubahan di tiap mutasi.
- Kalimat AI bisa lebih kaku, karena kata bilangan apa pun ditolak. Pilihan ini sengaja diambil supaya AC2 tidak bisa dilanggar.
