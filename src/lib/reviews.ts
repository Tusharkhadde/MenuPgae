/**
 * Reviews funnel: happy guests (4–5★) are invited to leave a public Google
 * review; unhappy guests (1–3★) send private feedback to the owner instead.
 * We never block or hide the public review link — 1–3★ guests can still find
 * it on the page; we just lead with the private form.
 */
export type FeedbackRoute = "google" | "private";

export function feedbackRoute(rating: number, googleReviewsUrl: string | null | undefined): FeedbackRoute {
  return rating >= 4 && !!googleReviewsUrl ? "google" : "private";
}

export function isValidRating(v: unknown): v is 1 | 2 | 3 | 4 | 5 {
  return typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= 5;
}
