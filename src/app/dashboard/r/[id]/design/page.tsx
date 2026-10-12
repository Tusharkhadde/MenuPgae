import { requireOwnedRestaurant } from "@/server/session";
import { DesignForm } from "@/components/dashboard/design-form";

export default async function DesignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { restaurant: r } = await requireOwnedRestaurant(id);
  return <DesignForm restaurantId={r.id} slug={r.slug} initial={{ theme: r.theme, logoUrl: r.logoUrl, coverUrl: r.coverUrl }} />;
}
