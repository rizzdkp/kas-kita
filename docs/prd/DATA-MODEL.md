# Model data

Database: PostgreSQL 16. ORM: Drizzle. Semua tabel memakai `id uuid` (UUIDv7 supaya urut waktu), `created_at timestamptz`, `updated_at timestamptz`.

## 1. Aturan global

1. Nominal uang: `bigint`, satuan rupiah. Tidak ada `numeric`, `float`, atau `real` untuk uang.
2. Tanda nominal di transaksi selalu positif. Arah ditentukan kolom `kind` dan akun asal/tujuan.
3. Waktu disimpan `timestamptz` UTC. Pengelompokan per hari dan bulan memakai `AT TIME ZONE 'Asia/Jakarta'`.
4. Semua tabel data pengguna punya `version integer not null default 1`. Setiap update wajib `WHERE id = $1 AND version = $2` dan menaikkan versi. Nol baris terdampak berarti konflik (PRD F-HIST-3).
5. Hapus bersifat lunak: `deleted_at timestamptz`. Job harian menghapus permanen baris yang dihapus lebih dari 30 hari.
6. Setiap insert, update, dan delete pada tabel bertanda **[audit]** menulis ke `audit_log` di transaksi database yang sama.

## 2. Tabel

### users

| Kolom | Tipe | Catatan |
|---|---|---|
| id | uuid | |
| email | text unique | |
| display_name | text | Nama yang tampil di toggle cakupan |
| identity_color | text | Kunci warna dari `DESIGN.md` bagian 6, bukan hex |
| payday_day | smallint | 1-31. Tanggal yang tidak ada di bulan itu jatuh ke hari terakhir. |
| period_mode | text | `calendar` atau `payday_cycle` |

Batasan: aplikasi menolak membuat user ketiga (cek di perintah CLI dan constraint trigger).

Tabel sesi, passkey, dan TOTP mengikuti skema library auth (`ARCHITECTURE.md` bagian 2).

### accounts [audit]

| Kolom | Tipe | Catatan |
|---|---|---|
| owner_id | uuid null | `NULL` berarti Bersama |
| name | text | |
| type | text | `bank`, `ewallet`, `cash`, `credit_card`, `paylater`, `loan`, `investment`, `other_asset` |
| institution_id | uuid null | FK ke `institutions` |
| opening_balance | bigint | Boleh negatif untuk utang |
| opening_date | date | |
| allow_negative | boolean | Default false. Tidak berlaku untuk `cash`. |
| credit_limit | bigint null | Kartu kredit dan paylater |
| statement_day | smallint null | Tanggal cetak tagihan |
| due_day | smallint null | Tanggal jatuh tempo |
| archived_at | timestamptz null | |
| sort_order | integer | |

Saldo tidak disimpan di tabel ini. Saldo dihitung: `opening_balance + sum(masuk) - sum(keluar)` sejak `opening_date`. Materialized view `account_balances` diperbarui oleh trigger pada tabel `transactions` untuk performa.

### institutions

| Kolom | Tipe | Catatan |
|---|---|---|
| name | text | "BCA", "Bank Jago", "GoPay" |
| slug | text unique | Dipakai parser PDF |
| kind | text | `bank`, `ewallet`, `other` |

### categories [audit]

| Kolom | Tipe | Catatan |
|---|---|---|
| name | text | |
| kind | text | `income` atau `expense` |
| parent_id | uuid null | Maksimal dua tingkat |
| icon | text | Nama ikon dari set ikon di `DESIGN.md` |
| is_system | boolean | "Penyesuaian saldo", "Transfer" tidak bisa dihapus |
| archived_at | timestamptz null | |

Kategori milik rumah tangga, dipakai bersama. Seed awal ada di bagian 4.

### transactions [audit]

