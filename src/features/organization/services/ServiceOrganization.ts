import { SOrganization } from "../schemas/SOrganization";
import { IUserApp, ServiceBase } from "bedest-core";
import { status } from "elysia";

class ServiceOrganization extends ServiceBase<typeof SOrganization, string> {
  constructor() {
    super(SOrganization);
  }

  async getSelf(c: IUserApp) {
    const orgs = await super.getAll(
      c,
      { limit: 1, page: 1 },
      {
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
      },
    );

    if (orgs.data.length === 0) {
      throw status("Not Found", { message: "Organization profile not found" });
    }

    return orgs.data[0];
  }
}

export default new ServiceOrganization();
