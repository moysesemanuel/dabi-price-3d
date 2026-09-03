import Link from "next/link";
import { AdminUserDetailPanel } from "@/components/admin/admin-user-detail-panel";
import { getAdminUserMembershipsForSession, getAdminUsersSnapshot } from "@/lib/auth/admin-users";
import { requireCurrentAuthSession } from "@/lib/auth/session";

export default async function AdminUserDetailPage({ params }: { params: Promise<{ userId: string }> }) {
  const session = await requireCurrentAuthSession();
  const { userId } = await params;
  const snapshot = await getAdminUsersSnapshot(session);
  const user = snapshot.users.find((item) => item.userId === userId);
  const memberships = await getAdminUserMembershipsForSession({ session, userId });

  if (!user || !memberships) return <p className="text-sm text-[var(--muted)]">Usuario nao encontrado.</p>;

  return <div className="space-y-6"><Link href="/admin/usuarios" className="text-sm font-medium text-[var(--accent)]">Voltar para usuarios</Link><AdminUserDetailPanel user={user} memberships={memberships} currentUserId={session.user.id} activeSuperAdmins={snapshot.summary.activeSuperAdmins} /></div>;
}
