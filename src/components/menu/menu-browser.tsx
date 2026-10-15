"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronRightIcon, ClockIcon, FlameIcon, LanguagesIcon, SearchIcon, ShoppingBagIcon, SparklesIcon } from "lucide-react";
import { formatMoney } from "@/lib/money";
import { normalizeWhatsAppNumber, sanitizeTable } from "@/lib/whatsapp";
import { hasOptions, resolveSelection, startingPrice } from "@/lib/options";
import { applyPercent, describeAvailability, isAvailableAt, isHappyHourNow } from "@/lib/schedule";
import { isRtl, languageInfo, localize, ui } from "@/lib/languages";
import { DietDot } from "@/components/menu/diet-dot";
import { QtyControl, track } from "@/components/menu/menu-shared";
import { CartSheet, ItemSheet, type CartEntry, type PricedLine } from "@/components/menu/menu-ordering";
import { ServiceBar } from "@/components/menu/menu-guest";
import type { MenuCategoryView, MenuItemView, RestaurantView } from "@/components/menu/types";
import { cn } from "@/lib/utils";

export { WhatsAppIcon } from "@/components/menu/menu-shared";

type Filter = "veg" | "vegan" | "nonveg" | "bestseller";
const FILTERS: { id: Filter; label: string }[] = [
  { id: "veg", label: "Veg" },
  { id: "vegan", label: "Vegan" },
  { id: "nonveg", label: "Non-veg" },
  { id: "bestseller", label: "Bestsellers" },
];

function matchesFilters(item: MenuItemView, filters: Set<Filter>) {
  if (filters.has("bestseller") && !item.bestseller) return false;
  const diets = (["veg", "vegan", "nonveg"] as const).filter((d) => filters.has(d));
  if (!diets.length) return true;
  return diets.some((d) => (d === "veg" ? item.diet === "veg" || item.diet === "vegan" : item.diet === d));
}

/** Re-renders every minute so timed menus and happy hour flip on/off without a reload. */
function useMinuteClock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- client clock starts after hydration
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);
  return now;
}

