/**
 * UPI (India) "pay to VPA" links. No gateway, no fees: the guest's UPI app
 * (GPay, PhonePe, Paytm, BHIM…) opens with the payee and exact amount filled in.
 * Spec: NPCI "UPI Linking Specs" — upi://pay?pa=&pn=&am=&cu=INR&tn=
 */

/** handle@bank, e.g. cafe@okaxis, 9876543210@ybl */
export const UPI_ID_RE = /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z][a-zA-Z0-9.-]{1,63}$/;

export function normalizeUpiId(input: string | null | undefined): string | null {
  const v = (input ?? "").trim();
  if (!v) return null;
  return UPI_ID_RE.test(v) ? v : null;
}

/** UPI is only offered for INR menus. */
export function upiAvailable(currency: string, upiId: string | null | undefined): boolean {
  return currency === "INR" && !!normalizeUpiId(upiId);
}

export function buildUpiLink(opts: { upiId: string; payeeName: string; amountMinor: number; note?: string | null }): string | null {
  const pa = normalizeUpiId(opts.upiId);
  if (!pa || !Number.isSafeInteger(opts.amountMinor) || opts.amountMinor <= 0) return null;
  const params = new URLSearchParams();
  params.set("pa", pa);
  params.set("pn", opts.payeeName.replace(/[^\p{L}\p{N} .&'-]/gu, "").slice(0, 50) || "Restaurant");
  params.set("am", (opts.amountMinor / 100).toFixed(2));
  params.set("cu", "INR");
  const tn = opts.note?.replace(/[^\p{L}\p{N} #.,:-]/gu, "").slice(0, 60);
  if (tn) params.set("tn", tn);
  // URLSearchParams encodes spaces as "+"; UPI apps expect %20.
  return `upi://pay?${params.toString().replace(/\+/g, "%20")}`;
}
