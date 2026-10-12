import { PLANS, type PlanId, type PlanLimits } from "@/config/plans";

export class LimitError extends Error {
  constructor(
    message: string,
    public readonly limit: keyof PlanLimits,
  ) {
    super(message);
    this.name = "LimitError";
  }
}

export function limitsFor(plan: PlanId): PlanLimits {
  return PLANS[plan].limits;
}

export function canAddRestaurant(plan: PlanId, owned: number): boolean {
  return owned < limitsFor(plan).restaurants;
}

export function canAddItems(plan: PlanId, current: number, adding = 1): boolean {
  return current + adding <= limitsFor(plan).itemsPerRestaurant;
}

export function canAddCategory(plan: PlanId, current: number): boolean {
  return current < limitsFor(plan).categoriesPerRestaurant;
}

export function assertCanAddRestaurant(plan: PlanId, owned: number) {
  if (!canAddRestaurant(plan, owned)) {
    throw new LimitError(
      plan === "free"
        ? "The Free plan includes 1 restaurant. Upgrade to Pro to add branches."
        : `Your plan allows up to ${limitsFor(plan).restaurants} restaurants.`,
      "restaurants",
    );
  }
}

export function assertCanAddItems(plan: PlanId, current: number, adding = 1) {
  if (!canAddItems(plan, current, adding)) {
    throw new LimitError(
      `Your ${PLANS[plan].name} plan allows up to ${limitsFor(plan).itemsPerRestaurant} items per menu.` +
        (plan === "free" ? " Upgrade to Pro for more." : ""),
      "itemsPerRestaurant",
    );
  }
}

export function assertCanAddCategory(plan: PlanId, current: number) {
  if (!canAddCategory(plan, current)) {
    throw new LimitError(
      `Your ${PLANS[plan].name} plan allows up to ${limitsFor(plan).categoriesPerRestaurant} categories.`,
      "categoriesPerRestaurant",
    );
  }
}

export function assertCustomDomain(plan: PlanId) {
  if (!limitsFor(plan).customDomain) {
    throw new LimitError("Custom domains are a Pro feature.", "customDomain");
  }
}

/** Analytics window start (UTC date string, inclusive) for a plan. */
export function analyticsSince(plan: PlanId, now = new Date()): string {
  const days = limitsFor(plan).analyticsDays;
  const d = new Date(now.getTime() - (days - 1) * 86_400_000);
  return d.toISOString().slice(0, 10);
}

export function showBadge(plan: PlanId): boolean {
  return !limitsFor(plan).removeBadge;
}

type BooleanFeature = { [K in keyof PlanLimits]: PlanLimits[K] extends boolean ? K : never }[keyof PlanLimits];

const FEATURE_MESSAGES: Record<BooleanFeature, string> = {
  customDomain: "Custom domains are a Pro feature.",
  removeBadge: "Removing the MenuPage badge is a Pro feature.",
  kitchenDisplay: "The kitchen display is a Pro feature.",
  coupons: "Coupon codes are a Pro feature.",
  happyHour: "Happy-hour pricing is a Pro feature.",
  reservations: "Table reservations are a Pro feature.",
  weeklyDigest: "The weekly digest is a Pro feature.",
  aiTools: "AI tools are a Pro feature.",
};

export function hasFeature(plan: PlanId, feature: BooleanFeature): boolean {
  return limitsFor(plan)[feature];
}

export function assertFeature(plan: PlanId, feature: BooleanFeature) {
  if (!hasFeature(plan, feature)) throw new LimitError(FEATURE_MESSAGES[feature], feature);
}

export function assertLanguages(plan: PlanId, count: number) {
  const max = limitsFor(plan).extraLanguages;
  if (count > max) {
    throw new LimitError(
      `Your ${PLANS[plan].name} plan includes ${max} extra language${max === 1 ? "" : "s"}.` + (plan === "free" ? " Upgrade to Pro for up to " + PLANS.pro.limits.extraLanguages + "." : ""),
      "extraLanguages",
    );
  }
}

export function assertTeamSize(plan: PlanId, count: number) {
  if (count > limitsFor(plan).teamMembers) {
    throw new LimitError(plan === "free" ? "Team members are a Pro feature." : `Your plan allows up to ${limitsFor(plan).teamMembers} team members.`, "teamMembers");
  }
}

/** Order-history window start for a plan. */
export function ordersSince(plan: PlanId, now = new Date()): Date {
  return new Date(now.getTime() - limitsFor(plan).orderHistoryDays * 86_400_000);
}
