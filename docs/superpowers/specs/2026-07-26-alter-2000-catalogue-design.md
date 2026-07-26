# UMM Parts Catalogue — Alter 2000 (Design)

## Purpose

A public web catalogue of vehicle parts for UMM's vehicle lines (Cournil, Alter), starting
with a single model: **Alter 2000**. Visitors browse parts by category ("group"), see the
exploded diagram alongside the parts table, and can search by part code or name across the
whole catalogue. No login required.

## Architecture

Single Express app serves both the JSON API and the built Vue 3 SPA (one deploy unit).

- **Backend**: Node/Express, SQLite via Drizzle ORM.
- **Frontend**: Vue 3 + Vite + Vue Router + Pinia. Client-rendered SPA (no SSR — SEO is
  explicitly deferred for now).

```
umm-partscatalogue/
  server/         Express app, routes, DB access, import script
  client/         Vue 3 SPA (Vite)
  data/           SQLite file
  resources/2000/ Source markdown + illustration images (import input)
```

## Data Model

- **Brand** — `id, name, slug` (Cournil, Alter)
- **Model** — `id, brand_id, name, slug, status` (`active` | `coming_soon`). Alter 2000 is the
  only `active` model initially.
- **Group** — `id, model_id, code, name, illustration_file, sort_order`. A group represents one
  parts-catalogue section (e.g. `00.1.D APOIOS MOTOR`). A group may have zero parts (image-only),
  since the source data has at least one section (`13.2.C BOMBA CENTRAL TRAVÕES`) with an
  illustration but no transcribed table.
- **Part** — `id, group_id, item_number, cod_ckd, cod_sobres, designacao, coef, observacoes`.
  Both `cod_ckd` and `cod_sobres` are treated as equally valid searchable part codes (per
  source data, a part may have either, both, or neither populated).

Search matches against `designacao`, `cod_ckd`, and `cod_sobres`.

## Import Pipeline

A re-runnable script (`server/scripts/import.ts`):

1. Parses a model's source markdown (e.g. `resources/2000/2000.md`), splitting on `##` headers
   into groups and parsing each group's table into `Part` rows.
2. Reads a manually-authored `illustration-map.json` (group code → image filename) — this
   mapping is **not** inferred automatically from file order, since the source illustrations
   don't map 1:1 in sequence with table sections (the `13.2.C`/`13.2.D` gap above). This map
   is verified by eye once per model.
3. Copies referenced images into `server/public/images/<model>/` and re-seeds that model's
   Brand/Model/Group/Part rows in SQLite (idempotent full replace per model, not additive).

This keeps the source markdown as the reprocessable source of truth, and generalizes to future
models (Cournil, other Alter models) once their markdown + images arrive in the same shape.

## Pages & Navigation

- `/` — Home: brand picker (Cournil, Alter)
- `/:brandSlug` — Model picker within a brand; non-active models shown disabled as "coming soon"
- `/:brandSlug/:modelSlug` — Group listing (18 groups for Alter 2000) with a client-side text
  filter (small dataset, no server round-trip needed)
- `/:brandSlug/:modelSlug/:groupCode` — Group detail page: sticky illustration (left) + scrollable
  parts table (right) on desktop/tablet; stacked (image above table) on mobile
- Global header search bar (always visible) — hits `/api/search?q=...`, results link into the
  relevant group detail page

## Styling & Branding

- Primary color: `#0A6ABD` (sampled from umm.pt's actual homepage background)
- White on-primary text/logo, dark charcoal body text, light-grey neutrals for cards/table
  stripes
- Clean geometric/industrial sans-serif typography, matching the blocky "umm" wordmark
- Blue used as accent (header, active nav, buttons, table headers) rather than as a dominant
  page background throughout

## Testing

- Import script: unit test asserting parsed group/part counts against known values from
  `2000.md`
- API: route tests for search and group-detail endpoints (Vitest + supertest)
- Frontend: manual browser walkthrough of each route for v1; no heavy component test suite
  given the small, mostly-static UI

## Out of Scope

- Login/auth or dealer-only features
- Actual data for Cournil or other Alter models (structure supports it, content doesn't exist yet)
- Clickable image hotspots on illustrations (static image + table only, for now)
- SSR / SEO optimization
- Admin UI for editing parts (import-script-only data entry)
