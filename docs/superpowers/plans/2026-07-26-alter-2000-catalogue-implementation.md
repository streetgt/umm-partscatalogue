# Alter 2000 Parts Catalogue Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a public Express + Vue 3 parts catalogue for UMM's Alter 2000, driven by data imported from `resources/2000/2000.md`, per the approved design spec.

**Architecture:** Single Express app (TypeScript) serves a JSON API backed by SQLite (via Drizzle ORM) and the built Vue 3 SPA (Vite). A re-runnable import script parses the source markdown into the database. Frontend is a client-rendered SPA with brand → model → group → part navigation, plus global search.

**Tech Stack:** Node.js + TypeScript, Express 4, better-sqlite3 + drizzle-orm, Vite + Vue 3 + Vue Router + Pinia, Vitest + supertest for backend tests.

**Spec:** `docs/superpowers/specs/2026-07-26-alter-2000-catalogue-design.md`

---

## Chunk 1: Project Scaffolding

**Files:**
- Create: `package.json` (root, workspaces)
- Create: `server/package.json`
- Create: `server/tsconfig.json`
- Create: `server/src/index.ts`
- Create: `client/` (Vite-scaffolded Vue 3 + TS app)
- Create: `.gitignore` additions for `node_modules`, `dist`, `*.sqlite`

- [ ] **Step 1: Create root workspace package.json**

```json
{
  "name": "umm-partscatalogue",
  "private": true,
  "workspaces": ["server", "client"],
  "scripts": {
    "dev:server": "npm run dev --workspace=server",
    "dev:client": "npm run dev --workspace=client",
    "build:client": "npm run build --workspace=client",
    "test:server": "npm run test --workspace=server"
  }
}
```

- [ ] **Step 2: Scaffold the Vue client with Vite**

Run: `npm create vite@latest client -- --template vue-ts`

This creates `client/` with a standard Vue 3 + TypeScript + Vite setup. Accept defaults.

- [ ] **Step 3: Add Vue Router and Pinia to the client**

Run (from `client/`): `npm install vue-router@4 pinia`

- [ ] **Step 4: Initialize the server package**

Run: `npm init -y` inside `server/`, then rename `"name"` to `"server"` in `server/package.json`.

Run (from `server/`):
```bash
npm install express better-sqlite3 drizzle-orm
npm install -D typescript tsx @types/express @types/better-sqlite3 @types/node drizzle-kit vitest supertest @types/supertest
```

- [ ] **Step 5: Add server TypeScript config**

Create `server/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true
  },
  "include": ["src"]
}
```

- [ ] **Step 6: Add server scripts to `server/package.json`**

```json
{
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "vitest run",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "tsx src/db/migrate.ts",
    "import:2000": "tsx src/scripts/import.ts --model=alter-2000"
  }
}
```

- [ ] **Step 7: Create a minimal Express entrypoint to verify the toolchain**

Create `server/src/index.ts`:

```typescript
import express from "express";

const app = express();
const port = process.env.PORT ?? 3000;

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
```

- [ ] **Step 8: Verify the server boots**

Run: `npm run dev --workspace=server`
Expected: console prints `Server listening on http://localhost:3000`. Hit `http://localhost:3000/api/health` (e.g. via `curl`) and confirm `{"status":"ok"}`. Stop the process (Ctrl+C).

- [ ] **Step 9: Update `.gitignore`**

Add to the existing root `.gitignore`:

```
node_modules/
dist/
*.sqlite
client/dist/
```

- [ ] **Step 10: Commit**

```bash
git add package.json server client .gitignore
git commit -m "Scaffold Express server and Vue client workspaces"
```

---

## Chunk 2: Database Schema

**Files:**
- Create: `server/src/db/schema.ts`
- Create: `server/drizzle.config.ts`
- Create: `server/src/db/client.ts`
- Create: `server/src/db/migrate.ts`

- [ ] **Step 1: Define the Drizzle schema**

Create `server/src/db/schema.ts`:

```typescript
import { sqliteTable, text, integer, uniqueIndex } from "drizzle-orm/sqlite-core";

export const brands = sqliteTable("brands", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
});

export const models = sqliteTable(
  "models",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    brandId: integer("brand_id").notNull().references(() => brands.id),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    status: text("status", { enum: ["active", "coming_soon"] })
      .notNull()
      .default("coming_soon"),
  },
  (table) => ({
    brandSlugUnique: uniqueIndex("models_brand_id_slug_unique").on(
      table.brandId,
      table.slug,
    ),
  }),
);

export const groups = sqliteTable("groups", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  modelId: integer("model_id").notNull().references(() => models.id),
  code: text("code").notNull(),
  name: text("name").notNull(),
  illustrationFile: text("illustration_file"),
  sortOrder: integer("sort_order").notNull(),
  observacoes: text("observacoes"),
});

export const parts = sqliteTable("parts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  groupId: integer("group_id").notNull().references(() => groups.id),
  itemNumber: text("item_number"),
  sortOrder: integer("sort_order").notNull(),
  codCkd: text("cod_ckd"),
  codSobres: text("cod_sobres"),
  designacao: text("designacao").notNull(),
  coef: text("coef"),
  observacoes: text("observacoes"),
});
```

