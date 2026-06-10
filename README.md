<p align="center">
  <img src="docs/images/bedest-lite.png" alt="Bedest Lite Logo" width="200" />
</p>

<h1 align="center">Bedest Lite - B.E.D. Stack Boilerplate</h1>

<p align="center">
  <strong>
    A blazing-fast, strictly typed backend foundation built for custom web apps, freelance projects, and boutique websites.
  </strong>
  <br/>
  Powered by <b>B</b>un, <b>E</b>lysiaJS, and <b>D</b>rizzle ORM.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Bun-%23000000.svg?style=for-the-badge&logo=bun&logoColor=white" alt="Bun">
  <img src="https://img.shields.io/badge/ElysiaJS-black?style=for-the-badge&logo=elysia" alt="Elysia">
  <img src="https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white" alt="PostgreSQL">
  <img src="https://img.shields.io/badge/Docker-2CA5E0?style=for-the-badge&logo=docker&logoColor=white" alt="Docker">
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TS">
</p>

---

## Architectural Philosophy

Bedest Lite is the streamlined, single-tenant version of the original Bedest boilerplate. It is engineered to prioritize **Developer Experience (DX) and execution speed** for custom projects that don't require complex B2B SaaS overhead. It enforces a **Strictly Typed** environment, eliminating `any` types in favor of robust runtime validation, while providing enterprise-grade security, storage, and authentication out of the box.

