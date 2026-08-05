import {
  ERP_PRODUCT_PAYLOAD_VERSION,
  type ErpProductFilamentRequirement,
  type ErpProductSaveRequest,
  type ErpProductUsageType,
  type PricingTenantContext,
} from "@/lib/erp-products/types";

const VALID_USAGE_TYPES: ErpProductUsageType[] = ["SELLABLE", "SUPPLY", "BOTH"];

export function normalizeErpProductSaveRequest(
  input: ErpProductSaveRequest,
  tenantContext: PricingTenantContext | null,
): ErpProductSaveRequest {
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

  const slug = normalizeSlug(input.slug ?? name);
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
  const filamentRequirements = normalizeFilamentRequirements(
    input.filamentRequirements,
  );
  const mercadoLivreCategoryId = normalizeOptionalString(
    input.mercadoLivreCategoryId,
  );
  const mercadoLivreCategoryName = normalizeOptionalString(
    input.mercadoLivreCategoryName,
  );

  if (
    input.publishToMercadoLivre === true &&
    usageType !== "SUPPLY" &&
    mercadoLivreCategoryId &&
    !mainImageUrl
  ) {
    throw new Error(
      "Envie uma imagem principal válida antes de salvar um produto vendável para o Mercado Livre no ERP.",
    );
  }

  const payloadVersion =
    normalizeOptionalString(input.payloadVersion) ?? ERP_PRODUCT_PAYLOAD_VERSION;

  return {
    sourceCalculationId: normalizeOptionalString(input.sourceCalculationId) ?? null,
    payloadVersion,
    tenantContext: normalizeTenantContext(tenantContext),
    pricingMetadata: normalizePricingMetadata(input.pricingMetadata),
    publishToMercadoLivre: input.publishToMercadoLivre === true,
    name,
    slug,
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
    filamentRequirements,
    mercadoLivreCategoryId,
    mercadoLivreCategoryName,
    shopeeCategoryId: normalizeOptionalString(input.shopeeCategoryId),
    shopeeCategoryName: normalizeOptionalString(input.shopeeCategoryName),
  };
}

function normalizePricingMetadata(input: ErpProductSaveRequest["pricingMetadata"]) {
  if (!input) {
    throw new Error("Os metadados do cálculo são obrigatórios para o ERP.");
  }

  return {
    calculatedAt: requireNonEmptyString(
      input.calculatedAt,
      "Informe a data do cálculo.",
    ),
    sourceSalesChannelId: normalizeOptionalString(input.sourceSalesChannelId),
    sourceSalesChannelLabel: requireNonEmptyString(
      input.sourceSalesChannelLabel,
      "Informe o canal utilizado no cálculo.",
    ),
    displayCurrency: requireNonEmptyString(
      input.displayCurrency,
      "Informe a moeda exibida no cálculo.",
    ),
    exchangeRateDate: normalizeOptionalString(input.exchangeRateDate),
    productType: requireNonEmptyString(
      input.productType,
      "Informe o tipo de produto do cálculo.",
    ),
    salePriceInCents: normalizeNonNegativeInteger(
      input.salePriceInCents,
      "Preço de venda inválido nos metadados do cálculo.",
    ),
    totalCostInCents: normalizeNonNegativeInteger(
      input.totalCostInCents,
      "Custo total inválido nos metadados do cálculo.",
    ),
    profitInCents: normalizeInteger(
      input.profitInCents,
      "Lucro inválido nos metadados do cálculo.",
    ),
    profitPerHourInCents: normalizeInteger(
      input.profitPerHourInCents,
      "Lucro por hora inválido nos metadados do cálculo.",
    ),
    marginPercentage: normalizeFiniteNumber(
      input.marginPercentage,
      "Margem inválida nos metadados do cálculo.",
    ),
  };
}

function normalizeTenantContext(input: PricingTenantContext | null) {
  if (!input) {
    return null;
  }

  const tenantId = normalizeOptionalString(input.tenantId);
  const companyId = normalizeOptionalString(input.companyId);
  const storeId = normalizeOptionalString(input.storeId);

  if (!tenantId && !companyId && !storeId) {
    return null;
  }

  return {
    tenantId,
    companyId,
    storeId,
  };
}

function normalizeFilamentRequirements(value: ErpProductFilamentRequirement[]) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => ({
      colorName: requireNonEmptyString(
        item.colorName,
        "A cor do filamento precisa ter nome.",
      ),
      colorHex: normalizeOptionalString(item.colorHex),
      material: requireNonEmptyString(
        item.material,
        "O material do filamento é obrigatório.",
      ),
      weightGrams: normalizeFiniteNumber(
        item.weightGrams,
        "O peso do filamento é inválido.",
      ),
    }))
    .filter((item) => item.weightGrams > 0);
}

function requireNonEmptyString(value: string | null | undefined, message: string) {
  const normalizedValue = normalizeOptionalString(value);

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

function normalizeOptionalUrl(value: string | null | undefined, message: string) {
  const normalizedValue = normalizeOptionalString(value);

  if (!normalizedValue) {
    return null;
  }

  try {
    const normalizedUrl = new URL(normalizedValue);
    return normalizedUrl.toString();
  } catch {
    throw new Error(message);
  }
}

function normalizeNonNegativeInteger(value: number, message: string) {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(message);
  }

  return value;
}

function normalizeInteger(value: number, message: string) {
  if (!Number.isInteger(value)) {
    throw new Error(message);
  }

  return value;
}

function normalizeFiniteNumber(value: number, message: string) {
  if (!Number.isFinite(value)) {
    throw new Error(message);
  }

  return value;
}

function normalizeSlug(value: string) {
  const normalizedValue = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalizedValue || "produto";
}
