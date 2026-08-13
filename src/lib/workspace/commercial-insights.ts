import type { SavedCalculation } from "../history/calculation-history";
import type { AppPreferences } from "../settings/app-preferences";
import { getSubscriptionStatusLabel } from "./subscription-access.ts";
import { getWorkspacePlan, workspaceRoleMeta } from "./catalog.ts";
import type { WorkspaceAuditEvent } from "./audit-log";

export type WorkspaceReadinessStatus = "ready" | "attention" | "pending";

export type WorkspaceReadinessItem = {
  id: string;
  label: string;
  status: WorkspaceReadinessStatus;
  description: string;
  detail: string;
};

export type WorkspaceCommercialSnapshot = {
  planLabel: string;
  planStatusLabel: string;
  planSupportLabel: string;
  readinessScore: number;
  readinessTone: WorkspaceReadinessStatus;
  readinessLabel: string;
  historyCount: number;
  historyLimit: number;
  usagePercentage: number;
  channelsUsedCount: number;
  averageMarginPercentage: number;
  profitableItemsCount: number;
  erpSyncCount: number;
  siteProductLinksCount: number;
  recentAuditCount: number;
  lastSavedAt: string | null;
  lastAuditAt: string | null;
  seatsUsed: number;
  seatsIncluded: number;
  seatsBalance: number;
  roleLabel: string;
  readinessItems: WorkspaceReadinessItem[];
};

export function buildWorkspaceCommercialSnapshot(input: {
  preferences: AppPreferences;
  history: SavedCalculation[];
  auditLog: WorkspaceAuditEvent[];
  now?: Date;
}): WorkspaceCommercialSnapshot {
  const { preferences, history, auditLog } = input;
  const plan = getWorkspacePlan(preferences.subscription.planId);
  const historyLimit = plan.historyLimit;
  const channelsUsedCount = new Set(
    history
      .map((item) => item.salesChannelId)
      .filter((channelId) => typeof channelId === "string" && channelId.length > 0),
  ).size;
  const averageMarginPercentage =
    history.length > 0
      ? history.reduce((total, item) => total + item.summary.marginPercentage, 0) /
        history.length
      : 0;
  const profitableItemsCount = history.filter(
    (item) => item.summary.profit > 0,
  ).length;
  const erpSyncCount = history.filter((item) => item.erpProduct).length;
  const siteProductLinksCount = history.filter((item) => item.siteProduct).length;
  const readinessItems = buildWorkspaceReadinessItems({
    preferences,
    history,
    auditLog,
    channelsUsedCount,
    erpSyncCount,
    plan,
  });
  const readinessScore = Math.round(
    readinessItems.reduce((total, item) => total + statusScore[item.status], 0) /
      readinessItems.length,
  );
  const readinessTone =
    readinessScore >= 80
      ? "ready"
      : readinessScore >= 55
        ? "attention"
        : "pending";

  return {
    planLabel: plan.label,
    planStatusLabel: getSubscriptionStatusLabel(preferences.subscription.status),
    planSupportLabel: plan.supportLabel,
    readinessScore,
    readinessTone,
    readinessLabel:
      readinessTone === "ready"
        ? "Pronto para venda"
        : readinessTone === "attention"
          ? "Quase pronto"
          : "Em estruturação",
    historyCount: history.length,
    historyLimit,
    usagePercentage: historyLimit > 0 ? (history.length / historyLimit) * 100 : 0,
    channelsUsedCount,
    averageMarginPercentage,
    profitableItemsCount,
    erpSyncCount,
    siteProductLinksCount,
    recentAuditCount: auditLog.length,
    lastSavedAt: history[0]?.savedAt ?? null,
    lastAuditAt: auditLog[0]?.occurredAt ?? null,
    seatsUsed: preferences.subscription.seatsUsed,
    seatsIncluded: plan.seatsIncluded,
    seatsBalance: plan.seatsIncluded - preferences.subscription.seatsUsed,
    roleLabel: workspaceRoleMeta[preferences.operatorRole].label,
    readinessItems,
  };
}

const statusScore: Record<WorkspaceReadinessStatus, number> = {
  ready: 100,
  attention: 60,
  pending: 20,
};

