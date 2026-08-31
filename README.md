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

Run `pnpm catalogue:export:forms` to write compact runtime form bundles, or `pnpm catalogue:forms:size` to print a JSON file's uncompressed, gzip, and Brotli sizes. Captures that only contain category navigation fields receive a required remarks textarea and an optional attachment field during compilation.

The `test/forms-delivery-diagnostics` branch includes a plain `/diagnostics/forms` page for comparing raw, cleaned, compact, and authority-split delivery on Vercel. Run `pnpm catalogue:diagnostics:prepare` after catalogue changes. The test procedure and exported metrics are documented in [`docs/form-delivery-observability.md`](./docs/form-delivery-observability.md).

`pnpm catalogue:check` is read-only and fails if the tracked artifacts differ from a fresh compilation.

## Local catalogue search

The Services directory and both assistant modes use one shared Orama 3.1.18 lexical search engine. The compiler indexes active forms only, with their authority and category hierarchy stored as searchable metadata alongside weighted titles, aliases, paths, keywords, natural issue phrases, field labels, and option labels. Hindi, Romanized Hindi, Devanagari digits, identifiers such as PAN and 5G, exact/prefix matches, and typo fallback are normalized by the same code in every runtime.

`pnpm catalogue:compile` writes a versioned manifest plus a compact `public/catalogue/search-index.data.json` postings snapshot. In the browser, a Web Worker downloads the static index once, stores it in Cache Storage by version, restores it locally, and performs all queries, filtering, facets, and pagination without a search API. The server assistant restores the same artifact once per process. `@orama/plugin-data-persistence` is used only at compile time to serialize the local snapshot; normal builds and searches make no model or hosted-search requests.

Optional metadata authoring is explicit: `pnpm catalogue:enrich` uses the configured Gemini model to create cached English, Hindi, and Romanized-Hindi aliases and issue phrases in `public/catalogue/search-enrichment.json`. It resumes completed batches, validates every record, and is never invoked by build, compile, or runtime search. A stale enrichment file is ignored until regenerated. Re-run `pnpm catalogue:compile` after enrichment.

Use `pnpm catalogue:search:test` to verify normalization, filters, pagination, artifact checksum, and fresh-versus-restored result parity.

`pnpm db:seed:check` validates catalogue coverage and the synthetic demo fixtures without reading database credentials. `pnpm db:seed` is explicit, transactional, repeatable, and never deletes existing user data.

## Verification

```bash
pnpm typecheck
pnpm catalogue:check
pnpm db:seed:check
pnpm exec drizzle-kit check
```

The public grievances and performance snapshots created by the seed are synthetic and clearly labeled as such.
