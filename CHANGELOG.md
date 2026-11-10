# Changelog

## Unreleased

Remediation release: security, correctness, operations and the missing account features. IDs refer to the remediation ledger.

### ⚠ Breaking changes

* **Environment.** `NODE_ENV` is required (no default) [SEC-02]; values are type-checked and every problem is reported at once [SEC-16]; `SECRET_KEY`/`REFRESH_KEY` need ≥ 32 characters, must differ and cannot be the `.env.example` placeholders in production. `CORS_ORIGINS` replaces `CORS_ORIGIN` (still read with a warning) [SEC-18]; `DATABASE_SSL_MODE` replaces `DATABASE_SSL` and defaults to `verify-full` in production [SEC-15]. New required `MAIL_PROVIDER` and `APP_PUBLIC_URL` [FEAT-06].
* **Database roles.** The API must connect as a member of `bedest_app` (`ProvisionRoles`); migrations run as the schema owner (`DATABASE_MIGRATION_*`) [SEC-04]. Production refuses to start as a superuser.
* **Auth.** No credential fallbacks [SEC-01]; `POST /auth/refresh` returns `{ success: true }` only [SEC-14]; the refresh cookie is `Path=/api/v1/auth; SameSite=Strict` and tokens carry `iss`/`aud`/`typ` — users sign in once after the deploy [SEC-24]. New passwords need 12–128 characters [SEC-23].
* **Errors.** Every error body is `{ error, message?, details?, requestId? }` [BUG-14].
* **Audit.** Routes configure `audit: { entity, action? }` (no `audit: true`) [BUG-11]; audit rows are append-only [FEAT-13].
* **Storage.** Only the uploader or an ADMIN deletes a file; 409 while it is in use [SEC-26].
* **Organization.** `GET /organization` omits `taxId` unless `ORGANIZATION_PUBLIC_TAX_ID=true`; one organization row is enforced [BUG-17].
* **Users.** `GET /user` items carry `status` (`ACTIVE`/`INVITED`) [FEAT-06].
* **bedest-core 2.0** (unpublished at the time of writing; see its changelog).

### Security

* Login fallbacks to seeded credentials removed; seed requires `SEED_SYSTEM_EMAIL` and generates a password when none is given [SEC-01][SEC-03].
* Audit payloads scrubbed of secrets; `RedactAuditLogs` cleans existing rows [SEC-06].
* Rate limits scoped to their routes, keyed on the real client IP (`TRUST_PROXY_HOPS`), configurable [SEC-07].
* Revoked, deleted or demoted principals lose access at the next request; refresh rotation is atomic with reuse detection [SEC-08][SEC-09].
* Role policy: ADMINs can no longer take over or delete peers or SYSTEM users; no self-lockout [SEC-11][SEC-12][SEC-13].
* TLS verification for Postgres, API docs off in production, security headers, body limit, CORS list, WebSocket origin check and CSRF origin check [SEC-15][SEC-17][SEC-18].
* Logger keeps errors and redacts secrets [SEC-20]; e-mails validated and normalized, unique case-insensitively [SEC-21].
* Account lockout after 5 failures in 15 minutes and security-event auditing [FEAT-07].

### Fixes

* Empty updates → 400 [BUG-02]; storage write/delete ordering no longer loses data or leaks objects [BUG-03].
* Logout disconnects only the current device [BUG-06]; maintenance mode is shared and cached [BUG-08].
* WebSocket registry keyed per connection; sockets close when their token expires or session ends [BUG-10].
* Seed and context fixes [BUG-12]; validations fixed and bounded to column sizes [BUG-13][QLT-11]; organization singleton [BUG-17].
* S3 downloads stream, report backend errors (502) and support path-style or virtual-hosted URLs [BUG-18].

### Features

* Health endpoints `/api/health/live` and `/api/health/ready` [FEAT-01]; migration runner `db:migrate:prod` [FEAT-02][OPS-01]; graceful shutdown [FEAT-03][OPS-08].
* Request ids (`x-request-id`) and one access-log line per request [FEAT-04].
* Session management: list, revoke one, log out everywhere [FEAT-05].
* Password reset and invitations by e-mail (`MAIL_PROVIDER` console/smtp) [FEAT-06].
* Background jobs with an advisory lock (`JOBS_ENABLED`) [FEAT-08].
* Append-only audit logs (grants + trigger) [FEAT-13].
* Cursor pagination for the audit log and notifications [PERF-02]; indexes for RLS predicates and list ordering [PERF-01].

