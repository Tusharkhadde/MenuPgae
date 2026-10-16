import { needsMoreDays, type Readiness } from "@/lib/prep/readiness";

/**
 * Honest empty state for a real restaurant without enough orders yet: progress toward 28 days,
 * with the two unlock points. No sample or synthetic numbers are shown in its place.
 */
export function PrepReadinessProgress({ readiness }: { readiness: Readiness }) {
  const { days, target, percent, planner, accuracy } = readiness;
  const plannerAt = Math.round((planner.min / target) * 100);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
        <span className="font-medium">
          {days} of {target} days with orders
        </span>
        <span className="text-muted-foreground">{percent}%</span>
      </div>
      <div
        className="relative h-2.5 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-label="Days of order history"
        aria-valuemin={0}
        aria-valuemax={target}
        aria-valuenow={Math.min(days, target)}
      >
        <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${percent}%` }} />
        <span className="absolute inset-y-0 w-px bg-background" style={{ left: `${plannerAt}%` }} aria-hidden />
      </div>
      <ul className="space-y-1 text-sm">
        <li className={planner.ready ? "text-foreground" : "text-muted-foreground"}>
          {planner.ready ? "✓" : "○"} Day {planner.min}: prep plan and Ask the planner
          {!planner.ready && ` — ${needsMoreDays(planner.needed).toLowerCase()}`}
        </li>
        <li className={accuracy.ready ? "text-foreground" : "text-muted-foreground"}>
          {accuracy.ready ? "✓" : "○"} Day {accuracy.min}: forecast accuracy
          {!accuracy.ready && ` — ${needsMoreDays(accuracy.needed).toLowerCase()}`}
        </li>
      </ul>
      <p className="text-xs text-muted-foreground">
        Counted from orders in your MenuPage orders inbox over the last 90 days (cancelled orders excluded). The planner only learns from your real
        orders — it never fills the gap with sample data.
      </p>
    </div>
  );
}
