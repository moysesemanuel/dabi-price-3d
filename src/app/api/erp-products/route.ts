import type {
  ErpProductSaveRequest,
  ErpProductSaveResponse,
  ErpProductUsageType,
} from "@/lib/erp-products/types";

const VALID_USAGE_TYPES: ErpProductUsageType[] = ["SELLABLE", "SUPPLY", "BOTH"];

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

  let payload: Omit<ErpProductSaveRequest, "sourceCalculationId">;

  try {
    payload = normalizePayload(body);
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
  });
}

function normalizePayload(
  input: ErpProductSaveRequest,
): Omit<ErpProductSaveRequest, "sourceCalculationId"> {
  const name = requireNonEmptyString(input.name, "Informe o nome do produto.");
  const category = requireNonEmptyString(
    input.category,
    "Informe a categoria do produto.",
  );
  const usageType = VALID_USAGE_TYPES.includes(input.usageType)
    ? input.usageType
    : null;

  if (!usageType) {
    throw new Error("Selecione um tipo de uso válido para o ERP.");
  }

  const finalPriceInCents = normalizeNonNegativeInteger(
    input.finalPriceInCents,
    "Preço final inválido para o ERP.",
  );
  const totalCostInCents = normalizeNonNegativeInteger(
    input.totalCostInCents,
    "Custo total inválido para o ERP.",
  );
  const stockQuantity = normalizeNonNegativeInteger(
    input.stockQuantity,
    "Estoque inicial inválido.",
  );
  const minimumStock = normalizeNonNegativeInteger(
    input.minimumStock,
    "Estoque mínimo inválido.",
  );

  const mainImageUrl = normalizeOptionalUrl(
    input.mainImageUrl,
    "A imagem principal do ERP precisa ser uma URL válida.",
  );
  const galleryImageUrls = normalizeStringArray(input.galleryImageUrls).map(
    (url) =>
      normalizeOptionalUrl(
        url,
        "Todas as imagens da galeria do ERP precisam ser URLs válidas.",
      ) as string,
  );
  const mercadoLivreCategoryId = normalizeOptionalString(
    input.mercadoLivreCategoryId,
  );
  const mercadoLivreCategoryName = normalizeOptionalString(
    input.mercadoLivreCategoryName,
  );

  if (
    usageType !== "SUPPLY" &&
    mercadoLivreCategoryId &&
    !mainImageUrl
  ) {
    throw new Error(
      "Envie uma imagem principal válida antes de salvar um produto vendável para o Mercado Livre no ERP.",
    );
  }

  return {
    name,
    shortName: normalizeOptionalString(input.shortName),
    sku: normalizeOptionalString(input.sku),
    description: normalizeOptionalString(input.description),
    category,
    material: normalizeOptionalString(input.material),
    dimensions: normalizeOptionalString(input.dimensions),
    tags: normalizeStringArray(input.tags),
    mainImageUrl,
    galleryImageUrls,
    finalPriceInCents,
    totalCostInCents,
    stockQuantity,
    minimumStock,
    usageType,
    mercadoLivreCategoryId,
    mercadoLivreCategoryName,
    shopeeCategoryId: normalizeOptionalString(input.shopeeCategoryId),
    shopeeCategoryName: normalizeOptionalString(input.shopeeCategoryName),
  };
}

function requireNonEmptyString(value: string, message: string) {
  const normalizedValue = value.trim();

  if (!normalizedValue) {
    throw new Error(message);
  }

  return normalizedValue;
}

function normalizeOptionalString(value: string | null | undefined) {
  if (typeof value !== "string") {
    return null;
  }

  const normalizedValue = value.trim();
  return normalizedValue.length > 0 ? normalizedValue : null;
}

function normalizeStringArray(value: string[] | string) {
  if (Array.isArray(value)) {
    return value.map((item) => item.trim()).filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(/[\n,]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

function normalizeOptionalUrl(value: string | null | undefined, errorMessage: string) {
  const normalizedValue = normalizeOptionalString(value);

  if (!normalizedValue) {
    return null;
  }

  try {
    const parsedUrl = new URL(normalizedValue);
    return parsedUrl.toString();
  } catch {
    throw new Error(errorMessage);
  }
}

function normalizeNonNegativeInteger(value: number, errorMessage: string) {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(errorMessage);
  }

  return Math.round(value);
}
