"use client";

import { useEffect, useState } from "react";
import { describeStatus, getOpenStatus, type OpenStatus, type WeeklyHours } from "@/lib/hours";
import { cn } from "@/lib/utils";

/** Computed in the browser so cached pages always show the live state. */
export function OpenStatusBadge({ hours, timezone, className }: { hours: WeeklyHours | null; timezone: string; className?: string }) {
  const [status, setStatus] = useState<OpenStatus | null>(null);
  useEffect(() => {
    const update = () => setStatus(getOpenStatus(hours, timezone));
    update();
    const t = setInterval(update, 60_000);
    return () => clearInterval(t);
  }, [hours, timezone]);

  if (!status || status.state === "unknown") return <span className={cn("inline-block h-6", className)} aria-hidden />;
  const open = status.state === "open";
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium",
        className,
      )}
      style={{
        color: open ? "var(--m-open, #047857)" : "var(--m-closed, #b91c1c)",
        backgroundColor: `color-mix(in oklab, ${open ? "var(--m-open, #047857)" : "var(--m-closed, #b91c1c)"} 13%, transparent)`,
      }}
    >
      <span className={cn("size-1.5 rounded-full bg-current", open && "animate-pulse")} />
      {describeStatus(status)}
    </span>
  );
}
