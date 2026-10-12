"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FlameIcon, MinusIcon, PlusIcon, SearchIcon, ShoppingBagIcon, XIcon } from "lucide-react";
import { formatMoney } from "@/lib/money";
import { buildOrderMessage, cartTotalMinor, normalizeWhatsAppNumber, sanitizeTable, whatsappLink, type CartLine } from "@/lib/whatsapp";
import { DietDot } from "@/components/menu/diet-dot";
import type { MenuCategoryView, MenuItemView, RestaurantView } from "@/components/menu/types";
import { cn } from "@/lib/utils";

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

function track(body: Record<string, unknown>) {
  try {
    const data = JSON.stringify(body);
    if (navigator.sendBeacon) navigator.sendBeacon("/api/track", new Blob([data], { type: "text/plain" }));
    else void fetch("/api/track", { method: "POST", body: data, keepalive: true });
  } catch {
    /* analytics must never break the page */
  }
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
  const [cart, setCart] = useState<Record<string, number>>({});
  const [table, setTable] = useState("");
  const [activeCat, setActiveCat] = useState<string | null>(categories[0]?.id ?? null);
  const [cartOpen, setCartOpen] = useState(false);
  const navRef = useRef<HTMLDivElement>(null);
  const storageKey = `menupage:cart:${restaurant.id}`;

  const canOrder = restaurant.whatsappOrdering && !!normalizeWhatsAppNumber(restaurant.whatsapp);
  const allItems = useMemo(() => new Map(categories.flatMap((c) => c.items.map((i) => [i.id, i]))), [categories]);

  // Table number from the QR (?t=5), restore cart, count the view.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = sanitizeTable(params.get("t"));
    /* eslint-disable react-hooks/set-state-in-effect -- reading browser-only state once on mount */
    if (t) setTable(t);
    try {
      const saved = JSON.parse(sessionStorage.getItem(storageKey) ?? "{}") as Record<string, number>;
      const valid = Object.fromEntries(Object.entries(saved).filter(([id, q]) => allItems.has(id) && q > 0 && q < 100));
      setCart(valid);
    } catch {
      /* ignore */
    }
    /* eslint-enable react-hooks/set-state-in-effect */
    track({ r: restaurant.id, type: "view", ...(t ? { table: t } : {}) });
  }, [restaurant.id, storageKey, allItems]);

  useEffect(() => {
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(cart));
    } catch {
      /* ignore */
    }
  }, [cart, storageKey]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return categories
      .map((c) => ({
        ...c,
        items: c.items.filter(
          (i) =>
            matchesFilters(i, filters) &&
            (!q || i.name.toLowerCase().includes(q) || i.description?.toLowerCase().includes(q)),
        ),
      }))
      .filter((c) => c.items.length > 0);
  }, [categories, query, filters]);

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

  const setQty = useCallback((id: string, qty: number) => {
    setCart((c) => {
      const next = { ...c };
      if (qty <= 0) delete next[id];
      else next[id] = Math.min(qty, 99);
      return next;
    });
  }, []);

  const lines: CartLine[] = Object.entries(cart)
    .map(([id, qty]) => {
      const item = allItems.get(id);
      return item ? { id, name: item.name, qty, priceMinor: item.priceMinor } : null;
    })
    .filter((l): l is CartLine => !!l);
  const count = lines.reduce((s, l) => s + l.qty, 0);
  const total = cartTotalMinor(lines);

  const toggleFilter = (f: Filter) =>
    setFilters((prev) => {
      const next = new Set(prev);
      if (next.has(f)) next.delete(f);
      else next.add(f);
      return next;
    });

  return (
    <>
      {/* Sticky search + category nav */}
      <div className="sticky top-0 z-30 -mx-4 border-b border-[var(--m-border)] bg-[color-mix(in_oklab,var(--m-bg)_88%,transparent)] px-4 pb-2 pt-3 backdrop-blur-xl sm:mx-0 sm:rounded-b-2xl">
        <div className="flex items-center gap-2">
          <label className="relative flex-1">
            <span className="sr-only">Search the menu</span>
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--m-muted)]" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search dishes"
              className="h-10 w-full rounded-xl border border-[var(--m-border)] bg-[var(--m-surface)] pl-9 pr-3 text-[15px] outline-none placeholder:text-[var(--m-muted)] focus:border-[var(--m-accent)]"
            />
          </label>
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
                className={cn(
                  "shrink-0 rounded-lg px-3 py-1.5 text-sm transition-colors",
                  activeCat === c.id ? "bg-[var(--m-chip)] font-semibold" : "text-[var(--m-muted)] hover:text-[var(--m-text)]",
                )}
              >
                {c.name}
              </a>
            ))}
          </nav>
        )}
      </div>

      {/* Menu */}
      <div className="mt-6 space-y-10">
        {visible.length === 0 && (
          <div className="rounded-2xl border border-dashed border-[var(--m-border)] p-10 text-center text-sm text-[var(--m-muted)]">
            No dishes match. <button className="underline" onClick={() => { setQuery(""); setFilters(new Set()); }}>Clear search</button>
          </div>
        )}
        {visible.map((c) => (
          <section key={c.id} id={`cat-${c.id}`} className="scroll-mt-44">
            <h2 className="menu-heading text-2xl font-semibold">{c.name}</h2>
            {c.description && <p className="mt-1 text-sm text-[var(--m-muted)]">{c.description}</p>}
            <ul className="mt-4 grid gap-3 md:grid-cols-2">
              {c.items.map((item) => (
                <ItemCard
                  key={item.id}
                  item={item}
                  currency={restaurant.currency}
                  qty={cart[item.id] ?? 0}
                  canOrder={canOrder}
                  onQty={(q) => setQty(item.id, q)}
                />
              ))}
            </ul>
          </section>
        ))}
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
            <span>View order →</span>
          </button>
        </div>
      )}
      {cartOpen && (
        <CartSheet
          restaurant={restaurant}
          lines={lines}
          table={table}
          setTable={setTable}
          setQty={setQty}
          onClose={() => setCartOpen(false)}
          demo={demo}
          onSent={() => setCart({})}
        />
      )}
      {canOrder && count > 0 && <div className="h-20" aria-hidden />}
    </>
  );
}

