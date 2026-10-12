import type { Diet } from "@/lib/db/schema";
import { defaultHours, type WeeklyHours } from "@/lib/hours";
import type { Availability } from "@/lib/schedule";

export type SampleItem = {
  name: string;
  description?: string;
  price: number; // major units
  diet?: Diet;
  spicy?: number;
  allergens?: string[];
  bestseller?: boolean;
  soldOut?: boolean;
  special?: boolean;
  calories?: number;
  /** Sizes as [name, price in major units]. */
  sizes?: [string, number][];
  /** Add-on groups: options as [name, extra price in major units]. */
  addons?: { name: string; min: number; max: number; options: [string, number][] }[];
};
export type SampleCategory = { name: string; description?: string; availability?: Availability; items: SampleItem[] };

/** A realistic Indian café menu used for the public demo and the "start with a sample menu" option. */
export const SAMPLE_MENU: SampleCategory[] = [
  {
    name: "Chai & Coffee",
    description: "Brewed fresh, all day.",
    items: [
      { name: "Masala Chai", description: "Assam tea simmered with ginger, cardamom and milk.", price: 25, diet: "veg", allergens: ["dairy"], bestseller: true, special: true, calories: 90, sizes: [["Cutting", 25], ["Full cup", 40]] },
      { name: "South Indian Filter Coffee", description: "Chicory-blend decoction, frothed the traditional way.", price: 60, diet: "veg", allergens: ["dairy"] },
      { name: "Cold Coffee", description: "Blended with ice cream. Thick, sweet, nostalgic.", price: 120, diet: "veg", allergens: ["dairy"] },
      { name: "Lemongrass Iced Tea", description: "House-brewed, lightly sweetened.", price: 90, diet: "vegan" },
    ],
  },
  {
    name: "Breakfast",
    description: "Served 8 am – 12 pm.",
    availability: { from: "08:00", to: "12:00" },
    items: [
      { name: "Poha", description: "Flattened rice with peanuts, curry leaves and a squeeze of lime.", price: 70, diet: "vegan", allergens: ["peanuts"], bestseller: true },
      { name: "Masala Omelette Pav", description: "Two-egg omelette with onion, chilli and coriander, buttered pav.", price: 110, diet: "egg", spicy: 1, allergens: ["egg", "gluten", "dairy"] },
      { name: "Upma", description: "Semolina, vegetables, tempered mustard seeds.", price: 70, diet: "vegan", allergens: ["gluten"] },
    ],
  },
  {
    name: "Street Classics",
    items: [
      { name: "Vada Pav", description: "Spiced potato fritter, garlic chutney, soft pav. Pune's favourite.", price: 35, diet: "vegan", spicy: 2, allergens: ["gluten"], bestseller: true, special: true, calories: 290 },
      { name: "Pav Bhaji", description: "Buttery mashed-vegetable curry with toasted pav and onions.", price: 140, diet: "veg", spicy: 1, allergens: ["gluten", "dairy"], calories: 600, addons: [{ name: "Extras", min: 0, max: 3, options: [["Extra pav", 20], ["Extra butter", 15], ["Cheese", 30]] }] },
      { name: "Misal Pav", description: "Fiery sprouted-moth curry with farsan and pav.", price: 120, diet: "vegan", spicy: 3, allergens: ["gluten"] },
      { name: "Chicken Frankie", description: "Tandoori chicken, onions and mint mayo rolled in a flaky paratha.", price: 170, diet: "nonveg", spicy: 1, allergens: ["gluten", "egg"] },
    ],
  },
  {
    name: "Sandwiches & Bowls",
    items: [
      { name: "Bombay Masala Toast", description: "Grilled with spiced potato, beetroot, cucumber and green chutney.", price: 130, diet: "veg", allergens: ["gluten", "dairy"] },
      { name: "Paneer Tikka Sandwich", description: "Charred paneer, peppers, mint mayo on sourdough.", price: 180, diet: "veg", spicy: 1, allergens: ["gluten", "dairy"] },
      { name: "Butter Chicken Rice Bowl", description: "Slow-cooked makhani gravy, jeera rice, pickled onions.", price: 240, diet: "nonveg", allergens: ["dairy", "nuts"], bestseller: true, sizes: [["Regular", 240], ["Large", 320]] },
      { name: "Rajma Chawal Bowl", description: "Home-style kidney bean curry with steamed rice.", price: 180, diet: "vegan", soldOut: true },
    ],
  },
  {
    name: "Desserts",
    items: [
      { name: "Gulab Jamun (2 pc)", description: "Warm, syrup-soaked, with a hint of rose.", price: 70, diet: "veg", allergens: ["dairy", "gluten"] },
      { name: "Chocolate Brownie", description: "Fudgy, baked in-house.", price: 110, diet: "egg", allergens: ["egg", "gluten", "dairy"], addons: [{ name: "Make it à la mode", min: 0, max: 1, options: [["Vanilla ice cream", 40]] }] },
    ],
  },
];

export const DEMO_RESTAURANT = {
  slug: "demo",
  name: "Chai & Crumbs",
  tagline: "Neighbourhood café · chai, street food & slow mornings",
  description:
    "A sample café created to show what a MenuPage looks like. Browse the menu, add a few items and try ordering on WhatsApp — the message opens prefilled, ready to send.",
  cuisine: "Café · Street food",
  currency: "INR",
  timezone: "Asia/Kolkata",
  theme: "classic" as const,
  phone: "+91 20 0000 0000",
  whatsapp: "910000000000",
  instagram: "menupage",
  address: "Sample address, Pune, Maharashtra, India",
  mapsUrl: "https://maps.google.com/?q=Pune",
  hours: ((): WeeklyHours => {
    const h = defaultHours();
    for (const d of Object.keys(h) as (keyof WeeklyHours)[]) h[d] = { closed: false, ranges: [{ open: "08:00", close: "23:00" }] };
    h.mon = { closed: true, ranges: [] };
    return h;
  })(),
};
