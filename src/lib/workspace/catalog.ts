export type WorkspaceRole = "owner" | "manager" | "operator";
export type WorkspacePlanId = "starter" | "growth" | "scale";
export type SubscriptionStatus =
  | "internal"
  | "unpaid"
  | "trial"
  | "pending"
  | "active"
  | "paused"
  | "canceled";

export type WorkspaceSubscription = {
  planId: WorkspacePlanId;
  status: SubscriptionStatus;
  seatsUsed: number;
  mercadoPagoSubscriptionId: string | null;
  checkoutStartedAt: string | null;
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
};

export const workspacePlans: readonly WorkspacePlan[] = [
  {
    id: "starter",
    label: "DaBi Essencial",
    description: "Entrada comercial da DaBi para operar com preço e histórico sem complicação.",
    monthlyPriceLabel: "R$ 49",
    historyLimit: 50,
    seatsIncluded: 1,
    erpSyncEnabled: false,
    marketplaceAutomationEnabled: true,
    supportLabel: "Suporte base",
  },
  {
    id: "growth",
    label: "DaBi Pro",
    description: "Plano principal da DaBi para quem já vende com recorrência e quer crescer com mais controle.",
    monthlyPriceLabel: "R$ 149",
    historyLimit: 200,
    seatsIncluded: 3,
    erpSyncEnabled: true,
    marketplaceAutomationEnabled: true,
    supportLabel: "Suporte prioritário",
  },
  {
    id: "scale",
    label: "DaBi Equipe",
    description: "Estrutura DaBi para operação com time, volume, integração forte e acompanhamento consultivo.",
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
