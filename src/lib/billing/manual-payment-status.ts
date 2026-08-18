import type { BillingInvoiceStatus } from "./types.ts";

export type BillingManualPaymentState =
  | "pending"
  | "paid"
  | "failed"
  | "expired"
  | "canceled"
  | "unknown";

export function normalizeBillingManualPaymentState(
  status: string | null | undefined,
) {
  const normalized = status?.trim().toLowerCase();

  switch (normalized) {
    case "approved":
      return "paid" as const;
    case "pending":
    case "in_process":
      return "pending" as const;
    case "rejected":
      return "failed" as const;
    case "cancelled":
    case "canceled":
      return "canceled" as const;
    case "expired":
      return "expired" as const;
    default:
      return "unknown" as const;
  }
}

export function resolveInvoiceStatusFromManualPaymentState(
  state: BillingManualPaymentState,
): BillingInvoiceStatus | null {
  switch (state) {
    case "pending":
      return "pending";
    case "paid":
      return "paid";
    case "failed":
      return "failed";
    case "expired":
      return "expired";
    case "canceled":
      return "canceled";
    case "unknown":
    default:
      return null;
  }
}
