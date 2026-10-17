import Link from "next/link";
import {
  BellRingIcon,
  ChefHatIcon,
  IndianRupeeIcon,
  LayersIcon,
  StarIcon,
  ArrowRightIcon,
  BarChart3Icon,
  ClockIcon,
  GlobeIcon,
  LeafIcon,
  MessageCircleIcon,
  PaletteIcon,
  QrCodeIcon,
  SearchIcon,
  SparklesIcon,
  ToggleRightIcon,
  UtensilsCrossedIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PhonePreview } from "@/components/marketing/phone-preview";
import { PricingCards } from "@/components/marketing/pricing-cards";
import { Faq } from "@/components/marketing/faq";

const FEATURES = [
  { icon: QrCodeIcon, title: "A QR code for every table", body: "Download print-ready PNG/SVG codes or print table tents straight from the dashboard. Each table's code tells you where the order came from." },
  { icon: MessageCircleIcon, title: "Orders on WhatsApp", body: "Guests build a cart and send it to your WhatsApp in one tap — items, quantities, total and table number already filled in." },
  { icon: ChefHatIcon, title: "Live orders inbox", body: "Every order also lands in your dashboard with a sound alert. Move it from new to preparing to ready, mark it paid, and see today's sales at a glance." },
  { icon: LayersIcon, title: "Sizes & add-ons", body: "Half/Full, S/M/L, extra cheese, choose-your-bread — priced correctly in the cart, the WhatsApp message and the kitchen ticket." },
  { icon: IndianRupeeIcon, title: "UPI pay, zero fees", body: "After ordering, guests get a UPI button and QR with the exact amount — paid straight to your account, no payment gateway." },
  { icon: BellRingIcon, title: "Call waiter & bill", body: "Guests at a table tap a button and your dashboard lights up with the table number." },
  { icon: StarIcon, title: "More Google reviews", body: "Happy guests are invited to review you on Google; unhappy guests tell you privately first." },
  { icon: SearchIcon, title: "Search & dietary filters", body: "Veg, non-veg, vegan and egg marks, spice levels, allergens and a search bar that finds a dish as you type." },
  { icon: ToggleRightIcon, title: "Sold out? One tap.", body: "Toggle dishes off when the kitchen runs out and back on tomorrow. Changes show up on the live menu right away." },
  { icon: ClockIcon, title: "Open-now badge", body: "Set your hours (split shifts and late nights included) and guests see whether you're open in your local time." },
  { icon: GlobeIcon, title: "Any currency, any country", body: "₹, $, €, £, AED, S$ and more — formatted the way your guests read prices." },
  { icon: PaletteIcon, title: "Four themes that look right", body: "Classic, Midnight, Fresh and Street. Add your logo and a cover photo and it feels like your place." },
  { icon: BarChart3Icon, title: "Analytics without cookies", body: "Page views, QR scans, WhatsApp order taps and your most-ordered dishes. No tracking of your guests." },
  { icon: SparklesIcon, title: "Ready for Google", body: "Search-friendly titles, restaurant & menu structured data, a sitemap and share previews for WhatsApp and Instagram." },
];

const STEPS = [
  { title: "Create your page", body: "Pick a name and a link like /r/your-cafe, choose your currency and a theme. Start blank, import a CSV, or start from an example menu and replace it with yours." },
  { title: "Add your dishes", body: "Categories, prices, photos and food marks. Drag to reorder. Hours, address, phone, WhatsApp and delivery-app links in one place." },
  { title: "Print the QR codes", body: "Put a code on each table, the counter and your Instagram bio. Update the menu anytime — the codes never change." },
];

