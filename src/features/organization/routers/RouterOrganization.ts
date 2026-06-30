import { Elysia } from "elysia";
import Context from "@/app/Context";
import { EUserRole } from "@f/user/enums/EUserRole";
import ServiceOrganization from "../services/ServiceOrganization";
import {
  VOrganization,
  VOrganizationUpdate,
} from "../validations/VOrganization";

export const RouterOrganization = new Elysia({
  prefix: "/organization",
  tags: ["Organization"],
})
  .use(Context.User())
  .get(
    "/",
    async ({ userRuntime }) => {
      const res = await ServiceOrganization.getSelf(userRuntime);
      return res;
    },
    {
      response: VOrganization,
    },
  )
  .guard(
    {
      RoleGuard: [EUserRole.ADMIN, EUserRole.SYSTEM],
    },
    (app) =>
      app.put(
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
  );