Note: `itemNumber` and `coef` are stored as `text`, not `integer`/`real` — source values include
non-numeric edge cases (blank item numbers, decimal coefficients like `0.9`), and nothing in the
app performs arithmetic on them, so preserving the original string is simpler and safer than
coercing.

- [ ] **Step 2: Add Drizzle Kit config**

Create `server/drizzle.config.ts`:

```typescript
import type { Config } from "drizzle-kit";

export default {
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: {
    url: "./data/catalogue.sqlite",
  },
} satisfies Config;
```

- [ ] **Step 3: Create the DB client**

Create `server/src/db/client.ts`:

```typescript
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema.js";

const sqlite = new Database(process.env.DB_PATH ?? "./data/catalogue.sqlite");
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite, { schema });
```

- [ ] **Step 4: Create the migration runner**

Create `server/src/db/migrate.ts`:

```typescript
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";

const sqlite = new Database(process.env.DB_PATH ?? "./data/catalogue.sqlite");
const db = drizzle(sqlite);

migrate(db, { migrationsFolder: "./drizzle" });
console.log("Migrations applied.");
```

- [ ] **Step 5: Generate and apply the initial migration**

Run (from `server/`):
```bash
mkdir -p data
npm run db:generate
npm run db:migrate
```

Expected: a new file appears under `server/drizzle/`, and `server/data/catalogue.sqlite` is
created. Console prints `Migrations applied.`

- [ ] **Step 6: Commit**

```bash
git add server/src/db server/drizzle.config.ts server/drizzle server/package.json
git commit -m "Add Drizzle schema and SQLite migration for catalogue data"
```

(Note: `server/data/*.sqlite` stays untracked per `.gitignore`.)

---

## Chunk 3: Markdown Import Pipeline

**Files:**
- Create: `server/src/import/parseMarkdown.ts`
- Create: `server/src/import/parseMarkdown.test.ts`
- Create: `server/src/scripts/import.ts`
- Create: `resources/2000/illustration-map.json`

This is the core parsing logic described in the spec. It's built test-first against the real
`resources/2000/2000.md` file so the tests double as living documentation of the format's quirks.

- [ ] **Step 1: Write the failing parser tests**

Create `server/src/import/parseMarkdown.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { parseCatalogueMarkdown } from "./parseMarkdown.js";

const mdPath = path.resolve(
  fileURLToPath(import.meta.url),
  "../../../../resources/2000/2000.md",
);
const source = readFileSync(mdPath, "utf-8");

describe("parseCatalogueMarkdown", () => {
  it("finds all 18 groups from the index table", () => {
    const result = parseCatalogueMarkdown(source);
    expect(result.groups).toHaveLength(18);
  });

  it("includes a group with no parts table (13.2.C)", () => {
    const result = parseCatalogueMarkdown(source);
    const group = result.groups.find((g) => g.code === "13.2.C");
    expect(group).toBeDefined();
    expect(group?.parts).toHaveLength(0);
    expect(group?.observacoes).toContain("DESENHO");
  });

  it("preserves source row order independent of item_number for 03.1.D", () => {
    const result = parseCatalogueMarkdown(source);
    const group = result.groups.find((g) => g.code === "03.1.D");
    const itemNumbers = group?.parts.map((p) => p.itemNumber);
    // Source lists items in this exact order: 1,2,3,4,5,8,6,7,9...
    expect(itemNumbers?.slice(0, 8)).toEqual(["1", "2", "3", "4", "5", "8", "6", "7"]);
  });

  it("parses reordered columns in 16.1.C via header names, not position", () => {
    const result = parseCatalogueMarkdown(source);
    const group = result.groups.find((g) => g.code === "16.1.C");
    const first = group?.parts[0];
    expect(first?.designacao).toBe("CABLAGEM TRASEIRA (LONGO)");
    expect(first?.codCkd).toBe("123590W");
  });

  it("parses QUANT. as coef in 16.2.E", () => {
    const result = parseCatalogueMarkdown(source);
    const group = result.groups.find((g) => g.code === "16.2.E");
    expect(group?.parts[0]?.coef).toBe("1");
  });

  it("parses accented CÓD. headers in 17.5.H", () => {
    const result = parseCatalogueMarkdown(source);
    const group = result.groups.find((g) => g.code === "17.5.H");
    expect(group?.parts[0]?.codCkd).toBe("123430W");
  });

  it("uses the body heading's spelling over the index when both exist", () => {
    const result = parseCatalogueMarkdown(source);
    const group = result.groups.find((g) => g.code === "02.5.C");
    // Body headings carry a "(XUD)" engine-code suffix that the index table omits;
    // the parser keeps the heading text as-is rather than stripping it.
    expect(group?.name).toBe("FILTRO GASÓLEO (XUD)");
  });

  it("does not treat the index or Ilustrações sections as groups", () => {
    const result = parseCatalogueMarkdown(source);
    const codes = result.groups.map((g) => g.code);
    expect(codes).not.toContain(undefined);
    expect(result.groups.every((g) => /^\d{2}\.\d\.[A-Z]$/.test(g.code))).toBe(true);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test --workspace=server`
