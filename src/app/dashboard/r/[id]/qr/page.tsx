import { requireOwnedRestaurant, getPlanForUser } from "@/server/session";
import { qrSvg, qrTargetUrl } from "@/lib/qr";
import { appUrl } from "@/lib/env";
import { limitsFor } from "@/lib/limits";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/dashboard/field";
import { TableQrBuilder } from "@/components/dashboard/table-qr-builder";
import { CopyButton } from "@/components/dashboard/copy-button";
import { DownloadIcon } from "lucide-react";

export default async function QrPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, restaurant } = await requireOwnedRestaurant(id);
  const target = qrTargetUrl(appUrl(), restaurant.slug);
  const svg = await qrSvg(target);
  const plan = await getPlanForUser(user.id);

  return (
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
  );
}
