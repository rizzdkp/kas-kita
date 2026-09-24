import { execFileSync } from "node:child_process";
import type { BrowserContext } from "@playwright/test";

const cache = new Map<string, { name: string; value: string }>();

/** Cookie sesi user seed lewat scripts/dev-session.ts (tanpa passkey); hanya untuk dev dan e2e. */
export function sessionCookie(email = "rizz@kaskita.local"): { name: string; value: string } {
  const hit = cache.get(email);
  if (hit) return hit;
  const out = execFileSync("bash", ["-c", `set -a; . ./.env.local; set +a; npx tsx scripts/dev-session.ts ${JSON.stringify(email)}`], {
    encoding: "utf8",
  });
  const line = out.trim().split("\n").at(-1) ?? "";
  const cookie = JSON.parse(line) as { name: string; value: string };
  cache.set(email, cookie);
  return cookie;
}

export async function loginAs(context: BrowserContext, email = "rizz@kaskita.local"): Promise<void> {
  const { name, value } = sessionCookie(email);
  await context.addCookies([{ name, value, domain: "localhost", path: "/" }]);
}
