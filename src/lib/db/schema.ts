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

export type User = typeof users.$inferSelect;
export type Restaurant = typeof restaurants.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Item = typeof items.$inferSelect;
export type BillingAccount = typeof billingAccounts.$inferSelect;
