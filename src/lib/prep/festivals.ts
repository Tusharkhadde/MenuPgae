import data from "../../../agent/app/data/festivals_in.json";
import { addDays } from "@/lib/prep/history";

/**
 * Movable Indian festivals (Holi, Eid al-Fitr, Eid al-Adha, Ganesh Chaturthi, Navratri, Dussehra,
 * Diwali) plus Christmas, 2024–2027.
 *
 * Single source of truth shared with the Python agent: agent/app/data/festivals_in.json.
 * Dates verified 2026-10-16 against timeanddate.com's India holiday lists
 * (https://www.timeanddate.com/holidays/india/2024 … /2027); Diwali cross-checked with
 * https://www.drikpanchang.com/hindu-festivals/diwali/diwali.html. Eid 2027 is tentative (moon sighting).
 *
 * The app sends the festivals inside the forecast window to the agent, which turns them into
 * features: festival day, days to the next festival (capped at 30) and which festival is next.
 */

export type FestivalKey = (typeof data.festivals)[number]["key"];
export type Festival = { date: string; key: string; name: string };

/** Days-to-festival is capped here (same constant as the agent's FESTIVAL_HORIZON_DAYS). */
export const FESTIVAL_HORIZON_DAYS = 30;

export const FESTIVAL_SOURCES: Record<string, string> = data.sources;

export const FESTIVALS: Festival[] = data.festivals
  .flatMap((f) => Object.values(f.dates).map((date) => ({ date, key: f.key, name: f.name })))
  .sort((a, b) => a.date.localeCompare(b.date));

/** Festivals with from <= date <= to (YYYY-MM-DD, inclusive). */
export function festivalsBetween(from: string, to: string, all: Festival[] = FESTIVALS): Festival[] {
  return all.filter((f) => f.date >= from && f.date <= to);
}

/** The next festival on or after `day` within the horizon, with the day count — or null. */
export function nextFestival(day: string, all: Festival[] = FESTIVALS, horizon = FESTIVAL_HORIZON_DAYS): (Festival & { days: number }) | null {
  const limit = addDays(day, horizon);
  const f = all.find((x) => x.date >= day && x.date <= limit);
  if (!f) return null;
  const days = Math.round((Date.parse(`${f.date}T00:00:00Z`) - Date.parse(`${day}T00:00:00Z`)) / 86_400_000);
  return { ...f, days };
}

/** Request payload shape for the agent: [{ date, key }]. */
export function festivalPayload(from: string, to: string): { date: string; key: string }[] {
  return festivalsBetween(from, to).map(({ date, key }) => ({ date, key }));
}
