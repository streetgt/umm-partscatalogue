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
