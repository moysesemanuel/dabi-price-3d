import "server-only";

import {
  appendBillingAuditEvent,
  findActiveBillingPrice,
  getBillingInvoiceById,
  getBillingSubscriptionChangeByInvoiceId,
  getBillingSubscriptionById,
  getDueBillingSubscriptionChanges,
  listAbandonedPendingBillingSubscriptions,
  listBillingInvoicesForExpiration,
  listBillingSubscriptionsForExpiration,
  listBillingSubscriptionsForGracePeriodEnd,
  listBillingSubscriptionsForScheduledCancellation,
  listFailedBillingWebhookEvents,
  updateBillingInvoice,
  updateBillingSubscriptionChange,
} from "./repository.ts";
import { createBillingService } from "./server-service.ts";
import { BillingReconciliationService } from "./reconciliation-service.ts";
import { applyWorkspaceSubscriptionUpdate } from "../server/platform";
import { getBillingProvider } from "./providers/index.ts";

export function createBillingReconciliationService() {
  return new BillingReconciliationService({
    billingService: createBillingService(),
    getSubscriptionById: getBillingSubscriptionById,
    listSubscriptionsForExpiration: listBillingSubscriptionsForExpiration,
    listSubscriptionsForGracePeriodEnd: listBillingSubscriptionsForGracePeriodEnd,
    listSubscriptionsForScheduledCancellation:
      listBillingSubscriptionsForScheduledCancellation,
    listAbandonedPendingSubscriptions: listAbandonedPendingBillingSubscriptions,
    getInvoiceById: getBillingInvoiceById,
    listInvoicesForExpiration: listBillingInvoicesForExpiration,
    updateInvoice: updateBillingInvoice,
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
