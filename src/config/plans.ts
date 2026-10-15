/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  PLANS & PRICES — the single place to change them.
 *
 *  ⚠️  PRICES BELOW ARE PLACEHOLDERS. Set your real prices here AND on the
 *      matching Dodo Payments product (the amount actually charged is whatever
 *      the Dodo product says; these strings are display labels only).
 * ─────────────────────────────────────────────────────────────────────────────
 */

export type PlanId = "free" | "pro";

export type PlanLimits = {
  /** Restaurants (branches) one account can own. */
  restaurants: number;
  /** Menu items per restaurant. */
  itemsPerRestaurant: number;
  /** Categories per restaurant. */
  categoriesPerRestaurant: number;
  /** How many days of analytics are visible. */
  analyticsDays: number;
  customDomain: boolean;
  /** Hide the "Made with MenuPage" badge. */
  removeBadge: boolean;
  /** Table QR codes that can be generated at once. */
  tableQrCodes: number;
  /** Days of order history visible in the inbox. */
  orderHistoryDays: number;
  /** Full-screen kitchen display (KDS) mode. */
  kitchenDisplay: boolean;
  /** Coupon codes applied in the cart. */
  coupons: boolean;
  /** Happy-hour pricing (time-window discount on chosen items). */
  happyHour: boolean;
  /** Menu languages besides the main one. */
  extraLanguages: number;
  /** Table reservation requests. */
  reservations: boolean;
  /** Invited staff accounts (manager / staff). */
  teamMembers: number;
  /** Weekly email digest. */
  weeklyDigest: boolean;
  /** Optional AI helpers (auto-translate, menu photo import) — need GEMINI_API_KEY. */
  aiTools: boolean;
};

export type Plan = {
  id: PlanId;
  name: string;
  tagline: string;
  limits: PlanLimits;
  features: string[];
};

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: "free",
    name: "Free",
    tagline: "Everything a single café or stall needs to go digital.",
    limits: {
      restaurants: 1,
      itemsPerRestaurant: 50,
      categoriesPerRestaurant: 15,
      analyticsDays: 7,
      customDomain: false,
      removeBadge: false,
      tableQrCodes: 30,
      orderHistoryDays: 7,
      kitchenDisplay: false,
      coupons: false,
      happyHour: false,
      extraLanguages: 1,
      reservations: false,
      teamMembers: 0,
      weeklyDigest: false,
      aiTools: false,
    },
    features: [
      "1 restaurant",
      "Up to 50 menu items",
      "QR codes for every table",
      "WhatsApp ordering + orders inbox",
      "Sizes & add-ons, today's specials, timed menus",
      "UPI pay link & QR (India), call-waiter buttons",
      "Reviews funnel, CSV import, printable menu",
      "Menu in 1 extra language",
      "4 themes, mobile-first, installable",
      "7-day analytics & order history",
      "menupage link (yourname on our domain)",
    ],
  },
  pro: {
    id: "pro",
    name: "Pro",
    tagline: "For busy kitchens, multiple branches and your own domain.",
    limits: {
      restaurants: 10,
      itemsPerRestaurant: 1000,
      categoriesPerRestaurant: 100,
      analyticsDays: 90,
      customDomain: true,
      removeBadge: true,
      tableQrCodes: 200,
      orderHistoryDays: 90,
      kitchenDisplay: true,
      coupons: true,
      happyHour: true,
      extraLanguages: 6,
      reservations: true,
      teamMembers: 10,
      weeklyDigest: true,
      aiTools: true,
    },
    features: [
      "Up to 10 restaurants / branches",
      "Up to 1,000 items per menu",
      "Your own custom domain",
      "No MenuPage badge",
      "90-day analytics & order history",
      "Kitchen display screen",
      "Coupon codes & happy-hour pricing",
      "Table reservations",
      "Menu in up to 6 extra languages",
      "Team members (manager / staff)",
      "Weekly email digest",
      "Everything in Free",
    ],
  },
};

/**
 * Display prices for Pro, per currency. PLACEHOLDERS — edit freely.
 * Shown on the pricing page; the visitor can switch currency.
 */
export const PRO_PRICE_LABELS = {
  INR: { monthly: "₹299", note: "per month · placeholder price" },
  USD: { monthly: "$5", note: "per month · placeholder price" },
  EUR: { monthly: "€5", note: "per month · placeholder price" },
  GBP: { monthly: "£4", note: "per month · placeholder price" },
  AED: { monthly: "AED 19", note: "per month · placeholder price" },
  SGD: { monthly: "S$7", note: "per month · placeholder price" },
} as const;

export type PriceCurrency = keyof typeof PRO_PRICE_LABELS;
export const PRICE_CURRENCIES = Object.keys(PRO_PRICE_LABELS) as PriceCurrency[];

export function isPlanId(v: unknown): v is PlanId {
  return v === "free" || v === "pro";
}
