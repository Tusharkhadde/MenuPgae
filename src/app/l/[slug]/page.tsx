import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BookOpenIcon, NavigationIcon, PhoneIcon, StarIcon } from "lucide-react";
import { getPublicMenuBySlug } from "@/server/public-menu";
import { whatsappLink } from "@/lib/whatsapp";
import { siteUrl } from "@/lib/site-url";
import { OpenStatusBadge } from "@/components/menu/open-status";
import { WhatsAppIcon } from "@/components/menu/menu-shared";
import { ReserveButton } from "@/components/menu/menu-guest";

export const revalidate = 300;

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const menu = await getPublicMenuBySlug(slug);
  if (!menu) return { title: "Not found", robots: { index: false } };
  const r = menu.restaurant;
  return {
    title: { absolute: `${r.name} — Links` },
    description: r.tagline ?? `Menu, ordering, directions and more for ${r.name}.`,
    alternates: { canonical: `${siteUrl()}/l/${r.slug}` },
    icons: r.logoUrl ? { icon: r.logoUrl } : undefined,
  };
}

/** Link-in-bio page for Instagram / WhatsApp Business profiles. */
export default async function LinksPage({ params }: Props) {
  const { slug } = await params;
  const menu = await getPublicMenuBySlug(slug);
  if (!menu) notFound();
  const r = menu.restaurant;
  const wa = r.whatsapp ? whatsappLink(r.whatsapp, `Hi ${r.name}!`) : null;
  const links = [
    { href: `/r/${r.slug}`, label: "View menu & order", icon: BookOpenIcon, primary: true, external: false },
    wa && { href: wa, label: "Chat on WhatsApp", icon: WhatsAppIcon, external: true },
    r.phone && { href: `tel:${r.phone.replace(/[^\d+]/g, "")}`, label: `Call ${r.phone}`, icon: PhoneIcon, external: false },
    r.mapsUrl && { href: r.mapsUrl, label: "Directions", icon: NavigationIcon, external: true },
    r.googleReviewsUrl && { href: r.googleReviewsUrl, label: "Leave a Google review", icon: StarIcon, external: true },
    r.swiggyUrl && { href: r.swiggyUrl, label: "Order on Swiggy", external: true },
    r.zomatoUrl && { href: r.zomatoUrl, label: "Order on Zomato", external: true },
    r.uberEatsUrl && { href: r.uberEatsUrl, label: "Order on Uber Eats", external: true },
    r.instagram && { href: `https://instagram.com/${r.instagram}`, label: `@${r.instagram} on Instagram`, external: true },
  ].filter(Boolean) as { href: string; label: string; icon?: React.ComponentType<{ className?: string }>; primary?: boolean; external: boolean }[];

  return (
    <div className="menu-theme min-h-dvh" data-theme={r.theme}>
      <main className="mx-auto flex max-w-md flex-col items-center px-5 py-12 text-center">
        <div className="grid size-24 place-items-center overflow-hidden rounded-3xl border-4 border-[var(--m-surface)] bg-[var(--m-surface)] shadow-lg">
          {r.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- owner-uploaded image
            <img src={r.logoUrl} alt={`${r.name} logo`} className="size-full object-cover" />
          ) : (
            <span className="menu-heading text-3xl font-bold text-[var(--m-accent)]">{r.name.slice(0, 1)}</span>
          )}
        </div>
        <h1 className="menu-heading mt-4 text-3xl font-semibold">{r.name}</h1>
        {(r.tagline || r.cuisine) && <p className="mt-1 text-[var(--m-muted)]">{r.tagline ?? r.cuisine}</p>}
        <div className="mt-3"><OpenStatusBadge hours={r.hours} timezone={r.timezone} /></div>
        {r.promoBanner && <p className="mt-4 rounded-xl bg-[var(--m-chip)] px-4 py-2 text-sm font-medium">{r.promoBanner}</p>}
        <ul className="mt-6 w-full space-y-3">
          {links.map((l) => (
            <li key={l.label}>
              {l.external ? (
                <a href={l.href} target="_blank" rel="noopener noreferrer" className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl border border-[var(--m-border)] bg-[var(--m-surface)] font-semibold transition-colors hover:border-[var(--m-accent)]">
                  {l.icon && <l.icon className="size-5" />} {l.label}
                </a>
              ) : (
                <Link
                  href={l.href}
                  className={
                    l.primary
                      ? "flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[var(--m-accent)] font-semibold text-[var(--m-accent-text)]"
                      : "flex h-14 w-full items-center justify-center gap-2 rounded-2xl border border-[var(--m-border)] bg-[var(--m-surface)] font-semibold transition-colors hover:border-[var(--m-accent)]"
                  }
                >
                  {l.icon && <l.icon className="size-5" />} {l.label}
                </Link>
              )}
            </li>
          ))}
          {menu.features.reservations && (
            <li className="flex justify-center [&>button]:h-14 [&>button]:w-full [&>button]:justify-center [&>button]:rounded-2xl [&>button]:font-semibold">
              <ReserveButton restaurant={{ id: r.id, name: r.name, timezone: r.timezone, whatsapp: r.whatsapp }} />
            </li>
          )}
        </ul>
        {menu.showBadge && (
          <a href={`${siteUrl()}/?ref=${encodeURIComponent(r.slug)}`} className="mt-10 text-xs text-[var(--m-muted)] underline-offset-2 hover:underline">Made with MenuPage</a>
        )}
      </main>
    </div>
  );
}
