import { describe, it, expect, spyOn } from "bun:test";
import { Elysia } from "elysia";
import { createTestUser, testHeaders } from "@/common/tests/TestManager.test";
import { ErrorHandler } from "@/infrastructure/error/ErrorHandler";
import { EUserRole } from "@f/user/enums/EUserRole";
import { RouterOrganization } from "@f/organization/routers/RouterOrganization";
import { RouterUser } from "@f/user/routers/RouterUser";
import { RouterStorage } from "@f/storage/routers/RouterStorage";

const StorageManager = await import("@/infrastructure/storage/StorageManager");

const app = new Elysia()
  .use(ErrorHandler)
  .use(RouterOrganization)
  .use(RouterUser)
  .use(RouterStorage);

const send = (method: string, path: string, cookie: string, body: unknown) =>
  app.handle(
    new Request(`http://localhost${path}`, {
      method,
      headers: { "content-type": "application/json", Cookie: cookie },
      body: JSON.stringify(body),
    }),
  );

/** 400 validation error naming `field` (never a database error). */
const expectFieldError = async (res: Response, field: string) => {
  expect(res.status).toBe(400);
  const body: { message?: string; details?: Array<{ field: string }> } =
    await res.json();
  expect(body.message).toBe("Validation failed");
  expect(body.details?.map((d) => d.field)).toContain(field);
};

describe("QLT-11: inputs are bounded by their columns", () => {
  it("[QLT-11] organization fields: displayName 255, phone 50, currency 3", async () => {
    const admin = await createTestUser(EUserRole.ADMIN);
    const cookie = admin.headers.Cookie;
    await expectFieldError(
      await send("PUT", "/organization", cookie, {
        displayName: "d".repeat(256),
      }),
      "displayName",
    );
    await expectFieldError(
      await send("PUT", "/organization", cookie, { phone: "1".repeat(51) }),
      "phone",
    );
    await expectFieldError(
      await send("PUT", "/organization", cookie, { currency: "EURO" }),
      "currency",
    );
  });

  it("[QLT-11] a 256-character user name → 400", async () => {
    const admin = await createTestUser(EUserRole.ADMIN);
    await expectFieldError(
      await send("POST", "/user", admin.headers.Cookie, {
        name: "u".repeat(256),
        email: `u_${crypto.randomUUID().slice(0, 8)}@example.com`,
        role: EUserRole.USER,
        password: "a-long-enough-password",
      }),
      "name",
    );
    await expectFieldError(
      await send("PUT", `/user/${admin.user.id}`, admin.headers.Cookie, {
        name: "u".repeat(256),
      }),
      "name",
    );
  });

  it("[QLT-11] an uploaded file name longer than 255 characters → 400 before anything is stored", async () => {
    const put = spyOn(StorageManager.default, "upload").mockImplementation(() =>
      Promise.resolve(),
    );
    put.mockClear();
    const png = new Uint8Array([
      137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1,
      0, 0, 0, 1, 8, 6, 0, 0, 0, 31, 21, 196, 137, 0, 0, 0, 10, 73, 68, 65, 84,
      120, 156, 99, 0, 1, 0, 0, 5, 0, 1, 13, 10, 45, 180, 0, 0, 0, 0, 73, 69,
      78, 68, 174, 66, 96, 130,
    ]);
    const form = new FormData();
    form.append(
      "file",
      new File([png], `${"n".repeat(252)}.png`, { type: "image/png" }),
    );
    const res = await app.handle(
      new Request("http://localhost/storage/upload", {
        method: "POST",
        headers: { Cookie: (await testHeaders()).Cookie },
        body: form,
      }),
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: "Bad Request",
      message: "File name is longer than 255 characters",
    });
    expect(put).not.toHaveBeenCalled();
  });
});
