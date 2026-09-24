import { parseArgs } from "node:util";

const USAGE = `Pemakaian:
  pnpm user:create --email a@b.c --name Rizz [--color violet] [--payday 25]
  pnpm user:create --email a@b.c --link     (tautan pendaftaran baru untuk pengguna yang sudah ada)

Warna: violet, rose, gold, ocean, plum, slate. Tautan berlaku 30 menit dan hanya sekali pakai.`;

const { values } = parseArgs({
  options: {
    email: { type: "string" },
    name: { type: "string" },
    color: { type: "string" },
    payday: { type: "string" },
    link: { type: "boolean", default: false },
    help: { type: "boolean", short: "h", default: false },
  },
});

if (values.help || !values.email || (!values.link && !values.name)) {
  console.log(USAGE);
  process.exit(values.help ? 0 : 1);
}

// impor dinamis supaya --help tidak butuh DATABASE_URL
const { CreateUserError, createEnrollmentLinkForEmail, createUser, createUserInputSchema } = await import("@/server/auth/create-user");
const { sql } = await import("@/server/db/client");

try {
  const color = createUserInputSchema.shape.color.safeParse(values.color);
  if (values.color && !color.success) throw new CreateUserError(color.error.issues[0]?.message ?? "Warna tidak valid.");
  const result = values.link
    ? await createEnrollmentLinkForEmail(values.email)
    : await createUser({ email: values.email, name: values.name ?? "", color: color.data, payday: values.payday });
  console.log(values.link ? "Tautan pendaftaran baru dibuat." : `Pengguna ${result.user.displayName} dibuat dengan warna ${result.user.identityColor}.`);
  console.log(`Buka tautan ini di perangkat ${result.user.displayName} dalam 30 menit untuk mendaftarkan passkey:`);
  console.log(result.enrollmentUrl);
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
