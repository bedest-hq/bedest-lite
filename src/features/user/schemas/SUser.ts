import { sql } from "drizzle-orm";
import { uuid, pgTable, varchar, uniqueIndex } from "drizzle-orm/pg-core";
import { EUserRolePg } from "../enums/EUserRole";
import { EUserStatus, EUserStatusPg } from "../enums/EUserStatus";
import { SStorage } from "@f/storage/schemas/SStorage";
import { baseColumns, UtilDbSchema } from "bedest-core";

export const SUser = pgTable(
  "users",
  {
    ...baseColumns,
    name: varchar({ length: 255 }).notNull(),
    email: varchar({ length: 255 }).notNull(),
    role: EUserRolePg().notNull(),
    avatarId: uuid().references(() => SStorage.id),
    password: varchar({ length: 255 }).notNull(),
    // INVITED until the invitation is accepted; cannot log in [FEAT-06].
    status: EUserStatusPg().notNull().default(EUserStatus.ACTIVE),
  },
  (t) => [
    UtilDbSchema.activeIndex("idx_users_active", t.id),
    // Case-insensitive uniqueness among active users [SEC-21].
    uniqueIndex("idx_users_email_lower")
      .on(sql`lower(${t.email})`)
      .where(sql`"isDeleted" = false`),
  ],
);
