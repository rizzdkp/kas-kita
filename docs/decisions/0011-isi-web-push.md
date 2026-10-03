# 0011 Isi web push tanpa nominal, dan push dikirim lewat LISTEN/NOTIFY setelah commit

## Konteks

F-NOT-1 AC1 menambah web push opsional. Notifikasi dalam app menyimpan `payload.message` siap tampil, misalnya "Rizz mengubah Belanja dapur 12 Sep: Rp 185.000 menjadi Rp 158.000." Push tampil di layar kunci dan pusat notifikasi sistem operasi, yang bisa dibaca siapa pun yang memegang ponsel, dan isinya melewati layanan push Apple, Google, atau Mozilla (terenkripsi, tapi tetap di luar kendali kita). AGENTS.md aturan 5 juga melarang nominal masuk log.

Notifikasi dibuat di dalam transaksi database mutasi (`notifyOwners(tx, ...)`). Mengirim push dari dalam transaksi bisa mengirim kabar untuk data yang lalu di-rollback, dan kegagalan jaringan push tidak boleh menggagalkan mutasi.

## Keputusan

- Push berisi judul "Kas Kita" dan satu kalimat tanpa nominal: "[nama] mengubah [objek]." / "menghapus" / "memulihkan" untuk perubahan oleh partner, dan kalimat cadangan COPY.md untuk tagihan, anggaran, dan transaksi berulang. `payload.message` tidak pernah dipakai. Angka di nama atau label dibuang sebagai pengaman. Tautan membuka detail di app (misalnya `/transaksi?id=...`), tempat nominal tampil setelah login.
- `notifyOwners` memanggil `announceNotifications(tx, ids)` yang menjalankan `pg_notify('kaskita_push', ids)` di transaksi yang sama. Postgres hanya mengirim NOTIFY setelah commit dan membuangnya saat rollback (termasuk savepoint). Proses app mendengarkan kanal itu (`src/instrumentation.ts` → `startPushListener`), membaca notifikasi, dan memanggil `sendPushToUser`. Pengirim tidak pernah melempar; langganan yang dijawab 404/410 dihapus.
- Notifikasi yang dibuat worker (tagihan, anggaran, berulang) cukup memanggil `announceNotifications(tx, ids)` setelah insert; listener di proses app yang mengirimnya.
- Tanpa `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, dan `VAPID_SUBJECT` yang valid, listener tidak berjalan dan bagian Pengaturan → Notifikasi hanya menampilkan keterangan.

## Konsekuensi

- Pengguna harus membuka app untuk melihat nominal. Itu disengaja.
- Push hanya terkirim selama proses app hidup. NOTIFY yang datang saat app mati hilang; notifikasi dalam app tetap ada. Untuk dua pengguna di satu VPS ini cukup; kalau kelak perlu jaminan kirim, ganti dengan job pg-boss yang dikirim dalam transaksi (`send` dengan opsi `db`).
- Beberapa proses app yang mendengarkan database yang sama (misalnya beberapa dev server) masing-masing mengirim push. Produksi hanya menjalankan satu container app.
