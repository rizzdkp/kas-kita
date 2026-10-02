import { parseArgs } from "node:util";

const USAGE = `Pemakaian:
  pnpm user:create --email a@b.c --name Rizz [--color violet] [--payday 25]
  pnpm user:create --email a@b.c --reset-password   (ganti password pengguna yang sudah ada, semua perangkatnya dikeluarkan)

Password diminta di terminal tanpa ditampilkan, minimal 12 karakter. Untuk skrip:
  --password-stdin         baca password dari stdin, misalnya: printf '%s' "$PW" | pnpm user:create ... --password-stdin
  --password-env NAMA_ENV  baca password dari variabel lingkungan NAMA_ENV

Warna: violet, rose, gold, ocean, plum, slate.`;

const { values } = parseArgs({
  options: {
    email: { type: "string" },
    name: { type: "string" },
    color: { type: "string" },
    payday: { type: "string" },
    "reset-password": { type: "boolean", default: false },
    "password-stdin": { type: "boolean", default: false },
    "password-env": { type: "string" },
    help: { type: "boolean", short: "h", default: false },
  },
});

const reset = values["reset-password"];
if (values.help || !values.email || (!reset && !values.name)) {
  console.log(USAGE);
  process.exit(values.help ? 0 : 1);
}

// impor dinamis supaya --help tidak butuh DATABASE_URL
const { CreateUserError, createUser, createUserInputSchema, setUserPassword } = await import("@/server/auth/create-user");
const { readPassword } = await import("@/server/auth/cli-password");
const { sql } = await import("@/server/db/client");

try {
  if (values["password-stdin"] && values["password-env"]) throw new CreateUserError("Pilih salah satu: --password-stdin atau --password-env.");
  const color = createUserInputSchema.shape.color.safeParse(values.color);
  if (values.color && !color.success) throw new CreateUserError(color.error.issues[0]?.message ?? "Warna tidak valid.");
  const password = await readPassword(
    values["password-stdin"] ? { kind: "stdin" } : values["password-env"] ? { kind: "env", name: values["password-env"] } : { kind: "prompt" },
  );
  if (reset) {
    const user = await setUserPassword(values.email, password, { revokeSessions: true });
    console.log(`Password ${user.displayName} diganti. Semua perangkatnya sudah dikeluarkan; masuk lagi dengan password baru.`);
  } else {
    const user = await createUser({ email: values.email, name: values.name ?? "", color: color.data, payday: values.payday, password });
    console.log(`Pengguna ${user.displayName} dibuat dengan warna ${user.identityColor}. Masuk di /login dengan ${user.email} dan password tadi.`);
  }
} catch (error) {
  if (error instanceof CreateUserError) {
    console.error(error.message);
    process.exitCode = 1;
  } else {
    throw error;
  }
} finally {
  await sql.end();
}
