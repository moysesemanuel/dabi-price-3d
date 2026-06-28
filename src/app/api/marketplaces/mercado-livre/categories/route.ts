import {
  inferMercadoLivreRootCategoryKey,
  type MercadoLivreOfficialCategoryNode,
  type MercadoLivreOfficialCategoryPathNode,
} from "@/lib/marketplaces/mercado-livre";

type MercadoLivreDomainDiscoveryItem = {
  category_id?: string;
  category_name?: string;
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

const GENERIC_CATEGORIES_ERROR =
  "Falha ao carregar categorias do Mercado Livre.";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const categoryId = searchParams.get("categoryId");
  const query = searchParams.get("q");

  try {
    const payload = categoryId
      ? await fetchChildCategories(categoryId)
      : await searchCategories(query);

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

async function searchCategories(
  query: string | null,
): Promise<MercadoLivreCategoriesResponse> {
  const sanitizedQuery = query?.trim() ?? "";

  if (sanitizedQuery.length < 3) {
    return {
      category: null,
      categories: [],
    };
  }

  const discoveryQueries = buildDiscoveryQueries(sanitizedQuery);
  const discoveredItems = await Promise.all(
    discoveryQueries.map((discoveryQuery) => fetchDomainDiscovery(discoveryQuery)),
  );
  const uniqueCategoryIds = Array.from(
    new Set(
      discoveredItems
        .flat()
        .map((item) => item.category_id)
        .filter((item): item is string => Boolean(item)),
    ),
  );

  if (uniqueCategoryIds.length === 0) {
    return {
      category: null,
      categories: [],
    };
  }

  const detailResults = await Promise.allSettled(
    uniqueCategoryIds.map((categoryId) => fetchCategoryDetail(categoryId)),
  );
  const rankedCategories = detailResults
    .flatMap((result) =>
      result.status === "fulfilled"
        ? buildRankedCandidatesFromDetail(result.value, sanitizedQuery)
        : [],
    )
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => right.score - left.score || left.node.name.localeCompare(right.node.name));
  const categories = Array.from(
    new Map(rankedCategories.map((candidate) => [candidate.node.id, candidate.node])).values(),
  );

  return {
    category: null,
    categories,
  };
}

async function fetchDomainDiscovery(query: string) {
  const searchParams = new URLSearchParams({
    limit: "8",
    q: query,
  });
  const response = await fetch(
    `https://api.mercadolibre.com/sites/MLB/domain_discovery/search?${searchParams.toString()}`,
    {
      headers: {
        accept: "application/json",
      },
      next: { revalidate: 60 * 30 },
    },
  );

  if (!response.ok) {
    throw new Error(GENERIC_CATEGORIES_ERROR);
  }

  return (await response.json()) as MercadoLivreDomainDiscoveryItem[];
}

async function fetchCategoryDetail(categoryId: string) {
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
    throw new Error(GENERIC_CATEGORIES_ERROR);
  }

  return (await response.json()) as MercadoLivreCategoryDetail;
}

async function fetchChildCategories(
  categoryId: string,
): Promise<MercadoLivreCategoriesResponse> {
  const payload = await fetchCategoryDetail(categoryId);
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

function buildRankedCandidatesFromDetail(
  payload: MercadoLivreCategoryDetail,
  query: string,
) {
  const detailNode = toCategoryDetailNode(payload);

  if (!detailNode) {
    return [];
  }

  const rootPathNode = detailNode.pathFromRoot[0];
  const rootNode =
    rootPathNode && rootPathNode.id !== detailNode.id
      ? {
          id: rootPathNode.id,
          name: rootPathNode.name,
          isLeaf: false,
          childrenCount: 1,
          pathFromRoot: [rootPathNode],
          rootCategoryKey: inferMercadoLivreRootCategoryKey(rootPathNode.name),
        }
      : null;

  return [
    {
      node: detailNode,
      score: scoreCategoryMatch(detailNode, query),
    },
    ...(rootNode
      ? [
          {
            node: rootNode,
            score: scoreCategoryMatch(rootNode, query) + 25,
          },
        ]
      : []),
  ];
}

function scoreCategoryMatch(
  category: MercadoLivreOfficialCategoryNode,
  query: string,
) {
  const normalizedQuery = normalizeCategorySearchText(query);
  const queryTokens = normalizedQuery
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);

  if (queryTokens.length === 0) {
    return 0;
  }

  const normalizedName = normalizeCategorySearchText(category.name);
  const normalizedPath = normalizeCategorySearchText(
    category.pathFromRoot.map((node) => node.name).join(" "),
  );
  const nameWords = normalizedName.split(" ").filter(Boolean);
  const pathWords = normalizedPath.split(" ").filter(Boolean);
  const matchedTokens = queryTokens.filter((token) =>
    [...nameWords, ...pathWords].some((word) => isRelevantWordMatch(word, token)),
  );

  if (matchedTokens.length === 0) {
    return 0;
  }

  let score = matchedTokens.length * 20;

  if (startsWithRelevantWords(nameWords, queryTokens)) {
    score += 80;
  } else if (startsWithRelevantWords(pathWords, queryTokens)) {
    score += 60;
  }

  if (includesRelevantWords(nameWords, queryTokens)) {
    score += 30;
  }

  if (category.pathFromRoot.length === 1) {
    score += 10;
  }

  return score;
}

function buildDiscoveryQueries(query: string) {
  const normalizedQuery = normalizeCategorySearchText(query);
  const queryTokens = normalizedQuery
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);
  const joinedTokens = queryTokens.join(" ");
  const firstTwoTokens = queryTokens.slice(0, 2).join(" ");

  return Array.from(
    new Set(
      [query.trim(), joinedTokens, firstTwoTokens, queryTokens[0]]
        .map((item) => item?.trim() ?? "")
        .filter((item) => item.length >= 3),
    ),
  ).slice(0, 4);
}

function normalizeCategorySearchText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function isRelevantWordMatch(word: string, token: string) {
  if (word === token) {
    return true;
  }

  if (token.length >= 5 && word.startsWith(token)) {
    return true;
  }

  return false;
}

function startsWithRelevantWords(words: string[], queryTokens: string[]) {
  if (queryTokens.length === 0 || words.length < queryTokens.length) {
    return false;
  }

  return queryTokens.every((token, index) =>
    isRelevantWordMatch(words[index] ?? "", token),
  );
}

function includesRelevantWords(words: string[], queryTokens: string[]) {
  if (queryTokens.length === 0) {
    return false;
  }

  return queryTokens.every((token) =>
    words.some((word) => isRelevantWordMatch(word, token)),
  );
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