Expected: FAIL — `parseMarkdown.ts` does not exist yet.

- [ ] **Step 3: Implement the parser**

Create `server/src/import/parseMarkdown.ts`:

```typescript
export interface ParsedPart {
  itemNumber: string | null;
  sortOrder: number;
  codCkd: string | null;
  codSobres: string | null;
  designacao: string;
  coef: string | null;
  observacoes: string | null;
}

export interface ParsedGroup {
  code: string;
  name: string;
  sortOrder: number;
  observacoes: string | null;
  parts: ParsedPart[];
}

export interface ParsedCatalogue {
  groups: ParsedGroup[];
}

const GROUP_CODE_PATTERN = /^(\d{2}\.\d\.[A-Z])\s+(.+)$/;

function normalizeHeader(header: string): string {
  return header
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip accents
    .trim()
    .toUpperCase();
}

const HEADER_ALIASES: Record<string, keyof ParsedPart | "item" | "skip"> = {
  ITEM: "item",
  "COD. CKD": "codCkd",
  "COD. SOBRES.": "codSobres",
  DESIGNACAO: "designacao",
  COEF: "coef",
  "QUANT.": "coef",
  OBSERVACOES: "observacoes",
};

function resolveHeaderKey(rawHeader: string): keyof ParsedPart | "item" | "skip" {
  const normalized = normalizeHeader(rawHeader).replace(/\.$/, "").replace(/\s+/g, " ");
  const withDot = normalized + ".";
  return (
    HEADER_ALIASES[normalized] ??
    HEADER_ALIASES[withDot] ??
    (normalized.startsWith("COD") && normalized.includes("CKD")
      ? "codCkd"
      : normalized.startsWith("COD") && normalized.includes("SOBRES")
        ? "codSobres"
        : "skip")
  );
}

function splitTableRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function isSeparatorRow(cells: string[]): boolean {
  return cells.every((cell) => /^:?-+:?$/.test(cell));
}

function parseTable(lines: string[]): { headers: string[]; rows: string[][] } {
  const tableLines = lines.filter((l) => l.trim().startsWith("|"));
  if (tableLines.length < 2) return { headers: [], rows: [] };
  const headers = splitTableRow(tableLines[0]);
  const rows = tableLines
    .slice(1)
    .map(splitTableRow)
    .filter((cells) => !isSeparatorRow(cells));
  return { headers, rows };
}

function parseIndexTable(body: string): Map<string, { name: string; observacoes: string | null }> {
  const map = new Map<string, { name: string; observacoes: string | null }>();
  const { headers, rows } = parseTable(body.split("\n"));
  const codeIdx = headers.findIndex((h) => normalizeHeader(h) === "GRUPO");
  const nameIdx = headers.findIndex((h) => normalizeHeader(h) === "DESIGNACAO");
  const obsIdx = headers.findIndex((h) => normalizeHeader(h) === "OBSERVACOES");
  for (const row of rows) {
    const code = row[codeIdx]?.trim();
    if (!code) continue;
    map.set(code, {
      name: row[nameIdx]?.trim() ?? "",
      observacoes: row[obsIdx]?.trim() || null,
    });
  }
  return map;
}

function parsePartsTable(body: string): ParsedPart[] {
  const { headers, rows } = parseTable(body.split("\n"));
  const keyByIndex = headers.map(resolveHeaderKey);

  return rows.map((row, index) => {
    const part: ParsedPart = {
      itemNumber: null,
      sortOrder: index,
      codCkd: null,
      codSobres: null,
      designacao: "",
      coef: null,
      observacoes: null,
    };
    row.forEach((cell, i) => {
      const key = keyByIndex[i];
      const value = cell.trim() || null;
      if (key === "item") part.itemNumber = value;
      else if (key === "skip") return;
      else if (key) (part as Record<string, unknown>)[key] = value ?? "";
    });
    return part;
  });
}

export function parseCatalogueMarkdown(source: string): ParsedCatalogue {
  // Split into top-level "## " sections, keeping the heading with its body.
  const sections = source
    .split(/\n(?=## )/)
    .map((s) => s.trim())
    .filter(Boolean);

  const indexSection = sections.find((s) => s.startsWith("## ÍNDICE"));
  if (!indexSection) throw new Error("Index section not found in source markdown");
  const index = parseIndexTable(indexSection);

  const bodyGroupSections = new Map<string, string>();
  for (const section of sections) {
    const heading = section.split("\n")[0].replace(/^##\s*/, "").trim();
    const match = heading.match(GROUP_CODE_PATTERN);
    if (match) bodyGroupSections.set(match[1], section);
  }

  const groups: ParsedGroup[] = [];
  let sortOrder = 0;
  for (const [code, indexEntry] of index) {
    const bodySection = bodyGroupSections.get(code);
    let name = indexEntry.name;
    let parts: ParsedPart[] = [];
    if (bodySection) {
      const heading = bodySection.split("\n")[0].replace(/^##\s*/, "").trim();
      const match = heading.match(GROUP_CODE_PATTERN);
      if (match) name = match[2].trim();
      parts = parsePartsTable(bodySection);
    }
    groups.push({
      code,
      name,
      sortOrder: sortOrder++,
      observacoes: indexEntry.observacoes,
      parts,
    });
  }

  return { groups };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test --workspace=server`
