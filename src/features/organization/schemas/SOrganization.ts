import { pgTable, varchar, text, jsonb, uuid } from "drizzle-orm/pg-core";
import { baseColumns, UtilDbSchema } from "bedest-core";
import { SStorage } from "@f/storage/schemas/SStorage";

export const SOrganization = pgTable(
  "organizations",
  {
    ...baseColumns,
    displayName: varchar({ length: 255 }).notNull(),
    fullName: varchar({ length: 255 }).notNull(),
    tagline: varchar({ length: 255 }),
    email: varchar({ length: 255 }),
    phone: varchar({ length: 50 }),
    address: text(),
    workingHours: varchar({ length: 255 }),
    copyright: varchar({ length: 255 }),
    domain: varchar({ length: 255 }),
    country: varchar({ length: 255 }),
    city: varchar({ length: 255 }),
    state: varchar({ length: 255 }),
    zipCode: varchar({ length: 255 }),
    taxId: varchar({ length: 255 }),
    currency: varchar({ length: 3 }).default("USD"),
    timezone: varchar({ length: 255 }).default("UTC"),
    logoId: uuid().references(() => SStorage.id),
    links: jsonb().$type<string[]>(),
  },
  (t) => [UtilDbSchema.activeIndex("idx_organizations_active", t.id)],
).enableRLS();
