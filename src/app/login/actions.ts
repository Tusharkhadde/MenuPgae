"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";
import { signIn } from "@/auth";
import { clientIp, rateLimit } from "@/lib/rate-limit";

function safeRedirect(to: FormDataEntryValue | null): string {
  const v = typeof to === "string" ? to : "";
  return v.startsWith("/") && !v.startsWith("//") ? v : "/dashboard";
}

export async function signInWithGoogle(formData: FormData) {
  await signIn("google", { redirectTo: safeRedirect(formData.get("redirectTo")) });
}

export async function signInWithEmail(formData: FormData) {
  const email = z.email().safeParse(String(formData.get("email") ?? "").trim().toLowerCase());
  if (!email.success) redirect("/login?error=InvalidEmail");
  const ip = clientIp(await headers());
  if (!rateLimit(`magic:${ip}`, 5, 15 * 60_000).ok || !rateLimit(`magic:${email.data}`, 3, 15 * 60_000).ok) {
    redirect("/login?error=TooMany");
  }
  try {
    await signIn("resend", { email: email.data, redirectTo: safeRedirect(formData.get("redirectTo")) });
  } catch (err) {
    if (err instanceof AuthError) redirect("/login?error=EmailSignin");
    throw err;
  }
}

export async function signInAsDemo() {
  try {
    await signIn("demo", { redirectTo: "/dashboard" });
  } catch (err) {
    if (err instanceof AuthError) redirect("/login?error=DemoLimit");
    throw err;
  }
}
