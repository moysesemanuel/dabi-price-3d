import {
  getWorkspacePlan,
  type WorkspacePlanId,
} from "@/lib/workspace/catalog";
import { createHmac, timingSafeEqual } from "node:crypto";

const SUBSCRIPTION_ENV_BY_PLAN: Record<WorkspacePlanId, string> = {
  starter: "NEXT_PUBLIC_MP_SUBSCRIPTION_STARTER_URL",
  growth: "NEXT_PUBLIC_MP_SUBSCRIPTION_GROWTH_URL",
  scale: "NEXT_PUBLIC_MP_SUBSCRIPTION_SCALE_URL",
};

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

export function getMercadoPagoSubscriptionUrl(planId: WorkspacePlanId) {
  const envKey = SUBSCRIPTION_ENV_BY_PLAN[planId];
  const value = process.env[envKey]?.trim();

  if (!value) {
    return null;
  }

  try {
    const url = new URL(value);
    return url.toString();
  } catch {
    return null;
  }
}

export function hasMercadoPagoSubscription(planId: WorkspacePlanId) {
  return Boolean(getMercadoPagoSubscriptionUrl(planId));
}

export function getMercadoPagoSubscriptionPlanId(planId: WorkspacePlanId) {
  const subscriptionUrl = getMercadoPagoSubscriptionUrl(planId);

  if (!subscriptionUrl) {
    return null;
  }

  try {
    const url = new URL(subscriptionUrl);

    return (
      normalizeOptionalString(url.searchParams.get("preapproval_plan_id")) ??
      normalizeOptionalString(url.searchParams.get("preapprovalPlanId"))
    );
  } catch {
    return null;
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

export function resolveWorkspacePlanIdFromMercadoPagoPlanId(
  mercadoPagoPlanId: string | null | undefined,
): WorkspacePlanId | null {
  const normalizedPlanId = normalizeOptionalString(mercadoPagoPlanId);

  if (!normalizedPlanId) {
    return null;
  }

  for (const [workspacePlanId, envKey] of Object.entries(SUBSCRIPTION_ENV_BY_PLAN) as Array<
    [WorkspacePlanId, string]
  >) {
    const urlValue = process.env[envKey]?.trim();

    if (!urlValue) {
      continue;
    }

    try {
      const url = new URL(urlValue);
      const preapprovalPlanId =
        normalizeOptionalString(url.searchParams.get("preapproval_plan_id")) ??
        normalizeOptionalString(url.searchParams.get("preapprovalPlanId"));

      if (preapprovalPlanId === normalizedPlanId) {
        return workspacePlanId;
      }
    } catch {
      continue;
    }
  }

  return null;
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
  const plan = getWorkspacePlan(input.planId);
  const transactionAmount = parseWorkspacePlanMonthlyAmount(plan.monthlyPriceLabel);

  if (!transactionAmount) {
    throw new Error(
      `Não foi possível resolver o valor mensal do plano ${input.planId} para criar a assinatura de teste.`,
    );
  }

  const endDate = new Date();
  endDate.setFullYear(endDate.getFullYear() + 5);

  return mercadoPagoApiMutation<MercadoPagoSubscription>("/preapproval", {
    payer_email: input.payerEmail,
    external_reference: `workspace:${input.workspaceId}`,
    reason: input.reason,
    back_url: input.backUrl,
    auto_recurring: {
      frequency: 1,
      frequency_type: "months",
      end_date: endDate.toISOString(),
      transaction_amount: transactionAmount,
      currency_id: "BRL",
    },
    status: "pending",
  }, input.accessTokenOverride);
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
    normalizeOptionalString(input.requestUrl.searchParams.get("topic")) ??
    normalizeOptionalString(input.requestUrl.searchParams.get("type")) ??
    normalizeOptionalString(input.payload?.type);

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

    throw new Error(
      `Mercado Pago API request failed (${response.status}) for ${path}: ${responseText || "empty response"}`,
    );
  }

  return (await response.json()) as T;
}

async function mercadoPagoApiMutation<T>(
  path: string,
  body: Record<string, unknown>,
  accessTokenOverride?: string,
) {
  const accessToken = accessTokenOverride ?? getMercadoPagoAccessToken();

  if (!accessToken) {
    throw new Error(
      "MERCADO_PAGO_ACCESS_TOKEN is required to criar assinaturas do Mercado Pago.",
    );
  }

  const response = await fetch(`https://api.mercadopago.com${path}`, {
    method: "POST",
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

    throw new Error(
      `Mercado Pago API mutation failed (${response.status}) for ${path}: ${responseText || "empty response"}`,
    );
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

function parseWorkspacePlanMonthlyAmount(monthlyPriceLabel: string) {
  const normalized = monthlyPriceLabel.replace(/[^\d,.-]/g, "").replace(",", ".");
  const parsed = Number.parseFloat(normalized);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}
