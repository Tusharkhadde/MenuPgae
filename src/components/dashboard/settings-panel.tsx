"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GlobeIcon, Loader2Icon, LockIcon, RefreshCwIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Field, SectionCard } from "@/components/dashboard/field";
import { checkDomainStatus, deleteRestaurant, removeCustomDomain, setCustomDomain, setPublished, updateSlug } from "@/server/actions/restaurant";
import type { DomainStatus } from "@/lib/domains";

export function SettingsPanel(props: {
  restaurantId: string;
  slug: string;
  published: boolean;
  customDomain: string | null;
  canUseDomain: boolean;
  domainsManaged: boolean;
  dns: { type: string; name: string; value: string } | null;
  appHost: string;
}) {
  const router = useRouter();
  const [slug, setSlug] = useState(props.slug);
  const [domain, setDomain] = useState(props.customDomain ?? "");
  const [status, setStatus] = useState<DomainStatus | null>(null);
  const [confirm, setConfirm] = useState("");
  const [pending, start] = useTransition();

  const act = (fn: () => Promise<void>) => start(fn);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <SectionCard
        title="Page address"
        description="Changing it breaks old links and printed QR codes — QR codes point to this address."
        footer={
          <Button
            disabled={pending || slug === props.slug}
            onClick={() =>
              act(async () => {
                const res = await updateSlug(props.restaurantId, slug);
                if (!res.ok) toast.error(res.error);
                else {
                  toast.success("Address updated. Reprint your QR codes.");
                  router.refresh();
                }
              })
            }
          >
            Save address
          </Button>
        }
      >
        <Field label="Address" htmlFor="slug">
          <div className="flex items-center overflow-hidden rounded-lg border border-input focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
            <span className="whitespace-nowrap border-r bg-muted px-2.5 py-1.5 text-sm text-muted-foreground">{props.appHost}/r/</span>
            <input id="slug" value={slug} maxLength={40} onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} className="h-9 w-full bg-transparent px-2.5 text-sm outline-none" />
          </div>
        </Field>
      </SectionCard>

      <SectionCard title="Visibility">
        <label className="flex items-center justify-between gap-4">
          <span>
            <span className="block text-sm font-medium">Published</span>
            <span className="block text-xs text-muted-foreground">When off, your page shows “not found” to guests.</span>
          </span>
          <Switch
            defaultChecked={props.published}
            disabled={pending}
            onCheckedChange={(v) =>
              act(async () => {
                const res = await setPublished(props.restaurantId, v);
                if (!res.ok) toast.error(res.error);
                else {
                  toast.success(v ? "Your page is live" : "Your page is hidden");
                  router.refresh();
                }
              })
            }
          />
        </label>
      </SectionCard>

      <SectionCard title="Custom domain" description="Serve your page on your own domain, like menu.yourcafe.com.">
        {!props.canUseDomain ? (
          <div className="flex items-center justify-between gap-4 rounded-xl border border-dashed p-4">
            <p className="flex items-center gap-2 text-sm text-muted-foreground"><LockIcon className="size-4" /> Custom domains are part of Pro.</p>
            <Button asChild size="sm"><Link href="/dashboard/billing">Upgrade</Link></Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex gap-2">
              <Input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="menu.yourcafe.com" aria-label="Domain" />
              <Button
                disabled={pending || !domain.trim()}
                onClick={() =>
                  act(async () => {
                    const res = await setCustomDomain(props.restaurantId, domain);
                    if (!res.ok) toast.error(res.error);
                    else {
                      setStatus(res.data);
                      toast.success("Domain saved");
                      router.refresh();
                    }
                  })
                }
              >
                {pending ? <Loader2Icon className="animate-spin" /> : <GlobeIcon />} Connect
              </Button>
            </div>
            {props.customDomain && props.dns && (
              <div className="space-y-3 rounded-xl border p-4 text-sm">
                <p className="font-medium">Add this DNS record at your domain registrar:</p>
                <div className="grid grid-cols-3 gap-2 rounded-lg bg-muted p-3 font-mono text-xs">
                  <span className="text-muted-foreground">Type</span>
                  <span className="text-muted-foreground">Name</span>
                  <span className="text-muted-foreground">Value</span>
                  <span>{props.dns.type}</span>
                  <span>{props.dns.name}</span>
                  <span className="break-all">{props.dns.value}</span>
                </div>
                {status?.verification?.map((v) => (
                  <div key={v.value} className="grid grid-cols-3 gap-2 rounded-lg bg-muted p-3 font-mono text-xs">
                    <span>{v.type}</span>
                    <span className="break-all">{v.domain}</span>
                    <span className="break-all">{v.value}</span>
                  </div>
                ))}
                {!props.domainsManaged && (
                  <p className="text-xs text-muted-foreground">The site operator also needs to add this domain to the hosting project (Vercel → Project → Domains).</p>
                )}
                {status && props.domainsManaged && (
                  <p className="text-xs">
                    Status:{" "}
                    {status.error ? <span className="text-destructive">{status.error}</span> : status.verified && status.misconfigured === false ? <span className="text-emerald-600">Connected ✓</span> : <span className="text-amber-600">Waiting for DNS (can take up to 48h)</span>}
                  </p>
                )}
                <div className="flex gap-2">
                  {props.domainsManaged && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={pending}
                      onClick={() =>
                        act(async () => {
                          const res = await checkDomainStatus(props.restaurantId);
                          if (!res.ok) toast.error(res.error);
                          else setStatus(res.data);
                        })
                      }
                    >
                      <RefreshCwIcon /> Check status
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={pending}
                    onClick={() =>
                      act(async () => {
                        const res = await removeCustomDomain(props.restaurantId);
                        if (!res.ok) toast.error(res.error);
                        else {
                          setDomain("");
                          setStatus(null);
                          router.refresh();
                        }
                      })
                    }
                  >
                    Remove domain
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </SectionCard>

      <section className="rounded-2xl border border-destructive/40 bg-card p-6">
        <h2 className="font-semibold text-destructive">Delete restaurant</h2>
        <p className="mt-1 text-sm text-muted-foreground">Deletes the page, menu, images links and analytics. This can&apos;t be undone.</p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <Input value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder={`Type “${props.slug}” to confirm`} aria-label="Confirm deletion" />
          <Button
            variant="destructive"
            disabled={pending || confirm !== props.slug}
            onClick={() =>
              act(async () => {
                const res = await deleteRestaurant(props.restaurantId, confirm);
                if (!res.ok) toast.error(res.error);
                else {
                  toast.success("Restaurant deleted");
                  router.push("/dashboard");
                  router.refresh();
                }
              })
            }
          >
            Delete forever
          </Button>
        </div>
      </section>
    </div>
  );
}
