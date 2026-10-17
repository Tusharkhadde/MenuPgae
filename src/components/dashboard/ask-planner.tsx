"use client";

import { useState, useTransition } from "react";
import { Loader2Icon, MessageCircleQuestionIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SectionCard } from "@/components/dashboard/field";
import { askPlanner } from "@/server/actions/prep";
import { DemoDataBadge } from "@/components/demo-data-badge";
import type { AskResult } from "@/lib/prep/types";

const EXAMPLES = ["How much paneer for Saturday?", "Vada pav this weekend?", "Chai for the next 3 days"];
const fmtDay = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

/** "Ask the planner": the language model only routes the question and words the answer; TabPFN gives the numbers. */
/** Rendered only once the data is ready. demo=true → the server answers from synthetic "Demo data". */
export function AskPlanner(props: { restaurantId: string; demo: boolean }) {
  const [q, setQ] = useState("");
  const [res, setRes] = useState<AskResult | null>(null);
  const [pending, start] = useTransition();

  const ask = (question: string) =>
    start(async () => {
      const out = await askPlanner(props.restaurantId, { question });
      if (!out.ok) {
        toast.error(out.error);
        return;
      }
      setRes(out.data);
    });

  return (
    <SectionCard title="Ask the planner" description="Ask in plain words. Gemma works out which dishes and days you mean, TabPFN forecasts them, and Gemma writes the answer — the numbers always come from the forecast.">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (q.trim().length >= 2) ask(q.trim());
        }}
      >
        <Input value={q} onChange={(e) => setQ(e.target.value)} maxLength={300} placeholder="How much paneer for Saturday?" aria-label="Question for the prep planner" disabled={pending} />
        <Button type="submit" disabled={pending || q.trim().length < 2}>
          {pending ? <Loader2Icon className="animate-spin" /> : <MessageCircleQuestionIcon />} Ask
        </Button>
      </form>
      <div className="flex flex-wrap gap-2">
        {EXAMPLES.map((ex) => (
          <Button
            key={ex}
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 text-xs"
            disabled={pending}
            onClick={() => {
              setQ(ex);
              ask(ex);
            }}
          >
            {ex}
          </Button>
        ))}
      </div>
      {props.demo ? (
        <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <DemoDataBadge /> Answers use synthetic orders from the demo menu (not real sales).
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">Answers use only your real orders.</p>
      )}

      {res && (
        <div className="space-y-3">
          {res.synthetic && <DemoDataBadge />}
          <p className="rounded-xl border bg-muted/30 p-3 text-sm">{res.answer}</p>
          {res.rows.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 pe-3 font-medium">Dish</th>
                    <th className="px-2 py-2 font-medium">Day</th>
                    <th className="px-2 py-2 text-right font-medium">Prep</th>
                    <th className="px-2 py-2 text-right font-medium">Likely range</th>
                  </tr>
                </thead>
                <tbody>
                  {res.rows.map((r) => (
                    <tr key={`${r.item}-${r.date}`} className="border-b last:border-0">
                      <td className="py-2 pe-3">{r.item}</td>
                      <td className="px-2 py-2">{fmtDay(r.date)}</td>
                      <td className="px-2 py-2 text-right font-medium tabular-nums">{r.prep}</td>
                      <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">
                        {Math.round(r.low)}–{Math.round(r.high)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Tool call: <code>{res.intent.tool}({JSON.stringify(res.intent.arguments)})</code> · parsed by {res.intent.parser === "gemma" ? "Gemma" : "simple rules"} · wording:{" "}
            {res.answer_source === "gemma" ? res.models.language : "template from the forecast"} · numbers: {res.models.forecaster}
          </p>
        </div>
      )}
    </SectionCard>
  );
}
