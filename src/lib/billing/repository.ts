import "server-only";

import { randomUUID } from "node:crypto";
import { getSql } from "@/lib/server/neon";
import { ensurePlatformReady } from "@/lib/server/platform";
import {
  currentBillingSubscriptionStatuses,
  type BillingAuditActorType,
  type BillingCycle,
  type BillingInvoiceStatus,
  type BillingInvoiceType,
  type BillingPaymentMethodType,
  type BillingPlanId,
  type BillingProviderName,
  type BillingSubscriptionChangeStatus,
  type BillingSubscriptionChangeType,
  type BillingSubscriptionStatus,
  type BillingWebhookEventStatus,
} from "./types";

type BillingPriceRow = {
  id: string;
  plan_id: BillingPlanId;
  billing_cycle: BillingCycle;
  amount_cents: number;
  currency: string;
  active_from: string;
  active_until: string | null;
  created_at: string;
  updated_at: string;
};

type BillingSubscriptionRow = {
  id: string;
  workspace_id: string;
  plan_id: BillingPlanId;
  billing_cycle: BillingCycle;
  price_id: string | null;
  status: BillingSubscriptionStatus;
  auto_renew: boolean;
  current_period_start: string | null;
  current_period_end: string | null;
  grace_period_ends_at: string | null;
  cancel_at_period_end: boolean;
  cancel_requested_at: string | null;
  ended_at: string | null;
  access_until: string | null;
  provider: BillingProviderName | null;
  provider_subscription_id: string | null;
  created_at: string;
  updated_at: string;
};

