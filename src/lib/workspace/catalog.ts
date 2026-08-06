export type WorkspaceRole = "owner" | "manager" | "operator" | "finance";
export type WorkspacePlanId = "starter" | "growth" | "scale";
export type SubscriptionStatus = "internal" | "trial" | "active";

export type WorkspaceSubscription = {
  planId: WorkspacePlanId;
  status: SubscriptionStatus;
  seatsUsed: number;
};

export type WorkspacePlan = {
  id: WorkspacePlanId;
  label: string;
  description: string;
  monthlyPriceLabel: string;
  historyLimit: number;
  seatsIncluded: number;
  erpSyncEnabled: boolean;
  marketplaceAutomationEnabled: boolean;
  supportLabel: string;
};

export const workspaceRoleMeta: Record<
  WorkspaceRole,
  { label: string; description: string }
> = {
  owner: {
    label: "Owner",
    description: "Define política comercial, plano e governança do workspace.",
  },
  manager: {
    label: "Gestor",
    description: "Acompanha resultados, metas e operação do time.",
  },
  operator: {
    label: "Operador",
    description: "Usa a precificadora no dia a dia sem mexer em governança.",
  },
  finance: {
    label: "Financeiro",
    description: "Valida margens, impostos operacionais e indicadores.",
  },
};

export const workspacePlans: readonly WorkspacePlan[] = [
  {
    id: "starter",
    label: "Starter",
    description: "Operação enxuta com controle essencial de preço e histórico.",
    monthlyPriceLabel: "R$ 49",
    historyLimit: 50,
    seatsIncluded: 1,
    erpSyncEnabled: false,
    marketplaceAutomationEnabled: true,
    supportLabel: "Suporte base",
  },
  {
    id: "growth",
    label: "Growth",
    description: "Plano equilibrado para quem já opera recorrência e catálogo.",
    monthlyPriceLabel: "R$ 149",
    historyLimit: 200,
    seatsIncluded: 3,
    erpSyncEnabled: true,
    marketplaceAutomationEnabled: true,
    supportLabel: "Suporte prioritário",
  },
  {
    id: "scale",
    label: "Scale",
    description: "Estrutura para operação com volume, equipe e integração forte.",
    monthlyPriceLabel: "Sob consulta",
    historyLimit: 1000,
    seatsIncluded: 10,
    erpSyncEnabled: true,
    marketplaceAutomationEnabled: true,
    supportLabel: "Suporte consultivo",
  },
] as const;

export function getWorkspacePlan(planId: WorkspacePlanId) {
  return workspacePlans.find((plan) => plan.id === planId) ?? workspacePlans[1];
}