Expected: PASS for all `parseCatalogueMarkdown` tests. If a specific test fails, inspect the
actual row in `resources/2000/2000.md` cited in that test — the fixture assertions were written
against the real file, so a failure means the parser logic needs adjustment, not the test.

- [ ] **Step 5: Build the illustration map**

Create `resources/2000/illustration-map.json` by reading the `## Ilustrações` section at the
bottom of `2000.md` and matching each numbered illustration to the group it depicts (open each
`.jpg` and compare against the group's part list — this is a manual, one-time judgment call per
the design spec). Structure:

```json
{
  "00.1.D": "1.jpg",
  "01.1.C": "2.jpg",
  "01.2.E": "3.jpg"
}
```

Fill in all 18 entries (including `13.2.C`, which has an illustration but no parts table).

- [ ] **Step 6: Write the seed/import script**

Create `server/src/scripts/import.ts`:

```typescript
import { readFileSync, cpSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { brands, models, groups, parts } from "../db/schema.js";
import { parseCatalogueMarkdown } from "../import/parseMarkdown.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface ImportConfig {
  brandSlug: string;
  brandName: string;
  modelSlug: string;
  modelName: string;
  resourceDir: string;
  markdownFile: string;
}

const CONFIGS: Record<string, ImportConfig> = {
  "alter-2000": {
    brandSlug: "alter",
    brandName: "Alter",
    modelSlug: "2000",
    modelName: "2000",
    resourceDir: path.resolve(__dirname, "../../../resources/2000"),
    markdownFile: "2000.md",
  },
};

async function main() {
  const arg = process.argv.find((a) => a.startsWith("--model="));
  const key = arg?.split("=")[1];
  const config = key && CONFIGS[key];
  if (!config) {
    console.error(`Usage: import.ts --model=<${Object.keys(CONFIGS).join("|")}>`);
    process.exit(1);
  }

  const source = readFileSync(path.join(config.resourceDir, config.markdownFile), "utf-8");
  const illustrationMap: Record<string, string> = JSON.parse(
    readFileSync(path.join(config.resourceDir, "illustration-map.json"), "utf-8"),
  );
  const parsed = parseCatalogueMarkdown(source);

  const [brand] = db
    .insert(brands)
    .values({ slug: config.brandSlug, name: config.brandName })
    .onConflictDoUpdate({ target: brands.slug, set: { name: config.brandName } })
    .returning();

  const [model] = db
    .insert(models)
    .values({
      brandId: brand.id,
      slug: config.modelSlug,
      name: config.modelName,
      status: "active",
    })
    .onConflictDoUpdate({
      target: [models.brandId, models.slug],
      set: { name: config.modelName, status: "active" },
    })
    .returning();

  const existingGroups = db.select().from(groups).where(eq(groups.modelId, model.id)).all();
  for (const g of existingGroups) {
    db.delete(parts).where(eq(parts.groupId, g.id)).run();
  }
  db.delete(groups).where(eq(groups.modelId, model.id)).run();

  const imagesDestDir = path.resolve(__dirname, `../../public/images/${config.modelSlug}`);
  mkdirSync(imagesDestDir, { recursive: true });

  for (const group of parsed.groups) {
    const illustrationFile = illustrationMap[group.code] ?? null;
    if (illustrationFile) {
      cpSync(
        path.join(config.resourceDir, illustrationFile),
        path.join(imagesDestDir, illustrationFile),
      );
    }

    const [insertedGroup] = db
      .insert(groups)
      .values({
        modelId: model.id,
        code: group.code,
        name: group.name,
        illustrationFile,
        sortOrder: group.sortOrder,
        observacoes: group.observacoes,
      })
      .returning();

    if (group.parts.length > 0) {
      db.insert(parts)
        .values(
          group.parts.map((p) => ({
            groupId: insertedGroup.id,
            itemNumber: p.itemNumber,
            sortOrder: p.sortOrder,
            codCkd: p.codCkd,
            codSobres: p.codSobres,
            designacao: p.designacao,
            coef: p.coef,
            observacoes: p.observacoes,
          })),
        )
        .run();
    }
  }

  console.log(`Imported ${parsed.groups.length} groups for ${config.brandName} ${config.modelName}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 7: Run the import against real data**

