import type { WorkspacePlanId } from "../workspace/catalog";

export function resolveWorkspacePlanIdForSubscription(input: {
  mercadoPagoPlanId: string | null | undefined;
  mercadoPagoSubscriptionId: string;
  savedMercadoPagoSubscriptionId: string | null;
  savedWorkspacePlanId: WorkspacePlanId;
  mappedWorkspacePlanId?: WorkspacePlanId | null;
}) {
  if (input.mappedWorkspacePlanId) {
    return input.mappedWorkspacePlanId;
  }

  if (
    input.savedMercadoPagoSubscriptionId &&
    input.savedMercadoPagoSubscriptionId === input.mercadoPagoSubscriptionId
  ) {
    return input.savedWorkspacePlanId;
  }

  return null;
}