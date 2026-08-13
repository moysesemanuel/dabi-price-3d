import {
  getWorkspacePlan,
  type WorkspacePlanId,
} from "../workspace/catalog.ts";
import { createHmac, timingSafeEqual } from "node:crypto";

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
  payment?: {
    id?: number | string | null;
    status?: string | null;
    status_detail?: string | null;
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
    frequency: 1;
    frequency_type: "months";
    end_date: string;
    transaction_amount: number;
    currency_id: "BRL";
  };
  status: "pending";
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

export function getMercadoPagoAccessToken() {
  return process.env.MERCADO_PAGO_ACCESS_TOKEN?.trim() ?? "";
}

export function getMercadoPagoTestAccessToken() {
  return process.env.MERCADO_PAGO_TEST_ACCESS_TOKEN?.trim() ?? "";
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

export async function createMercadoPagoSubscriptionCheckout(input: {
  planId: WorkspacePlanId;
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

export function buildMercadoPagoSubscriptionCheckoutPayload(input: {
  planId: WorkspacePlanId;
  payerEmail: string;
  workspaceId: string;
  reason: string;
  backUrl: string;
  now?: Date;
}): MercadoPagoSubscriptionCheckoutPayload {
  const plan = getWorkspacePlan(input.planId);

  if (typeof plan.monthlyPrice !== "number" || !Number.isFinite(plan.monthlyPrice)) {
    throw new Error(
      `Não foi possível resolver o valor mensal do plano ${input.planId} para criar a assinatura.`,
    );
  }

  const endDate = new Date(input.now ?? new Date());
  endDate.setFullYear(endDate.getFullYear() + 5);

  return {
    payer_email: input.payerEmail,
    external_reference: `workspace:${input.workspaceId}`,
    reason: input.reason,
    back_url: input.backUrl,
    auto_recurring: {
      frequency: 1,
      frequency_type: "months",
      end_date: endDate.toISOString(),
      transaction_amount: plan.monthlyPrice,
      currency_id: "BRL",
    },
    status: "pending",
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
  const accessToken = accessTokenOverride ?? getMercadoPagoAccessToken();

  if (!accessToken) {
    throw new Error(
      "MERCADO_PAGO_ACCESS_TOKEN is required to consultar assinaturas do Mercado Pago.",
    );
  }

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
) {

  const accessToken = accessTokenOverride ?? getMercadoPagoAccessToken();

  if (!accessToken) {
    throw new Error(
      "MERCADO_PAGO_ACCESS_TOKEN is required to criar assinaturas do Mercado Pago.",
    );
  }

  const response = await fetch(`https://api.mercadopago.com${path}`, {
    method,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
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
