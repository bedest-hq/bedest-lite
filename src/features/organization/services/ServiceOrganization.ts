import { UtilHttp } from "@/common/utils/UtilHttp";
import { and, eq } from "drizzle-orm";
import { SOrganization } from "../schemas/SOrganization";
import { IApp, IUserApp, ServiceBase } from "bedest-core";

type TOrganizationUpdate = Partial<
  Omit<
    typeof SOrganization.$inferInsert,
    "id" | "singleton" | "createdAt" | "updatedAt" | "isDeleted" | "deletedAt"
  >
>;

const activeOrganization = eq(SOrganization.isDeleted, false);

class ServiceOrganization extends ServiceBase<typeof SOrganization, string> {
  constructor() {
    super(SOrganization);
  }

  async getSelf(c: IApp) {
    const [org] = await c.db
      .select({
        id: SOrganization.id,
        displayName: SOrganization.displayName,
        fullName: SOrganization.fullName,
        tagline: SOrganization.tagline,
        email: SOrganization.email,
        phone: SOrganization.phone,
        address: SOrganization.address,
        workingHours: SOrganization.workingHours,
        copyright: SOrganization.copyright,
        domain: SOrganization.domain,
        country: SOrganization.country,
        city: SOrganization.city,
        state: SOrganization.state,
        zipCode: SOrganization.zipCode,
        taxId: SOrganization.taxId,
        currency: SOrganization.currency,
        timezone: SOrganization.timezone,
        logoId: SOrganization.logoId,
        links: SOrganization.links,
        createdAt: SOrganization.createdAt,
      })
      .from(SOrganization)
      .where(activeOrganization)
      .limit(1);

    if (!org) {
      throw UtilHttp.fail(404, "Organization profile not found");
    }

    return org;
  }

  /**
   * Creates the organization or updates the one active row, in one
   * transaction [BUG-17]. The unique index on `singleton` (active rows)
   * makes a concurrent second insert a no-op; the loser then updates the
   * winner's row. Creating needs displayName and fullName.
   */
  async upsert(c: IUserApp, data: TOrganizationUpdate): Promise<string> {
    const values = Object.fromEntries(
      Object.entries(data).filter(([, value]) => value !== undefined),
    );
    if (Object.keys(values).length === 0) {
      throw UtilHttp.fail(400, "No fields to update");
    }

    return await c.db.transaction(async (tx) => {
      const update = async (id: string) => {
        await tx
          .update(SOrganization)
          .set({ ...values, updatedAt: c.nowDatetime })
          .where(and(eq(SOrganization.id, id), activeOrganization));
        return id;
      };

      const [existing] = await tx
        .select({ id: SOrganization.id })
        .from(SOrganization)
        .where(activeOrganization)
        .limit(1)
        .for("update");
      if (existing) {
        return await update(existing.id);
      }

      const { displayName, fullName } = data;
      if (!displayName || !fullName) {
        throw UtilHttp.fail(
          400,
          "displayName and fullName are required to create the organization",
        );
      }

      const [created] = await tx
        .insert(SOrganization)
        .values({ ...data, displayName, fullName, createdAt: c.nowDatetime })
        .onConflictDoNothing()
        .returning({ id: SOrganization.id });
      if (created) {
        return created.id;
      }

      // Another request created it first: update that row instead.
      const [winner] = await tx
        .select({ id: SOrganization.id })
        .from(SOrganization)
        .where(activeOrganization)
        .limit(1);
      if (!winner) {
        throw UtilHttp.fail(500);
      }
      return await update(winner.id);
    });
  }
}

export default new ServiceOrganization();
