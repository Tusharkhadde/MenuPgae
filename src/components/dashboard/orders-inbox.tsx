"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { BellRingIcon, ChefHatIcon, CircleCheckIcon, InboxIcon, ReceiptIcon, Volume2Icon, VolumeXIcon, WifiOffIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { formatMoney } from "@/lib/money";
import { STATUS_LABELS, nextStatus, type OrderStatus } from "@/lib/order";
import { whatsappLink } from "@/lib/whatsapp";
import type { LiveFeed, LiveOrder } from "@/server/orders";
import { resolveServiceRequest, setOrderPaid, setOrderStatus } from "@/server/actions/ops";
import { chime, timeAgo, useLiveFeed, useSoundPref } from "@/components/dashboard/live-feed";
import { cn } from "@/lib/utils";

const FILTERS: { id: "active" | OrderStatus | "all"; label: string }[] = [
  { id: "active", label: "Active" },
  { id: "new", label: "New" },
  { id: "preparing", label: "Preparing" },
  { id: "ready", label: "Ready" },
  { id: "done", label: "Done" },
  { id: "all", label: "All" },
];

export const STATUS_STYLE: Record<OrderStatus, string> = {
  new: "bg-blue-600 text-white",
  preparing: "bg-amber-500 text-black",
  ready: "bg-emerald-600 text-white",
  done: "bg-muted text-muted-foreground",
  cancelled: "bg-muted text-muted-foreground line-through",
};

