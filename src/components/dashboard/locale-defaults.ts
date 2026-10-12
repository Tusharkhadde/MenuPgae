export function guessTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata";
  } catch {
    return "Asia/Kolkata";
  }
}

export function currencyForTimezone(tz: string): string {
  if (tz === "Asia/Kolkata" || tz === "Asia/Calcutta") return "INR";
  if (tz === "Asia/Dubai") return "AED";
  if (tz === "Asia/Singapore") return "SGD";
  if (tz === "Asia/Riyadh") return "SAR";
  if (tz === "Asia/Qatar") return "QAR";
  if (tz === "Asia/Kuala_Lumpur") return "MYR";
  if (tz === "Asia/Bangkok") return "THB";
  if (tz === "Asia/Jakarta") return "IDR";
  if (tz === "Asia/Tokyo") return "JPY";
  if (tz === "Europe/London") return "GBP";
  if (tz === "Europe/Zurich") return "CHF";
  if (tz.startsWith("Europe/")) return "EUR";
  if (tz.startsWith("Australia/")) return "AUD";
  if (tz === "America/Toronto" || tz === "America/Vancouver") return "CAD";
  if (tz.startsWith("America/")) return "USD";
  return "INR";
}

export function allTimezones(): string[] {
  try {
    return (Intl as unknown as { supportedValuesOf(k: string): string[] }).supportedValuesOf("timeZone");
  } catch {
    return ["Asia/Kolkata", "Asia/Dubai", "Asia/Singapore", "Europe/London", "Europe/Berlin", "America/New_York", "America/Los_Angeles"];
  }
}
