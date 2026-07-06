import { EUserRole } from "../../features/user/enums/EUserRole";
import {
  SYSTEM_EMAIL,
  SYSTEM_USER_NAME,
  SYSTEM_USER_PASSWORD,
} from "../../common/constants";
import ServiceUser from "@/features/user/services/ServiceUser";
import ServiceOrganization from "@/features/organization/services/ServiceOrganization";
import DbManager from "@/infrastructure/database/DbManager";
import ContextBuilder from "../context/ContextBuilder";

export async function seed() {
  const { userContext } = ContextBuilder.build();

  await ServiceUser.create(userContext, {
    name: SYSTEM_USER_NAME,
    email: SYSTEM_EMAIL,
    password: SYSTEM_USER_PASSWORD,
    role: EUserRole.SYSTEM,
  });

  await ServiceOrganization.create(userContext, {
    displayName: "Acme Corp",
    fullName: "Acme Corporation Inc.",
    phone: "+1-800-555-0199",
    address: "123 Acme Way, Cityville, ST 12345",
    links: ["https://twitter.com/acmecorp", "https://linkedin.com/company/acmecorp"],
  });

  await DbManager.shutdown();
}

await seed();
