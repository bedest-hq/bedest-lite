import { baseColumns, UtilDbSchema } from "bedest-core";
import { pgTable, varchar, integer, uuid, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { EStorageStatus, EStorageStatusPg } from "../enums/EStorageStatus";

export const SStorage = pgTable(
  "storage_files",
  {
    ...baseColumns,
    name: varchar({ length: 255 }).notNull(),
    key: varchar({ length: 500 }).notNull().unique(),
    mimeType: varchar({ length: 100 }).notNull(),
    size: integer().notNull(),
    // PENDING until the object is stored; only READY rows are served [BUG-03].
    status: EStorageStatusPg().notNull().default(EStorageStatus.READY),
    // Uploader (users.id); null for files uploaded before SEC-26. No FK:
    // users already reference storage_files (avatarId).
    uploadedBy: uuid(),
  },
  (t) => [
    UtilDbSchema.activeIndex("idx_storage_active", t.id),
    // File list, newest first [PERF-01].
    index("idx_storage_created")
      .on(t.createdAt.desc().nullsFirst())
      .where(sql`${t.isDeleted} = false`),
  ],
);
