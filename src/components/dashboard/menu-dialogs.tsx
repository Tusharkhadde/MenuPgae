"use client";

import { useState, useTransition } from "react";
import { Loader2Icon } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { NativeSelect } from "@/components/ui/native-select";
import { Field } from "@/components/dashboard/field";
import { ImageUpload } from "@/components/dashboard/image-upload";
import { DietDot } from "@/components/menu/diet-dot";
import { upsertCategory, upsertItem } from "@/server/actions/menu";
import { ALLERGENS, DIETS } from "@/lib/validation";
import { minorToInput, parsePriceToMinor } from "@/lib/money";
import type { ItemOptions } from "@/lib/options";
import type { Availability } from "@/lib/schedule";
import { AvailabilityEditor, OptionsEditor, type DraftAvailability, type DraftOptions } from "@/components/dashboard/menu-options-editor";
import type { EditorCategory, EditorItem } from "@/components/dashboard/menu-editor";
import type { Diet } from "@/lib/db/schema";
import { cn } from "@/lib/utils";

const DIET_TEXT: Record<Diet, string> = { veg: "Veg", nonveg: "Non-veg", vegan: "Vegan", egg: "Egg" };

function toDraftAvailability(a: Availability | null | undefined): DraftAvailability {
  return { days: a?.days ?? [], timed: !!(a?.from && a?.to), from: a?.from ?? "08:00", to: a?.to ?? "11:30" };
}

function fromDraftAvailability(d: DraftAvailability, enabled: boolean): Availability | null {
  if (!enabled) return null;
  const days = d.days.length && d.days.length < 7 ? d.days : undefined;
  if (!days && !d.timed) return null;
  return { ...(days ? { days } : {}), ...(d.timed ? { from: d.from, to: d.to } : {}) };
}

function toDraftOptions(o: ItemOptions | null | undefined, currency: string): DraftOptions {
  return {
    variants: (o?.variants ?? []).map((v) => ({ id: v.id, name: v.name, price: minorToInput(v.priceMinor, currency) })),
    groups: (o?.groups ?? []).map((g) => ({ ...g, options: g.options.map((x) => ({ id: x.id, name: x.name, price: x.priceMinor ? minorToInput(x.priceMinor, currency) : "" })) })),
  };
}

function fromDraftOptions(d: DraftOptions, currency: string): { ok: true; value: ItemOptions | null } | { ok: false; error: string } {
  const variants = [];
  for (const v of d.variants) {
    const p = parsePriceToMinor(v.price, currency);
    if (!v.name.trim()) return { ok: false, error: "Give every size a name." };
    if (p === null) return { ok: false, error: `Enter a price for size “${v.name}”.` };
    variants.push({ id: v.id, name: v.name.trim(), priceMinor: p });
  }
  const groups = [];
  for (const g of d.groups) {
    if (!g.name.trim()) return { ok: false, error: "Give every add-on group a name." };
    const options = [];
    for (const o of g.options) {
      if (!o.name.trim()) return { ok: false, error: `Name every option in “${g.name}”.` };
      const p = o.price.trim() ? parsePriceToMinor(o.price, currency) : 0;
      if (p === null) return { ok: false, error: `Invalid price for “${o.name}”.` };
      options.push({ id: o.id, name: o.name.trim(), priceMinor: p });
    }
    groups.push({ id: g.id, name: g.name.trim(), min: Math.min(g.min, options.length), max: Math.max(1, Math.min(g.max, options.length)), options });
  }
  return { ok: true, value: variants.length || groups.length ? { variants, groups } : null };
}

export function CategoryDialog(props: {
  restaurantId: string;
  open: boolean;
  category?: EditorCategory;
  onOpenChange: (o: boolean) => void;
  onSaved: () => void;
}) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent>
        {props.open && <CategoryForm key={props.category?.id ?? "new"} {...props} />}
      </DialogContent>
    </Dialog>
  );
}

