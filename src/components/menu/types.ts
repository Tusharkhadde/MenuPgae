import type { Diet } from "@/lib/db/schema";
import type { WeeklyHours } from "@/lib/hours";
import type { ItemOptions } from "@/lib/options";
import type { Availability, HappyHour } from "@/lib/schedule";
import type { Translations } from "@/lib/languages";

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
  options: ItemOptions | null;
  special: boolean;
  happyHour: boolean;
  availability: Availability | null;
  calories: number | null;
  nutrition: string | null;
  translations: Translations;
};

export type MenuCategoryView = {
  id: string;
  name: string;
  description: string | null;
  availability: Availability | null;
  translations: Translations;
  items: MenuItemView[];
};

export type RestaurantView = {
  id: string;
  slug: string;
  name: string;
  currency: string;
  timezone: string;
  hours: WeeklyHours | null;
  whatsapp: string | null;
  whatsappOrdering: boolean;
  /** Orders are saved to the dashboard inbox. */
  ordersEnabled: boolean;
  serviceRequestsEnabled: boolean;
  feedbackEnabled: boolean;
  reservationsEnabled: boolean;
  googleReviewsUrl: string | null;
  /** Only set for INR menus with a valid UPI ID. */
  upiId: string | null;
  happyHour: HappyHour | null;
  couponsEnabled: boolean;
  languages: string[];
};
