import { z } from "zod";

/**
 * Item variants (sizes) and modifier groups (add-ons).
 *
 * - `variants`: pick exactly one (e.g. Half / Full, S / M / L). Each variant
 *   carries its own full price and replaces the item's base price.
 * - `groups`: modifier groups (e.g. "Extra toppings", "Choose a bread") with
 *   min/max picks. min ≥ 1 makes the group required. Each option adds its
 *   price (can be 0) to the unit price.
 *
 * Prices are in the currency's minor unit, like `items.price_minor`.
 */

export type Variant = { id: string; name: string; priceMinor: number };
export type ModifierOption = { id: string; name: string; priceMinor: number };
export type ModifierGroup = { id: string; name: string; min: number; max: number; options: ModifierOption[] };
export type ItemOptions = { variants: Variant[]; groups: ModifierGroup[] };

export type Selection = { variantId?: string | null; modifiers?: Record<string, string[]> };

const idSchema = z.string().trim().min(1).max(40);
const priceSchema = z.number().int().min(0).max(100_000_000_00);

export const itemOptionsSchema = z
  .object({
    variants: z
      .array(z.object({ id: idSchema, name: z.string().trim().min(1, "Variant name is required").max(40), priceMinor: priceSchema }))
      .max(8)
      .default([]),
    groups: z
      .array(
        z.object({
          id: idSchema,
          name: z.string().trim().min(1, "Group name is required").max(60),
          min: z.number().int().min(0).max(20),
          max: z.number().int().min(1).max(20),
          options: z
            .array(z.object({ id: idSchema, name: z.string().trim().min(1, "Option name is required").max(60), priceMinor: priceSchema }))
            .min(1, "Add at least one option")
            .max(30),
        }),
      )
      .max(8)
      .default([]),
  })
  .superRefine((o, ctx) => {
    if (o.variants.length === 1) ctx.addIssue({ code: "custom", message: "Add at least two sizes, or none", path: ["variants"] });
    const ids = new Set<string>();
    for (const v of o.variants) {
      if (ids.has(v.id)) ctx.addIssue({ code: "custom", message: "Duplicate variant", path: ["variants"] });
      ids.add(v.id);
    }
    o.groups.forEach((g, i) => {
      if (g.min > g.max) ctx.addIssue({ code: "custom", message: `"${g.name}": minimum can't be more than maximum`, path: ["groups", i] });
      if (g.min > g.options.length) ctx.addIssue({ code: "custom", message: `"${g.name}": minimum is more than the number of options`, path: ["groups", i] });
    });
  });

export const EMPTY_OPTIONS: ItemOptions = { variants: [], groups: [] };

export function normalizeOptions(raw: unknown): ItemOptions {
  if (!raw || typeof raw !== "object") return EMPTY_OPTIONS;
  const parsed = itemOptionsSchema.safeParse(raw);
  return parsed.success ? parsed.data : EMPTY_OPTIONS;
}

export function hasOptions(o: ItemOptions | null | undefined): boolean {
  return !!o && (o.variants.length > 0 || o.groups.length > 0);
}

/** Lowest price a guest can pay (for "from ₹X" labels). */
export function startingPrice(basePriceMinor: number, o: ItemOptions | null | undefined): number {
  const base = o && o.variants.length ? Math.min(...o.variants.map((v) => v.priceMinor)) : basePriceMinor;
  const requiredExtras = (o?.groups ?? []).reduce((sum, g) => {
    if (g.min <= 0) return sum;
    const cheapest = [...g.options].map((x) => x.priceMinor).sort((a, b) => a - b).slice(0, g.min);
    return sum + cheapest.reduce((s, p) => s + p, 0);
  }, 0);
  return base + requiredExtras;
}

export type ResolvedSelection =
  | { ok: true; unitMinor: number; variant: Variant | null; modifiers: { group: string; option: string; priceMinor: number }[]; label: string; key: string }
  | { ok: false; error: string };

/**
 * Validate a guest's choices against the item's options and compute the unit
 * price. Used in the browser (cart) AND on the server (order pricing), so the
 * server never trusts a client-sent price.
 */
export function resolveSelection(itemId: string, basePriceMinor: number, options: ItemOptions | null | undefined, sel: Selection = {}): ResolvedSelection {
  const o = options ?? EMPTY_OPTIONS;
  let variant: Variant | null = null;
  if (o.variants.length) {
    variant = o.variants.find((v) => v.id === sel.variantId) ?? null;
    if (!variant) return { ok: false, error: "Choose a size" };
  } else if (sel.variantId) {
    return { ok: false, error: "This item has no sizes" };
  }
  const chosen = sel.modifiers ?? {};
  for (const gid of Object.keys(chosen)) {
    if (!o.groups.some((g) => g.id === gid)) return { ok: false, error: "Unknown add-on group" };
  }
  const modifiers: { group: string; option: string; priceMinor: number }[] = [];
  const keyParts: string[] = [];
  for (const g of o.groups) {
    const picked = [...new Set(chosen[g.id] ?? [])];
    if (picked.length < g.min) return { ok: false, error: g.min === 1 ? `Choose ${g.name}` : `Choose at least ${g.min} for ${g.name}` };
    if (picked.length > g.max) return { ok: false, error: `Choose up to ${g.max} for ${g.name}` };
    const opts = picked.map((id) => g.options.find((x) => x.id === id));
    if (opts.some((x) => !x)) return { ok: false, error: `Unknown option in ${g.name}` };
    // Keep the owner's option order so the label and key are stable.
    const ordered = g.options.filter((x) => picked.includes(x.id));
    for (const x of ordered) modifiers.push({ group: g.name, option: x.name, priceMinor: x.priceMinor });
    if (ordered.length) keyParts.push(`${g.id}=${ordered.map((x) => x.id).join("+")}`);
  }
  const unitMinor = (variant ? variant.priceMinor : basePriceMinor) + modifiers.reduce((s, m) => s + m.priceMinor, 0);
  const label = [variant?.name, ...modifiers.map((m) => m.option)].filter(Boolean).join(", ");
  const key = [itemId, variant?.id ?? "", ...keyParts].join("|");
  return { ok: true, unitMinor, variant, modifiers, label, key };
}

/** Small random id for new variants/options in the editor. */
export function newOptionId(): string {
  return Math.random().toString(36).slice(2, 10);
}
