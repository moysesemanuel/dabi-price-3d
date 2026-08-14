import "server-only";

import {
  appendBillingAuditEvent,
  createBillingInvoice,
  createBillingSubscriptionChange,
  createBillingWebhookEvent,
  findBillingInvoiceByProviderPaymentId,
  findActiveBillingPrice,
  findLatestOpenBillingSubscriptionChange,
  getBillingInvoiceById,
  getBillingSubscriptionChangeByInvoiceId,
  getBillingSubscriptionById,
  updateBillingSubscriptionChange,
  updateBillingInvoice,
  updateBillingWebhookEventStatus,
} from "./repository.ts";
import { createBillingServiceRepository } from "./service-repository.ts";
import { BillingService } from "./service.ts";
import { BillingWebhookService } from "./webhook-service.ts";
import {
  applyWorkspaceSubscriptionUpdate,
  findPrimaryWorkspaceForUser,
  findUserByEmail,
  getWorkspacePreferences,
} from "../server/platform";
import { getBillingProvider } from "./providers/index.ts";
import {
  createBillingSubscription,
  updateBillingSubscription,
} from "./repository.ts";

export function createBillingWebhookService() {
  const billingService = new BillingService(
    createBillingServiceRepository({
      createBillingSubscription,
      createBillingInvoice,
      createBillingSubscriptionChange,
      findLatestOpenBillingSubscriptionChange,
      getBillingSubscriptionById,
      updateBillingSubscription,
      updateBillingSubscriptionChange,
      appendBillingAuditEvent,
    }),
  );

  return new BillingWebhookService({
    createWebhookEvent: createBillingWebhookEvent,
    updateWebhookEventStatus: updateBillingWebhookEventStatus,
    getInvoiceById: getBillingInvoiceById,
    findInvoiceByProviderPaymentId: findBillingInvoiceByProviderPaymentId,
    updateInvoice: updateBillingInvoice,
    getSubscriptionById: getBillingSubscriptionById,
    findUserByEmail,
    findPrimaryWorkspaceForUser,
    getWorkspacePreferences,
    applyWorkspaceSubscriptionUpdate,
    getSubscriptionChangeByInvoiceId: getBillingSubscriptionChangeByInvoiceId,
    updateSubscriptionChange: updateBillingSubscriptionChange,
    findActivePrice: findActiveBillingPrice,
    getProvider(providerName) {
      return providerName ? getBillingProvider(providerName) : null;
    },
    billingService,
  });
}
