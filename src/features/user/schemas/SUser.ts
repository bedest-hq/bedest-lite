import { uuid, pgTable, varchar } from "drizzle-orm/pg-core";
import { EUserRolePg } from "../enums/EUserRole";
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
  },
  (t) => [
    UtilDbSchema.activeIndex("idx_users_active", t.id),
    UtilDbSchema.activeUniqueIndex("idx_users_email", t.email),
  ],
).enableRLS();