| Kolom | Tipe | Catatan |
|---|---|---|
| kind | text | `income`, `expense`, `transfer` |
| amount | bigint | Selalu > 0 |
| account_id | uuid | Akun asal untuk expense dan transfer, akun tujuan untuk income |
| to_account_id | uuid null | Wajib untuk transfer, null selain itu |
| category_id | uuid null | Wajib untuk income dan expense |
| occurred_at | timestamptz | |
| note | text null | |
| beneficiary | text | `owner`, `partner_of_owner`, `shared`. Untuk siapa pengeluaran ini. |
| status | text | `confirmed`, `draft` (dari jadwal berulang atau impor yang belum ditinjau) |
| source | text | `manual`, `quick_add`, `receipt`, `import_csv`, `import_pdf`, `recurring`, `adjustment` |
| recurring_id | uuid null | |
| import_row_id | uuid null | Tautan ke baris impor asal |
| created_by | uuid | |
| updated_by | uuid | |
| version | integer | |
| deleted_at | timestamptz null | |

Pemilik transaksi tidak disimpan. Pemilik selalu `accounts.owner_id` dari `account_id`. Ini mencegah data pemilik tidak sinkron saat pemilik akun berubah.

Index: `(account_id, occurred_at desc)`, `(category_id, occurred_at)`, `(occurred_at)`, GIN trigram pada `note`.

Constraint:
- `kind = 'transfer'` wajib `to_account_id is not null and to_account_id <> account_id and category_id is null`.
- `kind <> 'transfer'` wajib `to_account_id is null and category_id is not null`.

### transaction_splits [audit]

Satu transaksi struk bisa dipecah ke beberapa kategori.

| Kolom | Tipe | Catatan |
|---|---|---|
| transaction_id | uuid | |
| category_id | uuid | |
| amount | bigint | Jumlah semua split wajib sama dengan `transactions.amount` (dicek di trigger deferred) |
| note | text null | |

### tags, transaction_tags

Tag bebas, dipakai bersama. Relasi many-to-many.

### attachments [audit]

| Kolom | Tipe | Catatan |
|---|---|---|
| transaction_id | uuid null | Null selama masih di pratinjau |
| storage_key | text | Path relatif di volume lampiran |
| mime | text | |
| size_bytes | integer | |
| sha256 | text | |
| uploaded_by | uuid | |

### recurring_rules [audit]

| Kolom | Tipe | Catatan |
|---|---|---|
| template | jsonb | Field transaksi kecuali tanggal |
| rrule | text | Format RFC 5545 RRULE |
| next_run_on | date | |
| auto_confirm | boolean | |

### bills [audit]

| Kolom | Tipe | Catatan |
|---|---|---|
| owner_id | uuid null | Null = Bersama |
| name | text | |
| amount | bigint | |
| amount_is_estimate | boolean | |
| pay_from_account_id | uuid | |
| category_id | uuid null | |
| credit_card_account_id | uuid null | Diisi untuk tagihan kartu kredit, nominal dihitung otomatis |
| rrule | text | |
| next_due_on | date | |

`bill_payments`: `bill_id`, `period_start`, `transaction_id`, `paid_at`.

### budgets [audit]

| Kolom | Tipe | Catatan |
|---|---|---|
| scope_owner | text | `user:<uuid>` atau `shared` |
| category_id | uuid | |
| month | date | Tanggal 1 bulan terkait |
| amount | bigint | |
| is_mandatory | boolean | |

Unique: `(scope_owner, category_id, month)`. Anggaran bulan baru disalin otomatis dari bulan sebelumnya pada tanggal 1 pukul 00:05 WIB kalau belum ada.

### goals [audit]

| Kolom | Tipe | Catatan |
|---|---|---|
| owner_id | uuid null | |
| name | text | |
| target_amount | bigint | |
| deadline | date null | |
| linked_account_id | uuid null | |
| achieved_at | timestamptz null | |

`goal_contributions` untuk target tanpa akun penampung: `goal_id`, `amount`, `contributed_at`, `created_by`.

### investment_valuations [audit]

`account_id`, `valued_on date`, `market_value bigint`, `note`.

### import_batches, import_rows

