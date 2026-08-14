import "server-only";

import {
  appendBillingAuditEvent,
  createBillingWebhookEvent,
  findBillingInvoiceByProviderPaymentId,
  getBillingInvoiceById,
  getBillingSubscriptionById,
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
import {
  createBillingSubscription,
  updateBillingSubscription,
} from "./repository.ts";

export function createBillingWebhookService() {
  const billingService = new BillingService(
    createBillingServiceRepository({
      createBillingSubscription,
      getBillingSubscriptionById,
      updateBillingSubscription,
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
    billingService,
  });
}
