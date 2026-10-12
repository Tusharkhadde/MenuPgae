/**
 * Opening hours, evaluated in the restaurant's own IANA timezone.
 * Supports split shifts (e.g. lunch + dinner) and ranges past midnight
 * (e.g. 18:00–02:00).
 */

export const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export type DayKey = (typeof DAYS)[number];

export const DAY_LABELS: Record<DayKey, string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
};

export type TimeRange = { open: string; close: string };
export type DayHours = { closed: boolean; ranges: TimeRange[] };
export type WeeklyHours = Record<DayKey, DayHours>;

export const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function defaultHours(): WeeklyHours {
  return Object.fromEntries(
    DAYS.map((d) => [d, { closed: false, ranges: [{ open: "11:00", close: "22:00" }] }]),
  ) as WeeklyHours;
}

export function toMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

/** Close at or before open means the range runs past midnight. "00:00" close = midnight. */
function rangeBounds(r: TimeRange): { start: number; end: number } {
  const start = toMinutes(r.open);
  let end = toMinutes(r.close);
  if (end <= start) end += 24 * 60;
  return { start, end };
}

/** Weekday index (0 = mon) and minutes since midnight for `now` in `timeZone`. */
export function localClock(now: Date, timeZone: string): { day: number; minutes: number } {
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(now);
  } catch {
    parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "UTC",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(now);
  }
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "0";
  const wd = get("weekday").toLowerCase().slice(0, 3) as DayKey;
  const day = Math.max(0, DAYS.indexOf(wd));
  return { day, minutes: Number(get("hour")) * 60 + Number(get("minute")) };
}

export type OpenStatus =
  | { state: "unknown" }
  | { state: "open"; closesAt: string }
  | { state: "closed"; opensAt: string | null; opensDay: DayKey | null; opensToday: boolean };

export function getOpenStatus(hours: WeeklyHours | null | undefined, timeZone: string, now = new Date()): OpenStatus {
  if (!hours) return { state: "unknown" };
  const { day, minutes } = localClock(now, timeZone);
  const today = hours[DAYS[day]];
  const yesterday = hours[DAYS[(day + 6) % 7]];

  // Yesterday's ranges that spill past midnight into today.
  if (yesterday && !yesterday.closed) {
    for (const r of yesterday.ranges) {
      const { start, end } = rangeBounds(r);
      if (end > 1440 && minutes < end - 1440 && minutes + 1440 >= start) {
        return { state: "open", closesAt: r.close };
      }
    }
  }
  if (today && !today.closed) {
    for (const r of today.ranges) {
      const { start, end } = rangeBounds(r);
      if (minutes >= start && minutes < end) return { state: "open", closesAt: r.close };
    }
    const later = today.ranges
      .map((r) => ({ r, start: toMinutes(r.open) }))
      .filter((x) => x.start > minutes)
      .sort((a, b) => a.start - b.start)[0];
    if (later) return { state: "closed", opensAt: later.r.open, opensDay: DAYS[day], opensToday: true };
  }
  for (let i = 1; i <= 7; i++) {
    const key = DAYS[(day + i) % 7];
    const d = hours[key];
    if (d && !d.closed && d.ranges.length) {
      const first = [...d.ranges].sort((a, b) => toMinutes(a.open) - toMinutes(b.open))[0];
      return { state: "closed", opensAt: first.open, opensDay: key, opensToday: false };
    }
  }
  return { state: "closed", opensAt: null, opensDay: null, opensToday: false };
}

export function formatTime(t: string, locale = "en-US"): string {
  const [h, m] = t.split(":").map(Number);
  const d = new Date(Date.UTC(2000, 0, 1, h, m));
  return new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit", timeZone: "UTC" }).format(d);
}

export function describeStatus(s: OpenStatus, locale = "en-US"): string {
  switch (s.state) {
    case "unknown":
      return "";
    case "open":
      return `Open now · until ${formatTime(s.closesAt, locale)}`;
    case "closed":
      if (!s.opensAt || !s.opensDay) return "Closed";
      if (s.opensToday) return `Closed · opens ${formatTime(s.opensAt, locale)}`;
      return `Closed · opens ${DAY_LABELS[s.opensDay].slice(0, 3)} ${formatTime(s.opensAt, locale)}`;
  }
}

/** schema.org openingHoursSpecification entries. */
export function toOpeningHoursSpecification(hours: WeeklyHours | null | undefined) {
  if (!hours) return [];
  return DAYS.flatMap((d) =>
    hours[d]?.closed
      ? []
      : (hours[d]?.ranges ?? []).map((r) => ({
          "@type": "OpeningHoursSpecification",
          dayOfWeek: `https://schema.org/${DAY_LABELS[d]}`,
          opens: r.open,
          closes: r.close,
        })),
  );
}