| import_batches | Catatan |
|---|---|
| account_id | Akun tujuan impor |
| institution_id | |
| format | `csv`, `pdf`, `ai_pdf` |
| file_sha256 | Menolak file yang sama diimpor dua kali |
| status | `parsing`, `review`, `committed`, `failed` |
| error | text null |
| created_by | |

| import_rows | Catatan |
|---|---|
| batch_id | |
| row_hash | sha256 dari (institution, account, tanggal, deskripsi ternormalisasi, nominal bertanda) |
| raw | jsonb baris asli |
| parsed | jsonb hasil normalisasi |
| decision | `new`, `duplicate_of`, `skip` |
| matched_transaction_id | uuid null |

Unique parsial: `row_hash` untuk baris dengan `decision <> 'skip'` di batch yang `committed`. Ini dasar "Duplikat pasti".

### import_templates

`institution_id`, `name`, `mapping jsonb` (kolom tanggal, deskripsi, debit, kredit, format tanggal, baris header, encoding).

### ai_settings

Satu baris untuk rumah tangga.

| Kolom | Tipe | Catatan |
|---|---|---|
| base_url | text | |
| api_key_ciphertext | bytea | AES-256-GCM, lihat `SECURITY.md` |
| api_key_last4 | text | |
| text_model | text null | |
| vision_model | text null | |
| supports_json_schema | boolean null | Hasil deteksi saat tes koneksi |
| last_tested_at | timestamptz null | |
| updated_by | uuid | |

### ai_calls

Log pemakaian: `purpose` (`quick_add`, `receipt`, `pdf_extract`, `insight`), `model`, `input_tokens`, `output_tokens`, `latency_ms`, `ok boolean`, `error text`. Isi prompt dan respons tidak disimpan.

### insights

`scope`, `week_start`, `facts jsonb`, `text`, `source_transaction_ids uuid[]`, `generated_by` (`ai` atau `template`).

### notifications

`recipient_id`, `kind`, `payload jsonb`, `read_at`.

### audit_log

| Kolom | Tipe | Catatan |
|---|---|---|
| actor_id | uuid | |
| entity | text | Nama tabel |
| entity_id | uuid | |
| action | text | `insert`, `update`, `delete`, `restore` |
| diff | jsonb | `{field: [lama, baru]}` untuk update |
| at | timestamptz | |

Tabel ini append-only. Role database aplikasi hanya punya hak `INSERT` dan `SELECT` pada tabel ini.

## 3. Aturan cakupan di query

Semua query baca menerima parameter `scope`:

```sql
-- me: akun milik user login
accounts.owner_id = :current_user
-- partner: akun milik user lain
accounts.owner_id = :partner_user
-- all: semua akun
true
```

Di cakupan `me` dan `partner`, transfer ke atau dari akun di luar cakupan ditampilkan sebagai arus kas "Transfer keluar/masuk" dengan nama akun lawan. Transfer yang kedua ujungnya di dalam cakupan tidak muncul di arus kas.

Fungsi query dipusatkan di `src/server/queries/scope.ts`. Tidak boleh ada query transaksi yang menulis filter pemilik sendiri.

## 4. Seed kategori

Pengeluaran: Makan dan minum (Belanja dapur, Makan di luar, Kopi dan jajan), Transportasi (Bensin, Ojek dan taksi, Parkir dan tol), Rumah (Sewa atau cicilan, Listrik, Air, Internet), Tagihan dan langganan, Kesehatan, Pendidikan, Belanja pribadi, Hiburan, Hadiah dan donasi, Keluarga, Biaya bank dan admin, Pajak, Lainnya.

Pemasukan: Gaji, Bonus, Usaha sampingan, Hadiah, Bunga dan imbal hasil, Pengembalian dana, Lainnya.

Sistem: Penyesuaian saldo, Transfer.

Tidak ada kategori "Uang pribadi". Pengeluaran pribadi ditandai lewat `beneficiary`, bukan kategori.
