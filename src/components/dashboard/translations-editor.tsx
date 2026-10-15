"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeftIcon, Loader2Icon, SparklesIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SectionCard } from "@/components/dashboard/field";
import { MENU_LANGUAGES, languageInfo, type Translations } from "@/lib/languages";
import { autoTranslate, saveLanguages, saveTranslations } from "@/server/actions/growth";
import type { PlanId } from "@/config/plans";
import { cn } from "@/lib/utils";

type Row = { id: string; name: string; description: string | null; translations: Translations };
type Cat = Row & { items: Row[] };

export function TranslationsEditor(props: {
  restaurantId: string;
  isOwner: boolean;
  languages: string[];
  maxLanguages: number;
  plan: PlanId;
  aiAvailable: boolean;
  categories: Cat[];
}) {
  const [langs, setLangs] = useState(props.languages);
  const [active, setActive] = useState(props.languages[0] ?? "");
  const [cats, setCats] = useState(props.categories);
  const [dirty, setDirty] = useState(false);
  const [pending, start] = useTransition();
  const [aiBusy, setAiBusy] = useState(false);

  const toggleLang = (code: string) => {
    const next = langs.includes(code) ? langs.filter((l) => l !== code) : [...langs, code];
    start(async () => {
      const res = await saveLanguages(props.restaurantId, next);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setLangs(next);
      if (!next.includes(active)) setActive(next[0] ?? "");
      else if (!active && next[0]) setActive(next[0]);
      toast.success("Languages updated");
    });
  };

  const setField = (kind: "cat" | "item", id: string, field: "name" | "description", value: string) => {
    setDirty(true);
    setCats((prev) =>
      prev.map((c) => {
        const patch = (r: Row): Row => (r.id === id ? { ...r, translations: { ...r.translations, [active]: { ...r.translations[active as keyof Translations], [field]: value } } } : r);
        return kind === "cat" ? { ...patch(c), items: c.items } : { ...c, items: c.items.map(patch) };
      }),
    );
  };

  const save = () =>
    start(async () => {
      const res = await saveTranslations(props.restaurantId, {
        categories: cats.map((c) => ({ id: c.id, translations: c.translations })),
        items: cats.flatMap((c) => c.items.map((i) => ({ id: i.id, translations: i.translations }))),
      });
      if (!res.ok) toast.error(res.error);
      else {
        setDirty(false);
        toast.success("Translations saved — live on your menu");
      }
    });

  const runAi = async () => {
    setAiBusy(true);
    const rows = cats.flatMap((c) => [c, ...c.items]).map((r) => ({ id: r.id, name: r.name, description: r.description }));
    const out: Record<string, { name: string; description: string | null }> = {};
    for (let i = 0; i < rows.length; i += 80) {
      const res = await autoTranslate(props.restaurantId, active, rows.slice(i, i + 80));
      if (!res.ok) {
        toast.error(res.error);
        setAiBusy(false);
        return;
      }
      Object.assign(out, res.data);
    }
    setAiBusy(false);
    let filled = 0;
    setCats((prev) =>
      prev.map((c) => {
        const fill = (r: Row): Row => {
          const cur = r.translations[active as keyof Translations];
          const t = out[r.id];
          if (!t || cur?.name) return r; // never overwrite what the owner typed
          filled++;
          return { ...r, translations: { ...r.translations, [active]: { name: t.name, description: cur?.description || t.description } } };
        };
        return { ...fill(c), items: c.items.map(fill) };
      }),
    );
    setDirty(true);
    toast.success(`Drafted ${filled} translation${filled === 1 ? "" : "s"} — review, then save.`);
  };

  const info = active ? languageInfo(active) : null;

  return (
    <div className="space-y-6">
      <Link href={`/dashboard/r/${props.restaurantId}/menu`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeftIcon className="size-4" /> Back to menu</Link>
      <SectionCard
        title="Menu languages"
        description={`Guests get a language switcher on your menu. Your ${props.plan === "free" ? "Free" : "Pro"} plan includes ${props.maxLanguages} extra language${props.maxLanguages === 1 ? "" : "s"}${props.plan === "free" ? " (Pro: up to 6)" : ""}. Whatever you typed in the menu editor stays the original.`}
      >
        <div className="flex flex-wrap gap-1.5">
          {MENU_LANGUAGES.filter((l) => l.code !== "en").map((l) => {
            const on = langs.includes(l.code);
            return (
              <button
                key={l.code}
                type="button"
                disabled={!props.isOwner || pending}
                aria-pressed={on}
                onClick={() => toggleLang(l.code)}
                className={cn("rounded-full border px-3 py-1 text-sm transition-colors disabled:opacity-60", on ? "border-primary bg-primary text-primary-foreground" : "hover:border-foreground/30")}
              >
                {l.native} <span className="opacity-70">· {l.label}</span>
              </button>
            );
          })}
        </div>
        {!props.isOwner && <p className="text-xs text-muted-foreground">Only the owner can change which languages are offered.</p>}
      </SectionCard>

      {langs.length > 0 && (
        <SectionCard title="Translations" description="Leave a field empty to show the original text.">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Language">
              {langs.map((l) => (
                <button key={l} role="tab" aria-selected={active === l} onClick={() => setActive(l)} className={cn("rounded-lg px-3 py-1.5 text-sm", active === l ? "bg-accent font-semibold" : "text-muted-foreground hover:text-foreground")}>
                  {languageInfo(l).native}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              {props.aiAvailable && (
                <Button variant="outline" onClick={runAi} disabled={aiBusy || !active}>
                  {aiBusy ? <Loader2Icon className="animate-spin" /> : <SparklesIcon />} Draft with AI
                </Button>
              )}
              <Button onClick={save} disabled={pending || !dirty}>{pending && <Loader2Icon className="animate-spin" />} Save translations</Button>
            </div>
          </div>
          {cats.length === 0 ? (
            <p className="text-sm text-muted-foreground">Add some dishes first.</p>
          ) : (
            <div className="space-y-6" dir={info?.rtl ? "rtl" : undefined}>
              {cats.map((c) => (
                <div key={c.id} className="space-y-2">
                  <TRow row={c} lang={active} onChange={(f, v) => setField("cat", c.id, f, v)} heading />
                  <div className="space-y-2 border-s-2 ps-4">
                    {c.items.map((i) => (
                      <TRow key={i.id} row={i} lang={active} onChange={(f, v) => setField("item", i.id, f, v)} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      )}
    </div>
  );
}

function TRow({ row, lang, onChange, heading }: { row: Row; lang: string; onChange: (f: "name" | "description", v: string) => void; heading?: boolean }) {
  const t = row.translations[lang as keyof Translations];
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <div dir="ltr" className={cn("text-sm", heading && "font-semibold")}>
        <p>{row.name}</p>
        {row.description && <p className="text-xs text-muted-foreground">{row.description}</p>}
      </div>
      <div className="space-y-1.5">
        <Input aria-label={`${row.name} in ${lang}`} value={t?.name ?? ""} placeholder={row.name} maxLength={100} onChange={(e) => onChange("name", e.target.value)} />
        {row.description && (
          <Textarea aria-label={`${row.name} description in ${lang}`} rows={2} value={t?.description ?? ""} placeholder={row.description} maxLength={400} onChange={(e) => onChange("description", e.target.value)} />
        )}
      </div>
    </div>
  );
}
