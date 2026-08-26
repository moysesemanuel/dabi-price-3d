import Link from "next/link";
import { requireCurrentAuthSession } from "@/lib/auth/session";
import { getAdminWorkspaceMembers } from "@/lib/auth/admin-workspaces";
import { createBillingAdminService } from "@/lib/billing/server-admin-service";

export default async function AdminWorkspaceDetailPage({ params }: { params: Promise<{ workspaceId: string }> }) {
  const session = await requireCurrentAuthSession();
  const { workspaceId } = await params;
  const snapshot = await createBillingAdminService().getSnapshot(session);
  const workspace = snapshot.workspaces.find((item) => item.workspaceId === workspaceId);
  if (!workspace) return <p className="text-sm text-[var(--muted)]">Workspace nao encontrado.</p>;
  const members = await getAdminWorkspaceMembers({ session, workspaceId });

  return <div className="space-y-6">
    <Link href="/admin/workspaces" className="text-sm font-medium text-[var(--accent)]">Voltar para workspaces</Link>
    <section className="app-card p-6">
      <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-[var(--accent)]">Workspace</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em]">{workspace.workspaceName}</h1>
      <dl className="mt-6 grid gap-4 text-sm md:grid-cols-3">
        <div><dt className="text-[var(--muted)]">Slug</dt><dd>{workspace.workspaceSlug}</dd></div>
        <div><dt className="text-[var(--muted)]">Owner</dt><dd>{workspace.ownerEmail ?? "Sem owner"}</dd></div>
        <div><dt className="text-[var(--muted)]">Assinatura</dt><dd>{workspace.currentPlanId ?? "Sem plano"} · {workspace.currentStatus ?? "sem assinatura"}</dd></div>
        <div><dt className="text-[var(--muted)]">Acesso</dt><dd>{workspace.accessUntil ?? workspace.currentPeriodEnd ?? "—"}</dd></div>
        <div><dt className="text-[var(--muted)]">Calculos</dt><dd>{workspace.calculationsCount}</dd></div>
      </dl>
    </section>
    <section className="app-card p-6">
      <h2 className="text-xl font-semibold">Membros</h2>
      <div className="mt-4 space-y-3">
        {members.map((member) => <div key={member.membershipId} className="flex flex-wrap justify-between gap-2 rounded-xl border border-[var(--panel-border)] p-3 text-sm"><span>{member.fullName} · {member.email}</span><span>{member.workspaceRole} · {member.userStatus}</span></div>)}
      </div>
    </section>
  </div>;
}
