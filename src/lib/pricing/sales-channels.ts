export const salesChannels = [
  {
    id: "mercado-livre",
    name: "Mercado Livre",
    marketplaceFeePercentage: 16,
    marketplaceFixedFee: 0,
  },
  {
    id: "shopee",
    name: "Shopee",
    marketplaceFeePercentage: 20,
    marketplaceFixedFee: 0,
  },
  {
    id: "amazon",
    name: "Amazon",
    marketplaceFeePercentage: 15,
    marketplaceFixedFee: 0,
  },
  {
    id: "direct",
    name: "Venda Direta",
    marketplaceFeePercentage: 0,
    marketplaceFixedFee: 0,
  },
  {
    id: "consignment",
    name: "Consignado",
    marketplaceFeePercentage: 30,
    marketplaceFixedFee: 0,
  },
] as const;

export type SalesChannelId = (typeof salesChannels)[number]["id"];

export function findSalesChannelById(channelId: string) {
  return salesChannels.find((channel) => channel.id === channelId);
}
