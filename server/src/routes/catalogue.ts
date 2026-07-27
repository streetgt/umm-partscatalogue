import { Router } from "express";
import { eq, and, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import { brands, models, groups, parts } from "../db/schema.js";

/**
 * Escapes SQL LIKE metacharacters (\, %, _) in a raw user-supplied string so
 * it can be safely embedded in a LIKE pattern with `ESCAPE '\'`. The
 * backslash must be escaped first, otherwise the escape characters we add
 * for % and _ would themselves be re-escaped.
 */
function escapeLikePattern(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

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
  const pattern = `%${escapeLikePattern(q)}%`;
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
      sql`(${parts.designacao} LIKE ${pattern} ESCAPE '\\') OR (${parts.codCkd} LIKE ${pattern} ESCAPE '\\') OR (${parts.codSobres} LIKE ${pattern} ESCAPE '\\')`,
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
