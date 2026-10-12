"use client";

import { useState } from "react";
import Link from "next/link";
import { DownloadIcon, PrinterIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, SectionCard } from "@/components/dashboard/field";
import { parseTables } from "@/lib/tables";

export function TableQrBuilder({ restaurantId, max }: { restaurantId: string; max: number }) {
  const [input, setInput] = useState("1-10");
  const tables = parseTables(input, max);
  return (
    <SectionCard
      title="Table QR codes"
      description="Each table gets its own code. When a guest orders on WhatsApp, the table number is filled in for them, and you'll see scans per table in Analytics."
      footer={
        <Button asChild disabled={!tables.length}>
          <Link href={`/dashboard/r/${restaurantId}/qr/print?tables=${encodeURIComponent(input)}`} target="_blank">
            <PrinterIcon /> Print table tents
          </Link>
        </Button>
      }
    >
      <Field label="Tables" htmlFor="tables" hint={`Ranges and names work: “1-12”, “A1-A6, Patio, Bar”. Up to ${max} on your plan.`}>
        <Input id="tables" value={input} onChange={(e) => setInput(e.target.value)} />
      </Field>
      {tables.length > 0 ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
          {tables.map((t) => (
            <div key={t} className="flex items-center justify-between gap-2 rounded-xl border px-3 py-2">
              <span className="text-sm font-medium">Table {t}</span>
              <span className="flex gap-1">
                <a className="rounded-md px-1.5 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground" href={`/api/r/${restaurantId}/qr?format=png&t=${encodeURIComponent(t)}`} download aria-label={`Download PNG for table ${t}`}>
                  <DownloadIcon className="inline size-3.5" /> PNG
                </a>
                <a className="rounded-md px-1.5 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground" href={`/api/r/${restaurantId}/qr?format=svg&t=${encodeURIComponent(t)}`} download aria-label={`Download SVG for table ${t}`}>
                  SVG
                </a>
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Enter at least one table.</p>
      )}
    </SectionCard>
  );
}
