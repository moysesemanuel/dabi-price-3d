import type { SavedCalculation } from "@/lib/history/calculation-history";
import { isConfectioneryCalculation } from "@/lib/history/workspace-calculations";

export type ConfectioneryPreviewOrderStatus =
  | "scheduled"
  | "in_progress"
  | "done";

export type ConfectioneryPreviewOrder = {
  id: string;
  clientName: string;
  productName: string;
  quantityLabel: string;
  scheduledLabel: string;
  productionDurationLabel: string;
  totalValue: number;
  advancePaid: number;
  remainingAmount: number;
  status: ConfectioneryPreviewOrderStatus;
  statusLabel: string;
  progressPercent: number;
  progressLabel: string;
};

export type ConfectioneryFinanceCategory = {
  label: string;
  amount: number;
  percentage: number;
  tone: "mint" | "rose" | "amber" | "sky" | "violet";
};

export type ConfectioneryFinanceSnapshot = {
  revenue: number;
  expenses: number;
  revenueShare: number;
  expenseShare: number;
  categories: ConfectioneryFinanceCategory[];
};

const fallbackOrders: ConfectioneryPreviewOrder[] = [
  {
    id: "fallback-1",
    clientName: "João Antonio da Silva",
    productName: "Pão caseiro",
    quantityLabel: "4x pão caseiro",
    scheduledLabel: "Entrega hoje às 14:30",
    productionDurationLabel: "1h 30min",
    totalValue: 90,
    advancePaid: 45,
    remainingAmount: 45,
    status: "scheduled",
    statusLabel: "Agendado",
    progressPercent: 20,
    progressLabel: "Separação de insumos",
  },
  {
    id: "fallback-2",
    clientName: "Mariana Ribeiro",
    productName: "Bolo de aniversário",
    quantityLabel: "1 bolo 2kg",
    scheduledLabel: "Entrega amanhã às 10:00",
    productionDurationLabel: "2h 40min",
    totalValue: 185,
    advancePaid: 90,
    remainingAmount: 95,
    status: "in_progress",
    statusLabel: "Em produção",
    progressPercent: 58,
    progressLabel: "Massa assada e recheio pronto",
  },
  {
    id: "fallback-3",
    clientName: "Carla Mendes",
    productName: "Caixa de brigadeiros",
    quantityLabel: "3 caixas com 12 un.",
    scheduledLabel: "Retirada hoje às 18:00",
    productionDurationLabel: "50min",
    totalValue: 120,
    advancePaid: 120,
    remainingAmount: 0,
    status: "done",
    statusLabel: "Concluído",
    progressPercent: 100,
    progressLabel: "Pedido finalizado",
  },
];

export function buildConfectioneryPreviewOrders(
  history: SavedCalculation[],
): ConfectioneryPreviewOrder[] {
  if (history.length === 0) {
    return fallbackOrders;
  }

  return history.slice(0, 6).map((item, index) => {
    const status = resolvePreviewStatus(index);
    const totalValue = item.summary.salePrice;
    const advancePaid =
      status === "done"
        ? totalValue
        : Number((totalValue * (status === "in_progress" ? 0.5 : 0.35)).toFixed(2));
    const remainingAmount = Number(Math.max(totalValue - advancePaid, 0).toFixed(2));

    return {
      id: item.id,
      clientName: resolvePreviewClientName(index),
      productName: item.productName,
      quantityLabel: isConfectioneryCalculation(item)
        ? `${item.confectionerySnapshot.unitsProduced}x ${item.productName.toLowerCase()}`
        : resolveQuantityLabel(index),
      scheduledLabel: resolveScheduledLabel(index, status),
      productionDurationLabel: isConfectioneryCalculation(item)
        ? `${item.confectionerySnapshot.productionTimeMinutes}min`
        : resolveDurationLabel(index),
      totalValue,
      advancePaid,
      remainingAmount,
      status,
      statusLabel:
        status === "scheduled"
          ? "Agendado"
          : status === "in_progress"
            ? "Em produção"
            : "Concluído",
      progressPercent:
        status === "scheduled" ? 18 + index * 6 : status === "in_progress" ? 48 + index * 7 : 100,
      progressLabel:
        status === "scheduled"
          ? "Fila montada"
          : status === "in_progress"
            ? "Execução em andamento"
            : "Pedido finalizado",
    };
  });
}

export function buildConfectioneryFinanceSnapshot(
  orders: ConfectioneryPreviewOrder[],
): ConfectioneryFinanceSnapshot {
  const revenue =
    orders.reduce((total, order) => total + order.totalValue, 0) || 4510.09;
  const expensesBase = revenue * 0.6476;
  const expenseRatios = [
    { label: "Produção", share: 0.442, tone: "mint" as const },
    { label: "Operacionais", share: 0.397, tone: "sky" as const },
    { label: "Pessoal", share: 0.076, tone: "amber" as const },
    { label: "Infraestrutura", share: 0.051, tone: "rose" as const },
    { label: "Financeiro", share: 0.034, tone: "violet" as const },
  ];

  const categories = expenseRatios.map((item) => ({
    label: item.label,
    amount: Number((expensesBase * item.share).toFixed(2)),
    percentage: Number((item.share * 100).toFixed(1)),
    tone: item.tone,
  }));
  const expenses = categories.reduce((total, category) => total + category.amount, 0);
  const combined = revenue + expenses;

  return {
    revenue: Number(revenue.toFixed(2)),
    expenses: Number(expenses.toFixed(2)),
    revenueShare: combined > 0 ? Number(((revenue / combined) * 100).toFixed(1)) : 0,
    expenseShare: combined > 0 ? Number(((expenses / combined) * 100).toFixed(1)) : 0,
    categories,
  };
}

function resolvePreviewStatus(index: number): ConfectioneryPreviewOrderStatus {
  const statuses: ConfectioneryPreviewOrderStatus[] = [
    "scheduled",
    "in_progress",
    "done",
  ];

  return statuses[index % statuses.length];
}

function resolvePreviewClientName(index: number) {
  const names = [
    "João Antonio da Silva",
    "Mariana Ribeiro",
    "Carla Mendes",
    "Paula Nogueira",
    "Lucas Ferreira",
    "Fernanda Gomes",
  ];

  return names[index % names.length];
}

function resolveQuantityLabel(index: number) {
  const labels = [
    "4x unidades",
    "1 encomenda principal",
    "3 caixas",
    "12 doces finos",
    "2 bolos pequenos",
    "1 kit festa",
  ];

  return labels[index % labels.length];
}

function resolveScheduledLabel(
  index: number,
  status: ConfectioneryPreviewOrderStatus,
) {
  const scheduled = [
    "Entrega hoje às 14:30",
    "Retirada amanhã às 10:00",
    "Entrega sexta às 16:20",
    "Entrega hoje às 18:00",
    "Retirada quarta às 09:00",
    "Entrega sábado às 11:30",
  ];

  if (status === "done") {
    return "Pedido concluído e pronto para retirada";
  }

  return scheduled[index % scheduled.length];
}

function resolveDurationLabel(index: number) {
  const labels = ["1h 30min", "2h 10min", "45min", "3h 20min", "1h 05min", "2h 45min"];

  return labels[index % labels.length];
}
