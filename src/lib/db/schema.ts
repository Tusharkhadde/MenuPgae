import {
  bigserial,
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import type { AdapterAccountType } from "next-auth/adapters";
import type { WeeklyHours } from "@/lib/hours";
import type { ItemOptions } from "@/lib/options";
import type { Availability, HappyHour } from "@/lib/schedule";
import type { Translations } from "@/lib/languages";
import type { OrderLine, OrderStatus } from "@/lib/order";

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

/* ----------------------------------------------------------------------------
 * Auth.js tables (shape required by @auth/drizzle-adapter)
 * ------------------------------------------------------------------------- */

export const users = pgTable("users", {
  id: id(),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: timestamp("email_verified", { mode: "date", withTimezone: true }),
  image: text("image"),
  /** Demo sandbox accounts are throwaway and cleaned up after 24h. */
  isDemo: boolean("is_demo").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const accounts = pgTable(
  "accounts",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (t) => [primaryKey({ columns: [t.provider, t.providerAccountId] })],
);

export const sessions = pgTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date", withTimezone: true }).notNull(),
});

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date", withTimezone: true }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.identifier, t.token] })],
);

/* ----------------------------------------------------------------------------
 * Product tables
 * ------------------------------------------------------------------------- */

export type ThemeId = "classic" | "midnight" | "fresh" | "street";
export type Diet = "veg" | "nonveg" | "vegan" | "egg";

