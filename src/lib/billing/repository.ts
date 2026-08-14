import "server-only";

import { randomUUID } from "node:crypto";
import { getSql } from "@/lib/server/neon";
import { ensurePlatformReady } from "@/lib/server/platform";
import {
  currentBillingSubscriptionStatuses,
  type BillingInvoice,
  type BillingPrice,
  type BillingSubscription,
  type BillingSubscriptionChange,
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

type BillingInvoiceMutation = Partial<
  Pick<
    BillingInvoice,
    | "priceId"
    | "type"
    | "status"
    | "amountCents"
    | "currency"
    | "periodStart"
    | "periodEnd"
    | "paymentMethod"
    | "provider"
    | "providerPaymentId"
    | "providerAuthorizedPaymentId"
    | "paymentExpiresAt"
    | "paidAt"
    | "failedAt"
    | "refundedAt"
  >
>;

type BillingInvoiceRow = {
  id: string;
  subscription_id: string;
  workspace_id: string;
  price_id: string | null;
  type: BillingInvoiceType;
  status: BillingInvoiceStatus;
  amount_cents: number;
  currency: string;
  period_start: string | null;
  period_end: string | null;
  payment_method: BillingPaymentMethodType | null;
  provider: BillingProviderName | null;
  provider_payment_id: string | null;
  provider_authorized_payment_id: string | null;
  payment_expires_at: string | null;
  paid_at: string | null;
  failed_at: string | null;
  refunded_at: string | null;
  created_at: string;
  updated_at: string;
};

type BillingSubscriptionChangeMutation = Partial<
  Pick<
    BillingSubscriptionChange,
    "status" | "appliedAt" | "canceledAt" | "invoiceId"
  >
>;

type BillingSubscriptionChangeRow = {
  id: string;
  subscription_id: string;
  workspace_id: string;
  type: BillingSubscriptionChangeType;
  status: BillingSubscriptionChangeStatus;
  from_plan_id: BillingPlanId | null;
  to_plan_id: BillingPlanId | null;
  from_billing_cycle: BillingCycle | null;
  to_billing_cycle: BillingCycle | null;
  effective_at: string;
  credit_amount_cents: number;
  charge_amount_cents: number;
  invoice_id: string | null;
  requested_by_type: string | null;
  requested_by_id: string | null;
  created_at: string;
  applied_at: string | null;
  canceled_at: string | null;
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

export async function listBillingSubscriptionsForExpiration(asOf: string) {
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
    WHERE status = 'active'
      AND auto_renew = FALSE
      AND current_period_end IS NOT NULL
      AND current_period_end <= ${asOf}
    ORDER BY current_period_end ASC
  `) as BillingSubscriptionRow[];

  return rows.map(mapBillingSubscriptionRow);
}

export async function listBillingSubscriptionsForGracePeriodEnd(asOf: string) {
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
    WHERE status = 'past_due'
      AND grace_period_ends_at IS NOT NULL
      AND grace_period_ends_at <= ${asOf}
    ORDER BY grace_period_ends_at ASC
  `) as BillingSubscriptionRow[];

  return rows.map(mapBillingSubscriptionRow);
}

export async function listBillingSubscriptionsForScheduledCancellation(asOf: string) {
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
    WHERE status = 'scheduled_cancel'
      AND current_period_end IS NOT NULL
      AND current_period_end <= ${asOf}
    ORDER BY current_period_end ASC
  `) as BillingSubscriptionRow[];

  return rows.map(mapBillingSubscriptionRow);
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

export async function listAbandonedPendingBillingSubscriptions(input: {
  asOf: string;
  startedBefore: string;
}) {
  await ensurePlatformReady();

  const sql = getSql();
  const rows = (await sql`
    SELECT
      s.id,
      s.workspace_id,
      s.plan_id,
      s.billing_cycle,
      s.price_id,
      s.status,
      s.auto_renew,
      s.current_period_start,
      s.current_period_end,
      s.grace_period_ends_at,
      s.cancel_at_period_end,
      s.cancel_requested_at,
      s.ended_at,
      s.access_until,
      s.provider,
      s.provider_subscription_id,
      s.created_at,
      s.updated_at
    FROM billing_subscriptions s
    WHERE s.status = 'pending'
      AND s.created_at <= ${input.startedBefore}
      AND NOT EXISTS (
        SELECT 1
        FROM billing_invoices i
        WHERE i.subscription_id = s.id
          AND i.status = 'pending'
          AND (
            i.payment_expires_at IS NULL
            OR i.payment_expires_at > ${input.asOf}
          )
      )
    ORDER BY s.created_at ASC
  `) as BillingSubscriptionRow[];

  return rows.map(mapBillingSubscriptionRow);
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

export async function getBillingPriceById(priceId: string) {
  await ensurePlatformReady();

  const sql = getSql();
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
    WHERE id = ${priceId}
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

export async function getBillingInvoiceById(invoiceId: string) {
  await ensurePlatformReady();

  const sql = getSql();
  const rows = (await sql`
    SELECT
      id,
      subscription_id,
      workspace_id,
      price_id,
      type,
      status,
      amount_cents,
      currency,
      period_start,
      period_end,
      payment_method,
      provider,
      provider_payment_id,
      provider_authorized_payment_id,
      payment_expires_at,
      paid_at,
      failed_at,
      refunded_at,
      created_at,
      updated_at
    FROM billing_invoices
    WHERE id = ${invoiceId}
    LIMIT 1
  `) as BillingInvoiceRow[];

  return rows[0] ? mapBillingInvoiceRow(rows[0]) : null;
}

export async function findLatestPendingBillingInvoiceForSubscription(input: {
  subscriptionId: string;
  paymentMethod?: BillingPaymentMethodType | null;
  type?: BillingInvoiceType | null;
}) {
  await ensurePlatformReady();

  const sql = getSql();
  const rows = (await sql`
    SELECT
      id,
      subscription_id,
      workspace_id,
      price_id,
      type,
      status,
      amount_cents,
      currency,
      period_start,
      period_end,
      payment_method,
      provider,
      provider_payment_id,
      provider_authorized_payment_id,
      payment_expires_at,
      paid_at,
      failed_at,
      refunded_at,
      created_at,
      updated_at
    FROM billing_invoices
    WHERE subscription_id = ${input.subscriptionId}
      AND status = 'pending'
      AND (
        ${input.paymentMethod ?? null}::text IS NULL
        OR payment_method = ${input.paymentMethod ?? null}
      )
      AND (
        ${input.type ?? null}::text IS NULL
        OR type = ${input.type ?? null}
      )
    ORDER BY created_at DESC
    LIMIT 1
  `) as BillingInvoiceRow[];

  return rows[0] ? mapBillingInvoiceRow(rows[0]) : null;
}

export async function findBillingInvoiceByProviderPaymentId(input: {
  provider: BillingProviderName;
  providerPaymentId: string;
}) {
  await ensurePlatformReady();

  const sql = getSql();
  const rows = (await sql`
    SELECT
      id,
      subscription_id,
      workspace_id,
      price_id,
      type,
      status,
      amount_cents,
      currency,
      period_start,
      period_end,
      payment_method,
      provider,
      provider_payment_id,
      provider_authorized_payment_id,
      payment_expires_at,
      paid_at,
      failed_at,
      refunded_at,
      created_at,
      updated_at
    FROM billing_invoices
    WHERE provider = ${input.provider}
      AND provider_payment_id = ${input.providerPaymentId}
    LIMIT 1
  `) as BillingInvoiceRow[];

  return rows[0] ? mapBillingInvoiceRow(rows[0]) : null;
}

export async function listBillingInvoicesForExpiration(asOf: string) {
  await ensurePlatformReady();

  const sql = getSql();
  const rows = (await sql`
    SELECT
      id,
      subscription_id,
      workspace_id,
      price_id,
      type,
      status,
      amount_cents,
      currency,
      period_start,
      period_end,
      payment_method,
      provider,
      provider_payment_id,
      provider_authorized_payment_id,
      payment_expires_at,
      paid_at,
      failed_at,
      refunded_at,
      created_at,
      updated_at
    FROM billing_invoices
    WHERE status = 'pending'
      AND payment_method = 'pix_manual'
      AND payment_expires_at IS NOT NULL
      AND payment_expires_at <= ${asOf}
    ORDER BY payment_expires_at ASC
  `) as BillingInvoiceRow[];

  return rows.map(mapBillingInvoiceRow);
}

export async function createBillingInvoice(input: {
  subscriptionId: string;
  workspaceId: string;
  priceId?: string | null;
  type: BillingInvoiceType;
  status: BillingInvoiceStatus;
  amountCents: number;
  currency?: string;
  periodStart?: string | null;
  periodEnd?: string | null;
  paymentMethod?: BillingPaymentMethodType | null;
  provider?: BillingProviderName | null;
  providerPaymentId?: string | null;
  providerAuthorizedPaymentId?: string | null;
  paymentExpiresAt?: string | null;
  paidAt?: string | null;
  failedAt?: string | null;
  refundedAt?: string | null;
}) {
  await ensurePlatformReady();

  const sql = getSql();
  const rows = (await sql`
    INSERT INTO billing_invoices (
      id,
      subscription_id,
      workspace_id,
      price_id,
      type,
      status,
      amount_cents,
      currency,
      period_start,
      period_end,
      payment_method,
      provider,
      provider_payment_id,
      provider_authorized_payment_id,
      payment_expires_at,
      paid_at,
      failed_at,
      refunded_at,
      created_at,
      updated_at
    )
    VALUES (
      ${randomUUID()},
      ${input.subscriptionId},
      ${input.workspaceId},
      ${input.priceId ?? null},
      ${input.type},
      ${input.status},
      ${input.amountCents},
      ${input.currency ?? "BRL"},
      ${input.periodStart ?? null},
      ${input.periodEnd ?? null},
      ${input.paymentMethod ?? null},
      ${input.provider ?? null},
      ${input.providerPaymentId ?? null},
      ${input.providerAuthorizedPaymentId ?? null},
      ${input.paymentExpiresAt ?? null},
      ${input.paidAt ?? null},
      ${input.failedAt ?? null},
      ${input.refundedAt ?? null},
      NOW(),
      NOW()
    )
    RETURNING
      id,
      subscription_id,
      workspace_id,
      price_id,
      type,
      status,
      amount_cents,
      currency,
      period_start,
      period_end,
      payment_method,
      provider,
      provider_payment_id,
      provider_authorized_payment_id,
      payment_expires_at,
      paid_at,
      failed_at,
      refunded_at,
      created_at,
      updated_at
  `) as BillingInvoiceRow[];

  return rows[0] ? mapBillingInvoiceRow(rows[0]) : null;
}

export async function updateBillingInvoice(
  invoiceId: string,
  mutation: BillingInvoiceMutation,
) {
  await ensurePlatformReady();

  const currentInvoice = await getBillingInvoiceById(invoiceId);

  if (!currentInvoice) {
    return null;
  }

  const sql = getSql();
  const rows = (await sql`
    UPDATE billing_invoices
    SET
      price_id = ${resolvePatchedValue(mutation, "priceId", currentInvoice.priceId)},
      type = ${resolvePatchedValue(mutation, "type", currentInvoice.type)},
      status = ${resolvePatchedValue(mutation, "status", currentInvoice.status)},
      amount_cents = ${resolvePatchedValue(mutation, "amountCents", currentInvoice.amountCents)},
      currency = ${resolvePatchedValue(mutation, "currency", currentInvoice.currency)},
      period_start = ${resolvePatchedValue(
        mutation,
        "periodStart",
        currentInvoice.periodStart,
      )},
      period_end = ${resolvePatchedValue(
        mutation,
        "periodEnd",
        currentInvoice.periodEnd,
      )},
      payment_method = ${resolvePatchedValue(
        mutation,
        "paymentMethod",
        currentInvoice.paymentMethod,
      )},
      provider = ${resolvePatchedValue(mutation, "provider", currentInvoice.provider)},
      provider_payment_id = ${resolvePatchedValue(
        mutation,
        "providerPaymentId",
        currentInvoice.providerPaymentId,
      )},
      provider_authorized_payment_id = ${resolvePatchedValue(
        mutation,
        "providerAuthorizedPaymentId",
        currentInvoice.providerAuthorizedPaymentId,
      )},
      payment_expires_at = ${resolvePatchedValue(
        mutation,
        "paymentExpiresAt",
        currentInvoice.paymentExpiresAt,
      )},
      paid_at = ${resolvePatchedValue(mutation, "paidAt", currentInvoice.paidAt)},
      failed_at = ${resolvePatchedValue(mutation, "failedAt", currentInvoice.failedAt)},
      refunded_at = ${resolvePatchedValue(
        mutation,
        "refundedAt",
        currentInvoice.refundedAt,
      )},
      updated_at = NOW()
    WHERE id = ${invoiceId}
    RETURNING
      id,
      subscription_id,
      workspace_id,
      price_id,
      type,
      status,
      amount_cents,
      currency,
      period_start,
      period_end,
      payment_method,
      provider,
      provider_payment_id,
      provider_authorized_payment_id,
      payment_expires_at,
      paid_at,
      failed_at,
      refunded_at,
      created_at,
      updated_at
  `) as BillingInvoiceRow[];

  return rows[0] ? mapBillingInvoiceRow(rows[0]) : null;
}

export async function getDueBillingSubscriptionChanges(asOf: string) {
  await ensurePlatformReady();

  const sql = getSql();
  const rows = (await sql`
    SELECT
      id,
      subscription_id,
      workspace_id,
      type,
      status,
      from_plan_id,
      to_plan_id,
      from_billing_cycle,
      to_billing_cycle,
      effective_at,
      credit_amount_cents,
      charge_amount_cents,
      invoice_id,
      requested_by_type,
      requested_by_id,
      created_at,
      applied_at,
      canceled_at
    FROM billing_subscription_changes
    WHERE status = 'scheduled'
      AND effective_at <= ${asOf}
    ORDER BY effective_at ASC
  `) as BillingSubscriptionChangeRow[];

  return rows.map(mapBillingSubscriptionChangeRow);
}

export async function getBillingSubscriptionChangeById(changeId: string) {
  await ensurePlatformReady();

  const sql = getSql();
  const rows = (await sql`
    SELECT
      id,
      subscription_id,
      workspace_id,
      type,
      status,
      from_plan_id,
      to_plan_id,
      from_billing_cycle,
      to_billing_cycle,
      effective_at,
      credit_amount_cents,
      charge_amount_cents,
      invoice_id,
      requested_by_type,
      requested_by_id,
      created_at,
      applied_at,
      canceled_at
    FROM billing_subscription_changes
    WHERE id = ${changeId}
    LIMIT 1
  `) as BillingSubscriptionChangeRow[];

  return rows[0] ? mapBillingSubscriptionChangeRow(rows[0]) : null;
}

export async function getBillingSubscriptionChangeByInvoiceId(invoiceId: string) {
  await ensurePlatformReady();

  const sql = getSql();
  const rows = (await sql`
    SELECT
      id,
      subscription_id,
      workspace_id,
      type,
      status,
      from_plan_id,
      to_plan_id,
      from_billing_cycle,
      to_billing_cycle,
      effective_at,
      credit_amount_cents,
      charge_amount_cents,
      invoice_id,
      requested_by_type,
      requested_by_id,
      created_at,
      applied_at,
      canceled_at
    FROM billing_subscription_changes
    WHERE invoice_id = ${invoiceId}
    LIMIT 1
  `) as BillingSubscriptionChangeRow[];

  return rows[0] ? mapBillingSubscriptionChangeRow(rows[0]) : null;
}

export async function createBillingSubscriptionChange(input: {
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
}) {
  await ensurePlatformReady();

  const sql = getSql();
  const rows = (await sql`
    INSERT INTO billing_subscription_changes (
      id,
      subscription_id,
      workspace_id,
      type,
      status,
      from_plan_id,
      to_plan_id,
      from_billing_cycle,
      to_billing_cycle,
      effective_at,
      credit_amount_cents,
      charge_amount_cents,
      invoice_id,
      requested_by_type,
      requested_by_id
    )
    VALUES (
      ${randomUUID()},
      ${input.subscriptionId},
      ${input.workspaceId},
      ${input.type},
      ${input.status},
      ${input.fromPlanId ?? null},
      ${input.toPlanId ?? null},
      ${input.fromBillingCycle ?? null},
      ${input.toBillingCycle ?? null},
      ${input.effectiveAt},
      ${input.creditAmountCents ?? 0},
      ${input.chargeAmountCents ?? 0},
      ${input.invoiceId ?? null},
      ${input.requestedByType ?? null},
      ${input.requestedById ?? null}
    )
    RETURNING
      id,
      subscription_id,
      workspace_id,
      type,
      status,
      from_plan_id,
      to_plan_id,
      from_billing_cycle,
      to_billing_cycle,
      effective_at,
      credit_amount_cents,
      charge_amount_cents,
      invoice_id,
      requested_by_type,
      requested_by_id,
      created_at,
      applied_at,
      canceled_at
  `) as BillingSubscriptionChangeRow[];

  return rows[0] ? mapBillingSubscriptionChangeRow(rows[0]) : null;
}

export async function findLatestOpenBillingSubscriptionChange(input: {
  subscriptionId: string;
  type?: BillingSubscriptionChangeType;
}) {
  await ensurePlatformReady();

  const sql = getSql();
  const rows = (await sql`
    SELECT
      id,
      subscription_id,
      workspace_id,
      type,
      status,
      from_plan_id,
      to_plan_id,
      from_billing_cycle,
      to_billing_cycle,
      effective_at,
      credit_amount_cents,
      charge_amount_cents,
      invoice_id,
      requested_by_type,
      requested_by_id,
      created_at,
      applied_at,
      canceled_at
    FROM billing_subscription_changes
    WHERE subscription_id = ${input.subscriptionId}
      AND status IN ('pending_payment', 'scheduled')
      AND (
        ${input.type ?? null}::TEXT IS NULL
        OR type = ${input.type ?? null}
      )
    ORDER BY created_at DESC
    LIMIT 1
  `) as BillingSubscriptionChangeRow[];

  return rows[0] ? mapBillingSubscriptionChangeRow(rows[0]) : null;
}

export async function updateBillingSubscriptionChange(
  changeId: string,
  mutation: BillingSubscriptionChangeMutation,
) {
  await ensurePlatformReady();

  const currentChange = await getBillingSubscriptionChangeById(changeId);

  if (!currentChange) {
    return null;
  }

  const sql = getSql();
  const rows = (await sql`
    UPDATE billing_subscription_changes
    SET
      status = ${resolvePatchedValue(mutation, "status", currentChange.status)},
      invoice_id = ${resolvePatchedValue(mutation, "invoiceId", currentChange.invoiceId)},
      applied_at = ${resolvePatchedValue(mutation, "appliedAt", currentChange.appliedAt)},
      canceled_at = ${resolvePatchedValue(
        mutation,
        "canceledAt",
        currentChange.canceledAt,
      )}
    WHERE id = ${changeId}
    RETURNING
      id,
      subscription_id,
      workspace_id,
      type,
      status,
      from_plan_id,
      to_plan_id,
      from_billing_cycle,
      to_billing_cycle,
      effective_at,
      credit_amount_cents,
      charge_amount_cents,
      invoice_id,
      requested_by_type,
      requested_by_id,
      created_at,
      applied_at,
      canceled_at
  `) as BillingSubscriptionChangeRow[];

  return rows[0] ? mapBillingSubscriptionChangeRow(rows[0]) : null;
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

export async function listFailedBillingWebhookEvents(limit = 50) {
  await ensurePlatformReady();

  const sql = getSql();
  const rows = (await sql`
    SELECT
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
    FROM billing_webhook_events
    WHERE status = 'failed'
    ORDER BY updated_at DESC
    LIMIT ${limit}
  `) as BillingWebhookEventRow[];

  return rows.map(mapBillingWebhookEventRow);
}

export type {
  BillingPriceRow,
  BillingInvoiceRow,
  BillingSubscriptionRow,
  BillingSubscriptionChangeRow,
  BillingWebhookEventRow,
  BillingInvoiceMutation,
  BillingSubscriptionChangeMutation,
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

function mapBillingInvoiceRow(row: BillingInvoiceRow): BillingInvoice {
  return {
    id: row.id,
    subscriptionId: row.subscription_id,
    workspaceId: row.workspace_id,
    priceId: row.price_id,
    type: row.type,
    status: row.status,
    amountCents: row.amount_cents,
    currency: row.currency,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    paymentMethod: row.payment_method,
    provider: row.provider,
    providerPaymentId: row.provider_payment_id,
    providerAuthorizedPaymentId: row.provider_authorized_payment_id,
    paymentExpiresAt: row.payment_expires_at,
    paidAt: row.paid_at,
    failedAt: row.failed_at,
    refundedAt: row.refunded_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapBillingSubscriptionChangeRow(
  row: BillingSubscriptionChangeRow,
): BillingSubscriptionChange {
  return {
    id: row.id,
    subscriptionId: row.subscription_id,
    workspaceId: row.workspace_id,
    type: row.type,
    status: row.status,
    fromPlanId: row.from_plan_id,
    toPlanId: row.to_plan_id,
    fromBillingCycle: row.from_billing_cycle,
    toBillingCycle: row.to_billing_cycle,
    effectiveAt: row.effective_at,
    creditAmountCents: row.credit_amount_cents,
    chargeAmountCents: row.charge_amount_cents,
    invoiceId: row.invoice_id,
    requestedByType: row.requested_by_type,
    requestedById: row.requested_by_id,
    createdAt: row.created_at,
    appliedAt: row.applied_at,
    canceledAt: row.canceled_at,
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

function resolvePatchedValue<
  TMutation extends Record<string, unknown>,
  TKey extends keyof TMutation,
>(
  mutation: TMutation,
  key: TKey,
  currentValue: TMutation[TKey],
): TMutation[TKey] {
  return Object.hasOwn(mutation, key) ? mutation[key] : currentValue;
}
