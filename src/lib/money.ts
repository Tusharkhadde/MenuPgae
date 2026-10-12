/** Currencies offered in the onboarding wizard (India first, then EU/UK, Gulf, SEA, NA, AU). */
export const CURRENCIES = [
  { code: "INR", label: "Indian Rupee (₹)", locale: "en-IN" },
  { code: "USD", label: "US Dollar ($)", locale: "en-US" },
  { code: "EUR", label: "Euro (€)", locale: "en-IE" },
  { code: "GBP", label: "British Pound (£)", locale: "en-GB" },
  { code: "AED", label: "UAE Dirham (AED)", locale: "en-AE" },
  { code: "SGD", label: "Singapore Dollar (S$)", locale: "en-SG" },
  { code: "AUD", label: "Australian Dollar (A$)", locale: "en-AU" },
  { code: "CAD", label: "Canadian Dollar (C$)", locale: "en-CA" },
  { code: "SAR", label: "Saudi Riyal (SAR)", locale: "en-SA" },
  { code: "QAR", label: "Qatari Riyal (QAR)", locale: "en-QA" },
  { code: "MYR", label: "Malaysian Ringgit (RM)", locale: "en-MY" },
  { code: "THB", label: "Thai Baht (฿)", locale: "th-TH" },
  { code: "IDR", label: "Indonesian Rupiah (Rp)", locale: "id-ID" },
  { code: "JPY", label: "Japanese Yen (¥)", locale: "ja-JP" },
  { code: "CHF", label: "Swiss Franc (CHF)", locale: "de-CH" },
] as const;

export type CurrencyCode = (typeof CURRENCIES)[number]["code"];
export const CURRENCY_CODES = CURRENCIES.map((c) => c.code) as [CurrencyCode, ...CurrencyCode[]];

export function currencyLocale(code: string): string {
  return CURRENCIES.find((c) => c.code === code)?.locale ?? "en-US";
}

/** Number of minor-unit digits (2 for INR/USD, 0 for JPY, …). */
export function minorDigits(code: string): number {
  try {
    return new Intl.NumberFormat("en", { style: "currency", currency: code }).resolvedOptions()
      .maximumFractionDigits ?? 2;
  } catch {
    return 2;
  }
}

export function formatMoney(minor: number, code: string, locale = currencyLocale(code)): string {
  const digits = minorDigits(code);
  const value = minor / 10 ** digits;
  const whole = Number.isInteger(value);
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: code,
      minimumFractionDigits: whole ? 0 : digits,
      maximumFractionDigits: digits,
    }).format(value);
  } catch {
    return `${code} ${value.toFixed(digits)}`;
  }
}

/** Parse a user-typed price ("149", "149.50", "1,299") into minor units; null if invalid. */
export function parsePriceToMinor(input: string | number, code: string): number | null {
  const digits = minorDigits(code);
  const text = String(input).trim().replace(/[,\s]/g, "");
  if (!/^\d+(\.\d+)?$/.test(text)) return null;
  const [int, frac = ""] = text.split(".");
  if (frac.length > digits) return null;
  const minor = Number(int) * 10 ** digits + Number((frac + "0".repeat(digits)).slice(0, digits) || 0);
  if (!Number.isSafeInteger(minor) || minor > 100_000_000_00) return null;
  return minor;
}

export function minorToInput(minor: number, code: string): string {
  const digits = minorDigits(code);
  const v = minor / 10 ** digits;
  return Number.isInteger(v) ? String(v) : v.toFixed(digits);
}
