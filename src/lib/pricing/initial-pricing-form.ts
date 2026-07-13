import type {
  MercadoLivreListingTypeId,
  MercadoLivreRootCategoryKey,
} from "@/lib/marketplaces/mercado-livre";
import type { SalesChannelId } from "./sales-channels";

export type PricingMode = "manual" | "margin";
export type ProductType = "3d" | "normal";
export type DirectPaymentMethod =
  | "debit"
  | "credit"
  | "2x"
  | "3x"
  | "4x"
  | "6x"
  | "12x"
  | "other";
export type ShopeeSellerType = "cnpj" | "cpf";
export type ShopeeCouponMode = "percent" | "fixed";
export type AmazonFulfillment = "fba" | "dba";
export type AmazonCategory =
  | "casa-e-cozinha"
  | "eletronicos"
  | "utilidades";

export type FilamentRequirementInput = {
  id?: string;
  colorName: string;
  colorHex: string;
  material: string;
  weightGrams: number;
};

export type PricingFormState = {
  productName: string;
  productType: ProductType;
  salesChannelId: SalesChannelId | "";

  // Preço & margem
  pricingMode: PricingMode;
  manualSalePrice: number;
  promoEnabled: boolean;
  promoDiscountPercentage: number;
  profitMarginPercentage: number;
  isKit: boolean;
  kitQuantity: number;

  // Mercado Livre
  mercadoLivreRootCategoryKey: MercadoLivreRootCategoryKey;
  mercadoLivreListingTypeId: MercadoLivreListingTypeId;
  mercadoLivreOfficialCategoryId: string;
  mercadoLivreOfficialCategoryName: string;
  mercadoLivreFreeShipping: boolean;
  mercadoLivrePackageHeightCm: number;
  mercadoLivrePackageWidthCm: number;
  mercadoLivrePackageLengthCm: number;
  mercadoLivrePackageWeightKg: number;

  // Shopee
  shopeeSellerType: ShopeeSellerType;
  shopeeFeaturedCampaign: boolean;
  shopeeOwnCoupon: boolean;
  shopeeCouponMode: ShopeeCouponMode;
  shopeeCouponValue: number;

  // Amazon
  amazonFulfillment: AmazonFulfillment;
  amazonCategory: AmazonCategory;
  amazonInstallmentsEnabled: boolean;

  // Impressora & energia
  printerModel: string;
  printerPowerWatts: number;
  printTimeHours: number;
  printTimeMinutes: number;
  kwhPrice: number;

  // Múltiplas peças
  multiplePiecesEnabled: boolean;
  dividePrintTimeByPieces: boolean;
  divideFilamentByPieces: boolean;
  quantity: number;

  // Filamento
  weightGrams: number;
  filamentSpoolPrice: number;
  filamentSpoolWeightGrams: number;
  filamentRequirements: FilamentRequirementInput[];

  // Custos
  shippingCost: number;
  packagingCost: number;
  laborCost: number;
  maintenanceCostPerHour: number;
  lossPercentage: number;
  taxPercentage: number;

  // Marketplace
  consignmentCommissionPercentage: number;
  marketplaceFeePercentage: number;
  marketplaceFixedFee: number;

  // Venda direta
  directPaymentMethod: DirectPaymentMethod;
  directPixDiscountPercentage: number;
  directCustomCardFeePercentage: number;
};

export const initialPricingForm: PricingFormState = {
  productName: "",
  productType: "3d",
  salesChannelId: "",

  // Preço & margem
  pricingMode: "margin",
  manualSalePrice: 0,
  promoEnabled: false,
  promoDiscountPercentage: 0,
  profitMarginPercentage: 50,
  isKit: false,
  kitQuantity: 2,

  // Mercado Livre
  mercadoLivreRootCategoryKey: "casa-e-moveis",
  mercadoLivreListingTypeId: "gold_special",
  mercadoLivreOfficialCategoryId: "",
  mercadoLivreOfficialCategoryName: "",
  mercadoLivreFreeShipping: true,
  mercadoLivrePackageHeightCm: 9,
  mercadoLivrePackageWidthCm: 17,
  mercadoLivrePackageLengthCm: 22,
  mercadoLivrePackageWeightKg: 0.462,

  // Shopee
  shopeeSellerType: "cnpj",
  shopeeFeaturedCampaign: false,
  shopeeOwnCoupon: false,
  shopeeCouponMode: "percent",
  shopeeCouponValue: 0,

  // Amazon
  amazonFulfillment: "dba",
  amazonCategory: "casa-e-cozinha",
  amazonInstallmentsEnabled: false,

  // Impressora & energia
  printerModel: "bambu-a1",
  printerPowerWatts: 100,
  printTimeHours: 0,
  printTimeMinutes: 0,
  kwhPrice: 0.9,

  // Múltiplas peças
  multiplePiecesEnabled: false,
  dividePrintTimeByPieces: false,
  divideFilamentByPieces: false,
  quantity: 1,

  // Filamento
  weightGrams: 0,
  filamentSpoolPrice: 0,
  filamentSpoolWeightGrams: 1000,
  filamentRequirements: [
    {
      id: "filament-1",
      colorName: "",
      colorHex: "#FFFFFF",
      material: "",
      weightGrams: 0,
    },
  ],

  // Custos
  shippingCost: 0,
  packagingCost: 0,
  laborCost: 0,
  maintenanceCostPerHour: 0,
  lossPercentage: 0,
  taxPercentage: 0,

  // Marketplace
  consignmentCommissionPercentage: 30,
  marketplaceFeePercentage: 0,
  marketplaceFixedFee: 0,

  // Venda direta
  directPaymentMethod: "other",
  directPixDiscountPercentage: 0,
  directCustomCardFeePercentage: 0,
};
