/**
 * Multi-language menus. The restaurant's main language is whatever the owner
 * typed into name/description; extra languages are stored per item/category
 * in a `translations` JSON column: { hi: { name, description }, ar: {...} }.
 */
export const MENU_LANGUAGES = [
  { code: "en", label: "English", native: "English", rtl: false },
  { code: "hi", label: "Hindi", native: "हिन्दी", rtl: false },
  { code: "mr", label: "Marathi", native: "मराठी", rtl: false },
  { code: "ta", label: "Tamil", native: "தமிழ்", rtl: false },
  { code: "kn", label: "Kannada", native: "ಕನ್ನಡ", rtl: false },
  { code: "gu", label: "Gujarati", native: "ગુજરાતી", rtl: false },
  { code: "ar", label: "Arabic", native: "العربية", rtl: true },
  { code: "fr", label: "French", native: "Français", rtl: false },
  { code: "de", label: "German", native: "Deutsch", rtl: false },
  { code: "es", label: "Spanish", native: "Español", rtl: false },
  { code: "it", label: "Italian", native: "Italiano", rtl: false },
  { code: "zh", label: "Chinese", native: "中文", rtl: false },
  { code: "ms", label: "Malay", native: "Bahasa Melayu", rtl: false },
] as const;

export type LanguageCode = (typeof MENU_LANGUAGES)[number]["code"];
export const LANGUAGE_CODES = MENU_LANGUAGES.map((l) => l.code) as [LanguageCode, ...LanguageCode[]];

export type Translation = { name?: string | null; description?: string | null };
export type Translations = Partial<Record<LanguageCode, Translation>>;

export function isLanguageCode(v: unknown): v is LanguageCode {
  return typeof v === "string" && (LANGUAGE_CODES as readonly string[]).includes(v);
}

export function languageInfo(code: string) {
  return MENU_LANGUAGES.find((l) => l.code === code) ?? MENU_LANGUAGES[0];
}

export function isRtl(code: string): boolean {
  return languageInfo(code).rtl;
}

/** Pick the translated text, falling back to the original for anything missing. */
export function localize<T extends { name: string; description: string | null }>(
  row: T & { translations?: Translations | null },
  lang: string | null | undefined,
): { name: string; description: string | null } {
  if (!lang || !isLanguageCode(lang)) return { name: row.name, description: row.description };
  const t = row.translations?.[lang];
  return { name: t?.name?.trim() || row.name, description: t?.description?.trim() || row.description };
}

/** Drop empty strings / unknown languages so the stored JSON stays tidy. */
export function cleanTranslations(input: unknown, allowed: readonly string[]): Translations {
  const out: Translations = {};
  if (!input || typeof input !== "object") return out;
  for (const [code, v] of Object.entries(input as Record<string, unknown>)) {
    if (!isLanguageCode(code) || !allowed.includes(code) || !v || typeof v !== "object") continue;
    const name = typeof (v as Translation).name === "string" ? (v as Translation).name!.trim().slice(0, 100) : "";
    const description = typeof (v as Translation).description === "string" ? (v as Translation).description!.trim().slice(0, 400) : "";
    if (name || description) out[code] = { ...(name ? { name } : {}), ...(description ? { description } : {}) };
  }
  return out;
}

/** Small UI strings on the public page. Falls back to English. */
const UI: Record<string, Partial<Record<LanguageCode, string>>> = {
  search: { hi: "व्यंजन खोजें", mr: "पदार्थ शोधा", ar: "ابحث عن طبق", fr: "Rechercher un plat", de: "Gericht suchen", es: "Buscar platos", it: "Cerca piatti" },
  add: { hi: "जोड़ें", mr: "जोडा", ar: "أضف", fr: "Ajouter", de: "Hinzufügen", es: "Añadir", it: "Aggiungi" },
  soldOut: { hi: "खत्म", mr: "संपले", ar: "نفد", fr: "Épuisé", de: "Ausverkauft", es: "Agotado", it: "Esaurito" },
  viewOrder: { hi: "ऑर्डर देखें", mr: "ऑर्डर पहा", ar: "عرض الطلب", fr: "Voir la commande", de: "Bestellung ansehen", es: "Ver pedido", it: "Vedi ordine" },
  special: { hi: "आज का स्पेशल", mr: "आजचे स्पेशल", ar: "طبق اليوم", fr: "Plat du jour", de: "Tagesgericht", es: "Especial del día", it: "Piatto del giorno" },
};

export function ui(key: keyof typeof UI, lang: string, fallback: string): string {
  return (isLanguageCode(lang) && UI[key]?.[lang]) || fallback;
}
