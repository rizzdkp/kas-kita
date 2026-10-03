import { asc } from "drizzle-orm";
import { db as defaultDb, type DbOrTx } from "@/server/db/client";
import { tags } from "@/server/db/schema";

export interface TagOption {
  id: string;
  name: string;
}

/** Tag dipakai bersama oleh kedua pengguna, jadi tidak dibatasi cakupan. */
export async function listTags(db: DbOrTx = defaultDb): Promise<TagOption[]> {
  return db.select({ id: tags.id, name: tags.name }).from(tags).orderBy(asc(tags.name));
}
