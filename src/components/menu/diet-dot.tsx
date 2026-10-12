import type { Diet } from "@/lib/db/schema";
import { cn } from "@/lib/utils";

const LABEL: Record<Diet, string> = { veg: "Vegetarian", nonveg: "Non-vegetarian", vegan: "Vegan", egg: "Contains egg" };
const COLOR: Record<Diet, string> = {
  veg: "border-green-600 text-green-600",
  vegan: "border-emerald-500 text-emerald-500",
  nonveg: "border-red-700 text-red-700",
  egg: "border-amber-500 text-amber-500",
};

/** Indian-style food-type mark (square with a dot; triangle for non-veg). */
export function DietDot({ diet, size = "md" }: { diet: Diet; size?: "sm" | "md" }) {
  const box = size === "sm" ? "size-3" : "size-3.5";
  return (
    <span role="img" aria-label={LABEL[diet]} title={LABEL[diet]} className={cn("inline-grid shrink-0 place-items-center rounded-[3px] border-[1.5px] bg-white", box, COLOR[diet])}>
      {diet === "nonveg" ? (
        <svg viewBox="0 0 10 10" className="size-[60%] fill-current"><path d="M5 1.2 9 8.6H1z" /></svg>
      ) : (
        <span className="size-[50%] rounded-full bg-current" />
      )}
    </span>
  );
}

export const DIET_LABEL = LABEL;