function buildWorkspaceReadinessItems(input: {
  preferences: AppPreferences;
  history: SavedCalculation[];
  auditLog: WorkspaceAuditEvent[];
  channelsUsedCount: number;
  erpSyncCount: number;
  plan: ReturnType<typeof getWorkspacePlan>;
}) {
  const { preferences, history, auditLog, channelsUsedCount, erpSyncCount, plan } =
    input;
  const identityComplete =
    preferences.workspaceName.length > 0 &&
    preferences.operatorName.length > 0 &&
    preferences.operatorEmail.length > 0;
  const pricingPolicyConfigured =
    preferences.pricingDefaults.profitMarginPercentage > 0 &&
    preferences.pricingDefaults.healthyMarginTargetPercentage > 0 &&
    preferences.pricingDefaults.laborCostPerHour > 0 &&
    preferences.pricingDefaults.lossPercentage >= 0;
  const validationStatus =
    history.length >= 20 ? "ready" : history.length >= 5 ? "attention" : "pending";
  const traceabilityStatus =
    auditLog.length >= 8 && history.length > 0
      ? "ready"
      : auditLog.length >= 2 || history.length > 0
        ? "attention"
        : "pending";
  const integrationStatus = plan.erpSyncEnabled
    ? erpSyncCount > 0
      ? "ready"
      : history.length > 0
        ? "attention"
        : "pending"
    : "attention";
  const seatStatus =
    preferences.subscription.seatsUsed <= plan.seatsIncluded
      ? "ready"
      : preferences.subscription.seatsUsed === plan.seatsIncluded + 1
        ? "attention"
        : "pending";

  return [
    {
      id: "identity",
      label: "Identidade operacional",
      status: identityComplete ? "ready" : "pending",
      description:
        "Workspace, responsável e contato precisam estar claros para sustentar suporte, venda e governança.",
      detail: identityComplete
        ? "Responsável e contato definidos."
        : "Faltam dados mínimos de identidade do workspace.",
    },
    {
      id: "policy",
      label: "Política comercial",
      status: pricingPolicyConfigured ? "ready" : "attention",
      description:
        "Margens, perdas, pró-labore e impostos operacionais devem estar explícitos.",
      detail: pricingPolicyConfigured
        ? "Premissas comerciais estão parametrizadas."
        : "Revise margem, mão de obra e perdas padrão.",
    },
    {
      id: "validation",
      label: "Base de validação real",
      status: validationStatus,
      description:
        "Antes de vender, o ideal é validar o motor com casos reais e histórico recorrente.",
      detail:
        history.length >= 20
          ? "Amostra já próxima de uma validação comercial robusta."
          : history.length >= 5
            ? "Já existe base inicial, mas ainda não é benchmark forte."
            : "Quase sem amostra histórica para validar tese comercial.",
    },
    {
      id: "traceability",
      label: "Rastreabilidade",
      status: traceabilityStatus,
      description:
        "Operações maduras deixam trilha de eventos, alterações e cálculos relevantes.",
      detail:
        auditLog.length > 0
          ? `${auditLog.length} evento(s) recentes registrados no workspace.`
          : "Nenhum evento auditável relevante ainda.",
    },
    {
      id: "integrations",
      label: "Integrações e publicação",
      status: integrationStatus,
      description:
        "ERP, catálogo e canais conectados aumentam confiança operacional e retenção no SaaS.",
      detail: plan.erpSyncEnabled
        ? erpSyncCount > 0
          ? `${erpSyncCount} cálculo(s) já tiveram vínculo com ERP.`
          : "Plano suporta ERP, mas o fluxo ainda não foi exercitado."
        : "Plano atual não contempla sincronização ERP.",
    },
    {
      id: "capacity",
      label: "Capacidade do plano",
      status: seatStatus,
      description:
        "Assentos e limites precisam acompanhar o uso para evitar gargalo comercial.",
      detail:
        preferences.subscription.seatsUsed <= plan.seatsIncluded
          ? `${preferences.subscription.seatsUsed}/${plan.seatsIncluded} assentos usados.`
          : `${preferences.subscription.seatsUsed} assentos para ${plan.seatsIncluded} incluídos.`,
    },
    {
      id: "channels",
      label: "Cobertura de canais",
      status:
        channelsUsedCount >= 3
          ? "ready"
          : channelsUsedCount >= 1
            ? "attention"
            : "pending",
      description:
        "Vender um SaaS de precificação fica mais sólido quando a leitura já foi exercitada em múltiplos canais.",
      detail:
        channelsUsedCount > 0
          ? `${channelsUsedCount} canal(is) diferentes já utilizados no histórico.`
          : "Nenhum canal validado com histórico salvo ainda.",
    },
  ] satisfies WorkspaceReadinessItem[];
}
