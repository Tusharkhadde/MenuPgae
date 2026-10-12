"use client";

import Link from "next/link";
import { CreditCardIcon, LogOutIcon, PlusIcon, StoreIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { signOutAction } from "@/app/dashboard/actions";

export function UserMenu(props: {
  name: string;
  email: string;
  image: string | null;
  restaurants: { id: string; name: string }[];
  isDemo: boolean;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50" aria-label="Account menu">
        <Avatar className="size-8">
          {props.image && <AvatarImage src={props.image} alt="" />}
          <AvatarFallback className="bg-accent text-xs font-semibold text-accent-foreground">{props.name.slice(0, 1).toUpperCase()}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="font-normal">
          <p className="truncate text-sm font-medium">{props.name}</p>
          {!props.isDemo && <p className="truncate text-xs text-muted-foreground">{props.email}</p>}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {props.restaurants.map((r) => (
          <DropdownMenuItem key={r.id} asChild>
            <Link href={`/dashboard/r/${r.id}/menu`}>
              <StoreIcon /> <span className="truncate">{r.name}</span>
            </Link>
          </DropdownMenuItem>
        ))}
        <DropdownMenuItem asChild>
          <Link href="/dashboard/new">
            <PlusIcon /> New restaurant
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/dashboard/billing">
            <CreditCardIcon /> Plan &amp; billing
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void signOutAction()}>
          <LogOutIcon /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
