import type { Metadata } from "next";
import Link from "next/link";
import { requireUser, getPlanForUser, listAccessibleRestaurants } from "@/server/session";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserMenu } from "@/components/dashboard/user-menu";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Dashboard", robots: { index: false } };

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const [{ owned, shared }, plan] = await Promise.all([listAccessibleRestaurants(user), getPlanForUser(user.id)]);
  const list = [...owned, ...shared.map((s) => s.restaurant)].map((r) => ({ id: r.id, name: r.name }));

  return (
    <div className="flex min-h-dvh flex-col bg-muted/30">
      {user.isDemo && (
        <div className="no-print bg-amber-500 px-4 py-2 text-center text-xs text-amber-950">
          <strong>Demo data</strong> — you&apos;re in a judge demo sandbox with a fictional café. Nothing here is a real restaurant or real sales;
          it&apos;s deleted after 24 hours.{" "}
          <Link href="/login?intent=signup" className="font-semibold underline underline-offset-2">Create a real account</Link>
        </div>
      )}
      <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Logo href="/dashboard" />
            <Badge variant={plan === "pro" ? "default" : "secondary"} className="hidden sm:inline-flex">
              {plan === "pro" ? "Pro" : "Free"}
            </Badge>
          </div>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <UserMenu
              name={user.name ?? "Owner"}
              email={user.email ?? ""}
              image={user.image ?? null}
              restaurants={list}
              isDemo={user.isDemo}
            />
          </div>
        </div>
      </header>
      <div className="flex-1">{children}</div>
    </div>
  );
}