### Operations and quality

* Dockerfile, compose (provision → migrate → api), CI (frozen lockfile, check, format, drift check, coverage) and CD fixed [OPS-02]–[OPS-06]; destructive scripts guarded [OPS-09]; version metadata from `package.json` [OPS-10].
* No import-time side effects (`createApp(env)`) [QLT-01]; no `any`/`eslint-disable`/needless casts [QLT-03][QLT-04]; dead code removed [QLT-05]; Prettier wired [QLT-09].
* Tests: USER is the default test principal, unique fixtures per test, coverage gate ≥ 80 % lines on `src/features` and `src/infrastructure` [TST-01]–[TST-06].
* README rewritten (environment table, security model, deployment, upgrading) [DOC-01].

### Notes

* **Version metadata [OPS-10].** `bedest.json` no longer carries a `version`; the development update check reads it from `package.json`, the only file release-please bumps. The released sections below are left as they were published: they contain duplicated entries and, in 1.0.0/1.1.0, commits carried over from bedest's history.

### Required one-off steps for existing deployments

* **Redact plaintext secrets already stored in audit logs [SEC-06].** Older versions stored fields such as `currentPassword` unredacted in `system_audit_logs.payload`. After upgrading run `bun run src/scripts/audit/RedactAuditLogs.ts` (dry run, reports the number of affected rows) and then `bun run src/scripts/audit/RedactAuditLogs.ts --apply` (rewrites them in batches of 500). Rotate any password that may have been exposed.

## [2.0.0](https://github.com/bedest-hq/bedest-lite/compare/v1.1.0...v2.0.0) (2026-11-09)


### ⚠ BREAKING CHANGES

* **auth:** tokens issued before this change lack the new claims, so every user has to log in again once after the deploy.

### Features

