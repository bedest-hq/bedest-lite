import { Elysia } from "elysia";
import EnvManager from "./infrastructure/env/EnvManager";
import { UtilEnv } from "./infrastructure/env/UtilEnv";
import DbManager from "./infrastructure/database/DbManager";
import { ErrorHandler } from "./infrastructure/error/ErrorHandler";
import cors from "@elysiajs/cors";
import { logger } from "./infrastructure/logger/logger";
import WsManager from "./infrastructure/websocket/WsManager";
import { checkForUpdates } from "./infrastructure/update/UpdateChecker";

const env = EnvManager.init();

DbManager.init(env);

// Superuser connections silently ignore the two-role model.
const roleWarning = await DbManager.verifyRuntimeRole(
  DbManager.get(),
  env.NODE_ENV,
);

const { Router } = await import("./app/Router");

export const app = new Elysia()
  .use(
    cors({
      origin: env.NODE_ENV === "production" ? UtilEnv.corsOrigins(env) : true,
      credentials: true,
    }),
  )
  .use(ErrorHandler)
  .get("/favicon.ico", () => Bun.file("public/favicon.ico"))
  .use(Router)
  .listen(env.PORT);

if (app.server) {
  WsManager.init(app.server);
}

for (const warning of [
  ...EnvManager.getWarnings(),
  ...(roleWarning ? [roleWarning] : []),
]) {
  logger.warn(warning);
}

logger.info("✨ Hello Bedest Lite ✨");
logger.info(
  `⚡ Elysia is running at http://${app.server?.hostname}:${app.server?.port}`,
);
logger.info(
  `📖 For API Documentation http://${app.server?.hostname}:${app.server?.port}/api/docs`,
);

void checkForUpdates();
