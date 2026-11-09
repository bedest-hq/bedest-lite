import { UtilHttp } from "@/common/utils/UtilHttp";
import { SNotification } from "../schemas/SNotification";
import { and, count, desc, eq } from "drizzle-orm";

import { IUserApp } from "bedest-core";

class ServiceNotification {
  async getAll(
    c: IUserApp,
    query: { limit: number; page: number; unreadOnly?: boolean },
  ) {
    const filters = [
      eq(SNotification.userId, c.session.userId),
      eq(SNotification.isDeleted, false),
    ];

    if (query.unreadOnly) {
      filters.push(eq(SNotification.isRead, false));
    }

    const [totalRes] = await c.db
      .select({ count: count() })
      .from(SNotification)
      .where(and(...filters));

    const total = Number(totalRes.count);
    const offset = (query.page - 1) * query.limit;

    const data = await c.db
      .select({
        id: SNotification.id,
        event: SNotification.event,
        payload: SNotification.payload,
        isRead: SNotification.isRead,
        readAt: SNotification.readAt,
        createdAt: SNotification.createdAt,
      })
      .from(SNotification)
      .where(and(...filters))
      .orderBy(desc(SNotification.createdAt))
      .limit(query.limit)
      .offset(offset);

    return {
      data,
      meta: {
        total,
        page: query.page,
        limit: query.limit,
        totalPages: Math.ceil(total / query.limit),
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
}

export default new ServiceNotification();
