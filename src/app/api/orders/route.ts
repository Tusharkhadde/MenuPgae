import { NextResponse } from "next/server";
import { z } from "zod";
import { placeOrderSchema, OrderError } from "@/lib/order";
import { placeOrder } from "@/server/orders";
import { guardPublicPost, jsonError } from "@/server/public-api";

const schema = placeOrderSchema.extend({ ref: z.string().max(8).nullable().optional() });

/** Guest places an order: re-priced from the database, saved for the dashboard inbox. */
export async function POST(request: Request) {
  const g = await guardPublicPost(request, "order", 8, 10 * 60_000);
  if ("error" in g) return g.error;
  const parsed = schema.safeParse(g.body);
  if (!parsed.success) return jsonError("Please check your order and try again.");
  try {
    const order = await placeOrder(parsed.data);
    return NextResponse.json({
      ok: true,
      order: { id: order.id, number: order.number, ref: order.ref, totalMinor: order.totalMinor, subtotalMinor: order.subtotalMinor, discountMinor: order.discountMinor, lines: order.lines },
    });
  } catch (err) {
    if (err instanceof OrderError) return jsonError(err.message, 422);
    console.error("[menupage] order failed", err);
    return jsonError("Couldn't place the order. Please try again.", 500);
  }
}
