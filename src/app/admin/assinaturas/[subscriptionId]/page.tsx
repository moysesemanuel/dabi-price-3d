import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { BillingAdminSubscriptionActions } from "@/components/admin/billing-admin-subscription-actions";
import { BillingAdminCancellationAction } from "@/components/admin/billing-admin-cancellation-action";
import {
  AdminPageHeader,
  AdminPageSection,
  AuditEventsTable,
  EmptyAdminState,
  InvoicesTable,
  StatusBadge,
  formatDateOrFallback,
} from "@/components/admin/billing-admin-ui";
import { createBillingAdminService } from "@/lib/billing/server-admin-service";
import { requireCurrentAuthSession } from "@/lib/auth/session";
import { getWorkspacePlan } from "@/lib/settings/app-preferences";

export default async function BillingAdminSubscriptionDetailsPage({
  params,
}: {
  params: Promise<{ subscriptionId: string }>;
}) {
  const { subscriptionId } = await params;
  const session = await requireCurrentAuthSession();
  const details = await createBillingAdminService().getSubscriptionDetails({
    session,
    subscriptionId,
  });

  if (!details) {
    notFound();
  }

  const { subscription } = details;
  const plan = getWorkspacePlan(subscription.planId);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Detalhe da assinatura"
        title={`${subscription.workspaceName} · ${plan.label}`}
        description="Leitura completa do contrato local, período comercial, invoices associadas e trilha de auditoria gerada pelas operações do billing."
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(340px,0.85fr)]">
        <AdminPageSection
          title="Contrato local"
          description="Fonte operacional do billing que alimenta entitlement, cobrança e reconciliação."
        >
          <div className="grid gap-3 md:grid-cols-2">
            <DetailStat label="Workspace" value={subscription.workspaceName} />
            <DetailStat label="Owner" value={subscription.ownerEmail ?? "—"} />
            <DetailStat label="Plano" value={plan.label} />
            <DetailStat
              label="Ciclo"
              value={subscription.billingCycle === "annual" ? "Anual" : "Mensal"}
            />
            <DetailStat
              label="Status"
              value={<StatusBadge status={subscription.status} />}
            />
            <DetailStat
              label="Renovação automática"
              value={subscription.autoRenew ? "Ligada" : "Desligada"}
            />
            <DetailStat
              label="Período atual"
              value={`${formatDateOrFallback(subscription.currentPeriodStart)} até ${formatDateOrFallback(subscription.currentPeriodEnd)}`}
            />
            <DetailStat
              label="Tolerância"
              value={formatDateOrFallback(subscription.gracePeriodEndsAt)}
            />
            <DetailStat
              label="accessUntil"
              value={formatDateOrFallback(subscription.accessUntil)}
            />
            <DetailStat
              label="Provider"
              value={subscription.provider ?? "Sem provider"}
            />
            <DetailStat
              label="Provider subscription id"
              value={subscription.providerSubscriptionId ?? "Sem id"}
            />
            <DetailStat
              label="Criada em"
              value={formatDateOrFallback(subscription.createdAt)}
            />
          </div>
        </AdminPageSection>

      <BillingAdminSubscriptionActions
          subscriptionId={subscription.subscriptionId}
          currentAccessUntil={subscription.accessUntil}
      />
      {subscription.status === "active" ? (
        <BillingAdminCancellationAction subscriptionId={subscription.subscriptionId} />
      ) : null}
      </div>

      <AdminPageSection
        title="Invoices da assinatura"
        description="Cobranças já emitidas, com status, tipo e método de pagamento associado."
      >
        {details.invoices.length > 0 ? (
          <InvoicesTable invoices={details.invoices} />
        ) : (
          <EmptyAdminState message="Essa assinatura ainda não possui invoices associadas." />
        )}
      </AdminPageSection>

      <AdminPageSection
        title="Timeline de auditoria"
        description="Toda intervenção administrativa e transição de billing relevante deve aparecer aqui."
      >
        {details.timeline.length > 0 ? (
          <AuditEventsTable auditEvents={details.timeline} />
        ) : (
          <EmptyAdminState message="Ainda não existe trilha de auditoria para esta assinatura." />
        )}
      </AdminPageSection>
    </div>
  );
}

function DetailStat({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="rounded-[20px] border border-[var(--panel-border)] bg-[rgba(255,255,255,0.8)] p-4">
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--muted)]">
        {label}
      </p>
      <div className="mt-3 text-sm leading-7 text-[var(--foreground)]">{value}</div>
    </div>
  );
}
