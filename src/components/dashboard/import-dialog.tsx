"use client";

import { useMemo, useState, useTransition } from "react";
import { CameraIcon, DownloadIcon, FileSpreadsheetIcon, Loader2Icon } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CSV_TEMPLATE, parseCsv, rowsFromCsv } from "@/lib/csv-import";
import { formatMoney } from "@/lib/money";
import { importMenuCsv, readMenuPhoto } from "@/server/actions/import";

export function ImportDialog(props: {
  restaurantId: string;
  currency: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onImported: () => void;
  aiAvailable: boolean;
}) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-3xl">{props.open && <ImportForm {...props} />}</DialogContent>
    </Dialog>
  );
}

function ImportForm(props: { restaurantId: string; currency: string; onOpenChange: (o: boolean) => void; onImported: () => void; aiAvailable: boolean }) {
  const [text, setText] = useState("");
  const [pending, start] = useTransition();
  const [reading, setReading] = useState(false);
  const preview = useMemo(() => (text.trim() ? rowsFromCsv(parseCsv(text), props.currency) : null), [text, props.currency]);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    if (/\.xlsx?$/i.test(file.name)) {
      toast.error("Excel files: choose File → Save as / Download → CSV first, then upload the .csv.");
      return;
    }
    if (file.size > 1_000_000) {
      toast.error("The file is too large (1 MB max).");
      return;
    }
    setText(await file.text());
  };

  const onPhoto = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) {
      toast.error("The photo is too large (4 MB max).");
      return;
    }
    setReading(true);
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    }).catch(() => "");
    const res = await readMenuPhoto(props.restaurantId, base64, file.type);
    setReading(false);
    if (!res.ok) toast.error(res.error);
    else {
      setText(res.data.csv);
      toast.success("Menu read — check the preview before importing.");
    }
  };

  const doImport = () =>
    start(async () => {
      const res = await importMenuCsv(props.restaurantId, text);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`Imported ${res.data.items} item${res.data.items === 1 ? "" : "s"}${res.data.categories ? ` and ${res.data.categories} new categor${res.data.categories === 1 ? "y" : "ies"}` : ""}.`);
      props.onOpenChange(false);
      props.onImported();
    });

  const templateHref = `data:text/csv;charset=utf-8,${encodeURIComponent(CSV_TEMPLATE)}`;

  return (
    <>
      <DialogHeader>
        <DialogTitle>Import your menu</DialogTitle>
        <DialogDescription>Upload a CSV (from Excel or Google Sheets: File → Download → CSV), or paste rows below. Items are added to your menu; nothing is deleted.</DialogDescription>
      </DialogHeader>
      <div className="my-4 space-y-4">
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <label className="cursor-pointer">
              <FileSpreadsheetIcon /> Choose CSV file
              <input type="file" accept=".csv,text/csv,.xlsx,.xls" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
            </label>
          </Button>
          <Button asChild variant="ghost">
            <a href={templateHref} download="menupage-template.csv"><DownloadIcon /> Download template</a>
          </Button>
          {props.aiAvailable ? (
            <Button asChild variant="ghost" disabled={reading}>
              <label className="cursor-pointer">
                {reading ? <Loader2Icon className="animate-spin" /> : <CameraIcon />} {reading ? "Reading photo…" : "From a menu photo (AI)"}
                <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="sr-only" disabled={reading} onChange={(e) => onPhoto(e.target.files?.[0])} />
              </label>
            </Button>
          ) : null}
        </div>
        <Textarea
          aria-label="CSV rows"
          rows={6}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={CSV_TEMPLATE}
          className="font-mono text-xs"
        />
        <p className="text-xs text-muted-foreground">
          Columns: <code>category, name, description, price, diet</code> (veg/nonveg/vegan/egg)<code>, spicy</code> (0–3)<code>, allergens</code> (comma or | separated)<code>, bestseller, sold_out</code> (yes/no)<code>, calories, variants</code> (e.g. <code>Half:120|Full:200</code>). Only name and price are required.
        </p>
        {preview && (
          <div className="space-y-2">
            {preview.errors.length > 0 && (
              <ul className="space-y-1 rounded-xl bg-amber-50 p-3 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                {preview.errors.slice(0, 8).map((e, i) => (
                  <li key={i}>Line {e.line}: {e.message}</li>
                ))}
                {preview.errors.length > 8 && <li>…and {preview.errors.length - 8} more</li>}
              </ul>
            )}
            {preview.rows.length > 0 && (
              <div className="max-h-72 overflow-auto rounded-xl border">
                <table className="w-full text-left text-sm">
                  <caption className="sr-only">Import preview</caption>
                  <thead className="sticky top-0 bg-muted text-xs">
                    <tr><th className="px-3 py-2">Category</th><th className="px-3 py-2">Item</th><th className="px-3 py-2">Price</th><th className="px-3 py-2">Details</th></tr>
                  </thead>
                  <tbody className="divide-y">
                    {preview.rows.slice(0, 200).map((r) => (
                      <tr key={r.line}>
                        <td className="px-3 py-1.5 text-muted-foreground">{r.category}</td>
                        <td className="px-3 py-1.5">{r.name}</td>
                        <td className="px-3 py-1.5 tabular-nums">{r.variants.length ? r.variants.map((v) => `${v.name} ${formatMoney(v.priceMinor, props.currency)}`).join(" · ") : formatMoney(r.priceMinor, props.currency)}</td>
                        <td className="px-3 py-1.5 text-xs text-muted-foreground">{[r.diet, r.spicy ? `spicy ${r.spicy}` : null, r.calories ? `${r.calories} kcal` : null, r.bestseller ? "bestseller" : null].filter(Boolean).join(" · ")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={() => props.onOpenChange(false)}>Cancel</Button>
        <Button onClick={doImport} disabled={pending || !preview?.rows.length}>
          {pending && <Loader2Icon className="animate-spin" />} Import {preview?.rows.length ? `${preview.rows.length} item${preview.rows.length === 1 ? "" : "s"}` : ""}
        </Button>
      </DialogFooter>
    </>
  );
}
