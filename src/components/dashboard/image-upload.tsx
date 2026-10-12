"use client";

import { useRef, useState } from "react";
import { ImageUpIcon, Loader2Icon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const MAX_DIMENSION = 1600;

/** Downscale + re-encode in the browser so uploads stay small and fast on mobile data. */
async function compress(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/") || file.type === "image/gif") return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.85));
    return blob && blob.size < file.size ? blob : file;
  } catch {
    return file;
  }
}

export function ImageUpload({
  value,
  onChange,
  restaurantId,
  label = "Upload image",
  aspect = "square",
  className,
}: {
  value: string | null;
  onChange: (url: string | null) => void;
  restaurantId?: string;
  label?: string;
  aspect?: "square" | "wide";
  className?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function upload(file: File) {
    if (!/^image\/(jpeg|png|webp|avif|heic|heif)$/.test(file.type) && file.type !== "") {
      toast.error("Upload a JPG, PNG, WebP or AVIF image.");
      return;
    }
    setBusy(true);
    try {
      const blob = await compress(file);
      if (blob.size > 4 * 1024 * 1024) throw new Error("Images must be 4 MB or smaller.");
      const fd = new FormData();
      fd.append("file", blob, file.name.replace(/\.\w+$/, "") + (blob.type === "image/webp" ? ".webp" : ""));
      if (restaurantId) fd.append("restaurantId", restaurantId);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok || !data.url) throw new Error(data.error ?? "Upload failed.");
      onChange(data.url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <button
        type="button"
        onClick={() => input.current?.click()}
        className={cn(
          "relative grid shrink-0 place-items-center overflow-hidden rounded-xl border border-dashed bg-muted/50 text-muted-foreground transition-colors hover:border-primary hover:text-primary",
          aspect === "square" ? "size-20" : "h-20 w-36",
        )}
        aria-label={label}
      >
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element -- preview of uploaded image
          <img src={value} alt="" className="size-full object-cover" />
        ) : busy ? (
          <Loader2Icon className="size-5 animate-spin" />
        ) : (
          <ImageUpIcon className="size-5" />
        )}
        {busy && value && (
          <span className="absolute inset-0 grid place-items-center bg-background/60">
            <Loader2Icon className="size-5 animate-spin" />
          </span>
        )}
      </button>
      <div className="flex flex-col gap-1.5">
        <Button type="button" variant="outline" size="sm" onClick={() => input.current?.click()} disabled={busy}>
          {value ? "Replace" : label}
        </Button>
        {value && (
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)} disabled={busy} className="text-muted-foreground">
            <Trash2Icon /> Remove
          </Button>
        )}
      </div>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void upload(f);
        }}
      />
    </div>
  );
}
