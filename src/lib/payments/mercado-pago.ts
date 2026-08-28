import {
  getWorkspacePlan,
  resolveWorkspacePlanPrice,
  type WorkspacePlanId,
} from "../workspace/catalog.ts";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import type { BillingCycle } from "../billing/types.ts";

export type MercadoPagoWebhookTopic =
  | "subscription_preapproval"
  | "subscription_authorized_payment"
  | "subscription_preapproval_plan"
  | "payment";

export type MercadoPagoWebhookPayload = {
  id?: string | number;
  live_mode?: boolean;
  type?: string;
  action?: string;
  api_version?: string;
  date_created?: string;
  user_id?: string | number;
  data?: {
    id?: string | number;
  };
};

export type MercadoPagoEnvironment = "test" | "production";

export type MercadoPagoCredentials = {
  environment: MercadoPagoEnvironment;
  accessToken: string;
  liveMode: boolean;
};

export class MercadoPagoConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MercadoPagoConfigurationError";
  }
}

export type MercadoPagoSubscription = {
  id: string;
  preapproval_plan_id?: string | null;
  status?: string | null;
  external_reference?: string | number | null;
  back_url?: string | null;
  reason?: string | null;
  payer_email?: string | null;
  init_point?: string | null;
};

export type MercadoPagoAuthorizedPayment = {
  id: number;
  preapproval_id?: string | null;
  external_reference?: string | number | null;
  status?: string | null;
  payment_method_id?: string | null;
  date_approved?: string | null;
  payment?: {
    id?: number | string | null;
    status?: string | null;
    status_detail?: string | null;
    payment_method_id?: string | null;
    date_approved?: string | null;
  } | null;
};

export type MercadoPagoPayment = {
  id: number | string;
  status?: string | null;
  status_detail?: string | null;
  external_reference?: string | number | null;
  date_of_expiration?: string | null;
  date_approved?: string | null;
  payment_method_id?: string | null;
  point_of_interaction?: {
    transaction_data?: {
      qr_code?: string | null;
      qr_code_base64?: string | null;
      ticket_url?: string | null;
    } | null;
  } | null;
};

export type MercadoPagoTestUser = {
  id: number;
  nickname: string;
  password: string;
  site_status?: string | null;
  site_id?: string | null;
  description?: string | null;
  email?: string | null;
};

export type MercadoPagoSubscriptionCheckoutPayload = {
  payer_email: string;
  external_reference: string;
  reason: string;
  back_url: string;
  auto_recurring: {
    frequency: number;
    frequency_type: "months";
    end_date: string;
    transaction_amount: number;
    currency_id: "BRL";
  };
  status: "pending";
};

export type MercadoPagoPixPaymentPayload = {
  transaction_amount: number;
  description: string;
  payment_method_id: "pix";
  external_reference: string;
  payer: {
    email: string;
  };
  date_of_expiration: string;
  notification_url?: string;
};

export type NormalizedMercadoPagoSubscriptionStatus =
  | "pending"
  | "active"
  | "paused"
  | "canceled"
  | "unknown";

export type MercadoPagoCheckoutAction =
  | "create_new_checkout"
  | "resume_pending_checkout"
  | "block_active_subscription"
  | "block_paused_subscription";

export type PendingSubscriptionRecoveryDecision =
  | {
      type: "resume_checkout";
      initPoint: string;
      remoteStatus: "pending";
    }
  | {
      type: "missing_init_point";
      remoteStatus: "pending";
    }
  | {
      type: "sync_local_status";
      nextStatus: "active" | "paused";
      remoteStatus: "active" | "paused";
    }
  | {
      type: "allow_new_checkout";
      nextStatus: "unpaid" | "canceled";
      clearSubscriptionId: boolean;
      remoteStatus: "not_found" | "canceled";
    }
  | {
      type: "unrecoverable_status";
      remoteStatus: "unknown";
    };

export class MercadoPagoApiError extends Error {
  status: number;
  path: string;
  responseText: string;
  requestId: string | null;

