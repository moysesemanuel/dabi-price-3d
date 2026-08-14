import { redirect } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import horizontalLogo from "@/app/dabi-price-horizontal.svg";
import { BackLink } from "@/components/app/back-link";
import { RegisterForm } from "@/components/auth/register-form";
import { getCurrentAuthSession } from "@/lib/auth/session";
import { defaultAppPreferences } from "@/lib/settings/app-preferences";
import {
  getWorkspacePreferences,
  isPlatformPersistenceAvailable,
} from "@/lib/server/platform";
import { getPersistenceModeMeta } from "@/lib/server/persistence-mode";

export default async function CadastroPage({
  searchParams,
}: {
  searchParams?: Promise<{
    plan?: string;
    billingCycle?: string;
  }>;
}) {
  const params = (await searchParams) ?? {};
  const selectedPlan =
    params.plan === "starter" || params.plan === "growth"
      ? params.plan
      : undefined;
  const selectedBillingCycle =
    params.billingCycle === "annual" ? "annual" : "monthly";
  const session = await getCurrentAuthSession();
  const preferences =
    session && isPlatformPersistenceAvailable()
      ? await getWorkspacePreferences(session.workspace.id).catch(
          () => defaultAppPreferences,
        )
      : defaultAppPreferences;

  if (session) {
    redirect(
      preferences.onboardingCompleted
        ? selectedPlan
          ? `/app/planos?plan=${selectedPlan}&billingCycle=${selectedBillingCycle}&origin=public-cadastro`
          : "/app/planos"
        : selectedPlan
          ? `/app/onboarding?plan=${selectedPlan}&billingCycle=${selectedBillingCycle}`
          : "/app/onboarding",
    );
  }

  const persistenceMode = getPersistenceModeMeta();

  return (
    <main className="public-shell">
      <div className="public-grid">
        <section className="public-hero">
          <BackLink href="/" label="Voltar para a home" />

          <div className="public-pill mt-8">
            <Link href="/" className="inline-flex" aria-label="Dabi Price">
              <Image
                src={horizontalLogo}
                alt="Dabi Price"
                width={176}
                height={42}
                unoptimized
                className="h-8 w-auto"
              />
            </Link>
          </div>

          <p className="public-badge mt-8">Crie sua conta</p>

          <h1 className="public-title max-w-[700px]">
            Comece a precificar seus produtos sem achismo.
          </h1>

          <p className="public-copy max-w-[620px]">
            Crie seu workspace e organize custos, margem, mão de obra e canais
            de venda em um único lugar.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/login" className="app-button app-button-primary">
              Já tenho uma conta
            </Link>

            <Link href="/planos" className="app-button app-button-secondary">
              Ver planos
            </Link>
          </div>
        </section>

        <section className="public-panel rounded-[36px] p-6 sm:p-8">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-[var(--muted)]">
              Cadastro
            </p>

            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-[var(--foreground)]">
              Crie seu workspace
            </h2>

            <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
              Você será o proprietário inicial do workspace e poderá configurar
              sua operação depois do cadastro.
            </p>
          </div>

          <RegisterForm
            selectedPlan={selectedPlan}
            selectedBillingCycle={selectedBillingCycle}
          />

          {persistenceMode.mode === "local" ? (
            <div className="mt-5 rounded-[24px] border border-[color:var(--warning)]/24 bg-[color:var(--warning)]/10 px-4 py-4 text-sm leading-7 text-[color:var(--warning)]">
              O cadastro persistente precisa de uma DATABASE_URL configurada
              neste ambiente.
            </div>
          ) : null}

          <p className="mt-6 text-center text-sm text-[var(--muted)]">
            Já possui uma conta?{" "}
            <Link
              href="/login"
              className="font-semibold text-[var(--foreground)] underline underline-offset-4"
            >
              Entrar
            </Link>
          </p>
        </section>
      </div>
    </main>
  );
}
