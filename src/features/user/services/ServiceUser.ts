import { UtilHttp } from "@/common/utils/UtilHttp";
import { EUserRole } from "../enums/EUserRole";
import { SUser } from "../schemas/SUser";

import { and, count, eq, ne } from "drizzle-orm";
import { IUserApp, ServiceBase } from "bedest-core";
import { IPolicyActor, UtilUserPolicy } from "../utils/UtilUserPolicy";
import { UtilEmail } from "../utils/UtilEmail";
import ServiceSession from "@f/session/services/ServiceSession";
import ServiceSystemLog from "@f/system/services/ServiceSystemLog";

class ServiceUser extends ServiceBase<typeof SUser, string> {
  constructor() {
    super(SUser);
  }

  private actor(c: IUserApp): IPolicyActor {
    return { role: c.session.role, userId: c.session.userId };
  }

  /** Loads an active user (404 when missing or deleted). */
  private async loadTarget(c: IUserApp, id: string) {
    const [row] = await c.db
      .select({ id: SUser.id, role: SUser.role, password: SUser.password })
      .from(SUser)
      .where(and(eq(SUser.id, id), eq(SUser.isDeleted, false)))
      .limit(1);

    if (!row) {
      throw UtilHttp.fail(404);
    }
    return row;
  }

  async create(
    c: IUserApp,
    data: {
      name: string;
      email: string;
      password: string;
      role: EUserRole;
      avatarId?: string;
    },
  ) {
    if (!UtilUserPolicy.canGrantRole(c.session.role, data.role)) {
      throw UtilHttp.fail(403);
    }

    const hash = await Bun.password.hash(data.password);

    return super.create(c, {
      ...data,
      email: UtilEmail.normalize(data.email),
      password: hash,
    });
  }

  /** Tenant users without credentials (the base getAll takes columns). */
  async list(c: IUserApp, query: { limit: number; page: number }) {
    return this.getAll(c, query, {
      id: SUser.id,
      name: SUser.name,
      role: SUser.role,
      status: SUser.status,
      avatarId: SUser.avatarId,
      createdAt: SUser.createdAt,
    });
  }

  /** One user profile without credentials. */
  async getProfile(c: IUserApp, id: string) {
    return this.getById(c, id, {
      name: SUser.name,
      role: SUser.role,
      email: SUser.email,
      avatarId: SUser.avatarId,
      createdAt: SUser.createdAt,
    });
  }

  async update(
    c: IUserApp,
    id: string,
    data: {
      name?: string;
      password?: string;
      currentPassword?: string;
      avatarId?: string;
      role?: EUserRole;
    },
  ) {
    const actor = this.actor(c);
    const target = await this.loadTarget(c, id);

    if (UtilUserPolicy.isSelf(actor, target)) {
      if (data.role !== undefined) {
        throw UtilHttp.fail(403, "You cannot change your own role");
      }
      if (data.password) {
        if (!data.currentPassword) {
          throw UtilHttp.fail(
            400,
            "currentPassword is required to change your password",
          );
        }
        const valid = await Bun.password.verify(
          data.currentPassword,
          target.password,
        );
        if (!valid) {
          throw UtilHttp.fail(401, "Wrong current password");
        }
      }
    } else {
      if (!UtilUserPolicy.canManage(actor, target)) {
        throw UtilHttp.fail(403);
      }
      if (
        data.role !== undefined &&
        !UtilUserPolicy.canGrantRole(actor.role, data.role)
      ) {
        throw UtilHttp.fail(403);
      }
    }

    const payload: Partial<typeof SUser.$inferInsert> = {};

    if (data.name) {
      payload.name = data.name;
    }
    if (data.password) {
      payload.password = await Bun.password.hash(data.password);
    }
    if (data.avatarId) {
      payload.avatarId = data.avatarId;
    }
    if (data.role !== undefined) {
      payload.role = data.role;
    }

    await super.update(c, id, payload);

    // Credentials or privileges changed: old sessions must not survive
    // [SEC-08]. Your own password change keeps the current session only.
    const roleChanged = data.role !== undefined && data.role !== target.role;
    if (data.password || roleChanged) {
      await ServiceSession.revokeUserSessions(c, id, {
        exceptSessionId:
          UtilUserPolicy.isSelf(actor, target) && !roleChanged
            ? c.session.sessionId
            : undefined,
      });
    }

    // Security events [FEAT-07]: never the password itself.
    if (data.password) {
      await ServiceSystemLog.log(c, {
        action: "PASSWORD_CHANGED",
        entity: "user",
        entityId: id,
        payload: { self: UtilUserPolicy.isSelf(actor, target) },
      });
    }
    if (roleChanged) {
      await ServiceSystemLog.log(c, {
        action: "ROLE_CHANGED",
        entity: "user",
        entityId: id,
        payload: { from: target.role, to: data.role },
      });
    }

    return { success: true };
  }

  /**
   * Refuses to delete the last active ADMIN or the last active SYSTEM user
   * (self-lockout) [SEC-13].
   */
  private async assertNotLastPrivileged(
    c: IUserApp,
    target: { id: string; role: string },
  ) {
    if (target.role !== EUserRole.ADMIN && target.role !== EUserRole.SYSTEM) {
      return;
    }
    const [others] = await c.db
      .select({ n: count() })
      .from(SUser)
      .where(
        and(
          eq(
            SUser.role,
            target.role === EUserRole.ADMIN
              ? EUserRole.ADMIN
              : EUserRole.SYSTEM,
          ),
          eq(SUser.isDeleted, false),
          ne(SUser.id, target.id),
        ),
      );
    if (Number(others?.n ?? 0) === 0) {
      throw UtilHttp.fail(
        409,
        target.role === EUserRole.ADMIN
          ? "Cannot delete the last active ADMIN"
          : "Cannot delete the last active SYSTEM user",
      );
    }
  }

  override async remove(c: IUserApp, id: string) {
    const target = await this.loadTarget(c, id);

    if (!UtilUserPolicy.canManage(this.actor(c), target)) {
      throw UtilHttp.fail(403);
    }

    await this.assertNotLastPrivileged(c, target);

    const res = await super.remove(c, id);
    await ServiceSession.revokeUserSessions(c, id);
    return res;
  }
}

export default new ServiceUser();
