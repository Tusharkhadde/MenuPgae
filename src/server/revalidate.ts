import "server-only";
import { revalidatePath } from "next/cache";
import type { Restaurant } from "@/lib/db/schema";

export function revalidateRestaurant(r: Pick<Restaurant, "slug" | "customDomain">) {
  revalidatePath(`/r/${r.slug}`);
  if (r.customDomain) revalidatePath(`/site/${r.customDomain}`);
}
