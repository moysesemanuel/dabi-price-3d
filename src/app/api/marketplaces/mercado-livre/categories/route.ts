import {
  inferMercadoLivreRootCategoryKey,
  type MercadoLivreOfficialCategoryNode,
  type MercadoLivreOfficialCategoryPathNode,
} from "@/lib/marketplaces/mercado-livre";

type MercadoLivreCategoryListItem = {
  id?: string;
  name?: string;
};

type MercadoLivreCategoryDetail = {
  id?: string;
  name?: string;
  children_categories?: Array<{
    id?: string;
    name?: string;
    total_items_in_this_category?: number;
  }>;
  path_from_root?: Array<{
    id?: string;
    name?: string;
  }>;
};

type MercadoLivreCategoriesResponse = {
  category: MercadoLivreOfficialCategoryNode | null;
  categories: MercadoLivreOfficialCategoryNode[];
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const categoryId = searchParams.get("categoryId");

  try {
    const payload = categoryId
      ? await fetchChildCategories(categoryId)
      : await fetchRootCategories();

    return Response.json(payload);
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Falha ao carregar categorias do Mercado Livre.",
      },
      { status: 502 },
    );
  }
}

async function fetchRootCategories(): Promise<MercadoLivreCategoriesResponse> {
  const response = await fetch("https://api.mercadolibre.com/sites/MLB/categories", {
    headers: {
      accept: "application/json",
    },
    next: { revalidate: 60 * 60 * 24 },
  });

  if (!response.ok) {
    throw new Error(
      `Mercado Livre categories(root) returned ${response.status}.`,
    );
  }

  const payload = (await response.json()) as MercadoLivreCategoryListItem[];
  const categories = payload
    .map((item) => toOfficialCategoryNode(item, []))
    .filter((item): item is MercadoLivreOfficialCategoryNode => item !== null);

  return {
    category: null,
    categories,
  };
}

async function fetchChildCategories(
  categoryId: string,
): Promise<MercadoLivreCategoriesResponse> {
  const response = await fetch(
    `https://api.mercadolibre.com/categories/${categoryId}`,
    {
      headers: {
        accept: "application/json",
      },
      next: { revalidate: 60 * 60 * 24 },
    },
  );

  if (!response.ok) {
    throw new Error(
      `Mercado Livre categories(detail) returned ${response.status}.`,
    );
  }

  const payload = (await response.json()) as MercadoLivreCategoryDetail;
  const category = toCategoryDetailNode(payload);

  if (!category) {
    throw new Error("Resposta inválida da categoria do Mercado Livre.");
  }

  const categories = (payload.children_categories ?? [])
    .map((item) => toChildCategoryNode(item, category.pathFromRoot))
    .filter((item): item is MercadoLivreOfficialCategoryNode => item !== null);

  return {
    category,
    categories,
  };
}

function toOfficialCategoryNode(
  item: MercadoLivreCategoryListItem,
  parentPath: MercadoLivreOfficialCategoryPathNode[],
): MercadoLivreOfficialCategoryNode | null {
  if (!item.id || !item.name) {
    return null;
  }

  const pathFromRoot = [...parentPath, { id: item.id, name: item.name }];
  const rootCategoryName = pathFromRoot[0]?.name ?? item.name;

  return {
    id: item.id,
    name: item.name,
    isLeaf: false,
    childrenCount: 0,
    pathFromRoot,
    rootCategoryKey: inferMercadoLivreRootCategoryKey(rootCategoryName),
  };
}

function toCategoryDetailNode(
  payload: MercadoLivreCategoryDetail,
): MercadoLivreOfficialCategoryNode | null {
  if (!payload.id || !payload.name) {
    return null;
  }

  const fallbackCategory = {
    id: payload.id,
    name: payload.name,
  };
  const pathFromRoot = sanitizePathFromRoot(
    payload.path_from_root,
    fallbackCategory,
  );
  const rootCategoryName = pathFromRoot[0]?.name ?? fallbackCategory.name;

  return {
    id: fallbackCategory.id,
    name: fallbackCategory.name,
    isLeaf: (payload.children_categories ?? []).length === 0,
    childrenCount: (payload.children_categories ?? []).length,
    pathFromRoot,
    rootCategoryKey: inferMercadoLivreRootCategoryKey(rootCategoryName),
  };
}

function toChildCategoryNode(
  item: NonNullable<MercadoLivreCategoryDetail["children_categories"]>[number],
  parentPath: MercadoLivreOfficialCategoryPathNode[],
): MercadoLivreOfficialCategoryNode | null {
  if (!item.id || !item.name) {
    return null;
  }

  const pathFromRoot = [...parentPath, { id: item.id, name: item.name }];
  const rootCategoryName = pathFromRoot[0]?.name ?? item.name;

  return {
    id: item.id,
    name: item.name,
    isLeaf: false,
    childrenCount: 0,
    pathFromRoot,
    rootCategoryKey: inferMercadoLivreRootCategoryKey(rootCategoryName),
  };
}

function sanitizePathFromRoot(
  pathFromRoot: MercadoLivreCategoryDetail["path_from_root"],
  fallbackCategory: { id: string; name: string },
) {
  const sanitizedPath = (pathFromRoot ?? [])
    .filter(
      (
        item,
      ): item is {
        id: string;
        name: string;
      } => Boolean(item?.id && item?.name),
    )
    .map((item) => ({
      id: item.id,
      name: item.name,
    }));

  if (sanitizedPath.length > 0) {
    return sanitizedPath;
  }

  return [
    {
      id: fallbackCategory.id,
      name: fallbackCategory.name,
    },
  ];
}
