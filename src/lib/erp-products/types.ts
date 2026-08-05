export type ErpProductUsageType = "SELLABLE" | "SUPPLY" | "BOTH";
export const ERP_PRODUCT_PAYLOAD_VERSION = "2026-08-05";

export type PricingTenantContext = {
  tenantId: string | null;
  companyId: string | null;
  storeId: string | null;
};

export type ErpPricingMetadata = {
  calculatedAt: string;
  sourceSalesChannelId: string | null;
  sourceSalesChannelLabel: string;
  displayCurrency: string;
  exchangeRateDate: string | null;
  productType: string;
  salePriceInCents: number;
  totalCostInCents: number;
  profitInCents: number;
  profitPerHourInCents: number;
  marginPercentage: number;
};

export type ErpProductFilamentRequirement = {
  colorName: string;
  colorHex: string | null;
  material: string;
  weightGrams: number;
};

export type ErpProductSaveRequest = {
  sourceCalculationId: string | null;
  payloadVersion: string;
  tenantContext: PricingTenantContext | null;
  pricingMetadata: ErpPricingMetadata;
  publishToMercadoLivre?: boolean;
  name: string;
  slug: string;
  shortName: string | null;
  sku: string | null;
  description: string | null;
  category: string;
  material: string | null;
  dimensions: string | null;
  tags: string[];
  mainImageUrl: string | null;
  galleryImageUrls: string[];
  finalPriceInCents: number;
  totalCostInCents: number;
  stockQuantity: number;
  minimumStock: number;
  usageType: ErpProductUsageType;
  filamentRequirements: ErpProductFilamentRequirement[];
  mercadoLivreCategoryId: string | null;
  mercadoLivreCategoryName: string | null;
  shopeeCategoryId: string | null;
  shopeeCategoryName: string | null;
};

export type ErpProductRecord = {
  id?: string;
  sku?: string | null;
  name?: string;
  [key: string]: unknown;
};

export type ErpProductSaveResponse = {
  product: ErpProductRecord;
  mercadoLivre?: {
    published: boolean;
    externalItemId?: string | null;
    status?: string | null;
  };
};
