import { t } from "elysia";
import { VString, VId } from "bedest-core";

export const VOrganization = t.Object({
  id: VString,
  displayName: VString,
  fullName: VString,
  phone: t.Nullable(VString),
  address: t.Nullable(t.String()),
  logoId: t.Nullable(VId),
  links: t.Nullable(t.Array(t.String())),
  createdAt: t.Date(),
});

export const VOrganizationUpdate = t.Object({
  displayName: t.Optional(VString),
  fullName: t.Optional(VString),
  phone: t.Optional(t.Nullable(VString)),
  address: t.Optional(t.Nullable(t.String())),
  logoId: t.Optional(t.Nullable(VId)),
  links: t.Optional(t.Nullable(t.Array(t.String()))),
});
