import Link from "next/link";
import { BackLink } from "@/components/app/back-link";
import { MercadoPagoSubscriptionManageButton } from "@/components/payments/mercado-pago-subscription-manage-button";
import {
  resolveWorkspaceEntitlements,
  type WorkspaceEntitlementAccessReason,
} from "@/lib/billing/entitlement-service";
import { findCurrentBillingSubscriptionForWorkspace } from "@/lib/billing/repository";
import type { BillingSubscription } from "@/lib/billing/types";
import { getCurrentAuthSession } from "@/lib/auth/session";
import {
  getWorkspacePreferences,
  isPlatformPersistenceAvailable,
} from "@/lib/server/platform";
import {
  defaultAppPreferences,
  getWorkspacePlan,
} from "@/lib/settings/app-preferences";
import { getSubscriptionStatusLabel } from "@/lib/workspace/subscription-access";

export default async function SubscriptionPage() {
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

  const subscription = billingSubscription
    ? {
        planId: billingSubscription.planId,
        status: billingSubscription.status,
        accessUntil: billingSubscription.accessUntil,
        currentPeriodEnd: billingSubscription.currentPeriodEnd,
        gracePeriodEndsAt: billingSubscription.gracePeriodEndsAt,
      }
    : preferences.subscription;
  const entitlements = resolveWorkspaceEntitlements({
    subscription,
  });
  const currentPlan = getWorkspacePlan(subscription.planId ?? "starter");
  const statusLabel = billingSubscription
    ? getBillingStatusLabel(billingSubscription.status)
    : getSubscriptionStatusLabel(preferences.subscription.status);
  const statusPresentation = getAccessPresentation(entitlements.accessReason);
  const nextRelevantDate =
    billingSubscription?.gracePeriodEndsAt ??
    billingSubscription?.currentPeriodEnd ??
    billingSubscription?.accessUntil ??
    preferences.subscription.checkoutStartedAt;
  const subscriptionManagementAction = billingSubscription
    ? resolveSubscriptionManagementAction(billingSubscription)
    : null;

  return (
    <div className="app-page space-y-6">
      <header className="app-header">
        <BackLink href="/app" label="Voltar para o início" />
        <p className="app-eyebrow">Assinatura</p>
        <h1 className="app-title">Status e faixa atual do workspace</h1>
        <p className="app-copy">
          Esta tela centraliza a situação da assinatura, o acesso liberado hoje,
          os limites vigentes do workspace e as ações comerciais disponíveis no
          estado atual.
        </p>
      </header>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_360px]">
        <article className="app-card p-6 sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-[var(--accent)]">
                Situação atual
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-[var(--foreground)]">
                {currentPlan.label}
              </h2>
              <p className="mt-3 max-w-2xl text-base leading-8 text-[var(--muted)]">
                {statusPresentation.description}
              </p>
            </div>
            <span className={statusPresentation.badgeClassName}>{statusLabel}</span>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-3">
            <SubscriptionStat
              label="Acesso ao produto"
              value={entitlements.canUseApp ? "Liberado" : "Bloqueado"}
            />
            <SubscriptionStat
              label="Histórico preservado"
              value={`Até ${entitlements.historyLimit}`}
            />
            <SubscriptionStat
              label="Equipe vigente"
              value={`${entitlements.seatsLimit} ${
                entitlements.seatsLimit === 1 ? "usuário" : "usuários"
              }`}
            />
          </div>
        </article>

        <aside className="app-card-soft p-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-[var(--muted)]">
            Leitura operacional
          </p>
          <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-[var(--foreground)]">
            O que fazer agora
          </h2>
          <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
            {statusPresentation.nextStep}
          </p>

          {subscriptionManagementAction ? (
            <div className="mt-5 rounded-[20px] border border-[var(--panel-border)] bg-[rgba(255,255,255,0.76)] px-4 py-4">
              <p className="text-sm font-medium text-[var(--foreground)]">
                {subscriptionManagementAction.title}
              </p>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                {subscriptionManagementAction.description}
              </p>
            </div>
          ) : null}

          <div className="mt-5 grid gap-3">
            {subscriptionManagementAction ? (
              <MercadoPagoSubscriptionManageButton
                action={subscriptionManagementAction.action}
                label={subscriptionManagementAction.label}
                className="app-button app-button-primary w-full"
              />
            ) : (
              <Link
                href={
                  entitlements.accessReason === "pending"
                    ? "/app/checkout"
                    : "/app/planos"
                }
                className="app-button app-button-primary w-full"
              >
                {entitlements.accessReason === "pending"
                  ? "Continuar pagamento"
                  : "Comparar planos"}
              </Link>
            )}
            <Link
              href={
                entitlements.accessReason === "pending"
                  ? "/app/checkout"
                  : "/app/planos"
              }
              className="app-button app-button-secondary w-full"
            >
              {entitlements.accessReason === "pending"
                ? "Revisar checkout"
                : "Comparar planos"}
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

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <article className="app-card p-6 sm:p-7">
          <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-[var(--accent)]">
            Detalhes da assinatura
          </p>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <SubscriptionDetail
              label="Plano comercial"
              value={currentPlan.label}
              note={`${currentPlan.monthlyPriceLabel}/mês`}
            />
            <SubscriptionDetail
              label="Ciclo"
              value={billingSubscription?.billingCycle === "annual" ? "Anual" : "Mensal"}
              note="A cobrança anual ainda não foi aberta no fluxo atual."
            />
            <SubscriptionDetail
              label="Motivo de acesso"
              value={getAccessReasonLabel(entitlements.accessReason)}
              note="Determina o que fica disponível depois do login."
            />
            <SubscriptionDetail
              label="Renovação automática"
              value={
                billingSubscription
                  ? billingSubscription.autoRenew
                    ? "Ativa"
                    : "Desligada"
                  : preferences.subscription.status === "pending"
                    ? "Aguardando confirmação"
                    : "Sem detalhe persistido"
              }
              note="A assinatura nova ainda está em transição do modelo legado."
            />
            <SubscriptionDetail
              label="Próxima data relevante"
              value={formatDateOrFallback(nextRelevantDate)}
              note={getDateNote(entitlements.accessReason)}
            />
            <SubscriptionDetail
              label="Origem dos dados"
              value={billingSubscription ? "Billing atual" : "Preferências legadas"}
              note={
                billingSubscription
                  ? "Lido da assinatura corrente do billing."
                  : "Usando o estado legado até a migração completa."
              }
            />
          </div>
        </article>

        <article className="app-card p-6 sm:p-7">
          <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-[var(--accent)]">
            Faixa liberada
          </p>
          <div className="mt-5 space-y-3">
            <EntitlementBullet
              label="Precificadora"
              value={entitlements.canUsePricing ? "Disponível" : "Bloqueada"}
            />
            <EntitlementBullet
              label="Exportação PDF"
              value={entitlements.canExportPdf ? "Disponível" : "Bloqueada"}
            />
            <EntitlementBullet
              label="Histórico"
              value={entitlements.canViewHistory ? "Disponível" : "Somente preservado"}
            />
            <EntitlementBullet
              label="Integrações"
              value={
                entitlements.canManageIntegrations
                  ? "Disponíveis dentro da faixa atual"
                  : "Dependem de acesso ativo"
              }
            />
            <EntitlementBullet
              label="Gestão de billing"
              value={entitlements.canManageBilling ? "Permitida" : "Indisponível"}
            />
          </div>
        </article>
      </section>
    </div>
  );
}

function SubscriptionStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[22px] border border-[var(--panel-border)] bg-[rgba(255,255,255,0.78)] px-4 py-4">
      <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[var(--muted)]">
        {label}
      </p>
      <p className="mt-3 text-xl font-semibold text-[var(--foreground)]">{value}</p>
    </div>
  );
}

function SubscriptionDetail({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className="rounded-[24px] border border-[var(--panel-border)] bg-[rgba(255,255,255,0.78)] p-5">
      <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[var(--muted)]">
        {label}
      </p>
      <p className="mt-3 text-lg font-semibold text-[var(--foreground)]">{value}</p>
      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{note}</p>
    </div>
  );
}

function EntitlementBullet({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-[20px] border border-[var(--panel-border)] bg-[rgba(255,255,255,0.78)] px-4 py-4">
      <p className="text-sm font-medium text-[var(--foreground)]">{label}</p>
      <p className="text-sm text-right text-[var(--muted)]">{value}</p>
    </div>
  );
}

function getBillingStatusLabel(status: string) {
  switch (status) {
    case "pending":
      return "Aguardando pagamento";
    case "active":
      return "Plano ativo";
    case "past_due":
      return "Em tolerância";
    case "scheduled_cancel":
      return "Cancelamento agendado";
    case "paused":
      return "Assinatura pausada";
    case "canceled":
      return "Assinatura cancelada";
    case "expired":
      return "Assinatura expirada";
    default:
      return "Status indisponível";
  }
}