function CategoryForm(props: { restaurantId: string; category?: EditorCategory; onOpenChange: (o: boolean) => void; onSaved: () => void }) {
  const [name, setName] = useState(props.category?.name ?? "");
  const [description, setDescription] = useState(props.category?.description ?? "");
  const [scheduled, setScheduled] = useState(!!props.category?.availability);
  const [avail, setAvail] = useState(toDraftAvailability(props.category?.availability));
  const [pending, start] = useTransition();
  const save = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      const res = await upsertCategory(props.restaurantId, { id: props.category?.id, name, description, availability: fromDraftAvailability(avail, scheduled) });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      props.onOpenChange(false);
      props.onSaved();
    });
  };
  return (
    <form onSubmit={save}>
      <DialogHeader>
        <DialogTitle>{props.category ? "Edit category" : "New category"}</DialogTitle>
        <DialogDescription>Categories group your dishes, e.g. “Starters”, “Mains”, “Drinks”.</DialogDescription>
      </DialogHeader>
      <div className="my-5 space-y-4">
        <Field label="Name" htmlFor="cat-name">
          <Input id="cat-name" autoFocus required maxLength={60} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Description (optional)" htmlFor="cat-desc">
          <Input id="cat-desc" maxLength={200} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Served 8 am – 12 pm" />
        </Field>
        <ToggleRow label="Timed menu" hint="Breakfast, lunch, dinner or weekend-only sections" checked={scheduled} onChange={setScheduled} />
        {scheduled && <AvailabilityEditor value={avail} onChange={setAvail} label="When this section can be ordered" />}
      </div>
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={() => props.onOpenChange(false)}>Cancel</Button>
        <Button type="submit" disabled={pending || !name.trim()}>{pending && <Loader2Icon className="animate-spin" />} Save</Button>
      </DialogFooter>
    </form>
  );
}

export function ItemDialog(props: {
  restaurantId: string;
  currency: string;
  categories: { id: string; name: string }[];
  open: boolean;
  item?: EditorItem;
  defaultCategoryId?: string;
  onOpenChange: (o: boolean) => void;
  onSaved: () => void;
  happyHourAllowed: boolean;
}) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-xl">{props.open && <ItemForm {...props} />}</DialogContent>
    </Dialog>
  );
}

