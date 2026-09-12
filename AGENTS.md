# SaaS Finanzas Backend — Agent Guide

## Stack & Identity

- **NestJS v11** + **Prisma v7.8** (`@prisma/adapter-pg` with pg Pool) + **PostgreSQL (Supabase)**
- Supabase Auth using **custom JWK-based ES256 verification** (`jwk-to-pem`), not the Supabase SDK `getUser()`
- JWT strategy in `src/auth/jwt.strategy.ts` — validates `sub`, `iss`, `aud` against env vars
- **`@/*` path alias** maps to `./src/*` (tsconfig.json `paths`)

## Commands

```bash
npm run start:dev          # dev server with watch
npm run build              # nest build -> dist/
npm run start:prod         # node dist/main
npm run test               # jest (rootDir: src/, pattern: *.spec.ts)
npm run test:e2e           # jest --config ./test/jest-e2e.json (pattern: *.e2e-spec.ts)
npm run test:cov           # jest --coverage
npm run lint               # eslint --fix (no-explicit-any OFF, no-floating-promises warn)
npm run format             # prettier --write (singleQuote, trailingComma: all)
```

## Prisma

- **Schema at `prisma/schema.prisma`** (package.json's `"schema": "src/prisma/schema.prisma"` is stale — use explicit path or `prisma.config.ts`)
- Canonical config: `prisma.config.ts` (`defineConfig` from `prisma/config`)
- Use `DIRECT_URL` (port 5432) for migrations; `DATABASE_URL` (port 6543, pooled) for app queries
- `PrismaService` extends `PrismaClient` + uses `@prisma/adapter-pg` pool
- No repository layer — inject `PrismaService` directly into services

```bash
npx prisma generate --schema=prisma/schema.prisma
npx prisma migrate dev --schema=prisma/schema.prisma --name <desc>
npx prisma studio --schema=prisma/schema.prisma
```

## Auth & Guards

- **`JwtAuthGuard` is global** (`APP_GUARD`). Use `@Public()` decorator to skip on public routes (`src/common/decorators/public.decorator.ts`)
- **`ThrottlerGuard` is global** (120 req/60s)
- `JwtAuthGuard` checks `User.isSuspended` at every request — throws `401 "Cuenta suspendida"`
- `ValidateCompanyGuard` checks ownership + `Company.isSuspended` on company-scoped routes
- Public endpoints: `GET /`, `POST /auth/register`, `POST /auth/login`, `/admin/auth/*`

## Architecture Conventions

- **Soft deletes**: all entities use `isRemoved: Boolean @default(false)` — no physical deletes
- **Validation**: global `ValidationPipe` with `whitelist`, `forbidNonWhitelisted`, `transform`
- **Security**: `helmet()` globally, CORS from `FRONTEND_URL` env var (comma-separated origins)
- **CorrelationIdMiddleware** applied globally (`X-Correlation-Id` header)

## Business Rules

- Two roles: `USER` (creates companies, operates data) and `ADMIN` (global management, no company operations)
- Multi-currency: each `Transaction` stores both `amountUSD` and `amountBs` with `dollarRate`
- Stock: `PRODUCT` items with `INFLOW` categories decrement `stockCurrent` on transaction/batch creation
- Finance chat uses a 4-stage routing: chain detection → regex → keyword → Cohere LLM fallback

## Env Vars (key ones)

| Var | Purpose |
|-----|---------|
| `DATABASE_URL` | Pooled connection (port 6543) |
| `DIRECT_URL` | Direct connection for migrations (port 5432) |
| `SUPABASE_JWT_JWK_X/Y` | EC P-256 public key coordinates (required) |
| `SUPABASE_JWT_ISSUER` | Defaults to `{SUPABASE_URL}/auth/v1` |
| `SUPABASE_JWT_AUDIENCE` | Defaults to `authenticated` |
| `FRONTEND_URL` | CORS origins (comma-separated) |
| `ADMIN_SECRET_KEY` | Secret for admin registration |
| `CO_API_KEY` | Cohere API key for LLM (Command A) |
| `MCP_HTTP_ENABLED` | MCP HTTP SSE server (default: `false`) |

## SPEC.md

The file `SPEC.md` is the authoritative source for business rules, data model, and endpoint specs. Many features are listed as "Pendiente" — check the Status table before assuming something exists.

## Skills (`.agents/skills/`)

- `nestjs-best-practices` — general NestJS patterns (load when creating modules)
- `prisma-database-setup` — Prisma conventions (load for schema/data changes)
- `supabase` — Supabase integration (load for auth/storage)
- `typescript-advanced-types` — complex TS types (load for type refactors)