export function MenuBrowser({
  restaurant,
  categories,
  demo,
}: {
  restaurant: RestaurantView;
  categories: MenuCategoryView[];
  demo: boolean;
}) {
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<Set<Filter>>(new Set());
  const [cart, setCart] = useState<CartEntry[]>([]);
  const [table, setTable] = useState("");
  const [lang, setLang] = useState("");
  const [activeCat, setActiveCat] = useState<string | null>(categories[0]?.id ?? null);
  const [cartOpen, setCartOpen] = useState(false);
  const [sheetItem, setSheetItem] = useState<MenuItemView | null>(null);
  const navRef = useRef<HTMLDivElement>(null);
  const now = useMinuteClock();
  const storageKey = `menupage:cart2:${restaurant.id}`;

  const canOrder = restaurant.ordersEnabled || (restaurant.whatsappOrdering && !!normalizeWhatsAppNumber(restaurant.whatsapp));
  const allItems = useMemo(() => new Map(categories.flatMap((c) => c.items.map((i) => [i.id, i]))), [categories]);
  const itemCategory = useMemo(() => new Map(categories.flatMap((c) => c.items.map((i) => [i.id, c]))), [categories]);
  const happyHour = !!now && isHappyHourNow(restaurant.happyHour, restaurant.timezone, now);
  const hhPercent = happyHour ? (restaurant.happyHour?.percent ?? 0) : 0;
  const rtl = isRtl(lang);

  const available = useCallback(
    (item: MenuItemView) => {
      if (!now) return true;
      const cat = itemCategory.get(item.id);
      return isAvailableAt(cat?.availability, restaurant.timezone, now) && isAvailableAt(item.availability, restaurant.timezone, now);
    },
    [now, itemCategory, restaurant.timezone],
  );

  // Table number from the QR (?t=5), language (?lang=hi), restore cart, count the view.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = sanitizeTable(params.get("t"));
    const l = params.get("lang") ?? localStorage.getItem(`menupage:lang:${restaurant.id}`) ?? "";
    /* eslint-disable react-hooks/set-state-in-effect -- reading browser-only state once on mount */
    if (t) setTable(t);
    if (l && restaurant.languages.includes(l)) setLang(l);
    try {
      const saved = JSON.parse(sessionStorage.getItem(storageKey) ?? "[]") as CartEntry[];
      const valid = Array.isArray(saved)
        ? saved.filter((e) => {
            const item = allItems.get(e?.itemId);
            return item && e.qty > 0 && e.qty < 100 && resolveSelection(item.id, item.priceMinor, item.options, e).ok;
          })
        : [];
      setCart(valid);
    } catch {
      /* ignore */
    }
    /* eslint-enable react-hooks/set-state-in-effect */
    track({ r: restaurant.id, type: "view", ...(t ? { table: t } : {}) });
  }, [restaurant.id, restaurant.languages, storageKey, allItems]);

  useEffect(() => {
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(cart));
    } catch {
      /* ignore */
    }
  }, [cart, storageKey]);

  const chooseLang = (l: string) => {
    setLang(l);
    try {
      localStorage.setItem(`menupage:lang:${restaurant.id}`, l);
    } catch {
      /* ignore */
    }
  };

  const loc = useCallback((row: { name: string; description: string | null; translations?: MenuItemView["translations"] }) => localize(row, lang), [lang]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return categories
      .map((c) => ({
        ...c,
        items: c.items.filter((i) => {
          if (!matchesFilters(i, filters)) return false;
          if (!q) return true;
          const t = localize(i, lang);
          return [i.name, i.description, t.name, t.description].some((s) => s?.toLowerCase().includes(q));
        }),
      }))
      .filter((c) => c.items.length > 0);
  }, [categories, query, filters, lang]);

  const specials = useMemo(() => categories.flatMap((c) => c.items.filter((i) => i.special && !i.soldOut)), [categories]);

  // Highlight the category currently on screen.
  useEffect(() => {
    const els = visible.map((c) => document.getElementById(`cat-${c.id}`)).filter(Boolean) as HTMLElement[];
    if (!els.length) return;
    const obs = new IntersectionObserver(
      (entries) => {
        const top = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (top) setActiveCat(top.target.id.replace("cat-", ""));
      },
      { rootMargin: "-140px 0px -60% 0px" },
    );
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [visible]);

  useEffect(() => {
    const chip = navRef.current?.querySelector<HTMLElement>(`[data-cat="${activeCat}"]`);
    chip?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }, [activeCat]);

  const setQty = useCallback((key: string, qty: number) => {
    setCart((c) => (qty <= 0 ? c.filter((e) => e.key !== key) : c.map((e) => (e.key === key ? { ...e, qty: Math.min(qty, 99) } : e))));
  }, []);

  const addEntry = useCallback((entry: Omit<CartEntry, "key">, key: string) => {
    setCart((c) => {
      const existing = c.find((e) => e.key === key);
      if (existing) return c.map((e) => (e.key === key ? { ...e, qty: Math.min(99, e.qty + entry.qty) } : e));
      return [...c, { ...entry, key }];
    });
  }, []);

  /** Simple items keep the inline +/- stepper. */
  const simpleQty = (item: MenuItemView) => cart.find((e) => e.key === `${item.id}|`)?.qty ?? 0;
  const setSimpleQty = (item: MenuItemView, q: number) => {
    const key = `${item.id}|`;
    if (cart.some((e) => e.key === key)) setQty(key, q);
    else if (q > 0) addEntry({ itemId: item.id, qty: q, variantId: null, modifiers: {} }, key);
  };
  const itemQty = (item: MenuItemView) => cart.filter((e) => e.itemId === item.id).reduce((s, e) => s + e.qty, 0);

  const lines: PricedLine[] = cart
    .map((e): PricedLine | null => {
      const item = allItems.get(e.itemId);
      if (!item) return null;
      const sel = resolveSelection(item.id, item.priceMinor, item.options, e);
      if (!sel.ok) return null;
      const unit = hhPercent && item.happyHour ? applyPercent(sel.unitMinor, hhPercent) : sel.unitMinor;
      return { key: e.key, itemId: item.id, id: item.id, name: item.name, qty: e.qty, priceMinor: unit, options: sel.label || null };
    })
    .filter((l): l is PricedLine => !!l);
  const count = lines.reduce((s, l) => s + l.qty, 0);
  const total = lines.reduce((s, l) => s + l.priceMinor * l.qty, 0);

  const toggleFilter = (f: Filter) =>
    setFilters((prev) => {
      const next = new Set(prev);
      if (next.has(f)) next.delete(f);
      else next.add(f);
      return next;
    });

  const openItem = (item: MenuItemView) => setSheetItem(item);

  return (
    <div dir={rtl ? "rtl" : undefined} lang={lang || undefined}>
      {happyHour && restaurant.happyHour && (
        <div className="mb-3 flex items-center gap-2 rounded-2xl bg-[var(--m-accent)] px-4 py-3 text-sm font-medium text-[var(--m-accent-text)]">
          <SparklesIcon className="size-4 shrink-0" />
          <span>
            {restaurant.happyHour.label || "Happy hour"}: {restaurant.happyHour.percent}% off marked items until {restaurant.happyHour.to}
          </span>
        </div>
      )}

      {/* Sticky search + category nav */}
      <div className="sticky top-0 z-30 -mx-4 border-b border-[var(--m-border)] bg-[color-mix(in_oklab,var(--m-bg)_88%,transparent)] px-4 pb-2 pt-3 backdrop-blur-xl sm:mx-0 sm:rounded-b-2xl">
        <div className="flex items-center gap-2">
          <label className="relative flex-1">
            <span className="sr-only">Search the menu</span>
            <SearchIcon className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-[var(--m-muted)]" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={ui("search", lang, "Search dishes")}
              className="h-10 w-full rounded-xl border border-[var(--m-border)] bg-[var(--m-surface)] pe-3 ps-9 text-[15px] outline-none placeholder:text-[var(--m-muted)] focus:border-[var(--m-accent)]"
            />
          </label>
          {restaurant.languages.length > 0 && (
            <label className="relative">
              <span className="sr-only">Menu language</span>
              <LanguagesIcon className="pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-[var(--m-muted)]" />
              <select
                value={lang}
                onChange={(e) => chooseLang(e.target.value)}
                className="h-10 appearance-none rounded-xl border border-[var(--m-border)] bg-[var(--m-surface)] pe-3 ps-8 text-sm outline-none focus:border-[var(--m-accent)]"
              >
                <option value="">Original</option>
                {restaurant.languages.map((l) => (
                  <option key={l} value={l}>{languageInfo(l).native}</option>
                ))}
              </select>
            </label>
          )}
        </div>
        <div className="no-scrollbar mt-2 flex gap-1.5 overflow-x-auto" role="group" aria-label="Dietary filters">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => toggleFilter(f.id)}
              aria-pressed={filters.has(f.id)}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                filters.has(f.id)
                  ? "border-[var(--m-accent)] bg-[var(--m-accent)] text-[var(--m-accent-text)]"
                  : "border-[var(--m-border)] bg-[var(--m-surface)]",
              )}
            >
              {f.id !== "bestseller" && <DietDot diet={f.id} size="sm" />}
              {f.label}
            </button>
          ))}
        </div>
        {visible.length > 1 && (
          <nav ref={navRef} aria-label="Menu categories" className="no-scrollbar mt-2 flex gap-1 overflow-x-auto">
            {visible.map((c) => (
              <a
                key={c.id}
                href={`#cat-${c.id}`}
                data-cat={c.id}
                onClick={() => setActiveCat(c.id)}
                aria-current={activeCat === c.id ? "true" : undefined}
                className={cn(
                  "shrink-0 rounded-lg px-3 py-1.5 text-sm transition-colors",
                  activeCat === c.id ? "bg-[var(--m-chip)] font-semibold" : "text-[var(--m-muted)] hover:text-[var(--m-text)]",
                )}
              >
                {loc(c).name}
              </a>
            ))}
          </nav>
        )}
      </div>

      {/* Today's specials */}
      {specials.length > 0 && !query && filters.size === 0 && (
        <section aria-labelledby="specials-h" className="mt-6">
          <h2 id="specials-h" className="menu-heading flex items-center gap-2 text-xl font-semibold">
            <SparklesIcon className="size-5 text-[var(--m-accent)]" /> {ui("special", lang, "Today's special")}
          </h2>
          <ul className="no-scrollbar -mx-4 mt-3 flex snap-x gap-3 overflow-x-auto px-4 pb-1">
            {specials.map((item) => {
              const t = loc(item);
              const price = startingPrice(item.priceMinor, item.options);
              return (
                <li key={item.id} className="w-60 shrink-0 snap-start">
                  <button onClick={() => openItem(item)} className="flex h-full w-full flex-col overflow-hidden rounded-2xl border border-[var(--m-border)] bg-[var(--m-surface)] text-start">
                    {item.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- owner-uploaded image
                      <img src={item.imageUrl} alt="" loading="lazy" className="aspect-[16/10] w-full object-cover" />
                    ) : (
                      <div className="aspect-[16/10] w-full bg-[linear-gradient(135deg,var(--m-accent),color-mix(in_oklab,var(--m-accent)_50%,#f59e0b))] opacity-80" />
                    )}
                    <span className="flex flex-1 flex-col p-3">
                      <span className="flex items-center gap-1.5 font-medium">{item.diet && <DietDot diet={item.diet} size="sm" />}{t.name}</span>
                      <span className="mt-auto pt-1 text-sm font-semibold">{hasOptions(item.options) ? "from " : ""}{formatMoney(price, restaurant.currency)}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Menu */}
      <div className="mt-6 space-y-10">
        {visible.length === 0 && (
          <div className="rounded-2xl border border-dashed border-[var(--m-border)] p-10 text-center text-sm text-[var(--m-muted)]">
            No dishes match. <button className="underline" onClick={() => { setQuery(""); setFilters(new Set()); }}>Clear search</button>
          </div>
        )}
        {visible.map((c) => {
          const t = loc(c);
          const timeWindow = describeAvailability(c.availability);
          return (
            <section key={c.id} id={`cat-${c.id}`} className="scroll-mt-44">
              <h2 className="menu-heading text-2xl font-semibold">{t.name}</h2>
              {(t.description || timeWindow) && (
                <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-[var(--m-muted)]">
                  {t.description}
                  {timeWindow && <span className="inline-flex items-center gap-1 rounded-md bg-[var(--m-chip)] px-1.5 py-0.5 text-xs"><ClockIcon className="size-3" /> {timeWindow}</span>}
                </p>
              )}
              <ul className="mt-4 grid gap-3 md:grid-cols-2">
                {c.items.map((item) => (
                  <ItemCard
                    key={item.id}
                    item={item}
                    lang={lang}
                    currency={restaurant.currency}
                    qty={hasOptions(item.options) ? itemQty(item) : simpleQty(item)}
                    canOrder={canOrder}
                    available={available(item)}
                    discountPercent={item.happyHour ? hhPercent : 0}
                    onQty={(q) => setSimpleQty(item, q)}
                    onOpen={() => openItem(item)}
                  />
                ))}
              </ul>
            </section>
          );
        })}
      </div>

      {/* Cart bar */}
      {canOrder && count > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button
            onClick={() => setCartOpen(true)}
            className="mx-auto flex h-14 w-full max-w-xl items-center justify-between rounded-2xl bg-[#1fa855] px-5 font-semibold text-white shadow-2xl shadow-black/25 transition-transform active:scale-[0.99]"
          >
            <span className="flex items-center gap-2">
              <ShoppingBagIcon className="size-5" /> {count} item{count === 1 ? "" : "s"} · {formatMoney(total, restaurant.currency)}
            </span>
            <span className="flex items-center">{ui("viewOrder", lang, "View order")} <ChevronRightIcon className="size-4 rtl:rotate-180" /></span>
          </button>
        </div>
      )}
      {table && restaurant.serviceRequestsEnabled && !demo && <ServiceBar restaurantId={restaurant.id} table={table} raised={canOrder && count > 0} />}
      {sheetItem && (
        <ItemSheet
          item={sheetItem}
          name={loc(sheetItem).name}
          description={loc(sheetItem).description}
          currency={restaurant.currency}
          discountPercent={sheetItem.happyHour ? hhPercent : 0}
          canOrder={canOrder && available(sheetItem)}
          onAdd={addEntry}
          onClose={() => setSheetItem(null)}
        />
      )}
      {cartOpen && (
        <CartSheet
          restaurant={restaurant}
          lines={lines}
          entries={cart}
          table={table}
          setTable={setTable}
          setQty={setQty}
          onClose={() => setCartOpen(false)}
          demo={demo}
          onSent={() => setCart([])}
        />
      )}
      {canOrder && count > 0 && <div className="h-20" aria-hidden />}
    </div>
  );
}

function ItemCard({
  item,
  lang,
  currency,
  qty,
  canOrder,
  available,
  discountPercent,
  onQty,
  onOpen,
}: {
  item: MenuItemView;
  lang: string;
  currency: string;
  qty: number;
  canOrder: boolean;
  available: boolean;
  discountPercent: number;
  onQty: (q: number) => void;
  onOpen: () => void;
}) {
  const t = localize(item, lang);
  const withOptions = hasOptions(item.options);
  const base = withOptions ? startingPrice(item.priceMinor, item.options) : item.priceMinor;
  const price = discountPercent ? applyPercent(base, discountPercent) : base;
  const orderable = canOrder && !item.soldOut && available;
  const when = describeAvailability(item.availability);
  const control = withOptions ? (
    <button onClick={onOpen} className={cn("flex h-8 items-center rounded-lg border border-[var(--m-border)] bg-[var(--m-surface)] px-3 text-sm font-semibold text-[var(--m-accent)]", item.imageUrl && "shadow-md")} aria-label={`Choose options for ${t.name}`}>
      {qty > 0 ? `${qty} · ` : ""}{ui("add", lang, "Add")} +
    </button>
  ) : (
    <QtyControl qty={qty} onQty={onQty} name={t.name} floating={!!item.imageUrl} addLabel={ui("add", lang, "Add")} />
  );
  return (
    <li className={cn("flex gap-3 rounded-2xl border border-[var(--m-border)] bg-[var(--m-surface)] p-3.5", (item.soldOut || !available) && "opacity-60")}>
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          {item.diet && (
            <span className="mt-1">
              <DietDot diet={item.diet} />
            </span>
          )}
          <h3 className="font-medium leading-snug">
            <button onClick={onOpen} className="text-start hover:underline focus-visible:underline">{t.name}</button>
          </h3>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          {item.special && <span className="rounded-md bg-[var(--m-accent)] px-1.5 py-0.5 text-[11px] font-semibold text-[var(--m-accent-text)]">{ui("special", lang, "Today's special")}</span>}
          {item.bestseller && (
            <span className="rounded-md bg-amber-400/20 px-1.5 py-0.5 text-[11px] font-semibold" style={{ color: "color-mix(in oklab, #b45309 85%, var(--m-text))" }}>
              ★ Bestseller
            </span>
          )}
          {item.spicy > 0 && (
            <span className="flex items-center text-red-500" role="img" aria-label={`Spice level ${item.spicy} of 3`} title={["", "Mild", "Medium", "Hot"][item.spicy]}>
              {Array.from({ length: item.spicy }).map((_, i) => (
                <FlameIcon key={i} className="size-3.5 fill-current" />
              ))}
            </span>
          )}
          {item.soldOut && <span className="rounded-md bg-[var(--m-chip)] px-1.5 py-0.5 text-[11px] font-semibold">{ui("soldOut", lang, "Sold out")}</span>}
          {!available && when && <span className="inline-flex items-center gap-1 rounded-md bg-[var(--m-chip)] px-1.5 py-0.5 text-[11px] font-semibold"><ClockIcon className="size-3" /> {when}</span>}
          {discountPercent > 0 && <span className="rounded-md bg-emerald-600 px-1.5 py-0.5 text-[11px] font-semibold text-white">−{discountPercent}%</span>}
        </div>
        {t.description && <p className="mt-1.5 line-clamp-3 text-sm leading-relaxed text-[var(--m-muted)]">{t.description}</p>}
        {(item.allergens.length > 0 || item.calories !== null) && (
          <p className="mt-1.5 text-[11px] text-[var(--m-muted)]">
            {item.calories !== null && <span>{item.calories} kcal</span>}
            {item.calories !== null && item.allergens.length > 0 && " · "}
            {item.allergens.length > 0 && <span>Contains: {item.allergens.join(", ")}</span>}
          </p>
        )}
        <div className="mt-2.5 flex items-center justify-between gap-2">
          <span className="font-semibold">
            {withOptions && <span className="text-xs font-normal text-[var(--m-muted)]">from </span>}
            {formatMoney(price, currency)}
            {discountPercent > 0 && <s className="ms-1.5 text-xs font-normal text-[var(--m-muted)]">{formatMoney(base, currency)}</s>}
          </span>
          {orderable && !item.imageUrl && control}
        </div>
      </div>
      {item.imageUrl && (
        <div className="relative w-28 shrink-0 sm:w-32">
          <button onClick={onOpen} className="block w-full" aria-label={`More about ${t.name}`} tabIndex={-1}>
            {/* eslint-disable-next-line @next/next/no-img-element -- images come from the owner's storage bucket */}
            <img src={item.imageUrl} alt={t.name} loading="lazy" decoding="async" width={256} height={256} className="aspect-square w-full rounded-xl object-cover" />
          </button>
          {orderable && <div className="absolute -bottom-2 left-1/2 -translate-x-1/2">{control}</div>}
        </div>
      )}
    </li>
  );
}