function ItemCard({
  item,
  currency,
  qty,
  canOrder,
  onQty,
}: {
  item: MenuItemView;
  currency: string;
  qty: number;
  canOrder: boolean;
  onQty: (q: number) => void;
}) {
  return (
    <li
      className={cn(
        "flex gap-3 rounded-2xl border border-[var(--m-border)] bg-[var(--m-surface)] p-3.5",
        item.soldOut && "opacity-60",
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          {item.diet && (
            <span className="mt-1">
              <DietDot diet={item.diet} />
            </span>
          )}
          <h3 className="font-medium leading-snug">{item.name}</h3>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          {item.bestseller && (
            <span className="rounded-md bg-amber-400/20 px-1.5 py-0.5 text-[11px] font-semibold text-amber-700" style={{ color: "color-mix(in oklab, #b45309 85%, var(--m-text))" }}>
              ★ Bestseller
            </span>
          )}
          {item.spicy > 0 && (
            <span className="flex items-center text-red-500" aria-label={`Spice level ${item.spicy} of 3`} title={["", "Mild", "Medium", "Hot"][item.spicy]}>
              {Array.from({ length: item.spicy }).map((_, i) => (
                <FlameIcon key={i} className="size-3.5 fill-current" />
              ))}
            </span>
          )}
          {item.soldOut && <span className="rounded-md bg-[var(--m-chip)] px-1.5 py-0.5 text-[11px] font-semibold">Sold out</span>}
        </div>
        {item.description && <p className="mt-1.5 line-clamp-3 text-sm leading-relaxed text-[var(--m-muted)]">{item.description}</p>}
        {item.allergens.length > 0 && (
          <p className="mt-1.5 text-[11px] text-[var(--m-muted)]">Contains: {item.allergens.join(", ")}</p>
        )}
        <div className="mt-2.5 flex items-center justify-between gap-2">
          <span className="font-semibold">{formatMoney(item.priceMinor, currency)}</span>
          {canOrder && !item.soldOut && !item.imageUrl && <QtyControl qty={qty} onQty={onQty} name={item.name} />}
        </div>
      </div>
      {item.imageUrl && (
        <div className="relative w-28 shrink-0 sm:w-32">
          {/* eslint-disable-next-line @next/next/no-img-element -- images come from the owner's storage bucket */}
          <img
            src={item.imageUrl}
            alt={item.name}
            loading="lazy"
            decoding="async"
            width={256}
            height={256}
            className="aspect-square w-full rounded-xl object-cover"
          />
          {canOrder && !item.soldOut && (
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2">
              <QtyControl qty={qty} onQty={onQty} name={item.name} floating />
            </div>
          )}
        </div>
      )}
    </li>
  );
}

function QtyControl({ qty, onQty, name, floating }: { qty: number; onQty: (q: number) => void; name: string; floating?: boolean }) {
  const base = cn(
    "flex h-8 items-center rounded-lg border border-[var(--m-border)] bg-[var(--m-surface)] text-sm font-semibold text-[var(--m-accent)]",
    floating && "shadow-md",
  );
  if (qty === 0) {
    return (
      <button onClick={() => onQty(1)} className={cn(base, "px-4")} aria-label={`Add ${name}`}>
        Add
      </button>
    );
  }
  return (
    <div className={base}>
      <button className="grid h-full w-8 place-items-center" onClick={() => onQty(qty - 1)} aria-label={`Remove one ${name}`}>
        <MinusIcon className="size-3.5" />
      </button>
      <span className="min-w-5 text-center tabular-nums" aria-live="polite">{qty}</span>
      <button className="grid h-full w-8 place-items-center" onClick={() => onQty(qty + 1)} aria-label={`Add one more ${name}`}>
        <PlusIcon className="size-3.5" />
      </button>
    </div>
  );
}

function CartSheet({
  restaurant,
  lines,
  table,
  setTable,
  setQty,
  onClose,
  demo,
  onSent,
}: {
  restaurant: RestaurantView;
  lines: CartLine[];
  table: string;
  setTable: (t: string) => void;
  setQty: (id: string, q: number) => void;
  onClose: () => void;
  demo: boolean;
  onSent: () => void;
}) {
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  useEffect(() => {
    if (lines.length === 0) onClose();
  }, [lines.length, onClose]);

  const message = buildOrderMessage({
    restaurantName: restaurant.name,
    lines,
    currency: restaurant.currency,
    table,
    note,
    customerName: name,
  });

  const send = () => {
    track({
      r: restaurant.id,
      type: "whatsapp",
      ...(sanitizeTable(table) ? { table: sanitizeTable(table) } : {}),
      items: lines.map((l) => ({ id: l.id, qty: l.qty })),
    });
    if (demo) {
      setPreview(message);
      return;
    }
    const link = whatsappLink(restaurant.whatsapp ?? "", message);
    if (link) window.open(link, "_blank", "noopener,noreferrer");
    onSent();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label="Your order">
      <button className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={onClose} aria-label="Close" />
      <div className="relative max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-[var(--m-border)] bg-[var(--m-bg)] p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-3xl">
        <div className="flex items-center justify-between">
          <h2 className="menu-heading text-xl font-semibold">{preview ? "Demo: message preview" : "Your order"}</h2>
          <button onClick={onClose} className="grid size-9 place-items-center rounded-full bg-[var(--m-chip)]" aria-label="Close">
            <XIcon className="size-4" />
          </button>
        </div>

        {preview ? (
          <div className="mt-4">
            <p className="text-sm text-[var(--m-muted)]">
              This is a demo restaurant, so nothing is sent. On a real menu, WhatsApp opens with this message ready to send to the restaurant:
            </p>
            <pre className="mt-3 whitespace-pre-wrap rounded-2xl bg-[#e7fbe0] p-4 font-sans text-sm leading-relaxed text-neutral-800">{preview}</pre>
            <button onClick={() => { onSent(); onClose(); }} className="mt-4 h-11 w-full rounded-xl bg-[var(--m-accent)] font-semibold text-[var(--m-accent-text)]">
              Done
            </button>
          </div>
        ) : (
          <>
            <ul className="mt-4 divide-y divide-[var(--m-border)]">
              {lines.map((l) => (
                <li key={l.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{l.name}</p>
                    <p className="text-sm text-[var(--m-muted)]">{formatMoney(l.priceMinor * l.qty, restaurant.currency)}</p>
                  </div>
                  <QtyControl qty={l.qty} onQty={(q) => setQty(l.id, q)} name={l.name} />
                </li>
              ))}
            </ul>
            <div className="mt-2 flex items-center justify-between border-t border-[var(--m-border)] pt-3 font-semibold">
              <span>Total</span>
              <span>{formatMoney(cartTotalMinor(lines), restaurant.currency)}</span>
            </div>
            <div className="mt-4 grid grid-cols-[110px_1fr] gap-2">
              <Field label="Table">
                <input value={table} onChange={(e) => setTable(e.target.value.slice(0, 12))} placeholder="e.g. 5" className={inputCls} inputMode="text" />
              </Field>
              <Field label="Your name (optional)">
                <input value={name} onChange={(e) => setName(e.target.value.slice(0, 60))} placeholder="Name" className={inputCls} autoComplete="given-name" />
              </Field>
            </div>
            <Field label="Note for the kitchen (optional)" className="mt-2">
              <textarea value={note} onChange={(e) => setNote(e.target.value.slice(0, 300))} rows={2} placeholder="Less spicy, no onion…" className={cn(inputCls, "h-auto py-2")} />
            </Field>
            <button
              onClick={send}
              className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#1fa855] text-[15px] font-semibold text-white"
            >
              <WhatsAppIcon /> Order on WhatsApp
            </button>
            <p className="mt-2 text-center text-xs text-[var(--m-muted)]">Opens WhatsApp with your order. Payment is handled by the restaurant.</p>
          </>
        )}
      </div>
    </div>
  );
}

const inputCls =
  "h-10 w-full rounded-xl border border-[var(--m-border)] bg-[var(--m-surface)] px-3 text-[15px] outline-none placeholder:text-[var(--m-muted)] focus:border-[var(--m-accent)]";

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1 block text-xs font-medium text-[var(--m-muted)]">{label}</span>
      {children}
    </label>
  );
}

export function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn("size-5 fill-current", className)} aria-hidden>
      <path d="M17.5 14.4c-.3-.1-1.8-.9-2-1s-.5-.1-.7.1-.8 1-1 1.2-.4.2-.6.1a8.2 8.2 0 0 1-4-3.5c-.3-.5.3-.5.9-1.6.1-.2 0-.4 0-.5l-.9-2.2c-.2-.6-.5-.5-.7-.5h-.6a1.2 1.2 0 0 0-.8.4 3.5 3.5 0 0 0-1.1 2.6 6 6 0 0 0 1.3 3.2 13.8 13.8 0 0 0 5.3 4.7c2 .8 2.7.9 3.7.7a3.1 3.1 0 0 0 2-1.4 2.5 2.5 0 0 0 .2-1.4c-.1-.2-.3-.3-.6-.4zM12 21.8a9.8 9.8 0 0 1-5-1.4l-.4-.2-3.7 1 1-3.6-.2-.4A9.8 9.8 0 1 1 12 21.8zm8.4-18.2A11.8 11.8 0 0 0 1.8 17.9L.1 24l6.3-1.6A11.8 11.8 0 0 0 24 12a11.7 11.7 0 0 0-3.6-8.4z" />
    </svg>
  );
}
