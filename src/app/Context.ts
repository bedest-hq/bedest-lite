import { jwt } from "@elysiajs/jwt";
import Elysia, { status } from "elysia";
import { t } from "elysia";
import { EUserRole } from "@/features/user/enums/EUserRole";
import DbManager from "@/infrastructure/database/DbManager";
import EnvManager from "@/infrastructure/env/EnvManager";
import ServiceSystem from "@f/system/services/ServiceSystem";
import { UtilAuth } from "@f/auth/utils/UtilAuth";
import { VJwtPayload } from "@f/auth/validations/VJwtPayload";
import { PluginAudit } from "@f/system/plugins/PluginAudit";
import { ISession, IUserApp, MacroRoleGuard } from "bedest-core";

class Context {
  private env = EnvManager.get();

  private refreshPlugin = jwt({
    name: "refreshJwt",
    secret: this.env.REFRESH_KEY!,
    exp: "7d",
    iat: true,
    schema: VJwtPayload,
  });

  private accessPlugin = jwt({
    name: "accessJwt",
    secret: this.env.SECRET_KEY!,
    exp: "15m",
    iat: true,
    schema: VJwtPayload,
  });

  App() {
    const db = DbManager.get();
    return (app: Elysia) =>
      app
        .decorate("db", db)
        .derive(() => ({ nowDatetime: new Date() }))
        .use(this.refreshPlugin)
        .use(this.accessPlugin);
  }

  User() {
    return (app: Elysia) =>
      app
        .use(this.App())
        .guard({
          cookie: t.Cookie({ accessToken: t.Optional(t.String()) }),
        })
        .derive(async ({ accessJwt, nowDatetime, cookie }) => {
          const db = DbManager.get();
          const token = cookie.accessToken.value;
          const payload = await UtilAuth.validateAccessToken(accessJwt, token);

          if (
            ServiceSystem.getMaintenance() &&
            payload.role !== EUserRole.SYSTEM
          ) {
            throw status("Service Unavailable");
          }

          const session: ISession = {
            userId: payload.userId,
            sessionId: payload.sessionId,
            role: payload.role,
            isSuperUser: payload.role === EUserRole.SYSTEM,
          };

          const userRuntime: IUserApp = {
            db,
            nowDatetime,
            session,
          } as IUserApp;

          return { userRuntime };
        })
        .macro("RoleGuard", MacroRoleGuard)
        .use(PluginAudit);
  }
}

export default new Context();
