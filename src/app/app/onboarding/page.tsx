import { redirect } from "next/navigation";
import { OnboardingForm } from "@/components/onboarding/onboarding-form";
import { requireCurrentAuthSession } from "@/lib/auth/session";
import { getWorkspacePreferences } from "@/lib/server/platform";

export default async function OnboardingPage() {
  const session = await requireCurrentAuthSession();

  const preferences = await getWorkspacePreferences(session.workspace.id);

  if (preferences.onboardingCompleted) {
    redirect("/app/precificacao");
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-10">
      <div className="mb-8">
        <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-[var(--muted)]">
          Configuração inicial
        </p>

        <h1 className="mt-3 text-4xl font-semibold tracking-[-0.05em] text-[var(--foreground)]">
          Vamos preparar a DaBi Price para o seu negócio.
        </h1>

        <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--muted)]">
          Escolha o tipo de operação e um perfil inicial. Você poderá ajustar
          todos esses valores depois nas preferências.
        </p>
      </div>

      <div className="rounded-[36px] border border-[var(--panel-border)] bg-[var(--panel)] p-6 sm:p-8">
        <OnboardingForm initialPreferences={preferences} />
      </div>
    </div>
  );
}