Run: `npm run import:2000 --workspace=server`
Expected: console prints `Imported 18 groups for Alter 2000.` Spot-check by opening
`server/data/catalogue.sqlite` with a SQLite browser (or `sqlite3` CLI) and confirming
`select count(*) from groups;` returns 18 and `select count(*) from parts;` returns a few hundred.

- [ ] **Step 8: Commit**

```bash
git add server/src/import server/src/scripts/import.ts resources/2000/illustration-map.json
git commit -m "Add markdown import pipeline for Alter 2000 catalogue data"
```

---

## Chunk 4: Express API

**Files:**
- Create: `server/src/routes/catalogue.ts`
- Create: `server/src/routes/catalogue.test.ts`
- Modify: `server/src/index.ts`

- [ ] **Step 1: Write failing route tests**

Create `server/src/routes/catalogue.test.ts`:

```typescript
import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import express from "express";
import { catalogueRouter } from "./catalogue.js";

const app = express();
app.use("/api", catalogueRouter);

describe("GET /api/brands", () => {
  it("returns brands with their models", async () => {
    const res = await request(app).get("/api/brands");
    expect(res.status).toBe(200);
    const alter = res.body.find((b: { slug: string }) => b.slug === "alter");
    expect(alter).toBeDefined();
    expect(alter.models.some((m: { slug: string }) => m.slug === "2000")).toBe(true);
  });
});

describe("GET /api/brands/:brandSlug/models/:modelSlug/groups", () => {
  it("returns 18 groups for alter/2000", async () => {
    const res = await request(app).get("/api/brands/alter/models/2000/groups");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(18);
  });

  it("returns 404 for an unknown model", async () => {
    const res = await request(app).get("/api/brands/alter/models/nope/groups");
    expect(res.status).toBe(404);
  });
});

describe("GET /api/brands/:brandSlug/models/:modelSlug/groups/:code", () => {
  it("returns the group with its parts in sort_order", async () => {
    const res = await request(app).get("/api/brands/alter/models/2000/groups/03.1.D");
    expect(res.status).toBe(200);
    expect(res.body.code).toBe("03.1.D");
    expect(res.body.parts[5].itemNumber).toBe("8");
  });
});

describe("GET /api/search", () => {
  it("matches by designacao substring", async () => {
    const res = await request(app).get("/api/search").query({ q: "RADIADOR" });
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0]).toHaveProperty("groupCode");
  });

  it("matches by cod_ckd or cod_sobres", async () => {
    const res = await request(app).get("/api/search").query({ q: "1224300" });
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
  });
});
```

Note: these tests run against the real seeded SQLite database (`server/data/catalogue.sqlite`),
consistent with the project's small scale — no separate test DB/mocking layer for v1.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test --workspace=server`
Expected: FAIL — `catalogue.ts` route module does not exist yet.

- [ ] **Step 3: Implement the routes**

Create `server/src/routes/catalogue.ts`:

```typescript
import { Router } from "express";
import { eq, and, or, like } from "drizzle-orm";
import { db } from "../db/client.js";
import { brands, models, groups, parts } from "../db/schema.js";

export const catalogueRouter = Router();

catalogueRouter.get("/brands", (_req, res) => {
  const allBrands = db.select().from(brands).all();
  const allModels = db.select().from(models).all();
  const result = allBrands.map((b) => ({
    ...b,
    models: allModels.filter((m) => m.brandId === b.id),
  }));
  res.json(result);
});

function findModel(brandSlug: string, modelSlug: string) {
  const brand = db.select().from(brands).where(eq(brands.slug, brandSlug)).get();
  if (!brand) return null;
  return (
    db
      .select()
      .from(models)
      .where(and(eq(models.brandId, brand.id), eq(models.slug, modelSlug)))
      .get() ?? null
  );
}

catalogueRouter.get("/brands/:brandSlug/models/:modelSlug/groups", (req, res) => {
  const model = findModel(req.params.brandSlug, req.params.modelSlug);
  if (!model) return res.status(404).json({ error: "Model not found" });
  const modelGroups = db
    .select()
    .from(groups)
    .where(eq(groups.modelId, model.id))
    .orderBy(groups.sortOrder)
    .all();
  res.json(modelGroups);
});

catalogueRouter.get("/brands/:brandSlug/models/:modelSlug/groups/:code", (req, res) => {
  const model = findModel(req.params.brandSlug, req.params.modelSlug);
  if (!model) return res.status(404).json({ error: "Model not found" });
  const group = db
    .select()
    .from(groups)
    .where(and(eq(groups.modelId, model.id), eq(groups.code, req.params.code)))
    .get();
  if (!group) return res.status(404).json({ error: "Group not found" });
  const groupParts = db
    .select()
    .from(parts)
    .where(eq(parts.groupId, group.id))
    .orderBy(parts.sortOrder)
    .all();
  res.json({ ...group, parts: groupParts });
});

catalogueRouter.get("/search", (req, res) => {
  const q = String(req.query.q ?? "").trim();
  if (!q) return res.json([]);
  const pattern = `%${q}%`;
  const rows = db
    .select({
      part: parts,
      group: groups,
      model: models,
      brand: brands,
    })
    .from(parts)
    .innerJoin(groups, eq(parts.groupId, groups.id))
    .innerJoin(models, eq(groups.modelId, models.id))
    .innerJoin(brands, eq(models.brandId, brands.id))
    .where(
      or(
        like(parts.designacao, pattern),
        like(parts.codCkd, pattern),
        like(parts.codSobres, pattern),
      ),
    )
    .limit(50)
    .all();

  res.json(
    rows.map((r) => ({
      ...r.part,
      groupCode: r.group.code,
      groupName: r.group.name,
      brandSlug: r.brand.slug,
      modelSlug: r.model.slug,
    })),
  );
});
```

