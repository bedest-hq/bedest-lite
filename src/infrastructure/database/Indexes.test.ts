import { describe, it, expect } from "bun:test";
import { sql } from "drizzle-orm";
import { test_owner_db } from "@/common/tests/TestManager.test";

/**
 * EXPLAIN of the list queries with sequential scans disabled (the test
 * tables are tiny, so the planner would otherwise prefer a seq scan): each
 * must be able to use its PERF-01 index.
 */
const planOf = async (query: string) =>
  await test_owner_db.transaction(async (tx) => {
    await tx.execute(sql`SET LOCAL enable_seqscan = off`);
    const res = await tx.execute<Record<string, string>>(
      sql.raw(`EXPLAIN ${query}`),
    );
    return res.rows.map((r) => Object.values(r).join(" ")).join("\n");
  });

const SOME_USER = "'00000000-0000-4000-8000-000000000000'";

describe("PERF-01: indexes for list ordering", () => {
  const cases: Array<[string, string]> = [
    [
      "idx_storage_created",
      'SELECT id FROM storage_files WHERE "isDeleted" = false ORDER BY "createdAt" DESC LIMIT 20',
    ],
    [
      "idx_audit_logs_created",
      'SELECT id FROM system_audit_logs ORDER BY "createdAt" DESC LIMIT 20',
    ],
    [
      "idx_notifications_user_created",
      `SELECT id FROM notifications WHERE "userId" = ${SOME_USER} AND "isDeleted" = false ORDER BY "createdAt" DESC LIMIT 20`,
    ],
  ];

  for (const [index, query] of cases) {
    it(`[PERF-01] ${index}`, async () => {
      expect(await planOf(query)).toContain(index);
    });
  }
});
