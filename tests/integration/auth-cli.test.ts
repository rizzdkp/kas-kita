import { spawnSync } from "node:child_process";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.DATABASE_URL = process.env.AUTH_TEST_DATABASE_URL ?? "postgres://kaskita:kaskita@localhost:5432/kaskita_test_auth";
  process.env.APP_URL = "http://localhost:3000";
  process.env.AUTH_SECRET ??= "rahasia-tes-auth-yang-cukup-panjang-untuk-hmac";
});

import { eq } from "drizzle-orm";
import { auth } from "@/server/auth/auth";
import { db } from "@/server/db/client";
import { authAccounts, users } from "@/server/db/schema";
import { resetAuthTables } from "./auth-helpers";

const PASSWORD = "kuda-laut-biru-42";

function cli(args: string[], options: { env?: Record<string, string>; input?: string } = {}) {
  const result = spawnSync("npx", ["tsx", "scripts/create-user.ts", ...args], {
    encoding: "utf8",
    input: options.input ?? "",
    env: { ...process.env, ...options.env },
    timeout: 60_000,
  });
  return { status: result.status, output: `${result.stdout}${result.stderr}` };
}

async function canSignIn(email: string, password: string): Promise<boolean> {
  try {
    await auth.api.signInEmail({ body: { email, password, rememberMe: false }, headers: new Headers({ "x-forwarded-for": "10.9.0.1" }) });
    return true;
  } catch {
    return false;
  }
}

beforeEach(async () => {
  await resetAuthTables();
});

describe("pnpm user:create", () => {
  it("membuat user dengan password dari --password-env tanpa mencetak password", async () => {
    const run = cli(["--email", "rizz@example.com", "--name", "Rizz", "--color", "violet", "--password-env", "KK_PW"], { env: { KK_PW: PASSWORD } });
    expect(run.status).toBe(0);
    expect(run.output).toContain("Pengguna Rizz dibuat dengan warna violet");
    expect(run.output).not.toContain(PASSWORD);
    expect(await canSignIn("rizz@example.com", PASSWORD)).toBe(true);
  }, 90_000);

  it("menolak password pendek dari --password-stdin dan tidak membuat user", async () => {
    const run = cli(["--email", "rizz@example.com", "--name", "Rizz", "--password-stdin"], { input: "pendek\n" });
    expect(run.status).toBe(1);
    expect(run.output).toContain("Password minimal 12 karakter.");
    expect(await db.select().from(users)).toHaveLength(0);
  }, 90_000);

  it("--reset-password mengganti password user yang ada", async () => {
    expect(cli(["--email", "rizz@example.com", "--name", "Rizz", "--password-stdin"], { input: `${PASSWORD}\n` }).status).toBe(0);
    const run = cli(["--email", "rizz@example.com", "--reset-password", "--password-stdin"], { input: "password-baru-yang-panjang\n" });
    expect(run.status).toBe(0);
    expect(run.output).toContain("Password Rizz diganti");
    expect(await canSignIn("rizz@example.com", PASSWORD)).toBe(false);
    expect(await canSignIn("rizz@example.com", "password-baru-yang-panjang")).toBe(true);
    const [user] = await db.select().from(users).where(eq(users.email, "rizz@example.com"));
    expect(await db.select().from(authAccounts).where(eq(authAccounts.userId, user?.id ?? ""))).toHaveLength(1);
  }, 120_000);

  it("tanpa terminal dan tanpa opsi password memberi petunjuk", () => {
    const run = cli(["--email", "rizz@example.com", "--name", "Rizz"]);
    expect(run.status).toBe(1);
    expect(run.output).toContain("--password-stdin");
  }, 90_000);
});