- [ ] **Step 4: Wire the router into the app**

Modify `server/src/index.ts`, adding the router and static file serving for images and the
future client build:

```typescript
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { catalogueRouter } from "./routes/catalogue.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const port = process.env.PORT ?? 3000;

app.use("/api", catalogueRouter);
app.use("/images", express.static(path.resolve(__dirname, "../public/images")));

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm run test --workspace=server`
Expected: PASS for all route tests (requires Chunk 3's import to have already run against
`server/data/catalogue.sqlite`).

- [ ] **Step 6: Commit**

```bash
git add server/src/routes server/src/index.ts
git commit -m "Add catalogue API routes: brands, groups, group detail, search"
```

---

## Chunk 5: Vue Frontend

**Files:**
- Modify: `client/src/main.ts`
- Create: `client/src/router/index.ts`
- Create: `client/src/api/client.ts`
- Create: `client/src/components/AppHeader.vue`
- Create: `client/src/pages/HomePage.vue`
- Create: `client/src/pages/BrandPage.vue`
- Create: `client/src/pages/ModelPage.vue`
- Create: `client/src/pages/GroupDetailPage.vue`
- Modify: `client/src/App.vue`
- Create: `client/src/style.css` (or modify existing)

No automated frontend tests for v1 (per spec) — verify each step by running the dev server and
checking the browser.

- [ ] **Step 1: Add the API client helper**

Create `client/src/api/client.ts`:

```typescript
const BASE = "/api";

export interface Brand {
  id: number;
  slug: string;
  name: string;
  models: Model[];
}

export interface Model {
  id: number;
  slug: string;
  name: string;
  status: "active" | "coming_soon";
}

export interface Group {
  id: number;
  code: string;
  name: string;
  illustrationFile: string | null;
  sortOrder: number;
  observacoes: string | null;
}

export interface Part {
  id: number;
  itemNumber: string | null;
  codCkd: string | null;
  codSobres: string | null;
  designacao: string;
  coef: string | null;
  observacoes: string | null;
}

export interface GroupDetail extends Group {
  parts: Part[];
}

export interface SearchResult extends Part {
  groupCode: string;
  groupName: string;
  brandSlug: string;
  modelSlug: string;
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Request failed: ${url}`);
  return res.json() as Promise<T>;
}

export const api = {
  getBrands: () => getJson<Brand[]>(`${BASE}/brands`),
  getGroups: (brandSlug: string, modelSlug: string) =>
    getJson<Group[]>(`${BASE}/brands/${brandSlug}/models/${modelSlug}/groups`),
  getGroupDetail: (brandSlug: string, modelSlug: string, code: string) =>
    getJson<GroupDetail>(`${BASE}/brands/${brandSlug}/models/${modelSlug}/groups/${code}`),
  search: (q: string) => getJson<SearchResult[]>(`${BASE}/search?q=${encodeURIComponent(q)}`),
};
```

- [ ] **Step 2: Set up the router**

Create `client/src/router/index.ts`:

```typescript
import { createRouter, createWebHistory } from "vue-router";
import HomePage from "../pages/HomePage.vue";
import BrandPage from "../pages/BrandPage.vue";
import ModelPage from "../pages/ModelPage.vue";
import GroupDetailPage from "../pages/GroupDetailPage.vue";

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", component: HomePage },
    { path: "/:brandSlug", component: BrandPage, props: true },
    { path: "/:brandSlug/:modelSlug", component: ModelPage, props: true },
    {
      path: "/:brandSlug/:modelSlug/:groupCode",
      component: GroupDetailPage,
      props: true,
    },
  ],
});
```

- [ ] **Step 3: Wire router and Pinia into the app entrypoint**

Modify `client/src/main.ts`:

```typescript
import { createApp } from "vue";
import { createPinia } from "pinia";
import App from "./App.vue";
import { router } from "./router";
import "./style.css";

createApp(App).use(createPinia()).use(router).mount("#app");
```

- [ ] **Step 4: Build the app shell and header**

Replace `client/src/App.vue`:

```vue
<script setup lang="ts">
import AppHeader from "./components/AppHeader.vue";
</script>

<template>
  <AppHeader />
  <main class="page">
    <router-view />
  </main>
