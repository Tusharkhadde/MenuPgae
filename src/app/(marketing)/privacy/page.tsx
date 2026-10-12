import type { Metadata } from "next";
import { LegalPage } from "@/components/marketing/legal-page";

export const metadata: Metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy">
      <p><strong>Placeholder — replace with your own policy (consider GDPR for EU guests and India&apos;s DPDP Act) before launch.</strong></p>
      <h2>Restaurant owners</h2>
      <p>When you create an account we store your name, email address and (if you sign in with Google) your profile picture. We store the restaurant information and images you add. Payments are handled by Dodo Payments; we store only subscription status and customer identifiers, never card details.</p>
      <h2>Guests viewing a menu</h2>
      <p>Menu pages do not set cookies and do not use third-party trackers. We record anonymous, aggregate events — page views, QR scans and taps on “Order on WhatsApp” (including which dishes were in the cart and the table number) — without storing IP addresses, device identifiers or any personal data. Rate limiting uses IP addresses briefly in memory and does not persist them.</p>
      <h2>WhatsApp orders</h2>
      <p>When a guest taps “Order on WhatsApp”, the message is sent by the guest through WhatsApp directly to the restaurant. MenuPage does not receive or store the message or the guest&apos;s phone number.</p>
      <h2>Service providers</h2>
      <p>We use hosting (Vercel), a database (Neon), image storage (Cloudflare R2), email delivery (Resend) and payments (Dodo Payments) to run the service.</p>
      <h2>Your rights</h2>
      <p>You can export or delete your data by deleting your restaurant in the dashboard or by contacting us.</p>
    </LegalPage>
  );
}