type BillingWebhookEventRow = {
  id: string;
  provider: BillingProviderName;
  provider_event_id: string;
  event_type: string;
  resource_id: string | null;
  payload_hash: string;
  status: BillingWebhookEventStatus;
  attempts: number;
  received_at: string;
  processed_at: string | null;
  error_code: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

export async function findCurrentBillingSubscriptionForWorkspace(
  workspaceId: string,
) {
  await ensurePlatformReady();

  const sql = getSql();
  const rows = (await sql`
    SELECT
      id,
      workspace_id,
      plan_id,
      billing_cycle,
      price_id,
      status,
      auto_renew,
      current_period_start,
      current_period_end,
      grace_period_ends_at,
      cancel_at_period_end,
      cancel_requested_at,
      ended_at,
      access_until,
      provider,
      provider_subscription_id,
      created_at,
      updated_at
    FROM billing_subscriptions
    WHERE workspace_id = ${workspaceId}
      AND status = ANY(${currentBillingSubscriptionStatuses})
    ORDER BY created_at DESC
    LIMIT 1
  `) as BillingSubscriptionRow[];

  return rows[0] ?? null;
}

export async function findBillingSubscriptionByProviderSubscriptionId(input: {
  provider: BillingProviderName;
  providerSubscriptionId: string;
}) {
  await ensurePlatformReady();

  const sql = getSql();
  const rows = (await sql`
    SELECT
      id,
      workspace_id,
      plan_id,
      billing_cycle,
      price_id,
      status,
      auto_renew,
      current_period_start,
      current_period_end,
      grace_period_ends_at,
      cancel_at_period_end,
      cancel_requested_at,
      ended_at,
      access_until,
      provider,
      provider_subscription_id,
      created_at,
      updated_at
    FROM billing_subscriptions
    WHERE provider = ${input.provider}
      AND provider_subscription_id = ${input.providerSubscriptionId}
    LIMIT 1
  `) as BillingSubscriptionRow[];

  return rows[0] ?? null;
}

export async function createBillingSubscription(input: {
  workspaceId: string;
  planId: BillingPlanId;
  billingCycle: BillingCycle;
  priceId?: string | null;
  status: BillingSubscriptionStatus;
  autoRenew?: boolean;
  provider?: BillingProviderName | null;
  providerSubscriptionId?: string | null;
  currentPeriodStart?: string | null;
  currentPeriodEnd?: string | null;
  gracePeriodEndsAt?: string | null;
  cancelAtPeriodEnd?: boolean;
  cancelRequestedAt?: string | null;
  endedAt?: string | null;
  accessUntil?: string | null;
}) {
  await ensurePlatformReady();

  const sql = getSql();
  const rows = (await sql`
    INSERT INTO billing_subscriptions (
      id,
      workspace_id,
      plan_id,
      billing_cycle,
      price_id,
      status,
      auto_renew,
      current_period_start,
      current_period_end,
      grace_period_ends_at,
      cancel_at_period_end,
      cancel_requested_at,
      ended_at,
      access_until,
      provider,
      provider_subscription_id,
      created_at,
      updated_at
    )
    VALUES (
      ${randomUUID()},
      ${input.workspaceId},
      ${input.planId},
      ${input.billingCycle},
      ${input.priceId ?? null},
      ${input.status},
      ${input.autoRenew ?? false},
      ${input.currentPeriodStart ?? null},
      ${input.currentPeriodEnd ?? null},
      ${input.gracePeriodEndsAt ?? null},
      ${input.cancelAtPeriodEnd ?? false},
      ${input.cancelRequestedAt ?? null},
      ${input.endedAt ?? null},
      ${input.accessUntil ?? null},
      ${input.provider ?? null},
      ${input.providerSubscriptionId ?? null},
      NOW(),
      NOW()
    )
    RETURNING
      id,
      workspace_id,
      plan_id,
      billing_cycle,
      price_id,
      status,
      auto_renew,
      current_period_start,
      current_period_end,
      grace_period_ends_at,
      cancel_at_period_end,
      cancel_requested_at,
      ended_at,
      access_until,
      provider,
      provider_subscription_id,
      created_at,
      updated_at
  `) as BillingSubscriptionRow[];

  return rows[0] ?? null;
}

export async function createBillingPrice(input: {
  planId: BillingPlanId;
  billingCycle: BillingCycle;
  amountCents: number;
  currency?: string;
  activeFrom: string;
  activeUntil?: string | null;
}) {
  await ensurePlatformReady();

  const sql = getSql();
  const rows = (await sql`
    INSERT INTO billing_prices (
      id,
      plan_id,
      billing_cycle,
      amount_cents,
      currency,
      active_from,
      active_until,
      created_at,
      updated_at
    )
    VALUES (
      ${randomUUID()},
      ${input.planId},
      ${input.billingCycle},
      ${input.amountCents},
      ${input.currency ?? "BRL"},
      ${input.activeFrom},
      ${input.activeUntil ?? null},
      NOW(),
      NOW()
    )
    RETURNING
      id,
      plan_id,
      billing_cycle,
      amount_cents,
      currency,
      active_from,
      active_until,
      created_at,
      updated_at
  `) as BillingPriceRow[];

  return rows[0] ?? null;
}

export async function appendBillingAuditEvent(input: {
  workspaceId?: string | null;
  subscriptionId?: string | null;
  invoiceId?: string | null;
  actorType: BillingAuditActorType;
  actorId?: string | null;
  action: string;
  metadata?: Record<string, unknown> | null;
}) {
  await ensurePlatformReady();

  const sql = getSql();

  await sql`
    INSERT INTO billing_audit_events (
      id,
      workspace_id,
      subscription_id,
      invoice_id,
      actor_type,
      actor_id,
      action,
      metadata,
      created_at
    )
    VALUES (
      ${randomUUID()},
      ${input.workspaceId ?? null},
      ${input.subscriptionId ?? null},
      ${input.invoiceId ?? null},
      ${input.actorType},
      ${input.actorId ?? null},
      ${input.action},
      CAST(${JSON.stringify(input.metadata ?? null)} AS JSONB),
      NOW()
    )
  `;
}

export async function createBillingWebhookEvent(input: {
  provider: BillingProviderName;
  providerEventId: string;
  eventType: string;
  resourceId?: string | null;
  payloadHash: string;
  status?: BillingWebhookEventStatus;
}) {
  await ensurePlatformReady();

  const sql = getSql();
  const rows = (await sql`
    INSERT INTO billing_webhook_events (
      id,
      provider,
      provider_event_id,
      event_type,
      resource_id,
      payload_hash,
      status,
      attempts,
      received_at,
      processed_at,
      error_code,
      error_message,
      created_at,
      updated_at
    )
    VALUES (
      ${randomUUID()},
      ${input.provider},
      ${input.providerEventId},
      ${input.eventType},
      ${input.resourceId ?? null},
      ${input.payloadHash},
      ${input.status ?? "received"},
      0,
      NOW(),
      NULL,
      NULL,
      NULL,
      NOW(),
      NOW()
    )
    ON CONFLICT (provider, provider_event_id, event_type)
    DO UPDATE SET
      payload_hash = EXCLUDED.payload_hash,
      resource_id = EXCLUDED.resource_id,
      updated_at = NOW()
    RETURNING
      id,
      provider,
      provider_event_id,
      event_type,
      resource_id,
      payload_hash,
      status,
      attempts,
      received_at,
      processed_at,
      error_code,
      error_message,
      created_at,
      updated_at
  `) as BillingWebhookEventRow[];

  return rows[0] ?? null;
}

export async function updateBillingWebhookEventStatus(input: {
  provider: BillingProviderName;
  providerEventId: string;
  eventType: string;
  status: BillingWebhookEventStatus;
  errorCode?: string | null;
  errorMessage?: string | null;
  processedAt?: string | null;
}) {
  await ensurePlatformReady();

  const sql = getSql();
  const rows = (await sql`
    UPDATE billing_webhook_events
    SET
      status = ${input.status},
      attempts = attempts + 1,
      processed_at = ${input.processedAt ?? null},
      error_code = ${input.errorCode ?? null},
      error_message = ${input.errorMessage ?? null},
      updated_at = NOW()
    WHERE provider = ${input.provider}
      AND provider_event_id = ${input.providerEventId}
      AND event_type = ${input.eventType}
    RETURNING
      id,
      provider,
      provider_event_id,
      event_type,
      resource_id,
      payload_hash,
      status,
      attempts,
      received_at,
      processed_at,
      error_code,
      error_message,
      created_at,
      updated_at
  `) as BillingWebhookEventRow[];

  return rows[0] ?? null;
}

export type {
  BillingPriceRow,
  BillingSubscriptionRow,
  BillingWebhookEventRow,
  BillingCycle,
  BillingInvoiceStatus,
  BillingInvoiceType,
  BillingPaymentMethodType,
  BillingPlanId,
  BillingSubscriptionChangeStatus,
  BillingSubscriptionChangeType,
  BillingSubscriptionStatus,
};
