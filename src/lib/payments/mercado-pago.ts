import type { WorkspacePlanId } from "@/lib/workspace/catalog";
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

export function getMercadoPagoAccessToken() {
  return process.env.MERCADO_PAGO_ACCESS_TOKEN?.trim() ?? "";
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

export async function getMercadoPagoAuthorizedPayment(authorizedPaymentId: string) {
  return mercadoPagoApiRequest<MercadoPagoAuthorizedPayment>(
    `/authorized_payments/${authorizedPaymentId}`,
  );
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

async function mercadoPagoApiRequest<T>(path: string) {
  const accessToken = getMercadoPagoAccessToken();

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
