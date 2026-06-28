export type MercadoLivreListingTypeId = "gold_special" | "gold_pro";

export type MercadoLivreRootCategoryKey =
  | "acessorios-para-veiculos"
  | "supermercado"
  | "tecnologia"
  | "casa-e-moveis"
  | "eletrodomesticos"
  | "esportes-e-fitness"
  | "ferramentas"
  | "construcao"
  | "industria-e-comercio"
  | "para-seu-negocio"
  | "pet-shop"
  | "saude"
  | "beleza-e-cuidado-pessoal"
  | "moda"
  | "bebes"
  | "brinquedos";

type MercadoLivreRootCategory = {
  key: MercadoLivreRootCategoryKey;
  label: string;
  localPresetFeePercentage?: Partial<Record<MercadoLivreListingTypeId, number>>;
};

export type MercadoLivreFeePreview = {
  source: "local-preset" | "official-range";
  listingTypeId: MercadoLivreListingTypeId;
  listingTypeLabel: string;
  rootCategoryKey: MercadoLivreRootCategoryKey;
  rootCategoryLabel: string;
  appliedFeePercentage: number | null;
  officialRange: {
    min: number;
    max: number;
  };
  note: string;
};

export type MercadoLivreOfficialCategoryPathNode = {
  id: string;
  name: string;
};

export type MercadoLivreOfficialCategoryNode = {
  id: string;
  name: string;
  isLeaf: boolean;
  childrenCount: number;
  pathFromRoot: MercadoLivreOfficialCategoryPathNode[];
  rootCategoryKey: MercadoLivreRootCategoryKey | null;
};

export const mercadoLivreListingTypes = [
  {
    id: "gold_special",
    label: "Classico",
    officialRange: { min: 10, max: 14 },
  },
  {
    id: "gold_pro",
    label: "Premium",
    officialRange: { min: 15, max: 19 },
  },
] as const;

export const mercadoLivreRootCategories: MercadoLivreRootCategory[] = [
  { key: "acessorios-para-veiculos", label: "Acessorios Para Veiculos" },
  { key: "supermercado", label: "Supermercado" },
  { key: "tecnologia", label: "Tecnologia" },
  {
    key: "casa-e-moveis",
    label: "Casa, Moveis e Decoracao",
    localPresetFeePercentage: {
      gold_special: 11.5,
      gold_pro: 16.5,
    },
  },
  { key: "eletrodomesticos", label: "Eletrodomesticos" },
  { key: "esportes-e-fitness", label: "Esportes e Fitness" },
  { key: "ferramentas", label: "Ferramentas" },
  { key: "construcao", label: "Construcao" },
  { key: "industria-e-comercio", label: "Industria e Comercio" },
  { key: "para-seu-negocio", label: "Para Seu Negocio" },
  { key: "pet-shop", label: "Pet Shop" },
  { key: "saude", label: "Saude" },
  { key: "beleza-e-cuidado-pessoal", label: "Beleza e Cuidado Pessoal" },
  { key: "moda", label: "Moda" },
  { key: "bebes", label: "Bebes" },
  { key: "brinquedos", label: "Brinquedos" },
];

export function getMercadoLivreFeePreview(input: {
  rootCategoryKey: MercadoLivreRootCategoryKey;
  listingTypeId: MercadoLivreListingTypeId;
}): MercadoLivreFeePreview {
  const category =
    mercadoLivreRootCategories.find((item) => item.key === input.rootCategoryKey) ??
    mercadoLivreRootCategories[0];
  const listingType =
    mercadoLivreListingTypes.find((item) => item.id === input.listingTypeId) ??
    mercadoLivreListingTypes[0];

  const localPreset =
    category.localPresetFeePercentage?.[listingType.id] ?? null;

  if (localPreset !== null) {
    return {
      source: "local-preset",
      listingTypeId: listingType.id,
      listingTypeLabel: listingType.label,
      rootCategoryKey: category.key,
      rootCategoryLabel: category.label,
      appliedFeePercentage: localPreset,
      officialRange: listingType.officialRange,
      note:
        "Preset local usado para reproduzir o seletor atual. Para taxa oficial exata, consulte o category_id real via Listing Prices API.",
    };
  }

  return {
    source: "official-range",
    listingTypeId: listingType.id,
    listingTypeLabel: listingType.label,
    rootCategoryKey: category.key,
    rootCategoryLabel: category.label,
    appliedFeePercentage: null,
    officialRange: listingType.officialRange,
    note:
      "Faixa oficial do Mercado Livre. A taxa exata depende da subcategoria/category_id e deve ser consultada na Listing Prices API.",
  };
}

export function inferMercadoLivreRootCategoryKey(
  rootCategoryName: string,
): MercadoLivreRootCategoryKey | null {
  const normalizedRootCategoryName = normalizeMercadoLivreCategoryLabel(
    rootCategoryName,
  );

  const matchedCategory = mercadoLivreRootCategories.find((category) => {
    const normalizedStaticLabel = normalizeMercadoLivreCategoryLabel(
      category.label,
    );

    return (
      normalizedStaticLabel === normalizedRootCategoryName ||
      normalizedStaticLabel.includes(normalizedRootCategoryName) ||
      normalizedRootCategoryName.includes(normalizedStaticLabel)
    );
  });

  return matchedCategory?.key ?? null;
}

function normalizeMercadoLivreCategoryLabel(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
