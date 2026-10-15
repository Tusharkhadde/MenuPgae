"use client";

import { useEffect, useState } from "react";
import { BellRingIcon, CalendarDaysIcon, CheckCircle2Icon, ReceiptIcon, StarIcon } from "lucide-react";
import { buildUpiLink } from "@/lib/upi";
import { formatMoney } from "@/lib/money";
import { whatsappLink } from "@/lib/whatsapp";
import { reservationWhatsAppText } from "@/lib/reservations";
import { Field, Sheet, WhatsAppIcon, inputCls, postJson } from "@/components/menu/menu-shared";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------- UPI pay */

export function UpiPay({ upiId, payeeName, amountMinor, note }: { upiId: string; payeeName: string; amountMinor: number; note: string }) {
  const link = buildUpiLink({ upiId, payeeName, amountMinor, note });
  const [qr, setQr] = useState<string | null>(null);
  useEffect(() => {
    if (!link) return;
    let alive = true;
    void import("qrcode").then(({ default: QR }) =>
      QR.toDataURL(link, { margin: 1, width: 240, errorCorrectionLevel: "M" }).then((url) => alive && setQr(url)).catch(() => {}),
    );
    return () => {
      alive = false;
    };
  }, [link]);
  if (!link) return null;
  return (
    <div className="mt-4 rounded-2xl border border-[var(--m-border)] bg-[var(--m-surface)] p-4 text-center">
      <p className="text-sm font-semibold">Pay {formatMoney(amountMinor, "INR")} by UPI</p>
      <p className="mt-0.5 text-xs text-[var(--m-muted)]">Opens GPay, PhonePe, Paytm or any UPI app with the amount filled in. No extra fees.</p>
      <a href={link} className="mt-3 inline-flex h-11 w-full items-center justify-center rounded-xl bg-[var(--m-accent)] font-semibold text-[var(--m-accent-text)]">
        Pay with UPI app
      </a>
      {qr && (
        <div className="mt-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- generated data URL */}
          <img src={qr} alt={`UPI QR code to pay ${formatMoney(amountMinor, "INR")} to ${upiId}`} width={180} height={180} className="mx-auto rounded-lg bg-white p-1" />
          <p className="mt-1 text-[11px] text-[var(--m-muted)]">Or scan from another phone · {upiId}</p>
        </div>
      )}
      <p className="mt-2 text-[11px] text-[var(--m-muted)]">Please show the payment confirmation to staff.</p>
    </div>
  );
}

/* --------------------------------------------------------- Table service bar */

export function ServiceBar({ restaurantId, table, raised }: { restaurantId: string; table: string; raised: boolean }) {
  const [sent, setSent] = useState<"waiter" | "bill" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const call = async (kind: "waiter" | "bill") => {
    setBusy(true);
    setError(null);
    const res = await postJson("/api/service", { r: restaurantId, table, kind });
    setBusy(false);
    if (res.ok) {
      setSent(kind);
      setTimeout(() => setSent(null), 6000);
    } else setError(res.error);
  };
  return (
    <div className={cn("fixed right-3 z-30 flex flex-col items-end gap-2 transition-[bottom]", raised ? "bottom-24" : "bottom-4")}>
      <div role="status" aria-live="polite" className="text-right">
        {sent && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-lg">
            <CheckCircle2Icon className="size-3.5" /> {sent === "bill" ? "Bill requested" : "Staff notified"} · table {table}
          </span>
        )}
        {error && <span className="inline-block rounded-full bg-red-600 px-3 py-1.5 text-xs font-semibold text-white shadow-lg">{error}</span>}
      </div>
      <div className="flex gap-2">
        <button disabled={busy} onClick={() => call("waiter")} className="flex h-10 items-center gap-1.5 rounded-full border border-[var(--m-border)] bg-[var(--m-surface)] px-3.5 text-sm font-medium shadow-lg disabled:opacity-60">
          <BellRingIcon className="size-4" /> Call waiter
        </button>
        <button disabled={busy} onClick={() => call("bill")} className="flex h-10 items-center gap-1.5 rounded-full border border-[var(--m-border)] bg-[var(--m-surface)] px-3.5 text-sm font-medium shadow-lg disabled:opacity-60">
          <ReceiptIcon className="size-4" /> Bill
        </button>
      </div>
    </div>
  );
}

/* --------------------------------------------------------- Reviews funnel */

