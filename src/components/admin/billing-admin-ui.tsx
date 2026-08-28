import Link from "next/link";
import type { ReactNode } from "react";
import { BackLink } from "@/components/app/back-link";
import { getWorkspacePlan } from "@/lib/settings/app-preferences";
import type {
  BillingAdminAuditEventRecord,
  BillingAdminInvoiceRecord,
  BillingAdminSubscriptionRecord,
  BillingAdminSummary,
  BillingAdminWorkspaceRecord,
} from "@/lib/billing/admin-service";
import type { BillingWebhookEvent } from "@/lib/billing/types";
import type { BillingReconciliationFinding } from "@/lib/billing/reconciliation-service";

export function AdminPageHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <header className="space-y-4">
      <BackLink href="/app" label="Voltar para a aplicacao" />
      <div className="space-y-3">
        <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-[var(--accent)]">
          {eyebrow}
        </p>
        <h1 className="text-4xl font-semibold tracking-[-0.05em] text-[var(--foreground)]">
          {title}
        </h1>
        <p className="max-w-3xl text-base leading-8 text-[var(--muted)]">
          {description}
        </p>
      </div>
    </header>
  );
}

export function AdminPageSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="app-card space-y-5 p-6 sm:p-7">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-[-0.04em] text-[var(--foreground)]">
          {title}
        </h2>
        <p className="text-sm leading-7 text-[var(--muted)]">{description}</p>
      </div>
      {children}
    </section>
  );
}

export function SummaryGrid({ summary }: { summary: BillingAdminSummary }) {
  const cards = [
    {
      label: "MRR",
      value: formatMoney(summary.mrrCents),
      note: `${summary.activeSubscriptions} assinaturas ativas`,
    },
    {
      label: "ARR",
      value: formatMoney(summary.arrCents),
      note: `${summary.annualSubscriptions} contratos anuais`,
    },
    {
      label: "Receita total",
      value: formatMoney(summary.totalRevenueCents),
      note: `${summary.pendingPayments} pagamentos pendentes`,
    },
    {
      label: "Churn 30d",
      value:
        summary.churnRatePercent === null
          ? "Sem base"
          : `${summary.churnRatePercent.toFixed(2)}%`,
      note: `${summary.cancellationsLast30Days} cancelamentos`,
    },
    {
      label: "Webhooks com erro",
      value: String(summary.failedWebhooks),
      note: `${summary.reconciliationBacklog} itens no backlog`,
    },
    {
      label: "Past due / paused",
      value: `${summary.pastDueSubscriptions} / ${summary.pausedSubscriptions}`,
      note: `${summary.scheduledCancelSubscriptions} cancelamentos agendados`,
    },
  ];

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {cards.map((card) => (
        <article
          key={card.label}
          className="rounded-[24px] border border-[var(--panel-border)] bg-[rgba(255,255,255,0.8)] p-5"
        >
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[var(--muted)]">
            {card.label}
          </p>
          <p className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-[var(--foreground)]">
            {card.value}
          </p>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{card.note}</p>
        </article>
      ))}
    </div>
  );
}

