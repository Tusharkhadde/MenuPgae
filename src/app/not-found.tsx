import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="grid min-h-dvh place-items-center px-4">
      <div className="text-center">
        <p className="font-mono text-sm text-primary">404</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">This page isn&apos;t on the menu</h1>
        <p className="mt-2 text-muted-foreground">The link may be old, or the restaurant may have changed its address.</p>
        <Button asChild className="mt-6"><Link href="/">Go to MenuPage</Link></Button>
      </div>
    </div>
  );
}
