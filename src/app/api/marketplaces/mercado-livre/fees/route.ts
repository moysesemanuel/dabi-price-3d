import type { NextRequest } from "next/server";
import { getMercadoLivreApiCredentials } from "@/lib/marketplaces/mercado-livre-auth";
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
  const freeShipping = searchParams.get("freeShipping") !== "false";

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
  if (!resolvedCategoryId || !price) {
    return Response.json({
      mode: "local-preview",
      preview: localPreview,
      officialLookupReady: false,
      predictedCategory,
      feePercentage:
        localPreview.appliedFeePercentage ?? localPreview.officialRange.min,
      fixedFee: 0,
      shippingEstimate: null,
    });
  }

  try {
    const { accessToken, userId } = await getMercadoLivreApiCredentials();
    const shippingContext = await resolveShippingContext({
      token: accessToken,
      userId,
      categoryId: resolvedCategoryId,
    });

    const [listingPricePayload, shippingPayload] = await Promise.all([
      fetchListingPrices({
        token: accessToken,
        price,
        categoryId: resolvedCategoryId,
        listingTypeId,
        shippingMode: shippingContext.mode,
        logisticType: shippingContext.logisticType,
        billableWeightKg: packageWeightKg,
      }),
      fetchShippingEstimate({
        token: accessToken,
        userId,
        categoryId: resolvedCategoryId,
        price,
        listingTypeId,
        freeShipping,
        shippingMode: shippingContext.mode,
        logisticType: shippingContext.logisticType,
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
      shippingContext,
      listingPricePayload,
      shippingPayload,
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown Mercado Livre error.";
    const officialLookupReady = !errorMessage.includes("não conectado");

    return Response.json({
      mode: "local-preview",
      preview: localPreview,
      officialLookupReady,
      predictedCategory,
      feePercentage:
        localPreview.appliedFeePercentage ?? localPreview.officialRange.min,
      fixedFee: 0,
      shippingEstimate: null,
      officialLookupError: errorMessage,
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
  shippingMode: string | null;
  logisticType: string | null;
  billableWeightKg: string | null;
}) {
  const url = new URL("https://api.mercadolibre.com/sites/MLB/listing_prices");
  url.searchParams.set("price", input.price);
  url.searchParams.set("category_id", input.categoryId);
  url.searchParams.set("listing_type_id", input.listingTypeId);
  if (input.shippingMode) {
    url.searchParams.set("shipping_mode", input.shippingMode);
  }
  if (input.logisticType) {
    url.searchParams.set("logistic_type", input.logisticType);
  }
  if (input.billableWeightKg) {
    const parsedWeightKg = Number(input.billableWeightKg.replace(",", "."));

    if (Number.isFinite(parsedWeightKg) && parsedWeightKg > 0) {
      url.searchParams.set("billable_weight", String(parsedWeightKg));
    }
  }

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
  freeShipping: boolean;
  shippingMode: string | null;
  logisticType: string | null;
  packageHeightCm: string | null;
  packageWidthCm: string | null;
  packageLengthCm: string | null;
  packageWeightKg: string | null;
}) {
  if (!input.freeShipping) {
    return {
      options: [],
      coverage: {
        all_country: {
          cost: 0,
          list_cost: 0,
        },
      },
    };
  }

  if (
    !input.packageHeightCm ||
    !input.packageWidthCm ||
    !input.packageLengthCm ||
    !input.packageWeightKg ||
    !input.shippingMode ||
    !input.logisticType
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
  url.searchParams.set("mode", input.shippingMode);
  url.searchParams.set("condition", "new");
  url.searchParams.set("logistic_type", input.logisticType);
  url.searchParams.set("free_shipping", input.freeShipping ? "true" : "false");
  url.searchParams.set("verbose", "true");

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${input.token}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Mercado Livre shipping_options/free returned ${response.status}: ${errorText}`,
    );
  }

  return response.json();
}

async function resolveShippingContext(input: {
  token: string;
  userId: string;
  categoryId: string;
}) {
  const [userPreferences, categoryPreferences] = await Promise.all([
    fetchUserShippingPreferences(input),
    fetchCategoryShippingPreferences(input),
  ]);

  const userModes = extractEnabledModes(userPreferences);
  const categoryModes = extractEnabledModes(categoryPreferences);
  const userTypes = extractEnabledLogisticTypes(userPreferences);
  const categoryTypes = extractEnabledLogisticTypes(categoryPreferences);
  const supportedTypes = userTypes.filter((type) => categoryTypes.includes(type));

  return {
    mode:
      userModes.includes("me2") && categoryModes.includes("me2") ? "me2" : null,
    logisticType: pickPreferredLogisticType(supportedTypes),
  };
}

async function fetchUserShippingPreferences(input: {
  token: string;
  userId: string;
}) {
  const response = await fetch(
    `https://api.mercadolibre.com/users/${input.userId}/shipping_preferences`,
    {
      headers: {
        Authorization: `Bearer ${input.token}`,
      },
      cache: "no-store",
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Mercado Livre shipping_preferences(user) returned ${response.status}: ${errorText}`,
    );
  }

  return response.json();
}

async function fetchCategoryShippingPreferences(input: {
  token: string;
  categoryId: string;
}) {
  const response = await fetch(
    `https://api.mercadolibre.com/categories/${input.categoryId}/shipping_preferences`,
    {
      headers: {
        Authorization: `Bearer ${input.token}`,
      },
      cache: "no-store",
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Mercado Livre shipping_preferences(category) returned ${response.status}: ${errorText}`,
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

function extractEnabledModes(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return [];
  }

  const directModes = (payload as { modes?: unknown }).modes;

  if (Array.isArray(directModes)) {
    return directModes.filter(isStringValue);
  }

  const logistics = (payload as { logistics?: unknown }).logistics;

  if (!Array.isArray(logistics)) {
    return [];
  }

  return logistics
    .map((entry) => (entry as { mode?: unknown }).mode)
    .filter(isStringValue);
}

function extractEnabledLogisticTypes(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return [];
  }

  const pickingType = (payload as { picking_type?: unknown }).picking_type;
  const baseTypes = isStringValue(pickingType) ? [pickingType] : [];
  const logistics = (payload as { logistics?: unknown }).logistics;

  if (!Array.isArray(logistics)) {
    return baseTypes;
  }

  const nestedTypes = logistics.flatMap((entry) => {
    const types = (entry as { types?: unknown }).types;

    if (!Array.isArray(types)) {
      return [];
    }

    return types
      .map((typeEntry) =>
        isStringValue(typeEntry)
          ? typeEntry
          : isStringValue((typeEntry as { type?: unknown }).type)
            ? (typeEntry as { type: string }).type
            : null,
      )
      .filter(isStringValue);
  });

  return [...new Set([...baseTypes, ...nestedTypes])];
}

function pickPreferredLogisticType(types: string[]) {
  const preferredOrder = [
    "drop_off",
    "xd_drop_off",
    "cross_docking",
    "self_service",
    "fulfillment",
    "turbo",
  ];

  for (const type of preferredOrder) {
    if (types.includes(type)) {
      return type;
    }
  }

  return types[0] ?? null;
}

function isStringValue(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}
