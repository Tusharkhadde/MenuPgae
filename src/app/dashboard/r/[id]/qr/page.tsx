import { requireRestaurantAccess, getPlanForUser } from "@/server/session";
import { qrSvg, qrTargetUrl } from "@/lib/qr";
import { appUrl } from "@/lib/env";
import { limitsFor } from "@/lib/limits";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/dashboard/field";
import { TableQrBuilder } from "@/components/dashboard/table-qr-builder";
import { CopyButton } from "@/components/dashboard/copy-button";
import Link from "next/link";
import { DownloadIcon, ExternalLinkIcon, PrinterIcon } from "lucide-react";

export default async function QrPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { restaurant } = await requireRestaurantAccess(id, "manager");
  const target = qrTargetUrl(appUrl(), restaurant.slug);
  const svg = await qrSvg(target);
  const plan = await getPlanForUser(restaurant.ownerId);

  const base = appUrl();
  const linksUrl = `${base}/l/${restaurant.slug}`;
  const embedSnippet = `<iframe src="${base}/embed/${restaurant.slug}" title="${restaurant.name.replace(/"/g, "&quot;")} menu" loading="lazy" style="width:100%;min-height:800px;border:0;border-radius:16px"></iframe>`;

  return (
    <div className="space-y-6">
    <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
      <SectionCard title="Main QR code" description="For your counter, door, flyers and Instagram bio.">
        <div className="mx-auto w-full max-w-[260px] overflow-hidden rounded-2xl border bg-white p-3" dangerouslySetInnerHTML={{ __html: svg }} />
        <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
          <span className="truncate font-mono">{target.replace(/^https?:\/\//, "")}</span>
          <CopyButton value={target} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button asChild variant="outline">
            <a href={`/api/r/${restaurant.id}/qr?format=png`} download><DownloadIcon /> PNG</a>
          </Button>
          <Button asChild variant="outline">
            <a href={`/api/r/${restaurant.id}/qr?format=svg`} download><DownloadIcon /> SVG</a>
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">SVG stays sharp at any size — best for print shops. Your QR codes never change, even when you edit the menu.</p>
      </SectionCard>
      <TableQrBuilder restaurantId={restaurant.id} max={limitsFor(plan).tableQrCodes} />
    </div>
    <div className="grid gap-6 lg:grid-cols-3">
      <SectionCard title="Link in bio" description="One page with your menu, WhatsApp, directions, reviews and delivery apps — made for your Instagram bio.">
        <div className="flex items-center gap-1 rounded-lg border bg-muted/40 px-3 py-2 text-xs">
          <span className="min-w-0 flex-1 truncate font-mono">{linksUrl.replace(/^https?:\/\//, "")}</span>
          <CopyButton value={linksUrl} />
        </div>
        <Button asChild variant="outline"><a href={`/l/${restaurant.slug}`} target="_blank" rel="noopener noreferrer"><ExternalLinkIcon /> Open</a></Button>
      </SectionCard>
      <SectionCard title="Embed on your website" description="Already have a website? Paste this where the menu should appear. It updates whenever you edit.">
        <pre className="max-h-32 overflow-auto whitespace-pre-wrap break-all rounded-lg border bg-muted/40 p-3 font-mono text-[11px]">{embedSnippet}</pre>
        <div className="flex items-center gap-2 text-sm"><CopyButton value={embedSnippet} /> Copy code</div>
      </SectionCard>
      <SectionCard title="Print & install" description="A branded A4 menu for the counter, and an installable menu that works offline.">
        <Button asChild variant="outline"><Link href={`/dashboard/r/${restaurant.id}/menu/print`}><PrinterIcon /> Printable menu</Link></Button>
        <p className="text-xs text-muted-foreground">Guests (and your staff) can tap “Add to Home screen” on your menu page — it opens like an app and the last-viewed menu works without internet.</p>
      </SectionCard>
    </div>
    </div>
  );
}
