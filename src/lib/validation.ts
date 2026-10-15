import { z } from "zod";
import { CURRENCY_CODES } from "@/lib/money";
import { DAYS, TIME_RE } from "@/lib/hours";
import { SLUG_RE } from "@/lib/slug";
import { THEME_IDS } from "@/lib/themes";
import { itemOptionsSchema } from "@/lib/options";
import { availabilitySchema } from "@/lib/schedule";

const emptyToNull = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v);

export const optionalText = (max: number) =>
  z.preprocess(emptyToNull, z.string().trim().max(max).nullable().optional()).transform((v) => v ?? null);

export const optionalUrl = z
  .preprocess(
    emptyToNull,
    z
      .string()
      .trim()
      .max(500)
      .transform((v) => (/^https?:\/\//i.test(v) ? v : `https://${v}`))
      .pipe(z.url({ protocol: /^https?$/, message: "Enter a valid link" }))
      .nullable()
      .optional(),
  )
  .transform((v) => v ?? null);

export const optionalPhone = z
  .preprocess(
    emptyToNull,
    z
      .string()
      .trim()
      .max(24)
      .regex(/^\+?[\d\s()-]{6,24}$/, "Enter a valid phone number with country code")
      .nullable()
      .optional(),
  )
  .transform((v) => v ?? null);

const instagram = z
  .preprocess(
    emptyToNull,
    z
      .string()
      .trim()
      .max(100)
      .transform((v) => v.replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/^@/, "").replace(/\/.*$/, ""))
      .pipe(z.string().regex(/^[A-Za-z0-9._]{1,30}$/, "Enter an Instagram handle"))
      .nullable()
      .optional(),
  )
  .transform((v) => v ?? null);

export const timezoneSchema = z.string().refine((tz) => {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}, "Unknown timezone");

export const createRestaurantSchema = z.object({
  name: z.string().trim().min(2, "Name is too short").max(80),
  slug: z.string().trim().toLowerCase().regex(SLUG_RE, "Use 3–40 lowercase letters, numbers or dashes"),
  cuisine: optionalText(60),
  currency: z.enum(CURRENCY_CODES),
  timezone: timezoneSchema,
  theme: z.enum(THEME_IDS).default("classic"),
  whatsapp: optionalPhone,
  logoUrl: optionalUrl,
  coverUrl: optionalUrl,
  sampleMenu: z.boolean().default(false),
});

const timeRange = z.object({ open: z.string().regex(TIME_RE), close: z.string().regex(TIME_RE) });
const dayHours = z.object({ closed: z.boolean(), ranges: z.array(timeRange).max(3) });
export const hoursSchema = z.object(Object.fromEntries(DAYS.map((d) => [d, dayHours])) as Record<(typeof DAYS)[number], typeof dayHours>);

export const businessInfoSchema = z.object({
  name: z.string().trim().min(2).max(80),
  tagline: optionalText(120),
  description: optionalText(600),
  cuisine: optionalText(60),
  phone: optionalPhone,
  whatsapp: optionalPhone,
  whatsappOrdering: z.boolean(),
  instagram,
  address: optionalText(300),
  mapsUrl: optionalUrl,
  googleReviewsUrl: optionalUrl,
  swiggyUrl: optionalUrl,
  zomatoUrl: optionalUrl,
  uberEatsUrl: optionalUrl,
  currency: z.enum(CURRENCY_CODES),
  timezone: timezoneSchema,
  hours: hoursSchema.nullable(),
});

export const designSchema = z.object({
  theme: z.enum(THEME_IDS),
  logoUrl: optionalUrl,
  coverUrl: optionalUrl,
});

export const DIETS = ["veg", "nonveg", "vegan", "egg"] as const;
export const ALLERGENS = [
  "gluten",
  "dairy",
  "egg",
  "nuts",
  "peanuts",
  "soy",
  "fish",
  "shellfish",
  "sesame",
  "mustard",
  "celery",
] as const;

export const itemSchema = z.object({
  id: z.string().optional(),
  categoryId: z.string().min(1),
  name: z.string().trim().min(1, "Name is required").max(100),
  description: optionalText(400),
  price: z.string().trim().min(1, "Price is required").max(14),
  imageUrl: optionalUrl,
  diet: z.preprocess(emptyToNull, z.enum(DIETS).nullable()),
  spicy: z.coerce.number().int().min(0).max(3),
  allergens: z.array(z.enum(ALLERGENS)).max(ALLERGENS.length),
  bestseller: z.boolean(),
  soldOut: z.boolean(),
  options: itemOptionsSchema.nullable().optional().transform((v) => v ?? null),
  special: z.boolean().default(false),
  happyHour: z.boolean().default(false),
  availability: availabilitySchema.optional().transform((v) => v ?? null),
  calories: z.preprocess((v) => (v === "" || v === null || v === undefined ? null : Number(v)), z.number().int().min(0).max(9999).nullable()),
  nutrition: optionalText(120),
});

export const categorySchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1, "Name is required").max(60),
  description: optionalText(200),
  availability: availabilitySchema.optional().transform((v) => v ?? null),
});

export const reorderSchema = z.object({ ids: z.array(z.string().min(1)).min(1).max(2000) });

export const domainSchema = z
  .string()
  .trim()
  .toLowerCase()
  .transform((v) => v.replace(/^https?:\/\//, "").replace(/\/.*$/, ""))
  .pipe(
    z
      .string()
      .max(253)
      .regex(/^(?=.{4,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/, "Enter a domain like menu.yourcafe.com"),
  );

export const trackSchema = z.object({
  r: z.string().min(1).max(64),
  type: z.enum(["view", "whatsapp"]),
  table: z.string().max(12).optional(),
  items: z
    .array(z.object({ id: z.string().min(1).max(64), qty: z.number().int().min(1).max(99) }))
    .max(100)
    .optional(),
});
