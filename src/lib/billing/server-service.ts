import "server-only";

import {
  appendBillingAuditEvent,
  createBillingSubscription,
  getBillingSubscriptionById,
  updateBillingSubscription,
} from "./repository.ts";
import { createBillingServiceRepository } from "./service-repository.ts";
import { BillingService } from "./service.ts";

export function createBillingService() {
  return new BillingService(
    createBillingServiceRepository({
      createBillingSubscription,
      getBillingSubscriptionById,
      updateBillingSubscription,
      appendBillingAuditEvent,
    }),
  );
}
