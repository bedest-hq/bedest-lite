import { Elysia } from "elysia";
import Context from "@/app/Context";
import { EUserRole } from "@f/user/enums/EUserRole";
import { IApp } from "bedest-core";
import ServiceOrganization from "../services/ServiceOrganization";
import {
  VOrganization,
  VOrganizationPublic,
  VOrganizationUpdate,
} from "../validations/VOrganization";
import EnvManager from "@/infrastructure/env/EnvManager";

export const RouterOrganization = new Elysia({
  prefix: "/organization",
  tags: ["Organization"],
})
  .use(Context.App())
  .get(
    "/",
    async ({ db, nowDatetime }) => {
      const publicRuntime: IApp = { db, nowDatetime };
      const { taxId, ...profile } =
        await ServiceOrganization.getSelf(publicRuntime);
      // The public site profile omits the tax id unless configured [BUG-17].
      return EnvManager.get().ORGANIZATION_PUBLIC_TAX_ID
        ? { ...profile, taxId }
        : profile;
    },
    {
      response: VOrganizationPublic,
    },
  )
  .guard({}, (app) =>
    app.use(Context.User()).guard(
      {
        RoleGuard: [EUserRole.ADMIN, EUserRole.SYSTEM],
      },
      (authApp) =>
        authApp.put(
          "/",
          async ({ body, userRuntime }) => {
            // Create or update the single organization [BUG-17].
            await ServiceOrganization.upsert(userRuntime, body);
            return await ServiceOrganization.getSelf(userRuntime);
          },
          {
            body: VOrganizationUpdate,
            response: VOrganization,
            audit: { entity: "organization" },
          },
        ),
    ),
  );
