import {
  assertValidBillingSubscriptionTransition,
  canTransitionBillingSubscriptionStatus,
} from "./state-machine.ts";
import type {
  BillingAuditActorType,
  BillingCycle,
  BillingPlanId,
  BillingSubscription,
  BillingSubscriptionStatus,
} from "./types.ts";

type BillingSubscriptionMutation = Partial<
  Pick<
    BillingSubscription,
    | "planId"
    | "billingCycle"
    | "priceId"
    | "status"
    | "autoRenew"
    | "currentPeriodStart"
    | "currentPeriodEnd"
    | "gracePeriodEndsAt"
    | "cancelAtPeriodEnd"
    | "cancelRequestedAt"
    | "endedAt"
    | "accessUntil"
    | "provider"
    | "providerSubscriptionId"
  >
>;

export interface BillingServiceRepository {
  createSubscription(input: {
    workspaceId: string;
    planId: BillingPlanId;
    billingCycle: BillingCycle;
    priceId?: string | null;
    status: BillingSubscriptionStatus;
    autoRenew?: boolean;
    currentPeriodStart?: string | null;
    currentPeriodEnd?: string | null;
    gracePeriodEndsAt?: string | null;
    cancelAtPeriodEnd?: boolean;
    cancelRequestedAt?: string | null;
    endedAt?: string | null;
    accessUntil?: string | null;
    provider?: BillingSubscription["provider"];
    providerSubscriptionId?: BillingSubscription["providerSubscriptionId"];
  }): Promise<BillingSubscription | null>;
  getSubscriptionById(subscriptionId: string): Promise<BillingSubscription | null>;
  updateSubscription(
    subscriptionId: string,
    mutation: BillingSubscriptionMutation,
  ): Promise<BillingSubscription | null>;
  appendAuditEvent(input: {
    workspaceId?: string | null;
    subscriptionId?: string | null;
    invoiceId?: string | null;
    actorType: BillingAuditActorType;
    actorId?: string | null;
    action: string;
    metadata?: Record<string, unknown> | null;
  }): Promise<void>;
}

type BillingServiceActor = {
  actorType?: BillingAuditActorType;
  actorId?: string | null;
};

type BillingServiceClock = {
  now(): Date;
};

export class BillingService {
  private readonly repository: BillingServiceRepository;
  private readonly clock: BillingServiceClock;

  constructor(
    repository: BillingServiceRepository,
    clock: BillingServiceClock = {
      now: () => new Date(),
    },
  ) {
    this.repository = repository;
    this.clock = clock;
  }

  async createSubscription(input: {
    workspaceId: string;
    planId: BillingPlanId;
    billingCycle: BillingCycle;
    priceId?: string | null;
    autoRenew?: boolean;
    provider?: BillingSubscription["provider"];
    providerSubscriptionId?: BillingSubscription["providerSubscriptionId"];
  }) {
    const subscription = await this.repository.createSubscription({
      workspaceId: input.workspaceId,
      planId: input.planId,
      billingCycle: input.billingCycle,
      priceId: input.priceId ?? null,
      status: "pending",
      autoRenew: input.autoRenew ?? false,
      provider: input.provider ?? null,
      providerSubscriptionId: input.providerSubscriptionId ?? null,
    });

    if (!subscription) {
      throw new Error("Failed to create billing subscription.");
    }

    await this.repository.appendAuditEvent({
      workspaceId: subscription.workspaceId,
      subscriptionId: subscription.id,
      actorType: "system",
      action: "subscription.created",
      metadata: {
        planId: subscription.planId,
        billingCycle: subscription.billingCycle,
        status: subscription.status,
      },
    });

    return subscription;
  }

  async activateSubscription(
    subscriptionId: string,
    input: BillingServiceActor & {
      currentPeriodStart?: string | null;
      currentPeriodEnd?: string | null;
      accessUntil?: string | null;
    } = {},
  ) {
    return this.transitionSubscription(subscriptionId, "active", {
      actorType: input.actorType ?? "system",
      actorId: input.actorId ?? null,
      action: "subscription.activated",
      mutation: {
        currentPeriodStart: input.currentPeriodStart ?? null,
        currentPeriodEnd: input.currentPeriodEnd ?? null,
        accessUntil: input.accessUntil ?? input.currentPeriodEnd ?? null,
        gracePeriodEndsAt: null,
        cancelRequestedAt: null,
        cancelAtPeriodEnd: false,
        endedAt: null,
      },
    });
  }