  constructor(input: {
    status: number;
    path: string;
    responseText: string;
    requestId?: string | null;
    mode: "request" | "mutation";
  }) {
    super(
      `Mercado Pago API ${input.mode} failed (${input.status}) for ${input.path}: ${
        input.responseText || "empty response"
      }${input.requestId ? ` · mpRequestId ${input.requestId}` : ""}`,
    );
    this.name = "MercadoPagoApiError";
    this.status = input.status;
    this.path = input.path;
    this.responseText = input.responseText;
    this.requestId = input.requestId ?? null;
  }
}

export function resolveMercadoPagoEnvironment(
  environmentValue = process.env.MERCADO_PAGO_ENVIRONMENT,
): MercadoPagoEnvironment {
  const normalized = environmentValue?.trim().toLowerCase();

  // Preserve existing production deployments until they explicitly configure it.
  if (!normalized) {
    return "production";
  }

  if (normalized === "test" || normalized === "production") {
    return normalized;
  }

  throw new MercadoPagoConfigurationError(
    "MERCADO_PAGO_ENVIRONMENT must be either test or production.",
  );
}

export function resolveMercadoPagoCredentials(input: {
  environment?: MercadoPagoEnvironment;
  environmentValue?: string;
  accessToken?: string;
  testAccessToken?: string;
} = {}): MercadoPagoCredentials {
  const environment =
    input.environment ?? resolveMercadoPagoEnvironment(input.environmentValue);
  const accessToken =
    (environment === "test" ? input.testAccessToken : input.accessToken) ??
    (environment === "test"
      ? process.env.MERCADO_PAGO_TEST_ACCESS_TOKEN
      : process.env.MERCADO_PAGO_ACCESS_TOKEN);
  const normalizedAccessToken = accessToken?.trim() ?? "";

  if (!normalizedAccessToken) {
    throw new MercadoPagoConfigurationError(
      environment === "test"
        ? "Mercado Pago test environment requires MERCADO_PAGO_TEST_ACCESS_TOKEN."
        : "Mercado Pago production environment requires MERCADO_PAGO_ACCESS_TOKEN.",
    );
  }

  return {
    environment,
    accessToken: normalizedAccessToken,
    liveMode: environment === "production",
  };
}

export function resolveMercadoPagoAccessToken(input?: {
  environment?: MercadoPagoEnvironment;
}) {
  return resolveMercadoPagoCredentials(input).accessToken;
}

export function getMercadoPagoAccessToken() {
  return resolveMercadoPagoAccessToken();
}

export function getMercadoPagoTestAccessToken() {
  return resolveMercadoPagoCredentials({ environment: "test" }).accessToken;
}

export function getMercadoPagoTestSiteId() {
  return process.env.MERCADO_PAGO_TEST_SITE_ID?.trim() || "MLB";
}

export function getMercadoPagoWebhookSecret() {
  return process.env.MERCADO_PAGO_WEBHOOK_SECRET?.trim() ?? "";
}

export async function getMercadoPagoSubscription(subscriptionId: string) {
  return mercadoPagoApiRequest<MercadoPagoSubscription>(`/preapproval/${subscriptionId}`);
}

export async function getMercadoPagoSubscriptionWithToken(
  subscriptionId: string,
  accessTokenOverride: string,
) {
  return mercadoPagoApiRequest<MercadoPagoSubscription>(
    `/preapproval/${subscriptionId}`,
    accessTokenOverride,
  );
}

export async function getMercadoPagoAuthorizedPayment(authorizedPaymentId: string) {
  return mercadoPagoApiRequest<MercadoPagoAuthorizedPayment>(
    `/authorized_payments/${authorizedPaymentId}`,
  );
}

export async function getMercadoPagoAuthorizedPaymentWithToken(
  authorizedPaymentId: string,
  accessTokenOverride: string,
) {
  return mercadoPagoApiRequest<MercadoPagoAuthorizedPayment>(
    `/authorized_payments/${authorizedPaymentId}`,
    accessTokenOverride,
  );
}

export async function getMercadoPagoPayment(paymentId: string) {
  return mercadoPagoApiRequest<MercadoPagoPayment>(`/v1/payments/${paymentId}`);
}

export async function getMercadoPagoPaymentWithToken(
  paymentId: string,
  accessTokenOverride: string,
) {
  return mercadoPagoApiRequest<MercadoPagoPayment>(
    `/v1/payments/${paymentId}`,
    accessTokenOverride,
  );
}

