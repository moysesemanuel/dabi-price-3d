import "server-only";

import {
  appendBillingAuditEvent,
  claimBillingWebhookEventProcessing,
  createBillingInvoice,
  createBillingSubscriptionChange,
  createBillingWebhookEvent,
  findBillingInvoiceByProviderAuthorizedPaymentId,
  findBillingInvoiceByProviderPaymentId,
  findActiveBillingPrice,
  findLatestOpenBillingSubscriptionChange,
  getBillingInvoiceById,
  getBillingSubscriptionChangeByInvoiceId,
  getBillingSubscriptionById,
  findBillingSubscriptionByProviderSubscriptionId,
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
    claimWebhookEventProcessing: claimBillingWebhookEventProcessing,
    updateWebhookEventStatus: updateBillingWebhookEventStatus,
    getInvoiceById: getBillingInvoiceById,
    findInvoiceByProviderPaymentId: findBillingInvoiceByProviderPaymentId,
    findInvoiceByProviderAuthorizedPaymentId:
      findBillingInvoiceByProviderAuthorizedPaymentId,
    createInvoice: createBillingInvoice,
    updateInvoice: updateBillingInvoice,
    getSubscriptionById: getBillingSubscriptionById,
    findSubscriptionByProviderSubscriptionId:
      findBillingSubscriptionByProviderSubscriptionId,
    findUserByEmail,
    findPrimaryWorkspaceForUser,
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
