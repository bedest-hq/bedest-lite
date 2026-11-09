import { UtilHttp } from "@/common/utils/UtilHttp";
import { UtilCursor } from "@/common/utils/UtilCursor";
import { SNotification } from "../schemas/SNotification";
import { and, count, desc, eq, lt } from "drizzle-orm";

import { IApp, IUserApp } from "bedest-core";

class ServiceNotification {
  async getAll(
    c: IUserApp,
    query: {
      limit: number;
      page: number;
      unreadOnly?: boolean;
      cursor?: string;
    },
  ) {
    const cursor =
      query.cursor === undefined ? undefined : UtilCursor.decode(query.cursor);
    const filters = [
      eq(SNotification.userId, c.session.userId),
      eq(SNotification.isDeleted, false),
    ];

    if (query.unreadOnly) {
      filters.push(eq(SNotification.isRead, false));
    }

    const select = () =>
      c.db
        .select({
          row: {
            id: SNotification.id,
            event: SNotification.event,
            payload: SNotification.payload,
            isRead: SNotification.isRead,
            readAt: SNotification.readAt,
            createdAt: SNotification.createdAt,
          },
          cursorKey: UtilCursor.key(SNotification.createdAt),
        })
        .from(SNotification)
        .orderBy(desc(SNotification.createdAt), desc(SNotification.id))
        .$dynamic();

    // Keyset mode: no COUNT, no OFFSET [PERF-02].
    if (cursor) {
      const rows = await select()
        .where(
          and(
            ...filters,
            UtilCursor.after(SNotification.createdAt, SNotification.id, cursor),
          ),
        )
        .limit(query.limit + 1);
      const { data, nextCursor } = UtilCursor.page(rows, query.limit);
      return { data, meta: { limit: query.limit, nextCursor } };
    }

    const [totalRes] = await c.db
      .select({ count: count() })
      .from(SNotification)
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

  async markRead(c: IUserApp, id: string) {
    const [existing] = await c.db
      .select({ userId: SNotification.userId })
      .from(SNotification)
      .where(and(eq(SNotification.id, id), eq(SNotification.isDeleted, false)))
      .limit(1);

    if (!existing) {
      throw UtilHttp.fail(404);
    }

    if (existing.userId !== c.session.userId) {
      throw UtilHttp.fail(403);
    }

    await c.db
      .update(SNotification)
      .set({ isRead: true, readAt: c.nowDatetime })
      .where(eq(SNotification.id, id));

    return { success: true };
  }

  async markAllRead(c: IUserApp) {
    await c.db
      .update(SNotification)
      .set({ isRead: true, readAt: c.nowDatetime })
      .where(
        and(
          eq(SNotification.userId, c.session.userId),
          eq(SNotification.isRead, false),
          eq(SNotification.isDeleted, false),
        ),
      );

    return { success: true };
  }

  /**
   * Job notifications.retention [FEAT-08]: soft-deletes notifications
   * created before `olderThan` (NOTIFICATION_RETENTION_DAYS).
   */
  async applyRetention(c: IApp, olderThan: Date) {
    const updated = await c.db
      .update(SNotification)
      .set({ isDeleted: true, deletedAt: c.nowDatetime })
      .where(
        and(
          eq(SNotification.isDeleted, false),
          lt(SNotification.createdAt, olderThan),
        ),
      )
      .returning({ id: SNotification.id });
    return { count: updated.length };
  }
}

export default new ServiceNotification();