export function OrdersInbox({
  restaurantId,
  currency,
  initial,
  historyDays,
  kitchenAllowed,
  ordersEnabled,
  isOwner,
  slug,
}: {
  restaurantId: string;
  currency: string;
  initial: LiveFeed;
  historyDays: number;
  kitchenAllowed: boolean;
  ordersEnabled: boolean;
  isOwner: boolean;
  slug: string;
}) {
  const [sound, setSound] = useSoundPref();
  const { feed, online, patchOrder, dropRequest } = useLiveFeed(restaurantId, initial, (kind, n) => {
    if (sound) chime();
    toast(kind === "order" ? `${n} new order${n === 1 ? "" : "s"}` : `${n} new table request${n === 1 ? "" : "s"}`);
  });
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("active");
  const [, start] = useTransition();

  const orders = useMemo(
    () =>
      feed.orders.filter((o) =>
        filter === "all" ? true : filter === "active" ? o.status === "new" || o.status === "preparing" || o.status === "ready" : o.status === filter,
      ),
    [feed.orders, filter],
  );

  const advance = (o: LiveOrder, status: OrderStatus) => {
    const prev = o.status;
    patchOrder(o.id, { status });
    start(async () => {
      const res = await setOrderStatus(restaurantId, o.id, status);
      if (!res.ok) {
        patchOrder(o.id, { status: prev });
        toast.error(res.error);
      }
    });
  };
  const togglePaid = (o: LiveOrder) => {
    patchOrder(o.id, { paid: !o.paid });
    start(async () => {
      const res = await setOrderPaid(restaurantId, o.id, !o.paid);
      if (!res.ok) {
        patchOrder(o.id, { paid: o.paid });
        toast.error(res.error);
      }
    });
  };
  const resolve = (id: string) => {
    dropRequest(id);
    start(async () => {
      const res = await resolveServiceRequest(restaurantId, id);
      if (!res.ok) toast.error(res.error);
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="grid flex-1 grid-cols-3 gap-3 sm:max-w-xl">
          <Stat label="Orders today" value={String(feed.today.count)} />
          <Stat label="Sales today" value={formatMoney(feed.today.revenueMinor, currency)} />
          <Stat label="Marked paid" value={formatMoney(feed.today.paidMinor, currency)} />
        </div>
        <div className="flex items-center gap-2">
          {!online && (
            <Badge variant="destructive" className="gap-1"><WifiOffIcon className="size-3" /> Reconnecting…</Badge>
          )}
          <label className="flex items-center gap-2 rounded-xl border bg-card px-3 py-2 text-sm">
            {sound ? <Volume2Icon className="size-4" /> : <VolumeXIcon className="size-4" />} Sound
            <Switch checked={sound} onCheckedChange={setSound} aria-label="Play a sound for new orders" />
          </label>
          {kitchenAllowed ? (
            <Button asChild variant="outline"><Link href={`/kitchen/${restaurantId}`}><ChefHatIcon /> Kitchen display</Link></Button>
          ) : (
            <Button asChild variant="outline"><Link href="/dashboard/billing"><ChefHatIcon /> Kitchen display · Pro</Link></Button>
          )}
        </div>
      </div>

      {!ordersEnabled && (
        <p className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
          Orders from your menu aren&apos;t being saved to this inbox.{" "}
          {isOwner ? <Link className="font-medium underline" href={`/dashboard/r/${restaurantId}/settings`}>Turn on the orders inbox</Link> : "Ask the owner to turn on the orders inbox."}
        </p>
      )}

      {feed.requests.length > 0 && (
        <section aria-label="Table requests" className="rounded-2xl border-2 border-red-500/60 bg-red-500/5 p-4">
          <h2 className="flex items-center gap-2 font-semibold"><BellRingIcon className="size-4 text-red-600" /> Table requests</h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {feed.requests.map((r) => (
              <li key={r.id} className="flex items-center gap-3 rounded-xl border bg-card px-3 py-2">
                {r.kind === "bill" ? <ReceiptIcon className="size-4" /> : <BellRingIcon className="size-4" />}
                <span className="text-sm">
                  <strong>Table {r.table}</strong> · {r.kind === "bill" ? "wants the bill" : "needs a waiter"} · <span className="text-muted-foreground">{timeAgo(r.createdAt)}</span>
                </span>
                <Button size="sm" variant="secondary" onClick={() => resolve(r.id)}><CircleCheckIcon /> Done</Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Filter orders">
        {FILTERS.map((f) => {
          const n = f.id === "all" ? feed.orders.length : f.id === "active" ? feed.orders.filter((o) => ["new", "preparing", "ready"].includes(o.status)).length : feed.orders.filter((o) => o.status === f.id).length;
          return (
            <button
              key={f.id}
              role="tab"
              aria-selected={filter === f.id}
              onClick={() => setFilter(f.id)}
              className={cn("rounded-full border px-3 py-1 text-sm", filter === f.id ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:border-foreground/30")}
            >
              {f.label} <span className="tabular-nums opacity-70">{n}</span>
            </button>
          );
        })}
      </div>

      {orders.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-card p-12 text-center">
          <InboxIcon className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-3 font-medium">{filter === "active" ? "No orders in progress" : "No orders here"}</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            New orders from <a className="underline" href={`/r/${slug}`} target="_blank" rel="noopener noreferrer">your menu</a> appear here instantly. Keep this page open during service — it updates by itself. Showing the last {historyDays} days.
          </p>
        </div>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {orders.map((o) => (
            <OrderCard key={o.id} order={o} currency={currency} onStatus={(s) => advance(o, s)} onPaid={() => togglePaid(o)} />
          ))}
        </ul>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border bg-card px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 truncate text-xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function OrderCard({ order: o, currency, onStatus, onPaid }: { order: LiveOrder; currency: string; onStatus: (s: OrderStatus) => void; onPaid: () => void }) {
  const next = nextStatus(o.status);
  const wa = o.customerPhone ? whatsappLink(o.customerPhone) : null;
  return (
    <li className={cn("flex flex-col rounded-2xl border bg-card", o.status === "new" && "ring-2 ring-blue-600/40")}>
      <div className="flex items-start justify-between gap-2 border-b px-4 py-3">
        <div>
          <p className="font-semibold">
            #{o.number}
            {o.table && <span className="ml-2 rounded-md bg-muted px-1.5 py-0.5 text-sm">Table {o.table}</span>}
          </p>
          <p className="text-xs text-muted-foreground">
            {timeAgo(o.createdAt)}
            {o.ref && <> · ref <span className="font-mono">{o.ref}</span></>}
            {o.customerName && <> · {o.customerName}</>}
          </p>
        </div>
        <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", STATUS_STYLE[o.status])}>{STATUS_LABELS[o.status]}</span>
      </div>
      <ul className="flex-1 space-y-1.5 px-4 py-3 text-sm">
        {o.lines.map((l, i) => (
          <li key={i} className="flex justify-between gap-3">
            <span>
              <strong>{l.qty}×</strong> {l.name}
              {l.options && <span className="block text-xs text-muted-foreground">{l.options}</span>}
            </span>
            <span className="tabular-nums text-muted-foreground">{formatMoney(l.unitMinor * l.qty, currency)}</span>
          </li>
        ))}
        {o.note && <li className="rounded-lg bg-amber-100 px-2 py-1 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">Note: {o.note}</li>}
      </ul>
      <div className="space-y-3 border-t px-4 py-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {o.discountMinor > 0 && <>−{formatMoney(o.discountMinor, currency)} {o.couponCode && `(${o.couponCode})`} · </>}Total
          </span>
          <span className="font-semibold tabular-nums">{formatMoney(o.totalMinor, currency)}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {next && <Button size="sm" onClick={() => onStatus(next)}>Mark {STATUS_LABELS[next].toLowerCase()}</Button>}
          {o.status !== "cancelled" && o.status !== "done" && (
            <Button size="sm" variant="ghost" onClick={() => onStatus("cancelled")}>Cancel</Button>
          )}
          {(o.status === "done" || o.status === "cancelled") && (
            <Button size="sm" variant="ghost" onClick={() => onStatus("new")}>Reopen</Button>
          )}
          <label className="ml-auto flex items-center gap-2 text-sm">
            Paid <Switch checked={o.paid} onCheckedChange={onPaid} aria-label={`Order ${o.number} paid`} />
          </label>
        </div>
        {wa && <a href={wa} target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline">Message guest on WhatsApp</a>}
      </div>
    </li>
  );
}
