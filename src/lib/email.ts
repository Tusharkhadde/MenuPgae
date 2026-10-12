export function magicLinkEmail(url: string) {
  const subject = "Your MenuPage sign-in link";
  const text = `Sign in to MenuPage:\n${url}\n\nThis link expires in 24 hours. If you didn't request it, you can ignore this email.`;
  const html = `<!doctype html><html><body style="margin:0;background:#faf7f2;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1c1917">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px"><tr><td align="center">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:440px;background:#ffffff;border:1px solid #eee7dd;border-radius:16px;padding:32px">
  <tr><td style="font-size:18px;font-weight:700;padding-bottom:8px">MenuPage</td></tr>
  <tr><td style="font-size:15px;line-height:1.6;color:#44403c;padding-bottom:24px">Tap the button below to sign in. The link works once and expires in 24 hours.</td></tr>
  <tr><td><a href="${url}" style="display:inline-block;background:#ea580c;color:#ffffff;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:10px">Sign in to MenuPage</a></td></tr>
  <tr><td style="font-size:12px;color:#a8a29e;padding-top:24px">If you didn't request this, you can safely ignore this email.</td></tr>
  </table></td></tr></table></body></html>`;
  return { subject, html, text };
}