</template>
```

Create `client/src/components/AppHeader.vue`:

```vue
<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import { api } from "../api/client";

const router = useRouter();
const query = ref("");

async function onSearch() {
  const q = query.value.trim();
  if (!q) return;
  const results = await api.search(q);
  if (results.length > 0) {
    const r = results[0];
    router.push(`/${r.brandSlug}/${r.modelSlug}/${r.groupCode}?highlight=${r.id}`);
  }
}
</script>

<template>
  <header class="app-header">
    <router-link to="/" class="logo">umm<sup>®</sup> <span>catálogo de peças</span></router-link>
    <input
      v-model="query"
      class="search-input"
      placeholder="Pesquisar peça, código..."
      @keyup.enter="onSearch"
    />
  </header>
</template>
```

- [ ] **Step 5: Build the home page (brand picker)**

Create `client/src/pages/HomePage.vue`:

```vue
<script setup lang="ts">
import { ref, onMounted } from "vue";
import { api, type Brand } from "../api/client";

const brands = ref<Brand[]>([]);

onMounted(async () => {
  brands.value = await api.getBrands();
});
</script>

<template>
  <div class="section">
    <p class="label">Selecione a marca</p>
    <div class="card-grid">
      <router-link
        v-for="brand in brands"
        :key="brand.id"
        :to="`/${brand.slug}`"
        class="card"
      >
        <div class="card-title">{{ brand.name.toUpperCase() }}</div>
      </router-link>
    </div>
  </div>
</template>
```

- [ ] **Step 6: Build the brand page (model picker)**

Create `client/src/pages/BrandPage.vue`:

```vue
<script setup lang="ts">
import { ref, onMounted, watch } from "vue";
import { api, type Brand } from "../api/client";

const props = defineProps<{ brandSlug: string }>();
const brand = ref<Brand | null>(null);

async function load() {
  const brands = await api.getBrands();
  brand.value = brands.find((b) => b.slug === props.brandSlug) ?? null;
}

onMounted(load);
watch(() => props.brandSlug, load);
</script>

<template>
  <div v-if="brand" class="section">
    <p class="label">{{ brand.name.toUpperCase() }} &rsaquo; Modelos</p>
    <div class="card-grid">
      <router-link
        v-for="model in brand.models"
        :key="model.id"
        :to="model.status === 'active' ? `/${brand.slug}/${model.slug}` : ''"
        class="card"
        :class="{ disabled: model.status !== 'active' }"
      >
        <div class="card-title">{{ model.name }}</div>
        <div class="card-subtitle">
          {{ model.status === "active" ? "" : "brevemente" }}
        </div>
      </router-link>
    </div>
  </div>
</template>
```

- [ ] **Step 7: Build the model page (group listing with client-side filter)**

Create `client/src/pages/ModelPage.vue`:

```vue
<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { api, type Group } from "../api/client";

const props = defineProps<{ brandSlug: string; modelSlug: string }>();
const groups = ref<Group[]>([]);
const filter = ref("");

async function load() {
  groups.value = await api.getGroups(props.brandSlug, props.modelSlug);
}

onMounted(load);
watch(() => [props.brandSlug, props.modelSlug], load);

const filtered = computed(() => {
  const f = filter.value.trim().toLowerCase();
  if (!f) return groups.value;
  return groups.value.filter(
    (g) => g.code.toLowerCase().includes(f) || g.name.toLowerCase().includes(f),
  );
});
</script>

<template>
  <div class="section">
    <input v-model="filter" class="search-input" placeholder="Filtrar grupos..." />
    <div class="card-grid">
      <router-link
        v-for="group in filtered"
        :key="group.id"
        :to="`/${brandSlug}/${modelSlug}/${group.code}`"
        class="card"
      >
        <div class="card-title">{{ group.code }}</div>
        <div class="card-subtitle">{{ group.name }}</div>
      </router-link>
    </div>
  </div>
</template>
```

- [ ] **Step 8: Build the group detail page (side-by-side illustration + table)**

Create `client/src/pages/GroupDetailPage.vue`:

```vue
<script setup lang="ts">
import { ref, onMounted, watch } from "vue";
import { useRoute } from "vue-router";
import { api, type GroupDetail } from "../api/client";

const props = defineProps<{ brandSlug: string; modelSlug: string; groupCode: string }>();
const route = useRoute();
const group = ref<GroupDetail | null>(null);

async function load() {
  group.value = await api.getGroupDetail(props.brandSlug, props.modelSlug, props.groupCode);
}

onMounted(load);
watch(() => [props.brandSlug, props.modelSlug, props.groupCode], load);

function isHighlighted(partId: number) {
  return String(route.query.highlight) === String(partId);
}
</script>

