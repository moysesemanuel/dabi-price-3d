import type { NextRequest } from "next/server";
import { requireCurrentAuthSession } from "@/lib/auth/session";
import { getMercadoLivreApiCredentials } from "@/lib/marketplaces/mercado-livre-auth";
import type { MercadoLivreListingTypeId } from "@/lib/marketplaces/mercado-livre";
import { mapMercadoLivreOperationalError } from "@/lib/server/operational-messages";
import {
  createRouteRequestContext,
  jsonWithRequestId,
  logRouteEvent,
  serializeError,
} from "@/lib/server/route-observability";

type PredictedCategory = {
  id: string;
  name: string;
};

export async function GET(request: NextRequest) {
  await requireCurrentAuthSession();
  const requestContext = createRouteRequestContext(
    request,
    "/api/meli/free-shipping-cost",
  );
  const searchParams = request.nextUrl.searchParams;
  const height = searchParams.get("height");
  const width = searchParams.get("width");
  const length = searchParams.get("length");
  const weight = searchParams.get("weight");
  const price = searchParams.get("price");
  const listingTypeId =
    (searchParams.get("listingTypeId") as MercadoLivreListingTypeId | null) ??
    "gold_special";
  const categoryId = searchParams.get("categoryId");
  const productName = searchParams.get("productName");
  const freeShipping = searchParams.get("freeShipping") !== "false";

  const missingDimensions = [
    ["height", height],
    ["width", width],
    ["length", length],
    ["weight", weight],
  ]
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missingDimensions.length > 0) {
    return jsonWithRequestId(
      requestContext,
      {
        error: `Parâmetros obrigatórios ausentes: ${missingDimensions.join(", ")}.`,
        code: "MELI_FREE_SHIPPING_MISSING_PARAMS",
      },
      { status: 400 },
    );
  }

  const numericValues = {
    height: Number(height?.replace(",", ".")),
    width: Number(width?.replace(",", ".")),
    length: Number(length?.replace(",", ".")),
    weight: Number(weight?.replace(",", ".")),
  };

  const invalidDimensions = Object.entries(numericValues)
    .filter(([, value]) => !Number.isFinite(value) || value <= 0)
    .map(([key]) => key);

  if (invalidDimensions.length > 0) {
    return jsonWithRequestId(
      requestContext,
      {
        error: `Parâmetros numéricos inválidos: ${invalidDimensions.join(", ")}.`,
        code: "MELI_FREE_SHIPPING_INVALID_PARAMS",
      },
      { status: 400 },
    );
  }

  if (!freeShipping) {
    return jsonWithRequestId(requestContext, {
      freeShippingCost: 0,
      source: "free_shipping_disabled",
      shippingContext: null,
    });
  }

  const predictedCategory =
    categoryId || !productName || productName.trim().length < 3
      ? null
      : await predictCategory(productName);
  const resolvedCategoryId = categoryId || predictedCategory?.id || null;

  if (!resolvedCategoryId) {
    return jsonWithRequestId(
      requestContext,
      {
        error:
          "Contexto de categoria ausente. Envie categoryId ou um productName com pelo menos 3 caracteres.",
        code: "MELI_FREE_SHIPPING_MISSING_CATEGORY",
      },
      { status: 400 },
    );
  }

  if (!price) {
    return jsonWithRequestId(
      requestContext,
      {
        error: "Parâmetro obrigatório ausente: price.",
        code: "MELI_FREE_SHIPPING_MISSING_PRICE",
      },
      { status: 400 },
    );
  }

  let credentials: Awaited<ReturnType<typeof getMercadoLivreApiCredentials>>;

  try {
    credentials = await getMercadoLivreApiCredentials();
  } catch (authError) {
    const mappedError = mapMercadoLivreOperationalError(authError);

    logRouteEvent(
      requestContext,
      mappedError.severity,
      "meli.free_shipping.auth_failed",
      {
        categoryId: resolvedCategoryId,
        listingTypeId,
        error: serializeError(authError),
        mappedCode: mappedError.code,
      },
    );

    return jsonWithRequestId(
      requestContext,
      {
        error: mappedError.message,
        code: mappedError.code,
      },
      { status: 401 },
    );
  }

  try {
    const shippingContext = await resolveShippingContext({
      token: credentials.accessToken,
      userId: credentials.userId,
      categoryId: resolvedCategoryId,
    });

    if (!shippingContext.mode || !shippingContext.logisticType) {
      logRouteEvent(
        requestContext,
        "warn",
        "meli.free_shipping.shipping_context_unavailable",
        {
          categoryId: resolvedCategoryId,
          listingTypeId,
          shippingContext,
        },
      );

      return jsonWithRequestId(
        requestContext,
        {
          error:
            "A conta ou categoria do Mercado Livre não expôs uma logística compatível para estimar o frete grátis neste cenário.",
          code: "MELI_FREE_SHIPPING_CONTEXT_UNAVAILABLE",
          predictedCategory,
          categoryId: resolvedCategoryId,
          shippingContext,
        },
        { status: 422 },
      );
    }

    const payload = await fetchFreeShippingCost({
      token: credentials.accessToken,
      userId: credentials.userId,
      categoryId: resolvedCategoryId,
      price,
      listingTypeId,
      height: numericValues.height,
      width: numericValues.width,
      length: numericValues.length,
      weight: Math.round(numericValues.weight),
      shippingMode: shippingContext.mode,
      logisticType: shippingContext.logisticType,
    });

    const extracted = extractFreeShippingCost(payload);

    if (extracted === null) {
      logRouteEvent(
        requestContext,
        "warn",
        "meli.free_shipping.cost_missing_in_payload",
        {
          categoryId: resolvedCategoryId,
          listingTypeId,
          shippingContext,
        },
      );

      return jsonWithRequestId(
        requestContext,
        {
          error:
            "O Mercado Livre não retornou um custo nacional de frete grátis para este cenário.",
          code: "MELI_FREE_SHIPPING_COST_MISSING",
          predictedCategory,
          categoryId: resolvedCategoryId,
          shippingContext,
          payload,
        },
        { status: 422 },
      );
    }

    return jsonWithRequestId(requestContext, {
      freeShippingCost: extracted.value,
      source: extracted.source,
      predictedCategory,
      categoryId: resolvedCategoryId,
      shippingContext,
      payload,
    });
  } catch (apiError) {
    const mappedError = mapMercadoLivreOperationalError(apiError);

    logRouteEvent(
      requestContext,
      mappedError.severity,
      "meli.free_shipping.lookup_failed",
      {
        categoryId: resolvedCategoryId,
        listingTypeId,
        error: serializeError(apiError),
        mappedCode: mappedError.code,
      },
    );

    return jsonWithRequestId(
      requestContext,
      {
        error: mappedError.message,
        code: mappedError.code,
      },
      { status: 502 },
    );
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

async function fetchFreeShippingCost(input: {
  token: string;
  userId: string;
  categoryId: string;
  price: string;
  listingTypeId: MercadoLivreListingTypeId;
  height: number;
  width: number;
  length: number;
  weight: number;
  shippingMode: string;
  logisticType: string;
}) {
  const url = new URL(
    `https://api.mercadolibre.com/users/${input.userId}/shipping_options/free`,
  );
  url.searchParams.set(
    "dimensions",
    `${input.height}x${input.width}x${input.length},${Math.max(input.weight, 1)}`,
  );
  url.searchParams.set("item_price", input.price);
  url.searchParams.set("category_id", input.categoryId);
  url.searchParams.set("listing_type_id", input.listingTypeId);
  url.searchParams.set("mode", input.shippingMode);
  url.searchParams.set("condition", "new");
  url.searchParams.set("logistic_type", input.logisticType);
  url.searchParams.set("free_shipping", "true");
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

function extractFreeShippingCost(payload: unknown) {
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
    }>;
  };

  if (typeof asRecord.coverage?.all_country?.list_cost === "number") {
    return {
      value: asRecord.coverage.all_country.list_cost,
      source: "coverage.all_country.list_cost",
    };
  }

  if (typeof asRecord.coverage?.all_country?.cost === "number") {
    return {
      value: asRecord.coverage.all_country.cost,
      source: "coverage.all_country.cost",
    };
  }

  const firstOption = asRecord.options?.[0];

  if (typeof firstOption?.list_cost === "number") {
    return {
      value: firstOption.list_cost,
      source: "options[0].list_cost",
    };
  }

  if (typeof firstOption?.cost === "number") {
    return {
      value: firstOption.cost,
      source: "options[0].cost",
    };
  }

  return null;
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
