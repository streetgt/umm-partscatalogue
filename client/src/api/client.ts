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