<template>
  <div v-if="group" class="group-detail">
    <div class="illustration-pane">
      <img
        v-if="group.illustrationFile"
        :src="`/images/${modelSlug}/${group.illustrationFile}`"
        :alt="group.name"
      />
    </div>
    <div class="table-pane">
      <h2>{{ group.code }} {{ group.name }}</h2>
      <table>
        <thead>
          <tr>
            <th>Item</th>
            <th>Cód. CKD</th>
            <th>Cód. Sobres.</th>
            <th>Designação</th>
            <th>Coef.</th>
            <th>Observações</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="part in group.parts"
            :key="part.id"
            :class="{ highlighted: isHighlighted(part.id) }"
          >
            <td>{{ part.itemNumber }}</td>
            <td>{{ part.codCkd }}</td>
            <td>{{ part.codSobres }}</td>
            <td>{{ part.designacao }}</td>
            <td>{{ part.coef }}</td>
            <td>{{ part.observacoes }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
```

- [ ] **Step 9: Add branding styles**

Add to `client/src/style.css` (replace default Vite boilerplate styles):

```css
:root {
  --umm-blue: #0a6abd;
  --text-dark: #1f2937;
}

body {
  margin: 0;
  font-family: Inter, system-ui, Arial, sans-serif;
  color: var(--text-dark);
  background: #fafbfc;
}

.app-header {
  background: var(--umm-blue);
  color: #fff;
  padding: 16px 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.app-header .logo {
  color: #fff;
  font-weight: 800;
  text-decoration: none;
  font-size: 20px;
}

.search-input {
  border: none;
  border-radius: 5px;
  padding: 8px 12px;
  font-size: 14px;
  min-width: 220px;
}

.page {
  padding: 24px;
  max-width: 1100px;
  margin: 0 auto;
}

.card-grid {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}

.card {
  flex: 1 1 200px;
  background: #fff;
  border: 1px solid #e2e5e9;
  border-radius: 8px;
  padding: 16px;
  text-align: center;
  text-decoration: none;
  color: var(--text-dark);
}

.card.disabled {
  opacity: 0.6;
  pointer-events: none;
}

.card-title {
  font-weight: 700;
}

.card-subtitle {
  font-size: 12px;
  color: var(--umm-blue);
  margin-top: 4px;
}

.group-detail {
  display: flex;
  gap: 24px;
}

.illustration-pane {
  flex: 1;
  position: sticky;
  top: 24px;
  align-self: flex-start;
}

.illustration-pane img {
  max-width: 100%;
}

.table-pane {
  flex: 1;
}

table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

th {
  background: var(--umm-blue);
  color: #fff;
  text-align: left;
  padding: 6px 8px;
}

td {
  padding: 6px 8px;
  border-bottom: 1px solid #eee;
}

tr.highlighted {
  background: #fff6d9;
}

@media (max-width: 800px) {
  .group-detail {
    flex-direction: column;
  }
  .illustration-pane {
    position: static;
  }
}
```

- [ ] **Step 10: Proxy API requests during development**

Modify `client/vite.config.ts` to proxy `/api` and `/images` to the Express server during
`npm run dev`:

```typescript
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [vue()],
  server: {
    proxy: {
      "/api": "http://localhost:3000",
      "/images": "http://localhost:3000",
    },
  },
});
```

- [ ] **Step 11: Manually verify in the browser**

Run `npm run dev --workspace=server` in one terminal and `npm run dev --workspace=client` in
another. Open the client's dev URL (typically `http://localhost:5173`) and verify:
- Home page shows Alter (and Cournil, disabled)
- Clicking Alter shows model 2000 (active) and a disabled placeholder
- Clicking 2000 shows 18 group cards, filterable by typing
- Clicking a group shows the illustration next to its table, side by side
- Typing a known part name or code into the header search and pressing Enter navigates to the
  correct group with that row highlighted

- [ ] **Step 12: Commit**

```bash
git add client
git commit -m "Add Vue frontend: brand/model/group navigation, group detail, search"
```

---

## Chunk 6: Production Build Integration

**Files:**
- Modify: `server/src/index.ts`
- Modify: root `package.json`

- [ ] **Step 1: Serve the built client from Express**

Modify `server/src/index.ts` to serve `client/dist` as static files with an SPA fallback, placed
after the API routes:

```typescript
const clientDist = path.resolve(__dirname, "../../client/dist");
app.use(express.static(clientDist));
app.get(/^(?!\/api|\/images).*/, (_req, res) => {
  res.sendFile(path.join(clientDist, "index.html"));
});
```

- [ ] **Step 2: Add a root build/start flow**

Add to root `package.json` scripts:

```json
{
  "scripts": {
    "build": "npm run build --workspace=client && npm run build --workspace=server",
    "start": "npm run start --workspace=server"
  }
}
```

- [ ] **Step 3: Verify the production build end to end**

Run: `npm run build` then `npm run start` from the repo root.
Expected: server logs `Server listening on http://localhost:3000`. Open
`http://localhost:3000/` in a browser and confirm the full app (home → brand → model → group
detail → search) works without the separate Vite dev server running.

- [ ] **Step 4: Commit**

```bash
git add server/src/index.ts package.json
git commit -m "Serve built Vue client from Express for production"
```
