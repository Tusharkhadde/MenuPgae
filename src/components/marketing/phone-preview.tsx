import { DietDot } from "@/components/menu/diet-dot";

const rows = [
  { name: "Masala Chai", desc: "Ginger, cardamom, slow-simmered", price: "₹40", diet: "veg" as const, tag: "Bestseller" },
  { name: "Vada Pav", desc: "Garlic chutney, soft pav", price: "₹35", diet: "vegan" as const, spicy: 2 },
  { name: "Chicken Frankie", desc: "Tandoori chicken, mint mayo", price: "₹170", diet: "nonveg" as const },
  { name: "Paneer Tikka Sandwich", desc: "Charred paneer on sourdough", price: "₹180", diet: "veg" as const },
];

/** Illustrative phone mockup of a menu page. Invented content, not a real restaurant or customer — always captioned as such. */
export function PhonePreview() {
  return (
    <div className="relative mx-auto w-[300px] select-none" aria-label="Illustrative example of a MenuPage menu on a phone (not a real restaurant)">
      <div className="absolute -inset-10 -z-10 rounded-[64px] bg-[radial-gradient(closest-side,color-mix(in_oklch,var(--primary)_28%,transparent),transparent)] blur-2xl" />
      <div className="rounded-[44px] border border-black/10 bg-neutral-900 p-2.5 shadow-2xl shadow-black/30 dark:border-white/10">
        <div className="menu-theme overflow-hidden rounded-[36px]" data-theme="classic">
          <div className="relative h-28 bg-[linear-gradient(135deg,#9a3412,#ea580c_55%,#f59e0b)]">
            <div className="absolute left-1/2 top-2 h-5 w-24 -translate-x-1/2 rounded-full bg-neutral-900" />
            <div className="absolute -bottom-6 left-4 grid size-14 place-items-center rounded-2xl border-4 border-[var(--m-bg)] bg-[var(--m-surface)] text-xl">☕</div>
          </div>
          <div className="px-4 pb-4 pt-8">
            <p className="menu-heading text-xl font-semibold">Chai &amp; Crumbs</p>
            <p className="text-[11px] text-[var(--m-muted)]">Café · Street food</p>
            <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-600/10 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
              <span className="size-1.5 rounded-full bg-emerald-600" /> Open now · until 11:00 PM
            </span>
            <div className="mt-3 flex gap-1.5 text-[10px]">
              {["Chai & Coffee", "Street Classics", "Bowls"].map((c, i) => (
                <span key={c} className={i === 0 ? "rounded-full bg-[var(--m-accent)] px-2.5 py-1 text-white" : "rounded-full bg-[var(--m-chip)] px-2.5 py-1"}>
                  {c}
                </span>
              ))}
            </div>
            <div className="mt-3 space-y-2">
              {rows.map((r) => (
                <div key={r.name} className="flex items-start justify-between gap-2 rounded-xl border border-[var(--m-border)] bg-[var(--m-surface)] p-2.5">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <DietDot diet={r.diet} size="sm" />
                      <p className="truncate text-[12px] font-medium">{r.name}</p>
                    </div>
                    <p className="mt-0.5 truncate text-[10px] text-[var(--m-muted)]">{r.desc}</p>
                    <p className="mt-1 text-[11px] font-semibold">{r.price}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {r.tag && <span className="rounded bg-amber-100 px-1 text-[9px] font-medium text-amber-800">{r.tag}</span>}
                    <span className="rounded-lg border border-[var(--m-border)] px-2 py-0.5 text-[10px] font-medium text-[var(--m-accent)]">Add</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between rounded-2xl bg-[#25D366] px-3 py-2.5 text-[11px] font-semibold text-white">
              <span>2 items · ₹75</span>
              <span>Order on WhatsApp →</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
