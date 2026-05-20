import type { NextRequest } from "next/server";
import {
  getMercadoLivreFeePreview,
  type MercadoLivreListingTypeId,
  type MercadoLivreRootCategoryKey,
} from "@/lib/marketplaces/mercado-livre";

type PredictedCategory = {
  id: string;
  name: string;
};

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const rootCategoryKey = searchParams.get(
    "rootCategoryKey",
  ) as MercadoLivreRootCategoryKey | null;
  const listingTypeId = searchParams.get(
    "listingTypeId",
  ) as MercadoLivreListingTypeId | null;
  const officialCategoryId = searchParams.get("officialCategoryId");
  const productName = searchParams.get("productName");
  const price = searchParams.get("price");
  const packageHeightCm = searchParams.get("packageHeightCm");
  const packageWidthCm = searchParams.get("packageWidthCm");
  const packageLengthCm = searchParams.get("packageLengthCm");
  const packageWeightKg = searchParams.get("packageWeightKg");

  if (!rootCategoryKey || !listingTypeId) {
    return Response.json(
      {
        error:
          "Missing required params: rootCategoryKey and listingTypeId are required.",
      },
      { status: 400 },
    );
  }

  const localPreview = getMercadoLivreFeePreview({
    rootCategoryKey,
    listingTypeId,
  });

  const predictedCategory =
    officialCategoryId ||
    !productName ||
    productName.trim().length < 3
      ? null
      : await predictCategory(productName);

  const resolvedCategoryId = officialCategoryId || predictedCategory?.id || null;
  const token = process.env.MELI_ACCESS_TOKEN;
  const userId = process.env.MELI_USER_ID;

  if (!token || !userId || !resolvedCategoryId || !price) {
    return Response.json({
      mode: "local-preview",
      preview: localPreview,
      officialLookupReady: Boolean(token && userId),
      predictedCategory,
      feePercentage:
        localPreview.appliedFeePercentage ?? localPreview.officialRange.min,
      fixedFee: 0,
      shippingEstimate: null,
    });
  }

  try {
    const [listingPricePayload, shippingPayload] = await Promise.all([
      fetchListingPrices({
        token,
        price,
        categoryId: resolvedCategoryId,
        listingTypeId,
      }),
      fetchShippingEstimate({
        token,
        userId,
        categoryId: resolvedCategoryId,
        price,
        listingTypeId,
        packageHeightCm,
        packageWidthCm,
        packageLengthCm,
        packageWeightKg,
      }),
    ]);

    return Response.json({
      mode: "official-api",
      preview: localPreview,
      officialLookupReady: true,
      predictedCategory,
      categoryId: resolvedCategoryId,
      feePercentage: extractFeePercentage(listingPricePayload),
      fixedFee: extractFixedFee(listingPricePayload),
      shippingEstimate: extractShippingEstimate(shippingPayload),
      listingPricePayload,
      shippingPayload,
    });
  } catch (error) {
    return Response.json({
      mode: "local-preview",
      preview: localPreview,
      officialLookupReady: true,
      predictedCategory,
      feePercentage:
        localPreview.appliedFeePercentage ?? localPreview.officialRange.min,
      fixedFee: 0,
      shippingEstimate: null,
      officialLookupError:
        error instanceof Error ? error.message : "Unknown Mercado Livre error.",
    });
  }
}

async function predictCategory(query: string): Promise<PredictedCategory | null> {
  const url = new URL(
    "https://api.mercadolibre.com/sites/MLB/domain_discovery/search",
  );
  url.searchParams.set("q", query);
  url.searchParams.set("limit", "1");

  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as Array<{
    category_id?: string;
    category_name?: string;
  }>;

  const first = payload[0];
  if (!first?.category_id || !first.category_name) {
    return null;
  }

  return {
    id: first.category_id,
    name: first.category_name,
  };
}

async function fetchListingPrices(input: {
  token: string;
  price: string;
  categoryId: string;
  listingTypeId: MercadoLivreListingTypeId;
}) {
  const url = new URL("https://api.mercadolibre.com/sites/MLB/listing_prices");
  url.searchParams.set("price", input.price);
  url.searchParams.set("category_id", input.categoryId);
  url.searchParams.set("listing_type_id", input.listingTypeId);

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${input.token}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Mercado Livre listing_prices returned ${response.status}.`);
  }

  return response.json();
}

async function fetchShippingEstimate(input: {
  token: string;
  userId: string;
  categoryId: string;
  price: string;
  listingTypeId: MercadoLivreListingTypeId;
  packageHeightCm: string | null;
  packageWidthCm: string | null;
  packageLengthCm: string | null;
  packageWeightKg: string | null;
}) {
  if (
    !input.packageHeightCm ||
    !input.packageWidthCm ||
    !input.packageLengthCm ||
    !input.packageWeightKg
  ) {
    return null;
  }

  const billableWeightGrams = Math.round(
    Number(input.packageWeightKg.replace(",", ".")) * 1000,
  );
  const dimensions = [
    input.packageHeightCm,
    input.packageWidthCm,
    input.packageLengthCm,
  ].join("x");

  const url = new URL(
    `https://api.mercadolibre.com/users/${input.userId}/shipping_options/free`,
  );
  url.searchParams.set(
    "dimensions",
    `${dimensions},${Math.max(billableWeightGrams, 1)}`,
  );
  url.searchParams.set("item_price", input.price);
  url.searchParams.set("category_id", input.categoryId);
  url.searchParams.set("listing_type_id", input.listingTypeId);
  url.searchParams.set("mode", "me2");
  url.searchParams.set("condition", "new");
  url.searchParams.set("logistic_type", "drop_off");
  url.searchParams.set("free_shipping", "true");
  url.searchParams.set("verbose", "true");

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${input.token}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(
      `Mercado Livre shipping_options/free returned ${response.status}.`,
    );
  }

  return response.json();
}

function extractFeePercentage(payload: unknown) {
  const first = Array.isArray(payload) ? payload[0] : payload;
  const asRecord = first as
    | {
        sale_fee_details?: {
          gross_amount?: number;
          percentage_fee?: number;
          meli_percentage_fee?: number;
        };
      }
    | undefined;

  return (
    asRecord?.sale_fee_details?.meli_percentage_fee ??
    asRecord?.sale_fee_details?.percentage_fee ??
    0
  );
}

function extractFixedFee(payload: unknown) {
  const first = Array.isArray(payload) ? payload[0] : payload;
  const asRecord = first as
    | {
        sale_fee_details?: {
          fixed_fee?: number;
          gross_amount?: number;
        };
      }
    | undefined;

  return asRecord?.sale_fee_details?.fixed_fee ?? 0;
}

function extractShippingEstimate(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const asRecord = payload as {
    coverage?: {
      all_country?: {
        list_cost?: number;
        cost?: number;
      };
    };
    options?: Array<{
      list_cost?: number;
      cost?: number;
      name?: string;
    }>;
  };

  const fromCoverage =
    asRecord.coverage?.all_country?.list_cost ??
    asRecord.coverage?.all_country?.cost;

  if (typeof fromCoverage === "number") {
    return fromCoverage;
  }

  const firstOption = asRecord.options?.[0];
  return firstOption?.list_cost ?? firstOption?.cost ?? null;
}
