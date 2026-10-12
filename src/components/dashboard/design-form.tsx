"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, SectionCard } from "@/components/dashboard/field";
import { ImageUpload } from "@/components/dashboard/image-upload";
import { THEMES, THEME_IDS, type ThemeIdT } from "@/lib/themes";
import { updateDesign } from "@/server/actions/restaurant";
import { cn } from "@/lib/utils";

export function DesignForm(props: { restaurantId: string; slug: string; initial: { theme: ThemeIdT; logoUrl: string | null; coverUrl: string | null } }) {
  const router = useRouter();
  const [theme, setTheme] = useState(props.initial.theme);
  const [logoUrl, setLogoUrl] = useState(props.initial.logoUrl);
  const [coverUrl, setCoverUrl] = useState(props.initial.coverUrl);
  const [pending, start] = useTransition();
  const [previewKey, setPreviewKey] = useState(0);

  function save() {
    start(async () => {
      const res = await updateDesign(props.restaurantId, { theme, logoUrl, coverUrl });
      if (!res.ok) toast.error(res.error);
      else {
        toast.success("Design saved");
        setPreviewKey((k) => k + 1);
        router.refresh();
      }
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <div className="space-y-6">
        <SectionCard title="Theme" description="Pick the look that suits your place. You can switch anytime.">
          <div className="grid gap-3 sm:grid-cols-2">
            {THEME_IDS.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => setTheme(id)}
                className={cn("overflow-hidden rounded-xl border text-left transition-all", theme === id ? "border-primary ring-2 ring-primary/30" : "hover:border-foreground/20")}
              >
                <div className="flex h-20 items-end gap-2 p-3" style={{ background: THEMES[id].swatch[0] }}>
                  <span className="h-8 w-14 rounded-md" style={{ background: THEMES[id].swatch[1] }} />
                  <span className="mb-1 h-2 w-20 rounded" style={{ background: THEMES[id].swatch[2], opacity: 0.8 }} />
                </div>
                <div className="p-3">
                  <p className="text-sm font-medium">{THEMES[id].name}</p>
                  <p className="text-xs text-muted-foreground">{THEMES[id].description}</p>
                </div>
              </button>
            ))}
          </div>
        </SectionCard>
        <SectionCard
          title="Logo & cover"
          description="Square logo (at least 256×256) and a wide cover photo (at least 1200×500). Images are resized automatically."
          footer={<Button onClick={save} disabled={pending}>{pending && <Loader2Icon className="animate-spin" />} Save design</Button>}
        >
          <div className="grid gap-6 sm:grid-cols-2">
            <Field label="Logo"><ImageUpload value={logoUrl} onChange={setLogoUrl} restaurantId={props.restaurantId} label="Upload logo" /></Field>
            <Field label="Cover photo"><ImageUpload value={coverUrl} onChange={setCoverUrl} restaurantId={props.restaurantId} label="Upload cover" aspect="wide" /></Field>
          </div>
        </SectionCard>
      </div>
      <div className="hidden lg:block">
        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Live preview (saved version)</p>
        <div className="sticky top-20 overflow-hidden rounded-[32px] border-8 border-neutral-900 bg-neutral-900 shadow-xl">
          <iframe key={previewKey} src={`/r/${props.slug}`} title="Live page preview" className="h-[680px] w-full rounded-[24px] bg-white" />
        </div>
      </div>
    </div>
  );
}