export const restaurants = pgTable(
  "restaurants",
  {
    id: id(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    tagline: text("tagline"),
    description: text("description"),
    cuisine: text("cuisine"),
    currency: text("currency").notNull().default("INR"),
    timezone: text("timezone").notNull().default("Asia/Kolkata"),
    theme: text("theme").$type<ThemeId>().notNull().default("classic"),
    logoUrl: text("logo_url"),
    coverUrl: text("cover_url"),
    phone: text("phone"),
    whatsapp: text("whatsapp"),
    whatsappOrdering: boolean("whatsapp_ordering").notNull().default(true),
    instagram: text("instagram"),
    address: text("address"),
    mapsUrl: text("maps_url"),
    googleReviewsUrl: text("google_reviews_url"),
    swiggyUrl: text("swiggy_url"),
    zomatoUrl: text("zomato_url"),
    uberEatsUrl: text("uber_eats_url"),
    hours: jsonb("hours").$type<WeeklyHours>(),
    customDomain: text("custom_domain"),
    /** UPI VPA (India) for "pay by UPI" after ordering — no gateway, no fees. */
    upiId: text("upi_id"),
    /** One-line promo banner on the public page. */
    promoBanner: text("promo_banner"),
    /** Extra menu languages (codes from lib/languages); the main language is implicit. */
    languages: text("languages").array().notNull().default([]),
    happyHour: jsonb("happy_hour").$type<HappyHour>(),
    /** Guests can place orders that land in the dashboard inbox (WhatsApp still opens). */
    ordersEnabled: boolean("orders_enabled").notNull().default(true),
    /** Call-waiter / request-bill buttons for guests at a table. */
    serviceRequestsEnabled: boolean("service_requests_enabled").notNull().default(true),
    feedbackEnabled: boolean("feedback_enabled").notNull().default(true),
    reservationsEnabled: boolean("reservations_enabled").notNull().default(false),
    /** Owner gets the weekly email digest (when RESEND is configured). */
    digestEnabled: boolean("digest_enabled").notNull().default(true),
    published: boolean("published").notNull().default(true),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("restaurants_slug_idx").on(t.slug),
    uniqueIndex("restaurants_custom_domain_idx").on(t.customDomain),
    index("restaurants_owner_idx").on(t.ownerId),
  ],
);

export const categories = pgTable(
  "categories",
  {
    id: id(),
    restaurantId: text("restaurant_id")
      .notNull()
      .references(() => restaurants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    position: integer("position").notNull().default(0),
    /** Time-based menus, e.g. Breakfast 08:00–11:30 on weekdays. */
    availability: jsonb("availability").$type<Availability>(),
    translations: jsonb("translations").$type<Translations>().notNull().default({}),
    ...timestamps,
  },
  (t) => [index("categories_restaurant_idx").on(t.restaurantId, t.position)],
);

export const items = pgTable(
  "items",
  {
    id: id(),
    restaurantId: text("restaurant_id")
      .notNull()
      .references(() => restaurants.id, { onDelete: "cascade" }),
    categoryId: text("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    /** Price in the currency's minor unit (paise, cents, fils...). */
    priceMinor: integer("price_minor").notNull(),
    imageUrl: text("image_url"),
    diet: text("diet").$type<Diet>(),
    /** 0 = not spicy, 1–3 = mild → hot. */
    spicy: integer("spicy").notNull().default(0),
    allergens: text("allergens").array().notNull().default([]),
    bestseller: boolean("bestseller").notNull().default(false),
    soldOut: boolean("sold_out").notNull().default(false),
    /** Sizes (Half/Full) and add-on groups. */
    options: jsonb("options").$type<ItemOptions>(),
    /** "Today's special" — pinned to the top of the menu. */
    special: boolean("special").notNull().default(false),
    /** Gets the restaurant's happy-hour discount during the happy-hour window. */
    happyHour: boolean("happy_hour").notNull().default(false),
    availability: jsonb("availability").$type<Availability>(),
    calories: integer("calories"),
    /** Free text, e.g. "Protein 12g · Carbs 40g · Fat 9g". */
    nutrition: text("nutrition"),
    translations: jsonb("translations").$type<Translations>().notNull().default({}),
    position: integer("position").notNull().default(0),
    ...timestamps,
  },
  (t) => [
    index("items_category_idx").on(t.categoryId, t.position),
    index("items_restaurant_idx").on(t.restaurantId),
  ],
);

/** One row per user; mirrors their Dodo Payments subscription. */
export const billingAccounts = pgTable("billing_accounts", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  plan: text("plan").notNull().default("free"),
  status: text("status"),
  subscriptionId: text("subscription_id").unique(),
  customerId: text("customer_id"),
  productId: text("product_id"),
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
  pastDueEndsAt: timestamp("past_due_ends_at", { withTimezone: true }),
  lastEventAt: timestamp("last_event_at", { withTimezone: true }),
  ...timestamps,
});

/** Webhook idempotency: one row per processed `webhook-id`. */
export const processedWebhooks = pgTable("processed_webhooks", {
  id: text("id").primaryKey(),
  type: text("type"),
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
});

export type EventType = "view" | "scan" | "whatsapp";

/**
 * Privacy-friendly analytics: no cookies, no IPs, no user agents stored.
 * `meta` holds e.g. the table number or the items in a WhatsApp order.
 */
export const events = pgTable(
  "events",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    restaurantId: text("restaurant_id")
      .notNull()
      .references(() => restaurants.id, { onDelete: "cascade" }),
    type: text("type").$type<EventType>().notNull(),
    day: date("day", { mode: "string" }).notNull(),
    meta: jsonb("meta").$type<{ table?: string; items?: { id: string; qty: number }[] }>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("events_restaurant_day_idx").on(t.restaurantId, t.day, t.type)],
);

/* ----------------------------------------------------------------------------
 * Orders, table service, feedback, reservations, coupons, team
 * ------------------------------------------------------------------------- */

export const orders = pgTable(
  "orders",
  {
    id: id(),
    restaurantId: text("restaurant_id")
      .notNull()
      .references(() => restaurants.id, { onDelete: "cascade" }),
    /** Restaurant-local business day and a per-day running number (#1, #2 …). */
    day: date("day", { mode: "string" }).notNull(),
    number: integer("number").notNull(),
    /** Short code the guest also sees in their WhatsApp message (matches chat ↔ inbox). */
    ref: text("ref"),
    table: text("table_label"),
    customerName: text("customer_name"),
    customerPhone: text("customer_phone"),
    note: text("note"),
    lines: jsonb("lines").$type<OrderLine[]>().notNull(),
    currency: text("currency").notNull(),
    subtotalMinor: integer("subtotal_minor").notNull(),
    discountMinor: integer("discount_minor").notNull().default(0),
    totalMinor: integer("total_minor").notNull(),
    couponCode: text("coupon_code"),
    status: text("status").$type<OrderStatus>().notNull().default("new"),
    paid: boolean("paid").notNull().default(false),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("orders_restaurant_day_number_idx").on(t.restaurantId, t.day, t.number),
    index("orders_restaurant_created_idx").on(t.restaurantId, t.createdAt),
  ],
);

export type ServiceKind = "waiter" | "bill";

export const serviceRequests = pgTable(
  "service_requests",
  {
    id: id(),
    restaurantId: text("restaurant_id")
      .notNull()
      .references(() => restaurants.id, { onDelete: "cascade" }),
    table: text("table_label").notNull(),
    kind: text("kind").$type<ServiceKind>().notNull(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("service_requests_restaurant_idx").on(t.restaurantId, t.createdAt)],
);

export const feedback = pgTable(
  "feedback",
  {
    id: id(),
    restaurantId: text("restaurant_id")
      .notNull()
      .references(() => restaurants.id, { onDelete: "cascade" }),
    orderId: text("order_id").references(() => orders.id, { onDelete: "set null" }),
    rating: integer("rating").notNull(),
    comment: text("comment"),
    name: text("name"),
    contact: text("contact"),
    table: text("table_label"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("feedback_restaurant_idx").on(t.restaurantId, t.createdAt)],
);

export type ReservationStatus = "pending" | "accepted" | "declined";

export const reservations = pgTable(
  "reservations",
  {
    id: id(),
    restaurantId: text("restaurant_id")
      .notNull()
      .references(() => restaurants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    phone: text("phone").notNull(),
    email: text("email"),
    date: date("date", { mode: "string" }).notNull(),
    time: text("time").notNull(),
    partySize: integer("party_size").notNull(),
    note: text("note"),
    status: text("status").$type<ReservationStatus>().notNull().default("pending"),
    ...timestamps,
  },
  (t) => [index("reservations_restaurant_date_idx").on(t.restaurantId, t.date)],
);

export const coupons = pgTable(
  "coupons",
  {
    id: id(),
    restaurantId: text("restaurant_id")
      .notNull()
      .references(() => restaurants.id, { onDelete: "cascade" }),
    code: text("code").notNull(),
    kind: text("kind").$type<"percent" | "amount">().notNull(),
    value: integer("value").notNull(),
    minOrderMinor: integer("min_order_minor").notNull().default(0),
    active: boolean("active").notNull().default(true),
    expiresAt: date("expires_at", { mode: "string" }),
    maxUses: integer("max_uses"),
    uses: integer("uses").notNull().default(0),
    ...timestamps,
  },
  (t) => [uniqueIndex("coupons_restaurant_code_idx").on(t.restaurantId, t.code)],
);

export type TeamRole = "manager" | "staff";

/** Staff invited to a restaurant by email. They sign in with that email. */
export const teamMembers = pgTable(
  "team_members",
  {
    id: id(),
    restaurantId: text("restaurant_id")
      .notNull()
      .references(() => restaurants.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: text("role").$type<TeamRole>().notNull(),
    ...timestamps,
  },
  (t) => [uniqueIndex("team_members_restaurant_email_idx").on(t.restaurantId, t.email), index("team_members_email_idx").on(t.email)],
);

/**
 * Restaurant-specific dish glossary: protected dish names (+ spellings) and a short explanation.
 * Merged over the built-in list in src/lib/glossary/dishes.ts for AI translation and its post-check.
 */
export const glossaryEntries = pgTable(
  "glossary_entries",
  {
    id: id(),
    restaurantId: text("restaurant_id")
      .notNull()
      .references(() => restaurants.id, { onDelete: "cascade" }),
    term: text("term").notNull(),
    aliases: text("aliases").array().notNull().default([]),
    explanation: text("explanation").notNull(),
    ...timestamps,
  },
  (t) => [uniqueIndex("glossary_entries_restaurant_term_idx").on(t.restaurantId, t.term)],
);

export type User = typeof users.$inferSelect;
export type Restaurant = typeof restaurants.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Item = typeof items.$inferSelect;
export type BillingAccount = typeof billingAccounts.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type Reservation = typeof reservations.$inferSelect;
export type Coupon = typeof coupons.$inferSelect;
export type TeamMember = typeof teamMembers.$inferSelect;
export type GlossaryEntryRow = typeof glossaryEntries.$inferSelect;
