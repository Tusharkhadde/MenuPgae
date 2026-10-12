export const THEME_IDS = ["classic", "midnight", "fresh", "street"] as const;
export type ThemeIdT = (typeof THEME_IDS)[number];

export const THEMES: Record<ThemeIdT, { name: string; description: string; swatch: [string, string, string] }> = {
  classic: { name: "Classic", description: "Warm cream, serif headings. Cafés & bakeries.", swatch: ["#fbf7f0", "#9a3412", "#1c1917"] },
  midnight: { name: "Midnight", description: "Dark and elegant. Bars, fine dining.", swatch: ["#0f0f12", "#e8b04b", "#f5f5f4"] },
  fresh: { name: "Fresh", description: "Light & green. Healthy food, juice bars.", swatch: ["#f6fbf6", "#15803d", "#14281a"] },
  street: { name: "Street", description: "Bold & bright. Street food, QSRs, trucks.", swatch: ["#fffbeb", "#dc2626", "#111111"] },
};
