import "server-only";

import { randomUUID } from "node:crypto";
import { getSql } from "@/lib/server/neon";
import { ensurePlatformReady } from "@/lib/server/platform";
import {
  currentBillingSubscriptionStatuses,
  type BillingPrice,
  type BillingSubscription,
  type BillingWebhookEvent,
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

  return rows[0] ? mapBillingSubscriptionRow(rows[0]) : null;
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

  return rows[0] ? mapBillingSubscriptionRow(rows[0]) : null;
}

export async function getBillingSubscriptionById(subscriptionId: string) {
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
    WHERE id = ${subscriptionId}
    LIMIT 1
  `) as BillingSubscriptionRow[];

  return rows[0] ? mapBillingSubscriptionRow(rows[0]) : null;
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

  return rows[0] ? mapBillingSubscriptionRow(rows[0]) : null;
}

export async function updateBillingSubscription(
  subscriptionId: string,
  mutation: BillingSubscriptionMutation,
) {
  await ensurePlatformReady();

  const currentSubscription = await getBillingSubscriptionById(subscriptionId);

  if (!currentSubscription) {
    return null;
  }

  const sql = getSql();
  const rows = (await sql`
    UPDATE billing_subscriptions
    SET
      plan_id = ${resolvePatchedValue(mutation, "planId", currentSubscription.planId)},
      billing_cycle = ${resolvePatchedValue(
        mutation,
        "billingCycle",
        currentSubscription.billingCycle,
      )},
      price_id = ${resolvePatchedValue(mutation, "priceId", currentSubscription.priceId)},
      status = ${resolvePatchedValue(mutation, "status", currentSubscription.status)},
      auto_renew = ${resolvePatchedValue(mutation, "autoRenew", currentSubscription.autoRenew)},
      current_period_start = ${resolvePatchedValue(
        mutation,
        "currentPeriodStart",
        currentSubscription.currentPeriodStart,
      )},
      current_period_end = ${resolvePatchedValue(
        mutation,
        "currentPeriodEnd",
        currentSubscription.currentPeriodEnd,
      )},
      grace_period_ends_at = ${resolvePatchedValue(
        mutation,
        "gracePeriodEndsAt",
        currentSubscription.gracePeriodEndsAt,
      )},
      cancel_at_period_end = ${resolvePatchedValue(
        mutation,
        "cancelAtPeriodEnd",
        currentSubscription.cancelAtPeriodEnd,
      )},
      cancel_requested_at = ${resolvePatchedValue(
        mutation,
        "cancelRequestedAt",
        currentSubscription.cancelRequestedAt,
      )},
      ended_at = ${resolvePatchedValue(mutation, "endedAt", currentSubscription.endedAt)},
      access_until = ${resolvePatchedValue(
        mutation,
        "accessUntil",
        currentSubscription.accessUntil,
      )},
      provider = ${resolvePatchedValue(mutation, "provider", currentSubscription.provider)},
      provider_subscription_id = ${resolvePatchedValue(
        mutation,
        "providerSubscriptionId",
        currentSubscription.providerSubscriptionId,
      )},
      updated_at = NOW()
    WHERE id = ${subscriptionId}
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

  return rows[0] ? mapBillingSubscriptionRow(rows[0]) : null;
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

  return rows[0] ? mapBillingPriceRow(rows[0]) : null;
}

export async function findActiveBillingPrice(input: {
  planId: BillingPlanId;
  billingCycle: BillingCycle;
  asOf?: string;
}) {
  await ensurePlatformReady();

  const sql = getSql();
  const asOf = input.asOf ?? new Date().toISOString();
  const rows = (await sql`
    SELECT
      id,
      plan_id,
      billing_cycle,
      amount_cents,
      currency,
      active_from,
      active_until,
      created_at,
      updated_at
    FROM billing_prices
    WHERE plan_id = ${input.planId}
      AND billing_cycle = ${input.billingCycle}
      AND active_from <= ${asOf}
      AND (
        active_until IS NULL
        OR active_until > ${asOf}
      )
    ORDER BY active_from DESC
    LIMIT 1
  `) as BillingPriceRow[];

  return rows[0] ? mapBillingPriceRow(rows[0]) : null;
}

export async function listActiveBillingPrices(input?: {
  asOf?: string;
}) {
  await ensurePlatformReady();

  const sql = getSql();
  const asOf = input?.asOf ?? new Date().toISOString();
  const rows = (await sql`
    SELECT
      id,
      plan_id,
      billing_cycle,
      amount_cents,
      currency,
      active_from,
      active_until,
      created_at,
      updated_at
    FROM billing_prices
    WHERE active_from <= ${asOf}
      AND (
        active_until IS NULL
        OR active_until > ${asOf}
      )
    ORDER BY plan_id ASC, billing_cycle ASC, active_from DESC
  `) as BillingPriceRow[];

  return rows.map(mapBillingPriceRow);
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

  return rows[0] ? mapBillingWebhookEventRow(rows[0]) : null;
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

  return rows[0] ? mapBillingWebhookEventRow(rows[0]) : null;
}

export type {
  BillingPriceRow,
  BillingSubscriptionRow,
  BillingWebhookEventRow,
  BillingSubscriptionMutation,
  BillingCycle,
  BillingInvoiceStatus,
  BillingInvoiceType,
  BillingPaymentMethodType,
  BillingPlanId,
  BillingSubscriptionChangeStatus,
  BillingSubscriptionChangeType,
  BillingSubscriptionStatus,
};

function mapBillingPriceRow(row: BillingPriceRow): BillingPrice {
  return {
    id: row.id,
    planId: row.plan_id,
    billingCycle: row.billing_cycle,
    amountCents: row.amount_cents,
    currency: row.currency,
    activeFrom: row.active_from,
    activeUntil: row.active_until,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapBillingSubscriptionRow(row: BillingSubscriptionRow): BillingSubscription {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    planId: row.plan_id,
    billingCycle: row.billing_cycle,
    priceId: row.price_id,
    status: row.status,
    autoRenew: row.auto_renew,
    currentPeriodStart: row.current_period_start,
    currentPeriodEnd: row.current_period_end,
    gracePeriodEndsAt: row.grace_period_ends_at,
    cancelAtPeriodEnd: row.cancel_at_period_end,
    cancelRequestedAt: row.cancel_requested_at,
    endedAt: row.ended_at,
    accessUntil: row.access_until,
    provider: row.provider,
    providerSubscriptionId: row.provider_subscription_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapBillingWebhookEventRow(row: BillingWebhookEventRow): BillingWebhookEvent {
  return {
    id: row.id,
    provider: row.provider,
    providerEventId: row.provider_event_id,
    eventType: row.event_type,
    resourceId: row.resource_id,
    payloadHash: row.payload_hash,
    status: row.status,
    attempts: row.attempts,
    receivedAt: row.received_at,
    processedAt: row.processed_at,
    errorCode: row.error_code,
    errorMessage: row.error_message,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function resolvePatchedValue<TKey extends keyof BillingSubscriptionMutation>(
  mutation: BillingSubscriptionMutation,
  key: TKey,
  currentValue: BillingSubscriptionMutation[TKey],
): BillingSubscriptionMutation[TKey] {
  return Object.hasOwn(mutation, key) ? mutation[key] : currentValue;
}
