"use client";

import { useState, useTransition } from "react";
import { CalendarDaysIcon, CheckIcon, MessageSquareIcon, StarIcon, Trash2Icon, UsersIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { whatsappLink } from "@/lib/whatsapp";
import { reservationReplyText } from "@/lib/reservations";
import { deleteFeedback, setReservationStatus } from "@/server/actions/ops";
import { cn } from "@/lib/utils";

type Res = { id: string; name: string; phone: string; email: string | null; date: string; time: string; partySize: number; note: string | null; status: "pending" | "accepted" | "declined" };

function prettyDate(d: string) {
  return new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
}

export function ReservationList({ restaurantId, restaurantName, items: initial }: { restaurantId: string; restaurantName: string; items: Res[] }) {
  const [items, setItems] = useState(initial);
  const [, start] = useTransition();
  if (!items.length) {
    return (
      <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
        <CalendarDaysIcon className="mx-auto mb-2 size-6" /> No upcoming reservations.
      </div>
    );
  }
  const act = (r: Res, status: "accepted" | "declined") => {
    setItems((xs) => xs.map((x) => (x.id === r.id ? { ...x, status } : x)));
    start(async () => {
      const res = await setReservationStatus(restaurantId, r.id, status);
      if (!res.ok) {
        toast.error(res.error);
        setItems((xs) => xs.map((x) => (x.id === r.id ? { ...x, status: r.status } : x)));
      } else toast.success(`${status === "accepted" ? "Accepted" : "Declined"}${res.data.emailed ? " — guest emailed" : ""}`);
    });
  };
  return (
    <ul className="space-y-2">
      {items.map((r) => {
        const reply = r.status !== "pending" ? whatsappLink(r.phone, reservationReplyText({ restaurantName, name: r.name, date: r.date, time: r.time, partySize: r.partySize, accepted: r.status === "accepted" })) : null;
        return (
          <li key={r.id} className={cn("rounded-xl border p-3", r.status === "declined" && "opacity-60")}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-medium">{prettyDate(r.date)} · {r.time} <span className="ml-1 inline-flex items-center gap-1 text-sm text-muted-foreground"><UsersIcon className="size-3.5" /> {r.partySize}</span></p>
                <p className="text-sm">{r.name} · <a className="underline" href={`tel:${r.phone.replace(/[^\d+]/g, "")}`}>{r.phone}</a>{r.email && <> · {r.email}</>}</p>
                {r.note && <p className="mt-1 text-xs text-muted-foreground">“{r.note}”</p>}
              </div>
              <Badge variant={r.status === "accepted" ? "default" : r.status === "declined" ? "secondary" : "outline"} className="capitalize">{r.status}</Badge>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {r.status !== "accepted" && <Button size="sm" onClick={() => act(r, "accepted")}><CheckIcon /> Accept</Button>}
              {r.status !== "declined" && <Button size="sm" variant="outline" onClick={() => act(r, "declined")}><XIcon /> Decline</Button>}
              {reply && <Button size="sm" variant="ghost" asChild><a href={reply} target="_blank" rel="noopener noreferrer"><MessageSquareIcon /> WhatsApp the guest</a></Button>}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

type Fb = { id: string; rating: number; comment: string | null; contact: string | null; table: string | null; createdAt: string };

export function FeedbackList({ restaurantId, items: initial }: { restaurantId: string; items: Fb[] }) {
  const [items, setItems] = useState(initial);
  const [, start] = useTransition();
  const shown = items.filter((f) => f.comment || f.rating <= 3);
  if (!shown.length) {
    return <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">No private feedback yet. Written feedback from guests will appear here.</p>;
  }
  return (
    <ul className="space-y-2">
      {shown.map((f) => (
        <li key={f.id} className="rounded-xl border p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-0.5" role="img" aria-label={`${f.rating} out of 5 stars`}>
              {[1, 2, 3, 4, 5].map((n) => (
                <StarIcon key={n} className={cn("size-4", n <= f.rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40")} />
              ))}
            </span>
            <span className="text-xs text-muted-foreground">
              {new Date(f.createdAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
              {f.table && <> · table {f.table}</>}
            </span>
          </div>
          {f.comment && <p className="mt-1.5 text-sm">{f.comment}</p>}
          <div className="mt-1 flex items-center justify-between">
            {f.contact ? <p className="text-xs text-muted-foreground">Contact: {f.contact}</p> : <span />}
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label="Delete feedback"
              onClick={() => {
                if (!confirm("Delete this feedback?")) return;
                setItems((xs) => xs.filter((x) => x.id !== f.id));
                start(async () => {
                  const res = await deleteFeedback(restaurantId, f.id);
                  if (!res.ok) toast.error(res.error);
                });
              }}
            >
              <Trash2Icon />
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}