export function FeedbackForm({
  restaurantId,
  orderId,
  table,
  compact,
  onDone,
}: {
  restaurantId: string;
  orderId?: string | null;
  table?: string | null;
  compact?: boolean;
  onDone?: () => void;
}) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [contact, setContact] = useState("");
  const [state, setState] = useState<"rate" | "private" | "google" | "thanks">("rate");
  const [google, setGoogle] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (r: number, extra?: { comment?: string; contact?: string }) => {
    setBusy(true);
    setError(null);
    const res = await postJson<{ route: "google" | "private"; googleReviewsUrl: string | null }>("/api/feedback", {
      r: restaurantId,
      rating: r,
      orderId: orderId ?? null,
      table: table ?? null,
      comment: extra?.comment || null,
      contact: extra?.contact || null,
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return null;
    }
    return res.data;
  };

  const pick = async (r: number) => {
    setRating(r);
    if (r >= 4) {
      const data = await submit(r);
      if (!data) return;
      if (data.route === "google" && data.googleReviewsUrl) {
        setGoogle(data.googleReviewsUrl);
        setState("google");
      } else setState("thanks");
    } else setState("private");
  };

  if (state === "thanks") {
    return <p className="rounded-2xl bg-[var(--m-chip)] p-4 text-center text-sm font-medium">Thank you for the feedback! 🙏</p>;
  }
  if (state === "google" && google) {
    return (
      <div className="rounded-2xl border border-[var(--m-border)] bg-[var(--m-surface)] p-4 text-center">
        <p className="font-semibold">So glad you enjoyed it!</p>
        <p className="mt-1 text-sm text-[var(--m-muted)]">Would you share that on Google? It really helps a small restaurant.</p>
        <a href={google} target="_blank" rel="noopener noreferrer" onClick={() => onDone?.()} className="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[var(--m-accent)] font-semibold text-[var(--m-accent-text)]">
          <StarIcon className="size-4 fill-current" /> Write a Google review
        </a>
        <button onClick={() => setState("thanks")} className="mt-2 text-xs text-[var(--m-muted)] underline">Maybe later</button>
      </div>
    );
  }
  return (
    <div className={cn("rounded-2xl border border-[var(--m-border)] bg-[var(--m-surface)] p-4", compact && "p-3")}>
      <p className="text-center text-sm font-semibold">{state === "private" ? "Sorry it wasn't perfect. What could we do better?" : "How was everything?"}</p>
      <div className="mt-2 flex justify-center gap-1" role="radiogroup" aria-label="Rating out of 5" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            role="radio"
            aria-checked={rating === n}
            aria-label={`${n} star${n === 1 ? "" : "s"}`}
            disabled={busy}
            onMouseEnter={() => setHover(n)}
            onClick={() => pick(n)}
            className="grid size-10 place-items-center rounded-full"
          >
            <StarIcon className={cn("size-7 transition-colors", (hover || rating) >= n ? "fill-amber-400 text-amber-400" : "text-[var(--m-muted)]")} />
          </button>
        ))}
      </div>
      {state === "private" && (
        <form
          className="mt-3 space-y-2"
          onSubmit={async (e) => {
            e.preventDefault();
            const data = await submit(rating, { comment, contact });
            if (data) {
              setState("thanks");
              onDone?.();
            }
          }}
        >
          <textarea value={comment} onChange={(e) => setComment(e.target.value.slice(0, 1000))} rows={3} required placeholder="Tell the owner directly — only they will see this." className={cn(inputCls, "h-auto py-2")} aria-label="Your feedback" />
          <input value={contact} onChange={(e) => setContact(e.target.value.slice(0, 100))} placeholder="Phone or email (optional, if you'd like a reply)" className={inputCls} aria-label="Contact (optional)" />
          <button disabled={busy || !comment.trim()} className="h-11 w-full rounded-xl bg-[var(--m-accent)] font-semibold text-[var(--m-accent-text)] disabled:opacity-60">Send privately</button>
        </form>
      )}
      {error && <p className="mt-2 text-center text-xs text-red-600">{error}</p>}
    </div>
  );
}

export function FeedbackButton({ restaurantId, table }: { restaurantId: string; table?: string | null }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 rounded-full border border-[var(--m-border)] bg-[var(--m-surface)] px-3 py-1.5 font-medium text-[var(--m-text)]">
        <StarIcon className="size-3.5" /> Rate your visit
      </button>
      {open && (
        <Sheet title="Rate your visit" onClose={() => setOpen(false)}>
          <div className="mt-4">
            <FeedbackForm restaurantId={restaurantId} table={table} />
          </div>
        </Sheet>
      )}
    </>
  );
}

/* --------------------------------------------------------- Reservations */

