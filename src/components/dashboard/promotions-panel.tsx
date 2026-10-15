"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Loader2Icon, PlusIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { NativeSelect } from "@/components/ui/native-select";
import { Field, SectionCard } from "@/components/dashboard/field";
import { AvailabilityEditor, type DraftAvailability } from "@/components/dashboard/menu-options-editor";
import { formatMoney } from "@/lib/money";
import type { HappyHour } from "@/lib/schedule";
import { createCoupon, deleteCoupon, savePromotions, setCouponActive } from "@/server/actions/growth";

type CouponRow = { id: string; code: string; kind: "percent" | "amount"; value: number; minOrderMinor: number; active: boolean; expiresAt: string | null; maxUses: number | null; uses: number };

export function PromotionsPanel(props: {
  restaurantId: string;
  currency: string;
  promoBanner: string | null;
  happyHour: HappyHour | null;
  happyHourAllowed: boolean;
  couponsAllowed: boolean;
  coupons: CouponRow[];
}) {
  const router = useRouter();
  const [banner, setBanner] = useState(props.promoBanner ?? "");
  const [hhOn, setHhOn] = useState(!!props.happyHour?.enabled);
  const [percent, setPercent] = useState(String(props.happyHour?.percent ?? 20));
  const [hhLabel, setHhLabel] = useState(props.happyHour?.label ?? "Happy hour");
  const [win, setWin] = useState<DraftAvailability>({ days: props.happyHour?.days ?? [], timed: true, from: props.happyHour?.from ?? "16:00", to: props.happyHour?.to ?? "19:00" });
  const [pending, start] = useTransition();

  const save = () =>
    start(async () => {
      const p = Number.parseInt(percent, 10);
      const res = await savePromotions(props.restaurantId, {
        promoBanner: banner,
        happyHour: hhOn || props.happyHour
          ? { enabled: hhOn, percent: Number.isInteger(p) ? Math.min(90, Math.max(1, p)) : 20, days: win.days.length ? win.days : undefined, from: win.from, to: win.to, label: hhLabel || null }
          : null,
      });
      if (!res.ok) toast.error(res.error);
      else {
        toast.success("Saved — live on your menu");
        router.refresh();
      }
    });

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-6">
        <SectionCard
          title="Promo banner"
          description="One line at the top of your menu — offers, new dishes, festival hours."
          footer={<Button onClick={save} disabled={pending}>{pending && <Loader2Icon className="animate-spin" />} Save</Button>}
        >
          <Field label="Banner text" htmlFor="promo">
            <Input id="promo" maxLength={140} value={banner} onChange={(e) => setBanner(e.target.value)} placeholder="Diwali special: free gulab jamun with every thali 🪔" />
          </Field>
        </SectionCard>
        <SectionCard
          title="Happy hour"
          description="Automatic discount on the dishes you mark “Happy hour” in the menu editor, during a time window."
          footer={<Button onClick={save} disabled={pending || !props.happyHourAllowed}>{pending && <Loader2Icon className="animate-spin" />} Save</Button>}
        >
          {!props.happyHourAllowed ? (
            <p className="text-sm">Happy-hour pricing is part of Pro. <Link href="/dashboard/billing" className="font-medium text-primary underline">See Pro</Link></p>
          ) : (
            <div className="space-y-4">
              <label className="flex items-center gap-2 text-sm font-medium">
                <Switch checked={hhOn} onCheckedChange={setHhOn} /> Happy hour is on
              </label>
              <div className="grid grid-cols-[120px_1fr] gap-3">
                <Field label="Discount %" htmlFor="hh-pct">
                  <Input id="hh-pct" inputMode="numeric" value={percent} onChange={(e) => setPercent(e.target.value.replace(/[^\d]/g, "").slice(0, 2))} />
                </Field>
                <Field label="Name shown to guests" htmlFor="hh-label">
                  <Input id="hh-label" maxLength={40} value={hhLabel} onChange={(e) => setHhLabel(e.target.value)} />
                </Field>
              </div>
              <AvailabilityEditor value={{ ...win, timed: true }} onChange={(v) => setWin({ ...v, timed: true })} label="When" />
            </div>
          )}
        </SectionCard>
      </div>
      <Coupons {...props} />
    </div>
  );
}

