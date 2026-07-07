import { Elysia } from "elysia";
import Context from "@/app/Context";
import { EUserRole } from "@f/user/enums/EUserRole";
import { IUserApp } from "bedest-core";
import ServiceOrganization from "../services/ServiceOrganization";
import {
  VOrganization,
  VOrganizationUpdate,
} from "../validations/VOrganization";

export const RouterOrganization = new Elysia({
  prefix: "/organization",
  tags: ["Organization"],
})
  .use(Context.App())
  .get(
    "/",
    async ({ db, nowDatetime }) => {
      const publicRuntime = { db, nowDatetime } as unknown as IUserApp;
      const res = await ServiceOrganization.getSelf(publicRuntime);
      return res;
    },
    {
      response: VOrganization,
    },
  )
  .guard({}, (app) =>
    app
      .use(Context.User())
      .guard(
        {
          RoleGuard: [EUserRole.ADMIN, EUserRole.SYSTEM],
        },
        (authApp) =>
          authApp.put(
            "/",
            async ({ body, userRuntime }) => {
              const organization = await ServiceOrganization.getSelf(userRuntime);
              await ServiceOrganization.update(userRuntime, organization.id, body);
              const res = await ServiceOrganization.getSelf(userRuntime);
              return res;
            },
            {
              body: VOrganizationUpdate,
              response: VOrganization,
              audit: true,
            },
          ),
      ),
  );
