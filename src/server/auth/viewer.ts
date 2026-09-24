import type { users } from "@/server/db/schema";

export type UserRow = typeof users.$inferSelect;

// orang yang sedang login beserta partnernya; semua query dan mutasi menerima ini
export interface Viewer {
  user: UserRow;
  partner: UserRow | null;
  sessionId: string;
}
