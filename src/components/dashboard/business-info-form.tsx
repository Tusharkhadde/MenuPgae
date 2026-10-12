"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CopyIcon, Loader2Icon, PlusIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { NativeSelect } from "@/components/ui/native-select";
import { Field, SectionCard } from "@/components/dashboard/field";
import { CURRENCIES } from "@/lib/money";
import { DAYS, DAY_LABELS, type WeeklyHours } from "@/lib/hours";
import { updateBusinessInfo } from "@/server/actions/restaurant";
import { allTimezones } from "@/components/dashboard/locale-defaults";

type FormState = {
  name: string;
  tagline: string;
  description: string;
  cuisine: string;
  phone: string;
  whatsapp: string;
  whatsappOrdering: boolean;
  instagram: string;
  address: string;
  mapsUrl: string;
  googleReviewsUrl: string;
  swiggyUrl: string;
  zomatoUrl: string;
  uberEatsUrl: string;
  currency: string;
  timezone: string;
  hoursEnabled: boolean;
  hours: WeeklyHours;
};

export function BusinessInfoForm({ restaurantId, initial }: { restaurantId: string; initial: FormState }) {
  const router = useRouter();
  const [f, setF] = useState(initial);
  const [pending, start] = useTransition();
  const timezones = useMemo(() => allTimezones(), []);
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((s) => ({ ...s, [k]: v }));
  const text = (k: keyof FormState) => ({
    value: f[k] as string,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => set(k, e.target.value as never),
  });

  const setDay = (day: (typeof DAYS)[number], v: WeeklyHours[typeof day]) => set("hours", { ...f.hours, [day]: v });

  function save(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const { hoursEnabled, hours, ...rest } = f;
      const res = await updateBusinessInfo(restaurantId, { ...rest, hours: hoursEnabled ? hours : null });
      if (!res.ok) toast.error(res.error);
      else {
        toast.success("Saved — your live page is updated.");
        router.refresh();
      }
    });
  }

  const saveBar = (
    <Button type="submit" disabled={pending}>
      {pending && <Loader2Icon className="animate-spin" />} Save changes
    </Button>
  );

  return (
    <form onSubmit={save} className="grid gap-6 lg:grid-cols-[1fr_1fr]">
      <div className="space-y-6">
        <SectionCard title="Basics" description="How your restaurant appears at the top of your page." footer={saveBar}>
          <Field label="Name" htmlFor="name"><Input id="name" required maxLength={80} {...text("name")} /></Field>
          <Field label="Tagline" htmlFor="tagline" hint="One line under your name."><Input id="tagline" maxLength={120} {...text("tagline")} placeholder="Wood-fired pizza since 2015" /></Field>
          <Field label="Cuisine / type" htmlFor="cuisine"><Input id="cuisine" maxLength={60} {...text("cuisine")} placeholder="Italian · Pizzeria" /></Field>
          <Field label="About" htmlFor="description" hint="A short story, specialities, seating, parking…"><Textarea id="description" rows={4} maxLength={600} {...text("description")} /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Currency" htmlFor="currency" hint="Existing prices keep their numbers.">
              <NativeSelect id="currency" value={f.currency} onChange={(e) => set("currency", e.target.value)}>
                {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
              </NativeSelect>
            </Field>
            <Field label="Timezone" htmlFor="timezone">
              <NativeSelect id="timezone" value={f.timezone} onChange={(e) => set("timezone", e.target.value)}>
                {timezones.includes(f.timezone) ? null : <option value={f.timezone}>{f.timezone}</option>}
                {timezones.map((tz) => <option key={tz} value={tz}>{tz.replace(/_/g, " ")}</option>)}
              </NativeSelect>
            </Field>
          </div>
        </SectionCard>

        <SectionCard title="Contact & ordering" footer={saveBar}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Phone" htmlFor="phone"><Input id="phone" inputMode="tel" {...text("phone")} placeholder="+91 20 1234 5678" /></Field>
            <Field label="WhatsApp" htmlFor="whatsapp" hint="With country code."><Input id="whatsapp" inputMode="tel" {...text("whatsapp")} placeholder="+91 98765 43210" /></Field>
          </div>
          <label className="flex items-center justify-between gap-4 rounded-xl border p-3.5">
            <span>
              <span className="block text-sm font-medium">WhatsApp ordering</span>
              <span className="block text-xs text-muted-foreground">Guests can build a cart and send the order to your WhatsApp.</span>
            </span>
            <Switch checked={f.whatsappOrdering} onCheckedChange={(v) => set("whatsappOrdering", v)} />
          </label>
          <Field label="Instagram" htmlFor="instagram"><Input id="instagram" {...text("instagram")} placeholder="@yourcafe" /></Field>
        </SectionCard>

        <SectionCard title="Location & links" footer={saveBar}>
          <Field label="Address" htmlFor="address"><Textarea id="address" rows={2} maxLength={300} {...text("address")} /></Field>
          <Field label="Google Maps link" htmlFor="mapsUrl" hint="Open your place in Google Maps → Share → Copy link."><Input id="mapsUrl" {...text("mapsUrl")} placeholder="https://maps.app.goo.gl/…" /></Field>
          <Field label="Google reviews link" htmlFor="googleReviewsUrl" hint="From your Google Business Profile → “Ask for reviews”."><Input id="googleReviewsUrl" {...text("googleReviewsUrl")} placeholder="https://g.page/r/…/review" /></Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Swiggy" htmlFor="swiggyUrl"><Input id="swiggyUrl" {...text("swiggyUrl")} placeholder="Optional" /></Field>
            <Field label="Zomato" htmlFor="zomatoUrl"><Input id="zomatoUrl" {...text("zomatoUrl")} placeholder="Optional" /></Field>
            <Field label="Uber Eats" htmlFor="uberEatsUrl"><Input id="uberEatsUrl" {...text("uberEatsUrl")} placeholder="Optional" /></Field>
          </div>
        </SectionCard>
      </div>

      <div className="space-y-6">
        <SectionCard title="Opening hours" description="Powers the “Open now” badge, in your restaurant's timezone. Late nights past midnight work too (e.g. 18:00–02:00)." footer={saveBar}>
          <label className="flex items-center justify-between gap-4">
            <span className="text-sm font-medium">Show opening hours</span>
            <Switch checked={f.hoursEnabled} onCheckedChange={(v) => set("hoursEnabled", v)} />
          </label>
          {f.hoursEnabled && (
            <div className="divide-y rounded-xl border">
              {DAYS.map((d) => {
                const day = f.hours[d];
                return (
                  <div key={d} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                    <div className="flex w-32 items-center gap-2">
                      <Switch checked={!day.closed} onCheckedChange={(open) => setDay(d, { closed: !open, ranges: open && day.ranges.length === 0 ? [{ open: "11:00", close: "22:00" }] : day.ranges })} aria-label={`Open on ${DAY_LABELS[d]}`} />
                      <span className="text-sm">{DAY_LABELS[d].slice(0, 3)}</span>
                    </div>
                    {day.closed ? (
                      <span className="text-sm text-muted-foreground">Closed</span>
                    ) : (
                      <div className="flex flex-1 flex-col gap-1.5">
                        {day.ranges.map((r, i) => (
                          <div key={i} className="flex items-center gap-1.5">
                            <Input type="time" className="h-8 w-[7.5rem]" value={r.open} onChange={(e) => setDay(d, { ...day, ranges: day.ranges.map((x, j) => (j === i ? { ...x, open: e.target.value } : x)) })} aria-label="Opens" />
                            <span className="text-muted-foreground">–</span>
                            <Input type="time" className="h-8 w-[7.5rem]" value={r.close} onChange={(e) => setDay(d, { ...day, ranges: day.ranges.map((x, j) => (j === i ? { ...x, close: e.target.value } : x)) })} aria-label="Closes" />
                            {day.ranges.length > 1 && (
                              <Button type="button" variant="ghost" size="icon-sm" onClick={() => setDay(d, { ...day, ranges: day.ranges.filter((_, j) => j !== i) })} aria-label="Remove time range"><XIcon /></Button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    {!day.closed && (
                      <div className="ml-auto flex gap-1">
                        {day.ranges.length < 3 && (
                          <Button type="button" variant="ghost" size="icon-sm" onClick={() => setDay(d, { ...day, ranges: [...day.ranges, { open: "18:00", close: "23:00" }] })} aria-label="Add a split shift"><PlusIcon /></Button>
                        )}
                        <Button type="button" variant="ghost" size="icon-sm" title="Copy to all days" aria-label="Copy to all days" onClick={() => set("hours", Object.fromEntries(DAYS.map((x) => [x, { closed: day.closed, ranges: day.ranges.map((r) => ({ ...r })) }])) as WeeklyHours)}><CopyIcon /></Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>
      </div>
    </form>
  );
}