The core abstractions (base services, utilities, guards, interfaces) live in a separate, publicly available package: [`bedest-core`](https://github.com/bedesthq/bedest-core). 

### Bedest vs. Bedest Lite

* **Bedest (Original):** Designed for massive B2B SaaS platforms. It includes Multi-tenancy, Row-Level Security (RLS) data isolation, subscription plan management, and complex cross-tenant guardrails.
* **Bedest Lite:** Strips away the multi-tenant complexity. It features a flat, blazing-fast database architecture, making it the ultimate starter kit for portfolios, agency work, internal tools, and standard single-tenant web applications.

### Why Bedest Lite?

* **No SaaS Overhead**: Focus directly on your business logic without worrying about `tenantId` mapping, subscription checks, or complex RLS policies.
* **Bulletproof Error Handling**: A centralized `ErrorHandler` with a recursive extraction logic that unmasks deep-nested Drizzle/Postgres errors into standard, frontend-friendly JSON.
* **Immutable Audit Trail**: An Aspect-Oriented, macro-driven system logging mechanism that automatically tracks "who did what" with 100% type safety.
* **Production-Ready Auth**: JWT-based Access/Refresh flow utilizing highly secure, HTTP-only, SameSite `lax` cookies and integrated Rate Limiting.

---

## Core Features

* **Ultra Fast**: Leveraging the Bun runtime and ElysiaJS for microsecond response times.
* **Dual-Token Auth**: Secure Access/Refresh JWT flow to keep user sessions safe and scalable.
* **Real-Time Notification Engine**: Native Elysia WebSocket implementation (`/notifications/live`) for pushing live payloads directly to users.
* **Generic Service Pattern**: Extensible `ServiceBase` class (from `bedest-core`) to eliminate repetitive CRUD and pagination logic.
* **Lightning Fast Tests**: Isolated database testing using **PGlite** (in-memory Postgres). No external DB container is required for CI/CD pipelines.
* **Hybrid Storage Engine**: Zero-copy file uploads with AWS S3 / Minio support, complete with file streaming for viewing and downloading, plus a seamless Local Storage fallback.

---

## Folder Structure & Nomenclature

Bedest Lite follows a clean, Domain-Driven Design (DDD) modular structure.

* **S** → Database Schemas (e.g., `SUser`, `SStorage`)
* **V** → Validation Objects (e.g., `VId`, `VEmail`, `VString`)
* **E** → Enums (e.g., `EUserRole`)
* **T** → Types (e.g., `TEnv`)

```plaintext
src/
├── app/               # App Router, Context Builder (JWT, Auth Injection), Swagger
├── common/            # Shared constants, types, and project-level validations (VEnv)
├── features/          # Bounded Contexts (Auth, Notification, Session, Storage, System, User)
│   └── [module]/
│       ├── enums/     # Domain-specific enums
│       ├── routers/   # Elysia routes & validation schemas
│       ├── schemas/   # Drizzle table definitions
│       └── services/  # Core business logic & database interactions
├── infrastructure/    # Database Manager, Env Validation, Error Handling, Logger, Storage, WebSockets
└── scripts/           # DB Reset, Seed execution, Storage teardown

```

---

## Technical Highlights

### bedest-core Integration

Even though Bedest Lite is single-tenant, it securely leverages the generic foundations of [`bedest-core`](https://github.com/bedesthq/bedest-core):

| Export | Description |
| --- | --- |
| `ServiceBase` | Generic CRUD base class providing automated pagination and basic queries |
| `UtilRouter` | `defPaginatedSchema` — typed paginated response wrapper |
| `UtilAudit` | `scrub()` — redacts sensitive keys before audit log persistence |
| `MacroRoleGuard` | Elysia macro for role-based access control (`SYSTEM`, `ADMIN`, `USER`) |
| `baseColumns` | Standard `id`, `isDeleted`, `createdAt`, `deletedAt` Drizzle columns |
| `IApp`, `IUserApp` | Context interfaces used by every service method |
| `VId`, `VEmail`, `VString`, `VQuery` | Common Elysia/TypeBox validation primitives |

### Semantic Status Codes & Guards

The API follows strict REST standards enforced by Elysia macros:

* `403 Forbidden`: Returned via `MacroRoleGuard` for insufficient RBAC roles.
* `503 Service Unavailable`: Used during Maintenance Mode to signal temporary downtime.
* `409 Conflict`: Maps unique constraint violations (like duplicate emails) dynamically.
* `400 Bad Request`: Handled natively for validation errors via TypeBox.

### Hybrid Storage Strategy

A unified `StorageManager` dynamically routes file uploads to AWS S3 (or any S3-compatible service like Minio) if credentials are provided, gracefully falling back to Node.js Local Storage. It handles files using a zero-copy approach (`Buffer.from` over `ArrayBuffer`), ensuring high-performance I/O, and provides native HTTP header parsing for safe file downloads (`Content-Disposition: attachment`).

### Aspect-Oriented Audit Trail

Bedest Lite includes a macro-driven audit logging system. Instead of littering business logic with log statements, developers simply flag a route with `audit: true` or provide a custom configuration (`audit: { action: 'USER_BANNED' }`). The `PluginAudit` middleware automatically scrubs sensitive keys (passwords, tokens) using `UtilAudit.scrub()` and persists the user action into the database seamlessly.

---

## Quick Start

### Installation

```bash
bun install
cp .env.example .env

```

### Database Setup

Spin up a local PostgreSQL instance:

```bash
docker run -d \
  --name postgres \
  -p 5432:5432 \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_DB=postgres \
  postgres:16-alpine

```

Execute the full database setup (resets, generates, migrates, and seeds):

```bash
bun run dev:setup

```

### Development

```bash
bun run dev

```

Access the Swagger documentation at: `http://localhost:3000/api/docs`

## Testing

Bedest Lite uses **PGlite** for lightning-fast, isolated database tests. Tests run against an in-memory instance, allowing for safe mutations, real schema checks, and instant feedback without requiring a running Docker container.

```bash
bun run test

```

## Deployment

A multi-stage Dockerfile is recommended, optimized for minimal image size and maximum security in production environments. Ensure you set `NODE_ENV=production` to enforce secure cookies and silent logging.

```bash
docker-compose up -d

```

## Scripts

| Command | Description |
| --- | --- |
| `bun run dev` | Start development server with hot reload |
| `bun run build` | Compile the application into a standalone executable via Bun |
| `bun run check` | Run TypeScript type-check and ESLint |
| `bun run test` | Run isolated unit and integration tests via PGlite |
| `bun run db:generate` | Generate Drizzle migrations |
| `bun run db:migrate` | Apply migrations to the database |
| `bun run dev:setup` | Full rebuild: Reset DB/Storage, Migrate, and Seed initial data |

---

## License

This project is licensed under the MIT License.

```
