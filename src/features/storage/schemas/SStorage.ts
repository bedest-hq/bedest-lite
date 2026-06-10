import { baseColumns, UtilDbSchema } from "bedest-core";
import { pgTable, varchar, integer } from "drizzle-orm/pg-core";

export const SStorage = pgTable(
  "storage_files",
  {
    ...baseColumns,
    name: varchar({ length: 255 }).notNull(),
    key: varchar({ length: 500 }).notNull().unique(),
    mimeType: varchar({ length: 100 }).notNull(),
    size: integer().notNull(),
  },
  (t) => [UtilDbSchema.activeIndex("idx_storage_active", t.id)],
).enableRLS();
