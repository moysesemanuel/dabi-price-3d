import { BackLink } from "@/components/app/back-link";
import { WorkspaceMembersPanel } from "@/components/account/workspace-members-panel";
import { getCurrentAuthSession } from "@/lib/auth/session";
import { getWorkspaceMembersSnapshot } from "@/lib/auth/workspace-members";

export default async function AccountPage() {
  let initialSnapshot = null;
  let initialError: string | null = null;
  const session = await getCurrentAuthSession();

  if (session) {
    initialSnapshot = await getWorkspaceMembersSnapshot(session);
  } else {
    initialError = "Nao autenticado.";
  }

  return (
    <div className="app-page">
      <header className="app-header">
        <BackLink href="/app/precificacao" label="Voltar para a precificadora" />
        <p className="app-eyebrow">Conta</p>
        <h1 className="app-title">Usuarios, acesso e governanca</h1>
        <p className="app-copy">
          Convide membros, distribua ownership e mantenha a separacao entre
          super admin, owner, manager e operator no workspace atual.
        </p>
      </header>

      <WorkspaceMembersPanel
        initialSnapshot={initialSnapshot}
        initialError={initialError}
      />
    </div>
  );
}
