import type { Metadata } from "next";
import { PricingCards } from "@/components/marketing/pricing-cards";
import { Faq } from "@/components/marketing/faq";
import { PLANS } from "@/config/plans";

export const metadata: Metadata = { title: "Pricing", description: "Simple pricing for MenuPage: a generous Free plan and Pro for multiple branches and custom domains." };

const ROWS: [string, string, string][] = [
  ["Restaurants / branches", String(PLANS.free.limits.restaurants), `Up to ${PLANS.pro.limits.restaurants}`],
  ["Menu items per restaurant", String(PLANS.free.limits.itemsPerRestaurant), PLANS.pro.limits.itemsPerRestaurant.toLocaleString("en-US")],
  ["Table QR codes", String(PLANS.free.limits.tableQrCodes), String(PLANS.pro.limits.tableQrCodes)],
  ["WhatsApp ordering", "✓", "✓"],
  ["Themes", "4", "4"],
  ["Analytics history", `${PLANS.free.limits.analyticsDays} days`, `${PLANS.pro.limits.analyticsDays} days`],
  ["Custom domain", "—", "✓"],
  ["“Made with MenuPage” badge", "Shown", "Removed"],
];

export default function PricingPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">Simple, honest pricing</h1>
        <p className="mt-4 text-muted-foreground">Start on Free and stay as long as you like. Upgrade to Pro when you add branches or want your own domain.</p>
      </div>
      <div className="mt-12">
        <PricingCards />
      </div>
      <div className="mx-auto mt-20 max-w-3xl overflow-hidden rounded-2xl border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="px-5 py-3 font-medium">Compare plans</th>
              <th className="px-5 py-3 font-medium">Free</th>
              <th className="px-5 py-3 font-medium">Pro</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {ROWS.map(([label, free, pro]) => (
              <tr key={label}>
                <td className="px-5 py-3 text-muted-foreground">{label}</td>
                <td className="px-5 py-3">{free}</td>
                <td className="px-5 py-3 font-medium">{pro}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-20">
        <h2 className="mb-8 text-center text-2xl font-semibold tracking-tight">FAQ</h2>
        <Faq />
      </div>
    </div>
  );
}
