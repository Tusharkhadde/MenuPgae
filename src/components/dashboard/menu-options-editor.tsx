"use client";

import { PlusIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { newOptionId } from "@/lib/options";
import { DAY_SHORT } from "@/lib/schedule";
import { cn } from "@/lib/utils";

/** Editor-side shapes: prices are typed strings until save. */
export type DraftVariant = { id: string; name: string; price: string };
export type DraftOption = { id: string; name: string; price: string };
export type DraftGroup = { id: string; name: string; min: number; max: number; options: DraftOption[] };
export type DraftOptions = { variants: DraftVariant[]; groups: DraftGroup[] };

export function OptionsEditor({ value, onChange, currency }: { value: DraftOptions; onChange: (v: DraftOptions) => void; currency: string }) {
  const setVariants = (variants: DraftVariant[]) => onChange({ ...value, variants });
  const setGroups = (groups: DraftGroup[]) => onChange({ ...value, groups });
  const setGroup = (i: number, patch: Partial<DraftGroup>) => setGroups(value.groups.map((g, j) => (j === i ? { ...g, ...patch } : g)));

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Sizes</p>
          {value.variants.length === 0 && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setVariants([{ id: newOptionId(), name: "Half", price: "" }, { id: newOptionId(), name: "Full", price: "" }])}
            >
              <PlusIcon /> Add sizes
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">E.g. Half / Full or S / M / L — each with its own price. Guests must pick one.</p>
        {value.variants.length > 0 && (
          <div className="mt-2 space-y-2">
            {value.variants.map((v, i) => (
              <div key={v.id} className="grid grid-cols-[1fr_110px_auto] gap-2">
                <Input aria-label={`Size ${i + 1} name`} value={v.name} maxLength={40} placeholder="Size name" onChange={(e) => setVariants(value.variants.map((x) => (x.id === v.id ? { ...x, name: e.target.value } : x)))} />
                <Input aria-label={`Size ${i + 1} price (${currency})`} value={v.price} inputMode="decimal" placeholder={currency} onChange={(e) => setVariants(value.variants.map((x) => (x.id === v.id ? { ...x, price: e.target.value } : x)))} />
                <Button type="button" size="icon" variant="ghost" aria-label={`Remove size ${v.name}`} onClick={() => setVariants(value.variants.length <= 2 ? [] : value.variants.filter((x) => x.id !== v.id))}>
                  <Trash2Icon />
                </Button>
              </div>
            ))}
            {value.variants.length < 8 && (
              <Button type="button" size="sm" variant="outline" onClick={() => setVariants([...value.variants, { id: newOptionId(), name: "", price: "" }])}>
                <PlusIcon /> Another size
              </Button>
            )}
          </div>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Add-ons & choices</p>
          {value.groups.length < 8 && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setGroups([...value.groups, { id: newOptionId(), name: "", min: 0, max: 3, options: [{ id: newOptionId(), name: "", price: "" }] }])}
            >
              <PlusIcon /> Add group
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">E.g. “Extra toppings” (optional, up to 3) or “Choose bread” (required, pick 1).</p>
        <div className="mt-2 space-y-3">
          {value.groups.map((g, i) => (
            <div key={g.id} className="rounded-xl border p-3">
              <div className="flex gap-2">
                <Input aria-label="Group name" value={g.name} maxLength={60} placeholder="Group name, e.g. Extra toppings" onChange={(e) => setGroup(i, { name: e.target.value })} />
                <Button type="button" size="icon" variant="ghost" aria-label={`Remove group ${g.name}`} onClick={() => setGroups(value.groups.filter((x) => x.id !== g.id))}>
                  <Trash2Icon />
                </Button>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
                <label className="flex items-center gap-2">
                  <Switch checked={g.min > 0} onCheckedChange={(v) => setGroup(i, { min: v ? 1 : 0, max: Math.max(g.max, 1) })} aria-label="Required" /> Required
                </label>
                {g.min > 0 && (
                  <label className="flex items-center gap-1.5">
                    Min
                    <Input type="number" min={1} max={20} value={g.min} onChange={(e) => setGroup(i, { min: Math.max(1, Math.min(20, Number(e.target.value) || 1)) })} className="h-8 w-16" />
                  </label>
                )}
                <label className="flex items-center gap-1.5">
                  Max
                  <Input type="number" min={1} max={20} value={g.max} onChange={(e) => setGroup(i, { max: Math.max(1, Math.min(20, Number(e.target.value) || 1)) })} className="h-8 w-16" />
                </label>
              </div>
              <div className="mt-2 space-y-2">
                {g.options.map((o, k) => (
                  <div key={o.id} className="grid grid-cols-[1fr_100px_auto] gap-2">
                    <Input aria-label={`Option ${k + 1} name`} value={o.name} maxLength={60} placeholder="Option, e.g. Extra cheese" onChange={(e) => setGroup(i, { options: g.options.map((x) => (x.id === o.id ? { ...x, name: e.target.value } : x)) })} />
                    <Input aria-label={`Option ${k + 1} extra price`} value={o.price} inputMode="decimal" placeholder={`+ ${currency}`} onChange={(e) => setGroup(i, { options: g.options.map((x) => (x.id === o.id ? { ...x, price: e.target.value } : x)) })} />
                    <Button type="button" size="icon" variant="ghost" aria-label={`Remove option ${o.name}`} disabled={g.options.length <= 1} onClick={() => setGroup(i, { options: g.options.filter((x) => x.id !== o.id) })}>
                      <Trash2Icon />
                    </Button>
                  </div>
                ))}
                {g.options.length < 30 && (
                  <Button type="button" size="sm" variant="outline" onClick={() => setGroup(i, { options: [...g.options, { id: newOptionId(), name: "", price: "" }] })}>
                    <PlusIcon /> Option
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export type DraftAvailability = { days: number[]; timed: boolean; from: string; to: string };

export function AvailabilityEditor({ value, onChange, label = "Only available at certain times" }: { value: DraftAvailability; onChange: (v: DraftAvailability) => void; label?: string }) {
  const allDays = value.days.length === 0 || value.days.length === 7;
  return (
    <div className="space-y-3 rounded-xl border p-3">
      <p className="text-sm font-medium">{label}</p>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Days">
        {DAY_SHORT.map((d, i) => {
          const on = allDays || value.days.includes(i);
          return (
            <button
              key={d}
              type="button"
              aria-pressed={on}
              onClick={() => {
                const current = allDays ? [0, 1, 2, 3, 4, 5, 6] : value.days;
                const next = current.includes(i) ? current.filter((x) => x !== i) : [...current, i].sort();
                onChange({ ...value, days: next.length === 7 ? [] : next });
              }}
              className={cn("h-8 min-w-11 rounded-lg border px-2 text-xs font-medium", on ? "border-primary bg-primary text-primary-foreground" : "hover:border-foreground/30")}
            >
              {d}
            </button>
          );
        })}
      </div>
      <label className="flex items-center gap-2 text-sm">
        <Switch checked={value.timed} onCheckedChange={(v) => onChange({ ...value, timed: v })} aria-label="Limit to a time window" /> Limit to a time window
      </label>
      {value.timed && (
        <div className="flex items-center gap-2 text-sm">
          <Input type="time" value={value.from} onChange={(e) => onChange({ ...value, from: e.target.value })} className="w-32" aria-label="From" />
          <span>to</span>
          <Input type="time" value={value.to} onChange={(e) => onChange({ ...value, to: e.target.value })} className="w-32" aria-label="To" />
        </div>
      )}
      <p className="text-xs text-muted-foreground">Uses your restaurant&apos;s timezone. Outside these times guests can see it but can&apos;t order it.</p>
    </div>
  );
}
