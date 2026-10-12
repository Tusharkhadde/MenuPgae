import Link from "next/link";
import { MapPinIcon, NavigationIcon, PhoneIcon, StarIcon } from "lucide-react";
import type { PublicMenu } from "@/server/public-menu";
import { DAYS, DAY_LABELS, formatTime, toOpeningHoursSpecification } from "@/lib/hours";
import { minorDigits } from "@/lib/money";
import { whatsappLink } from "@/lib/whatsapp";
import { MenuBrowser, WhatsAppIcon } from "@/components/menu/menu-browser";
import { OpenStatusBadge } from "@/components/menu/open-status";
import { TodayHighlighter } from "@/components/menu/today-highlighter";
import { siteUrl } from "@/lib/site-url";

export function buildJsonLd(menu: PublicMenu, pageUrl: string) {
  const r = menu.restaurant;
  const digits = minorDigits(r.currency);
  return {
    "@context": "https://schema.org",
    "@type": "Restaurant",
    name: r.name,
    url: pageUrl,
    ...(r.description || r.tagline ? { description: r.description ?? r.tagline } : {}),
    ...(r.cuisine ? { servesCuisine: r.cuisine } : {}),
    ...(r.logoUrl ? { logo: r.logoUrl } : {}),
    ...(r.coverUrl || r.logoUrl ? { image: [r.coverUrl, r.logoUrl].filter(Boolean) } : {}),
    ...(r.phone ? { telephone: r.phone } : {}),
    ...(r.address ? { address: { "@type": "PostalAddress", streetAddress: r.address } } : {}),
    ...(r.mapsUrl ? { hasMap: r.mapsUrl } : {}),
    currenciesAccepted: r.currency,
    openingHoursSpecification: toOpeningHoursSpecification(r.hours),
    sameAs: [r.instagram ? `https://instagram.com/${r.instagram}` : null, r.googleReviewsUrl, r.zomatoUrl, r.swiggyUrl, r.uberEatsUrl].filter(Boolean),
    hasMenu: {
      "@type": "Menu",
      name: `${r.name} menu`,
      hasMenuSection: menu.categories.map((c) => ({
        "@type": "MenuSection",
        name: c.name,
        ...(c.description ? { description: c.description } : {}),
        hasMenuItem: c.items.map((i) => ({
          "@type": "MenuItem",
          name: i.name,
          ...(i.description ? { description: i.description } : {}),
          ...(i.imageUrl ? { image: i.imageUrl } : {}),
          ...(i.diet === "vegan"
            ? { suitableForDiet: "https://schema.org/VeganDiet" }
            : i.diet === "veg"
              ? { suitableForDiet: "https://schema.org/VegetarianDiet" }
              : {}),
          offers: {
            "@type": "Offer",
            price: (i.priceMinor / 10 ** digits).toFixed(digits),
            priceCurrency: r.currency,
            availability: i.soldOut ? "https://schema.org/OutOfStock" : "https://schema.org/InStock",
          },
        })),
      })),
    },
  };
}

