"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2Icon, Trash2Icon, UserPlusIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Field, SectionCard } from "@/components/dashboard/field";
import { inviteTeamMember, removeTeamMember, updateTeamRole } from "@/server/actions/team";

const ROLE_HELP = {
  manager: "Menu, orders, reservations, feedback, QR codes and analytics. No billing, settings or team.",
  staff: "Orders inbox, kitchen display and table requests only.",
};

export function TeamPanel(props: { restaurantId: string; max: number; emailConfigured: boolean; members: { id: string; email: string; role: "manager" | "staff" }[] }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"manager" | "staff">("staff");
  const [pending, start] = useTransition();

  if (props.max <= 0) {
    return (
      <SectionCard title="Team members" description="Give your manager and kitchen staff their own logins — no sharing passwords.">
        <ul className="space-y-1 text-sm text-muted-foreground">
          <li><strong className="text-foreground">Manager</strong> — {ROLE_HELP.manager}</li>
          <li><strong className="text-foreground">Staff</strong> — {ROLE_HELP.staff}</li>
        </ul>
        <p className="text-sm">Team members are part of Pro (up to 10 per account). <Link href="/dashboard/billing" className="font-medium text-primary underline">See Pro</Link></p>
      </SectionCard>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <SectionCard title="Team members" description={`${props.members.length} of ${props.max} used. They sign in with Google or an email link using the address you add here.`}>
        {props.members.length === 0 ? (
          <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">Nobody yet — invite your manager or kitchen staff.</p>
        ) : (
          <ul className="divide-y rounded-xl border">
            {props.members.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                <span className="min-w-0 flex-1 truncate text-sm">{m.email}</span>
                <NativeSelect
                  aria-label={`Role for ${m.email}`}
                  value={m.role}
                  onChange={(e) =>
                    start(async () => {
                      const res = await updateTeamRole(props.restaurantId, m.id, e.target.value);
                      if (!res.ok) toast.error(res.error);
                      router.refresh();
                    })
                  }
                  className="w-32"
                >
                  <option value="manager">Manager</option>
                  <option value="staff">Staff</option>
                </NativeSelect>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label={`Remove ${m.email}`}
                  onClick={() =>
                    confirm(`Remove ${m.email}? They lose access immediately.`) &&
                    start(async () => {
                      const res = await removeTeamMember(props.restaurantId, m.id);
                      if (!res.ok) toast.error(res.error);
                      router.refresh();
                    })
                  }
                >
                  <Trash2Icon />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
      <SectionCard title="Invite someone">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const res = await inviteTeamMember(props.restaurantId, { email, role });
              if (!res.ok) {
                toast.error(res.error);
                return;
              }
              toast.success(res.data.emailed ? `Invite emailed to ${email}` : `${email} added — tell them to sign in at this site with that email`);
              setEmail("");
              router.refresh();
            });
          }}
        >
          <Field label="Email" htmlFor="t-email">
            <Input id="t-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="chef@example.com" />
          </Field>
          <Field label="Role" htmlFor="t-role" hint={ROLE_HELP[role]}>
            <NativeSelect id="t-role" value={role} onChange={(e) => setRole(e.target.value as "manager" | "staff")}>
              <option value="staff">Staff (orders only)</option>
              <option value="manager">Manager</option>
            </NativeSelect>
          </Field>
          <Button type="submit" disabled={pending || props.members.length >= props.max}>
            {pending ? <Loader2Icon className="animate-spin" /> : <UserPlusIcon />} Add to team
          </Button>
          {!props.emailConfigured && <p className="text-xs text-muted-foreground">Email isn&apos;t set up on this server, so no invite is sent — share the sign-in link with them yourself.</p>}
        </form>
      </SectionCard>
    </div>
  );
}