export async function createMercadoPagoSubscriptionCheckout(input: {
  planId: WorkspacePlanId;
  billingCycle: BillingCycle;
  payerEmail: string;
  workspaceId: string;
  reason: string;
  backUrl: string;
  accessTokenOverride?: string;
}) {
  return mercadoPagoApiMutation<MercadoPagoSubscription>(
    "/preapproval",
    buildMercadoPagoSubscriptionCheckoutPayload(input),
    input.accessTokenOverride,
  );
}

export async function createMercadoPagoRecurringSubscription(input: {
  externalReference: string;
  payerEmail: string;
  reason: string;
  returnUrl: string;
  amountCents: number;
  currency: string;
  billingCycle: BillingCycle;
  accessTokenOverride?: string;
}) {
  return mercadoPagoApiMutation<MercadoPagoSubscription>(
    "/preapproval",
    buildMercadoPagoRecurringSubscriptionPayload(input),
    input.accessTokenOverride,
  );
}

export async function createMercadoPagoPixPayment(input: {
  externalReference: string;
  idempotencyKey: string;
  payerEmail: string | null;
  reason: string;
  amountCents: number;
  currency: string;
  expiresInMinutes?: number;
  notificationUrl?: string;
  accessTokenOverride?: string;
}) {
  return mercadoPagoApiMutation<MercadoPagoPayment>(
    "/v1/payments",
    buildMercadoPagoPixPaymentPayload(input),
    input.accessTokenOverride,
    "POST",
    input.idempotencyKey,
  );
}

export function buildMercadoPagoSubscriptionCheckoutPayload(input: {
  planId: WorkspacePlanId;
  billingCycle: BillingCycle;
  payerEmail: string;
  workspaceId: string;
  reason: string;
  backUrl: string;
  now?: Date;
}): MercadoPagoSubscriptionCheckoutPayload {
  const plan = getWorkspacePlan(input.planId);
  const amount = resolveWorkspacePlanPrice(plan, input.billingCycle);

  if (typeof amount !== "number" || !Number.isFinite(amount)) {
    throw new Error(
      `Não foi possível resolver o valor ${input.billingCycle === "annual" ? "anual" : "mensal"} do plano ${input.planId} para criar a assinatura.`,
    );
  }

  return buildMercadoPagoRecurringSubscriptionPayload({
    externalReference: `workspace:${input.workspaceId}`,
    payerEmail: input.payerEmail,
    reason: input.reason,
    returnUrl: input.backUrl,
    amountCents: Math.round(amount * 100),
    currency: "BRL",
    billingCycle: input.billingCycle,
    now: input.now,
  });
}

export function buildMercadoPagoRecurringSubscriptionPayload(input: {
  externalReference: string;
  payerEmail: string;
  reason: string;
  returnUrl: string;
  amountCents: number;
  currency: string;
  billingCycle: BillingCycle;
  now?: Date;
}): MercadoPagoSubscriptionCheckoutPayload {
  if (input.currency !== "BRL") {
    throw new Error(
      `Mercado Pago recurring subscriptions currently support only BRL. Received ${input.currency}.`,
    );
  }

  if (!Number.isFinite(input.amountCents) || input.amountCents <= 0) {
    throw new Error(
      `Mercado Pago recurring subscriptions require a positive amountCents value. Received ${input.amountCents}.`,
    );
  }

  const endDate = new Date(input.now ?? new Date());
  endDate.setFullYear(endDate.getFullYear() + 5);

  return {
    payer_email: input.payerEmail,
    external_reference: input.externalReference,
    reason: input.reason,
    back_url: input.returnUrl,
    auto_recurring: {
      frequency: resolveMercadoPagoRecurringFrequency(input.billingCycle),
      frequency_type: "months",
      end_date: endDate.toISOString(),
      transaction_amount: Number((input.amountCents / 100).toFixed(2)),
      currency_id: "BRL",
    },
    status: "pending",
  };
}

