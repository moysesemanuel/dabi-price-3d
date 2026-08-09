import { redirect } from "next/navigation";
import { BackLink } from "@/components/app/back-link";
import { PlatformUsersPanel } from "@/components/admin/platform-users-panel";
import { isSuperAdminSession } from "@/lib/auth/access-control";
import { getAdminUsersSnapshot } from "@/lib/auth/admin-users";
import { getCurrentAuthSession } from "@/lib/auth/session";

export default async function PlatformUsersPage() {
  const session = await getCurrentAuthSession();

  if (!session) {
    redirect("/login");
  }

  if (!isSuperAdminSession(session)) {
    redirect("/app/precificacao");
  }

  let initialSnapshot = null;
  let initialError: string | null = null;

  try {
    initialSnapshot = await getAdminUsersSnapshot(session);
  } catch (error) {
    initialError =
      error instanceof Error
        ? error.message
        : "Falha ao carregar usuarios da plataforma.";
  }

  return (
    <div className="app-page">
      <header className="app-header">
        <BackLink href="/app/precificacao" label="Voltar para a precificadora" />
        <p className="app-eyebrow">Usuarios</p>
        <h1 className="app-title">Listagem administrativa de usuarios</h1>
        <p className="app-copy">
          Area exclusiva da sua conta super admin para localizar usuarios,
          revisar status de acesso e ajustar dados cadastrais quando um chamado
          de suporte pedir intervencao manual.
        </p>
      </header>

      <PlatformUsersPanel
        initialSnapshot={initialSnapshot}
        initialError={initialError}
      />
    </div>
  );
}
