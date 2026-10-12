import { requireOwnedRestaurant, getPlanForUser } from "@/server/session";
import { SettingsPanel } from "@/components/dashboard/settings-panel";
import { appUrl, features } from "@/lib/env";
import { dnsInstructions } from "@/lib/domains";
import { limitsFor } from "@/lib/limits";

export default async function SettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, restaurant } = await requireOwnedRestaurant(id);
  const plan = await getPlanForUser(user.id);
  return (
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
  );
}
