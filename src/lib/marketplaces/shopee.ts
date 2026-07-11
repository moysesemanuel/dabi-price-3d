import type { ShopeeSellerType } from "@/lib/pricing/initial-pricing-form";

export type ShopeeFeeConfig = {
  baseFixedFee: number;
  basePercentage: number;
  cpfSellerFee: number;
  featuredCampaignFee: number;
  fixedFee: number;
  percentage: number;
  priceRangeLabel: string;
};

export function resolveShopeeFeeConfigForPrice({
  salePrice,
  sellerType,
  featuredCampaign,
}: {
  salePrice: number;
  sellerType: ShopeeSellerType;
  featuredCampaign: boolean;
}): ShopeeFeeConfig {
  const normalizedSalePrice = Math.max(salePrice, 0);

  const basePercentage = normalizedSalePrice <= 79.99 ? 20 : 14;
  const featuredCampaignFee = featuredCampaign ? 2.5 : 0;

  let baseFixedFee = 26;
  let priceRangeLabel = "R$200+";

  if (normalizedSalePrice <= 79.99) {
    baseFixedFee = 4;
    priceRangeLabel = "até R$79,99";
  } else if (normalizedSalePrice <= 99.99) {
    baseFixedFee = 16;
    priceRangeLabel = "R$80 a R$99,99";
  } else if (normalizedSalePrice <= 199.99) {
    baseFixedFee = 20;
    priceRangeLabel = "R$100 a R$199,99";
  }

  const cpfSellerFee = sellerType === "cpf" ? 3 : 0;

  return {
    baseFixedFee,
    basePercentage,
    cpfSellerFee,
    featuredCampaignFee,
    fixedFee: baseFixedFee + cpfSellerFee,
    percentage: basePercentage + featuredCampaignFee,
    priceRangeLabel,
  };
}
