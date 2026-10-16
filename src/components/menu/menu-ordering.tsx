"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2Icon, TagIcon } from "lucide-react";
import { formatMoney } from "@/lib/money";
import { resolveSelection, type ItemOptions } from "@/lib/options";
import { buildOrderMessage, newOrderRef, normalizeWhatsAppNumber, sanitizeTable, whatsappLink, type CartLine } from "@/lib/whatsapp";
import { DietDot } from "@/components/menu/diet-dot";
import { Field, QtyControl, Sheet, WhatsAppIcon, inputCls, postJson, track } from "@/components/menu/menu-shared";
import { FeedbackForm, UpiPay } from "@/components/menu/menu-guest";
import type { MenuItemView, RestaurantView } from "@/components/menu/types";
import { cn } from "@/lib/utils";

export type CartEntry = { key: string; itemId: string; qty: number; variantId: string | null; modifiers: Record<string, string[]> };
export type PricedLine = CartLine & { key: string; itemId: string };

/* ---------------------------------------------------------------- Item sheet */

export function ItemSheet({
  item,
  name,
  description,
  currency,
  discountPercent,
  canOrder,
  onAdd,
  onClose,
}: {
  item: MenuItemView;
  name: string;
  description: string | null;
  currency: string;
  /** Happy-hour discount currently applying to this item (0 = none). */
  discountPercent: number;
  canOrder: boolean;
  onAdd: (entry: Omit<CartEntry, "key">, key: string) => void;
  onClose: () => void;
}) {
  const o: ItemOptions = item.options ?? { variants: [], groups: [] };
  const [variantId, setVariantId] = useState<string | null>(o.variants[0]?.id ?? null);
  const [mods, setMods] = useState<Record<string, string[]>>({});
  const [qty, setQty] = useState(1);
  const [touched, setTouched] = useState(false);
  const sel = resolveSelection(item.id, item.priceMinor, o, { variantId, modifiers: mods });
  const unit = sel.ok ? (discountPercent ? Math.round((sel.unitMinor * (100 - discountPercent)) / 100) : sel.unitMinor) : null;

  const toggle = (gid: string, oid: string, max: number) =>
    setMods((m) => {
      const cur = m[gid] ?? [];
      if (cur.includes(oid)) return { ...m, [gid]: cur.filter((x) => x !== oid) };
      if (max === 1) return { ...m, [gid]: [oid] };
      if (cur.length >= max) return m;
      return { ...m, [gid]: [...cur, oid] };
    });

  return (
    <Sheet title={name} onClose={onClose}>
      {item.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- owner-uploaded image
        <img src={item.imageUrl} alt="" className="mt-3 aspect-[16/10] w-full rounded-2xl object-cover" />
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
        {item.diet && <DietDot diet={item.diet} />}
        {item.calories !== null && <span className="text-[var(--m-muted)]">{item.calories} kcal</span>}
        {item.nutrition && <span className="text-[var(--m-muted)]">· {item.nutrition}</span>}
      </div>
      {description && <p className="mt-2 text-sm leading-relaxed text-[var(--m-muted)]">{description}</p>}
      {item.allergens.length > 0 && <p className="mt-2 text-xs text-[var(--m-muted)]">Contains: {item.allergens.join(", ")}</p>}

      {o.variants.length > 0 && (
        <fieldset className="mt-5">
          <legend className="text-sm font-semibold">Size <span className="font-normal text-[var(--m-muted)]">· required</span></legend>
          <div className="mt-2 space-y-1.5">
            {o.variants.map((v) => (
              <label key={v.id} className={cn("flex cursor-pointer items-center justify-between rounded-xl border px-3 py-2.5", variantId === v.id ? "border-[var(--m-accent)]" : "border-[var(--m-border)]")}>
                <span className="flex items-center gap-2">
                  <input type="radio" name="variant" checked={variantId === v.id} onChange={() => setVariantId(v.id)} className="accent-[var(--m-accent)]" />
                  {v.name}
                </span>
                <span className="text-sm font-medium">{formatMoney(v.priceMinor, currency)}</span>
              </label>
            ))}
          </div>
        </fieldset>
      )}
      {o.groups.map((g) => {
        const picked = mods[g.id] ?? [];
        const rule = g.min > 0 ? (g.min === g.max ? `choose ${g.min}` : `choose ${g.min}–${g.max}`) : g.max === 1 ? "optional" : `optional · up to ${g.max}`;
        const missing = touched && picked.length < g.min;
        return (
          <fieldset key={g.id} className="mt-5">
            <legend className="text-sm font-semibold">
              {g.name} <span className={cn("font-normal", missing ? "text-red-600" : "text-[var(--m-muted)]")}>· {rule}</span>
            </legend>
            <div className="mt-2 space-y-1.5">
              {g.options.map((x) => {
                const on = picked.includes(x.id);
                const disabled = !on && g.max > 1 && picked.length >= g.max;
                return (
                  <label key={x.id} className={cn("flex cursor-pointer items-center justify-between rounded-xl border px-3 py-2.5", on ? "border-[var(--m-accent)]" : "border-[var(--m-border)]", disabled && "opacity-50")}>
                    <span className="flex items-center gap-2">
                      <input
                        type={g.max === 1 ? "radio" : "checkbox"}
                        name={`g-${g.id}`}
                        checked={on}
                        disabled={disabled}
                        onChange={() => toggle(g.id, x.id, g.max)}
                        onClick={(e) => {
                          // Let guests un-pick an optional single-choice add-on.
                          if (g.max === 1 && on && g.min === 0) {
                            e.preventDefault();
                            setMods((m) => ({ ...m, [g.id]: [] }));
                          }
                        }}
                        className="accent-[var(--m-accent)]"
                      />
                      {x.name}
                    </span>
                    {x.priceMinor > 0 && <span className="text-sm text-[var(--m-muted)]">+{formatMoney(x.priceMinor, currency)}</span>}
                  </label>
                );
              })}
            </div>
          </fieldset>
        );
      })}

      {canOrder && !item.soldOut && (
        <div className="sticky bottom-0 -mx-5 mt-5 flex items-center gap-3 border-t border-[var(--m-border)] bg-[var(--m-bg)] px-5 pt-4">
          <QtyControl qty={qty} onQty={(q) => setQty(Math.max(1, Math.min(99, q)))} name={name} />
          <button
            onClick={() => {
              setTouched(true);
              if (!sel.ok) return;
              onAdd({ itemId: item.id, qty, variantId, modifiers: mods }, sel.key);
              onClose();
            }}
            className="flex h-12 flex-1 items-center justify-between rounded-xl bg-[var(--m-accent)] px-4 font-semibold text-[var(--m-accent-text)]"
          >
            <span>Add to order</span>
            <span>{unit !== null ? formatMoney(unit * qty, currency) : "—"}</span>
          </button>
        </div>
      )}
      {touched && !sel.ok && <p className="mt-2 text-center text-sm text-red-600" role="alert">{sel.error}</p>}
    </Sheet>
  );
}

/* ---------------------------------------------------------------- Cart sheet */

type Quote = { subtotalMinor: number; discountMinor: number; totalMinor: number; couponCode: string | null };
type PlacedOrder = { id: string; number: number; ref: string | null; totalMinor: number };

export function CartSheet({
  restaurant,
  lines,
  entries,
  table,
  setTable,
  setQty,
  onClose,
  demo,
  onSent,
}: {
  restaurant: RestaurantView;
  lines: PricedLine[];
  entries: CartEntry[];
  table: string;
  setTable: (t: string) => void;
  setQty: (key: string, q: number) => void;
  onClose: () => void;
  demo: boolean;
  onSent: () => void;
}) {
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [coupon, setCoupon] = useState("");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [placed, setPlaced] = useState<(PlacedOrder & { viaWhatsApp: boolean }) | null>(null);

  const viaWhatsApp = restaurant.whatsappOrdering && !!normalizeWhatsAppNumber(restaurant.whatsapp);
  const subtotal = lines.reduce((s, l) => s + l.priceMinor * l.qty, 0);
  const cartSig = useMemo(() => JSON.stringify(entries.map((e) => [e.key, e.qty])), [entries]);

  // A cart change invalidates an applied coupon quote.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- resetting derived state when the cart changes
    setQuote(null);
  }, [cartSig]);

  useEffect(() => {
    if (lines.length === 0 && !placed && !preview) onClose();
  }, [lines.length, onClose, placed, preview]);

  const payload = () => ({
    r: restaurant.id,
    lines: entries.map((e) => ({ itemId: e.itemId, qty: e.qty, variantId: e.variantId, modifiers: e.modifiers })),
    table: sanitizeTable(table),
    name: name || null,
    note: note || null,
    coupon: quote?.couponCode ?? null,
  });

  const applyCoupon = async () => {
    setCouponError(null);
    const res = await postJson<{ quote: Quote }>("/api/orders/quote", { ...payload(), coupon: coupon.trim() });
    if (res.ok) setQuote(res.data.quote);
    else {
      setQuote(null);
      setCouponError(res.error);
    }
  };

  const discount = quote?.discountMinor ?? 0;
  const total = subtotal - discount;

  const send = async () => {
    setError(null);
    const ref = newOrderRef();
    const message = buildOrderMessage({
      restaurantName: restaurant.name,
      lines,
      currency: restaurant.currency,
      table,
      note,
      customerName: name,
      discountMinor: discount,
      couponCode: quote?.couponCode,
      ref: restaurant.ordersEnabled ? ref : null,
    });
    if (viaWhatsApp) {
      track({
        r: restaurant.id,
        type: "whatsapp",
        ...(sanitizeTable(table) ? { table: sanitizeTable(table) } : {}),
        items: Object.values(
          lines.reduce<Record<string, { id: string; qty: number }>>((acc, l) => {
            acc[l.itemId] = { id: l.itemId, qty: Math.min(99, (acc[l.itemId]?.qty ?? 0) + l.qty) };
            return acc;
          }, {}),
        ),
      });
    }
    if (demo) {
      setPreview(message);
      return;
    }
    // Open WhatsApp synchronously (inside the tap) so popup blockers don't eat it; save the order in parallel.
    if (viaWhatsApp) {
      const link = whatsappLink(restaurant.whatsapp ?? "", message);
      if (link) window.open(link, "_blank", "noopener,noreferrer");
    }
    if (!restaurant.ordersEnabled) {
      onSent();
      onClose();
      return;
    }
    setBusy(true);
    const res = await postJson<{ order: PlacedOrder }>("/api/orders", { ...payload(), ref });
    setBusy(false);
    if (res.ok) {
      setPlaced({ ...res.data.order, viaWhatsApp });
      onSent();
    } else if (viaWhatsApp) {
      // WhatsApp already has the order; the inbox copy failed — don't block the guest.
      setPlaced({ id: "", number: 0, ref, totalMinor: total, viaWhatsApp });
      onSent();
    } else {
      setError(res.error);
    }
  };

  if (placed) {
    return (
      <Sheet title={placed.number ? `Order #${placed.number} received` : "Order sent"} onClose={onClose}>
        <div className="mt-3 space-y-3">
          <p className="flex items-start gap-2 rounded-2xl bg-[var(--m-chip)] p-4 text-sm">
            <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-emerald-600" />
            <span>
              {placed.viaWhatsApp ? "Send the WhatsApp message if you haven't yet. " : "The kitchen has your order. "}
              {placed.ref && <>Reference <strong className="font-mono">{placed.ref}</strong>. </>}
              Total <strong>{formatMoney(placed.totalMinor, restaurant.currency)}</strong>.
            </span>
          </p>
          {restaurant.upiId && placed.totalMinor > 0 && (
            <UpiPay upiId={restaurant.upiId} payeeName={restaurant.name} amountMinor={placed.totalMinor} note={`${restaurant.name} order ${placed.number ? `#${placed.number}` : (placed.ref ?? "")}`} />
          )}
          {restaurant.feedbackEnabled && placed.id && <FeedbackForm restaurantId={restaurant.id} orderId={placed.id} table={sanitizeTable(table)} compact />}
          <button onClick={onClose} className="h-11 w-full rounded-xl bg-[var(--m-chip)] font-semibold">Back to menu</button>
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet title={preview ? "Demo data: message preview" : "Your order"} onClose={onClose}>
      {preview ? (
        <div className="mt-4">
          <p className="text-sm text-[var(--m-muted)]">
            Demo data: this is a fictional restaurant, so nothing is sent. On a real menu, WhatsApp opens with this message and the order lands in the restaurant&apos;s live inbox:
          </p>
          <pre className="mt-3 whitespace-pre-wrap rounded-2xl bg-[#e7fbe0] p-4 font-sans text-sm leading-relaxed text-neutral-800">{preview}</pre>
          {restaurant.upiId && <UpiPay upiId={restaurant.upiId} payeeName={restaurant.name} amountMinor={total} note={`${restaurant.name} demo order`} />}
          <button onClick={() => { onSent(); onClose(); }} className="mt-4 h-11 w-full rounded-xl bg-[var(--m-accent)] font-semibold text-[var(--m-accent-text)]">
            Done
          </button>
        </div>
      ) : (
        <>
          <ul className="mt-4 divide-y divide-[var(--m-border)]">
            {lines.map((l) => (
              <li key={l.key} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{l.name}</p>
                  {l.options && <p className="truncate text-xs text-[var(--m-muted)]">{l.options}</p>}
                  <p className="text-sm text-[var(--m-muted)]">{formatMoney(l.priceMinor * l.qty, restaurant.currency)}</p>
                </div>
                <QtyControl qty={l.qty} onQty={(q) => setQty(l.key, q)} name={l.name} />
              </li>
            ))}
          </ul>
          {restaurant.couponsEnabled && (
            <div className="mt-2">
              <div className="flex gap-2">
                <label className="relative flex-1">
                  <span className="sr-only">Coupon code</span>
                  <TagIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--m-muted)]" />
                  <input value={coupon} onChange={(e) => setCoupon(e.target.value.toUpperCase().slice(0, 20))} placeholder="Coupon code" className={cn(inputCls, "pl-9 uppercase")} autoCapitalize="characters" />
                </label>
                <button onClick={applyCoupon} disabled={!coupon.trim()} className="h-10 rounded-xl border border-[var(--m-border)] px-4 text-sm font-semibold disabled:opacity-50">Apply</button>
              </div>
              {couponError && <p className="mt-1 text-xs text-red-600" role="alert">{couponError}</p>}
              {quote?.couponCode && <p className="mt-1 text-xs text-emerald-700">Code {quote.couponCode} applied.</p>}
            </div>
          )}
          <div className="mt-3 space-y-1 border-t border-[var(--m-border)] pt-3">
            {discount > 0 && (
              <>
                <div className="flex justify-between text-sm"><span>Subtotal</span><span>{formatMoney(subtotal, restaurant.currency)}</span></div>
                <div className="flex justify-between text-sm text-emerald-700"><span>Discount</span><span>−{formatMoney(discount, restaurant.currency)}</span></div>
              </>
            )}
            <div className="flex justify-between font-semibold"><span>Total</span><span>{formatMoney(total, restaurant.currency)}</span></div>
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
          {error && <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</p>}
          {viaWhatsApp ? (
            <button onClick={send} disabled={busy} className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#1fa855] text-[15px] font-semibold text-white disabled:opacity-70">
              <WhatsAppIcon /> Order on WhatsApp
            </button>
          ) : (
            <button onClick={send} disabled={busy} className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--m-accent)] text-[15px] font-semibold text-[var(--m-accent-text)] disabled:opacity-70">
              {busy ? "Placing order…" : `Place order · ${formatMoney(total, restaurant.currency)}`}
            </button>
          )}
          <p className="mt-2 text-center text-xs text-[var(--m-muted)]">
            {viaWhatsApp ? "Opens WhatsApp with your order." : "Sent straight to the kitchen."} {restaurant.upiId ? "Pay by UPI or at the counter." : "Payment is handled by the restaurant."}
          </p>
        </>
      )}
    </Sheet>
  );
}
