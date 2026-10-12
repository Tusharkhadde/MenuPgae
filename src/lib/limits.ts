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
