import { describe, it, expect } from "bun:test";
import { Elysia } from "elysia";
import {
  createTestUser,
  testSystemHeaders,
} from "@/common/tests/TestManager.test";
import { ErrorHandler } from "@/infrastructure/error/ErrorHandler";
import { RouterOrganization } from "@f/organization/routers/RouterOrganization";
import { RouterUser } from "./RouterUser";
import { EUserRole } from "../enums/EUserRole";

const app = new Elysia()
  .use(ErrorHandler)
  .use(RouterUser)
  .use(RouterOrganization);

const put = (path: string, body: unknown, cookie: string) =>
  app.handle(
    new Request(`http://localhost${path}`, {
      method: "PUT",
      headers: { "content-type": "application/json", Cookie: cookie },
      body: JSON.stringify(body),
    }),
  );

const NO_FIELDS = { error: "Bad Request", message: "No fields to update" };

describe("BUG-02: empty update payloads", () => {
  it("[BUG-02] PUT /user/:id with {} → 400 with the documented body", async () => {
    const me = await createTestUser(EUserRole.USER);
    const res = await put(`/user/${me.user.id}`, {}, me.headers.Cookie);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual(NO_FIELDS);
  });

  it("[BUG-02] PUT /user/:id with only currentPassword → 400", async () => {
    const me = await createTestUser(EUserRole.USER);
    const res = await put(
      `/user/${me.user.id}`,
      { currentPassword: "test_password" },
      me.headers.Cookie,
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual(NO_FIELDS);
  });

  it("[BUG-02] PUT /organization with {} → 400", async () => {
    const res = await put(
      "/organization",
      {},
      (await testSystemHeaders()).Cookie,
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual(NO_FIELDS);
  });
});
