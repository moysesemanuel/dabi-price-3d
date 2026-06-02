export type SiteProductPublishRequest = {
  sourceCalculationId: string | null;
  name: string;
  slug: string;
  priceInCents: number;
  compareAtPriceInCents?: number;
  category: string;
  material: string;
  dimensions: string;
  accentColor: string;
  imageUrl?: string;
  galleryImages?: string[];
  featured: boolean;
  description: string;
  tags: string[];
};

export type SiteProductPublishResponse = {
  product: {
    id: string;
    slug: string;
    name: string;
  };
  productUrl: string | null;
};
