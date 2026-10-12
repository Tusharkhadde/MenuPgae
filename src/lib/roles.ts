export type AccessRole = "owner" | "manager" | "staff";

const RANK: Record<AccessRole, number> = { owner: 3, manager: 2, staff: 1 };

export function roleAtLeast(role: AccessRole, min: AccessRole): boolean {
  return RANK[role] >= RANK[min];
}

/** Dashboard tabs each role can see. */
export function tabsForRole(role: AccessRole): string[] {
  const staff = ["orders"];
  const manager = ["overview", "orders", "menu", "qr", "engage", "analytics"];
  const owner = [...manager, "details", "design", "growth", "team", "settings"];
  return role === "owner" ? owner : role === "manager" ? manager : staff;
}
