import Link from "next/link";
import { AdminWorkspaceManagementPanel } from "@/components/admin/admin-workspace-management-panel";
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
    <AdminWorkspaceManagementPanel workspaceId={workspaceId} initialName={workspace.workspaceName} initialMembers={members} />
    <section className="app-card p-6">
      <dl className="grid gap-4 text-sm md:grid-cols-3">
        <div><dt className="text-[var(--muted)]">Slug</dt><dd>{workspace.workspaceSlug}</dd></div>
        <div><dt className="text-[var(--muted)]">Owner atual</dt><dd>{workspace.ownerEmail ?? "Sem owner"}</dd></div>
        <div><dt className="text-[var(--muted)]">Assinatura</dt><dd>{workspace.currentPlanId ?? "Sem plano"} · {workspace.currentStatus ?? "sem assinatura"}</dd></div>
        <div><dt className="text-[var(--muted)]">Acesso</dt><dd>{workspace.accessUntil ?? workspace.currentPeriodEnd ?? "—"}</dd></div>
        <div><dt className="text-[var(--muted)]">Calculos</dt><dd>{workspace.calculationsCount}</dd></div>
      </dl>
    </section>
  </div>;
}
