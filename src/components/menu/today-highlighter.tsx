"use client";

import { useEffect, useRef } from "react";
import { DAYS, localClock } from "@/lib/hours";

/** Marks today's row (in the restaurant's timezone) after hydration. */
export function TodayHighlighter({ timezone, children }: { timezone: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const today = DAYS[localClock(new Date(), timezone).day];
    ref.current?.querySelectorAll<HTMLElement>("[data-day]").forEach((el) => {
      el.dataset.today = String(el.dataset.day === today);
    });
  }, [timezone]);
  return <div ref={ref}>{children}</div>;
}
