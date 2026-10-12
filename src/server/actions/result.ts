import { z } from "zod";
import { LimitError } from "@/lib/limits";
import { AuthError } from "@/server/session";

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string; upgrade?: boolean };

export class UserError extends Error {}

export async function run<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (err) {
    if (err instanceof z.ZodError) {
      const issue = err.issues[0];
      const field = issue?.path.join(".");
      return { ok: false, error: field ? `${field}: ${issue.message}` : (issue?.message ?? "Invalid input") };
    }
    if (err instanceof LimitError) return { ok: false, error: err.message, upgrade: true };
    if (err instanceof AuthError || err instanceof UserError) return { ok: false, error: err.message };
    // Next.js control-flow errors (redirect/notFound) must propagate.
    if (err && typeof err === "object" && "digest" in err && typeof (err as { digest?: unknown }).digest === "string" && (err as { digest: string }).digest.startsWith("NEXT_")) throw err;
    if (err instanceof Error && "code" in err && (err as { code?: string }).code === "23505") {
      return { ok: false, error: "That's already taken." };
    }
    console.error("[menupage] action failed", err);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}
