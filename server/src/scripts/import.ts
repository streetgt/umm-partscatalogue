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
    return;
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
    .returning()
    .all();

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
    .returning()
    .all();

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
      .returning()
      .all();

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
