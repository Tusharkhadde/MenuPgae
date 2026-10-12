import { parsePriceToMinor } from "@/lib/money";
import type { Variant } from "@/lib/options";

/** RFC 4180-ish CSV parser: quoted fields, escaped quotes, CRLF/LF, BOM. Also accepts ; or tab separators. */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^\uFEFF/, "");
  const firstLine = src.split(/\r?\n/, 1)[0] ?? "";
  const sep = [",", ";", "\t"].map((s) => ({ s, n: firstLine.split(s).length })).sort((a, b) => b.n - a.n)[0].s;
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
      continue;
    }
    if (c === '"' && field === "") inQuotes = true;
    else if (c === sep) {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((f) => f.trim() !== ""));
}

export const CSV_COLUMNS = ["category", "name", "description", "price", "diet", "spicy", "allergens", "bestseller", "sold_out", "calories", "variants"] as const;

export const CSV_TEMPLATE =
  CSV_COLUMNS.join(",") +
  "\n" +
  [
    'Breakfast,Masala Dosa,"Crispy rice crepe, potato masala",120,veg,1,,yes,no,350,',
    "Mains,Paneer Butter Masala,Cottage cheese in tomato butter gravy,0,veg,1,dairy,no,no,,Half:180|Full:300",
    "Drinks,Masala Chai,Ginger & cardamom,40,veg,0,dairy,yes,no,90,",
  ].join("\n") +
  "\n";

export type ImportRow = {
  line: number;
  category: string;
  name: string;
  description: string | null;
  priceMinor: number;
  diet: "veg" | "nonveg" | "vegan" | "egg" | null;
  spicy: number;
  allergens: string[];
  bestseller: boolean;
  soldOut: boolean;
  calories: number | null;
  variants: Variant[];
};

export type ImportResult = { rows: ImportRow[]; errors: { line: number; message: string }[] };

const ALIASES: Record<string, (typeof CSV_COLUMNS)[number]> = {
  section: "category",
  item: "name",
  dish: "name",
  title: "name",
  desc: "description",
  cost: "price",
  rate: "price",
  type: "diet",
  "veg/non-veg": "diet",
  spice: "spicy",
  allergen: "allergens",
  "sold out": "sold_out",
  soldout: "sold_out",
  kcal: "calories",
  sizes: "variants",
};

function truthy(v: string): boolean {
  return /^(y|yes|true|1|x|✓)$/i.test(v.trim());
}

function parseDiet(v: string): ImportRow["diet"] {
  const t = v.trim().toLowerCase().replace(/[\s_-]/g, "");
  if (!t) return null;
  if (["veg", "vegetarian", "v"].includes(t)) return "veg";
  if (["vegan", "vg"].includes(t)) return "vegan";
  if (["nonveg", "nv", "meat", "chicken", "fish"].includes(t)) return "nonveg";
  if (["egg", "eggetarian", "contains egg"].includes(t)) return "egg";
  return null;
}

const KNOWN_ALLERGENS = new Set(["gluten", "dairy", "egg", "nuts", "peanuts", "soy", "fish", "shellfish", "sesame", "mustard", "celery"]);

/** Turn parsed CSV into validated menu rows. The first row must be a header. */
export function rowsFromCsv(table: string[][], currency: string, maxRows = 1000): ImportResult {
  const errors: ImportResult["errors"] = [];
  const rows: ImportRow[] = [];
  if (table.length < 2) return { rows, errors: [{ line: 1, message: "The file needs a header row and at least one item." }] };
  const header = table[0].map((h) => {
    const k = h.trim().toLowerCase();
    return (CSV_COLUMNS as readonly string[]).includes(k) ? (k as (typeof CSV_COLUMNS)[number]) : (ALIASES[k] ?? null);
  });
  if (!header.includes("name") || !header.includes("price")) {
    return { rows, errors: [{ line: 1, message: 'The header must include at least "name" and "price" columns. Download the template.' }] };
  }
  for (let i = 1; i < table.length; i++) {
    const line = i + 1;
    if (rows.length >= maxRows) {
      errors.push({ line, message: `Only the first ${maxRows} items are imported.` });
      break;
    }
    const rec: Partial<Record<(typeof CSV_COLUMNS)[number], string>> = {};
    header.forEach((h, j) => {
      if (h) rec[h] = (table[i][j] ?? "").trim();
    });
    const name = (rec.name ?? "").slice(0, 100);
    if (!name) {
      errors.push({ line, message: "Missing name." });
      continue;
    }
    const variants: Variant[] = [];
    let variantError = false;
    if (rec.variants) {
      for (const [k, part] of rec.variants.split("|").entries()) {
        const [vName, vPrice] = part.split(":").map((s) => s?.trim() ?? "");
        const p = vPrice ? parsePriceToMinor(vPrice, currency) : null;
        if (!vName || p === null) {
          variantError = true;
          break;
        }
        variants.push({ id: `v${k + 1}`, name: vName.slice(0, 40), priceMinor: p });
      }
      if (variantError || variants.length === 1) {
        errors.push({ line, message: `"${name}": sizes must look like Half:120|Full:200 (two or more).` });
        continue;
      }
    }
    const price = parsePriceToMinor((rec.price ?? "").replace(/[^\d.,]/g, ""), currency);
    if (price === null && !variants.length) {
      errors.push({ line, message: `"${name}": invalid price "${rec.price ?? ""}".` });
      continue;
    }
    const spicy = Math.min(3, Math.max(0, Number.parseInt(rec.spicy ?? "0", 10) || 0));
    const calories = rec.calories ? Number.parseInt(rec.calories, 10) : NaN;
    rows.push({
      line,
      category: (rec.category || "Menu").slice(0, 60),
      name,
      description: rec.description ? rec.description.slice(0, 400) : null,
      priceMinor: variants.length ? Math.min(...variants.map((v) => v.priceMinor)) : (price ?? 0),
      diet: parseDiet(rec.diet ?? ""),
      spicy,
      allergens: (rec.allergens ?? "")
        .split(/[|,/]/)
        .map((a) => a.trim().toLowerCase())
        .filter((a) => KNOWN_ALLERGENS.has(a)),
      bestseller: truthy(rec.bestseller ?? ""),
      soldOut: truthy(rec.sold_out ?? ""),
      calories: Number.isFinite(calories) && calories >= 0 && calories < 10000 ? calories : null,
      variants,
    });
  }
  return { rows, errors };
}
