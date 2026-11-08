import { PGlite, type Transaction } from "@electric-sql/pglite";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { sql } from "drizzle-orm";
import {
  afterAll,
  afterEach,
  beforeEach,
  spyOn,
  expect,
  beforeAll,
} from "bun:test";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { TEnv } from "../types/TEnv";
import { SUser } from "@f/user/schemas/SUser";
import { EUserRole } from "@/features/user/enums/EUserRole";
import Elysia from "elysia";
import jwt from "@elysiajs/jwt";
import { password } from "bun";
import { SSession } from "@f/session/schemas/SSession";

const EnvManager = await import("@/infrastructure/env/EnvManager");
const DbManager = await import("@/infrastructure/database/DbManager");

interface CustomMatchers<R = unknown> {
  toBeApiError(expected: string): R;
  toBeApiOk(): R;
}

declare module "bun:test" {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface Matchers<T> extends CustomMatchers<T> {}
}

expect.extend({
  toBeApiOk(received: unknown) {
    const isNot = this.isNot;
    const res = received as { error?: string };
    return {
      pass: res.error === undefined,
      message: () => (isNot ? "Response is ok" : "Response is not ok."),
      actual: res.error,
      expected: "OK",
    };
  },
  toBeApiError(received: unknown, expected: string) {
    const isNot = this.isNot;
    const res = received as { error?: string };
    return {
      pass: res.error !== undefined && res.error === expected,
      message: () =>
        res.error === undefined
          ? isNot
            ? "Response is failed"
            : "Response is not failed."
          : isNot
            ? "Fail code matches."
            : "Fail code mismatch.",
      actual: res.error === undefined ? "OK" : res.error,
      expected,
    };
  },
});

const test_env: TEnv = {
  NODE_ENV: "test",
  CORS_ORIGINS: "http://localhost:3000",
  DATABASE_HOST: "test_host",
  DATABASE_NAME: "test_name",
  DATABASE_PASSWORD: "test_password",
  DATABASE_PORT: 3000,
  DATABASE_USER: "test_user",
  REFRESH_KEY: "test-refresh-key-at-least-32-characters-long",
  SECRET_KEY: "test-access-key-at-least-32-characters-long",
  PORT: 3000,
  MAX_REQUEST_BODY_BYTES: 10 * 1024 * 1024,
  SHUTDOWN_TIMEOUT_MS: 15000,

  TRUST_PROXY_HOPS: 0,
  RATE_LIMIT_LOGIN_PER_MIN: 5,
  RATE_LIMIT_LOGIN_IP_PER_MIN: 20,
  RATE_LIMIT_REFRESH_PER_MIN: 30,
  LOCAL_STORAGE_PATH: "./test_uploads",
  S3_ENDPOINT: "http://localhost:9000",
  S3_REGION: "us-east-1",
  S3_ACCESS_KEY: "testkey",
  S3_SECRET_KEY: "testsecret",
  S3_BUCKET: "test-bucket",
};

const test_client = new PGlite();
/** Superuser connection: migrations, fixtures and assertions only. */
const test_db = drizzle(test_client);

/**
 * The application's connection: every statement runs inside a transaction
 * as the non-privileged `bedest_app` role, exactly like the production
 * login, so the grants (e.g. append-only audit rows) are really enforced.
 */
const appClient = new Proxy(test_client, {
  get(target, prop) {
    if (prop === "query") {
      return (...args: Parameters<PGlite["query"]>) =>
        target.transaction(async (tx) => {
          await tx.exec("SET LOCAL ROLE bedest_app");
          return await tx.query(...args);
        });
    }
    if (prop === "transaction") {
      return <T>(fn: (tx: Transaction) => Promise<T>) =>
        target.transaction(async (tx) => {
          await tx.exec("SET LOCAL ROLE bedest_app");
          return await fn(tx);
        });
    }
    const value: unknown = Reflect.get(target, prop, target);
    return typeof value === "function" ? value.bind(target) : value;
  },
});
const test_app_db = drizzle({ client: appClient });

// drizzle's PGlite and node-postgres database types are not mutually
// assignable although the runtime API is the same (see CORE-10).
const asNodePg = (db: PgliteDatabase): NodePgDatabase =>
  db as unknown as NodePgDatabase;

/** Superuser handle typed like the app's database (for script functions). */
export const test_owner_db = asNodePg(test_db);

spyOn(EnvManager.default, "get").mockReturnValue(test_env);
spyOn(DbManager.default, "get").mockReturnValue(asNodePg(test_app_db));

// Imported after the spies: it pulls in modules that read the env on import.
const RateLimitManager = await import(
  "@/infrastructure/ratelimit/RateLimitManager"
);
const ServiceSession = await import("@f/session/services/ServiceSession");
const ServiceSystem = await import("@f/system/services/ServiceSystem");

const test_signer = new Elysia().use(
  jwt({
    name: "accessJwt",
    secret: test_env.SECRET_KEY,
    exp: "15m",
  }),
);

export let test_user: typeof SUser.$inferSelect;
export { test_db, test_env };

export const testHeaders = async (user = test_user) => {
  if (!user) {
    throw new Error("Test user is not initialized yet!");
  }

  // A real session row: the access path verifies that the session exists
  // [SEC-08].
  const [session] = await test_db
    .insert(SSession)
    .values({
      userId: user.id,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    })
    .returning({ id: SSession.id });

  const token = await test_signer.decorator.accessJwt.sign({
    userId: user.id,
    sessionId: session.id,
    role: user.role,
  });

  return {
    Cookie: `accessToken=${token}`,
  };
};

let pass: string;

export const createTestUser = async (userRole = EUserRole.USER) => {
  const [createdUser] = await test_db
    .insert(SUser)
    .values({
      name: `Test User ${userRole}`,
      email: `user_${crypto.randomUUID().slice(0, 8)}@example.com`,
      password: pass,
      role: userRole,
      createdAt: new Date(),
    })
    .returning();

  const headers = await testHeaders(createdUser);
  return { user: createdUser, headers };
};
beforeAll(async () => {
  await migrate(test_db, { migrationsFolder: "drizzle" });
  pass = await password.hash("test_password");
});

beforeEach(async () => {
  const [insertedUser] = await test_db
    .insert(SUser)
    .values({
      name: "Test User",
      email: "text@example.com",
      password: pass,
      role: EUserRole.SYSTEM,
      createdAt: new Date(),
    })
    .returning();

  test_user = insertedUser;

  const { SOrganization } = await import("@f/organization/schemas/SOrganization");
  await test_db.insert(SOrganization).values({
    displayName: "Acme Corp",
    fullName: "Acme Corporation Inc.",
    phone: "+1-800-555-0199",
    address: "123 Acme Way, Cityville, ST 12345",
    links: ["https://twitter.com/acmecorp", "https://linkedin.com/company/acmecorp"],
  });
});

afterEach(async () => {
  await RateLimitManager.default.resetAll();
  ServiceSession.default.clearCache();
  ServiceSystem.default.invalidate();
  await test_db.execute(sql`
    DO $$ DECLARE
      r RECORD;
    BEGIN
      FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        EXECUTE 'TRUNCATE TABLE public.' || quote_ident(r.tablename) || ' CASCADE;';
      END LOOP;
    END $$;
  `);
});

afterAll(async () => {
  await test_client.close();
});
