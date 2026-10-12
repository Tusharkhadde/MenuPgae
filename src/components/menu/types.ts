import type { Diet } from "@/lib/db/schema";
import type { WeeklyHours } from "@/lib/hours";

export type MenuItemView = {
  id: string;
  name: string;
  description: string | null;
  priceMinor: number;
  imageUrl: string | null;
  diet: Diet | null;
  spicy: number;
  allergens: string[];
  bestseller: boolean;
  soldOut: boolean;
};

export type MenuCategoryView = { id: string; name: string; description: string | null; items: MenuItemView[] };

export type RestaurantView = {
  id: string;
  slug: string;
  name: string;
  currency: string;
  timezone: string;
  hours: WeeklyHours | null;
  whatsapp: string | null;
  whatsappOrdering: boolean;
};
