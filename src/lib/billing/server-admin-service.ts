import "server-only";

import { getPersistenceMode } from "@/lib/server/persistence-mode";
import { isPlatformPersistenceAvailable } from "@/lib/server/platform";
import { getBillingProvider } from "./providers/index.ts";
import { BillingAdminService } from "./admin-service.ts";
import {
  getBillingAdminSubscriptionRecord,
  getBillingAdminSummary,
  listBillingAdminAuditEvents,
  listBillingAdminAuditEventsBySubscriptionId,
  listBillingAdminInvoices,
  listBillingAdminInvoicesBySubscriptionId,
  listBillingAdminSubscriptions,
  listBillingAdminWebhookEvents,
  listBillingAdminWorkspaces,
} from "./admin-repository.ts";
import {
  appendBillingAuditEvent,
  getBillingSubscriptionById,
  updateBillingSubscription,
} from "./repository.ts";
import { createBillingReconciliationService } from "./server-reconciliation-service.ts";
import { createBillingReconciliationRunner } from "./server-reconciliation-runner.ts";

export function createBillingAdminService() {
  const reconciliationService = createBillingReconciliationService();
  const reconciliationRunner = createBillingReconciliationRunner();

  return new BillingAdminService({
    isPersistenceEnabled: isPlatformPersistenceAvailable,
    getPersistenceMode,
    getSummary: getBillingAdminSummary,
    listWorkspaces: listBillingAdminWorkspaces,
    listSubscriptions: listBillingAdminSubscriptions,
    listInvoices: listBillingAdminInvoices,
    listWebhookEvents: listBillingAdminWebhookEvents,
    listAuditEvents: listBillingAdminAuditEvents,
    async collectOperationalFindings(limit) {
      const result = await reconciliationService.collectOperationalFindings(limit);
      return result.findings;
    },
    runProviderReconciliation(limit, subscriptionId) {
      return reconciliationRunner.runProviderReconciliation(limit, subscriptionId);
    },
    getSubscriptionRecord: getBillingAdminSubscriptionRecord,
    getSubscriptionById: getBillingSubscriptionById,
    listInvoicesBySubscriptionId: listBillingAdminInvoicesBySubscriptionId,
    listAuditEventsBySubscriptionId: listBillingAdminAuditEventsBySubscriptionId,
    updateSubscription: updateBillingSubscription,
    appendAuditEvent: appendBillingAuditEvent,
    getProvider(providerName) {
      return providerName ? getBillingProvider(providerName) : null;
    },
    now() {
      return new Date();
    },
  });
}