export function buildMercadoPagoPixPaymentPayload(input: {
  externalReference: string;
  payerEmail: string | null;
  reason: string;
  amountCents: number;
  currency: string;
  expiresInMinutes?: number;
  notificationUrl?: string;
  now?: Date;
}): MercadoPagoPixPaymentPayload {
  const payerEmail = normalizeOptionalString(input.payerEmail);

  if (!payerEmail) {
    throw new Error(
      "Mercado Pago manual Pix payments require a payer email.",
    );
  }

  if (input.currency !== "BRL") {
    throw new Error(
      `Mercado Pago Pix payments currently support only BRL. Received ${input.currency}.`,
    );
  }

  if (!Number.isFinite(input.amountCents) || input.amountCents <= 0) {
    throw new Error(
      `Mercado Pago Pix payments require a positive amountCents value. Received ${input.amountCents}.`,
    );
  }

  const expirationDate = new Date(input.now ?? new Date());
  expirationDate.setMinutes(
    expirationDate.getMinutes() + Math.max(15, input.expiresInMinutes ?? 60),
  );

  return {
    transaction_amount: Number((input.amountCents / 100).toFixed(2)),
    description: input.reason,
    payment_method_id: "pix",
    external_reference: input.externalReference,
    payer: {
      email: payerEmail,
    },
    date_of_expiration: expirationDate.toISOString(),
    ...(input.notificationUrl
      ? { notification_url: input.notificationUrl }
      : {}),
  };
}

export async function updateMercadoPagoSubscriptionStatus(input: {
  subscriptionId: string;
  status: "authorized" | "paused" | "canceled";
  accessTokenOverride?: string;
}) {
  return mercadoPagoApiMutation<MercadoPagoSubscription>(
    `/preapproval/${input.subscriptionId}`,
    {
      status: input.status,
    },
    input.accessTokenOverride,
    "PUT",
  );
}

export async function updateMercadoPagoSubscriptionAmount(input: {
  subscriptionId: string;
  amountCents: number;
  currency: string;
  billingCycle: BillingCycle;
  accessTokenOverride?: string;
}) {
  if (input.currency !== "BRL") {
    throw new Error(
      `Mercado Pago recurring subscription amount updates currently support only BRL. Received ${input.currency}.`,
    );
  }

  if (!Number.isFinite(input.amountCents) || input.amountCents <= 0) {
    throw new Error(
      `Mercado Pago recurring subscription amount updates require a positive amountCents value. Received ${input.amountCents}.`,
    );
  }

  return mercadoPagoApiMutation<MercadoPagoSubscription>(
    `/preapproval/${input.subscriptionId}`,
    {
      auto_recurring: {
        frequency: resolveMercadoPagoRecurringFrequency(input.billingCycle),
        frequency_type: "months",
        transaction_amount: Number((input.amountCents / 100).toFixed(2)),
        currency_id: "BRL",
      },
    },
    input.accessTokenOverride,
    "PUT",
  );
}

function resolveMercadoPagoRecurringFrequency(billingCycle: BillingCycle) {
  return billingCycle === "annual" ? 12 : 1;
}

export async function createMercadoPagoTestUser(input: { description: string }) {
  const accessToken = getMercadoPagoTestAccessToken();

  if (!accessToken) {
    throw new Error(
      "MERCADO_PAGO_TEST_ACCESS_TOKEN is required to criar comprador de teste do Mercado Pago.",
    );
  }

  return mercadoPagoApiMutation<MercadoPagoTestUser>(
    "/users/test",
    {
      site_id: getMercadoPagoTestSiteId(),
      description: input.description,
    },
    accessToken,
  );
}

export function resolveMercadoPagoTestUserEmail(testUser: {
  id: number;
  email?: string | null;
}) {
  const providedEmail = normalizeOptionalString(testUser.email);

  if (providedEmail) {
    return {
      email: providedEmail,
      source: "mercado_pago" as const,
    };
  }

  return {
    email: `test_payer_${testUser.id}@testuser.com`,
    source: "derived_fallback" as const,
  };
}

export function extractMercadoPagoWebhookTopic(input: {
  requestUrl: URL;
  payload: MercadoPagoWebhookPayload | null;
}) {
  const topic =
    normalizeOptionalString(input.payload?.type) ??
    normalizeOptionalString(input.requestUrl.searchParams.get("type")) ??
    normalizeOptionalString(input.requestUrl.searchParams.get("topic"));

  return topic as MercadoPagoWebhookTopic | null;
}

