import type { SiteProductPublishRequest } from "@/lib/site-products/types";

type EcommerceAuthResponse = {
  token?: string;
  message?: string;
};

type EcommerceCreateProductResponse = {
  product?: {
    id: string;
    slug: string;
    name: string;
  };
  productUrl?: string | null;
  message?: string;
};

type SuccessfulEcommerceCreateProductResponse = {
  product: {
    id: string;
    slug: string;
    name: string;
  };
  productUrl?: string | null;
};

class PublishRouteError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function POST(request: Request) {
  let body: SiteProductPublishRequest;

  try {
    body = (await request.json()) as SiteProductPublishRequest;
  } catch {
    return Response.json({ error: "Payload inválido." }, { status: 400 });
  }

  const apiUrl = process.env.ECOMMERCE_API_URL?.trim();
  const storefrontUrl = process.env.ECOMMERCE_STOREFRONT_URL?.trim() ?? null;
  const adminEmail = process.env.ECOMMERCE_ADMIN_EMAIL?.trim();
  const adminPassword = process.env.ECOMMERCE_ADMIN_PASSWORD?.trim();

  if (!apiUrl || !adminEmail || !adminPassword) {
    return Response.json(
      {
        error:
          "Configure ECOMMERCE_API_URL, ECOMMERCE_ADMIN_EMAIL e ECOMMERCE_ADMIN_PASSWORD para publicar no site.",
      },
      { status: 500 },
    );
  }

  const normalizedSlug = slugify(body.slug || body.name);
  const normalizedTags = body.tags.map((item) => item.trim()).filter(Boolean);
  const normalizedGalleryImages = (body.galleryImages ?? [])
    .map((item) => item.trim())
    .filter(Boolean);
  const normalizedImageUrl = body.imageUrl?.trim() || undefined;
  const normalizedPriceInCents = Math.round(body.priceInCents);
  const normalizedCompareAtPriceInCents =
    typeof body.compareAtPriceInCents === "number" &&
    Number.isFinite(body.compareAtPriceInCents) &&
    body.compareAtPriceInCents > normalizedPriceInCents
      ? Math.round(body.compareAtPriceInCents)
      : undefined;

  if (
    !body.name?.trim() ||
    !normalizedSlug ||
    !body.category?.trim() ||
    !body.material?.trim() ||
    !body.dimensions?.trim() ||
    !body.description?.trim() ||
    !Number.isFinite(normalizedPriceInCents) ||
    normalizedPriceInCents <= 0
  ) {
    return Response.json(
      {
        error:
          "Preencha nome, slug, categoria, material, dimensões, descrição e um preço válido.",
      },
      { status: 400 },
    );
  }

  if (
    (normalizedImageUrl && isDataUrl(normalizedImageUrl)) ||
    normalizedGalleryImages.some(isDataUrl)
  ) {
    return Response.json(
      {
        error:
          "Use URLs públicas para as imagens do produto. O e-commerce não aceita upload embutido em base64 neste endpoint.",
      },
      { status: 400 },
    );
  }

  try {
    const authResponse = await fetch(`${apiUrl}/api/auth/login`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        email: adminEmail,
        password: adminPassword,
      }),
      cache: "no-store",
    });
    const authPayload = (await authResponse.json()) as EcommerceAuthResponse;

    if (!authResponse.ok || !authPayload.token) {
      throw new Error(
        authPayload.message ?? "Falha ao autenticar na API do site.",
      );
    }

    const createProductPayload = await createProductWithSlugRetry({
      apiUrl,
      token: authPayload.token,
      baseSlug: normalizedSlug,
      payload: {
        sourceCalculationId: body.sourceCalculationId,
        name: body.name.trim(),
        priceInCents: normalizedPriceInCents,
        compareAtPriceInCents: normalizedCompareAtPriceInCents,
        category: body.category.trim(),
        material: body.material.trim(),
        dimensions: body.dimensions.trim(),
        accentColor: normalizeHexColor(body.accentColor),
        imageUrl: normalizedImageUrl,
        galleryImages:
          normalizedGalleryImages.length > 0 ? normalizedGalleryImages : undefined,
        featured: Boolean(body.featured),
        description: body.description.trim(),
        tags: normalizedTags,
      },
    });

    const productUrl =
      createProductPayload.productUrl ??
      (storefrontUrl
        ? `${storefrontUrl.replace(/\/$/, "")}/produto/${createProductPayload.product.slug}`
        : null);

    return Response.json({
      product: createProductPayload.product,
      productUrl,
    });
  } catch (error) {
    const status =
      error instanceof PublishRouteError ? error.status : 500;

    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Falha ao criar produto no site.",
      },
      { status },
    );
  }
}

async function createProductWithSlugRetry({
  apiUrl,
  token,
  baseSlug,
  payload,
}: {
  apiUrl: string;
  token: string;
  baseSlug: string;
  payload: {
    sourceCalculationId: string | null;
    name: string;
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
}): Promise<SuccessfulEcommerceCreateProductResponse> {
  const maxAttempts = 6;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const slug = attempt === 0 ? baseSlug : `${baseSlug}-${attempt + 1}`;
    const createProductResponse = await fetch(`${apiUrl}/api/products`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        id: `site-${Date.now().toString(36)}-${slug}`,
        slug,
        ...payload,
      }),
      cache: "no-store",
    });
    const createProductPayload =
      (await createProductResponse.json()) as EcommerceCreateProductResponse;

    if (createProductResponse.ok && createProductPayload.product) {
      return {
        product: createProductPayload.product,
        productUrl: createProductPayload.productUrl,
      };
    }

    if (
      createProductResponse.status === 409 &&
      isSlugConflictMessage(createProductPayload.message) &&
      attempt < maxAttempts - 1
    ) {
      continue;
    }

    throw new PublishRouteError(
      createProductResponse.status || 500,
      createProductPayload.message ?? "Falha ao criar produto no site.",
    );
  }

  throw new PublishRouteError(
    409,
    "Nao foi possivel gerar um slug unico para este produto.",
  );
}

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeHexColor(value: string) {
  const trimmedValue = value.trim();

  if (/^#[0-9a-fA-F]{6}$/.test(trimmedValue)) {
    return trimmedValue;
  }

  return "#11b8f5";
}

function isDataUrl(value: string) {
  return value.startsWith("data:");
}

function isSlugConflictMessage(message?: string) {
  return typeof message === "string" && message.includes("slug");
}
