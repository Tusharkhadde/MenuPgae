import { requireOwnedRestaurant } from "@/server/session";
import { BusinessInfoForm } from "@/components/dashboard/business-info-form";
import { defaultHours } from "@/lib/hours";

export default async function DetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { restaurant: r } = await requireOwnedRestaurant(id);
  return (
    <BusinessInfoForm
      restaurantId={r.id}
      initial={{
        name: r.name,
        tagline: r.tagline ?? "",
        description: r.description ?? "",
        cuisine: r.cuisine ?? "",
        phone: r.phone ?? "",
        whatsapp: r.whatsapp ?? "",
        whatsappOrdering: r.whatsappOrdering,
        instagram: r.instagram ?? "",
        address: r.address ?? "",
        mapsUrl: r.mapsUrl ?? "",
        googleReviewsUrl: r.googleReviewsUrl ?? "",
        swiggyUrl: r.swiggyUrl ?? "",
        zomatoUrl: r.zomatoUrl ?? "",
        uberEatsUrl: r.uberEatsUrl ?? "",
        currency: r.currency,
        timezone: r.timezone,
        hoursEnabled: r.hours !== null,
        hours: r.hours ?? defaultHours(),
      }}
    />
  );
}