export function WorkspacesTable({
  workspaces,
}: {
  workspaces: BillingAdminWorkspaceRecord[];
}) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead className="text-[11px] uppercase tracking-[0.22em] text-[var(--muted)]">
          <tr>
            <th className="px-3 py-3 font-medium">Workspace</th>
            <th className="px-3 py-3 font-medium">Owner</th>
            <th className="px-3 py-3 font-medium">Assinatura</th>
            <th className="px-3 py-3 font-medium">Acesso</th>
            <th className="px-3 py-3 font-medium">Historico</th>
          </tr>
        </thead>
        <tbody>
          {workspaces.map((workspace) => (
            <tr key={workspace.workspaceId} className="border-t border-[var(--panel-border)]">
              <td className="px-3 py-4 align-top">
                <div className="space-y-1">
                  <p className="font-semibold text-[var(--foreground)]">
                    {workspace.workspaceName}
                  </p>
                  <p className="text-xs text-[var(--muted)]">{workspace.workspaceSlug}</p>
                  <Link
                    href={`/admin/workspaces/${workspace.workspaceId}`}
                    className="text-xs font-medium text-[var(--accent)] hover:text-[var(--foreground)]"
                  >
                    Abrir detalhe
                  </Link>
                </div>
              </td>
              <td className="px-3 py-4 align-top text-[var(--muted)]">
                <div className="space-y-1">
                  <p>{workspace.ownerFullName ?? "Sem nome"}</p>
                  <p className="text-xs">{workspace.ownerEmail ?? "Sem e-mail"}</p>
                </div>
              </td>
              <td className="px-3 py-4 align-top">
                {workspace.currentSubscriptionId ? (
                  <div className="space-y-2">
                    <StatusBadge status={workspace.currentStatus ?? "pending"} />
                    <p className="text-xs text-[var(--muted)]">
                      {workspace.currentPlanId
                        ? getWorkspacePlan(workspace.currentPlanId).label
                        : "Sem plano"}{" "}
                      · {workspace.currentBillingCycle === "annual" ? "Anual" : "Mensal"}
                    </p>
                    <Link
                      href={`/admin/assinaturas/${workspace.currentSubscriptionId}`}
                      className="text-xs font-medium text-[var(--accent)] hover:text-[var(--foreground)]"
                    >
                      Ver assinatura
                    </Link>
                  </div>
                ) : (
                  <span className="text-sm text-[var(--muted)]">Sem assinatura corrente</span>
                )}
              </td>
              <td className="px-3 py-4 align-top text-[var(--muted)]">
                {formatDateOrFallback(workspace.accessUntil ?? workspace.currentPeriodEnd)}
              </td>
              <td className="px-3 py-4 align-top text-[var(--muted)]">
                {workspace.calculationsCount} calculos
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SubscriptionsTable({
  subscriptions,
}: {
  subscriptions: BillingAdminSubscriptionRecord[];
}) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead className="text-[11px] uppercase tracking-[0.22em] text-[var(--muted)]">
          <tr>
            <th className="px-3 py-3 font-medium">Workspace</th>
            <th className="px-3 py-3 font-medium">Plano</th>
            <th className="px-3 py-3 font-medium">Status</th>
            <th className="px-3 py-3 font-medium">Periodo</th>
            <th className="px-3 py-3 font-medium">Provider</th>
          </tr>
        </thead>
        <tbody>
          {subscriptions.map((subscription) => (
            <tr
              key={subscription.subscriptionId}
              className="border-t border-[var(--panel-border)]"
            >
              <td className="px-3 py-4 align-top">
                <div className="space-y-1">
                  <Link
                    href={`/admin/assinaturas/${subscription.subscriptionId}`}
                    className="font-semibold text-[var(--foreground)] hover:text-[var(--accent)]"
                  >
                    {subscription.workspaceName}
                  </Link>
                  <p className="text-xs text-[var(--muted)]">{subscription.ownerEmail}</p>
                </div>
              </td>
              <td className="px-3 py-4 align-top text-[var(--muted)]">
                <div className="space-y-1">
                  <p>{getWorkspacePlan(subscription.planId).label}</p>
                  <p className="text-xs">
                    {subscription.billingCycle === "annual" ? "Anual" : "Mensal"}
                  </p>
                </div>
              </td>
              <td className="px-3 py-4 align-top">
                <StatusBadge status={subscription.status} />
              </td>
              <td className="px-3 py-4 align-top text-[var(--muted)]">
                <div className="space-y-1">
                  <p>
                    {formatDateOrFallback(subscription.currentPeriodStart)} até{" "}
                    {formatDateOrFallback(subscription.currentPeriodEnd)}
                  </p>
                  <p className="text-xs">
                    accessUntil: {formatDateOrFallback(subscription.accessUntil)}
                  </p>
                </div>
              </td>
              <td className="px-3 py-4 align-top text-[var(--muted)]">
                <div className="space-y-1">
                  <p>{subscription.provider ?? "Sem provider"}</p>
                  <p className="text-xs">{subscription.providerSubscriptionId ?? "Sem id"}</p>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function InvoicesTable({ invoices }: { invoices: BillingAdminInvoiceRecord[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead className="text-[11px] uppercase tracking-[0.22em] text-[var(--muted)]">
          <tr>
            <th className="px-3 py-3 font-medium">Workspace</th>
            <th className="px-3 py-3 font-medium">Invoice</th>
            <th className="px-3 py-3 font-medium">Tipo</th>
            <th className="px-3 py-3 font-medium">Status</th>
            <th className="px-3 py-3 font-medium">Valor</th>
            <th className="px-3 py-3 font-medium">Metodo</th>
          </tr>
        </thead>
        <tbody>
          {invoices.map((invoice) => (
            <tr key={invoice.invoiceId} className="border-t border-[var(--panel-border)]">
              <td className="px-3 py-4 align-top">
                <div className="space-y-1">
                  <p className="font-semibold text-[var(--foreground)]">
                    {invoice.workspaceName}
                  </p>
                  <p className="text-xs text-[var(--muted)]">{invoice.subscriptionId}</p>
                </div>
              </td>
              <td className="px-3 py-4 align-top text-[var(--muted)]">
                <div className="space-y-1">
                  <p>{invoice.invoiceId}</p>
                  <p className="text-xs">{formatDateOrFallback(invoice.createdAt)}</p>
                </div>
              </td>
              <td className="px-3 py-4 align-top text-[var(--muted)]">{invoice.type}</td>
              <td className="px-3 py-4 align-top">
                <InvoiceStatusBadge status={invoice.status} />
              </td>
              <td className="px-3 py-4 align-top text-[var(--muted)]">
                {formatMoney(invoice.amountCents)}
              </td>
              <td className="px-3 py-4 align-top text-[var(--muted)]">
                {formatPaymentMethod(invoice.paymentMethod)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function WebhookEventsTable({
  webhookEvents,
}: {
  webhookEvents: BillingWebhookEvent[];
}) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead className="text-[11px] uppercase tracking-[0.22em] text-[var(--muted)]">
          <tr>
            <th className="px-3 py-3 font-medium">Evento</th>
            <th className="px-3 py-3 font-medium">Status</th>
            <th className="px-3 py-3 font-medium">Provider</th>
            <th className="px-3 py-3 font-medium">Recebido</th>
            <th className="px-3 py-3 font-medium">Erro</th>
          </tr>
        </thead>
        <tbody>
          {webhookEvents.map((event) => (
            <tr key={event.id} className="border-t border-[var(--panel-border)]">
              <td className="px-3 py-4 align-top">
                <div className="space-y-1">
                  <p className="font-semibold text-[var(--foreground)]">{event.eventType}</p>
                  <p className="text-xs text-[var(--muted)]">{event.providerEventId}</p>
                </div>
              </td>
              <td className="px-3 py-4 align-top">
                <WebhookStatusBadge status={event.status} />
              </td>
              <td className="px-3 py-4 align-top text-[var(--muted)]">{event.provider}</td>
              <td className="px-3 py-4 align-top text-[var(--muted)]">
                {formatDateOrFallback(event.receivedAt)}
              </td>
              <td className="px-3 py-4 align-top text-[var(--muted)]">
                {event.errorMessage ?? "Sem erro"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AuditEventsTable({
  auditEvents,
}: {
  auditEvents: BillingAdminAuditEventRecord[];
}) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead className="text-[11px] uppercase tracking-[0.22em] text-[var(--muted)]">
          <tr>
            <th className="px-3 py-3 font-medium">Quando</th>
            <th className="px-3 py-3 font-medium">Ação</th>
            <th className="px-3 py-3 font-medium">Ator</th>
            <th className="px-3 py-3 font-medium">Contexto</th>
          </tr>
        </thead>
        <tbody>
          {auditEvents.map((event) => (
            <tr key={event.id} className="border-t border-[var(--panel-border)]">
              <td className="px-3 py-4 align-top text-[var(--muted)]">
                {formatDateOrFallback(event.createdAt)}
              </td>
              <td className="px-3 py-4 align-top">
                <div className="space-y-1">
                  <p className="font-semibold text-[var(--foreground)]">{event.action}</p>
                  <p className="text-xs text-[var(--muted)]">{event.workspaceName}</p>
                </div>
              </td>
              <td className="px-3 py-4 align-top text-[var(--muted)]">
                <div className="space-y-1">
                  <p>{event.actorType}</p>
                  <p className="text-xs">{event.actorId ?? "Sem actorId"}</p>
                </div>
              </td>
              <td className="px-3 py-4 align-top text-[var(--muted)]">
                {event.subscriptionId ?? event.invoiceId ?? "Sem referencia"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function FindingsList({
  findings,
}: {
  findings: BillingReconciliationFinding[];
}) {
  if (findings.length === 0) {
    return (
      <div className="rounded-[22px] border border-[var(--panel-border)] bg-[rgba(255,255,255,0.76)] p-5 text-sm text-[var(--muted)]">
        Nenhuma divergencia operacional aberta no momento.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {findings.map((finding, index) => (
        <article
          key={`${finding.code}-${finding.subscriptionId ?? ""}-${index}`}
          className="rounded-[22px] border border-[rgba(217,119,6,0.18)] bg-[rgba(255,248,235,0.92)] p-5"
        >
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[var(--accent)]">
            {finding.code}
          </p>
          <p className="mt-3 text-sm leading-7 text-[var(--foreground)]">
            workspace: {finding.workspaceId ?? "n/a"} · assinatura:{" "}
            {finding.subscriptionId ?? "n/a"} · invoice: {finding.invoiceId ?? "n/a"}
          </p>
        </article>
      ))}
    </div>
  );
}

export function StatusBadge({
  status,
}: {
  status: BillingAdminWorkspaceRecord["currentStatus"] | BillingAdminSubscriptionRecord["status"];
}) {
  const tone = resolveStatusTone(status ?? "pending");

  return (
    <span className={tone.className}>
      {status ?? "sem_status"}
    </span>
  );
}

export function InvoiceStatusBadge({ status }: { status: BillingAdminInvoiceRecord["status"] }) {
  const tone =
    status === "paid"
      ? "success"
      : status === "pending"
        ? "warning"
        : "danger";

  return <span className={resolveToneClassName(tone)}>{status}</span>;
}

export function WebhookStatusBadge({ status }: { status: BillingWebhookEvent["status"] }) {
  const tone =
    status === "processed"
      ? "success"
      : status === "failed"
        ? "danger"
        : status === "processing"
          ? "warning"
          : "neutral";

  return <span className={resolveToneClassName(tone)}>{status}</span>;
}

export function EmptyAdminState({
  message,
}: {
  message: string;
}) {
  return (
    <div className="rounded-[22px] border border-dashed border-[var(--panel-border)] bg-[rgba(255,255,255,0.58)] p-6 text-sm leading-7 text-[var(--muted)]">
      {message}
    </div>
  );
}

export function formatMoney(amountCents: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(amountCents / 100);
}

export function formatDateOrFallback(value: string | null) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function formatPaymentMethod(value: BillingAdminInvoiceRecord["paymentMethod"]) {
  switch (value) {
    case "pix_manual":
      return "Pix manual";
    case "pix_automatic":
      return "Pix automatico";
    case "card":
      return "Cartao";
    case "account_money":
      return "Saldo MP";
    case "boleto":
      return "Boleto";
    case "unknown":
      return "Nao identificado";
    case null:
    default:
      return "—";
  }
}

function resolveStatusTone(
  status: NonNullable<
    BillingAdminWorkspaceRecord["currentStatus"] | BillingAdminSubscriptionRecord["status"]
  >,
) {
  switch (status) {
    case "active":
      return { className: resolveToneClassName("success") };
    case "pending":
    case "scheduled_cancel":
    case "past_due":
      return { className: resolveToneClassName("warning") };
    case "paused":
    case "canceled":
    case "expired":
      return { className: resolveToneClassName("danger") };
    default:
      return { className: resolveToneClassName("neutral") };
  }
}

function resolveToneClassName(tone: "success" | "warning" | "danger" | "neutral") {
  switch (tone) {
    case "success":
      return "inline-flex items-center rounded-full border border-[rgba(16,185,129,0.2)] bg-[rgba(236,253,245,0.92)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[rgb(5,150,105)]";
    case "warning":
      return "inline-flex items-center rounded-full border border-[rgba(217,119,6,0.2)] bg-[rgba(255,247,237,0.92)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[rgb(180,83,9)]";
    case "danger":
      return "inline-flex items-center rounded-full border border-[rgba(220,38,38,0.2)] bg-[rgba(254,242,242,0.92)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[rgb(185,28,28)]";
    case "neutral":
    default:
      return "inline-flex items-center rounded-full border border-[var(--panel-border)] bg-[rgba(255,255,255,0.78)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]";
  }
}
