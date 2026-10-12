"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeftIcon, BellRingIcon, MaximizeIcon, ReceiptIcon, Volume2Icon, VolumeXIcon, WifiOffIcon } from "lucide-react";
import { toast } from "sonner";
import { STATUS_LABELS, nextStatus, type OrderStatus } from "@/lib/order";
import type { LiveFeed, LiveOrder } from "@/server/orders";
import { resolveServiceRequest, setOrderStatus } from "@/server/actions/ops";
import { chime, useLiveFeed, useSoundPref } from "@/components/dashboard/live-feed";
import { cn } from "@/lib/utils";

const COLUMNS: { status: OrderStatus; label: string; tone: string }[] = [
  { status: "new", label: "New", tone: "border-blue-500" },
  { status: "preparing", label: "Preparing", tone: "border-amber-400" },
  { status: "ready", label: "Ready", tone: "border-emerald-500" },
];

function minutesSince(iso: string, now: number) {
  return Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60000));
}

/** Full-screen kitchen board: tap a ticket to bump it to the next stage. */
export function KitchenDisplay({ restaurantId, name, initial }: { restaurantId: string; name: string; initial: LiveFeed }) {
  const [sound, setSound] = useSoundPref();
  const { feed, online, patchOrder, dropRequest } = useLiveFeed(restaurantId, initial, () => sound && chime());
  const [now, setNow] = useState(() => Date.now());
  const [, start] = useTransition();
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const byStatus = useMemo(() => {
    const m: Record<string, LiveOrder[]> = { new: [], preparing: [], ready: [] };
    for (const o of [...feed.orders].reverse()) if (m[o.status]) m[o.status].push(o);
    return m;
  }, [feed.orders]);

  const bump = (o: LiveOrder, to?: OrderStatus) => {
    const next = to ?? nextStatus(o.status);
    if (!next) return;
    const prev = o.status;
    patchOrder(o.id, { status: next });
    start(async () => {
      const res = await setOrderStatus(restaurantId, o.id, next);
      if (!res.ok) {
        patchOrder(o.id, { status: prev });
        toast.error(res.error);
      }
    });
  };

  return (
    <div className="flex min-h-dvh flex-col bg-neutral-950 text-neutral-100">
      <header className="flex items-center justify-between gap-3 border-b border-neutral-800 px-4 py-3">
        <div className="flex items-center gap-3">
          <Link href={`/dashboard/r/${restaurantId}/orders`} className="grid size-9 place-items-center rounded-lg bg-neutral-800" aria-label="Back to dashboard"><ArrowLeftIcon className="size-4" /></Link>
          <h1 className="text-lg font-semibold">{name} · Kitchen</h1>
          {!online && <span className="flex items-center gap-1 rounded-full bg-red-600 px-2 py-0.5 text-xs"><WifiOffIcon className="size-3" /> Offline</span>}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setSound(!sound)} className="flex h-9 items-center gap-1.5 rounded-lg bg-neutral-800 px-3 text-sm" aria-pressed={sound}>
            {sound ? <Volume2Icon className="size-4" /> : <VolumeXIcon className="size-4" />} {sound ? "Sound on" : "Sound off"}
          </button>
          <button onClick={() => void document.documentElement.requestFullscreen?.().catch(() => {})} className="grid size-9 place-items-center rounded-lg bg-neutral-800" aria-label="Full screen"><MaximizeIcon className="size-4" /></button>
        </div>
      </header>
      {feed.requests.length > 0 && (
        <div className="flex flex-wrap gap-2 border-b border-neutral-800 bg-red-950/60 px-4 py-2">
          {feed.requests.map((r) => (
            <button
              key={r.id}
              onClick={() => {
                dropRequest(r.id);
                start(async () => void (await resolveServiceRequest(restaurantId, r.id)));
              }}
              className="flex items-center gap-2 rounded-lg bg-red-600 px-3 py-1.5 text-sm font-semibold"
            >
              {r.kind === "bill" ? <ReceiptIcon className="size-4" /> : <BellRingIcon className="size-4" />} Table {r.table}: {r.kind === "bill" ? "bill" : "waiter"} ✓
            </button>
          ))}
        </div>
      )}
      <main className="grid flex-1 gap-3 p-3 md:grid-cols-3">
        {COLUMNS.map((col) => (
          <section key={col.status} aria-label={col.label} className="flex min-h-0 flex-col rounded-xl bg-neutral-900">
            <h2 className={cn("flex items-center justify-between border-t-4 px-3 py-2 font-semibold", col.tone)}>
              {col.label} <span className="tabular-nums text-neutral-400">{byStatus[col.status].length}</span>
            </h2>
            <ul className="flex-1 space-y-3 overflow-y-auto p-3">
              {byStatus[col.status].map((o) => {
                const mins = minutesSince(o.createdAt, now);
                return (
                  <li key={o.id}>
                    <button onClick={() => bump(o)} className="w-full rounded-xl bg-neutral-800 p-3 text-left transition-colors hover:bg-neutral-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">
                      <div className="flex items-center justify-between">
                        <span className="text-xl font-bold">#{o.number}{o.table && <span className="ml-2 text-base font-semibold text-neutral-300">T{o.table}</span>}</span>
                        <span className={cn("rounded-md px-2 py-0.5 text-sm font-semibold tabular-nums", mins >= 20 ? "bg-red-600" : mins >= 10 ? "bg-amber-500 text-black" : "bg-neutral-700")}>{mins}m</span>
                      </div>
                      <ul className="mt-2 space-y-1 text-[15px]">
                        {o.lines.map((l, i) => (
                          <li key={i}>
                            <strong>{l.qty}×</strong> {l.name}
                            {l.options && <span className="block pl-6 text-sm text-neutral-400">{l.options}</span>}
                          </li>
                        ))}
                      </ul>
                      {o.note && <p className="mt-2 rounded-md bg-amber-400 px-2 py-1 text-sm font-medium text-black">{o.note}</p>}
                      <p className="mt-2 text-xs text-neutral-400">Tap → {STATUS_LABELS[nextStatus(o.status) ?? o.status]}</p>
                    </button>
                  </li>
                );
              })}
              {byStatus[col.status].length === 0 && <li className="py-8 text-center text-sm text-neutral-500">Nothing here</li>}
            </ul>
          </section>
        ))}
      </main>
    </div>
  );
}
