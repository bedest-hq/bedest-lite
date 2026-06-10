// src/features/session/services/ServiceSession.ts
import { and, eq } from "drizzle-orm";
import { SSession } from "../schemas/SSession";
import { IApp, IUserApp } from "bedest-core";

class ServiceSession {
  async create(
    c: IApp,
    data: {
      userId: string;
    },
  ) {
    const [session] = await c.db
      .insert(SSession)
      .values({
        userId: data.userId,
        createdAt: c.nowDatetime,
      })
      .returning({ id: SSession.id });
    return session;
  }

  async isValid(c: IApp, id: string) {
    const [res] = await c.db
      .select({ userId: SSession.userId })
      .from(SSession)
      .where(eq(SSession.id, id))
      .limit(1);
    return !!res;
  }

  async remove(c: IUserApp, id: string) {
    await c.db
      .delete(SSession)
      .where(and(eq(SSession.id, id), eq(SSession.userId, c.session.userId)));

    return { success: true };
  }

  async removeBySystem(c: IApp, sessionId: string) {
    await c.db.delete(SSession).where(eq(SSession.id, sessionId));
    return { success: true };
  }
}

export default new ServiceSession();