* **app:** graceful shutdown on SIGTERM/SIGINT [OPS-08][FEAT-03] ([02bdab6](https://github.com/bedest-hq/bedest-lite/commit/02bdab6ad15e9a3dc1b5e1836c8577ee83fda981))
* **audit:** append-only audit log trigger [FEAT-13] ([c216ca1](https://github.com/bedest-hq/bedest-lite/commit/c216ca1176d68507381d175ba37e4e41f6978788))
* **auth:** account lockout and security-event audit [FEAT-07] ([6aa5efd](https://github.com/bedest-hq/bedest-lite/commit/6aa5efd6e780ad83dc0cfdff6464af59ee9212ad))
* **auth:** password reset and invitations by e-mail [FEAT-06] ([e83a9ea](https://github.com/bedest-hq/bedest-lite/commit/e83a9ea5bdc61f3c6e5c01d01ef103bf5809d817))
* **auth:** session management [FEAT-05] ([a8dad47](https://github.com/bedest-hq/bedest-lite/commit/a8dad4799a9b3ec7ca52692228849841c82b355c))
* **db:** add a runtime migration runner [OPS-01][FEAT-02] ([81ebf94](https://github.com/bedest-hq/bedest-lite/commit/81ebf9458670e11b1ca85d4427a52583bf34867b))
* **health:** add liveness and readiness endpoints [FEAT-01] ([6ea318d](https://github.com/bedest-hq/bedest-lite/commit/6ea318de9f40e55d806e4f7d1423e6b317115976))
* **observability:** request ids and access logs [FEAT-04] ([7336d90](https://github.com/bedest-hq/bedest-lite/commit/7336d90cff3f7ebc957f2e213810a67a06210a72))


### Bug Fixes

* **audit:** configured entity, nullable entityId, typed hooks [BUG-11][QLT-03] ([0beee97](https://github.com/bedest-hq/bedest-lite/commit/0beee972a41e67bd8b5e6c31566441b1d3cc96a4))
* **audit:** consume normalized-key scrubber and add RedactAuditLogs [SEC-06] ([5a3d845](https://github.com/bedest-hq/bedest-lite/commit/5a3d845dfc5ea597200042b786f14ae0fc36a55c))
* **auth:** 12-128 character policy for new passwords [SEC-23] ([c94642b](https://github.com/bedest-hq/bedest-lite/commit/c94642b4b16700f8f1ec3ee2afeb093867af643b))
* **auth:** logout disconnects only the current session [BUG-06] ([8613958](https://github.com/bedest-hq/bedest-lite/commit/8613958bb81e9b105361688dc993118862129003))
* **auth:** remove default-credential login fallback [SEC-01] ([d297004](https://github.com/bedest-hq/bedest-lite/commit/d297004ec64ae31fba3a850c43cf242166b42c08))
* **auth:** revoke sessions and re-read principals from the database [SEC-08] ([5ee7eda](https://github.com/bedest-hq/bedest-lite/commit/5ee7eda5b25a38e712f6dc3a68f7715a8715b03f))
* **auth:** rotate refresh sessions atomically and detect token reuse [SEC-09] ([c9ce34f](https://github.com/bedest-hq/bedest-lite/commit/c9ce34fd0c066c4c13da8897e31e22a27c98da9f))
* **auth:** scope rate limits per route and stop refunding failed logins [SEC-07] ([139783f](https://github.com/bedest-hq/bedest-lite/commit/139783f4945b3accd41c932398799e7a22af4791))
* **auth:** scope the refresh cookie and bind tokens to iss/aud/typ [SEC-24] ([1917a40](https://github.com/bedest-hq/bedest-lite/commit/1917a40bd04bbc8b30cae6fd5b9278cc755d893e))
* **auth:** stop returning the access token from /auth/refresh [SEC-14] ([f9356ea](https://github.com/bedest-hq/bedest-lite/commit/f9356ea05dd758cf1b11bbc28b91f7efbab3298b))
* **ci:** inherit PATH in child process tests and disable JSC IPInt in CI ([afddb55](https://github.com/bedest-hq/bedest-lite/commit/afddb5543acdfab602814abac933db20845d9a87))
* **compose:** production-grade stack with roles and migrations [OPS-03] ([3be7b47](https://github.com/bedest-hq/bedest-lite/commit/3be7b47e79de38e39f3228c81ea7d21d6129f062))
* **db:** two-role model so the API never runs as the schema owner [OPS-03][FEAT-13] ([597fb40](https://github.com/bedest-hq/bedest-lite/commit/597fb40d39198875716603899b98243409478c82))
* **db:** verify Postgres TLS certificates by default in production [SEC-15] ([eb9c4e1](https://github.com/bedest-hq/bedest-lite/commit/eb9c4e1f6b4fe2477f28736da781862450fb57a0))
* **docker:** reproducible, non-root image with committed migrations [OPS-02][OPS-01] ([20bec69](https://github.com/bedest-hq/bedest-lite/commit/20bec694a2d5144621567ca8ac700f8a5b1e716e))
* **docs:** hide API docs in production and migrate to @elysiajs/openapi [SEC-17] ([151a4da](https://github.com/bedest-hq/bedest-lite/commit/151a4da27eb69960776ae735e6798089fab968f1))
* **env:** report every env error, enforce secret rules, coerce integers [SEC-16] ([f396ccb](https://github.com/bedest-hq/bedest-lite/commit/f396ccbccbcae2ddf954a38a8a6e1f6e24462b90))
* **env:** require NODE_ENV and explicit production CORS origins [SEC-02] ([05f6669](https://github.com/bedest-hq/bedest-lite/commit/05f66691163f713ac910ffd5a985404cc15aac74))
* **errors:** one error envelope for every failure [BUG-14] ([7d71c8b](https://github.com/bedest-hq/bedest-lite/commit/7d71c8be93ad295dfbfd5442812679c838924027))
* **http:** security headers, body limit, CSRF and WebSocket origin checks [SEC-18] ([0863527](https://github.com/bedest-hq/bedest-lite/commit/08635270315fceb375af5bbc8711114a31e9c27b))
* **logger:** keep error details and redact secrets in logs [SEC-20] ([475dc97](https://github.com/bedest-hq/bedest-lite/commit/475dc970ffb6fc6a13df6964adcb44532647a5f0))
* **organization:** enforce the singleton and upsert it in one transaction [BUG-17] ([811694b](https://github.com/bedest-hq/bedest-lite/commit/811694bf8329dc86d8ba19fff0379c78ee9e7bd0))
* **scripts:** guard destructive resets and fail loudly [OPS-09] ([ec0ad37](https://github.com/bedest-hq/bedest-lite/commit/ec0ad37275c447ad98e2b6f9f8afe76e299e94fd))
* **scripts:** remove ContextBuilder and its fake system context [BUG-12] ([e87a4ee](https://github.com/bedest-hq/bedest-lite/commit/e87a4ee1773686387aecf5ff849a7d4163c08c56))
* **seed:** remove hardcoded superuser password and e-mail [SEC-03] ([505c7a7](https://github.com/bedest-hq/bedest-lite/commit/505c7a71e760679e1cbe9b2689c2419b6c72d3cb))
* **service:** empty update payloads are a uniform 400 [BUG-02] ([1ff6f8a](https://github.com/bedest-hq/bedest-lite/commit/1ff6f8ace851c57aa50717f6f58958ba9d7c98d6))
* **storage:** only the uploader or an admin may delete a file [SEC-26] ([2252239](https://github.com/bedest-hq/bedest-lite/commit/2252239effd2917c15699f425dc7c0f434668982))
* **storage:** stream S3 downloads, surface backend errors, configurable path style [BUG-18] ([db29dcc](https://github.com/bedest-hq/bedest-lite/commit/db29dcc71785c4abb7fb568a2423f12c3236ffc5))
* **storage:** write the row before the object and never delete eagerly [BUG-03] ([7cd07e1](https://github.com/bedest-hq/bedest-lite/commit/7cd07e176adb8565d1a9bd545f5b92790301b840))
* **system:** keep maintenance mode in the database [BUG-08] ([98193f8](https://github.com/bedest-hq/bedest-lite/commit/98193f808b2dbbe17702e7f8eac24d003eb58bff))
* **update:** read the template version from package.json [OPS-10] ([6bab5df](https://github.com/bedest-hq/bedest-lite/commit/6bab5df567cb94d99741e393c84d22e3ee5c798f))
* **user:** one role policy for create, update and remove [SEC-11][SEC-12] ([935403d](https://github.com/bedest-hq/bedest-lite/commit/935403d5299e66a6e35e2672d22747b3f2a679fb))
* **user:** prevent self-lockout [SEC-13] ([1d5a96d](https://github.com/bedest-hq/bedest-lite/commit/1d5a96d5a98ed73c2e7312a39c631943b42e6b4d))
* **user:** validate and normalize e-mail addresses [SEC-21] ([24c01b5](https://github.com/bedest-hq/bedest-lite/commit/24c01b58e431d5b1711a60c236530f23142d8fba))
* **validation:** bound request strings by their column sizes [QLT-11] ([c37cbdb](https://github.com/bedest-hq/bedest-lite/commit/c37cbdbdec7df2852e483a1c695224ccaa3269ff))
* **validation:** one schema per enum, drop VDefault [BUG-13] ([1465636](https://github.com/bedest-hq/bedest-lite/commit/14656364de85f668af120fe4e241fbbe63884778))
* **ws:** one registry keyed by connection id, close sockets on token expiry [BUG-10] ([92567bb](https://github.com/bedest-hq/bedest-lite/commit/92567bb342d739f469411840f83ad435c32b17d6))


### Performance Improvements

* **api:** optional cursor pagination for the audit log and notifications [PERF-02] ([66fa67d](https://github.com/bedest-hq/bedest-lite/commit/66fa67d17b5e298693af72c547106c91c38a226e))
* **db:** indexes for RLS predicates and newest-first lists [PERF-01] ([7d6e2ba](https://github.com/bedest-hq/bedest-lite/commit/7d6e2baf1f63e7782cfcbd61052303655dec9cd6))

## [1.1.0](https://github.com/bedest-hq/bedest-lite/compare/v1.0.0...v1.1.0) (2026-10-10)


### Features

* fix rls deadlock, harden websocket session revocation, add sess… ([25aa837](https://github.com/bedest-hq/bedest-lite/commit/25aa8373b6d6983607b5eccc156ef829aad2e2d9))
* fix rls deadlock, harden websocket session revocation, add session ttl and audit error logging ([3ee7281](https://github.com/bedest-hq/bedest-lite/commit/3ee7281729a72106c078bf3a8b359792bbe57c07))
* new organization fields implementation. ([2ab045f](https://github.com/bedest-hq/bedest-lite/commit/2ab045f3015696dac0ab571ca5084d6aa5beb476))
* new organization fields implementation. ([e978db6](https://github.com/bedest-hq/bedest-lite/commit/e978db602155422a00fcc970a819cf61b835169a))
* organiation is implemented ([18838c0](https://github.com/bedest-hq/bedest-lite/commit/18838c050cff17e6579f9c94dcb621a4841f5ce2))
* organiation is implemented ([1bc5af1](https://github.com/bedest-hq/bedest-lite/commit/1bc5af1a26422746693403de729758d2cda29916))
* SaaS features removed and become lite version of bedest. ([7bd9a74](https://github.com/bedest-hq/bedest-lite/commit/7bd9a74b50cf8462500adbcd89b34982adb17dd9))
* SaaS features removed and become lite version of bedest. ([1c927a4](https://github.com/bedest-hq/bedest-lite/commit/1c927a4fc809ce8c3de011669198f209d548a099))
* users gonna know when updates come to bedest-lite ([8225b81](https://github.com/bedest-hq/bedest-lite/commit/8225b81141c2b44f3545f9f04542ceb5ece51467))
* users gonna know when updates come to bedest-lite ([4da4540](https://github.com/bedest-hq/bedest-lite/commit/4da4540faca4a0b98764c5bf132c547e87a49cdf))

## 1.0.0 (2026-06-10)


### Features

* SaaS features removed and become lite version of bedest. ([7bd9a74](https://github.com/bedest-hq/bedest-lite/commit/7bd9a74b50cf8462500adbcd89b34982adb17dd9))
* SaaS features removed and become lite version of bedest. ([1c927a4](https://github.com/bedest-hq/bedest-lite/commit/1c927a4fc809ce8c3de011669198f209d548a099))

## [1.1.0](https://github.com/bedest-hq/bedest/compare/v1.0.4...v1.1.0) (2026-06-01)


### Features

* add storage feature with local and S3 providers ([#43](https://github.com/bedest-hq/bedest/issues/43)) ([ba8da67](https://github.com/bedest-hq/bedest/commit/ba8da6754bdca3d5c812fe4fc910b849c41fba78))
* for guests public resolve is implemented and some buggies fixed. ([#51](https://github.com/bedest-hq/bedest/issues/51)) ([660dcf1](https://github.com/bedest-hq/bedest/commit/660dcf1aa37d010d5a62e03c48ed4a67c0578e56))
* for self getter we added id field ([#62](https://github.com/bedest-hq/bedest/issues/62)) ([96434f0](https://github.com/bedest-hq/bedest/commit/96434f0fd336d80f83358296f62b41da2d1870d8))
* local storage clean script is implemented service base ordered with datetime and minor problems fixed. ([#59](https://github.com/bedest-hq/bedest/issues/59)) ([7f1b9f8](https://github.com/bedest-hq/bedest/commit/7f1b9f87285a6beacb26a7cfdac69dd3ae9aab46))


### Bug Fixes

* service base tenant context changed from IUserApp to ITenanApp. ([#48](https://github.com/bedest-hq/bedest/issues/48)) ([0907903](https://github.com/bedest-hq/bedest/commit/09079031bbebc19d1c6214510004ce5a0fe4a135))

## [1.0.4](https://github.com/bedest-hq/bedest/compare/v1.0.3...v1.0.4) (2026-03-31)


### Bug Fixes

* some routers was became lean. ([#31](https://github.com/bedest-hq/bedest/issues/31)) ([5e00152](https://github.com/bedest-hq/bedest/commit/5e0015295aafea4106bbfdbd660e13013dd60e47))

## [1.0.3](https://github.com/bedest-hq/bedest/compare/v1.0.2...v1.0.3) (2026-03-25)


### Bug Fixes

* missing maintenance mode is implemented. ([#29](https://github.com/bedest-hq/bedest/issues/29)) ([9236436](https://github.com/bedest-hq/bedest/commit/9236436801533252c59be0a0a3825df8877816be))

## [1.0.2](https://github.com/bedest-hq/bedest/compare/v1.0.1...v1.0.2) (2026-03-25)


### Bug Fixes

* forgotten tenant plan guard implementation. ([#27](https://github.com/bedest-hq/bedest/issues/27)) ([83f70c5](https://github.com/bedest-hq/bedest/commit/83f70c503258cfe342ddcf1e3fa8254a12a57af8))

## [1.0.1](https://github.com/bedest-hq/bedest/compare/v1.0.0...v1.0.1) (2026-03-23)


### Bug Fixes

* unnecessary router util functions removed and cleaned from routers. ([#23](https://github.com/bedest-hq/bedest/issues/23)) ([ba518f1](https://github.com/bedest-hq/bedest/commit/ba518f1c1cc6b291c3cb80b525c54ce72210d0d0))