  async markPastDue(
    subscriptionId: string,
    input: BillingServiceActor & {
      gracePeriodEndsAt: string;
    },
  ) {
    return this.transitionSubscription(subscriptionId, "past_due", {
      actorType: input.actorType ?? "system",
      actorId: input.actorId ?? null,
      action: "subscription.past_due",
      mutation: {
        gracePeriodEndsAt: input.gracePeriodEndsAt,
      },
    });
  }

  async pauseSubscription(
    subscriptionId: string,
    input: BillingServiceActor = {},
  ) {
    return this.transitionSubscription(subscriptionId, "paused", {
      actorType: input.actorType ?? "system",
      actorId: input.actorId ?? null,
      action: "subscription.paused",
      mutation: {
        gracePeriodEndsAt: null,
      },
    });
  }

  async scheduleCancellation(
    subscriptionId: string,
    input: BillingServiceActor & {
      cancelRequestedAt?: string | null;
    } = {},
  ) {
    return this.transitionSubscription(subscriptionId, "scheduled_cancel", {
      actorType: input.actorType ?? "user",
      actorId: input.actorId ?? null,
      action: "subscription.cancel_scheduled",
      mutation: {
        autoRenew: false,
        cancelAtPeriodEnd: true,
        cancelRequestedAt:
          input.cancelRequestedAt ?? this.clock.now().toISOString(),
      },
    });
  }

  async revertCancellation(
    subscriptionId: string,
    input: BillingServiceActor = {},
  ) {
    return this.transitionSubscription(subscriptionId, "active", {
      actorType: input.actorType ?? "user",
      actorId: input.actorId ?? null,
      action: "subscription.cancel_reverted",
      mutation: {
        autoRenew: true,
        cancelAtPeriodEnd: false,
        cancelRequestedAt: null,
      },
    });
  }

  async finalizeCancellation(
    subscriptionId: string,
    input: BillingServiceActor & {
      endedAt?: string | null;
    } = {},
  ) {
    const endedAt = input.endedAt ?? this.clock.now().toISOString();

    return this.transitionSubscription(subscriptionId, "canceled", {
      actorType: input.actorType ?? "system",
      actorId: input.actorId ?? null,
      action: "subscription.canceled",
      mutation: {
        endedAt,
        accessUntil: endedAt,
      },
    });
  }

  async expireSubscription(
    subscriptionId: string,
    input: BillingServiceActor & {
      endedAt?: string | null;
    } = {},
  ) {
    const endedAt = input.endedAt ?? this.clock.now().toISOString();

    return this.transitionSubscription(subscriptionId, "expired", {
      actorType: input.actorType ?? "system",
      actorId: input.actorId ?? null,
      action: "subscription.expired",
      mutation: {
        endedAt,
        accessUntil: endedAt,
      },
    });
  }

  private async transitionSubscription(
    subscriptionId: string,
    to: BillingSubscriptionStatus,
    input: BillingServiceActor & {
      action: string;
      mutation?: BillingSubscriptionMutation;
    },
  ) {
    const subscription = await this.requireSubscription(subscriptionId);

    if (subscription.status === to) {
      return subscription;
    }

    assertValidBillingSubscriptionTransition({
      from: subscription.status,
      to,
    });

    const updatedSubscription = await this.repository.updateSubscription(
      subscriptionId,
      {
        ...input.mutation,
        status: to,
      },
    );

    if (!updatedSubscription) {
      throw new Error(`Failed to transition billing subscription ${subscriptionId}.`);
    }

    await this.repository.appendAuditEvent({
      workspaceId: updatedSubscription.workspaceId,
      subscriptionId: updatedSubscription.id,
      actorType: input.actorType ?? "system",
      actorId: input.actorId ?? null,
      action: input.action,
      metadata: {
        fromStatus: subscription.status,
        toStatus: to,
        canTransition: canTransitionBillingSubscriptionStatus(subscription.status, to),
      },
    });

    return updatedSubscription;
  }

  private async requireSubscription(subscriptionId: string) {
    const subscription = await this.repository.getSubscriptionById(subscriptionId);

    if (!subscription) {
      throw new Error(`Billing subscription not found: ${subscriptionId}`);
    }

    return subscription;
  }
}