export default function HomePage() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="bg-grid pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-4 pb-20 pt-16 sm:px-6 md:pt-24 lg:grid-cols-[1.15fr_1fr]">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border bg-card/80 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
              <UtensilsCrossedIcon className="size-3.5 text-primary" /> For restaurants, cafés &amp; food stalls
            </span>
            <h1 className="mt-6 text-balance text-4xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
              Your menu and website, <span className="text-primary">one QR code</span> away.
            </h1>
            <p className="mt-6 max-w-xl text-pretty text-lg leading-relaxed text-muted-foreground">
              MenuPage turns your menu into a fast, beautiful page guests open with their phone camera — with WhatsApp ordering,
              table QR codes and the details people look for: hours, location and how to reach you.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button asChild size="lg" className="h-11 px-5 text-[15px]">
                <Link href="/login?intent=signup">
                  Create your free menu <ArrowRightIcon />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-11 px-5 text-[15px]">
                <Link href="/#features">See what&apos;s included</Link>
              </Button>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">Free plan, no card needed.</p>
          </div>
          <figure>
            <PhonePreview />
            <figcaption className="mt-4 text-center text-xs text-muted-foreground">Illustrative example — not a real restaurant.</figcaption>
          </figure>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="scroll-mt-20 border-t bg-muted/30">
        <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
          <SectionHeading eyebrow="Features" title="Everything a small food business needs online" body="No designer, no developer, no app for your guests to install." />
          <div className="mt-14 grid gap-px overflow-hidden rounded-2xl border bg-border sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="bg-card p-7">
                <div className="grid size-10 place-items-center rounded-xl bg-accent text-primary">
                  <f.icon className="size-5" />
                </div>
                <h3 className="mt-5 font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-t">
        <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
          <SectionHeading eyebrow="How it works" title="From paper menu to QR code in three steps" />
          <ol className="mt-14 grid gap-6 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s.title} className="relative rounded-2xl border bg-card p-7">
                <span className="font-mono text-sm text-primary">0{i + 1}</span>
                <h3 className="mt-3 text-lg font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Made for */}
      <section className="border-t bg-muted/30">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-24 sm:px-6 lg:grid-cols-2">
          <div>
            <SectionHeading align="left" eyebrow="Made for real kitchens" title="Works the way you already take orders" />
            <ul className="mt-8 space-y-4 text-[15px]">
              {[
                ["WhatsApp first", "No new tablet, no commission. Orders arrive where you already chat with customers."],
                ["Delivery apps welcome", "Link your Swiggy, Zomato or Uber Eats pages so regulars can order however they like."],
                ["Google-ready details", "Directions, call button, Instagram and a link to leave you a Google review."],
                ["Light on data", "A page that opens quickly on 4G in a busy market, not a heavy PDF."],
              ].map(([t, b]) => (
                <li key={t} className="flex gap-3">
                  <LeafIcon className="mt-1 size-4 shrink-0 text-primary" />
                  <span>
                    <span className="font-medium">{t}.</span> <span className="text-muted-foreground">{b}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border bg-card p-6 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Example WhatsApp order</p>
            <div className="mt-4 rounded-2xl bg-[#e7fbe0] p-4 font-mono text-[13px] leading-relaxed text-neutral-800 dark:bg-[#0b3d2c] dark:text-emerald-50">
              Hi Chai &amp; Crumbs! I&apos;d like to order:
              <br />
              <br />• 2 × Masala Chai — ₹80
              <br />• 1 × Vada Pav — ₹35
              <br />
              <br />
              Total: ₹115
              <br />
              Table: 5
            </div>
            <p className="mt-3 text-xs text-muted-foreground">Illustrative example of the message format — not a real order or restaurant.</p>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="scroll-mt-20 border-t">
        <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
          <SectionHeading eyebrow="Pricing" title="Start free. Upgrade when you grow." />
          <div className="mt-12">
            <PricingCards />
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="scroll-mt-20 border-t bg-muted/30">
        <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
          <SectionHeading eyebrow="FAQ" title="Questions owners ask" />
          <div className="mt-12">
            <Faq />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t">
        <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
          <div className="relative overflow-hidden rounded-3xl bg-primary px-8 py-14 text-center text-primary-foreground">
            <div className="bg-grid pointer-events-none absolute inset-0 opacity-30" />
            <h2 className="relative text-balance text-3xl font-semibold tracking-tight sm:text-4xl">Put your menu on every table today</h2>
            <p className="relative mx-auto mt-4 max-w-xl text-primary-foreground/85">Create your page, add a few dishes and print your first QR code.</p>
            <div className="relative mt-8 flex flex-wrap justify-center gap-3">
              <Button asChild size="lg" variant="secondary" className="h-11 px-5 text-[15px]">
                <Link href="/login?intent=signup">Create your free menu</Link>
              </Button>
              <Button asChild size="lg" variant="ghost" className="h-11 px-5 text-[15px] text-primary-foreground hover:bg-white/10 hover:text-primary-foreground">
                <Link href="/pricing">Compare plans →</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

function SectionHeading({ eyebrow, title, body, align = "center" }: { eyebrow: string; title: string; body?: string; align?: "center" | "left" }) {
  return (
    <div className={align === "center" ? "mx-auto max-w-2xl text-center" : "max-w-xl"}>
      <p className="text-sm font-medium text-primary">{eyebrow}</p>
      <h2 className="mt-3 text-balance text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h2>
      {body && <p className="mt-4 text-pretty text-muted-foreground">{body}</p>}
    </div>
  );
}
