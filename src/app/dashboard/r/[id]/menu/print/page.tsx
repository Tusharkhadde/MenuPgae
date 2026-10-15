import { asc, eq } from "drizzle-orm";
import { requireRestaurantAccess } from "@/server/session";
import { getDb } from "@/lib/db";
import { categories, items } from "@/lib/db/schema";
import { qrSvg, qrTargetUrl } from "@/lib/qr";
import { appUrl } from "@/lib/env";
import { formatMoney } from "@/lib/money";
import { normalizeOptions, startingPrice } from "@/lib/options";
import { describeAvailability } from "@/lib/schedule";
import { THEMES, type ThemeIdT } from "@/lib/themes";
import { PrintButton } from "@/components/dashboard/print-button";
import { DietDot } from "@/components/menu/diet-dot";

export const metadata = { title: "Printable menu" };

/** A4 printable, branded menu — print or "Save as PDF" from the browser (no PDF library, no server cost). */
export default async function PrintMenuPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ cols?: string; photos?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const cols = sp.cols === "1" ? 1 : 2;
  const { restaurant: r } = await requireRestaurantAccess(id, "manager");
  const db = await getDb();
  const [cats, its] = await Promise.all([
    db.select().from(categories).where(eq(categories.restaurantId, r.id)).orderBy(asc(categories.position), asc(categories.createdAt)),
    db.select().from(items).where(eq(items.restaurantId, r.id)).orderBy(asc(items.position), asc(items.createdAt)),
  ]);
  const svg = await qrSvg(qrTargetUrl(appUrl(), r.slug));
  const accent = THEMES[(r.theme as ThemeIdT) ?? "classic"]?.swatch[1] ?? "#9a3412";
  const sections = cats.map((c) => ({ ...c, items: its.filter((i) => i.categoryId === c.id) })).filter((c) => c.items.length);

  return (
    <div className="mx-auto max-w-[210mm]">
      <style>{`@page { size: A4; margin: 12mm; } @media print { header, nav, .no-print { display: none !important; } body { background: #fff !important; } }`}</style>
      <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card p-4">
        <div>
          <p className="font-medium">Printable menu</p>
          <p className="text-sm text-muted-foreground">Prints on A4. Choose “Save as PDF” in the print dialog for a PDF to send to a print shop.</p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <a className={`rounded-lg border px-3 py-1.5 ${cols === 2 ? "bg-accent font-medium" : ""}`} href="?cols=2">2 columns</a>
          <a className={`rounded-lg border px-3 py-1.5 ${cols === 1 ? "bg-accent font-medium" : ""}`} href="?cols=1">1 column</a>
          <PrintButton />
        </div>
      </div>
      <article className="bg-white p-[8mm] text-black print:p-0" style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>
        <header className="flex items-center justify-between gap-6 border-b-2 pb-5" style={{ borderColor: accent }}>
          <div className="flex items-center gap-4">
            {r.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element -- owner logo
              <img src={r.logoUrl} alt="" className="size-16 rounded-xl object-cover" />
            )}
            <div>
              <h1 className="text-[28pt] font-bold leading-tight" style={{ color: accent }}>{r.name}</h1>
              {(r.tagline || r.cuisine) && <p className="text-[11pt] italic text-neutral-600">{r.tagline ?? r.cuisine}</p>}
            </div>
          </div>
          <div className="text-center">
            <div className="size-[26mm] [&_svg]:size-full" dangerouslySetInnerHTML={{ __html: svg }} />
            <p className="mt-1 font-sans text-[7pt] uppercase tracking-wider text-neutral-500">Scan to order</p>
          </div>
        </header>
        {sections.length === 0 ? (
          <p className="py-20 text-center font-sans text-neutral-500">Add dishes to your menu to print it.</p>
        ) : (
          <div className={cols === 2 ? "mt-6 columns-2 gap-10" : "mt-6"}>
            {sections.map((c) => (
              <section key={c.id} className="mb-6 break-inside-avoid-column">
                <h2 className="border-b pb-1 text-[15pt] font-bold uppercase tracking-wide" style={{ color: accent }}>{c.name}</h2>
                {(c.description || describeAvailability(c.availability)) && (
                  <p className="mt-1 font-sans text-[8.5pt] text-neutral-500">{[c.description, describeAvailability(c.availability)].filter(Boolean).join(" · ")}</p>
                )}
                <ul className="mt-2 space-y-2.5">
                  {c.items.map((i) => {
                    const o = i.options ? normalizeOptions(i.options) : null;
                    return (
                      <li key={i.id} className="break-inside-avoid">
                        <div className="flex items-baseline gap-2">
                          {i.diet && <span className="translate-y-[1px]"><DietDot diet={i.diet} size="sm" /></span>}
                          <span className="text-[11pt] font-semibold">{i.name}</span>
                          <span className="flex-1 border-b border-dotted border-neutral-400" />
                          <span className="text-[11pt] font-semibold tabular-nums">
                            {o?.variants.length ? o.variants.map((v) => `${v.name} ${formatMoney(v.priceMinor, r.currency)}`).join(" / ") : formatMoney(startingPrice(i.priceMinor, o), r.currency)}
                          </span>
                        </div>
                        {(i.description || i.calories !== null || i.allergens.length > 0 || i.soldOut) && (
                          <p className="ml-5 font-sans text-[8.5pt] leading-snug text-neutral-600">
                            {[i.description, i.calories !== null ? `${i.calories} kcal` : null, i.allergens.length ? `Contains: ${i.allergens.join(", ")}` : null].filter(Boolean).join(" · ")}
                          </p>
                        )}
                        {o?.groups.length ? (
                          <p className="ml-5 font-sans text-[8pt] text-neutral-500">
                            {o.groups.map((g) => `${g.name}: ${g.options.map((x) => (x.priceMinor ? `${x.name} +${formatMoney(x.priceMinor, r.currency)}` : x.name)).join(", ")}`).join(" · ")}
                          </p>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        )}
        <footer className="mt-6 border-t pt-3 text-center font-sans text-[8pt] text-neutral-500">
          {[r.address?.split("\n")[0], r.phone, r.instagram ? `@${r.instagram}` : null].filter(Boolean).join(" · ")}
          <br />Prices include applicable taxes unless stated otherwise. Please tell staff about any allergies.
        </footer>
      </article>
    </div>
  );
}
