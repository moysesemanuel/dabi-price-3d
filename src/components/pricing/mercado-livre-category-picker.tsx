"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  MercadoLivreOfficialCategoryNode,
  MercadoLivreRootCategoryKey,
} from "@/lib/marketplaces/mercado-livre";

type MercadoLivreCategoryPickerProps = {
  selectedCategoryId: string;
  selectedCategoryName: string;
  onSelect: (selection: {
    id: string;
    name: string;
    rootCategoryKey: MercadoLivreRootCategoryKey | null;
  }) => void;
  onClear: () => void;
};

type MercadoLivreCategoriesResponse = {
  category: MercadoLivreOfficialCategoryNode | null;
  categories: MercadoLivreOfficialCategoryNode[];
  error?: string;
};

export function MercadoLivreCategoryPicker({
  selectedCategoryId,
  selectedCategoryName,
  onSelect,
  onClear,
}: MercadoLivreCategoryPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [rootCategories, setRootCategories] = useState<
    MercadoLivreOfficialCategoryNode[]
  >([]);
  const [childrenByParentId, setChildrenByParentId] = useState<
    Record<string, MercadoLivreOfficialCategoryNode[]>
  >({});
  const [detailsById, setDetailsById] = useState<
    Record<string, MercadoLivreOfficialCategoryNode>
  >({});
  const [expandedCategoryIds, setExpandedCategoryIds] = useState<string[]>([]);
  const [loadingCategoryIds, setLoadingCategoryIds] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasLoadedRoots, setHasLoadedRoots] = useState(false);

  const selectedCategoryLabel = useMemo(() => {
    if (selectedCategoryName.trim()) {
      return selectedCategoryName.trim();
    }

    if (selectedCategoryId.trim()) {
      return `Categoria selecionada (${selectedCategoryId.trim()})`;
    }

    return "Nenhuma categoria oficial selecionada";
  }, [selectedCategoryId, selectedCategoryName]);

  useEffect(() => {
    if (!isOpen || hasLoadedRoots) {
      return;
    }

    void loadCategories();
  }, [hasLoadedRoots, isOpen]);

  async function loadCategories(categoryId?: string) {
    const isRootRequest = !categoryId;

    if (categoryId) {
      setLoadingCategoryIds((current) => [...current, categoryId]);
    }

    setErrorMessage(null);

    try {
      const searchParams = new URLSearchParams();

      if (categoryId) {
        searchParams.set("categoryId", categoryId);
      }

      const response = await fetch(
        `/api/marketplaces/mercado-livre/categories${
          searchParams.size > 0 ? `?${searchParams.toString()}` : ""
        }`,
        {
          cache: "force-cache",
        },
      );
      const payload = (await response.json().catch(() => null)) as
        | MercadoLivreCategoriesResponse
        | { error?: string }
        | null;

      if (!response.ok || !payload || !("categories" in payload)) {
        throw new Error(
          payload && "error" in payload
            ? payload.error ?? "Falha ao carregar categorias do Mercado Livre."
            : "Falha ao carregar categorias do Mercado Livre.",
        );
      }

      if (isRootRequest) {
        setRootCategories(payload.categories);
        setHasLoadedRoots(true);
      } else if (categoryId) {
        setChildrenByParentId((current) => ({
          ...current,
          [categoryId]: payload.categories,
        }));

        const loadedCategory = payload.category;

        if (loadedCategory) {
          setDetailsById((current) => ({
            ...current,
            [loadedCategory.id]: loadedCategory,
          }));
        }
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Falha ao carregar categorias do Mercado Livre.",
      );
    } finally {
      if (categoryId) {
        setLoadingCategoryIds((current) =>
          current.filter((currentId) => currentId !== categoryId),
        );
      }
    }
  }

  function toggleCategory(category: MercadoLivreOfficialCategoryNode) {
    const isExpanded = expandedCategoryIds.includes(category.id);

    if (isExpanded) {
      setExpandedCategoryIds((current) =>
        current.filter((currentId) => currentId !== category.id),
      );
      return;
    }

    setExpandedCategoryIds((current) => [...current, category.id]);

    if (!(category.id in childrenByParentId) && !loadingCategoryIds.includes(category.id)) {
      void loadCategories(category.id);
    }
  }

  function handleSelectCategory(category: MercadoLivreOfficialCategoryNode) {
    onSelect({
      id: category.id,
      name: category.name,
      rootCategoryKey: category.rootCategoryKey,
    });
    setIsOpen(false);
  }

  return (
    <>
      <div className="rounded-[22px] border border-white/8 bg-[var(--panel-soft)] p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-[var(--muted)]">
              Categoria oficial do ML
            </p>
            <p className="mt-3 text-sm text-white">{selectedCategoryLabel}</p>
            <p className="mt-2 text-xs text-[var(--muted)]">
              Selecione a categoria mais específica possível no catálogo oficial do
              Mercado Livre.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {selectedCategoryId ? (
              <button
                type="button"
                onClick={onClear}
                className="rounded-xl border border-white/8 px-4 py-2 text-sm text-white transition hover:border-white/14 hover:bg-white/4"
              >
                Limpar
              </button>
            ) : null}

            <button
              type="button"
              onClick={() => setIsOpen(true)}
              className="rounded-xl border border-[var(--accent)]/25 bg-[var(--accent-soft)] px-4 py-2 text-sm font-medium text-[var(--accent)] transition hover:border-[var(--accent)]/40"
            >
              Selecionar categoria
            </button>
          </div>
        </div>
      </div>

      {isOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#020611]/80 px-4 py-6 backdrop-blur-sm">
          <div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-[28px] border border-white/10 bg-[#08111f] shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
            <div className="flex items-start justify-between gap-4 border-b border-white/8 px-5 py-5 sm:px-6">
              <div>
                <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-[var(--muted)]">
                  Categorias oficiais do Mercado Livre
                </p>
                <h3 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-white">
                  Escolha a categoria do anúncio
                </h3>
                <p className="mt-2 text-sm text-[var(--muted)]">
                  O seletor carrega as categorias públicas do site MLB e expande as
                  subcategorias em acordeão.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-full border border-white/10 px-4 py-2 text-sm text-white transition hover:border-white/20 hover:bg-white/4"
              >
                Fechar
              </button>
            </div>

            <div className="overflow-y-auto px-5 py-5 sm:px-6">
              {errorMessage ? (
                <div className="mb-4 rounded-[20px] border border-[#dc2828]/25 bg-[#dc2828]/10 px-4 py-4 text-sm text-[#ffb3b3]">
                  {errorMessage}
                </div>
              ) : null}

              {rootCategories.length === 0 && !hasLoadedRoots ? (
                <div className="rounded-[22px] border border-white/8 bg-[var(--panel-soft)] px-5 py-5 text-sm text-[var(--muted)]">
                  Carregando categorias do Mercado Livre...
                </div>
              ) : (
                <div className="space-y-3">
                  {rootCategories.map((category) => (
                    <CategoryAccordion
                      key={category.id}
                      category={detailsById[category.id] ?? category}
                      childrenByParentId={childrenByParentId}
                      detailsById={detailsById}
                      expandedCategoryIds={expandedCategoryIds}
                      loadingCategoryIds={loadingCategoryIds}
                      onToggle={toggleCategory}
                      onSelect={handleSelectCategory}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function CategoryAccordion({
  category,
  childrenByParentId,
  detailsById,
  expandedCategoryIds,
  loadingCategoryIds,
  onToggle,
  onSelect,
  level = 0,
}: {
  category: MercadoLivreOfficialCategoryNode;
  childrenByParentId: Record<string, MercadoLivreOfficialCategoryNode[]>;
  detailsById: Record<string, MercadoLivreOfficialCategoryNode>;
  expandedCategoryIds: string[];
  loadingCategoryIds: string[];
  onToggle: (category: MercadoLivreOfficialCategoryNode) => void;
  onSelect: (category: MercadoLivreOfficialCategoryNode) => void;
  level?: number;
}) {
  const children = childrenByParentId[category.id] ?? [];
  const detail = detailsById[category.id] ?? category;
  const isExpanded = expandedCategoryIds.includes(category.id);
  const isLoading = loadingCategoryIds.includes(category.id);
  const hasKnownChildren = detail.childrenCount > 0 || children.length > 0;
  const canExpand = !detail.isLeaf || hasKnownChildren || level === 0;

  return (
    <div
      className="rounded-[22px] border border-white/8 bg-[var(--panel-soft)]"
      style={{ marginLeft: `${level * 12}px` }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-white">{category.name}</p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            {category.pathFromRoot.map((node) => node.name).join(" › ")}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onSelect(category)}
            className="rounded-xl border border-[var(--accent)]/25 bg-[var(--accent-soft)] px-3 py-2 text-xs font-medium text-[var(--accent)] transition hover:border-[var(--accent)]/40"
          >
            Usar esta categoria
          </button>

          {canExpand ? (
            <button
              type="button"
              onClick={() => onToggle(category)}
              className="rounded-xl border border-white/8 px-3 py-2 text-xs text-white transition hover:border-white/16 hover:bg-white/4"
            >
              {isLoading
                ? "Carregando..."
                : isExpanded
                  ? "Ocultar subcategorias"
                  : "Ver subcategorias"}
            </button>
          ) : null}
        </div>
      </div>

      {isExpanded ? (
        <div className="border-t border-white/8 px-3 py-3">
          {children.length > 0 ? (
            <div className="space-y-3">
              {children.map((child) => (
                <CategoryAccordion
                  key={child.id}
                  category={detailsById[child.id] ?? child}
                  childrenByParentId={childrenByParentId}
                  detailsById={detailsById}
                  expandedCategoryIds={expandedCategoryIds}
                  loadingCategoryIds={loadingCategoryIds}
                  onToggle={onToggle}
                  onSelect={onSelect}
                  level={level + 1}
                />
              ))}
            </div>
          ) : !isLoading ? (
            <div className="rounded-[18px] border border-dashed border-white/10 px-4 py-4 text-xs text-[var(--muted)]">
              Nenhuma subcategoria adicional foi retornada para este nível.
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
