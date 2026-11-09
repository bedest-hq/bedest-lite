import { describe, it, expect } from "bun:test";
import { treaty } from "@elysiajs/eden";
import {
  createTestUser,
  test_system_user,
  testHeaders,
  testSystemHeaders,
} from "@/common/tests/TestManager.test";
import { RouterUser } from "./RouterUser";
import { EUserRole } from "../enums/EUserRole";

const users = treaty(RouterUser);

describe("SEC-13: no self-lockout", () => {
  it("[SEC-13] deleting the last active ADMIN → 409; with a second ADMIN → 200", async () => {
    const system = await testSystemHeaders();
    const admin = await createTestUser(EUserRole.ADMIN);
    expect(
      (await users.user({ id: admin.user.id }).delete({}, { headers: system }))
        .status,
    ).toBe(409);

    await createTestUser(EUserRole.ADMIN);
    expect(
      (await users.user({ id: admin.user.id }).delete({}, { headers: system }))
        .status,
    ).toBe(200);
  });

  it("[SEC-13] deleting the last active SYSTEM user → 409", async () => {
    const res = await users
      .user({ id: test_system_user.id })
      .delete({}, { headers: await testHeaders(test_system_user) });
    expect(res.status).toBe(409);
  });
});
