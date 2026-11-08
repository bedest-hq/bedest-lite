import { EUserRole } from "../enums/EUserRole";
import { SUser } from "../schemas/SUser";
import { status } from "elysia";
import { eq, and } from "drizzle-orm";
import { IUserApp, ServiceBase } from "bedest-core";
import { IPolicyActor, UtilUserPolicy } from "../utils/UtilUserPolicy";

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
      throw status("Not Found");
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
      throw status("Forbidden");
    }

    const hash = await Bun.password.hash(data.password);

    return super.create(c, {
      ...data,
      password: hash,
    });
  }

  async getAll(c: IUserApp, query: { limit: number; page: number }) {
    return super.getAll(c, query, {
      id: SUser.id,
      name: SUser.name,
      role: SUser.role,
      avatarId: SUser.avatarId,
      createdAt: SUser.createdAt,
    });
  }

  async getById(c: IUserApp, id: string) {
    return super.getById(c, id, {
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
        throw status("Forbidden", { message: "You cannot change your own role" });
      }
      if (data.password) {
        if (!data.currentPassword) {
          throw status("Bad Request", {
            message: "currentPassword is required to change your password",
          });
        }
        const valid = await Bun.password.verify(
          data.currentPassword,
          target.password,
        );
        if (!valid) {
          throw status("Unauthorized", { message: "Wrong current password" });
        }
      }
    } else {
      if (!UtilUserPolicy.canManage(actor, target)) {
        throw status("Forbidden");
      }
      if (
        data.role !== undefined &&
        !UtilUserPolicy.canGrantRole(actor.role, data.role)
      ) {
        throw status("Forbidden");
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

    return { success: true };
  }

  override async remove(c: IUserApp, id: string) {
    const target = await this.loadTarget(c, id);

    if (!UtilUserPolicy.canManage(this.actor(c), target)) {
      throw status("Forbidden");
    }

    return super.remove(c, id);
  }
}

export default new ServiceUser();
