import { FlaskConicalIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** The one label used wherever the fictional demo café or its synthetic order history appears. */
export function DemoDataBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-amber-500/50 bg-amber-500/15 px-2.5 py-0.5 text-xs font-semibold text-amber-800 dark:text-amber-300",
        className,
      )}
    >
      <FlaskConicalIcon className="size-3.5" aria-hidden /> Demo data
    </span>
  );
}
