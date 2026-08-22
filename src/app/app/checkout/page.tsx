import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { BackLink } from "@/components/app/back-link";
import { MercadoPagoCheckoutButton } from "@/components/payments/mercado-pago-checkout-button";
import { ManualPixCheckoutButton } from "@/components/payments/manual-pix-checkout-button";
import { getCurrentAuthSession } from "@/lib/auth/session";
import { getBillingProvider } from "@/lib/billing/providers";
import {
  findCurrentBillingSubscriptionForWorkspace,
  findLatestPendingBillingInvoiceForSubscription,
} from "@/lib/billing/repository";
import { normalizeBillingManualPaymentState } from "@/lib/billing/manual-payment-status";
import {
  getWorkspacePreferences,
  isPlatformPersistenceAvailable,
} from "@/lib/server/platform";
import {
  defaultAppPreferences,
  getWorkspaceBillingCycleLabel,
  getWorkspacePlan,
  resolveWorkspacePlanPriceLabel,
} from "@/lib/settings/app-preferences";

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams?: Promise<{
    origin?: string;
    plan?: string;
    billingCycle?: string;
  }>;
}) {
  const params = (await searchParams) ?? {};
  const selectedBillingCycle =
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

  const pendingSubscription =
    billingSubscription?.status === "pending"
      ? {
          planId: billingSubscription.planId,
          billingCycle: billingSubscription.billingCycle,
          provider: billingSubscription.provider,
          startedAt:
            billingSubscription.createdAt ??
            preferences.subscription.checkoutStartedAt,
        }
      : null;
  const pendingInvoice =
    session &&
    billingSubscription?.status === "pending" &&
    isPlatformPersistenceAvailable()
      ? await findLatestPendingBillingInvoiceForSubscription({
        subscriptionId: billingSubscription.id,
        paymentMethod: "pix_manual",
      }).catch(() => null)
      : null;
  const pendingPixPayment =
    pendingInvoice?.providerPaymentId &&
      pendingInvoice.paymentMethod === "pix_manual"
      ? await getBillingProvider("mercado_pago")
        .getManualPayment(pendingInvoice.providerPaymentId)
        .catch(() => null)
      : null;
  const pendingPixPaymentState = normalizeBillingManualPaymentState(
    pendingPixPayment?.status,
  );
  const canResumeCheckout =
    pendingSubscription &&
    (pendingSubscription.planId === "starter" ||
      pendingSubscription.planId === "growth");
  const checkoutPlanId =
    pendingSubscription?.planId === "starter" ||
    pendingSubscription?.planId === "growth"
      ? pendingSubscription.planId
      : null;
  const highlightedPlanId =
    params.plan === "starter" ||
    params.plan === "growth" ||
    params.plan === "scale"
      ? params.plan
      : null;
  const highlightedPlan = highlightedPlanId
    ? getWorkspacePlan(highlightedPlanId)
    : null;
  const displayPlan = getWorkspacePlan(
    pendingSubscription?.planId ??
      highlightedPlanId ??
      defaultAppPreferences.subscription.planId,
  );
  const displayBillingCycle =
    pendingSubscription?.billingCycle ??
    (highlightedPlan
      ? selectedBillingCycle
      : defaultAppPreferences.subscription.billingCycle);

  return (
    <div className="app-page space-y-6">
      <header className="app-header">
        <BackLink href="/app/planos" label="Voltar para os planos" />
        <p className="app-eyebrow">Checkout</p>
        <h1 className="app-title">Concluir contratação pendente</h1>
        <p className="app-copy">
          Esta etapa concentra a retomada do pagamento antes da ativação do
          workspace. Se você trocar de plano agora, a pendência anterior é
          encerrada e um novo checkout é aberto.
        </p>
      </header>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_360px]">
        <article className="app-card p-6 sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-[var(--accent)]">
                {pendingSubscription
                  ? "Contratação em andamento"
                  : "Sem pendência aberta"}
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-[var(--foreground)]">
                {pendingSubscription
                  ? "Sua contratação ainda não foi concluída."
                  : "Nenhum checkout pendente no momento."}
              </h2>
              <p className="mt-3 max-w-2xl text-base leading-8 text-[var(--muted)]">
                {pendingSubscription
                  ? params.origin === "mercado-pago"
                    ? "Você voltou do Mercado Pago sem finalizar a cobrança. Retome o pagamento abaixo ou altere o plano antes do primeiro pagamento."
                    : "O workspace já possui uma contratação pendente. Continue o pagamento para ativar o acesso ou volte para alterar o plano."
                  : highlightedPlan
                    ? `O plano ${highlightedPlan.label} foi destacado, mas ainda não existe uma contratação pendente vinculada ao workspace.`
                    : "Use a comparação de planos para iniciar uma nova contratação quando fizer sentido para a operação."}
              </p>
            </div>
            <span className="rounded-full border border-[var(--accent)] bg-[var(--accent-soft)] px-4 py-2 text-xs font-semibold text-[var(--accent)]">
              {pendingSubscription ? "Aguardando pagamento" : "Disponível para contratar"}
            </span>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-3">
            <CheckoutStat
              label="Plano"
              value={pendingSubscription ? displayPlan.label : "Sem contratação"}
            />
            <CheckoutStat
              label="Ciclo"
              value={
                pendingSubscription
                  ? getWorkspaceBillingCycleLabel(displayBillingCycle)
                  : highlightedPlan
                    ? getWorkspaceBillingCycleLabel(displayBillingCycle)
                    : "A definir"
              }
            />
            <CheckoutStat
              label="Início da pendência"
              value={formatDateOrFallback(pendingSubscription?.startedAt ?? null)}
            />
          </div>
        </article>

        <aside className="app-card-soft p-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-[var(--muted)]">
            Próxima ação
          </p>
          <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-[var(--foreground)]">
            {pendingSubscription ? "Retomar ou revisar" : "Escolher um plano"}
          </h2>
          <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
            {pendingSubscription
              ? "Continuar pagamento reaproveita a contratação pendente do mesmo plano. Você também pode trocar para Pix manual antes do primeiro pagamento, o que encerra a pendência atual e abre uma nova cobrança."
              : "Sem pendência aberta, o próximo passo é voltar para a comparação de planos e iniciar uma contratação nova."}
          </p>

          <div className="mt-5 grid gap-3">
            {pendingSubscription && canResumeCheckout && checkoutPlanId ? (
              <>
                <MercadoPagoCheckoutButton
                  planId={checkoutPlanId}
                  billingCycle={pendingSubscription.billingCycle}
                  label="Continuar pagamento"
                  className="app-button app-button-primary w-full"
                />
                <ManualPixCheckoutButton
                  planId={checkoutPlanId}
                  billingCycle={pendingSubscription.billingCycle}
                  label="Gerar Pix manual"
                  className="app-button app-button-secondary w-full"
                />
              </>
            ) : (
              <Link href="/app/planos" className="app-button app-button-primary w-full">
                Comparar planos
              </Link>
            )}
            <Link
              href="/app/planos"
              className="app-button app-button-secondary w-full"
            >
              Alterar plano
            </Link>
          </div>
        </aside>
      </section>

      {pendingInvoice && pendingPixPayment ? (
        <section className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
          <article className="app-card p-6 sm:p-7">
            <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-[var(--accent)]">
              Pix manual
            </p>
            <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-[var(--foreground)]">
              {pendingPixPaymentState === "paid"
                ? "Pagamento aprovado"
                : "QR Code disponível para pagamento"}
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--muted)]">
              {pendingPixPaymentState === "paid"
                ? "O Pix já foi aprovado pelo provider. O webhook deve ativar a assinatura e liberar o acesso em seguida."
                : "Use o QR Code abaixo ou copie o código Pix. Enquanto o pagamento estiver pendente, o workspace continua bloqueado para uso pago."}
            </p>

            {pendingPixPayment.qrCodeBase64 ? (
              <div className="mt-6 flex justify-center rounded-[28px] border border-[var(--panel-border)] bg-[rgba(255,255,255,0.82)] p-6">
                <Image
                  src={`data:image/png;base64,${pendingPixPayment.qrCodeBase64}`}
                  alt="QR Code Pix da assinatura"
                  className="size-64 max-w-full rounded-[20px]"
                  width={256}
                  height={256}
                />
              </div>
            ) : null}

            {pendingPixPayment.qrCode ? (
              <div className="mt-5 rounded-[24px] border border-[var(--panel-border)] bg-[rgba(255,255,255,0.78)] p-5">
                <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[var(--muted)]">
                  Copia e cola Pix
                </p>
                <p className="mt-3 break-all text-sm leading-7 text-[var(--foreground)]">
                  {pendingPixPayment.qrCode}
                </p>
              </div>
            ) : null}
          </article>

          <article className="app-card p-6 sm:p-7">
            <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-[var(--accent)]">
              Status operacional
            </p>
            <div className="mt-5 space-y-3">
              <CheckoutBullet>
                Status atual do pagamento: {getPixStatusLabel(pendingPixPaymentState)}
              </CheckoutBullet>
              <CheckoutBullet>
                Expiração informada pelo provider: {formatDateOrFallback(
                  pendingPixPayment.expiresAt ?? pendingInvoice.paymentExpiresAt,
                )}
              </CheckoutBullet>
              <CheckoutBullet>
                Se precisar trocar de plano antes do pagamento, volte para os planos e
                gere um novo checkout manual.
              </CheckoutBullet>
            </div>
          </article>
        </section>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <article className="app-card p-6 sm:p-7">
          <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-[var(--accent)]">
            Leitura operacional
          </p>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <CheckoutDetail
              label="Faixa comercial"
              value={displayPlan.label}
              note={displayPlan.description}
            />
            <CheckoutDetail
              label="Valor atual"
              value={formatCheckoutPriceDisplay(displayPlan, displayBillingCycle)}
              note={
                displayPlan.id === "scale"
                  ? "Plano consultivo com ativação comercial."
                  : displayBillingCycle === "annual"
                    ? "Pagamento antecipado com 12 meses de acesso liberado após a confirmação."
                    : "Cobrança recorrente mensal após a confirmação do primeiro pagamento."
              }
            />
            <CheckoutDetail
              label="Origem do estado"
              value={
                pendingSubscription ? "Billing atual" : "Sem checkout atual"
              }
              note={
                pendingSubscription
                  ? "A pendência já está registrada na assinatura corrente do billing."
                  : "Nenhuma contratação foi iniciada para este workspace."
              }
            />
            <CheckoutDetail
              label="Provider"
              value={pendingSubscription ? "Mercado Pago" : "A definir"}
              note="A cobrança recorrente continua passando pelo provider atual nesta fase."
            />
          </div>
        </article>

        <article className="app-card p-6 sm:p-7">
          <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-[var(--accent)]">
            O que acontece se abandonar
          </p>
          <div className="mt-5 space-y-3">
            <CheckoutBullet>
              Abandonar o checkout não exclui a conta nem o workspace.
            </CheckoutBullet>
            <CheckoutBullet>
              O acesso ao produto pago continua bloqueado enquanto o status
              permanecer pendente.
            </CheckoutBullet>
            <CheckoutBullet>
              Você pode voltar depois para retomar o pagamento ou trocar o plano
              antes do primeiro pagamento.
            </CheckoutBullet>
          </div>
        </article>
      </section>
    </div>
  );
}

function CheckoutStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[22px] border border-[var(--panel-border)] bg-[rgba(255,255,255,0.78)] px-4 py-4">
      <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[var(--muted)]">
        {label}
      </p>
      <p className="mt-3 text-xl font-semibold text-[var(--foreground)]">{value}</p>
    </div>
  );
}

function CheckoutDetail({
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

function CheckoutBullet({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-[20px] border border-[var(--panel-border)] bg-[rgba(255,255,255,0.78)] px-4 py-4">
      <span className="mt-1 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-[var(--accent)]/14 text-[11px] font-semibold text-[var(--accent)]">
        ✓
      </span>
      <p className="text-sm leading-7 text-[var(--foreground)]">{children}</p>
    </div>
  );
}

function formatDateOrFallback(value: string | null) {
  if (!value) {
    return "Ainda não registrada";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Data indisponível";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function getPixStatusLabel(
  status: ReturnType<typeof normalizeBillingManualPaymentState>,
) {
  switch (status) {
    case "paid":
      return "Pago";
    case "pending":
      return "Aguardando pagamento";
    case "failed":
      return "Falhou";
    case "expired":
      return "Expirado";
    case "canceled":
      return "Cancelado";
    case "unknown":
    default:
      return "Indefinido";
  }
}

function formatCheckoutPriceDisplay(
  plan: ReturnType<typeof getWorkspacePlan>,
  billingCycle: "monthly" | "annual",
) {
  const priceLabel = resolveWorkspacePlanPriceLabel(plan, billingCycle);

  if (plan.id === "scale") {
    return priceLabel;
  }

  return billingCycle === "annual" ? priceLabel : `${priceLabel}/mês`;
}
