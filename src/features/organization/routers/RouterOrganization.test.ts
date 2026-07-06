import { describe, it, expect } from "bun:test";
import { treaty } from "@elysiajs/eden";
import { testHeaders } from "@/common/tests/TestManager.test";
import { RouterOrganization } from "./RouterOrganization";

const api = treaty(RouterOrganization);

describe("RouterOrganization", () => {
  it("Get organization profile", async () => {
    const headers = await testHeaders();

    const res = await api.organization.get({ headers });

    expect(res.data).toStrictEqual({
      logoId: null,
      createdAt: expect.any(Date),
      id: expect.any(String),
      fullName: "Acme Corporation Inc.",
      displayName: "Acme Corp",
      tagline: null,
      email: null,
      phone: "+1-800-555-0199",
      address: "123 Acme Way, Cityville, ST 12345",
      workingHours: null,
      copyright: null,
      domain: null,
      country: null,
      city: null,
      state: null,
      zipCode: null,
      taxId: null,
      currency: "USD",
      timezone: "UTC",
      links: [
        "https://twitter.com/acmecorp",
        "https://linkedin.com/company/acmecorp",
      ],
    });
  });

  it("Update organization profile", async () => {
    const headers = await testHeaders();

    const res = await api.organization.put(
      {
        displayName: "Acme Corp Updated",
        address: "New Address",
      },
      { headers },
    );

    expect(res.status).toBe(200);
    expect(res.data?.displayName).toBe("Acme Corp Updated");
    expect(res.data?.address).toBe("New Address");

    await api.organization.put(
      {
        displayName: "Acme Corp",
      },
      { headers },
    );
  });
});
