#!/usr/bin/env node
// Menyiapkan lingkungan lokal dalam satu perintah: .env.local, PostgreSQL di Docker, migrasi, dan data contoh.
// Node murni (tanpa bash) supaya jalan di macOS, Linux, dan Windows.
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";
import postgres from "postgres";

const ENV_FILE = ".env.local";
const TEST_DATABASES = ["kaskita_test", "kaskita_test_auth"];
const isWindows = process.platform === "win32";

function step(message) {
  console.log(`\n> ${message}`);
}

function run(command, args, env = process.env) {
  const result = spawnSync(command, args, { stdio: "inherit", env, shell: isWindows });
  if (result.status !== 0) {
    console.error(`Perintah gagal: ${command} ${args.join(" ")}`);
    process.exit(result.status ?? 1);
  }
}

function ensureEnvFile() {
  if (existsSync(ENV_FILE)) {
    console.log(`${ENV_FILE} sudah ada, tidak diubah.`);
    return;
  }
  copyFileSync(".env.example", ENV_FILE);
  // kunci acak per mesin; jangan pernah dipakai ulang di produksi
  const filled = readFileSync(ENV_FILE, "utf8")
    .replace(/^APP_ENCRYPTION_KEY=.*$/m, `APP_ENCRYPTION_KEY=${randomBytes(32).toString("base64")}`)
    .replace(/^AUTH_SECRET=.*$/m, `AUTH_SECRET=${randomBytes(32).toString("base64")}`);
  writeFileSync(ENV_FILE, filled);
  console.log(`${ENV_FILE} dibuat dengan APP_ENCRYPTION_KEY dan AUTH_SECRET acak.`);
}

function loadEnvFile() {
  for (const line of readFileSync(ENV_FILE, "utf8").split(/\r?\n/)) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
    if (match && process.env[match[1]] === undefined) process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, "$2");
  }
}

async function waitForDatabase(url) {
  for (let attempt = 1; attempt <= 60; attempt++) {
    const sql = postgres(url, { max: 1, connect_timeout: 2, onnotice: () => {} });
    try {
      await sql`select 1`;
      return sql;
    } catch {
      await sql.end({ timeout: 1 }).catch(() => {});
      if (attempt === 1) process.stdout.write("Menunggu PostgreSQL siap");
      process.stdout.write(".");
      await sleep(1000);
    }
  }
  console.error("\nPostgreSQL tidak bisa dihubungi setelah 60 detik. Cek `docker compose -f docker/compose.dev.yml logs db`.");
  process.exit(1);
}

function withDatabase(url, name) {
  const parsed = new URL(url);
  parsed.pathname = `/${name}`;
  return parsed.toString();
}

step(`Menyiapkan ${ENV_FILE}`);
ensureEnvFile();
loadEnvFile();
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error(`DATABASE_URL kosong di ${ENV_FILE}.`);
  process.exit(1);
}

if (process.argv.includes("--no-docker")) {
  step("Melewati Docker (--no-docker); memakai PostgreSQL dari DATABASE_URL");
} else {
  step("Menyalakan PostgreSQL (docker compose)");
  run("docker", ["compose", "-f", "docker/compose.dev.yml", "up", "-d", "db"]);
}
const admin = await waitForDatabase(databaseUrl);
console.log("PostgreSQL siap.");

step("Membuat database tes bila belum ada");
for (const name of TEST_DATABASES) {
  const [exists] = await admin`select 1 from pg_database where datname = ${name}`;
  if (!exists) await admin.unsafe(`create database "${name}"`);
}

step("Migrasi");
for (const url of [databaseUrl, ...TEST_DATABASES.map((name) => withDatabase(databaseUrl, name))]) {
  run("npx", ["tsx", "scripts/migrate.ts"], { ...process.env, DATABASE_MIGRATION_URL: url });
}

const [{ count }] = await admin`select count(*)::int as count from users`;
await admin.end();
if (count === 0) {
  step("Mengisi data contoh");
  run("npx", ["tsx", "scripts/seed.ts"]);
} else {
  console.log(`\nDatabase sudah berisi ${count} pengguna; data contoh tidak diisi ulang.`);
}

const password = process.env.DEV_SEED_PASSWORD || "kaskita-dev-123";
console.log(`
Siap. Jalankan:
  pnpm dev
lalu buka ${process.env.APP_URL ?? "http://localhost:3000"} dan masuk dengan rizz@kaskita.local (atau nadia@kaskita.local), password ${password}.
Belum bisa masuk dengan database lama? Jalankan pnpm dev:passwords.`);
