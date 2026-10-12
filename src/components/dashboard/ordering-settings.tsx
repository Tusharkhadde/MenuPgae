"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2Icon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Field, SectionCard } from "@/components/dashboard/field";
import { saveOrderingSettings } from "@/server/actions/growth";

export function OrderingSettings(props: {
  restaurantId: string;
  currency: string;
  initial: { ordersEnabled: boolean; serviceRequestsEnabled: boolean; feedbackEnabled: boolean; reservationsEnabled: boolean; digestEnabled: boolean; upiId: string | null };
  reservationsAllowed: boolean;
  digestAllowed: boolean;
  emailConfigured: boolean;
}) {
  const router = useRouter();
  const [s, setS] = useState({ ...props.initial, upiId: props.initial.upiId ?? "" });
  const [pending, start] = useTransition();
  const set = <K extends keyof typeof s>(k: K, v: (typeof s)[K]) => setS((x) => ({ ...x, [k]: v }));

  const rows: { key: "ordersEnabled" | "serviceRequestsEnabled" | "feedbackEnabled" | "reservationsEnabled" | "digestEnabled"; label: string; hint: React.ReactNode; disabled?: boolean }[] = [
    { key: "ordersEnabled", label: "Orders inbox", hint: "Save every order to your live dashboard inbox (WhatsApp still opens if you have it). Without WhatsApp, guests can still order straight to the kitchen." },
    { key: "serviceRequestsEnabled", label: "Call waiter & request bill", hint: "Guests who scanned a table QR get buttons that alert your dashboard." },
    { key: "feedbackEnabled", label: "Reviews funnel", hint: "Ask for a rating after ordering: 4–5★ → your Google reviews link, 1–3★ → private feedback to you." },
    {
      key: "reservationsEnabled",
      label: "Table reservations",
      hint: props.reservationsAllowed ? "Show a “Reserve” button. Requests appear under Guests." : <>Pro feature. <Link className="underline" href="/dashboard/billing">See Pro</Link></>,
      disabled: !props.reservationsAllowed && !s.reservationsEnabled,
    },
    {
      key: "digestEnabled",
      label: "Weekly email digest",
      hint: !props.digestAllowed ? <>Pro feature. <Link className="underline" href="/dashboard/billing">See Pro</Link></> : props.emailConfigured ? "A Monday summary of views, orders, sales and ratings." : "Needs email (Resend) set up on the server.",
    },
  ];

  return (
    <SectionCard
      title="Ordering & guest features"
      description="Choose what guests can do from your menu."
      footer={
        <Button
          disabled={pending}
          onClick={() =>
            start(async () => {
              const res = await saveOrderingSettings(props.restaurantId, { ...s, upiId: s.upiId.trim() || null });
              if (!res.ok) toast.error(res.error);
              else {
                toast.success("Saved");
                router.refresh();
              }
            })
          }
        >
          {pending && <Loader2Icon className="animate-spin" />} Save
        </Button>
      }
    >
      <div className="space-y-2">
        {rows.map((r) => (
          <label key={r.key} className="flex items-start justify-between gap-4 rounded-xl border px-3 py-2.5">
            <span>
              <span className="block text-sm font-medium">{r.label}</span>
              <span className="block text-xs text-muted-foreground">{r.hint}</span>
            </span>
            <Switch checked={s[r.key]} disabled={r.disabled} onCheckedChange={(v) => set(r.key, v)} aria-label={r.label} />
          </label>
        ))}
      </div>
      <Field
        label="UPI ID (India)"
        htmlFor="upi"
        hint={
          props.currency === "INR"
            ? "After ordering, guests get a “Pay with UPI” button and QR with the exact amount — straight to your account, no gateway, no fees."
            : "UPI payments are only shown for menus priced in INR."
        }
      >
        <Input id="upi" value={s.upiId} maxLength={120} onChange={(e) => set("upiId", e.target.value.trim())} placeholder="yourshop@okaxis" autoComplete="off" />
      </Field>
    </SectionCard>
  );
}
