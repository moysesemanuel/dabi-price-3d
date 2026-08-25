import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { BackLink } from "@/components/app/back-link";
import { getCurrentAuthSession } from "@/lib/auth/session";
import { normalizeBillingManualPaymentState } from "@/lib/billing/manual-payment-status";
import { getBillingProvider } from "@/lib/billing/providers";
import {
  findCurrentBillingSubscriptionForWorkspace,
  findLatestOpenBillingSubscriptionChange,
  getBillingInvoiceById,
} from "@/lib/billing/repository";
import { isPlatformPersistenceAvailable } from "@/lib/server/platform";
import { getWorkspacePlan } from "@/lib/settings/app-preferences";

export default async function SubscriptionUpgradePage() {
  const session = await getCurrentAuthSession();
  const billingSubscription =
    session && isPlatformPersistenceAvailable()
      ? await findCurrentBillingSubscriptionForWorkspace(session.workspace.id).catch(
          () => null,
        )
      : null;
  const pendingUpgrade =
    billingSubscription && isPlatformPersistenceAvailable()
      ? await findLatestOpenBillingSubscriptionChange({
          subscriptionId: billingSubscription.id,
          type: "upgrade",
        }).catch(() => null)
      : null;
  const upgradeInvoice =
    pendingUpgrade?.invoiceId && isPlatformPersistenceAvailable()
      ? await getBillingInvoiceById(pendingUpgrade.invoiceId).catch(() => null)
      : null;
  const manualPayment =
    upgradeInvoice?.providerPaymentId && upgradeInvoice.paymentMethod === "pix_manual"
      ? await getBillingProvider("mercado_pago")
          .getManualPayment(upgradeInvoice.providerPaymentId)
          .catch(() => null)
      : null;
  const manualPaymentState = normalizeBillingManualPaymentState(manualPayment?.status);
  const currentPlan = getWorkspacePlan(billingSubscription?.planId ?? "starter");
  const targetPlan =
    pendingUpgrade?.toPlanId ? getWorkspacePlan(pendingUpgrade.toPlanId) : null;

  return (
    <div className="app-page space-y-6">
      <header className="app-header">
        <BackLink href="/app/assinatura" label="Voltar para a assinatura" />
        <p className="app-eyebrow">Upgrade</p>
        <h1 className="app-title">Acompanhar pagamento do upgrade</h1>
        <p className="app-copy">
          O upgrade só entra em vigor depois da confirmação do pagamento. Até lá,
          a assinatura atual permanece inalterada e o histórico do workspace segue
          preservado.
        </p>
      </header>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_360px]">
        <article className="app-card p-6 sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-[var(--accent)]">
                {pendingUpgrade && upgradeInvoice
                  ? "Upgrade em andamento"
                  : "Nenhum upgrade pendente"}
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-[var(--foreground)]">
                {targetPlan
                  ? `${currentPlan.label} -> ${targetPlan.label}`
                  : "Sem solicitação aberta no momento."}
              </h2>
              <p className="mt-3 max-w-2xl text-base leading-8 text-[var(--muted)]">
                {targetPlan && upgradeInvoice
                  ? manualPaymentState === "paid"
                    ? "O pagamento do upgrade já foi aprovado. O billing deve aplicar a nova faixa assim que o webhook ou a reconciliação concluírem o processamento."
                    : "Use o QR Code abaixo ou o copia e cola Pix para confirmar o upgrade. Se o pagamento falhar ou expirar, o plano atual continua ativo sem alteração."
                  : "Volte para os planos para iniciar um novo upgrade quando fizer sentido para a operação."}
              </p>
            </div>
            <span className="rounded-full border border-[var(--accent)] bg-[var(--accent-soft)] px-4 py-2 text-xs font-semibold text-[var(--accent)]">
              {getUpgradeStatusLabel(manualPaymentState)}
            </span>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-3">
            <UpgradeStat label="Plano atual" value={currentPlan.label} />
            <UpgradeStat
              label="Plano de destino"
              value={targetPlan?.label ?? "Não definido"}
            />
            <UpgradeStat
              label="Valor do upgrade"
              value={
                upgradeInvoice ? formatCurrency(upgradeInvoice.amountCents) : "Não definido"
              }
            />
          </div>

          {pendingUpgrade ? (
            <div className="mt-6 grid gap-3 md:grid-cols-2">
              <UpgradeDetail
                label="Crédito proporcional"
                value={formatCurrency(pendingUpgrade.creditAmountCents)}
                note="Valor do período atual ainda não consumido."
              />
              <UpgradeDetail
                label="Nova cobrança proporcional"
                value={formatCurrency(pendingUpgrade.chargeAmountCents)}
                note="Cobrança do plano de destino até o fim do ciclo atual."
              />
            </div>
          ) : null}
        </article>

        <aside className="app-card-soft p-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-[var(--muted)]">
            Próxima ação
          </p>
          <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-[var(--foreground)]">
            {targetPlan ? "Concluir o pagamento" : "Voltar para os planos"}
          </h2>
          <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
            {targetPlan
              ? manualPaymentState === "paid"
                ? "O pagamento já foi recebido. Se a tela não atualizar sozinha, recarregue em instantes para ver a nova faixa refletida."
                : "Enquanto o Pix permanecer pendente, a assinatura atual não muda. O upgrade só é aplicado depois da confirmação."
              : "Sem solicitação aberta, o próximo passo é comparar os planos disponíveis e iniciar um novo upgrade."}
          </p>

          <div className="mt-5 grid gap-3">
            <Link
              href={targetPlan ? "/app/planos" : "/app/assinatura"}
              className="app-button app-button-primary w-full"
            >
              {targetPlan ? "Voltar para os planos" : "Voltar para a assinatura"}
            </Link>
            <Link
              href="/app/assinatura"
              className="app-button app-button-secondary w-full"
            >
              Ver status da assinatura
            </Link>
          </div>
        </aside>
      </section>

      {upgradeInvoice && manualPayment ? (
        <section className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
          <article className="app-card p-6 sm:p-7">
            <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-[var(--accent)]">
              Pix manual
            </p>
            <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-[var(--foreground)]">
              {manualPaymentState === "paid"
                ? "Pagamento aprovado"
                : "QR Code disponível para o upgrade"}
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--muted)]">
              {manualPaymentState === "paid"
                ? "A cobrança do upgrade foi confirmada. A troca de plano deve ser aplicada em seguida."
                : "Faça o pagamento deste Pix para liberar o upgrade imediatamente após a confirmação."}
            </p>

            {manualPayment.qrCodeBase64 ? (
              <div className="mt-6 flex justify-center rounded-[28px] border border-[var(--panel-border)] bg-[rgba(255,255,255,0.82)] p-6">
                <Image
                  src={`data:image/png;base64,${manualPayment.qrCodeBase64}`}
                  alt="QR Code Pix do upgrade"
                  className="size-64 max-w-full rounded-[20px]"
                  width={256}
                  height={256}
                />
              </div>
            ) : null}

            {manualPayment.qrCode ? (
              <div className="mt-5 rounded-[24px] border border-[var(--panel-border)] bg-[rgba(255,255,255,0.78)] p-5">
                <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[var(--muted)]">
                  Copia e cola Pix
                </p>
                <p className="mt-3 break-all text-sm leading-7 text-[var(--foreground)]">
                  {manualPayment.qrCode}
                </p>
              </div>
            ) : null}
          </article>

          <article className="app-card p-6 sm:p-7">
            <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-[var(--accent)]">
              Status operacional
            </p>
            <div className="mt-5 space-y-3">
              <UpgradeBullet>
                Status atual do pagamento: {getUpgradeStatusLabel(manualPaymentState)}
              </UpgradeBullet>
              <UpgradeBullet>
                Expiração informada pelo provider:{" "}
                {formatDateOrFallback(
                  manualPayment.expiresAt ?? upgradeInvoice.paymentExpiresAt,
                )}
              </UpgradeBullet>
              <UpgradeBullet>
                Invoice local: {upgradeInvoice.id}
              </UpgradeBullet>
              <UpgradeBullet>
                Mudança prevista: {currentPlan.label} para{" "}
                {targetPlan?.label ?? "plano definido no billing"}
              </UpgradeBullet>
            </div>
          </article>
        </section>
      ) : null}
    </div>
  );
}

function UpgradeStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[22px] border border-[var(--panel-border)] bg-[rgba(255,255,255,0.78)] px-4 py-4">
      <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[var(--muted)]">
        {label}
      </p>
      <p className="mt-3 text-lg font-semibold text-[var(--foreground)]">{value}</p>
    </div>
  );
}

function UpgradeDetail({
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

function UpgradeBullet({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-[22px] border border-[var(--panel-border)] bg-[rgba(255,255,255,0.78)] px-4 py-4 text-sm leading-7 text-[var(--foreground)]">
      {children}
    </div>
  );
}

function getUpgradeStatusLabel(
  paymentState: ReturnType<typeof normalizeBillingManualPaymentState>,
) {
  switch (paymentState) {
    case "paid":
      return "Pagamento aprovado";
    case "pending":
      return "Aguardando pagamento";
    case "failed":
      return "Pagamento falhou";
    case "expired":
      return "Pix expirado";
    case "canceled":
      return "Cobrança cancelada";
    default:
      return "Sem upgrade pendente";
  }
}

function formatCurrency(amountCents: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(amountCents / 100);
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
    timeStyle: "short",
  }).format(date);
}
