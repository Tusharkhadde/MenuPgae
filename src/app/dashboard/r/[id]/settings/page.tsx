import { requireOwnedRestaurant, getPlanForUser } from "@/server/session";
import { OrderingSettings } from "@/components/dashboard/ordering-settings";
import { SettingsPanel } from "@/components/dashboard/settings-panel";
import { appUrl, features } from "@/lib/env";
import { dnsInstructions } from "@/lib/domains";
import { hasFeature, limitsFor } from "@/lib/limits";

export default async function SettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, restaurant } = await requireOwnedRestaurant(id);
  const plan = await getPlanForUser(user.id);
  return (
    <div className="space-y-6">
    <div className="mx-auto max-w-3xl">
      <OrderingSettings
        restaurantId={restaurant.id}
        currency={restaurant.currency}
        initial={{
          ordersEnabled: restaurant.ordersEnabled,
          serviceRequestsEnabled: restaurant.serviceRequestsEnabled,
          feedbackEnabled: restaurant.feedbackEnabled,
          reservationsEnabled: restaurant.reservationsEnabled,
          digestEnabled: restaurant.digestEnabled,
          upiId: restaurant.upiId,
        }}
        reservationsAllowed={hasFeature(plan, "reservations")}
        digestAllowed={hasFeature(plan, "weeklyDigest")}
        emailConfigured={features.resend()}
      />
    </div>
    <SettingsPanel
      restaurantId={restaurant.id}
      slug={restaurant.slug}
      published={restaurant.published}
      customDomain={restaurant.customDomain}
      canUseDomain={limitsFor(plan).customDomain && !user.isDemo}
      domainsManaged={features.vercelDomains()}
      dns={restaurant.customDomain ? dnsInstructions(restaurant.customDomain) : null}
      appHost={new URL(appUrl()).host}
    />
    </div>
  );
}
