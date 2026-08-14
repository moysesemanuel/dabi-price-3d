import Link from "next/link";
import type { ReactNode } from "react";
import { BackLink } from "@/components/app/back-link";
import { BillingDowngradeButton } from "@/components/payments/billing-downgrade-button";
import { BillingUpgradePixButton } from "@/components/payments/billing-upgrade-pix-button";
import { MercadoPagoCheckoutButton } from "@/components/payments/mercado-pago-checkout-button";
import { ManualPixCheckoutButton } from "@/components/payments/manual-pix-checkout-button";
import { getCurrentAuthSession } from "@/lib/auth/session";
import {
  findCurrentBillingSubscriptionForWorkspace,
  findLatestOpenBillingSubscriptionChange,
} from "@/lib/billing/repository";
import type { BillingSubscription } from "@/lib/billing/types";
import {
  getWorkspacePreferences,
  isPlatformPersistenceAvailable,
} from "@/lib/server/platform";
import {
  defaultAppPreferences,
  getWorkspaceBillingCycleLabel,
  getWorkspacePlan,
  resolveWorkspacePlanPriceLabel,
  workspacePlans,
} from "@/lib/settings/app-preferences";
import {
  canAccessPaidWorkspaceFeatures,
  getSubscriptionStatusLabel,
} from "@/lib/workspace/subscription-access";

const planFeatureRows = [
  {
    label: "Precificações e exportação PDF",
    values: {
      starter: "Ilimitado",
      growth: "Ilimitado",
      scale: "Ilimitado",
    },
  },
  {
    label: "Orçamentos salvos",
    values: {
      starter: "Até 50",
      growth: "Até 200",
      scale: "Até 1000",
    },
  },
  {
    label: "Usuários incluídos",
    values: {
      starter: "1 usuário",
      growth: "3 usuários",
      scale: "10 usuários",
    },
  },
  {
    label: "Logo e identidade da empresa",
    values: {
      starter: "Incluído",
      growth: "Incluído",
      scale: "Incluído",
    },
  },
  {
    label: "Modelos de orçamento",
    values: {
      starter: "Base",
      growth: "Avançado",
      scale: "Completo",
    },
  },
  {
    label: "Integrações ERP e Mercado Livre",
    values: {
      starter: "Sob demanda",
      growth: "Disponível",
      scale: "Prioridade máxima",
    },
  },
  {
    label: "Suporte",
    values: {
      starter: "Base",
      growth: "Prioritário",
      scale: "Consultivo",
    },
  },
] as const;

const planFaq = [
  {
    question: "Já existe cobrança dentro do app?",
    answer:
      "A cobrança está sendo organizada pelo fluxo público de assinatura com Mercado Pago. Aqui dentro, a página continua servindo para comparação e orientação de upgrade.",
  },
  {
    question: "Posso mudar o plano depois?",
    answer:
      "Sim. A estrutura já está preparada para refletir o plano atual da conta e suportar upgrades sem mexer no restante do workspace.",
  },
  {
    question: "O que muda na prática entre as faixas?",
    answer:
      "Hoje as diferenças mais objetivas são histórico salvo, quantidade de usuários e prioridade de integração e suporte. A página mostra isso de forma centralizada.",
  },
] as const;