export function extractMercadoPagoWebhookDataId(input: {
  requestUrl: URL;
  payload: MercadoPagoWebhookPayload | null;
}) {
  const queryDataId =
    normalizeOptionalString(input.requestUrl.searchParams.get("data.id")) ??
    normalizeOptionalString(input.requestUrl.searchParams.get("data_id")) ??
    normalizeOptionalString(input.requestUrl.searchParams.get("id"));

  if (queryDataId) {
    return queryDataId;
  }

  return normalizeOptionalString(input.payload?.data?.id ?? input.payload?.id);
}

export function isMercadoPagoApiError(error: unknown): error is MercadoPagoApiError {
  return error instanceof MercadoPagoApiError;
}

export function canIgnorePendingSubscriptionCancellationError(
  subscriptionStatus: string | null | undefined,
  error: unknown,
) {
  if (
    subscriptionStatus !== "pending" ||
    !isMercadoPagoApiError(error)
  ) {
    return false;
  }

  if (error.status === 404) {
    return true;
  }

  return (
    error.status === 400 &&
    error.responseText.includes(
      "Invalid preapproval status param: canceled",
    )
  );
}

export function normalizeMercadoPagoSubscriptionStatus(
  status: string | null | undefined,
): NormalizedMercadoPagoSubscriptionStatus {
  const normalized = status?.trim().toLowerCase();

  if (!normalized) {
    return "unknown";
  }

  if (normalized === "authorized") {
    return "active";
  }

  if (
    normalized === "pending" ||
    normalized === "active" ||
    normalized === "paused" ||
    normalized === "canceled"
  ) {
    return normalized;
  }

  return "unknown";
}

export function resolveMercadoPagoCheckoutAction(input: {
  subscriptionStatus: string;
  mercadoPagoSubscriptionId: string | null;
}): MercadoPagoCheckoutAction {
  if (input.subscriptionStatus === "active") {
    return "block_active_subscription";
  }

  if (input.subscriptionStatus === "paused") {
    return "block_paused_subscription";
  }

  if (
    input.subscriptionStatus === "pending" &&
    normalizeOptionalString(input.mercadoPagoSubscriptionId)
  ) {
    return "resume_pending_checkout";
  }

  return "create_new_checkout";
}

export function resolvePendingSubscriptionRecovery(input: {
  remoteStatus: NormalizedMercadoPagoSubscriptionStatus;
  initPoint?: string | null;
  remoteFound?: boolean;
}): PendingSubscriptionRecoveryDecision {
  if (input.remoteFound === false) {
    return {
      type: "allow_new_checkout",
      nextStatus: "unpaid",
      clearSubscriptionId: true,
      remoteStatus: "not_found",
    };
  }

  if (input.remoteStatus === "pending") {
    const initPoint = normalizeOptionalString(input.initPoint);

    if (!initPoint) {
      return {
        type: "missing_init_point",
        remoteStatus: "pending",
      };
    }

    return {
      type: "resume_checkout",
      initPoint,
      remoteStatus: "pending",
    };
  }

  if (input.remoteStatus === "active" || input.remoteStatus === "paused") {
    return {
      type: "sync_local_status",
      nextStatus: input.remoteStatus,
      remoteStatus: input.remoteStatus,
    };
  }

  if (input.remoteStatus === "canceled") {
    return {
      type: "allow_new_checkout",
      nextStatus: "canceled",
      clearSubscriptionId: false,
      remoteStatus: "canceled",
    };
  }

  return {
    type: "unrecoverable_status",
    remoteStatus: "unknown",
  };
}

