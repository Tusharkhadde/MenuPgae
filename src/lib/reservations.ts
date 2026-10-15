import { z } from "zod";
import { TIME_RE } from "@/lib/hours";

export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const reservationSchema = z.object({
  r: z.string().min(1).max(64),
  name: z.string().trim().min(2, "Enter your name").max(60),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[\d\s()-]{6,24}$/, "Enter a phone number"),
  email: z.preprocess((v) => (v === "" ? null : v), z.email("Enter a valid email").max(120).nullable().optional()),
  date: z.string().regex(DATE_RE, "Pick a date"),
  time: z.string().regex(TIME_RE, "Pick a time"),
  partySize: z.number().int().min(1).max(50),
  note: z.string().trim().max(300).nullable().optional(),
});
export type ReservationInput = z.infer<typeof reservationSchema>;

function addDays(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  return new Date(d.getTime() + n * 86_400_000).toISOString().slice(0, 10);
}

/** A request must be for today (restaurant-local) up to `maxDaysAhead` days out. */
export function checkReservationDate(date: string, today: string, maxDaysAhead = 90): string | null {
  if (!DATE_RE.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) return "Pick a valid date.";
  if (date < today) return "That date has passed.";
  if (date > addDays(today, maxDaysAhead)) return `You can book up to ${maxDaysAhead} days ahead.`;
  return null;
}

export function reservationWhatsAppText(opts: { restaurantName: string; name: string; date: string; time: string; partySize: number; note?: string | null }): string {
  const lines = [`Hi ${opts.restaurantName}! I'd like to book a table.`, "", `Name: ${opts.name}`, `Date: ${opts.date}`, `Time: ${opts.time}`, `Guests: ${opts.partySize}`];
  if (opts.note?.trim()) lines.push(`Note: ${opts.note.trim()}`);
  return lines.join("\n");
}

export function reservationReplyText(opts: { restaurantName: string; name: string; date: string; time: string; partySize: number; accepted: boolean }): string {
  return opts.accepted
    ? `Hi ${opts.name}, your table for ${opts.partySize} at ${opts.restaurantName} on ${opts.date} at ${opts.time} is confirmed. See you soon!`
    : `Hi ${opts.name}, sorry — ${opts.restaurantName} can't take a booking for ${opts.partySize} on ${opts.date} at ${opts.time}. Please try another time.`;
}