function Coupons(props: { restaurantId: string; currency: string; couponsAllowed: boolean; coupons: CouponRow[] }) {
  const router = useRouter();
  const [form, setForm] = useState({ code: "", kind: "percent" as "percent" | "amount", value: "10", minOrder: "", expiresAt: "", maxUses: "" });
  const [pending, start] = useTransition();
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));
  const describe = (c: CouponRow) =>
    `${c.kind === "percent" ? `${c.value}% off` : `${formatMoney(c.value, props.currency)} off`}${c.minOrderMinor ? ` · min ${formatMoney(c.minOrderMinor, props.currency)}` : ""}${c.expiresAt ? ` · until ${c.expiresAt}` : ""}${c.maxUses ? ` · ${c.uses}/${c.maxUses} used` : ` · ${c.uses} used`}`;

  return (
    <SectionCard title="Coupon codes" description="Guests type a code in their cart. The discount is checked on the server, so it can't be faked.">
      {!props.couponsAllowed ? (
        <p className="text-sm">Coupon codes are part of Pro. <Link href="/dashboard/billing" className="font-medium text-primary underline">See Pro</Link></p>
      ) : (
        <div className="space-y-5">
          <form
            className="grid gap-3 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              start(async () => {
                const res = await createCoupon(props.restaurantId, form);
                if (!res.ok) toast.error(res.error);
                else {
                  toast.success(`Code ${form.code.toUpperCase()} created`);
                  setForm((f) => ({ ...f, code: "" }));
                  router.refresh();
                }
              });
            }}
          >
            <Field label="Code" htmlFor="c-code">
              <Input id="c-code" required value={form.code} onChange={(e) => set("code", e.target.value.toUpperCase().replace(/\s/g, "").slice(0, 20))} placeholder="WELCOME10" />
            </Field>
            <div className="grid grid-cols-[1fr_100px] gap-2">
              <Field label="Type" htmlFor="c-kind">
                <NativeSelect id="c-kind" value={form.kind} onChange={(e) => set("kind", e.target.value as "percent" | "amount")}>
                  <option value="percent">% off</option>
                  <option value="amount">Amount off ({props.currency})</option>
                </NativeSelect>
              </Field>
              <Field label="Value" htmlFor="c-val">
                <Input id="c-val" required inputMode="decimal" value={form.value} onChange={(e) => set("value", e.target.value)} />
              </Field>
            </div>
            <Field label={`Minimum order (${props.currency}, optional)`} htmlFor="c-min">
              <Input id="c-min" inputMode="decimal" value={form.minOrder} onChange={(e) => set("minOrder", e.target.value)} />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Expires (optional)" htmlFor="c-exp">
                <Input id="c-exp" type="date" value={form.expiresAt} onChange={(e) => set("expiresAt", e.target.value)} />
              </Field>
              <Field label="Max uses" htmlFor="c-max">
                <Input id="c-max" inputMode="numeric" value={form.maxUses} onChange={(e) => set("maxUses", e.target.value.replace(/[^\d]/g, ""))} placeholder="∞" />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={pending}>{pending ? <Loader2Icon className="animate-spin" /> : <PlusIcon />} Create code</Button>
            </div>
          </form>
          {props.coupons.length === 0 ? (
            <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">No codes yet.</p>
          ) : (
            <ul className="divide-y rounded-xl border">
              {props.coupons.map((c) => (
                <li key={c.id} className="flex items-center gap-3 px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-sm font-semibold">{c.code}</p>
                    <p className="truncate text-xs text-muted-foreground">{describe(c)}</p>
                  </div>
                  <Switch
                    checked={c.active}
                    aria-label={`${c.code} active`}
                    onCheckedChange={(v) =>
                      start(async () => {
                        const res = await setCouponActive(props.restaurantId, c.id, v);
                        if (!res.ok) toast.error(res.error);
                        router.refresh();
                      })
                    }
                  />
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`Delete ${c.code}`}
                    onClick={() =>
                      confirm(`Delete code ${c.code}?`) &&
                      start(async () => {
                        const res = await deleteCoupon(props.restaurantId, c.id);
                        if (!res.ok) toast.error(res.error);
                        router.refresh();
                      })
                    }
                  >
                    <Trash2Icon />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </SectionCard>
  );
}
