import { resolvePricingTenantContext } from "@/lib/erp-products/context";
import { normalizeErpProductSaveRequest } from "@/lib/erp-products/normalize-save-request";
import type {
  ErpProductSaveRequest,
  ErpProductSaveResponse,
} from "@/lib/erp-products/types";

export async function POST(request: Request) {
  let body: ErpProductSaveRequest;

  try {
    body = (await request.json()) as ErpProductSaveRequest;
  } catch {
    return Response.json({ error: "Payload inválido." }, { status: 400 });
  }

  const erpAppUrl = process.env.ERP_APP_URL?.trim();
  const integrationToken = process.env.PRICING_INTEGRATION_TOKEN?.trim();

  if (!erpAppUrl || !integrationToken) {
    return Response.json(
      {
        error:
          "Configure ERP_APP_URL e PRICING_INTEGRATION_TOKEN para salvar produtos no ERP.",
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
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Os dados enviados ao ERP são inválidos.",
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
      },
    );
  } catch {
    return Response.json(
      { error: "Nao foi possivel conectar a precificadora ao ERP." },
      { status: 502 },
    );
  }

  const responsePayload = (await response.json().catch(() => null)) as
    | (ErpProductSaveResponse & { error?: string })
    | { error?: string }
    | null;

  if (!response.ok) {
    return Response.json(
      {
        error:
          responsePayload && "error" in responsePayload
            ? responsePayload.error ?? "Falha ao enviar produto para o ERP."
            : "Falha ao enviar produto para o ERP.",
      },
      { status: response.status || 500 },
    );
  }

  if (!responsePayload || !("product" in responsePayload)) {
    return Response.json(
      { error: "O ERP retornou uma resposta inválida." },
      { status: 502 },
    );
  }

  return Response.json({
    product: responsePayload.product,
    mercadoLivre:
      "mercadoLivre" in responsePayload ? responsePayload.mercadoLivre : undefined,
  });
}
