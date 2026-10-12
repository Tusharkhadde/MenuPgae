"use client";

import { useEffect, useId, useRef } from "react";
import { MinusIcon, PlusIcon, XIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function track(body: Record<string, unknown>) {
  try {
    const data = JSON.stringify(body);
    if (navigator.sendBeacon) navigator.sendBeacon("/api/track", new Blob([data], { type: "text/plain" }));
    else void fetch("/api/track", { method: "POST", body: data, keepalive: true });
  } catch {
    /* analytics must never break the page */
  }
}

export async function postJson<T>(url: string, body: unknown): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  try {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const json = (await res.json().catch(() => null)) as ({ ok?: boolean; error?: string } & T) | null;
    if (!res.ok || !json || json.ok === false) return { ok: false, error: json?.error ?? "Something went wrong. Please try again." };
    return { ok: true, data: json };
  } catch {
    return { ok: false, error: "You seem to be offline. Please try again." };
  }
}

export const inputCls =
  "h-10 w-full rounded-xl border border-[var(--m-border)] bg-[var(--m-surface)] px-3 text-[15px] outline-none placeholder:text-[var(--m-muted)] focus:border-[var(--m-accent)]";

export function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1 block text-xs font-medium text-[var(--m-muted)]">{label}</span>
      {children}
    </label>
  );
}

/** Bottom sheet on phones, centered dialog on larger screens. Esc closes; focus moves inside. */
export function Sheet({ title, onClose, children, labelledBy }: { title: React.ReactNode; onClose: () => void; children: React.ReactNode; labelledBy?: string }) {
  const id = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      prev?.focus?.();
    };
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-labelledby={labelledBy ?? id}>
      <button className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={onClose} aria-label="Close" tabIndex={-1} />
      <div
        ref={panelRef}
        tabIndex={-1}
        className="relative max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-[var(--m-border)] bg-[var(--m-bg)] p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-[var(--m-text)] shadow-2xl outline-none sm:rounded-3xl"
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id={id} className="menu-heading text-xl font-semibold">{title}</h2>
          <button onClick={onClose} className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--m-chip)]" aria-label="Close">
            <XIcon className="size-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function QtyControl({ qty, onQty, name, floating, addLabel = "Add" }: { qty: number; onQty: (q: number) => void; name: string; floating?: boolean; addLabel?: string }) {
  const base = cn(
    "flex h-8 items-center rounded-lg border border-[var(--m-border)] bg-[var(--m-surface)] text-sm font-semibold text-[var(--m-accent)]",
    floating && "shadow-md",
  );
  if (qty === 0) {
    return (
      <button onClick={() => onQty(1)} className={cn(base, "px-4")} aria-label={`${addLabel} ${name}`}>
        {addLabel}
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

export function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn("size-5 fill-current", className)} aria-hidden>
      <path d="M17.5 14.4c-.3-.1-1.8-.9-2-1s-.5-.1-.7.1-.8 1-1 1.2-.4.2-.6.1a8.2 8.2 0 0 1-4-3.5c-.3-.5.3-.5.9-1.6.1-.2 0-.4 0-.5l-.9-2.2c-.2-.6-.5-.5-.7-.5h-.6a1.2 1.2 0 0 0-.8.4 3.5 3.5 0 0 0-1.1 2.6 6 6 0 0 0 1.3 3.2 13.8 13.8 0 0 0 5.3 4.7c2 .8 2.7.9 3.7.7a3.1 3.1 0 0 0 2-1.4 2.5 2.5 0 0 0 .2-1.4c-.1-.2-.3-.3-.6-.4zM12 21.8a9.8 9.8 0 0 1-5-1.4l-.4-.2-3.7 1 1-3.6-.2-.4A9.8 9.8 0 1 1 12 21.8zm8.4-18.2A11.8 11.8 0 0 0 1.8 17.9L.1 24l6.3-1.6A11.8 11.8 0 0 0 24 12a11.7 11.7 0 0 0-3.6-8.4z" />
    </svg>
  );
}
