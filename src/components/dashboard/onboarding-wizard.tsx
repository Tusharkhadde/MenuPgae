"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeftIcon, ArrowRightIcon, CheckIcon, Loader2Icon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { NativeSelect } from "@/components/ui/native-select";
import { Field } from "@/components/dashboard/field";
import { ImageUpload } from "@/components/dashboard/image-upload";
import { CURRENCIES } from "@/lib/money";
import { slugify, validateSlug } from "@/lib/slug";
import { THEMES, THEME_IDS, type ThemeIdT } from "@/lib/themes";
import { checkSlugAvailable, createRestaurant } from "@/server/actions/restaurant";
import { allTimezones, currencyForTimezone, guessTimezone } from "@/components/dashboard/locale-defaults";
import { cn } from "@/lib/utils";

const STEPS = ["Basics", "Region", "Look & contact"] as const;

export function OnboardingWizard({ appHost }: { appHost: string }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [slugState, setSlugState] = useState<{ checking: boolean; ok: boolean | null; reason?: string }>({ checking: false, ok: null });
  const [cuisine, setCuisine] = useState("");
  const [timezone, setTimezone] = useState("Asia/Kolkata");
  const [currency, setCurrency] = useState("INR");
  const [theme, setTheme] = useState<ThemeIdT>("classic");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [whatsapp, setWhatsapp] = useState("");
  const [sampleMenu, setSampleMenu] = useState(true);
  const timezones = useMemo(() => allTimezones(), []);

  useEffect(() => {
    const tz = guessTimezone();
    /* eslint-disable react-hooks/set-state-in-effect -- browser locale is only known after mount */
    setTimezone(tz);
    setCurrency(currencyForTimezone(tz));
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  useEffect(() => {
    if (!slug) return;
    const local = validateSlug(slug);
    if (!local.ok) {
      setSlugState({ checking: false, ok: false, reason: local.reason }); // eslint-disable-line react-hooks/set-state-in-effect
      return;
    }
    setSlugState({ checking: true, ok: null });
    const t = setTimeout(async () => {
      const res = await checkSlugAvailable(slug);
      if (res.ok) setSlugState({ checking: false, ok: res.data.available, reason: res.data.reason });
      else setSlugState({ checking: false, ok: null });
    }, 350);
    return () => clearTimeout(t);
  }, [slug]);

  const canNext = step === 0 ? name.trim().length >= 2 && slugState.ok === true : true;

  function submit() {
    startTransition(async () => {
      const res = await createRestaurant({ name, slug, cuisine, currency, timezone, theme, whatsapp, logoUrl, coverUrl, sampleMenu });
      if (!res.ok) {
        toast.error(res.error);
        if (res.error.toLowerCase().includes("address")) setStep(0);
        return;
      }
      toast.success("Your page is live!");
      router.push(`/dashboard/r/${res.data.id}/menu?welcome=1`);
    });
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-10 sm:py-16">
      <div className="mb-8">
        <p className="text-sm font-medium text-primary">Step {step + 1} of {STEPS.length}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Let&apos;s set up your MenuPage</h1>
        <div className="mt-5 flex gap-2">
          {STEPS.map((s, i) => (
            <div key={s} className="flex-1">
              <div className={cn("h-1.5 rounded-full transition-colors", i <= step ? "bg-primary" : "bg-border")} />
              <p className={cn("mt-2 text-xs", i === step ? "font-medium" : "text-muted-foreground")}>{s}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border bg-card p-6 shadow-sm">
        {step === 0 && (
          <div className="space-y-5">
            <Field label="Restaurant name" htmlFor="name">
              <Input
                id="name"
                autoFocus
                value={name}
                maxLength={80}
                placeholder="e.g. Chai & Crumbs"
                onChange={(e) => {
                  setName(e.target.value);
                  if (!slugTouched) setSlug(slugify(e.target.value));
                }}
              />
            </Field>
            <Field
              label="Your page address"
              htmlFor="slug"
              error={slug && slugState.ok === false ? slugState.reason : null}
              hint={
                slugState.checking ? "Checking…" : slugState.ok ? (
                  <span className="inline-flex items-center gap-1 text-emerald-600"><CheckIcon className="size-3" /> Available</span>
                ) : "Lowercase letters, numbers and dashes."
              }
            >
              <div className="flex items-center overflow-hidden rounded-lg border border-input focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
                <span className="whitespace-nowrap border-r bg-muted px-2.5 py-1.5 text-sm text-muted-foreground">{appHost}/r/</span>
                <input
                  id="slug"
                  value={slug}
                  maxLength={40}
                  onChange={(e) => {
                    setSlugTouched(true);
                    setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""));
                  }}
                  className="h-9 w-full bg-transparent px-2.5 text-sm outline-none"
                />
              </div>
            </Field>
            <Field label="Cuisine or type (optional)" htmlFor="cuisine" hint="Shown under your name, e.g. “Café · Bakery” or “South Indian”.">
              <Input id="cuisine" value={cuisine} maxLength={60} onChange={(e) => setCuisine(e.target.value)} placeholder="Café · Street food" />
            </Field>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-5">
            <Field label="Currency" htmlFor="currency" hint="Used for every price on your menu.">
              <NativeSelect id="currency" value={currency} onChange={(e) => setCurrency(e.target.value)}>
                {CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>{c.label}</option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Timezone" htmlFor="tz" hint="Used for the “Open now” badge.">
              <NativeSelect id="tz" value={timezone} onChange={(e) => setTimezone(e.target.value)}>
                {timezones.map((tz) => (
                  <option key={tz} value={tz}>{tz.replace(/_/g, " ")}</option>
                ))}
              </NativeSelect>
            </Field>
            <div className="flex items-start justify-between gap-4 rounded-xl border p-4">
              <div>
                <p className="text-sm font-medium">Start with a sample menu</p>
                <p className="text-xs text-muted-foreground">We&apos;ll add example categories and dishes you can edit or delete.</p>
              </div>
              <Switch checked={sampleMenu} onCheckedChange={setSampleMenu} aria-label="Start with a sample menu" />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <Field label="Theme">
              <div className="grid grid-cols-2 gap-2">
                {THEME_IDS.map((id) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setTheme(id)}
                    className={cn("rounded-xl border p-3 text-left transition-colors", theme === id ? "border-primary ring-2 ring-primary/30" : "hover:border-foreground/20")}
                  >
                    <div className="flex gap-1">
                      {THEMES[id].swatch.map((c) => (
                        <span key={c} className="size-4 rounded-full border border-black/10" style={{ background: c }} />
                      ))}
                    </div>
                    <p className="mt-2 text-sm font-medium">{THEMES[id].name}</p>
                    <p className="text-xs text-muted-foreground">{THEMES[id].description}</p>
                  </button>
                ))}
              </div>
            </Field>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Logo (optional)">
                <ImageUpload value={logoUrl} onChange={setLogoUrl} label="Upload logo" />
              </Field>
              <Field label="Cover photo (optional)">
                <ImageUpload value={coverUrl} onChange={setCoverUrl} label="Upload cover" aspect="wide" />
              </Field>
            </div>
            <Field label="WhatsApp number for orders (optional)" htmlFor="wa" hint="With country code, e.g. +91 98765 43210. Guests' orders arrive here.">
              <Input id="wa" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="+91 98765 43210" inputMode="tel" />
            </Field>
          </div>
        )}

        <div className="mt-8 flex items-center justify-between">
          <Button variant="ghost" onClick={() => setStep((s) => s - 1)} disabled={step === 0 || pending}>
            <ArrowLeftIcon /> Back
          </Button>
          {step < STEPS.length - 1 ? (
            <Button onClick={() => setStep((s) => s + 1)} disabled={!canNext}>
              Continue <ArrowRightIcon />
            </Button>
          ) : (
            <Button onClick={submit} disabled={pending}>
              {pending ? <Loader2Icon className="animate-spin" /> : <CheckIcon />} Create my page
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
