import "server-only";
import { env, features } from "@/lib/env";

/**
 * Optional Vercel Domains API integration (custom domains for Pro restaurants).
 * Enabled when VERCEL_API_TOKEN and VERCEL_PROJECT_ID are set; otherwise the
 * owner gets manual DNS instructions and you add the domain in the Vercel UI.
 */

export type DomainStatus = {
  managed: boolean;
  verified: boolean | null;
  misconfigured: boolean | null;
  verification?: { type: string; domain: string; value: string }[];
  error?: string;
};

function api(path: string) {
  const e = env();
  const url = new URL(`https://api.vercel.com${path}`);
  if (e.VERCEL_TEAM_ID) url.searchParams.set("teamId", e.VERCEL_TEAM_ID);
  return url.toString();
}

async function call<T>(path: string, init?: RequestInit): Promise<{ ok: boolean; status: number; data: T }> {
  const res = await fetch(api(path), {
    ...init,
    headers: { Authorization: `Bearer ${env().VERCEL_API_TOKEN}`, "Content-Type": "application/json", ...init?.headers },
    cache: "no-store",
  });
  const data = (await res.json().catch(() => ({}))) as T;
  return { ok: res.ok, status: res.status, data };
}

type ProjectDomain = { verified?: boolean; verification?: DomainStatus["verification"]; error?: { message?: string; code?: string } };

export async function addDomain(domain: string): Promise<DomainStatus> {
  if (!features.vercelDomains()) return { managed: false, verified: null, misconfigured: null };
  const project = env().VERCEL_PROJECT_ID!;
  const res = await call<ProjectDomain>(`/v10/projects/${project}/domains`, {
    method: "POST",
    body: JSON.stringify({ name: domain }),
  });
  if (!res.ok && res.data.error?.code !== "domain_already_in_use_by_project") {
    // 400 "already exists on the project" is fine — fall through to a status check.
    if (res.status !== 400) return { managed: true, verified: false, misconfigured: null, error: res.data.error?.message ?? `Vercel API error ${res.status}` };
  }
  return getDomainStatus(domain);
}

export async function removeDomain(domain: string): Promise<void> {
  if (!features.vercelDomains()) return;
  await call(`/v9/projects/${env().VERCEL_PROJECT_ID}/domains/${encodeURIComponent(domain)}`, { method: "DELETE" });
}

export async function getDomainStatus(domain: string): Promise<DomainStatus> {
  if (!features.vercelDomains()) return { managed: false, verified: null, misconfigured: null };
  const project = env().VERCEL_PROJECT_ID!;
  const [pd, cfg] = await Promise.all([
    call<ProjectDomain>(`/v9/projects/${project}/domains/${encodeURIComponent(domain)}`),
    call<{ misconfigured?: boolean }>(`/v6/domains/${encodeURIComponent(domain)}/config`),
  ]);
  let verified = pd.data.verified ?? false;
  if (pd.ok && !verified) {
    const v = await call<ProjectDomain>(`/v9/projects/${project}/domains/${encodeURIComponent(domain)}/verify`, { method: "POST" });
    verified = v.data.verified ?? false;
  }
  return {
    managed: true,
    verified,
    misconfigured: cfg.ok ? Boolean(cfg.data.misconfigured) : null,
    verification: pd.data.verification,
    error: pd.ok ? undefined : pd.data.error?.message,
  };
}

/** DNS records the owner should create at their registrar. */
export function dnsInstructions(domain: string) {
  const labels = domain.split(".");
  const isApex = labels.length === 2;
  const target = env().CUSTOM_DOMAIN_TARGET;
  return isApex
    ? { type: "A", name: "@", value: "76.76.21.21" }
    : { type: "CNAME", name: labels.slice(0, -2).join("."), value: target ?? "cname.vercel-dns.com" };
}
