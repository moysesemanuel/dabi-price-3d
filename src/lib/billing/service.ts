import {
  assertValidBillingSubscriptionTransition,
  canTransitionBillingSubscriptionStatus,
  isTerminalBillingSubscriptionStatus,
} from "./state-machine.ts";
import type {
  BillingAuditActorType,
  BillingCycle,
  BillingSubscriptionChange,
  BillingSubscriptionChangeStatus,
  BillingSubscriptionChangeType,
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
  createSubscriptionChange(input: {
    subscriptionId: string;
    workspaceId: string;
    type: BillingSubscriptionChangeType;
    status: BillingSubscriptionChangeStatus;
    fromPlanId?: BillingPlanId | null;
    toPlanId?: BillingPlanId | null;
    fromBillingCycle?: BillingCycle | null;
    toBillingCycle?: BillingCycle | null;
    effectiveAt: string;
    creditAmountCents?: number;
    chargeAmountCents?: number;
    invoiceId?: string | null;
    requestedByType?: BillingAuditActorType | null;
    requestedById?: string | null;
  }): Promise<BillingSubscriptionChange | null>;
  findLatestOpenSubscriptionChange(input: {
    subscriptionId: string;
    type?: BillingSubscriptionChangeType;
  }): Promise<BillingSubscriptionChange | null>;
  updateSubscriptionChange(
    changeId: string,
    mutation: Partial<
      Pick<BillingSubscriptionChange, "status" | "appliedAt" | "canceledAt">
    >,
  ): Promise<BillingSubscriptionChange | null>;
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

  async scheduleDowngrade(
    subscriptionId: string,
    input: BillingServiceActor & {
      toPlanId: BillingPlanId;
    },
  ) {
    const subscription = await this.requireSubscription(subscriptionId);

    if (subscription.status !== "active") {
      throw new Error(
        `Cannot schedule downgrade for subscription ${subscriptionId} with status ${subscription.status}.`,
      );
    }

    if (!subscription.autoRenew || subscription.cancelAtPeriodEnd) {
      throw new Error(
        `Cannot schedule downgrade for subscription ${subscriptionId} without automatic renewal.`,
      );
    }

    if (!subscription.currentPeriodEnd) {
      throw new Error(
        `Cannot schedule downgrade for subscription ${subscriptionId} without currentPeriodEnd.`,
      );
    }

    if (!isBillingPlanDowngrade(subscription.planId, input.toPlanId)) {
      throw new Error(
        `Target plan ${input.toPlanId} is not a downgrade from ${subscription.planId}.`,
      );
    }

    const existingChange = await this.repository.findLatestOpenSubscriptionChange({
      subscriptionId,
      type: "downgrade",
    });

    if (
      existingChange &&
      existingChange.status === "scheduled" &&
      existingChange.toPlanId === input.toPlanId &&
      existingChange.effectiveAt === subscription.currentPeriodEnd
    ) {
      return existingChange;
    }

    if (existingChange && existingChange.status === "scheduled") {
      await this.repository.updateSubscriptionChange(existingChange.id, {
        status: "canceled",
        canceledAt: this.clock.now().toISOString(),
      });
    }

    const change = await this.repository.createSubscriptionChange({
      subscriptionId: subscription.id,
      workspaceId: subscription.workspaceId,
      type: "downgrade",
      status: "scheduled",
      fromPlanId: subscription.planId,
      toPlanId: input.toPlanId,
      fromBillingCycle: subscription.billingCycle,
      toBillingCycle: subscription.billingCycle,
      effectiveAt: subscription.currentPeriodEnd,
      creditAmountCents: 0,
      chargeAmountCents: 0,
      invoiceId: null,
      requestedByType: input.actorType ?? "user",
      requestedById: input.actorId ?? null,
    });

    if (!change) {
      throw new Error(`Failed to schedule downgrade for ${subscriptionId}.`);
    }

    await this.repository.appendAuditEvent({
      workspaceId: subscription.workspaceId,
      subscriptionId: subscription.id,
      actorType: input.actorType ?? "user",
      actorId: input.actorId ?? null,
      action: "subscription.downgrade_scheduled",
      metadata: {
        fromPlanId: subscription.planId,
        toPlanId: input.toPlanId,
        effectiveAt: subscription.currentPeriodEnd,
        changeId: change.id,
      },
    });

    return change;
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

  async applyScheduledChange(
    subscriptionId: string,
    input: BillingServiceActor & {
      planId?: BillingPlanId;
      billingCycle?: BillingCycle;
      priceId?: string | null;
      currentPeriodStart?: string | null;
      currentPeriodEnd?: string | null;
      accessUntil?: string | null;
      metadata?: Record<string, unknown> | null;
    } = {},
  ) {
    const subscription = await this.requireSubscription(subscriptionId);

    if (isTerminalBillingSubscriptionStatus(subscription.status)) {
      throw new Error(
        `Cannot apply scheduled change to terminal subscription ${subscriptionId}.`,
      );
    }

    const updatedSubscription = await this.repository.updateSubscription(
      subscriptionId,
      {
        planId: input.planId ?? subscription.planId,
        billingCycle: input.billingCycle ?? subscription.billingCycle,
        priceId:
          Object.prototype.hasOwnProperty.call(input, "priceId")
            ? input.priceId ?? null
            : subscription.priceId,
        currentPeriodStart:
          Object.prototype.hasOwnProperty.call(input, "currentPeriodStart")
            ? input.currentPeriodStart ?? null
            : subscription.currentPeriodStart,
        currentPeriodEnd:
          Object.prototype.hasOwnProperty.call(input, "currentPeriodEnd")
            ? input.currentPeriodEnd ?? null
            : subscription.currentPeriodEnd,
        accessUntil:
          Object.prototype.hasOwnProperty.call(input, "accessUntil")
            ? input.accessUntil ?? null
            : subscription.accessUntil,
      },
    );

    if (!updatedSubscription) {
      throw new Error(`Failed to apply scheduled change to ${subscriptionId}.`);
    }

    await this.repository.appendAuditEvent({
      workspaceId: updatedSubscription.workspaceId,
      subscriptionId: updatedSubscription.id,
      actorType: input.actorType ?? "system",
      actorId: input.actorId ?? null,
      action: resolveScheduledChangeAuditAction(input.metadata),
      metadata: {
        fromPlanId: subscription.planId,
        toPlanId: updatedSubscription.planId,
        fromBillingCycle: subscription.billingCycle,
        toBillingCycle: updatedSubscription.billingCycle,
        ...(input.metadata ?? {}),
      },
    });

    return updatedSubscription;
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

const billingPlanOrder: BillingPlanId[] = ["starter", "growth", "scale"];

function isBillingPlanDowngrade(
  fromPlanId: BillingPlanId,
  toPlanId: BillingPlanId,
) {
  return (
    billingPlanOrder.indexOf(toPlanId) >= 0 &&
    billingPlanOrder.indexOf(fromPlanId) >= 0 &&
    billingPlanOrder.indexOf(toPlanId) < billingPlanOrder.indexOf(fromPlanId)
  );
}

function resolveScheduledChangeAuditAction(
  metadata: Record<string, unknown> | null | undefined,
) {
  const changeType =
    typeof metadata?.changeType === "string" ? metadata.changeType : null;

  if (changeType === "downgrade") {
    return "subscription.downgraded";
  }

  if (changeType === "upgrade") {
    return "subscription.upgraded";
  }

  return "subscription.change_applied";
}
