import { redirect } from "next/navigation";

export default async function RestaurantIndex({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/dashboard/r/${id}/menu`);
}
