"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  FlameIcon,
  GripVerticalIcon,
  MoreHorizontalIcon,
  PartyPopperIcon,
  PencilIcon,
  PlusIcon,
  SparklesIcon,
  StarIcon,
  Trash2Icon,
  UtensilsIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { DietDot } from "@/components/menu/diet-dot";
import { formatMoney } from "@/lib/money";
import type { Diet } from "@/lib/db/schema";
import {
  addSampleMenu,
  deleteCategory,
  deleteItem,
  reorderCategories,
  reorderItems,
  setItemFlag,
} from "@/server/actions/menu";
import { CategoryDialog, ItemDialog } from "@/components/dashboard/menu-dialogs";
import type { PlanId } from "@/config/plans";
import { cn } from "@/lib/utils";

export type EditorItem = {
  id: string;
  categoryId: string;
  name: string;
  description: string | null;
  priceMinor: number;
  imageUrl: string | null;
  diet: Diet | null;
  spicy: number;
  allergens: string[];
  bestseller: boolean;
  soldOut: boolean;
};
export type EditorCategory = { id: string; name: string; description: string | null; items: EditorItem[] };

export function MenuEditor(props: {
  restaurantId: string;
  slug: string;
  currency: string;
  initial: EditorCategory[];
  itemLimit: number;
  plan: PlanId;
  welcome: boolean;
}) {
  const router = useRouter();
  const [cats, setCats] = useState(props.initial);
  const [, startTransition] = useTransition();
  const [catDialog, setCatDialog] = useState<{ open: boolean; category?: EditorCategory }>({ open: false });
  const [itemDialog, setItemDialog] = useState<{ open: boolean; item?: EditorItem; categoryId?: string }>({ open: false });
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Sync with fresh server data after mutations.
  useEffect(() => setCats(props.initial), [props.initial]); // eslint-disable-line react-hooks/set-state-in-effect

  const totalItems = cats.reduce((s, c) => s + c.items.length, 0);
  const atLimit = totalItems >= props.itemLimit;

  const refresh = () => router.refresh();

  function onCategoryDragEnd(e: DragEndEvent) {
    if (!e.over || e.active.id === e.over.id) return;
    const oldIndex = cats.findIndex((c) => c.id === e.active.id);
    const newIndex = cats.findIndex((c) => c.id === e.over!.id);
    const next = arrayMove(cats, oldIndex, newIndex);
    setCats(next);
    startTransition(async () => {
      const res = await reorderCategories(props.restaurantId, { ids: next.map((c) => c.id) });
      if (!res.ok) toast.error(res.error);
      refresh();
    });
  }

  function onItemsReorder(categoryId: string, ids: string[]) {
    setCats((prev) =>
      prev.map((c) => (c.id === categoryId ? { ...c, items: ids.map((id) => c.items.find((i) => i.id === id)!).filter(Boolean) } : c)),
    );
    startTransition(async () => {
      const res = await reorderItems(props.restaurantId, categoryId, { ids });
      if (!res.ok) toast.error(res.error);
      refresh();
    });
  }

  function toggleFlag(item: EditorItem, flag: "soldOut" | "bestseller", value: boolean) {
    setCats((prev) => prev.map((c) => ({ ...c, items: c.items.map((i) => (i.id === item.id ? { ...i, [flag]: value } : i)) })));
    startTransition(async () => {
      const res = await setItemFlag(props.restaurantId, item.id, flag, value);
      if (!res.ok) {
        toast.error(res.error);
        refresh();
      } else if (flag === "soldOut") {
        toast.success(value ? `${item.name} marked sold out` : `${item.name} is available again`);
      }
    });
  }

  function removeItem(item: EditorItem) {
    if (!confirm(`Delete “${item.name}”?`)) return;
    setCats((prev) => prev.map((c) => ({ ...c, items: c.items.filter((i) => i.id !== item.id) })));
    startTransition(async () => {
      const res = await deleteItem(props.restaurantId, item.id);
      if (!res.ok) toast.error(res.error);
      refresh();
    });
  }

  function removeCategory(cat: EditorCategory) {
    if (!confirm(`Delete “${cat.name}” and its ${cat.items.length} item(s)? This can't be undone.`)) return;
    setCats((prev) => prev.filter((c) => c.id !== cat.id));
    startTransition(async () => {
      const res = await deleteCategory(props.restaurantId, cat.id);
      if (!res.ok) toast.error(res.error);
      refresh();
    });
  }

  function loadSample() {
    startTransition(async () => {
      const res = await addSampleMenu(props.restaurantId);
      if (!res.ok) toast.error(res.error);
      else toast.success("Sample menu added — edit it to make it yours.");
      refresh();
    });
  }

  return (
    <div className="space-y-5">
      {props.welcome && (
        <div className="flex items-start gap-3 rounded-2xl border border-primary/30 bg-accent/60 p-4">
          <PartyPopperIcon className="mt-0.5 size-5 shrink-0 text-primary" />
          <div className="text-sm">
            <p className="font-medium">Your page is live.</p>
            <p className="text-muted-foreground">
              Edit your dishes below, then add your hours and address in <Link className="underline" href={`/dashboard/r/${props.restaurantId}/details`}>Business info</Link> and print your{" "}
              <Link className="underline" href={`/dashboard/r/${props.restaurantId}/qr`}>QR codes</Link>.
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          <span className={cn("font-medium text-foreground", atLimit && "text-destructive")}>{totalItems}</span> / {props.itemLimit} items
          {atLimit && props.plan === "free" && (
            <>
              {" · "}
              <Link href="/dashboard/billing" className="font-medium text-primary underline-offset-2 hover:underline">Upgrade for more</Link>
            </>
          )}
        </p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setCatDialog({ open: true })}>
            <PlusIcon /> Category
          </Button>
          <Button onClick={() => setItemDialog({ open: true, categoryId: cats[0]?.id })} disabled={cats.length === 0 || atLimit}>
            <PlusIcon /> Item
          </Button>
        </div>
      </div>

      {cats.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-card px-6 py-16 text-center">
          <div className="mx-auto grid size-12 place-items-center rounded-full bg-accent text-primary">
            <UtensilsIcon className="size-6" />
          </div>
          <h2 className="mt-4 text-lg font-semibold">Your menu is empty</h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">Start with a category like “Starters” or “Coffee”, or load a sample menu to see how it works.</p>
          <div className="mt-6 flex justify-center gap-2">
            <Button onClick={() => setCatDialog({ open: true })}><PlusIcon /> Add a category</Button>
            <Button variant="outline" onClick={loadSample}><SparklesIcon /> Use sample menu</Button>
          </div>
        </div>
      ) : (
        <DndContext id="categories-dnd" sensors={sensors} collisionDetection={closestCenter} onDragEnd={onCategoryDragEnd}>
          <SortableContext items={cats.map((c) => c.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-4">
              {cats.map((cat) => (
                <SortableCategory
                  key={cat.id}
                  category={cat}
                  currency={props.currency}
                  sensors={sensors}
                  canAdd={!atLimit}
                  onEdit={() => setCatDialog({ open: true, category: cat })}
                  onDelete={() => removeCategory(cat)}
                  onAddItem={() => setItemDialog({ open: true, categoryId: cat.id })}
                  onEditItem={(item) => setItemDialog({ open: true, item })}
                  onDeleteItem={removeItem}
                  onToggle={toggleFlag}
                  onReorder={(ids) => onItemsReorder(cat.id, ids)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <CategoryDialog
        restaurantId={props.restaurantId}
        open={catDialog.open}
        category={catDialog.category}
        onOpenChange={(open) => setCatDialog((s) => ({ ...s, open }))}
        onSaved={refresh}
      />
      <ItemDialog
        key={itemDialog.item?.id ?? `new-${itemDialog.categoryId}-${String(itemDialog.open)}`}
        restaurantId={props.restaurantId}
        currency={props.currency}
        categories={cats.map((c) => ({ id: c.id, name: c.name }))}
        open={itemDialog.open}
        item={itemDialog.item}
        defaultCategoryId={itemDialog.categoryId}
        onOpenChange={(open) => setItemDialog((s) => ({ ...s, open }))}
        onSaved={refresh}
      />
    </div>
  );
}

function SortableCategory(props: {
  category: EditorCategory;
  currency: string;
  sensors: ReturnType<typeof useSensors>;
  canAdd: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onAddItem: () => void;
  onEditItem: (i: EditorItem) => void;
  onDeleteItem: (i: EditorItem) => void;
  onToggle: (i: EditorItem, flag: "soldOut" | "bestseller", v: boolean) => void;
  onReorder: (ids: string[]) => void;
}) {
  const { category: cat } = props;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: cat.id });

  function onDragEnd(e: DragEndEvent) {
    if (!e.over || e.active.id === e.over.id) return;
    const ids = cat.items.map((i) => i.id);
    props.onReorder(arrayMove(ids, ids.indexOf(String(e.active.id)), ids.indexOf(String(e.over.id))));
  }

  return (
    <section
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn("rounded-2xl border bg-card", isDragging && "relative z-10 shadow-xl")}
    >
      <div className="flex items-center gap-2 border-b px-3 py-3 sm:px-4">
        <button className="cursor-grab touch-none rounded p-1 text-muted-foreground hover:bg-muted active:cursor-grabbing" aria-label={`Reorder ${cat.name}`} {...attributes} {...listeners}>
          <GripVerticalIcon className="size-4" />
        </button>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-semibold">{cat.name}</h3>
          {cat.description && <p className="truncate text-xs text-muted-foreground">{cat.description}</p>}
        </div>
        <span className="text-xs text-muted-foreground">{cat.items.length}</span>
        <Button size="sm" variant="ghost" onClick={props.onAddItem} disabled={!props.canAdd}>
          <PlusIcon /> <span className="hidden sm:inline">Add item</span>
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon-sm" variant="ghost" aria-label="Category options"><MoreHorizontalIcon /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={props.onEdit}><PencilIcon /> Rename</DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onSelect={props.onDelete}><Trash2Icon /> Delete category</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {cat.items.length === 0 ? (
        <button onClick={props.onAddItem} disabled={!props.canAdd} className="w-full px-4 py-6 text-sm text-muted-foreground hover:text-foreground">
          No items yet — add the first one
        </button>
      ) : (
        <DndContext id={`items-dnd-${cat.id}`} sensors={props.sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={cat.items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
            <ul className="divide-y">
              {cat.items.map((item) => (
                <SortableItem
                  key={item.id}
                  item={item}
                  currency={props.currency}
                  onEdit={() => props.onEditItem(item)}
                  onDelete={() => props.onDeleteItem(item)}
                  onToggle={(f, v) => props.onToggle(item, f, v)}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}
    </section>
  );
}

function SortableItem(props: {
  item: EditorItem;
  currency: string;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: (flag: "soldOut" | "bestseller", v: boolean) => void;
}) {
  const { item } = props;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn("flex items-center gap-3 bg-card px-3 py-2.5 sm:px-4", isDragging && "relative z-10 shadow-lg")}
    >
      <button className="cursor-grab touch-none rounded p-1 text-muted-foreground hover:bg-muted active:cursor-grabbing" aria-label={`Reorder ${item.name}`} {...attributes} {...listeners}>
        <GripVerticalIcon className="size-4" />
      </button>
      {item.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- thumbnail from storage
        <img src={item.imageUrl} alt="" className="size-10 shrink-0 rounded-lg object-cover" />
      ) : (
        <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
          <UtensilsIcon className="size-4" />
        </div>
      )}
      <button onClick={props.onEdit} className={cn("min-w-0 flex-1 text-left", item.soldOut && "opacity-55")}>
        <div className="flex items-center gap-1.5">
          {item.diet && <DietDot diet={item.diet} size="sm" />}
          <span className="truncate text-sm font-medium">{item.name}</span>
          {item.bestseller && <StarIcon className="size-3.5 shrink-0 fill-amber-400 text-amber-400" aria-label="Bestseller" />}
          {item.spicy > 0 && <FlameIcon className="size-3.5 shrink-0 fill-red-500 text-red-500" aria-label="Spicy" />}
        </div>
        <span className="text-xs text-muted-foreground">{formatMoney(item.priceMinor, props.currency)}</span>
      </button>
      <label className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
        <span className="hidden sm:inline">{item.soldOut ? "Sold out" : "Available"}</span>
        <Switch checked={!item.soldOut} onCheckedChange={(v) => props.onToggle("soldOut", !v)} aria-label={`${item.name} available`} />
      </label>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="icon-sm" variant="ghost" aria-label="Item options"><MoreHorizontalIcon /></Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={props.onEdit}><PencilIcon /> Edit</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => props.onToggle("bestseller", !item.bestseller)}>
            <StarIcon /> {item.bestseller ? "Remove bestseller" : "Mark as bestseller"}
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onSelect={props.onDelete}><Trash2Icon /> Delete</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}
