import "server-only";
import { env, features } from "@/lib/env";

export type SendResult = { sent: true } | { sent: false; reason: "not_configured" | "failed" };

/**
 * Send a transactional email through Resend's REST API (free tier: 3,000/month).
 * Without AUTH_RESEND_KEY nothing is sent and the caller carries on.
 */
export async function sendEmail(msg: { to: string; subject: string; html: string; text: string; replyTo?: string | null }): Promise<SendResult> {
  if (!features.resend()) {
    if (process.env.NODE_ENV !== "production") console.info(`[menupage] (email not configured) would send "${msg.subject}" to ${msg.to}`);
    return { sent: false, reason: "not_configured" };
  }
  const e = env();
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${e.AUTH_RESEND_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: e.EMAIL_FROM ?? "MenuPage <onboarding@resend.dev>",
        to: msg.to,
        subject: msg.subject,
        html: msg.html,
        text: msg.text,
        ...(msg.replyTo ? { reply_to: msg.replyTo } : {}),
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      console.error("[menupage] Resend error", res.status, await res.text().catch(() => ""));
      return { sent: false, reason: "failed" };
    }
    return { sent: true };
  } catch (err) {
    console.error("[menupage] email failed", err);
    return { sent: false, reason: "failed" };
  }
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/** Simple branded email shell shared by all transactional emails. */
export function emailShell(title: string, bodyHtml: string, cta?: { href: string; label: string }): string {
  return `<!doctype html><html><body style="margin:0;background:#faf7f2;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1c1917">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px"><tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#fff;border:1px solid #eee7dd;border-radius:16px;padding:28px">
<tr><td style="font-size:13px;font-weight:700;color:#ea580c;padding-bottom:6px">MenuPage</td></tr>
<tr><td style="font-size:20px;font-weight:700;padding-bottom:12px">${escapeHtml(title)}</td></tr>
<tr><td style="font-size:15px;line-height:1.6;color:#44403c">${bodyHtml}</td></tr>
${cta ? `<tr><td style="padding-top:20px"><a href="${cta.href}" style="display:inline-block;background:#ea580c;color:#fff;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:10px">${escapeHtml(cta.label)}</a></td></tr>` : ""}
</table></td></tr></table></body></html>`;
}
