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

type PartKey = keyof ParsedPart | "item" | "skip";

const HEADER_ALIASES: Record<string, PartKey> = {
  ITEM: "item",
  "COD. CKD": "codCkd",
  "COD. SOBRES.": "codSobres",
  DESIGNACAO: "designacao",
  COEF: "coef",
  "COEF.": "coef",
  "QUANT.": "coef",
  OBSERVACOES: "observacoes",
};

function resolveHeaderKey(rawHeader: string): PartKey {
  const normalized = normalizeHeader(rawHeader).replace(/\.$/, "").replace(/\s+/g, " ");
  const withDot = normalized + ".";
  if (HEADER_ALIASES[normalized]) return HEADER_ALIASES[normalized];
  if (HEADER_ALIASES[withDot]) return HEADER_ALIASES[withDot];
  if (normalized.startsWith("COD") && normalized.includes("CKD")) return "codCkd";
  if (normalized.startsWith("COD") && normalized.includes("SOBRES")) return "codSobres";
  if (normalized.startsWith("DESIGNA")) return "designacao";
  if (normalized.startsWith("OBSERVA")) return "observacoes";
  return "skip";
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

function parsePartsTable(body: string, sectionLabel: string): ParsedPart[] {
  const { headers, rows } = parseTable(body.split("\n"));
  const keyByIndex = headers.map(resolveHeaderKey);

  headers.forEach((rawHeader, i) => {
    if (keyByIndex[i] === "skip") {
      throw new Error(
        `Unrecognized table header "${rawHeader}" in section "${sectionLabel}". ` +
          `Add it to HEADER_ALIASES if it maps to a known field, or to the allowlist if it should be ignored.`,
      );
    }
  });

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
      else if (key === "designacao") part.designacao = value ?? "";
      else if (key === "codCkd") part.codCkd = value;
      else if (key === "codSobres") part.codSobres = value;
      else if (key === "coef") part.coef = value;
      else if (key === "observacoes") part.observacoes = value;
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
      parts = parsePartsTable(bodySection, heading);
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
