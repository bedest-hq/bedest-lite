import Elysia from "elysia";
import { RouterUser } from "../features/user/routers/RouterUser";
import { createDocs, shouldServeDocs } from "./Swagger";
import { RouterAuth } from "@f/auth/routers/RouterAuth";
import { RouterSystem } from "@f/system/routers/RouterSystem";
import { RouterStorage } from "@f/storage/routers/RouterStorage";
import { RouterNotification } from "@f/notification/routers/RouterNotification";
import { RouterOrganization } from "@f/organization/routers/RouterOrganization";
import { RouterHealth } from "@f/health/routers/RouterHealth";
import { TEnv } from "@/common/types/TEnv";

export const createRouter = (
  env: Pick<TEnv, "NODE_ENV" | "ENABLE_API_DOCS">,
) => {
  const v1 = new Elysia({ prefix: "/v1" })
    .use(RouterAuth)
    .use(RouterUser)
    .use(RouterStorage)
    .use(RouterSystem)
    .use(RouterOrganization)
    .use(RouterNotification);

  // Health lives outside /api/v1 (FEAT-01).
  const api = new Elysia({ prefix: "/api" }).use(RouterHealth).use(v1);

  if (shouldServeDocs(env)) {
    api.use(createDocs());
  }

  return api;
};
