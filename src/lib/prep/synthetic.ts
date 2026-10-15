import { addDays, type HistoryRow } from "@/lib/prep/history";

/**
 * SYNTHETIC demo order history — clearly labelled as such everywhere it is shown.
 *
 * Lets the prep planner run for the demo restaurant (or a brand-new one) without real orders.
 * Deterministic (seeded) so screenshots and tests are reproducible. Patterns baked in:
 * weekend lift, meal-time hour profiles per category, a holiday bump, and two injected
 * oddities (one spike day and one dish that "ran out") so anomaly detection has something to find.
 * None of this is real sales data.
 */

export type SyntheticItem = { name: string; category: string; price: number };

/** Small, fast seeded PRNG (mulberry32). */
export function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Poisson sample (Knuth) — fine for the small means used here. */
function poisson(mean: number, rand: () => number): number {
  if (mean <= 0) return 0;
  const L = Math.exp(-Math.min(mean, 60));
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= rand();
  } while (p > L && k < 500);
  return k - 1;
}

/** Hour weights by category keyword: chai/breakfast peak morning, mains peak lunch & dinner. */
function hourProfile(category: string, name: string): Record<number, number> {
  const c = `${category} ${name}`.toLowerCase();
  if (/chai|coffee|tea|breakfast|poha|upma|idli/.test(c)) return { 8: 0.25, 9: 0.25, 10: 0.15, 16: 0.15, 17: 0.2 };
  if (/dessert|sweet|kulfi|jamun|lassi|drink|cooler/.test(c)) return { 13: 0.2, 14: 0.15, 20: 0.3, 21: 0.35 };
  if (/snack|street|chaat|pav|vada|samosa/.test(c)) return { 11: 0.1, 16: 0.3, 17: 0.35, 18: 0.25 };
  return { 12: 0.2, 13: 0.3, 14: 0.1, 19: 0.1, 20: 0.2, 21: 0.1 };
}

const WEEKDAY_LIFT = [1.35, 0.85, 0.9, 0.9, 1.0, 1.2, 1.45]; // Sun..Sat

export type SyntheticOptions = { items: SyntheticItem[]; days: number; endDate: string; seed?: number; holidays?: string[] };

export function generateSyntheticHistory(opts: SyntheticOptions): HistoryRow[] {
  const rand = prng(opts.seed ?? 42);
  const holidays = new Set(opts.holidays ?? []);
  const start = addDays(opts.endDate, -(opts.days - 1));
  const items = opts.items.slice(0, 25);
  // Injected oddities, placed deterministically inside the window.
  const spikeDay = addDays(opts.endDate, -Math.min(9, opts.days - 1));
  const stockoutDay = addDays(opts.endDate, -Math.min(4, opts.days - 1));
  const stockoutItem = items.length ? items[hash(items.map((i) => i.name).join()) % items.length].name : "";
  const rows: HistoryRow[] = [];
  for (let i = 0; i < opts.days; i++) {
    const date = addDays(start, i);
    const dow = new Date(`${date}T00:00:00Z`).getUTCDay();
    const trend = 1 + (0.15 * i) / Math.max(1, opts.days); // slow growth across the window
    const dayLift = WEEKDAY_LIFT[dow] * trend * (holidays.has(date) ? 1.3 : 1) * (date === spikeDay ? 1.9 : 1);
    for (const it of items) {
      const base = 4 + (hash(it.name) % 18); // 4–21 portions on an average weekday
      const profile = hourProfile(it.category, it.name);
      for (const [h, w] of Object.entries(profile)) {
        let qty = poisson(base * w * dayLift, rand);
        if (date === stockoutDay && it.name === stockoutItem && Number(h) >= 13) qty = 0;
        if (qty > 0) rows.push({ date, hour: Number(h), item: it.name, category: it.category, qty, price: it.price });
      }
    }
  }
  return rows;
}
