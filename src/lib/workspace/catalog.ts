export type WorkspaceRole = "owner" | "manager" | "operator";
export type WorkspacePlanId = "starter" | "growth" | "scale";
export type WorkspaceBillingCycle = "monthly" | "annual";
export type SubscriptionStatus =
  | "unpaid"
  | "pending"
  | "active"
  | "past_due"
  | "scheduled_cancel"
  | "paused"
  | "canceled"
  | "expired";

export type WorkspaceSubscription = {
  planId: WorkspacePlanId;
  status: SubscriptionStatus;
  billingCycle: WorkspaceBillingCycle;
  seatsUsed: number;
  mercadoPagoSubscriptionId: string | null;
  checkoutStartedAt: string | null;
};

export type WorkspacePlan = {
  id: WorkspacePlanId;
  label: string;
  description: string;
  monthlyPrice: number | null;
  monthlyPriceLabel: string;
  annualPrice: number | null;
  annualPriceLabel: string;
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
    monthlyPrice: 49,
    monthlyPriceLabel: "R$ 49",
    annualPrice: 6,
    annualPriceLabel: "R$ 6",
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
    monthlyPrice: 149,
    monthlyPriceLabel: "R$ 149",
    annualPrice: 1788,
    annualPriceLabel: "R$ 1.788",
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
    monthlyPrice: null,
    monthlyPriceLabel: "Sob consulta",
    annualPrice: null,
    annualPriceLabel: "Sob consulta",
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

export function getWorkspaceBillingCycleLabel(
  billingCycle: WorkspaceBillingCycle,
) {
  return billingCycle === "annual" ? "Anual" : "Mensal";
}

export function resolveWorkspacePlanPrice(
  plan: WorkspacePlan,
  billingCycle: WorkspaceBillingCycle,
) {
  return billingCycle === "annual" ? plan.annualPrice : plan.monthlyPrice;
}

export function resolveWorkspacePlanPriceLabel(
  plan: WorkspacePlan,
  billingCycle: WorkspaceBillingCycle,
) {
  return billingCycle === "annual" ? plan.annualPriceLabel : plan.monthlyPriceLabel;
}