function getAccessPresentation(accessReason: WorkspaceEntitlementAccessReason) {
  switch (accessReason) {
    case "active":
      return {
        description:
          "O workspace está com acesso liberado ao produto pago dentro da faixa atual.",
        nextStep:
          "Se a operação evoluiu, compare a faixa atual com os outros planos antes de solicitar mudança comercial.",
        badgeClassName:
          "rounded-full border border-[var(--accent)] bg-[var(--accent-soft)] px-4 py-2 text-xs font-semibold text-[var(--accent)]",
      };
    case "grace_period":
      return {
        description:
          "A assinatura está em período de tolerância. O acesso continua ativo até a data limite registrada no billing.",
        nextStep:
          "Priorize a regularização do pagamento para evitar suspensão automática do acesso.",
        badgeClassName:
          "rounded-full border border-amber-300 bg-amber-50 px-4 py-2 text-xs font-semibold text-amber-700",
      };
    case "scheduled_cancel":
      return {
        description:
          "A renovação foi desligada, mas o workspace continua com acesso até o fim do período atual.",
        nextStep:
          "Use esta leitura para acompanhar o encerramento e revisar se faz sentido manter a faixa ativa.",
        badgeClassName:
          "rounded-full border border-orange-300 bg-orange-50 px-4 py-2 text-xs font-semibold text-orange-700",
      };
    case "pending":
      return {
        description:
          "A contratação foi iniciada, mas ainda não foi confirmada. O produto pago continua bloqueado até a confirmação.",
        nextStep:
          "Volte para a comparação de planos para continuar o pagamento ou revisar a contratação pendente.",
        badgeClassName:
          "rounded-full border border-[var(--panel-border)] bg-[rgba(255,255,255,0.82)] px-4 py-2 text-xs font-semibold text-[var(--muted)]",
      };
    case "paused":
      return {
        description:
          "A assinatura está pausada, então o acesso ao produto pago fica bloqueado, mas os dados continuam preservados.",
        nextStep:
          "Use esta tela como referência do estado atual antes de retomar a assinatura ou contratar novamente.",
        badgeClassName:
          "rounded-full border border-[var(--panel-border)] bg-[rgba(255,255,255,0.82)] px-4 py-2 text-xs font-semibold text-[var(--muted)]",
      };
    case "expired":
      return {
        description:
          "O período de acesso terminou. O workspace permanece acessível para conta e billing, mas o produto pago fica bloqueado.",
        nextStep:
          "Compare as faixas disponíveis e decida se a retomada seguirá pelo autoatendimento ou pelo comercial.",
        badgeClassName:
          "rounded-full border border-[var(--panel-border)] bg-[rgba(255,255,255,0.82)] px-4 py-2 text-xs font-semibold text-[var(--muted)]",
      };
    case "canceled":
      return {
        description:
          "A assinatura foi encerrada. O workspace mantém conta, histórico e dados, mas o acesso pago não está liberado.",
        nextStep:
          "A partir daqui, a retomada deve começar pela escolha da nova contratação para o mesmo workspace.",
        badgeClassName:
          "rounded-full border border-[var(--panel-border)] bg-[rgba(255,255,255,0.82)] px-4 py-2 text-xs font-semibold text-[var(--muted)]",
      };
    case "no_subscription":
      return {
        description:
          "Ainda não existe uma assinatura ativa vinculada ao workspace. A conta existe, mas o produto pago segue bloqueado.",
        nextStep:
          "Use a comparação de planos para iniciar a contratação certa para a operação.",
        badgeClassName:
          "rounded-full border border-[var(--panel-border)] bg-[rgba(255,255,255,0.82)] px-4 py-2 text-xs font-semibold text-[var(--muted)]",
      };
  }
}

function getAccessReasonLabel(accessReason: WorkspaceEntitlementAccessReason) {
  switch (accessReason) {
    case "active":
      return "Acesso ativo";
    case "grace_period":
      return "Período de tolerância";
    case "scheduled_cancel":
      return "Cancelamento agendado";
    case "pending":
      return "Contratação pendente";
    case "paused":
      return "Assinatura pausada";
    case "expired":
      return "Período expirado";
    case "canceled":
      return "Assinatura cancelada";
    case "no_subscription":
      return "Sem assinatura corrente";
  }
}

function getDateNote(accessReason: WorkspaceEntitlementAccessReason) {
  switch (accessReason) {
    case "grace_period":
      return "Limite para manter o acesso antes da suspensão.";
    case "scheduled_cancel":
      return "Fim previsto do período já contratado.";
    case "pending":
      return "No legado, pode refletir o início do checkout pendente.";
    case "active":
      return "Usada para acompanhar renovação ou encerramento do período atual.";
    case "paused":
    case "expired":
    case "canceled":
    case "no_subscription":
      return "Pode ficar indisponível até a migração completa do billing.";
  }
}

function formatDateOrFallback(value: string | null | undefined) {
  if (!value) {
    return "Não disponível";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Não disponível";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "long",
  }).format(date);
}

function resolveSubscriptionManagementAction(
  subscription: BillingSubscription,
) {
  if (
    subscription.provider !== "mercado_pago" ||
    !subscription.providerSubscriptionId
  ) {
    return null;
  }

  switch (subscription.status) {
    case "active":
      return {
        action: "cancel" as const,
        label: "Cancelar renovação",
        title: "Desligar a próxima renovação",
        description:
          "O cancelamento não encerra o acesso imediatamente. O workspace permanece liberado até o fim do período atual.",
      };
    case "scheduled_cancel":
      return {
        action: "resume" as const,
        label: "Manter assinatura",
        title: "Reativar a renovação automática",
        description:
          "Enquanto o período atual não termina, você ainda pode desfazer o cancelamento agendado e manter a assinatura ativa.",
      };
    default:
      return null;
  }
}
