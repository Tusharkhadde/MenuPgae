import Link from "next/link";
import { Logo } from "@/components/brand/logo";

export function SiteFooter() {
  return (
    <footer className="border-t border-border/60">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
        <div className="space-y-3">
          <Logo />
          <p className="max-w-xs text-sm text-muted-foreground">
            QR menus and one-page websites for restaurants, cafés and food stalls — made to load fast on any phone.
          </p>
        </div>
        <FooterCol title="Product" links={[["Features", "/#features"], ["Pricing", "/pricing"]]} />
        <FooterCol title="Help" links={[["FAQ", "/#faq"], ["Sign in", "/login"]]} />
        <FooterCol title="Legal" links={[["Terms", "/terms"], ["Privacy", "/privacy"]]} />
      </div>
      <div className="border-t border-border/60">
        <p className="mx-auto max-w-6xl px-4 py-6 text-xs text-muted-foreground sm:px-6">© {new Date().getFullYear()} MenuPage</p>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <p className="mb-3 text-sm font-medium">{title}</p>
      <ul className="space-y-2">
        {links.map(([label, href]) => (
          <li key={href}>
            <Link href={href} className="text-sm text-muted-foreground transition-colors hover:text-foreground">
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
