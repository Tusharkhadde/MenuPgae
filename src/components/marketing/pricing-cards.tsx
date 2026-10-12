"use client";

import Link from "next/link";
import { useState } from "react";
import { CheckIcon } from "lucide-react";
import { PLANS, PRICE_CURRENCIES, PRO_PRICE_LABELS, type PriceCurrency } from "@/config/plans";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function PricingCards({ defaultCurrency = "INR" }: { defaultCurrency?: PriceCurrency }) {
  const [currency, setCurrency] = useState<PriceCurrency>(defaultCurrency);
  const pro = PRO_PRICE_LABELS[currency];
  return (
    <div className="space-y-8">
      <div className="flex justify-center">
        <div role="radiogroup" aria-label="Currency" className="inline-flex flex-wrap justify-center gap-1 rounded-xl border bg-card p-1">
          {PRICE_CURRENCIES.map((c) => (
            <button
              key={c}
              role="radio"
              aria-checked={c === currency}
              onClick={() => setCurrency(c)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                c === currency ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {c}
            </button>
          ))}
        </div>
      </div>
      <div className="mx-auto grid max-w-4xl gap-5 md:grid-cols-2">
        <PlanCard
          name={PLANS.free.name}
          tagline={PLANS.free.tagline}
          price={currency === "INR" ? "₹0" : currency === "EUR" ? "€0" : currency === "GBP" ? "£0" : currency === "AED" ? "AED 0" : currency === "SGD" ? "S$0" : "$0"}
          note="forever"
          features={PLANS.free.features}
          cta={{ label: "Start free", href: "/login?intent=signup" }}
        />
        <PlanCard
          highlighted
          name={PLANS.pro.name}
          tagline={PLANS.pro.tagline}
          price={pro.monthly}
          note={pro.note}
          features={PLANS.pro.features}
          cta={{ label: "Start with Pro", href: "/login?intent=signup&plan=pro" }}
        />
      </div>
      <p className="text-center text-xs text-muted-foreground">
        Prices shown are placeholders while MenuPage is in early access. Final pricing will be shown here before you pay.
      </p>
    </div>
  );
}

function PlanCard(props: {
  name: string;
  tagline: string;
  price: string;
  note: string;
  features: string[];
  cta: { label: string; href: string };
  highlighted?: boolean;
}) {
  return (
    <div
      className={cn(
        "relative flex flex-col rounded-2xl border bg-card p-7 shadow-sm",
        props.highlighted && "border-primary/50 shadow-[0_0_0_1px_var(--primary),0_20px_60px_-24px_color-mix(in_oklch,var(--primary)_45%,transparent)]",
      )}
    >
      {props.highlighted && (
        <span className="absolute -top-3 left-7 rounded-full bg-primary px-2.5 py-0.5 text-[11px] font-semibold text-primary-foreground">
          Most flexible
        </span>
      )}
      <h3 className="text-lg font-semibold">{props.name}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{props.tagline}</p>
      <div className="mt-6 flex items-baseline gap-2">
        <span className="text-4xl font-semibold tracking-tight">{props.price}</span>
        <span className="text-sm text-muted-foreground">{props.note}</span>
      </div>
      <ul className="mt-6 flex-1 space-y-2.5">
        {props.features.map((f) => (
          <li key={f} className="flex items-start gap-2.5 text-sm">
            <CheckIcon className="mt-0.5 size-4 shrink-0 text-primary" />
            <span>{f}</span>
          </li>
        ))}
      </ul>
      <Button asChild size="lg" variant={props.highlighted ? "default" : "outline"} className="mt-8 h-10 w-full">
        <Link href={props.cta.href}>{props.cta.label}</Link>
      </Button>
    </div>
  );
}
