import Elysia from "elysia";
import { RouterUser } from "../features/user/routers/RouterUser";
import { Swagger } from "./Swagger";
import { RouterAuth } from "@f/auth/routers/RouterAuth";
import { RouterSystem } from "@f/system/routers/RouterSystem";
import { RouterStorage } from "@f/storage/routers/RouterStorage";
import { RouterNotification } from "@f/notification/routers/RouterNotification";
import { RouterOrganization } from "@f/organization/routers/RouterOrganization";

const v1 = new Elysia({ prefix: "/v1" })
  .use(RouterAuth)
  .use(RouterUser)
  .use(RouterStorage)
  .use(RouterSystem)
  .use(RouterOrganization)
  .use(RouterNotification);

export const Router = new Elysia({ prefix: "/api" }).use(Swagger).use(v1);