export default async function PlansPage({
  searchParams,
}: {
  searchParams?: Promise<{
    plan?: string;
    origin?: string;
    billingCycle?: string;
  }>;
}) {
  const params = (await searchParams) ?? {};

  const selectedPlan =
    params.plan === "starter" || params.plan === "growth"
      ? params.plan
      : undefined;
  const requestedBillingCycle =
    params.billingCycle === "annual" ? "annual" : "monthly";

  const session = await getCurrentAuthSession();
  const preferences =
    session && isPlatformPersistenceAvailable()
      ? await getWorkspacePreferences(session.workspace.id).catch(
          () => defaultAppPreferences,
        )
      : defaultAppPreferences;
  const billingSubscription =
    session && isPlatformPersistenceAvailable()
      ? await findCurrentBillingSubscriptionForWorkspace(session.workspace.id).catch(
          () => null,
        )
      : null;
  const scheduledDowngrade =
    billingSubscription && isPlatformPersistenceAvailable()
      ? await findLatestOpenBillingSubscriptionChange({
          subscriptionId: billingSubscription.id,
          type: "downgrade",
        }).catch(() => null)
      : null;
  const pendingUpgrade =
    billingSubscription && isPlatformPersistenceAvailable()
      ? await findLatestOpenBillingSubscriptionChange({
          subscriptionId: billingSubscription.id,
          type: "upgrade",
        }).catch(() => null)
      : null;
  const currentPlan = getWorkspacePlan(
    billingSubscription?.planId ?? preferences.subscription.planId,
  );

  const subscriptionStatus = preferences.subscription.status;
  const hasPaidAccess = canAccessPaidWorkspaceFeatures(preferences.subscription);
  const currentBillingCycle =
    billingSubscription?.billingCycle ?? preferences.subscription.billingCycle;
  const selectedBillingCycle = hasPaidAccess
    ? currentBillingCycle
    : requestedBillingCycle;
  const showBillingCycleSelector =
    !hasPaidAccess ||
    subscriptionStatus === "pending" ||
    subscriptionStatus === "canceled" ||
    subscriptionStatus === "paused";
  const subscriptionStatusLabel = getSubscriptionStatusLabel(subscriptionStatus);
  const scheduledDowngradePlan =
    scheduledDowngrade?.status === "scheduled" && scheduledDowngrade.toPlanId
      ? getWorkspacePlan(scheduledDowngrade.toPlanId)
      : null;
  const pendingUpgradePlan =
    pendingUpgrade?.status === "pending_payment" && pendingUpgrade.toPlanId
      ? getWorkspacePlan(pendingUpgrade.toPlanId)
      : null;
  const pendingCheckoutHref =
    currentPlan.id === "starter" || currentPlan.id === "growth"
      ? `/app/checkout?plan=${currentPlan.id}&billingCycle=${currentBillingCycle}`
      : "/app/checkout";

  return (
    <div className="app-page space-y-6">
      <header className="app-header">
        <BackLink href="/app" label="Voltar para o início" />
        <p className="app-eyebrow">Planos</p>
        <h1 className="app-title">Plano atual e evolução da conta</h1>
        <p className="app-copy">
          Visualize a faixa contratada do workspace, compare o que muda em cada
          plano e deixe a área comercial do produto mais clara para o usuário.
        </p>
      </header>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_340px]">
        <div className="app-card p-6 sm:p-7">
          <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-[var(--accent)]">
            {subscriptionStatus === "trial"
              ? "Plano de avaliação"
              : subscriptionStatus === "unpaid"
                ? "Contratação pendente"
                : subscriptionStatus === "pending"
                  ? "Pagamento pendente"
                  : hasPaidAccess
                    ? "Plano em uso"
                    : "Acesso bloqueado"}
          </p>
          <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-3xl font-semibold tracking-[-0.04em] text-[var(--foreground)]">
                {currentPlan.label}
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--muted)]">
                {currentPlan.description}
              </p>
            </div>
            <span className="rounded-full border border-[var(--accent)] bg-[var(--accent-soft)] px-4 py-2 text-xs font-semibold text-[var(--accent)]">
              {subscriptionStatusLabel}
            </span>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-3">
            <PlanStat
              label="Valor vigente"
              value={formatPlanPriceDisplay(currentPlan, currentBillingCycle)}
            />
            <PlanStat
              label="Orçamentos salvos"
              value={`Até ${currentPlan.historyLimit}`}
            />
            <PlanStat
              label="Equipe incluída"
              value={`${currentPlan.seatsIncluded} ${
                currentPlan.seatsIncluded === 1 ? "usuário" : "usuários"
              }`}
            />
          </div>

          {showBillingCycleSelector ? (
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[var(--muted)]">
                Ciclo do novo checkout
              </p>
              <div className="inline-flex items-center gap-2 rounded-full border border-[var(--panel-border)] bg-[rgba(255,255,255,0.76)] p-1">
                <Link
                  href={{
                    pathname: "/app/planos",
                    query: {
                      ...(selectedPlan ? { plan: selectedPlan } : {}),
                      ...(params.origin ? { origin: params.origin } : {}),
                      billingCycle: "monthly",
                    },
                  }}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                    selectedBillingCycle === "monthly"
                      ? "bg-[var(--accent)] text-white"
                      : "text-[var(--muted)] hover:text-[var(--foreground)]"
                  }`}
                >
                  Mensal
                </Link>
                <Link
                  href={{
                    pathname: "/app/planos",
                    query: {
                      ...(selectedPlan ? { plan: selectedPlan } : {}),
                      ...(params.origin ? { origin: params.origin } : {}),
                      billingCycle: "annual",
                    },
                  }}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                    selectedBillingCycle === "annual"
                      ? "bg-[var(--accent)] text-white"
                      : "text-[var(--muted)] hover:text-[var(--foreground)]"
                  }`}
                >
                  Anual · 12 meses
                </Link>
              </div>
            </div>
          ) : null}
        </div>

        <aside className="app-card-soft p-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-[var(--muted)]">
            Próximo passo comercial
          </p>
          <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-[var(--foreground)]">
            Evolua quando fizer sentido
          </h2>
          <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
            {scheduledDowngradePlan
              ? `O downgrade para ${scheduledDowngradePlan.label} já está agendado para o fim do período atual. Até lá, o workspace continua usando ${currentPlan.label}.`
              : pendingUpgradePlan
                ? `Existe um upgrade em aberto para ${pendingUpgradePlan.label}. O plano atual só muda depois da confirmação do pagamento desse Pix.`
              : subscriptionStatus === "unpaid"
                ? "Conclua a contratação para liberar a precificadora e os demais módulos pagos do workspace."
                : subscriptionStatus === "pending"
                  ? `Você iniciou a contratação ${currentBillingCycle === "annual" ? "anual" : "mensal"} deste plano, mas o pagamento ainda não foi concluído.`
                  : "O upgrade pode seguir pelo fluxo público de assinatura com Mercado Pago ou, quando fizer mais sentido reduzir a faixa, o downgrade é agendado para o próximo ciclo."}
          </p>
          <div className="mt-5 grid gap-3">
            <Link
              href={
                pendingUpgradePlan
                  ? "/app/assinatura/upgrade"
                  : subscriptionStatus === "pending"
                    ? pendingCheckoutHref
                    : "/contato"
              }
              className="app-button app-button-primary w-full"
            >
              {pendingUpgradePlan
                ? "Revisar upgrade"
                : subscriptionStatus === "pending"
                ? "Continuar pagamento"
                : "Falar sobre upgrade"}
            </Link>
            <Link
              href="/app/perfil-empresa"
              className="app-button app-button-secondary w-full"
            >
              Revisar perfil da empresa
            </Link>
          </div>
        </aside>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        {workspacePlans.map((plan) => {
          const subscriptionStatus = preferences.subscription.status;

          const isSubscriptionPlan = plan.id === currentPlan.id;
          const isCurrent =
            isSubscriptionPlan &&
            (subscriptionStatus === "internal" ||
              subscriptionStatus === "trial" ||
              subscriptionStatus === "active");

          const isPending =
            isSubscriptionPlan && subscriptionStatus === "pending";

          const isPaused =
            isSubscriptionPlan && subscriptionStatus === "paused";

          const isCanceled =
            isSubscriptionPlan && subscriptionStatus === "canceled";

          const checkoutPlanId =
            plan.id === "starter" || plan.id === "growth" ? plan.id : null;

          const isSelected = selectedPlan === plan.id;
          const canScheduleDowngrade = canSchedulePlanDowngrade({
            planId: plan.id,
            currentSubscription: billingSubscription,
          });
          const isScheduledDowngradeTarget =
            scheduledDowngrade?.status === "scheduled" &&
            scheduledDowngrade.toPlanId === plan.id;
          const isPendingUpgradeTarget =
            pendingUpgrade?.status === "pending_payment" &&
            pendingUpgrade.toPlanId === plan.id;
          const downgradePlanId =
            plan.id === "starter" || plan.id === "growth" ? plan.id : null;
          const upgradePlanId =
            plan.id === "growth" || plan.id === "scale" ? plan.id : null;
          const canRequestUpgrade = canRequestPlanUpgrade({
            planId: plan.id,
            currentSubscription: billingSubscription,
          });
          const supportsSelfServeUpgrade = plan.monthlyPrice !== null;
          const checkoutBillingCycle =
            isPending && isSelected ? selectedBillingCycle : currentBillingCycle;
          const isPendingCycleReplacement =
            isPending &&
            isSelected &&
            selectedBillingCycle !== currentBillingCycle;

          return (
            <article
              key={plan.id}
              className={`rounded-[28px] border p-6 shadow-[0_18px_44px_rgba(57,37,118,0.06)] ${isCurrent
                ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                : "border-[var(--panel-border)] bg-[rgba(255,255,255,0.82)]"
                }`}
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-2xl font-semibold tracking-[-0.04em] text-[var(--foreground)]">
                  {plan.label}
                </p>
                {isCurrent ? (
                  <span className="rounded-full bg-[var(--accent)] px-3 py-1 text-xs font-semibold text-white">
                    Atual
                  </span>
                ) : isPending ? (
                  <span className="rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent)]">
                    Aguardando pagamento
                  </span>
                ) : isPaused ? (
                  <span className="rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent)]">
                    Pausado
                  </span>
                ) : isCanceled ? (
                  <span className="rounded-full border border-[var(--panel-border)] px-3 py-1 text-xs font-semibold text-[var(--muted)]">
                    Cancelado
                  </span>
                ) : isSelected ? (
                  <span className="rounded-full bg-[var(--accent)] px-3 py-1 text-xs font-semibold text-white">
                    Escolhido
                  </span>
                ) : null}
              </div>

              <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
                {plan.description}
              </p>

              <div className="mt-5">
                <p className="text-3xl font-semibold tracking-[-0.05em] text-[var(--foreground)]">
                  {resolveWorkspacePlanPriceLabel(plan, selectedBillingCycle)}
                </p>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  {plan.id === "scale"
                    ? "atendimento comercial"
                    : selectedBillingCycle === "annual"
                      ? "pagamento antecipado por 12 meses"
                      : "por workspace / mês"}
                </p>
              </div>

              <div className="mt-5 space-y-3">
                <PlanBullet>Até {plan.historyLimit} orçamentos salvos</PlanBullet>
                <PlanBullet>
                  {plan.seatsIncluded}{" "}
                  {plan.seatsIncluded === 1 ? "usuário incluído" : "usuários incluídos"}
                </PlanBullet>
                <PlanBullet>{plan.supportLabel}</PlanBullet>
                <PlanBullet>
                  {plan.erpSyncEnabled
                    ? "Integrações ERP liberadas"
                    : "Integrações ERP sob avaliação"}
                </PlanBullet>
              </div>

              <div className="mt-6">
                {isCurrent ? (
                  <div className="app-button app-button-secondary w-full justify-center text-center">
                    Plano atual
                  </div>
                ) : isPending ? (
                  checkoutPlanId ? (
                    <div className="grid gap-3">
                      <MercadoPagoCheckoutButton
                        planId={checkoutPlanId}
                        billingCycle={checkoutBillingCycle}
                        label={
                          isPendingCycleReplacement
                            ? `Abrir checkout ${getWorkspaceBillingCycleLabel(selectedBillingCycle).toLowerCase()}`
                            : "Continuar pagamento"
                        }
                        loadingLabel="Abrindo pagamento..."
                        className="app-button app-button-secondary w-full"
                      />
                      <ManualPixCheckoutButton
                        planId={checkoutPlanId}
                        billingCycle={checkoutBillingCycle}
                        label={
                          isPendingCycleReplacement
                            ? `Gerar Pix ${getWorkspaceBillingCycleLabel(selectedBillingCycle).toLowerCase()}`
                            : "Trocar para Pix manual"
                        }
                      />
                    </div>
                  ) : (
                    <div className="app-button app-button-secondary w-full justify-center text-center">
                      Aguardando confirmação do pagamento
                    </div>
                  )
                ) : isPaused ? (
                  <Link
                    href="/app/assinatura"
                    className="app-button app-button-secondary w-full"
                  >
                    Ver detalhes da assinatura
                  </Link>
                ) : plan.id === "scale" ? (
                  <Link
                    href="/contato"
                    className="app-button app-button-primary w-full"
                  >
                    Falar sobre o DaBi Equipe
                  </Link>
                ) : isPendingUpgradeTarget ? (
                  <Link
                    href="/app/assinatura/upgrade"
                    className="app-button app-button-primary w-full"
                  >
                    Continuar upgrade
                  </Link>
                ) : pendingUpgrade?.status === "pending_payment" ? (
                  <Link
                    href="/app/assinatura/upgrade"
                    className="app-button app-button-secondary w-full"
                  >
                    Revisar upgrade pendente
                  </Link>
                ) : canRequestUpgrade &&
                  supportsSelfServeUpgrade &&
                  upgradePlanId ? (
                  <BillingUpgradePixButton
                    targetPlanId={upgradePlanId}
                    label={`Fazer upgrade para ${plan.label}`}
                  />
                ) : canScheduleDowngrade && downgradePlanId ? (
                  isScheduledDowngradeTarget ? (
                    <div className="app-button app-button-secondary w-full justify-center text-center">
                      Downgrade agendado
                    </div>
                  ) : (
                    <BillingDowngradeButton
                      targetPlanId={downgradePlanId}
                      label={
                        scheduledDowngrade?.status === "scheduled"
                          ? `Trocar downgrade para ${plan.label}`
                          : `Agendar ${plan.label} no próximo ciclo`
                      }
                    />
                  )
                ) : (
                  <div className="grid gap-3">
                    <MercadoPagoCheckoutButton
                      planId={plan.id}
                      billingCycle={selectedBillingCycle}
                      label={isCanceled ? `Assinar ${plan.label} novamente` : `Assinar ${plan.label}`}
                    />
                    <ManualPixCheckoutButton
                      planId={plan.id}
                      billingCycle={selectedBillingCycle}
                      label={`Gerar Pix para ${plan.label}`}
                    />
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </section>

      <section className="app-card p-0 overflow-hidden">
        <div className="border-b border-[var(--panel-border)] px-6 py-5 sm:px-7">
          <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-[var(--accent)]">
            Comparação rápida
          </p>
          <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-[var(--foreground)]">
            O que muda de um plano para outro
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="bg-[rgba(255,255,255,0.7)] text-left">
                <th className="border-b border-[var(--panel-border)] px-6 py-4 font-semibold text-[var(--foreground)]">
                  Recurso
                </th>
                {workspacePlans.map((plan) => (
                  <th
                    key={plan.id}
                    className="border-b border-[var(--panel-border)] px-6 py-4 font-semibold text-[var(--foreground)]"
                  >
                    {plan.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {planFeatureRows.map((row) => (
                <tr key={row.label} className="bg-[rgba(255,255,255,0.74)]">
                  <td className="border-b border-[var(--panel-border)] px-6 py-4 text-[var(--foreground)]">
                    {row.label}
                  </td>
                  {workspacePlans.map((plan) => (
                    <td
                      key={`${row.label}-${plan.id}`}
                      className={`border-b border-[var(--panel-border)] px-6 py-4 ${plan.id === currentPlan.id
                        ? "font-semibold text-[var(--accent)]"
                        : "text-[var(--muted)]"
                        }`}
                    >
                      {row.values[plan.id]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        {planFaq.map((item) => (
          <article key={item.question} className="app-card p-6">
            <p className="text-lg font-semibold text-[var(--foreground)]">
              {item.question}
            </p>
            <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
              {item.answer}
            </p>
          </article>
        ))}
      </section>
    </div>
  );
}

function PlanStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[22px] border border-[var(--panel-border)] bg-[rgba(255,255,255,0.72)] px-4 py-4">
      <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[var(--muted)]">
        {label}
      </p>
      <p className="mt-3 text-lg font-semibold text-[var(--foreground)]">{value}</p>
    </div>
  );
}

function PlanBullet({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-1 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-[var(--accent)]/14 text-[11px] font-semibold text-[var(--accent)]">
        ✓
      </span>
      <p className="text-sm leading-7 text-[var(--muted)]">{children}</p>
    </div>
  );
}

function canSchedulePlanDowngrade(input: {
  planId: "starter" | "growth" | "scale";
  currentSubscription: BillingSubscription | null;
}) {
  const subscription = input.currentSubscription;

  if (!subscription || subscription.status !== "active") {
    return false;
  }

  if (!subscription.autoRenew || subscription.cancelAtPeriodEnd) {
    return false;
  }

  return planOrder.indexOf(input.planId) < planOrder.indexOf(subscription.planId);
}

function canRequestPlanUpgrade(input: {
  planId: "starter" | "growth" | "scale";
  currentSubscription: BillingSubscription | null;
}) {
  const subscription = input.currentSubscription;

  if (!subscription || subscription.status !== "active") {
    return false;
  }

  if (!subscription.autoRenew || subscription.cancelAtPeriodEnd) {
    return false;
  }

  return planOrder.indexOf(input.planId) > planOrder.indexOf(subscription.planId);
}

const planOrder = ["starter", "growth", "scale"] as const;

function formatPlanPriceDisplay(
  plan: ReturnType<typeof getWorkspacePlan>,
  billingCycle: "monthly" | "annual",
) {
  const priceLabel = resolveWorkspacePlanPriceLabel(plan, billingCycle);

  if (plan.id === "scale") {
    return priceLabel;
  }

  return billingCycle === "annual" ? priceLabel : `${priceLabel}/mês`;
}
