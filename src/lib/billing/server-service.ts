import "server-only";

import {
  appendBillingAuditEvent,
  createBillingSubscription,
  createBillingSubscriptionChange,
  findLatestOpenBillingSubscriptionChange,
  getBillingSubscriptionById,
  updateBillingSubscriptionChange,
  updateBillingSubscription,
} from "./repository.ts";
import { createBillingServiceRepository } from "./service-repository.ts";
import { BillingService } from "./service.ts";

export function createBillingService() {
  return new BillingService(
    createBillingServiceRepository({
      createBillingSubscription,
      createBillingSubscriptionChange,
      findLatestOpenBillingSubscriptionChange,
      getBillingSubscriptionById,
      updateBillingSubscription,
      updateBillingSubscriptionChange,
      appendBillingAuditEvent,
    }),
  );
}