export function verifyMercadoPagoWebhookSignature(input: {
  xSignature: string | null;
  xRequestId: string | null;
  dataId: string;
  secret: string;
}) {
  const xSignature = normalizeOptionalString(input.xSignature);
  const xRequestId = normalizeOptionalString(input.xRequestId);
  const secret = normalizeOptionalString(input.secret);

  if (!xSignature || !xRequestId || !secret) {
    return false;
  }

  const signatureParts = Object.fromEntries(
    xSignature.split(",").map((part) => {
      const [rawKey, rawValue] = part.split("=");
      return [rawKey?.trim() ?? "", rawValue?.trim() ?? ""];
    }),
  );

  const ts = normalizeOptionalString(signatureParts.ts);
  const expectedDigest = normalizeOptionalString(signatureParts.v1);

  if (!ts || !expectedDigest) {
    return false;
  }

  const manifest = `id:${input.dataId};request-id:${xRequestId};ts:${ts};`;
  const computedDigest = createHmac("sha256", secret)
    .update(manifest)
    .digest("hex");

  return safeCompare(expectedDigest, computedDigest);
}

export function resolveMercadoPagoWorkspaceHint(input: {
  externalReference?: string | number | null;
  backUrl?: string | null;
}) {
  const fromExternalReference = parseWorkspaceHintFromExternalReference(
    input.externalReference,
  );

  if (fromExternalReference) {
    return fromExternalReference;
  }

  const backUrl = normalizeOptionalString(input.backUrl);

  if (!backUrl) {
    return null;
  }

  try {
    const url = new URL(backUrl);
    const workspaceId =
      normalizeOptionalString(url.searchParams.get("workspaceId")) ??
      normalizeOptionalString(url.searchParams.get("workspace_id"));
    const email =
      normalizeOptionalString(url.searchParams.get("email")) ??
      normalizeOptionalString(url.searchParams.get("payer_email"));

    if (!workspaceId && !email) {
      return null;
    }

    return {
      workspaceId,
      email,
    };
  } catch {
    return null;
  }
}

async function mercadoPagoApiRequest<T>(path: string, accessTokenOverride?: string) {
  const accessToken = accessTokenOverride ?? resolveMercadoPagoAccessToken();

  const response = await fetch(`https://api.mercadopago.com${path}`, {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const responseText = await response.text().catch(() => "");
    const requestId = response.headers.get("x-request-id");

    throw new MercadoPagoApiError({
      status: response.status,
      path,
      responseText,
      requestId,
      mode: "request",
    });
  }

  return (await response.json()) as T;
}

async function mercadoPagoApiMutation<T>(
  path: string,
  body: Record<string, unknown>,
  accessTokenOverride?: string,
  method: "POST" | "PUT" = "POST",
  idempotencyKey?: string,
) {

  const accessToken = accessTokenOverride ?? resolveMercadoPagoAccessToken();

  const response = await fetch(`https://api.mercadopago.com${path}`, {
    method,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(method === "POST"
        ? { "X-Idempotency-Key": idempotencyKey ?? randomUUID() }
        : {}),
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  if (!response.ok) {
    const responseText = await response.text().catch(() => "");
    const requestId = response.headers.get("x-request-id");

    throw new MercadoPagoApiError({
      status: response.status,
      path,
      responseText,
      requestId,
      mode: "mutation",
    });
  }

  return (await response.json()) as T;
}

function parseWorkspaceHintFromExternalReference(
  value?: string | number | null,
) {
  const normalizedValue = normalizeOptionalString(value);

  if (!normalizedValue) {
    return null;
  }

  if (normalizedValue.startsWith("workspace:")) {
    return {
      workspaceId: normalizedValue.slice("workspace:".length).trim() || null,
      email: null,
    };
  }

  if (normalizedValue.startsWith("email:")) {
    return {
      workspaceId: null,
      email: normalizedValue.slice("email:".length).trim() || null,
    };
  }

  if (normalizedValue.includes("=") && normalizedValue.includes("&")) {
    const params = new URLSearchParams(normalizedValue);
    const workspaceId =
      normalizeOptionalString(params.get("workspaceId")) ??
      normalizeOptionalString(params.get("workspace_id"));
    const email =
      normalizeOptionalString(params.get("email")) ??
      normalizeOptionalString(params.get("payer_email"));

    if (!workspaceId && !email) {
      return null;
    }

    return {
      workspaceId,
      email,
    };
  }

  return null;
}

function normalizeOptionalString(value: unknown) {
  if (typeof value === "number") {
    return String(value);
  }

  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized ? normalized : null;
}

function safeCompare(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}
