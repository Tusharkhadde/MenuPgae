"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeftIcon, Loader2Icon, PlusIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, SectionCard } from "@/components/dashboard/field";
import { deleteGlossaryEntry, saveGlossaryEntry } from "@/server/actions/glossary";

type Entry = { term: string; aliases?: string[]; explanation: string };

export function GlossaryEditor(props: {
  restaurantId: string;
  custom: (Entry & { id: string })[];
  builtIn: Entry[];
  /** Built-in dishes that appear on this restaurant's menu. */
  onMenu: string[];
}) {
  const router = useRouter();
  const [term, setTerm] = useState("");
  const [aliases, setAliases] = useState("");
  const [explanation, setExplanation] = useState("");
  const [pending, start] = useTransition();
  const [filter, setFilter] = useState("");

  const add = () =>
    start(async () => {
      const res = await saveGlossaryEntry(props.restaurantId, { term, aliases, explanation });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Saved — AI translations will keep this name");
      setTerm("");
      setAliases("");
      setExplanation("");
      router.refresh();
    });

  const remove = (id: string) =>
    start(async () => {
      const res = await deleteGlossaryEntry(props.restaurantId, id);
      if (!res.ok) toast.error(res.error);
      else router.refresh();
    });

  const edit = (e: Entry) => {
    setTerm(e.term);
    setAliases((e.aliases ?? []).join(", "));
    setExplanation(e.explanation);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const q = filter.trim().toLowerCase();
  const builtIn = q ? props.builtIn.filter((e) => e.term.toLowerCase().includes(q) || e.aliases?.some((a) => a.toLowerCase().includes(q))) : props.builtIn;

  return (
    <div className="space-y-6">
      <Link href={`/dashboard/r/${props.restaurantId}/menu/translate`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-4" /> Back to translations
      </Link>
      <SectionCard
        title="Dish glossary"
        description="Dish names here are never translated word by word. AI drafts keep the name (transliterated where the script differs), add the short explanation for guests, and flag rows where a name was translated literally."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Dish name" htmlFor="g-term" hint="Exactly as on your menu, e.g. Kothimbir Vadi">
            <Input id="g-term" value={term} maxLength={60} onChange={(e) => setTerm(e.target.value)} />
          </Field>
          <Field label="Other spellings (optional)" htmlFor="g-aliases" hint="Comma-separated, e.g. Kothimbir Wadi">
            <Input id="g-aliases" value={aliases} maxLength={300} onChange={(e) => setAliases(e.target.value)} />
          </Field>
          <Field label="Short explanation for guests" htmlFor="g-expl" className="sm:col-span-2" hint="One line in English; the AI translates it. Max 200 characters.">
            <Input id="g-expl" value={explanation} maxLength={200} onChange={(e) => setExplanation(e.target.value)} />
          </Field>
        </div>
        <div className="flex justify-end">
          <Button onClick={add} disabled={pending || term.trim().length < 2 || explanation.trim().length < 3}>
            {pending ? <Loader2Icon className="animate-spin" /> : <PlusIcon />} Save entry
          </Button>
        </div>
        {props.custom.length > 0 && (
          <ul className="divide-y rounded-xl border">
            {props.custom.map((e) => (
              <li key={e.id} className="flex items-start justify-between gap-3 p-3 text-sm">
                <button type="button" className="min-w-0 text-left" onClick={() => edit(e)}>
                  <p className="font-medium">
                    {e.term}
                    {e.aliases?.length ? <span className="font-normal text-muted-foreground"> · {e.aliases.join(", ")}</span> : null}
                  </p>
                  <p className="text-muted-foreground">{e.explanation}</p>
                </button>
                <Button size="icon" variant="ghost" aria-label={`Delete ${e.term}`} disabled={pending} onClick={() => remove(e.id)}>
                  <Trash2Icon />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <SectionCard
        title={`Built-in dishes (${props.builtIn.length})`}
        description="A curated starter list of common Indian dishes. Save an entry with the same name above to change its explanation for your menu."
      >
        {props.onMenu.length > 0 && (
          <p className="text-sm">
            <span className="text-muted-foreground">On your menu: </span>
            {props.onMenu.join(", ")}
          </p>
        )}
        <Input aria-label="Filter built-in dishes" placeholder="Filter…" value={filter} onChange={(e) => setFilter(e.target.value)} className="max-w-xs" />
        <ul className="grid gap-2 sm:grid-cols-2">
          {builtIn.map((e) => (
            <li key={e.term} className="rounded-xl border p-3 text-sm">
              <button type="button" className="text-left" onClick={() => edit(e)}>
                <p className="font-medium">{e.term}</p>
                <p className="text-muted-foreground">{e.explanation}</p>
              </button>
            </li>
          ))}
        </ul>
      </SectionCard>
    </div>
  );
}
