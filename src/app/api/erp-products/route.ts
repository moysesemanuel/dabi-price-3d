import { requireCurrentAuthSession } from "@/lib/auth/session";
import { resolvePricingTenantContext } from "@/lib/erp-products/context";
import { normalizeErpProductSaveRequest } from "@/lib/erp-products/normalize-save-request";
import { mapErpUpstreamFailure } from "@/lib/server/operational-messages";
import {
  createRouteRequestContext,
  jsonWithRequestId,
  logRouteEvent,
  serializeError,
} from "@/lib/server/route-observability";
import type {
  ErpProductSaveRequest,
  ErpProductSaveResponse,
} from "@/lib/erp-products/types";

const ERP_REQUEST_TIMEOUT_MS = 12_000;

export async function POST(request: Request) {
  const requestContext = createRouteRequestContext(request, "/api/erp-products");
  const session = await requireCurrentAuthSession();

  let body: ErpProductSaveRequest;

  try {
    body = (await request.json()) as ErpProductSaveRequest;
  } catch {
    logRouteEvent(requestContext, "warn", "erp.invalid_json_payload", {
      workspaceId: session.workspace.id,
      userId: session.user.id,
    });

    return jsonWithRequestId(
      requestContext,
      {
        error: "Payload inválido.",
        code: "ERP_INVALID_JSON_PAYLOAD",
      },
      { status: 400 },
    );
  }

  const erpAppUrl = process.env.ERP_APP_URL?.trim();
  const integrationToken = process.env.PRICING_INTEGRATION_TOKEN?.trim();

  if (!erpAppUrl || !integrationToken) {
    logRouteEvent(requestContext, "error", "erp.integration_not_configured", {
      workspaceId: session.workspace.id,
      userId: session.user.id,
      missingEnv: [
        !erpAppUrl ? "ERP_APP_URL" : null,
        !integrationToken ? "PRICING_INTEGRATION_TOKEN" : null,
      ].filter(Boolean),
    });

    return jsonWithRequestId(
      requestContext,
      {
        error:
          "Integração ERP indisponível neste ambiente. Configure ERP_APP_URL e PRICING_INTEGRATION_TOKEN para salvar produtos no ERP.",
        code: "ERP_NOT_CONFIGURED",
      },
      { status: 500 },
    );
  }

  let payload: ErpProductSaveRequest;

  try {
    payload = normalizeErpProductSaveRequest(
      body,
      resolvePricingTenantContext(),
    );
  } catch (error) {
    logRouteEvent(requestContext, "warn", "erp.payload_validation_failed", {
      workspaceId: session.workspace.id,
      userId: session.user.id,
      sku: body.sku ?? null,
      slug: body.slug ?? null,
      error: serializeError(error),
    });

    return jsonWithRequestId(
      requestContext,
      {
        error:
          error instanceof Error
            ? error.message
            : "Os dados enviados ao ERP são inválidos.",
        code: "ERP_INVALID_PAYLOAD",
      },
      { status: 400 },
    );
  }

  let response: Response;

  try {
    response = await fetch(
      `${erpAppUrl.replace(/\/$/, "")}/api/integrations/pricing/products`,
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${integrationToken}`,
          "Content-Type": "application/json",
          "x-pricing-integration-token": integrationToken,
        },
        body: JSON.stringify(payload),
        cache: "no-store",
        signal: AbortSignal.timeout(ERP_REQUEST_TIMEOUT_MS),
      },
    );
  } catch (error) {
    const timedOut = isTimeoutError(error);

    logRouteEvent(
      requestContext,
      "error",
      timedOut ? "erp.upstream_timeout" : "erp.upstream_network_failed",
      {
      workspaceId: session.workspace.id,
      userId: session.user.id,
      erpAppUrl,
      sku: payload.sku ?? null,
      slug: payload.slug ?? null,
      error: serializeError(error),
      },
    );

    return jsonWithRequestId(
      requestContext,
      {
        error: timedOut
          ? "O ERP demorou mais que o esperado para responder. Tente novamente em alguns instantes."
          : "Não foi possível conectar a precificadora ao ERP. Verifique ERP_APP_URL, o token de integração e a disponibilidade do ERP.",
        code: timedOut ? "ERP_UPSTREAM_TIMEOUT" : "ERP_UPSTREAM_UNREACHABLE",
      },
      { status: timedOut ? 504 : 502 },
    );
  }

  const responsePayload = (await response.json().catch(() => null)) as
    | (ErpProductSaveResponse & { error?: string })
    | { error?: string }
    | null;

  if (!response.ok) {
    const upstreamMessage =
      responsePayload && "error" in responsePayload
        ? responsePayload.error ?? null
        : null;
    const mappedFailure = mapErpUpstreamFailure({
      status: response.status || 500,
      upstreamMessage,
    });

    logRouteEvent(requestContext, mappedFailure.severity, "erp.upstream_rejected", {
      workspaceId: session.workspace.id,
      userId: session.user.id,
      erpAppUrl,
      sku: payload.sku ?? null,
      slug: payload.slug ?? null,
      upstreamStatus: response.status,
      upstreamMessage,
    });

    return jsonWithRequestId(
      requestContext,
      {
        error: mappedFailure.message,
        code: mappedFailure.code,
      },
      { status: response.status || 500 },
    );
  }

  if (!responsePayload || !("product" in responsePayload)) {
    logRouteEvent(requestContext, "error", "erp.invalid_response_shape", {
      workspaceId: session.workspace.id,
      userId: session.user.id,
      erpAppUrl,
      sku: payload.sku ?? null,
      slug: payload.slug ?? null,
      upstreamStatus: response.status,
      responsePayload,
    });

    return jsonWithRequestId(
      requestContext,
      {
        error:
          "O ERP respondeu sem a estrutura esperada para confirmar o produto salvo.",
        code: "ERP_INVALID_RESPONSE",
      },
      { status: 502 },
    );
  }

  logRouteEvent(requestContext, "info", "erp.product_saved", {
    workspaceId: session.workspace.id,
    userId: session.user.id,
    sku: payload.sku ?? null,
    slug: payload.slug ?? null,
    erpProductId:
      typeof responsePayload.product === "object" &&
      responsePayload.product &&
      "id" in responsePayload.product
        ? responsePayload.product.id
        : null,
    requestedMercadoLivrePublish: payload.publishToMercadoLivre ?? false,
  });

  return jsonWithRequestId(requestContext, {
    product: responsePayload.product,
    mercadoLivre:
      "mercadoLivre" in responsePayload ? responsePayload.mercadoLivre : undefined,
  });
}

function isTimeoutError(error: unknown) {
  return (
    error instanceof DOMException &&
    (error.name === "TimeoutError" || error.name === "AbortError")
  );
}
