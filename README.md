# UGAAP

Universal Grievance and Accountability Platform (UGAAP) is an independent hackathon prototype for simpler grievance filing, interoperable government workflows, and public accountability. It is not an official government service.

The implementation follows [PLAN.md](./PLAN.md). Phase 0 provides the canonical CPGRAMS-derived catalogue, database/RBAC foundation, and deterministic synthetic demo data.

## Local setup

1. Install dependencies with `pnpm install`.
2. Copy `.env.example` to `.env.local` and provide the required local values.
3. Compile and verify the catalogue with `pnpm catalogue:compile` and `pnpm catalogue:check`.
4. Apply migrations with `pnpm db:migrate`.
5. Validate the seed offline with `pnpm db:seed:check`, then apply it with `pnpm db:seed`.
6. Start the app with `pnpm dev`.

Never commit `.env.local` or expose database, Better Auth, Gemini, or Blob credentials to client code.

## Phase 0 data pipeline

`pnpm catalogue:compile` recursively reads every `local-research/cpgrams-form-catalogue/captures/**/form.json`, validates it, builds the organization/category/form catalogue, and writes the single canonical static artifact set to `public/catalogue`.

`pnpm catalogue:check` is read-only and fails if the tracked artifacts differ from a fresh compilation.

`pnpm db:seed:check` validates catalogue coverage and the synthetic demo fixtures without reading database credentials. `pnpm db:seed` is explicit, transactional, repeatable, and never deletes existing user data.

## Verification

```bash
pnpm typecheck
pnpm catalogue:check
pnpm db:seed:check
pnpm exec drizzle-kit check
```

The public grievances and performance snapshots created by the seed are synthetic and clearly labeled as such.
