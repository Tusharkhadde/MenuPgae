"use server";

import { AuthError } from "next-auth";
import { notFound, redirect } from "next/navigation";
import { signIn } from "@/auth";
import { features } from "@/lib/env";

/** Judge demo sandbox sign-in. Only exists when DEMO_LOGIN_ENABLED=true. */
export async function signInAsDemo() {
  if (!features.demo()) notFound();
  try {
    await signIn("demo", { redirectTo: "/dashboard" });
  } catch (err) {
    if (err instanceof AuthError) redirect("/demo?error=limit");
    throw err;
  }
}
