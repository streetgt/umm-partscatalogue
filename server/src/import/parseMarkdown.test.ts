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

  it("throws on an unrecognized table header instead of silently skipping the column", () => {
    const synthetic = `# Catálogo Sintético

## ÍNDICE CATÁLOGO PEÇAS (XUD)

| GRUPO | DESIGNAÇÃO | OBSERVAÇÕES |
| --- | --- | --- |
| 99.9.Z | PEÇA DE TESTE |  |

## 99.9.Z PEÇA DE TESTE

| ITEM | COD. CKD | COD. SOBRES. | DESIGNAÇÃO | PESO | OBSERVAÇÕES |
| --- | --- | --- | --- | --- | --- |
| 1 | 123456W | 654321W | PARAFUSO | 1.2 |  |
`;
    expect(() => parseCatalogueMarkdown(synthetic)).toThrow(/PESO/);
  });
});
