import type { Metadata } from "next";
import { LegalPage } from "@/components/marketing/legal-page";

export const metadata: Metadata = { title: "Terms of Service" };

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service">
      <p><strong>Placeholder — replace with your own terms reviewed by a lawyer before launch.</strong></p>
      <h2>1. The service</h2>
      <p>MenuPage provides tools to publish restaurant menus and one-page websites, generate QR codes and receive order requests via WhatsApp. MenuPage does not process food orders or payments between restaurants and their customers.</p>
      <h2>2. Your account and content</h2>
      <p>You are responsible for the accuracy of your menu, prices, allergen information and business details, and for having the rights to any images you upload. Don&apos;t publish unlawful, misleading or infringing content.</p>
      <h2>3. Plans and billing</h2>
      <p>The Free plan is offered at no cost with the limits described on the pricing page. Paid plans are billed in advance through our payment provider (Dodo Payments) and renew until cancelled. You can cancel from the billing portal; access continues until the end of the paid period.</p>
      <h2>4. Availability</h2>
      <p>We aim to keep MenuPage available but provide it “as is” without warranties. We may change or discontinue features with reasonable notice.</p>
      <h2>5. Termination</h2>
      <p>You may delete your restaurant and account at any time. We may suspend accounts that violate these terms.</p>
      <h2>6. Liability</h2>
      <p>To the extent permitted by law, MenuPage is not liable for indirect or consequential losses, or for orders, payments or disputes between you and your customers.</p>
      <h2>7. Contact</h2>
      <p>Questions? Contact the operator of this service at the support email listed on this website.</p>
    </LegalPage>
  );
}