export function MenuPageView({ menu, pageUrl }: { menu: PublicMenu; pageUrl: string }) {
  const r = menu.restaurant;
  const wa = r.whatsapp ? whatsappLink(r.whatsapp) : null;
  const delivery = [
    r.swiggyUrl && { label: "Swiggy", href: r.swiggyUrl, color: "#fc8019" },
    r.zomatoUrl && { label: "Zomato", href: r.zomatoUrl, color: "#e23744" },
    r.uberEatsUrl && { label: "Uber Eats", href: r.uberEatsUrl, color: "#06c167" },
  ].filter(Boolean) as { label: string; href: string; color: string }[];
  const actions = [
    r.phone && { label: "Call", href: `tel:${r.phone.replace(/[^\d+]/g, "")}`, icon: PhoneIcon },
    wa && { label: "WhatsApp", href: wa, icon: WhatsAppIcon },
    r.mapsUrl && { label: "Directions", href: r.mapsUrl, icon: NavigationIcon },
    r.instagram && { label: "Instagram", href: `https://instagram.com/${r.instagram}`, icon: InstagramIcon },
    r.googleReviewsUrl && { label: "Review", href: r.googleReviewsUrl, icon: StarIcon },
  ].filter(Boolean) as { label: string; href: string; icon: React.ComponentType<{ className?: string }> }[];

  const jsonLd = JSON.stringify(buildJsonLd(menu, pageUrl)).replace(/</g, "\\u003c");

  return (
    <div className="menu-theme min-h-dvh" data-theme={r.theme}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
      {menu.isDemo && (
        <div className="bg-[var(--m-text)] px-4 py-2 text-center text-xs text-[var(--m-bg)]">
          This is a sample restaurant made with MenuPage.{" "}
          <Link href={`${siteUrl()}/login?intent=signup`} className="font-semibold underline underline-offset-2">Create yours free →</Link>
        </div>
      )}

      {/* Cover */}
      <header className="relative">
        <div className="h-44 w-full overflow-hidden sm:h-64">
          {r.coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- owner-uploaded image from storage bucket
            <img src={r.coverUrl} alt="" className="size-full object-cover" fetchPriority="high" />
          ) : (
            <div className="size-full bg-[linear-gradient(135deg,var(--m-accent),color-mix(in_oklab,var(--m-accent)_55%,#f59e0b))]">
              <div className="bg-grid size-full opacity-40" />
            </div>
          )}
        </div>
        <div className="mx-auto max-w-3xl px-4">
          <div className="-mt-12 flex items-end gap-4">
            <div className="grid size-24 shrink-0 place-items-center overflow-hidden rounded-3xl border-4 border-[var(--m-bg)] bg-[var(--m-surface)] shadow-lg">
              {r.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- owner-uploaded image from storage bucket
                <img src={r.logoUrl} alt={`${r.name} logo`} className="size-full object-cover" />
              ) : (
                <span className="menu-heading text-3xl font-bold text-[var(--m-accent)]">{r.name.slice(0, 1)}</span>
              )}
            </div>
          </div>
          <h1 className="menu-heading mt-4 text-balance text-3xl font-semibold leading-tight sm:text-4xl">{r.name}</h1>
          {(r.tagline || r.cuisine) && <p className="mt-1 text-[var(--m-muted)]">{r.tagline ?? r.cuisine}</p>}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <OpenStatusBadge hours={r.hours} timezone={r.timezone} />
            {r.tagline && r.cuisine && <span className="text-sm text-[var(--m-muted)]">{r.cuisine}</span>}
          </div>

          {actions.length > 0 && (
            <div className="no-scrollbar mt-5 flex gap-2 overflow-x-auto pb-1">
              {actions.map((a) => (
                <a
                  key={a.label}
                  href={a.href}
                  target={a.href.startsWith("tel:") ? undefined : "_blank"}
                  rel="noopener noreferrer"
                  className="flex shrink-0 items-center gap-2 rounded-xl border border-[var(--m-border)] bg-[var(--m-surface)] px-3.5 py-2 text-sm font-medium transition-colors hover:border-[var(--m-accent)]"
                >
                  <a.icon className="size-4" /> {a.label}
                </a>
              ))}
            </div>
          )}
          {delivery.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
              <span className="text-[var(--m-muted)]">Also on</span>
              {delivery.map((d) => (
                <a key={d.label} href={d.href} target="_blank" rel="noopener noreferrer" className="rounded-full px-3 py-1 text-xs font-semibold text-white" style={{ background: d.color }}>
                  {d.label}
                </a>
              ))}
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 pb-16 pt-4">
        {menu.categories.length > 0 ? (
          <MenuBrowser
            demo={menu.isDemo}
            restaurant={{
              id: r.id,
              slug: r.slug,
              name: r.name,
              currency: r.currency,
              timezone: r.timezone,
              hours: r.hours,
              whatsapp: r.whatsapp,
              whatsappOrdering: r.whatsappOrdering,
            }}
            categories={menu.categories.map((c) => ({
              id: c.id,
              name: c.name,
              description: c.description,
              items: c.items.map((i) => ({
                id: i.id,
                name: i.name,
                description: i.description,
                priceMinor: i.priceMinor,
                imageUrl: i.imageUrl,
                diet: i.diet,
                spicy: i.spicy,
                allergens: i.allergens,
                bestseller: i.bestseller,
                soldOut: i.soldOut,
              })),
            }))}
          />
        ) : (
          <p className="mt-10 rounded-2xl border border-dashed border-[var(--m-border)] p-10 text-center text-[var(--m-muted)]">The menu is being updated. Check back soon!</p>
        )}

        {/* Info */}
        <section id="info" className="mt-16 grid gap-4 sm:grid-cols-2">
          {r.description && (
            <div className="rounded-2xl border border-[var(--m-border)] bg-[var(--m-surface)] p-5 sm:col-span-2">
              <h2 className="menu-heading text-xl font-semibold">About</h2>
              <p className="mt-2 whitespace-pre-line text-[15px] leading-relaxed text-[var(--m-muted)]">{r.description}</p>
            </div>
          )}
          {r.hours && (
            <div className="rounded-2xl border border-[var(--m-border)] bg-[var(--m-surface)] p-5">
              <h2 className="menu-heading text-xl font-semibold">Opening hours</h2>
              <TodayHighlighter timezone={r.timezone}>
                <dl className="mt-3 space-y-1.5 text-sm">
                  {DAYS.map((d) => (
                    <div key={d} data-day={d} className="flex justify-between gap-4 rounded-md px-2 py-0.5 data-[today=true]:bg-[var(--m-chip)] data-[today=true]:font-semibold">
                      <dt>{DAY_LABELS[d]}</dt>
                      <dd className="text-right text-[var(--m-muted)]">
                        {r.hours![d].closed || r.hours![d].ranges.length === 0
                          ? "Closed"
                          : r.hours![d].ranges.map((x) => `${formatTime(x.open)} – ${formatTime(x.close)}`).join(", ")}
                      </dd>
                    </div>
                  ))}
                </dl>
              </TodayHighlighter>
            </div>
          )}
          {(r.address || r.phone) && (
            <div className="rounded-2xl border border-[var(--m-border)] bg-[var(--m-surface)] p-5">
              <h2 className="menu-heading text-xl font-semibold">Find us</h2>
              {r.address && (
                <p className="mt-3 flex gap-2 text-sm text-[var(--m-muted)]">
                  <MapPinIcon className="mt-0.5 size-4 shrink-0" /> <span className="whitespace-pre-line">{r.address}</span>
                </p>
              )}
              {r.phone && (
                <p className="mt-2 flex gap-2 text-sm">
                  <PhoneIcon className="mt-0.5 size-4 shrink-0 text-[var(--m-muted)]" />
                  <a href={`tel:${r.phone.replace(/[^\d+]/g, "")}`} className="underline-offset-2 hover:underline">{r.phone}</a>
                </p>
              )}
              {r.mapsUrl && (
                <a href={r.mapsUrl} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex h-10 items-center gap-2 rounded-xl bg-[var(--m-accent)] px-4 text-sm font-semibold text-[var(--m-accent-text)]">
                  <NavigationIcon className="size-4" /> Get directions
                </a>
              )}
            </div>
          )}
        </section>

        <footer className="mt-12 flex flex-col items-center gap-3 text-center text-xs text-[var(--m-muted)]">
          <p>Prices include applicable taxes unless stated otherwise. Please tell staff about any allergies.</p>
          {menu.showBadge && (
            <a href={`${siteUrl()}/?ref=${encodeURIComponent(r.slug)}`} className="inline-flex items-center gap-1.5 rounded-full border border-[var(--m-border)] bg-[var(--m-surface)] px-3 py-1.5 font-medium text-[var(--m-text)]">
              <span className="grid size-4 place-items-center rounded bg-[#ea580c] text-[9px] font-bold text-white">M</span>
              Made with MenuPage
            </a>
          )}
        </footer>
      </main>
    </div>
  );
}

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.6" fill="currentColor" />
    </svg>
  );
}
