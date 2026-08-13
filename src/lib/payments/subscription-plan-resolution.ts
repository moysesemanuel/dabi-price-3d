import type { WorkspacePlanId } from "../workspace/catalog";

export function resolveWorkspacePlanIdForSubscription(input: {
  mercadoPagoSubscriptionId: string;
  savedMercadoPagoSubscriptionId: string | null;
  savedWorkspacePlanId: WorkspacePlanId;
}) {
  if (
    input.savedMercadoPagoSubscriptionId &&
    input.savedMercadoPagoSubscriptionId === input.mercadoPagoSubscriptionId
  ) {
    return input.savedWorkspacePlanId;
  }

  return null;
}
