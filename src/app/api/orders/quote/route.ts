import { NextResponse } from "next/server";
import { placeOrderSchema, OrderError } from "@/lib/order";
import { quoteOrder } from "@/server/orders";
import { guardPublicPost, jsonError } from "@/server/public-api";

/** Price a cart (happy hour, coupon) without saving anything. */
export async function POST(request: Request) {
  const g = await guardPublicPost(request, "quote", 30, 60_000);
  if ("error" in g) return g.error;
  const parsed = placeOrderSchema.safeParse(g.body);
  if (!parsed.success) return jsonError("Please check your order and try again.");
  try {
    const { priced } = await quoteOrder(parsed.data);
    return NextResponse.json({ ok: true, quote: priced });
  } catch (err) {
    if (err instanceof OrderError) return jsonError(err.message, 422);
    console.error("[menupage] quote failed", err);
    return jsonError("Couldn't check your order. Please try again.", 500);
  }
}
