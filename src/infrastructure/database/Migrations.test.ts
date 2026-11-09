import { describe, it, expect } from "bun:test";
import { PGlite } from "@electric-sql/pglite";

/**
 * Data migrations are tested on a fresh database migrated step by step
 * (each migration in its own transaction, as the migrator does), so rows
 * can be seeded between two migrations.
 */
const journal = (await Bun.file("drizzle/meta/_journal.json").json()) as {
  entries: Array<{ tag: string }>;
};

const apply = async (db: PGlite, tag: string) => {
  const statements = (await Bun.file(`drizzle/${tag}.sql`).text())
    .split("--> statement-breakpoint")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  await db.transaction(async (tx) => {
    for (const statement of statements) {
      await tx.exec(statement);
    }
  });
};

const migrateThrough = async (db: PGlite, lastTag: string) => {
  for (const { tag } of journal.entries) {
    await apply(db, tag);
    if (tag === lastTag) {
      return;
    }
  }
  throw new Error(`migration ${lastTag} not found`);
};

const tagStartingWith = (prefix: string) => {
  const entry = journal.entries.find((e) => e.tag.startsWith(prefix));
  if (!entry) {
    throw new Error(`no migration ${prefix}`);
  }
  return entry.tag;
};

describe("migrations", () => {
  it("[SEC-21] 0003/0004 keep the oldest of case-duplicates, soft-delete the rest, lower-case all and enforce case-insensitive uniqueness", async () => {
    const db = new PGlite();
    try {
      await migrateThrough(db, tagStartingWith("0002_"));
      await db.exec(`
        INSERT INTO users (id, name, email, role, password, "createdAt", "isDeleted") VALUES
          ('00000000-0000-0000-0000-00000000000a', 'old', 'Dup@Example.com', 'USER', 'x', '2020-01-01', false),
          ('00000000-0000-0000-0000-00000000000b', 'new', ' dup@example.COM', 'USER', 'x', '2021-01-01', false),
          ('00000000-0000-0000-0000-00000000000c', 'gone', 'DUP@example.com', 'USER', 'x', '2019-01-01', true),
          ('00000000-0000-0000-0000-00000000000d', 'solo', 'Solo@X.com', 'USER', 'x', '2020-01-01', false);
      `);

      await apply(db, tagStartingWith("0003_"));
      await apply(db, tagStartingWith("0004_"));

      const rows = await db.query<{
        id: string;
        email: string;
        isDeleted: boolean;
      }>('SELECT id, email, "isDeleted" FROM users ORDER BY id');
      expect(rows.rows).toEqual([
        {
          id: "00000000-0000-0000-0000-00000000000a",
          email: "dup@example.com",
          isDeleted: false,
        },
        {
          id: "00000000-0000-0000-0000-00000000000b",
          email: "dup@example.com",
          isDeleted: true,
        },
        {
          id: "00000000-0000-0000-0000-00000000000c",
          email: "dup@example.com",
          isDeleted: true,
        },
        {
          id: "00000000-0000-0000-0000-00000000000d",
          email: "solo@x.com",
          isDeleted: false,
        },
      ]);

      const duplicate = await db
        .exec(
          "INSERT INTO users (name, email, role, password) VALUES ('again', 'DUP@EXAMPLE.COM', 'USER', 'x')",
        )
        .then(
          () => "inserted",
          (err: unknown) => String(err),
        );
      expect(duplicate).toContain("idx_users_email_lower");
    } finally {
      await db.close();
    }
  });
});

describe("migrations (BUG-17)", () => {
  it("[BUG-17] 0010 keeps the newest active organization, 0011 enforces a single active row", async () => {
    const db = new PGlite();
    try {
      await migrateThrough(db, tagStartingWith("0009_"));
      await db.exec(`
        INSERT INTO organizations (id, "displayName", "fullName", "createdAt") VALUES
          ('11111111-1111-4111-8111-111111111111', 'old', 'Old', '2024-01-01'),
          ('22222222-2222-4222-8222-222222222222', 'newest', 'Newest', '2024-03-01'),
          ('33333333-3333-4333-8333-333333333333', 'middle', 'Middle', '2024-02-01');
      `);

      await apply(db, tagStartingWith("0010_"));
      await apply(db, tagStartingWith("0011_"));

      const active = await db.query<{ displayName: string }>(
        'SELECT "displayName" FROM organizations WHERE "isDeleted" = false',
      );
      expect(active.rows).toEqual([{ displayName: "newest" }]);
      const deleted = await db.query<{ n: number }>(
        'SELECT count(*)::int AS n FROM organizations WHERE "isDeleted" = true AND "deletedAt" IS NOT NULL',
      );
      expect(deleted.rows[0]?.n).toBe(2);

      let failure: unknown = null;
      try {
        await db.exec(
          "INSERT INTO organizations (\"displayName\", \"fullName\") VALUES ('x', 'X')",
        );
      } catch (err) {
        failure = err;
      }
      expect(failure).toMatchObject({ code: "23505" });
    } finally {
      await db.close();
    }
  });
});
