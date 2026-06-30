import { pgTable, varchar, text, jsonb, uuid } from "drizzle-orm/pg-core";
import { baseColumns, UtilDbSchema } from "bedest-core";
import { SStorage } from "@f/storage/schemas/SStorage";

export const SOrganization = pgTable(
  "organizations",
  {
    ...baseColumns,
    displayName: varchar({ length: 255 }).notNull(),
    fullName: varchar({ length: 255 }).notNull(),
    phone: varchar({ length: 50 }),
    address: text(),
    logoId: uuid().references(() => SStorage.id),
    links: jsonb().$type<string[]>(),
  },
  (t) => [UtilDbSchema.activeIndex("idx_organizations_active", t.id)],
).enableRLS();
