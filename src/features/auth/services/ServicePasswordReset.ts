import { and, eq, sql } from "drizzle-orm";
import { IApp } from "bedest-core";
import { UtilHttp } from "@/common/utils/UtilHttp";
import { logger } from "@/infrastructure/logger/logger";
import MailManager from "@/infrastructure/mail/MailManager";
import { MailTemplates } from "@/infrastructure/mail/MailTemplates";
import { SUser } from "@f/user/schemas/SUser";
import { EUserStatus } from "@f/user/enums/EUserStatus";
import { UtilEmail } from "@f/user/utils/UtilEmail";
import ServiceSession from "@f/session/services/ServiceSession";
import ServiceSystemLog from "@f/system/services/ServiceSystemLog";
import { EUserTokenType } from "../enums/EUserTokenType";
import ServiceUserToken from "./ServiceUserToken";
import ServiceLoginLockout, { emailHashOf } from "./ServiceLoginLockout";

/** A reset link is valid for 30 minutes [FEAT-06]. */
export const PASSWORD_RESET_TTL_MS = 30 * 60 * 1000;

const DUMMY_HASH = await Bun.password.hash("forgot_password_dummy");

class ServicePasswordReset {
  /**
   * Starts a password reset [FEAT-06]. The caller always answers 202: every
   * call spends one password hash and the e-mail is sent in the background,
   * so neither the answer nor its timing tells whether the address exists.
   * Only ACTIVE users get a link.
   */
  async forgot(c: IApp, emailInput: string) {
    const email = UtilEmail.normalize(emailInput);
    await Bun.password.verify("forgot_password_dummy", DUMMY_HASH);

    const issued = await c.db.transaction(async (tx) => {
      const [user] = await tx
        .select({ id: SUser.id, email: SUser.email })
        .from(SUser)
        .where(
          and(
            sql`lower(${SUser.email}) = ${email}`,
            eq(SUser.isDeleted, false),
            eq(SUser.status, EUserStatus.ACTIVE),
          ),
        )
        .limit(1);
      if (!user) {
        return null;
      }
      const token = await ServiceUserToken.issue(tx, {
        userId: user.id,
        type: EUserTokenType.PASSWORD_RESET,
        ttlMs: PASSWORD_RESET_TTL_MS,
        now: c.nowDatetime,
      });
      return { to: user.email, token };
    });

    if (issued) {
      const msg = MailTemplates.passwordReset(
        issued.to,
        MailManager.link("/reset-password", issued.token),
        PASSWORD_RESET_TTL_MS / 60_000,
      );
      void MailManager.send(msg).catch((err: unknown) => {
        logger.error({ err }, "[FEAT-06] password reset e-mail not sent");
      });
    }
  }

  /**
   * Completes a reset [FEAT-06]: the token is single-use; the new password
   * is stored, every session and socket of the user is revoked, the login
   * lockout is cleared and PASSWORD_RESET is audited.
   */
  async reset(c: IApp, token: string, password: string) {
    const user = await c.db.transaction(async (tx) => {
      const owner = await ServiceUserToken.consume(
        tx,
        token,
        EUserTokenType.PASSWORD_RESET,
        c.nowDatetime,
      );
      if (!owner) {
        return null;
      }
      const hash = await Bun.password.hash(password);
      const [row] = await tx
        .update(SUser)
        .set({ password: hash, updatedAt: c.nowDatetime })
        .where(
          and(
            eq(SUser.id, owner.userId),
            eq(SUser.isDeleted, false),
            eq(SUser.status, EUserStatus.ACTIVE),
          ),
        )
        .returning({ id: SUser.id, email: SUser.email });
      return row ?? null;
    });

    if (!user) {
      throw UtilHttp.fail(400, "Invalid or expired token");
    }

    await ServiceSession.revokeUserSessions(c, user.id);
    await ServiceLoginLockout.reset(
      c,
      emailHashOf(UtilEmail.normalize(user.email)),
    );
    await ServiceSystemLog.logEvent(c.db, {
      userId: user.id,
      action: "PASSWORD_RESET",
      entity: "user",
      entityId: user.id,
      payload: {},
    });
  }
}

export default new ServicePasswordReset();
