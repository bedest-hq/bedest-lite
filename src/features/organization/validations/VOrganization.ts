import { t } from "elysia";
import { VString, VId, VStr } from "bedest-core";

export const VOrganization = t.Object({
  id: VString,
  displayName: VString,
  fullName: VString,
  tagline: t.Nullable(VString),
  email: t.Nullable(VString),
  phone: t.Nullable(VString),
  address: t.Nullable(t.String()),
  workingHours: t.Nullable(VString),
  copyright: t.Nullable(VString),
  domain: t.Nullable(VString),
  country: t.Nullable(VString),
  city: t.Nullable(VString),
  state: t.Nullable(VString),
  zipCode: t.Nullable(VString),
  taxId: t.Nullable(VString),
  currency: t.Nullable(VString),
  timezone: t.Nullable(VString),
  logoId: t.Nullable(VId),
  links: t.Nullable(t.Array(t.String())),
  createdAt: t.Date(),
});

export const VOrganizationUpdate = t.Object({
  // Bounded by SOrganization's columns (varchar(n) → VStr(n)) [QLT-11].
  displayName: t.Optional(VStr(255)),
  fullName: t.Optional(VStr(255)),
  tagline: t.Optional(t.Nullable(VStr(255))),
  email: t.Optional(t.Nullable(VStr(255))),
  phone: t.Optional(t.Nullable(VStr(50))),
  address: t.Optional(t.Nullable(t.String({ maxLength: 2000 }))),
  workingHours: t.Optional(t.Nullable(VStr(255))),
  copyright: t.Optional(t.Nullable(VStr(255))),
  domain: t.Optional(t.Nullable(VStr(255))),
  country: t.Optional(t.Nullable(VStr(255))),
  city: t.Optional(t.Nullable(VStr(255))),
  state: t.Optional(t.Nullable(VStr(255))),
  zipCode: t.Optional(t.Nullable(VStr(255))),
  taxId: t.Optional(t.Nullable(VStr(255))),
  currency: t.Optional(t.Nullable(VStr(3, 3))),
  timezone: t.Optional(t.Nullable(VStr(255))),
  logoId: t.Optional(t.Nullable(VId)),
  links: t.Optional(t.Nullable(t.Array(VStr(255), { maxItems: 20 }))),
});

/** GET /organization (public): taxId only with ORGANIZATION_PUBLIC_TAX_ID [BUG-17]. */
export const VOrganizationPublic = t.Object({
  ...t.Omit(VOrganization, ["taxId"]).properties,
  taxId: t.Optional(t.Nullable(VString)),
});
