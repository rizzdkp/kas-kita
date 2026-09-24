# Deploy ke VPS

## 1. Kebutuhan minimum

| Item | Minimum | Disarankan |
|---|---|---|
| RAM | 2 GB | 4 GB |
| CPU | 1 vCPU | 2 vCPU |
| Disk | 20 GB SSD | 40 GB SSD |
| OS | Ubuntu 24.04 LTS | |
| Domain | Satu subdomain, misalnya `kas.domainkamu.id` | |

Dengan 1 GB RAM, build Next.js di VPS akan gagal. Build image di mesin lokal atau GitHub Actions, lalu push ke registry.

## 2. Docker Compose

```yaml
services:
  caddy:
    image: caddy:2
    ports: ["80:80", "443:443"]
    volumes:
      - ./docker/Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data
    restart: unless-stopped

  app:
    image: ghcr.io/<user>/kas-kita:${APP_VERSION}
    env_file: .env
    command: ["node", "server.js"]
    volumes: ["attachments:/data/attachments"]
    depends_on: [db]
    restart: unless-stopped

  worker:
    image: ghcr.io/<user>/kas-kita:${APP_VERSION}
    env_file: .env
    command: ["node", "worker.js"]
    volumes: ["attachments:/data/attachments", "imports:/data/imports"]
    depends_on: [db]
    restart: unless-stopped

  db:
    image: postgres:16
    env_file: .env.db
    volumes: ["pgdata:/var/lib/postgresql/data"]
    restart: unless-stopped

volumes: { caddy_data: {}, attachments: {}, imports: {}, pgdata: {} }
```

Caddyfile:

```
kas.domainkamu.id {
  encode zstd gzip
  reverse_proxy app:3000
  header {
    # salin semua header dari SECURITY.md bagian 3, satu per baris
    Strict-Transport-Security "max-age=31536000; includeSubDomains"
  }
}
```

## 3. Variabel lingkungan

| Variabel | Isi |
|---|---|
| `DATABASE_URL` | Koneksi role aplikasi |
| `DATABASE_MIGRATION_URL` | Koneksi role migrasi |
| `APP_URL` | `https://kas.domainkamu.id` |
| `APP_ENCRYPTION_KEY` | 32 byte base64 (`openssl rand -base64 32`) |
| `AUTH_SECRET` | 32 byte base64 |
| `ATTACHMENTS_DIR` | `/data/attachments` |
| `TZ` | `Asia/Jakarta` |
| `RESTIC_REPOSITORY`, `RESTIC_PASSWORD`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | Backup |

## 4. Instalasi pertama

1. Pasang Docker, `ufw`, `fail2ban`, `unattended-upgrades`.
2. Arahkan DNS subdomain ke IP VPS.
3. Salin `compose.yml`, `Caddyfile`, `.env`, `.env.db`.
4. `docker compose up -d db`, lalu jalankan migrasi: `docker compose run --rm app node migrate.js`.
5. Buat dua akun: `docker compose run --rm app node scripts/create-user.js --email ... --name ...`. Perintah mencetak tautan sekali pakai untuk mendaftarkan passkey, berlaku 30 menit.
6. `docker compose up -d`.

## 5. Backup

Cron harian 02:30 WIB di host:

```sh
docker compose exec -T db pg_dump -Fc -U kaskita kaskita > /backup/db.dump
restic backup /backup/db.dump /var/lib/docker/volumes/kas-kita_attachments
restic forget --keep-daily 14 --keep-weekly 8 --keep-monthly 12 --prune
```

Uji restore setiap bulan dengan `scripts/restore-backup.sh` ke database sementara, lalu cek jumlah transaksi dan saldo satu akun.

## 6. Update

1. Build dan push image baru dengan tag versi.
2. Di VPS: ubah `APP_VERSION`, `docker compose pull`, jalankan migrasi, `docker compose up -d`.
3. Migrasi wajib kompatibel mundur satu versi (tambah kolom dulu, hapus kolom di rilis berikutnya) supaya rollback cukup mengganti tag.
