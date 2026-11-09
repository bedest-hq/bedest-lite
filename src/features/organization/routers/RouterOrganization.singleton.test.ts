import { describe, it, expect, beforeEach, spyOn } from "bun:test";
import { Elysia } from "elysia";
import { eq } from "drizzle-orm";
import {
  createTestUser,
  test_db,
  test_env,
} from "@/common/tests/TestManager.test";
import EnvManager from "@/infrastructure/env/EnvManager";
import { ErrorHandler } from "@/infrastructure/error/ErrorHandler";
import { EUserRole } from "@f/user/enums/EUserRole";
import { SOrganization } from "../schemas/SOrganization";
import { RouterOrganization } from "./RouterOrganization";

const app = new Elysia().use(ErrorHandler).use(RouterOrganization);

const put = (body: unknown, cookie: string) =>
  app.handle(
    new Request("http://localhost/organization", {
      method: "PUT",
      headers: { "content-type": "application/json", Cookie: cookie },
      body: JSON.stringify(body),
    }),
  );

const get = () => app.handle(new Request("http://localhost/organization"));

const rows = () =>
  test_db
    .select({ id: SOrganization.id, displayName: SOrganization.displayName })
    .from(SOrganization)
    .where(eq(SOrganization.isDeleted, false));

const PROFILE = { displayName: "Acme", fullName: "Acme Inc.", taxId: "DE123" };

describe("BUG-17: the organization is a singleton", () => {
  beforeEach(async () => {
    await test_db.delete(SOrganization);
  });

  it("[BUG-17] GET is 404 until the organization exists", async () => {
    expect((await get()).status).toBe(404);
  });

  it("[BUG-17] PUT on an empty database creates it; a second PUT updates the same row", async () => {
    const admin = await createTestUser(EUserRole.ADMIN);

    const created = await put(PROFILE, admin.headers.Cookie);
    expect(created.status).toBe(200);
    const first = await rows();
    expect(first).toHaveLength(1);

    const updated = await put({ displayName: "Acme 2" }, admin.headers.Cookie);
    expect(updated.status).toBe(200);
    expect(await updated.json()).toMatchObject({
      displayName: "Acme 2",
      fullName: "Acme Inc.",
    });
    expect(await rows()).toEqual([{ id: first[0].id, displayName: "Acme 2" }]);
  });

  it("[BUG-17] creating needs displayName and fullName (400, nothing written)", async () => {
    const admin = await createTestUser(EUserRole.ADMIN);
    const res = await put({ tagline: "hello" }, admin.headers.Cookie);
    expect(res.status).toBe(400);
    expect(await rows()).toEqual([]);
  });

  it("[BUG-17] concurrent PUTs leave exactly one row", async () => {
    const admin = await createTestUser(EUserRole.ADMIN);
    const results = await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        put({ ...PROFILE, displayName: `Acme ${i}` }, admin.headers.Cookie),
      ),
    );
    expect(results.map((r) => r.status)).toEqual([200, 200, 200, 200, 200]);
    expect(await rows()).toHaveLength(1);
  });

  it("[BUG-17] the database refuses a second active organization", async () => {
    await test_db
      .insert(SOrganization)
      .values({ displayName: "A", fullName: "A" });
    let failure: unknown = null;
    try {
      await test_db
        .insert(SOrganization)
        .values({ displayName: "B", fullName: "B" });
    } catch (err) {
      failure = err;
    }
    const cause: unknown =
      typeof failure === "object" && failure !== null && "cause" in failure
        ? failure.cause
        : null;
    expect(cause).toMatchObject({ code: "23505" });
  });

  it("[BUG-17] the public GET omits taxId unless ORGANIZATION_PUBLIC_TAX_ID=true", async () => {
    const admin = await createTestUser(EUserRole.ADMIN);
    await put(PROFILE, admin.headers.Cookie);

    const hidden: Record<string, unknown> = await (await get()).json();
    expect("taxId" in hidden).toBe(false);

    const envSpy = spyOn(EnvManager, "get").mockReturnValue({
      ...test_env,
      ORGANIZATION_PUBLIC_TAX_ID: true,
    });
    try {
      expect(await (await get()).json()).toMatchObject({ taxId: "DE123" });
    } finally {
      envSpy.mockReturnValue(test_env);
    }
  });
});
