import { createHmac } from "node:crypto";
import { eq } from "drizzle-orm";
import { auth } from "@/server/auth/auth";
import { db, sql } from "@/server/db/client";
import { users } from "@/server/db/schema";

// hanya untuk pengembangan dan tes e2e: mencetak cookie sesi untuk user seed tanpa passkey
if (process.env.NODE_ENV === "production") throw new Error("dev-session tidak boleh dipakai di produksi");

const email = process.argv[2] ?? "rizz@kaskita.local";
const [user] = await db.select().from(users).where(eq(users.email, email));
if (!user) throw new Error(`User ${email} tidak ada. Jalankan pnpm db:seed dulu.`);

const context = await auth.$context;
const session = await context.internalAdapter.createSession(user.id);
const signature = createHmac("sha256", context.secret).update(session.token).digest("base64");
console.log(JSON.stringify({ name: context.authCookies.sessionToken.name, value: `${session.token}.${signature}` }));
await sql.end();
