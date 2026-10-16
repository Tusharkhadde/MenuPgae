"use client";

import { useState, useTransition } from "react";
import { ChefHatIcon, FlaskConicalIcon, Loader2Icon, TriangleAlertIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { NativeSelect } from "@/components/ui/native-select";
import { Field, SectionCard } from "@/components/dashboard/field";
import { AskPlanner } from "@/components/dashboard/ask-planner";
import { ForecastAccuracy } from "@/components/dashboard/forecast-accuracy";
import { generatePrepPlan } from "@/server/actions/prep";
import type { PrepPlan } from "@/lib/prep/types";
import { cn } from "@/lib/utils";

const fmtDay = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
const n0 = (v: number) => Math.round(v).toLocaleString("en-IN");

export function PrepPlanner(props: { restaurantId: string; orderCount: number; orderDays: number; minDays: number; syntheticOnly: boolean }) {
  const enoughData = props.orderDays >= props.minDays;
  const [source, setSource] = useState<"orders" | "synthetic">(props.syntheticOnly || !enoughData ? "synthetic" : "orders");
  const [horizon, setHorizon] = useState(3);
  const [plan, setPlan] = useState<PrepPlan | null>(null);
  const [pending, start] = useTransition();

  const runPlan = () =>
    start(async () => {
      const res = await generatePrepPlan(props.restaurantId, { horizonDays: horizon, source });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setPlan(res.data);
    });

  const dates = plan ? [...new Set(plan.forecast.map((f) => f.date))].sort() : [];
  const itemsSorted = plan ? [...new Set(plan.forecast.map((f) => f.item))].sort((a, b) => total(plan, b) - total(plan, a)) : [];

  return (
    <div className="space-y-6">
      <SectionCard
        title="Prep planner"
        description="Forecasts how many portions of each dish you'll sell, from your order history, with TabPFN (an open tabular foundation model). Gemma (an open model) writes the prep list. Numbers always come from the forecast, never from the language model."
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Data" htmlFor="prep-source" hint={enoughData ? `${props.orderCount} orders on ${props.orderDays} days (last 90)` : `${props.orderDays} days with orders — needs ${props.minDays}+`}>
            <NativeSelect id="prep-source" value={source} onChange={(e) => setSource(e.target.value as "orders" | "synthetic")} disabled={pending}>
              <option value="orders" disabled={props.syntheticOnly || !enoughData}>
                My real orders
              </option>
              <option value="synthetic">Synthetic demo data (not real sales)</option>
            </NativeSelect>
          </Field>
          <Field label="Days ahead" htmlFor="prep-horizon" hint="Starting tomorrow">
            <NativeSelect id="prep-horizon" value={String(horizon)} onChange={(e) => setHorizon(Number(e.target.value))} disabled={pending}>
              {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                <option key={d} value={d}>
                  {d} day{d === 1 ? "" : "s"}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <div className="flex items-end">
            <Button onClick={runPlan} disabled={pending} className="w-full">
              {pending ? <Loader2Icon className="animate-spin" /> : <ChefHatIcon />} {pending ? "Forecasting…" : "Build prep plan"}
            </Button>
          </div>
        </div>
        {props.syntheticOnly && <p className="text-xs text-muted-foreground">Demo account: the planner runs on synthetic data only. Pro restaurants use their real orders.</p>}
        {pending && <p className="text-xs text-muted-foreground">The first run can take up to a minute while the forecasting agent wakes up.</p>}
      </SectionCard>

      <AskPlanner restaurantId={props.restaurantId} source={source} canUseOrders={!props.syntheticOnly && enoughData} />

      {plan && (
        <>
          {plan.synthetic && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
              <FlaskConicalIcon className="mt-0.5 size-4 shrink-0" />
              <p>
                <strong>Synthetic demo data.</strong> This plan was built from generated orders based on your menu — not real sales. Use it to see how the planner works.
              </p>
            </div>
          )}

          <SectionCard title={`Prep list · ${fmtDay(plan.prep.date)}`} description={plan.prep.summary}>
            <ul className="divide-y rounded-xl border">
              {plan.prep.items.map((it) => (
                <li key={it.item} className="flex items-start justify-between gap-3 p-3 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium">{it.item}</p>
                    {it.note && <p className="text-muted-foreground">{it.note}</p>}
                  </div>
                  <span className="shrink-0 font-semibold tabular-nums">{n0(it.quantity)} portions</span>
                </li>
              ))}
            </ul>
            {plan.prep.risk_notes.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold">86 risk — could run out</h3>
                <ul className="space-y-1.5">
                  {plan.prep.risk_notes.map((r) => (
                    <li key={r.item} className="flex items-start gap-2 text-sm">
                      <TriangleAlertIcon className="mt-0.5 size-4 shrink-0 text-amber-600" />
                      <span>
                        <strong>{r.item}:</strong> {r.note}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Wording: {plan.prep.source === "gemma" ? plan.models.narrator : "built-in template (no AI provider on the agent)"} · Forecast: {plan.models.forecaster}
            </p>
          </SectionCard>

          <SectionCard title="Forecast" description={`Portions per dish per day. Range is the 10th–90th percentile; "prep" is the 75th percentile, which the prep list uses. Learned from ${plan.data.days} days of ${plan.synthetic ? "synthetic" : "real"} orders.`}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 pe-3 font-medium">Dish</th>
                    {dates.map((d) => (
                      <th key={d} className="px-2 py-2 text-right font-medium">
                        {fmtDay(d)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {itemsSorted.map((item) => (
                    <tr key={item} className="border-b last:border-0">
                      <td className="py-2 pe-3">{item}</td>
                      {dates.map((d) => {
                        const f = plan.forecast.find((r) => r.date === d && r.item === item);
                        return (
                          <td key={d} className="px-2 py-2 text-right tabular-nums" title={f ? `range ${n0(f.low)}–${n0(f.high)}${f.peak_bucket ? ` · busiest: ${f.peak_bucket}` : ""}` : undefined}>
                            {f ? (
                              <>
                                <span className="font-medium">{n0(f.prep)}</span>
                                <span className="block text-[11px] text-muted-foreground">
                                  {n0(f.low)}–{n0(f.high)}
                                </span>
                              </>
                            ) : (
                              "—"
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                  <tr className="font-semibold">
                    <td className="py-2 pe-3">All dishes (median)</td>
                    {dates.map((d) => {
                      const t = plan.daily_totals.find((x) => x.date === d);
                      return (
                        <td key={d} className="px-2 py-2 text-right tabular-nums">
                          {t ? n0(t.median) : "—"}
                        </td>
                      );
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
          </SectionCard>

          <SectionCard title="Unusual days" description="Recent days where actual sales fell outside the range TabPFN expected, trained only on the days before them.">
            {plan.anomalies.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing unusual in the last two weeks.</p>
            ) : (
              <ul className="space-y-1.5 text-sm">
                {plan.anomalies.map((a, i) => (
                  <li key={`${a.date}-${a.item}-${i}`} className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary" className={cn(a.kind === "spike" ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400")}>
                      {a.kind === "spike" ? "Spike" : "Drop"}
                    </Badge>
                    <span>
                      {fmtDay(a.date)} · {a.item ?? "All dishes"}: sold {n0(a.actual)}, expected about {n0(a.expected)} ({n0(a.low)}–{n0(a.high)})
                      {a.kind === "drop" && a.item ? " — sold out early or quiet day?" : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          {plan.warnings.length > 0 && (
            <ul className="space-y-1 text-xs text-muted-foreground">
              {plan.warnings.map((w) => (
                <li key={w}>· {w}</li>
              ))}
            </ul>
          )}
        </>
      )}

      <ForecastAccuracy restaurantId={props.restaurantId} source={source} canUseOrders={!props.syntheticOnly && props.orderDays >= 28} />
    </div>
  );
}

function total(plan: PrepPlan, item: string): number {
  return plan.forecast.filter((f) => f.item === item).reduce((s, f) => s + f.median, 0);
}
