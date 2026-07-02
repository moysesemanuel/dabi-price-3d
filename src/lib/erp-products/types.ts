export type ErpProductUsageType = "SELLABLE" | "SUPPLY" | "BOTH";

export type ErpProductFilamentRequirement = {
  colorName: string;
  colorHex: string | null;
  material: string;
  weightGrams: number;
};

export type ErpProductSaveRequest = {
  sourceCalculationId: string | null;
  name: string;
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
};
