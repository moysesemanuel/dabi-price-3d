import { BackLink } from "@/components/app/back-link";
import { WorkspaceMembersPanel } from "@/components/account/workspace-members-panel";
import { getCurrentAuthSession } from "@/lib/auth/session";
import { getWorkspaceMembersSnapshot } from "@/lib/auth/workspace-members";

export default async function TeamPage() {
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
        <BackLink href="/app" label="Voltar para o início" />
        <p className="app-eyebrow">Equipe</p>
        <h1 className="app-title">Pessoas que operam este workspace</h1>
        <p className="app-copy">
          Convide membros, distribua papéis e mantenha a separação entre owner,
          manager e operator sem misturar isso com a conta pessoal.
        </p>
      </header>

      <WorkspaceMembersPanel
        initialSnapshot={initialSnapshot}
        initialError={initialError}
      />
    </div>
  );
}
