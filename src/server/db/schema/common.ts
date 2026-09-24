import { integer, timestamp, uuid } from "drizzle-orm/pg-core";
import { uuidv7 } from "@/lib/uuid";

// uang selalu bigint rupiah, mode bigint supaya tidak pernah jadi number di server
export { bigint } from "drizzle-orm/pg-core";

export const id = () => uuid("id").primaryKey().$defaultFn(uuidv7);

export const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

export const versioned = {
  version: integer("version").notNull().default(1),
};

export const softDelete = {
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
};
