import { baseColumns, UtilDbSchema } from "bedest-core";
import {
  uuid,
  pgTable,
  varchar,
  jsonb,
  boolean,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const SNotification = pgTable(
  "notifications",
  {
    ...baseColumns,
    userId: uuid().notNull(),
    event: varchar({ length: 100 }).notNull(),
    payload: jsonb().$type<Record<string, unknown>>().notNull().default({}),
    isRead: boolean().notNull().default(false),
    readAt: timestamp({ withTimezone: true }),
  },
  (t) => [
    UtilDbSchema.activeIndex("idx_notifications_user", t.userId),
    // A user's notifications, newest first [PERF-01].
    index("idx_notifications_user_created")
      .on(t.userId, t.createdAt.desc().nullsFirst())
      .where(sql`${t.isDeleted} = false`),
  ],
);
