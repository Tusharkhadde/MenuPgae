/** "1-12" / "1,2,5" / "A1-A4" → table labels (bounded). */
export function parseTables(input: string | null | undefined, max: number): string[] {
  if (!input) return [];
  const out: string[] = [];
  for (const part of input.split(",").map((p) => p.trim()).filter(Boolean)) {
    const m = part.match(/^([A-Za-z]*)(\d+)\s*-\s*\1?(\d+)$/);
    if (m) {
      const [, prefix, a, b] = m;
      const from = Number(a);
      const to = Number(b);
      for (let i = Math.min(from, to); i <= Math.max(from, to) && out.length < max; i++) out.push(`${prefix}${i}`);
    } else if (/^[A-Za-z0-9_-]{1,12}$/.test(part)) {
      out.push(part);
    }
    if (out.length >= max) break;
  }
  return [...new Set(out)].slice(0, max);
}