function ItemForm(props: {
  restaurantId: string;
  currency: string;
  categories: { id: string; name: string }[];
  item?: EditorItem;
  defaultCategoryId?: string;
  onOpenChange: (o: boolean) => void;
  onSaved: () => void;
  happyHourAllowed: boolean;
}) {
  const it = props.item;
  const [form, setForm] = useState({
    categoryId: it?.categoryId ?? props.defaultCategoryId ?? props.categories[0]?.id ?? "",
    name: it?.name ?? "",
    description: it?.description ?? "",
    price: it ? minorToInput(it.priceMinor, props.currency) : "",
    imageUrl: it?.imageUrl ?? null,
    diet: (it?.diet ?? null) as Diet | null,
    spicy: it?.spicy ?? 0,
    allergens: it?.allergens ?? [],
    bestseller: it?.bestseller ?? false,
    soldOut: it?.soldOut ?? false,
    special: it?.special ?? false,
    happyHour: it?.happyHour ?? false,
    calories: it?.calories != null ? String(it.calories) : "",
    nutrition: it?.nutrition ?? "",
  });
  const [opts, setOpts] = useState<DraftOptions>(toDraftOptions(it?.options, props.currency));
  const [showOpts, setShowOpts] = useState(!!it?.options);
  const [scheduled, setScheduled] = useState(!!it?.availability);
  const [avail, setAvail] = useState(toDraftAvailability(it?.availability));
  const [pending, start] = useTransition();
  const [upgrade, setUpgrade] = useState(false);
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      const o = fromDraftOptions(showOpts ? opts : { variants: [], groups: [] }, props.currency);
      if (!o.ok) {
        toast.error(o.error);
        return;
      }
      // With sizes, the base price is the smallest size (used for "from ₹X" and sorting).
      const price = o.value?.variants.length ? minorToInput(Math.min(...o.value.variants.map((v) => v.priceMinor)), props.currency) : form.price;
      const res = await upsertItem(props.restaurantId, { id: it?.id, ...form, price, options: o.value, availability: fromDraftAvailability(avail, scheduled) });
      if (!res.ok) {
        toast.error(res.error);
        setUpgrade(!!res.upgrade);
        return;
      }
      toast.success(it ? "Saved" : "Item added");
      props.onOpenChange(false);
      props.onSaved();
    });
  };

  return (
    <form onSubmit={save}>
      <DialogHeader>
        <DialogTitle>{it ? "Edit item" : "New item"}</DialogTitle>
      </DialogHeader>
      <div className="my-5 space-y-4">
        <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
          <Field label="Name" htmlFor="item-name">
            <Input id="item-name" autoFocus required maxLength={100} value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Masala Dosa" />
          </Field>
          <Field label={`Price (${props.currency})`} htmlFor="item-price">
            <Input
              id="item-price"
              required={!(showOpts && opts.variants.length)}
              disabled={showOpts && opts.variants.length > 0}
              inputMode="decimal"
              value={showOpts && opts.variants.length ? "" : form.price}
              onChange={(e) => set("price", e.target.value)}
              placeholder={showOpts && opts.variants.length ? "Set per size" : "149"}
            />
          </Field>
        </div>
        <Field label="Description (optional)" htmlFor="item-desc">
          <Textarea id="item-desc" rows={2} maxLength={400} value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Crispy rice crepe, potato masala, sambar & chutneys" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Category" htmlFor="item-cat">
            <NativeSelect id="item-cat" value={form.categoryId} onChange={(e) => set("categoryId", e.target.value)}>
              {props.categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Photo (optional)">
            <ImageUpload value={form.imageUrl} onChange={(u) => set("imageUrl", u)} restaurantId={props.restaurantId} label="Upload photo" />
          </Field>
        </div>
        <Field label="Food type">
          <div className="flex flex-wrap gap-1.5">
            <Chip active={form.diet === null} onClick={() => set("diet", null)}>Not set</Chip>
            {DIETS.map((d) => (
              <Chip key={d} active={form.diet === d} onClick={() => set("diet", d)}>
                <DietDot diet={d} size="sm" /> {DIET_TEXT[d]}
              </Chip>
            ))}
          </div>
        </Field>
        <Field label="Spice level">
          <div className="flex flex-wrap gap-1.5">
            {["None", "Mild", "Medium", "Hot"].map((label, i) => (
              <Chip key={label} active={form.spicy === i} onClick={() => set("spicy", i)}>
                {"🌶".repeat(i)} {label}
              </Chip>
            ))}
          </div>
        </Field>
        <Field label="Allergens">
          <div className="flex flex-wrap gap-1.5">
            {ALLERGENS.map((a) => {
              const on = form.allergens.includes(a);
              return (
                <Chip key={a} active={on} onClick={() => set("allergens", on ? form.allergens.filter((x) => x !== a) : [...form.allergens, a])}>
                  {a}
                </Chip>
              );
            })}
          </div>
        </Field>
        <div className="grid gap-4 sm:grid-cols-[120px_1fr]">
          <Field label="Calories (kcal)" htmlFor="item-kcal">
            <Input id="item-kcal" inputMode="numeric" value={form.calories} onChange={(e) => set("calories", e.target.value.replace(/[^\d]/g, "").slice(0, 4))} placeholder="350" />
          </Field>
          <Field label="Nutrition (optional)" htmlFor="item-nutrition">
            <Input id="item-nutrition" maxLength={120} value={form.nutrition} onChange={(e) => set("nutrition", e.target.value)} placeholder="Protein 12g · Carbs 40g · Fat 9g" />
          </Field>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <ToggleRow label="Bestseller" hint="Highlighted on your menu" checked={form.bestseller} onChange={(v) => set("bestseller", v)} />
          <ToggleRow label="Sold out" hint="Shown but can't be ordered" checked={form.soldOut} onChange={(v) => set("soldOut", v)} />
          <ToggleRow label="Today's special" hint="Pinned to the top of your menu" checked={form.special} onChange={(v) => set("special", v)} />
          <ToggleRow
            label="Happy hour"
            hint={props.happyHourAllowed ? "Discounted during happy hour" : "Pro — set the window in Promotions"}
            checked={form.happyHour}
            onChange={(v) => set("happyHour", v)}
          />
        </div>
        <ToggleRow label="Sizes & add-ons" hint="Half/Full, S/M/L, extra toppings, choices" checked={showOpts} onChange={setShowOpts} />
        {showOpts && <OptionsEditor value={opts} onChange={setOpts} currency={props.currency} />}
        <ToggleRow label="Schedule" hint="Only orderable on some days or hours" checked={scheduled} onChange={setScheduled} />
        {scheduled && <AvailabilityEditor value={avail} onChange={setAvail} label="When this dish can be ordered" />}
        {upgrade && (
          <p className="rounded-lg bg-accent px-3 py-2 text-sm">
            Need more room? <Link href="/dashboard/billing" className="font-medium text-primary underline">Upgrade to Pro</Link>
          </p>
        )}
      </div>
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={() => props.onOpenChange(false)}>Cancel</Button>
        <Button type="submit" disabled={pending}>{pending && <Loader2Icon className="animate-spin" />} {it ? "Save changes" : "Add item"}</Button>
      </DialogFooter>
    </form>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium capitalize transition-colors",
        active ? "border-primary bg-primary text-primary-foreground" : "hover:border-foreground/30",
      )}
    >
      {children}
    </button>
  );
}

function ToggleRow({ label, hint, checked, onChange }: { label: string; hint: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5">
      <span>
        <span className="block text-sm font-medium">{label}</span>
        <span className="block text-xs text-muted-foreground">{hint}</span>
      </span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  );
}