function todayIn(timeZone: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

export function ReserveButton({ restaurant }: { restaurant: { id: string; name: string; timezone: string; whatsapp: string | null } }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} className="flex shrink-0 items-center gap-2 rounded-xl border border-[var(--m-border)] bg-[var(--m-surface)] px-3.5 py-2 text-sm font-medium transition-colors hover:border-[var(--m-accent)]">
        <CalendarDaysIcon className="size-4" /> Reserve
      </button>
      {open && <ReservationSheet restaurant={restaurant} onClose={() => setOpen(false)} />}
    </>
  );
}

function ReservationSheet({ restaurant, onClose }: { restaurant: { id: string; name: string; timezone: string; whatsapp: string | null }; onClose: () => void }) {
  const today = todayIn(restaurant.timezone);
  const [form, setForm] = useState({ name: "", phone: "", email: "", date: today, time: "19:30", partySize: 2, note: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));
  const wa = restaurant.whatsapp ? whatsappLink(restaurant.whatsapp, reservationWhatsAppText({ restaurantName: restaurant.name, ...form })) : null;

  return (
    <Sheet title={done ? "Request sent" : "Reserve a table"} onClose={onClose}>
      {done ? (
        <div className="mt-4 space-y-3 text-sm">
          <p className="flex items-start gap-2 rounded-2xl bg-[var(--m-chip)] p-4">
            <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-emerald-600" />
            <span>
              {restaurant.name} has your request for {form.partySize} on {form.date} at {form.time}. They&apos;ll confirm by phone{form.email ? " or email" : ""}.
            </span>
          </p>
          {wa && (
            <a href={wa} target="_blank" rel="noopener noreferrer" className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#1fa855] font-semibold text-white">
              <WhatsAppIcon /> Also send on WhatsApp
            </a>
          )}
          <button onClick={onClose} className="h-11 w-full rounded-xl bg-[var(--m-chip)] font-semibold">Done</button>
        </div>
      ) : (
        <form
          className="mt-4 space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError(null);
            const res = await postJson("/api/reservations", { r: restaurant.id, ...form, email: form.email || null, note: form.note || null });
            setBusy(false);
            if (res.ok) setDone(true);
            else setError(res.error);
          }}
        >
          <div className="grid grid-cols-2 gap-2">
            <Field label="Date">
              <input type="date" required min={today} value={form.date} onChange={(e) => set("date", e.target.value)} className={inputCls} />
            </Field>
            <Field label="Time">
              <input type="time" required value={form.time} onChange={(e) => set("time", e.target.value)} className={inputCls} />
            </Field>
          </div>
          <Field label="Guests">
            <div className="flex flex-wrap gap-1.5">
              {[1, 2, 3, 4, 5, 6, 8, 10].map((n) => (
                <button type="button" key={n} aria-pressed={form.partySize === n} onClick={() => set("partySize", n)} className={cn("h-9 min-w-10 rounded-lg border px-2 text-sm font-medium", form.partySize === n ? "border-[var(--m-accent)] bg-[var(--m-accent)] text-[var(--m-accent-text)]" : "border-[var(--m-border)] bg-[var(--m-surface)]")}>
                  {n}
                </button>
              ))}
              <input type="number" min={1} max={50} value={form.partySize} onChange={(e) => set("partySize", Math.max(1, Math.min(50, Number(e.target.value) || 1)))} className={cn(inputCls, "h-9 w-20")} aria-label="Number of guests" />
            </div>
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Name">
              <input required minLength={2} maxLength={60} value={form.name} onChange={(e) => set("name", e.target.value)} className={inputCls} autoComplete="name" />
            </Field>
            <Field label="Phone">
              <input required type="tel" maxLength={24} value={form.phone} onChange={(e) => set("phone", e.target.value)} className={inputCls} autoComplete="tel" />
            </Field>
          </div>
          <Field label="Email (optional)">
            <input type="email" maxLength={120} value={form.email} onChange={(e) => set("email", e.target.value)} className={inputCls} autoComplete="email" />
          </Field>
          <Field label="Note (optional)">
            <input maxLength={300} value={form.note} onChange={(e) => set("note", e.target.value)} placeholder="Birthday, high chair, window seat…" className={inputCls} />
          </Field>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button disabled={busy} className="h-12 w-full rounded-xl bg-[var(--m-accent)] font-semibold text-[var(--m-accent-text)] disabled:opacity-60">{busy ? "Sending…" : "Request table"}</button>
          <p className="text-center text-xs text-[var(--m-muted)]">This is a request — the restaurant will confirm.</p>
        </form>
      )}
    </Sheet>
  );
}
