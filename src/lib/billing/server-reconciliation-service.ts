import "server-only";

import {
  appendBillingAuditEvent,
  claimBillingInvoiceEffect,
  completeBillingInvoiceEffect,
  findActiveBillingPrice,
  getBillingInvoiceById,
  getBillingSubscriptionChangeByInvoiceId,
  getBillingSubscriptionById,
  getDueBillingSubscriptionChanges,
  listBillingInvoicesForProviderReconciliation,
  listBillingSubscriptionsForProviderReconciliation,
  listAbandonedPendingBillingSubscriptions,
  listBillingInvoicesForExpiration,
  listBillingSubscriptionsForExpiration,
  listBillingSubscriptionsForGracePeriodEnd,
  listBillingSubscriptionsForScheduledCancellation,
  listFailedBillingWebhookEvents,
  updateBillingInvoice,
  transitionPendingBillingInvoice,
  releaseBillingInvoiceEffectClaim,
  updateBillingSubscriptionChange,
} from "./repository.ts";
import { createBillingService } from "./server-service.ts";
import { BillingReconciliationService } from "./reconciliation-service.ts";
import { applyWorkspaceSubscriptionUpdate } from "../server/platform";
import { getBillingProvider } from "./providers/index.ts";
import { runWithServerBillingSubscriptionOperationClaim } from "./server-subscription-operation-claim.ts";

export function createBillingReconciliationService() {
  return new BillingReconciliationService({
    billingService: createBillingService(),
    getSubscriptionById: getBillingSubscriptionById,
    listSubscriptionsForProviderReconciliation:
      listBillingSubscriptionsForProviderReconciliation,
    listSubscriptionsForExpiration: listBillingSubscriptionsForExpiration,
    listSubscriptionsForGracePeriodEnd: listBillingSubscriptionsForGracePeriodEnd,
    listSubscriptionsForScheduledCancellation:
      listBillingSubscriptionsForScheduledCancellation,
    listAbandonedPendingSubscriptions: listAbandonedPendingBillingSubscriptions,
    getInvoiceById: getBillingInvoiceById,
    listInvoicesForProviderReconciliation:
      listBillingInvoicesForProviderReconciliation,
    listInvoicesForExpiration: listBillingInvoicesForExpiration,
    updateInvoice: updateBillingInvoice,
    transitionPendingInvoice: transitionPendingBillingInvoice,
    claimInvoiceEffect: claimBillingInvoiceEffect,
    completeInvoiceEffect: completeBillingInvoiceEffect,
    releaseInvoiceEffectClaim: releaseBillingInvoiceEffectClaim,
    withSubscriptionOperation: runWithServerBillingSubscriptionOperationClaim,
    getSubscriptionChangeByInvoiceId: getBillingSubscriptionChangeByInvoiceId,
    getDueSubscriptionChanges: getDueBillingSubscriptionChanges,
    updateSubscriptionChange: updateBillingSubscriptionChange,
    findActivePrice: findActiveBillingPrice,
    listFailedWebhookEvents: listFailedBillingWebhookEvents,
    appendAuditEvent: appendBillingAuditEvent,
    applyWorkspaceSubscriptionUpdate,
    getProvider(providerName) {
      return providerName ? getBillingProvider(providerName) : null;
    },
  });
}
