import { UtilHttp } from "@/common/utils/UtilHttp";
import { UtilCursor } from "@/common/utils/UtilCursor";
import { SSystemLog } from "../schemas/SSystemLog";
import { logger } from "@/infrastructure/logger/logger";
import { IUserApp, TDb } from "bedest-core";
import { and, count, desc, eq, SQL } from "drizzle-orm";

/** userId of events without an acting user (failed logins, jobs). */
export const SYSTEM_AUDIT_USER_ID = "00000000-0000-0000-0000-000000000000";

class ServiceSystemLog {
  async log(
    c: IUserApp,
    params: {
      action: string;
      entity: string;
      entityId: string | null;
      payload: Record<string, unknown>;
    },
  ) {
    try {
      await c.db.insert(SSystemLog).values({
        userId: c.session.userId,
        action: params.action,
        entity: params.entity,
        entityId: params.entityId,
        payload: params.payload,
      });
    } catch (err) {
      logger.error({ err, params }, "Audit Log insertion failed");
    }
  }

  /**
   * A system event without an authenticated actor (e.g. LOGIN_FAILED,
   * FEAT-07). Errors are logged and swallowed like `log`.
   */
  async logEvent(
    db: TDb,
    params: {
      userId?: string;
      action: string;
      entity: string;
      entityId: string | null;
      payload: Record<string, unknown>;
    },
  ) {
    try {
      await db.insert(SSystemLog).values({
        userId: params.userId ?? SYSTEM_AUDIT_USER_ID,
        action: params.action,
        entity: params.entity,
        entityId: params.entityId,
        payload: params.payload,
      });
    } catch (err) {
      logger.error(
        { err, action: params.action },
        "Audit Log insertion failed",
      );
    }
  }

  async getAll(
    c: IUserApp,
    query: {
      limit: number;
      page: number;
      action?: string;
      entity?: string;
      entityId?: string;
      userId?: string;
      cursor?: string;
    },
  ) {
    const cursor =
      query.cursor === undefined ? undefined : UtilCursor.decode(query.cursor);
    const filters: SQL<unknown>[] = [];

    if (query.action) {
      filters.push(eq(SSystemLog.action, query.action));
    }
    if (query.entity) {
      filters.push(eq(SSystemLog.entity, query.entity));
    }
    if (query.entityId) {
      filters.push(eq(SSystemLog.entityId, query.entityId));
    }
    if (query.userId) {
      filters.push(eq(SSystemLog.userId, query.userId));
    }

    const select = () =>
      c.db
        .select({
          row: {
            id: SSystemLog.id,
            userId: SSystemLog.userId,
            action: SSystemLog.action,
            entity: SSystemLog.entity,
            entityId: SSystemLog.entityId,
            payload: SSystemLog.payload,
            createdAt: SSystemLog.createdAt,
          },
          cursorKey: UtilCursor.key(SSystemLog.createdAt),
        })
        .from(SSystemLog)
        .orderBy(desc(SSystemLog.createdAt), desc(SSystemLog.id))
        .$dynamic();

    // Keyset mode: no COUNT, no OFFSET [PERF-02].
    if (cursor) {
      const rows = await select()
        .where(
          and(
            ...filters,
            UtilCursor.after(SSystemLog.createdAt, SSystemLog.id, cursor),
          ),
        )
        .limit(query.limit + 1);
      const { data, nextCursor } = UtilCursor.page(rows, query.limit);
      return { data, meta: { limit: query.limit, nextCursor } };
    }

    const [totalRes] = await c.db
      .select({ count: count() })
      .from(SSystemLog)
      .where(and(...filters));

    const total = Number(totalRes.count);
    const rows = await select()
      .where(and(...filters))
      .limit(query.limit + 1)
      .offset((query.page - 1) * query.limit);
    const { data, nextCursor } = UtilCursor.page(rows, query.limit);

    return {
      data,
      meta: {
        total,
        page: query.page,
        limit: query.limit,
        totalPages: Math.ceil(total / query.limit),
        nextCursor,
      },
    };
  }

  async getById(c: IUserApp, id: string) {
    const [res] = await c.db
      .select()
      .from(SSystemLog)
      .where(eq(SSystemLog.id, id))
      .limit(1);

    if (!res) {
      throw UtilHttp.fail(404);
    }

    return res;
  }
}

export default new ServiceSystemLog();
