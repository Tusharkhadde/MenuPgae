import { requireRestaurantAccess, getPlanForUser } from "@/server/session";
import { parseTables, qrSvg, qrTargetUrl } from "@/lib/qr";
import { appUrl } from "@/lib/env";
import { limitsFor } from "@/lib/limits";
import { PrintButton } from "@/components/dashboard/print-button";

export const metadata = { title: "Print table tents" };

export default async function PrintTentsPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tables?: string }> }) {
  const { id } = await params;
  const { tables: tablesParam } = await searchParams;
  const { restaurant } = await requireRestaurantAccess(id, "manager");
  const plan = await getPlanForUser(restaurant.ownerId);
  const tables = parseTables(tablesParam ?? "1-10", limitsFor(plan).tableQrCodes);
  const base = appUrl();
  const codes = await Promise.all(tables.map(async (t) => ({ table: t, svg: await qrSvg(qrTargetUrl(base, restaurant.slug, t)) })));

  return (
    <div className="mx-auto max-w-[210mm]">
      <style>{`@page { size: A4; margin: 10mm; } @media print { header, nav, .no-print { display: none !important; } }`}</style>
      <div className="no-print mb-6 flex items-center justify-between rounded-2xl border bg-card p-4">
        <div>
          <p className="font-medium">{tables.length} table tent{tables.length === 1 ? "" : "s"} ready</p>
          <p className="text-sm text-muted-foreground">Print on A4 (2 per page), cut along the dashed line and fold in the middle. Choose “Save as PDF” to get a PDF.</p>
        </div>
        <PrintButton />
      </div>
      <div className="grid grid-cols-1 gap-0 bg-white text-black">
        {codes.map(({ table, svg }) => (
          <div key={table} className="flex h-[138mm] break-inside-avoid flex-col border-b border-dashed border-neutral-400">
            {/* Top half is upside down so the tent reads correctly from both sides once folded */}
            <TentFace name={restaurant.name} table={table} svg={svg} flipped />
            <TentFace name={restaurant.name} table={table} svg={svg} />
          </div>
        ))}
      </div>
    </div>
  );
}

function TentFace({ name, table, svg, flipped }: { name: string; table: string; svg: string; flipped?: boolean }) {
  return (
    <div className={`flex flex-1 items-center justify-center gap-8 border-neutral-300 px-10 ${flipped ? "rotate-180 border-t border-dotted" : ""}`}>
      <div className="size-[52mm] shrink-0 [&_svg]:size-full" dangerouslySetInnerHTML={{ __html: svg }} />
      <div className="min-w-0">
        <p className="text-[11pt] uppercase tracking-[0.2em] text-neutral-500">Scan for menu</p>
        <p className="mt-1 text-[22pt] font-bold leading-tight">{name}</p>
        <p className="mt-3 inline-block rounded-full bg-black px-4 py-1 text-[14pt] font-semibold text-white">Table {table}</p>
        <p className="mt-3 text-[9pt] text-neutral-500">Order on WhatsApp · No app needed</p>
      </div>
    </div>
  );
}
