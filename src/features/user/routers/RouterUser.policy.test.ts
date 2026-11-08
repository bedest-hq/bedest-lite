import { describe, it, expect } from "bun:test";
import { treaty } from "@elysiajs/eden";
import { createTestUser } from "@/common/tests/TestManager.test";
import { RouterUser } from "./RouterUser";
import { EUserRole } from "../enums/EUserRole";

const api = treaty(RouterUser);
const ROLES = [EUserRole.SYSTEM, EUserRole.ADMIN, EUserRole.USER] as const;
const NEW_PASSWORD = "a-brand-new-password";

type TAction = "update-name" | "update-password" | "remove";

/** The SEC-12 policy (single tenant), written out as the expected status. */
const expectedStatus = (actor: EUserRole, target: EUserRole): number => {
  if (actor === EUserRole.SYSTEM) {
    return 200;
  }
  if (actor === EUserRole.ADMIN) {
    return target === EUserRole.USER ? 200 : 403;
  }
  return 403;
};

const perform = async (
  action: TAction,
  headers: Record<string, string>,
  targetId: string,
) => {
  if (action === "remove") {
    return await api.user({ id: targetId }).delete({}, { headers });
  }
  const body =
    action === "update-name" ? { name: "Renamed" } : { password: NEW_PASSWORD };
  return await api.user({ id: targetId }).put(body, { headers });
};

describe("SEC-11: ADMIN cannot delete SYSTEM users or other ADMINs", () => {
  const removeAs = async (actorRole: EUserRole, targetRole: EUserRole) => {
    const actor = await createTestUser(actorRole);
    const target = await createTestUser(targetRole);
    if (targetRole === EUserRole.ADMIN) {
      // [SEC-13] the last ADMIN can never be deleted.
      await createTestUser(EUserRole.ADMIN);
    }
    return (
      await api.user({ id: target.user.id }).delete({}, { headers: actor.headers })
    ).status;
  };

  it("[SEC-11] ADMIN deletes SYSTEM → 403", async () => {
    expect(await removeAs(EUserRole.ADMIN, EUserRole.SYSTEM)).toBe(403);
  });
  it("[SEC-11] ADMIN deletes another ADMIN → 403", async () => {
    expect(await removeAs(EUserRole.ADMIN, EUserRole.ADMIN)).toBe(403);
  });
  it("[SEC-11] ADMIN deletes USER → 200", async () => {
    expect(await removeAs(EUserRole.ADMIN, EUserRole.USER)).toBe(200);
  });
  it("[SEC-11] SYSTEM deletes ADMIN → 200", async () => {
    expect(await removeAs(EUserRole.SYSTEM, EUserRole.ADMIN)).toBe(200);
  });
});

describe("SEC-12: user management policy matrix", () => {
  for (const actorRole of ROLES) {
    for (const targetRole of ROLES) {
      for (const action of [
        "update-name",
        "update-password",
        "remove",
      ] as const) {
        const status = expectedStatus(actorRole, targetRole);
        it(`[SEC-12] ${actorRole} → ${action} ${targetRole} → ${status}`, async () => {
          const actor = await createTestUser(actorRole);
          const target = await createTestUser(targetRole);
          if (action === "remove" && targetRole === EUserRole.ADMIN) {
            // [SEC-13] the last ADMIN can never be deleted.
            await createTestUser(EUserRole.ADMIN);
          }
          const res = await perform(action, actor.headers, target.user.id);
          expect(res.status).toBe(status);
        });
      }
    }
  }

  for (const actorRole of ROLES) {
    for (const newRole of ROLES) {
      const allowed =
        actorRole === EUserRole.SYSTEM ||
        (actorRole === EUserRole.ADMIN && newRole === EUserRole.USER);
      it(`[SEC-12] ${actorRole} → create ${newRole} → ${allowed ? 200 : 403}`, async () => {
        const actor = await createTestUser(actorRole);
        const res = await api.user.post(
          {
            name: "New User",
            email: `new_${crypto.randomUUID().slice(0, 8)}@example.com`,
            role: newRole,
            password: "a-strong-password-1",
          },
          { headers: actor.headers },
        );
        expect(res.status).toBe(allowed ? 200 : 403);
      });
    }
  }
});

describe("SEC-12: self-service and role assignment", () => {
  for (const role of ROLES) {
    it(`[SEC-12] ${role} can rename self`, async () => {
      const me = await createTestUser(role);
      const res = await api
        .user({ id: me.user.id })
        .put({ name: "Me" }, { headers: me.headers });
      expect(res.status).toBe(200);
    });

    it(`[SEC-12] ${role} changing own password requires the current password`, async () => {
      const me = await createTestUser(role);
      const missing = await api
        .user({ id: me.user.id })
        .put({ password: NEW_PASSWORD }, { headers: me.headers });
      expect(missing.status).toBe(400);

      const wrong = await api
        .user({ id: me.user.id })
        .put(
          { password: NEW_PASSWORD, currentPassword: "not-my-password" },
          { headers: me.headers },
        );
      expect(wrong.status).toBe(401);

      const ok = await api
        .user({ id: me.user.id })
        .put(
          { password: NEW_PASSWORD, currentPassword: "test_password" },
          { headers: me.headers },
        );
      expect(ok.status).toBe(200);
    });

    it(`[SEC-12] ${role} cannot change own role`, async () => {
      const me = await createTestUser(role);
      const res = await api
        .user({ id: me.user.id })
        .put({ role: EUserRole.SYSTEM }, { headers: me.headers });
      expect(res.status).toBe(403);
    });
  }

  it("[SEC-12] ADMIN cannot delete itself", async () => {
    const admin = await createTestUser(EUserRole.ADMIN);
    const selfDelete = await api
      .user({ id: admin.user.id })
      .delete({}, { headers: admin.headers });
    expect(selfDelete.status).toBe(403);
  });

  it("[SEC-12] role assignment never exceeds the actor's own management rights", async () => {
    const system = await createTestUser(EUserRole.SYSTEM);
    const admin = await createTestUser(EUserRole.ADMIN);

    const promote = async (headers: Record<string, string>, role: EUserRole) => {
      const target = await createTestUser(EUserRole.USER);
      return (
        await api.user({ id: target.user.id }).put({ role }, { headers })
      ).status;
    };

    expect(await promote(system.headers, EUserRole.ADMIN)).toBe(200);
    expect(await promote(system.headers, EUserRole.SYSTEM)).toBe(200);
    expect(await promote(admin.headers, EUserRole.USER)).toBe(200);
    expect(await promote(admin.headers, EUserRole.ADMIN)).toBe(403);
    expect(await promote(admin.headers, EUserRole.SYSTEM)).toBe(403);
  });
});
