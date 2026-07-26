# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Public vehicle parts catalogue for UMM (umm.pt). First model: Alter 2000. Categorized by
brand (Cournil, Alter) → model (e.g. 2000) → part group (e.g. `00.1.D APOIOS MOTOR`) → part.

Two documents drive current and future work — read them before making architectural changes:

- **Design spec:** `docs/superpowers/specs/2026-07-26-alter-2000-catalogue-design.md`
- **Implementation plan:** `docs/superpowers/plans/2026-07-26-alter-2000-catalogue-implementation.md`

## Architecture

Single Express app (TypeScript) serves both the JSON API and the built Vue 3 SPA as one deploy
unit — no SSR. Data lives in SQLite via Drizzle ORM.

```
server/         Express app: routes, DB schema/client, markdown import pipeline
client/         Vue 3 + Vite SPA (Vue Router, Pinia)
resources/2000/ Source markdown (2000.md) + illustration images + illustration-map.json
```

Routing hierarchy (both API and frontend): `/:brandSlug/:modelSlug/:groupCode`. Group detail
pages show the exploded-diagram illustration and its parts table side by side (sticky image,
scrollable table) — there are no clickable image hotspots; illustrations are static images.

## Commands

Once scaffolded per the implementation plan (npm workspaces: `server`, `client`):

```bash
npm run dev:server              # Express API, tsx watch mode
npm run dev:client              # Vite dev server (proxies /api and /images to server)
npm run build                   # build client, then server
npm run start                   # run production build (Express serves built client)
npm run test:server             # Vitest (server workspace)
npm run db:generate --workspace=server   # generate Drizzle migration from schema changes
npm run db:migrate --workspace=server    # apply migrations to server/data/catalogue.sqlite
npm run import:2000 --workspace=server   # (re-)parse resources/2000/2000.md into SQLite
```

## Data import quirks (resources/2000/2000.md)

The source markdown is a real, messy transcription of an OEM parts catalogue PDF. The import
parser (`server/src/import/parseMarkdown.ts`) has to account for:

- **Group enumeration comes from the index table**, not from counting `##` sections — one group
  (`13.2.C BOMBA CENTRAL TRAVÕES`) has an index entry but no body table (image-only group).
- **Column headers vary by section** (`16.1.C` reorders `DESIGNAÇÃO`, `16.2.E` uses `QUANT.`
  instead of `COEF.`, `17.5.H` uses accented `CÓD. CKD`/`CÓD. SOBRES.`) — parsing must be
  header-driven, never positional.
- **`item_number` is not a reliable sort key** — rows aren't always in numeric order (e.g.
  `03.1.D` lists items as 1,2,3,4,5,8,6,7,9...). A separate `sort_order` preserves actual table
  row order.
- **Illustration-to-group mapping is manual**, recorded in `resources/2000/illustration-map.json`
  — it is not inferable from file order/naming alone.
- Both `cod_ckd` and `cod_sobres` are equally valid searchable part codes; either, both, or
  neither may be populated on a given row.
