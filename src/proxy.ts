import { NextResponse, type NextRequest } from "next/server";

/**
 * Custom domains: requests for a restaurant's own domain (e.g. menu.mycafe.com)
 * are rewritten to /site/<domain>, which renders that restaurant's page.
 */
function ownHosts(): string[] {
  const hosts = ["localhost", "127.0.0.1"];
  for (const v of [process.env.APP_URL, process.env.AUTH_URL]) {
    if (v) {
      try {
        hosts.push(new URL(v).hostname);
      } catch {
        /* ignore */
      }
    }
  }
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) hosts.push(process.env.VERCEL_PROJECT_PRODUCTION_URL);
  return hosts;
}

export function proxy(request: NextRequest) {
  const host = (request.headers.get("host") ?? "").split(":")[0].toLowerCase();
  if (!host || host.endsWith(".vercel.app") || ownHosts().some((h) => host === h || host === `www.${h}`)) {
    return NextResponse.next();
  }
  if (request.nextUrl.pathname === "/") {
    const url = request.nextUrl.clone();
    url.pathname = `/site/${host}`;
    return NextResponse.rewrite(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/"],
};
