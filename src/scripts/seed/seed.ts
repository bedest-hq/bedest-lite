import { EUserRole } from "../../features/user/enums/EUserRole";
import {
  SYSTEM_EMAIL,
  SYSTEM_USER_NAME,
  SYSTEM_USER_PASSWORD,
} from "../../common/constants";
import ServiceUser from "@/features/user/services/ServiceUser";
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

  await DbManager.shutdown();
}

await seed();
