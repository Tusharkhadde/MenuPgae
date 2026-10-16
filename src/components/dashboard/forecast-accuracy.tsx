"use client";

import { useState, useTransition } from "react";
import { FlaskConicalIcon, Loader2Icon, TargetIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SectionCard } from "@/components/dashboard/field";
import { runBacktest } from "@/server/actions/prep";
import type { BacktestModel, BacktestResult } from "@/lib/prep/types";

const ORDER: BacktestModel[] = ["tabpfn", "last_week", "weekday_mean_4w"];
const pct = (v: number | null) => (v == null ? "—" : `${(v * 100).toFixed(1)}%`);
const num = (v: number) => v.toFixed(2);

/**
 * "Forecast accuracy" — runs the agent's backtest on demand and shows exactly what it returns.
 * No numbers are stored or pre-filled; until the owner presses the button the card shows none.
 */
export function ForecastAccuracy(props: { restaurantId: string; source: "orders" | "synthetic"; canUseOrders: boolean }) {
  const [res, setRes] = useState<BacktestResult | null>(null);
  const [pending, start] = useTransition();
  const src = props.canUseOrders ? props.source : "synthetic";

  const run = () =>
    start(async () => {
      const out = await runBacktest(props.restaurantId, { holdoutDays: 14, source: src });
      if (!out.ok) {
        toast.error(out.error);
        return;
      }
      setRes(out.data);
    });

  return (
    <SectionCard
      title="Forecast accuracy"
      description="How good is the forecast, honestly? We hide the last 14 days, forecast them with TabPFN using only the days before, and compare with what you'd otherwise guess: the same weekday last week, or the average of the last 4 same weekdays."
    >
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={run} disabled={pending} variant="outline">
          {pending ? <Loader2Icon className="animate-spin" /> : <TargetIcon />} {pending ? "Backtesting…" : "Run backtest"}
        </Button>
        <span className="text-xs text-muted-foreground">Data: {src === "synthetic" ? "synthetic demo data (not real sales)" : "your real orders"} · needs 28+ days</span>
      </div>

      {res && (
        <div className="space-y-4">
          {res.synthetic && (
            <p className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-400">
              <FlaskConicalIcon className="size-3.5" /> Synthetic demo data — these scores say how the method behaves, not how it does on a real kitchen.
            </p>
          )}
          <p className="text-sm text-muted-foreground">
            Held out {res.holdout.start} → {res.holdout.end} ({res.holdout_days} days, {res.dish_days} dish-days); trained on {res.train.days} days. Lower is better.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 pe-3 font-medium">Method</th>
                  <th className="px-2 py-2 text-right font-medium" title="Mean absolute error, portions per dish per day">
                    MAE
                  </th>
                  <th className="px-2 py-2 text-right font-medium" title="Total absolute error ÷ total sold">
                    WAPE
                  </th>
                </tr>
              </thead>
              <tbody>
                {ORDER.map((m) => (
                  <tr key={m} className="border-b last:border-0">
                    <td className="py-2 pe-3">
                      {res.models[m]} {res.best_by_wape === m && <Badge variant="secondary">best</Badge>}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">{num(res.overall[m].mae)}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{pct(res.overall[m].wape)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <details className="text-sm">
            <summary className="cursor-pointer text-muted-foreground">Per dish (WAPE)</summary>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 pe-3 font-medium">Dish</th>
                    <th className="px-2 py-2 text-right font-medium">Sold</th>
                    {ORDER.map((m) => (
                      <th key={m} className="px-2 py-2 text-right font-medium">
                        {res.models[m]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {res.per_dish.slice(0, 15).map((d) => (
                    <tr key={d.item} className="border-b last:border-0">
                      <td className="py-2 pe-3">{d.item}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{Math.round(d.actual_total)}</td>
                      {ORDER.map((m) => (
                        <td key={m} className="px-2 py-2 text-right tabular-nums">
                          {pct(d[m].wape)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
          <p className="text-xs text-muted-foreground">TabPFN: {res.models.tabpfn_detail} · point forecast = median.</p>
        </div>
      )}
    </SectionCard>
  );
}
