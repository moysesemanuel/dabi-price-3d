"use client";

import { type ChangeEvent, useMemo, useState } from "react";
import type { PutBlobResult } from "@vercel/blob";
import { upload } from "@vercel/blob/client";
import { buildWorkspaceUploadPath } from "@/lib/client/workspace-upload-path";
import {
  ERP_PRODUCT_PAYLOAD_VERSION,
} from "@/lib/erp-products/types";
import type {
  ErpProductFilamentRequirement,
  ErpProductSaveRequest,
  ErpProductSaveResponse,
  ErpProductUsageType,
} from "@/lib/erp-products/types";
import type { DisplayCurrency } from "@/lib/currency/display-currency";
import type {
  ProductType,
  PricingFormState,
} from "@/lib/pricing/initial-pricing-form";
import { formatCurrency } from "@/lib/pricing/formatters";

type SiteProductPublisherProps = {
  pricingContext: {
    productName: string;
    salePriceInCents: number;
    totalCostInCents: number;
    profitInCents: number;
    marginPercentage: number;
    salesChannelLabel: string;
    salesChannelId: PricingFormState["salesChannelId"];
    productType: ProductType;
    displayCurrency: DisplayCurrency;
    exchangeRateDate: string | null;
    filamentRequirements: ErpProductFilamentRequirement[];
    filamentRequirementsValidationMessage: string | null;
    filamentRequirementsInputWeightTotal: number;
    filamentWeightReferenceGrams: number;
    preferredFilamentMaterial: string | null;
    mercadoLivreCategoryId: string | null;
    mercadoLivreCategoryName: string | null;
  };
  onSaveToErp: (
    payload: Omit<ErpProductSaveRequest, "sourceCalculationId">,
  ) => Promise<ErpProductSaveResponse>;
};

type SiteProductFormState = {
  name: string;
  shortName: string;
  sku: string;
  slug: string;
  category: string;
  material: string;
  dimensions: string;
  imageUrl: string;
  imageFileName: string;
  galleryImages: string[];
  galleryFileNames: string[];
  description: string;
  tagsText: string;
  stockQuantity: number;
  minimumStock: number;
  usageType: ErpProductUsageType;
  mercadoLivreCategoryId: string;
  mercadoLivreCategoryName: string;
  shopeeCategoryId: string;
  shopeeCategoryName: string;
};

type PublishState = "idle" | "submitting" | "success" | "error";
type PublishTarget = "erp" | "mercado-livre" | null;
type ImageUploadState = "idle" | "uploading-main" | "uploading-gallery";
const ACCEPTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;
const ACCEPTED_IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"] as const;
const usageTypeOptions: Array<{
  value: ErpProductUsageType;
  title: string;
  description: string;
}> = [
  {
    value: "SELLABLE",
    title: "Vendavel",
    description: "Produto pronto para venda e publicacao futura pelo ERP.",
  },
  {
    value: "SUPPLY",
    title: "Insumo",
    description: "Materia-prima ou item de consumo sem foco em venda direta.",
  },
  {
    value: "BOTH",
    title: "Ambos",
    description: "Pode ser controlado como venda e tambem como insumo.",
  },
];

export function SiteProductPublisher({
  pricingContext,
  onSaveToErp,
}: SiteProductPublisherProps) {
  const [mode, setMode] = useState<"history" | "site-product">("history");
  const [form, setForm] = useState<SiteProductFormState | null>(null);
  const [hasTouchedSlug, setHasTouchedSlug] = useState(false);
  const [hasTouchedCategory, setHasTouchedCategory] = useState(false);
  const [hasTouchedMaterial, setHasTouchedMaterial] = useState(false);
  const [publishState, setPublishState] = useState<PublishState>("idle");
  const [publishTarget, setPublishTarget] = useState<PublishTarget>(null);
  const [imageUploadState, setImageUploadState] =
    useState<ImageUploadState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const salePriceLabel = useMemo(
    () =>
      formatCurrency(
        pricingContext.salePriceInCents / 100,
        pricingContext.displayCurrency,
      ),
    [pricingContext.displayCurrency, pricingContext.salePriceInCents],
  );
  const resolvedCategory =
    form === null
      ? ""
      : hasTouchedCategory
        ? form.category
        : inferMarketplaceCategoryName(pricingContext, form.category);
  const resolvedMercadoLivreCategoryLabel =
    form === null
      ? ""
      : normalizeOptionalString(form.mercadoLivreCategoryName) ??
        normalizeOptionalString(resolvedCategory) ??
        "";

  const isSiteProductMode = mode === "site-product";
  const isUploadingImages = imageUploadState !== "idle";
  const isErpFormValid =
    form &&
    form.name.trim().length > 0 &&
    resolvedCategory.trim().length > 0 &&
    form.usageType.length > 0;
  const canPublishToMercadoLivre =
    !!form &&
    isErpFormValid &&
    form.usageType !== "SUPPLY" &&
    form.mercadoLivreCategoryId.trim().length > 0 &&
    form.imageUrl.trim().length > 0;

  function activateSiteProductMode() {
    setForm((current) =>
      current
        ? syncFormWithPricingContext(
            current,
            pricingContext,
            hasTouchedCategory,
            hasTouchedMaterial,
          )
        : buildInitialForm(pricingContext),
    );

    setMode("site-product");
  }

  function resetFeedback() {
    setPublishState("idle");
    setPublishTarget(null);
    setErrorMessage(null);
    setSuccessMessage(null);
  }

  function updateField<K extends keyof SiteProductFormState>(
    field: K,
    value: SiteProductFormState[K],
  ) {
    setForm((current) => {
      if (!current) {
        return current;
      }

      const nextForm = {
        ...current,
        [field]: value,
      };

      if (field === "name" && !hasTouchedSlug) {
        nextForm.slug = slugify(String(value));
      }

      if (field === "name" && !hasTouchedCategory) {
        nextForm.category = inferMarketplaceCategoryName(
          {
            ...pricingContext,
            productName: String(value),
          },
          current.category,
        );
      }

      if (field === "material") {
        setHasTouchedMaterial(true);
      }

      return nextForm;
    });
    resetFeedback();
  }

  async function handleMainImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file || !form) {
      return;
    }

    if (!isAcceptedImageFile(file)) {
      setPublishTarget("erp");
      setPublishState("error");
      setErrorMessage("Use apenas arquivos JPEG, JPG, PNG ou WEBP.");
      setSuccessMessage(null);
      event.target.value = "";
      return;
    }

    setImageUploadState("uploading-main");
    resetFeedback();

    try {
      const blob = await uploadProductImage(file, form, "main");
      const nextForm = {
        ...form,
        imageUrl: blob.url,
        imageFileName: file.name,
      };

      setForm(nextForm);
    } catch (error) {
      setPublishTarget("erp");
      setPublishState("error");
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Falha ao enviar a imagem principal.",
      );
    } finally {
      setImageUploadState("idle");
      event.target.value = "";
    }
  }

  async function handleGalleryImagesChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);

    if (files.length === 0 || !form) {
      return;
    }

    const invalidFile = files.find((file) => !isAcceptedImageFile(file));

    if (invalidFile) {
      setPublishTarget("erp");
      setPublishState("error");
      setErrorMessage("Use apenas arquivos JPEG, JPG, PNG ou WEBP.");
      setSuccessMessage(null);
      event.target.value = "";
      return;
    }

    setImageUploadState("uploading-gallery");
    resetFeedback();

    try {
      const blobs = await Promise.all(
        files.map((file) => uploadProductImage(file, form, "gallery")),
      );
      const nextForm = {
        ...form,
        galleryImages: [...form.galleryImages, ...blobs.map((blob) => blob.url)],
        galleryFileNames: [...form.galleryFileNames, ...files.map((file) => file.name)],
      };

      setForm(nextForm);
    } catch (error) {
      setPublishTarget("erp");
      setPublishState("error");
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Falha ao enviar as imagens da galeria.",
      );
    } finally {
      setImageUploadState("idle");
      event.target.value = "";
    }
  }

  function removeMainImage() {
    if (!form) {
      return;
    }

    setForm({
      ...form,
      imageUrl: "",
      imageFileName: "",
    });
    resetFeedback();
  }

  function removeGalleryImage(indexToRemove: number) {
    if (!form) {
      return;
    }

    setForm({
      ...form,
      galleryImages: form.galleryImages.filter((_, index) => index !== indexToRemove),
      galleryFileNames: form.galleryFileNames.filter(
        (_, index) => index !== indexToRemove,
      ),
    });
    resetFeedback();
  }

  async function handleSaveToErp(publishToMercadoLivre = false) {
    if (!form) {
      return;
    }

    if (pricingContext.filamentRequirementsValidationMessage) {
      setPublishTarget(publishToMercadoLivre ? "mercado-livre" : "erp");
      setPublishState("error");
      setErrorMessage(pricingContext.filamentRequirementsValidationMessage);
      setSuccessMessage(null);
      return;
    }

    setPublishTarget(publishToMercadoLivre ? "mercado-livre" : "erp");
    setPublishState("submitting");
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await onSaveToErp({
        payloadVersion: ERP_PRODUCT_PAYLOAD_VERSION,
        tenantContext: null,
        pricingMetadata: {
          calculatedAt: new Date().toISOString(),
          sourceSalesChannelId: pricingContext.salesChannelId || null,
          sourceSalesChannelLabel: pricingContext.salesChannelLabel,
          displayCurrency: pricingContext.displayCurrency,
          exchangeRateDate: pricingContext.exchangeRateDate,
          productType: pricingContext.productType,
          salePriceInCents: pricingContext.salePriceInCents,
          totalCostInCents: pricingContext.totalCostInCents,
          profitInCents: pricingContext.profitInCents,
          profitPerHourInCents: 0,
          marginPercentage: pricingContext.marginPercentage,
        },
        publishToMercadoLivre,
        name: form.name.trim(),
        slug: slugify(form.slug || form.name),
        shortName: normalizeNullableString(form.shortName),
        sku: normalizeNullableString(form.sku),
        description: normalizeNullableString(form.description),
        category: resolvedCategory.trim(),
        material: normalizeNullableString(form.material),
        dimensions: normalizeNullableString(form.dimensions),
        tags: parseLinesOrCsv(form.tagsText),
        mainImageUrl: normalizeNullableString(form.imageUrl),
        galleryImageUrls: form.galleryImages,
        finalPriceInCents: pricingContext.salePriceInCents,
        totalCostInCents: pricingContext.totalCostInCents,
        stockQuantity: Math.max(form.stockQuantity, 0),
        minimumStock: Math.max(form.minimumStock, 0),
        usageType: form.usageType,
        filamentRequirements: pricingContext.filamentRequirements,
        mercadoLivreCategoryId: normalizeNullableString(
          form.mercadoLivreCategoryId,
        ),
        mercadoLivreCategoryName:
          pricingContext.salesChannelId === "mercado-livre"
            ? normalizeNullableString(resolvedCategory)
            : normalizeNullableString(form.mercadoLivreCategoryName),
        shopeeCategoryId: normalizeNullableString(form.shopeeCategoryId),
        shopeeCategoryName:
          pricingContext.salesChannelId === "shopee"
            ? normalizeNullableString(resolvedCategory)
            : normalizeNullableString(form.shopeeCategoryName),
      });

      if (response.product?.sku) {
        setForm((current) =>
          current
            ? {
                ...current,
                sku: String(response.product.sku),
              }
            : current,
        );
      }

      setSuccessMessage(
        response.mercadoLivre?.published
          ? "Produto salvo no ERP e marcado para publicação no Mercado Livre via ERP."
          : "Produto enviado ao ERP com sucesso.",
      );
      setPublishState("success");
    } catch (error) {
      setPublishState("error");
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Falha ao enviar produto ao ERP.",
      );
    }
  }

  return (
    <section className="rounded-[26px] border border-[#e9ddd4] bg-white p-5 shadow-[0_18px_40px_rgba(0,0,0,0.22)] sm:p-6">
      <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-[#7c6858]">
        Destino do cálculo
      </p>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <ChoiceCard
          title="Só salvar cálculo"
          description="Mantém o fluxo atual no histórico local."
          active={mode === "history"}
          onClick={() => setMode("history")}
        />

        <ChoiceCard
          title="Produto do ERP"
          description="Prepara a ficha comercial, salva no ERP e deixa a publicação sob governança do ERP."
          active={isSiteProductMode}
          onClick={activateSiteProductMode}
        />
      </div>

      {isSiteProductMode && form ? (
        <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-4">
            <div className="rounded-[22px] border border-black/8 bg-[#fff3ea] p-4">
              <div className="grid gap-3 md:grid-cols-3">
                <InfoStat label="Produto base" value={pricingContext.productName} />
                <InfoStat
                  label="Canal usado"
                  value={pricingContext.salesChannelLabel}
                />
                <InfoStat
                  label="Margem real"
                  value={`${pricingContext.marginPercentage
                    .toFixed(1)
                    .replace(".", ",")}%`}
                />
              </div>
            </div>

            <div className="rounded-[22px] border border-black/8 bg-[#fff3ea] p-4">
              <SectionTitle title="Dados principais" />

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <Field
                  label="Nome do produto"
                  value={form.name}
                  onChange={(value) => updateField("name", value)}
                />

                <Field
                  label="Nome curto"
                  value={form.shortName}
                  onChange={(value) => updateField("shortName", value)}
                  note="Opcional, usado tambem pelo ERP."
                />

                <Field
                  label="SKU"
                  value={form.sku}
                  onChange={(value) => updateField("sku", value)}
                  note="Mantenha um SKU estavel para o upsert no ERP."
                />

                <Field
                  label="Slug / identificador legível"
                  value={form.slug}
                  onChange={(value) => {
                    setHasTouchedSlug(true);
                    updateField("slug", value);
                  }}
                  note="Identificador derivável para ERP e canais de venda."
                />

                <Field
                  label="Material"
                  value={form.material}
                  onChange={(value) => updateField("material", value)}
                />

                <Field
                  label="Dimensões"
                  value={form.dimensions}
                  onChange={(value) => updateField("dimensions", value)}
                  note="Ex.: 15 x 9 x 6 cm"
                />
              </div>
            </div>

            <div className="rounded-[22px] border border-black/8 bg-[#fff3ea] p-4">
              <SectionTitle title="Ficha comercial" />

              <div className="mt-5 space-y-4">
                <TextArea
                  label="Descrição"
                  value={form.description}
                  onChange={(value) => updateField("description", value)}
                  rows={7}
                />

                <div className="grid gap-4 md:grid-cols-2">
                  <FileField
                    label="Imagem principal"
                    accept=".jpg,.jpeg,.png,.webp"
                    helper={
                      imageUploadState === "uploading-main"
                        ? "Enviando imagem principal para o storage..."
                        : "Arquivo enviado para storage publico e convertido em URL automaticamente."
                    }
                    onChange={handleMainImageChange}
                    disabled={imageUploadState !== "idle"}
                  />

                  <TextArea
                    label="Tags"
                    value={form.tagsText}
                    onChange={(value) => updateField("tagsText", value)}
                    rows={4}
                    note="Separe por vírgula ou uma por linha."
                  />
                </div>

                <FileField
                  label="Galeria de imagens"
                  accept=".jpg,.jpeg,.png,.webp"
                  helper={
                    imageUploadState === "uploading-gallery"
                      ? "Enviando imagens da galeria para o storage..."
                      : "Voce pode selecionar varias imagens de uma vez."
                  }
                  multiple
                  onChange={handleGalleryImagesChange}
                  disabled={imageUploadState !== "idle"}
                />

                {form.imageUrl ? (
                  <ImagePreviewCard
                    title="Imagem principal"
                    imageUrl={form.imageUrl}
                    fileName={form.imageFileName}
                    onRemove={removeMainImage}
                  />
                ) : null}

                {form.galleryImages.length > 0 ? (
                  <div className="rounded-[18px] border border-black/8 bg-white p-4">
                    <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-[#7c6858]">
                      Galeria
                    </p>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      {form.galleryImages.map((imageUrl, index) => (
                        <ImagePreviewCard
                          key={`${form.galleryFileNames[index] ?? "imagem"}-${index}`}
                          title={`Imagem ${index + 1}`}
                          imageUrl={imageUrl}
                          fileName={form.galleryFileNames[index] ?? `Imagem ${index + 1}`}
                          onRemove={() => removeGalleryImage(index)}
                        />
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="rounded-[22px] border border-black/8 bg-[#fff3ea] p-4">
              <SectionTitle title="ERP e marketplaces" />

              <div className="mt-5 grid gap-3 md:grid-cols-3">
                {usageTypeOptions.map((option) => (
                  <ChoiceCard
                    key={option.value}
                    title={option.title}
                    description={option.description}
                    active={form.usageType === option.value}
                    onClick={() => updateField("usageType", option.value)}
                  />
                ))}
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <Field
                  label="Categoria principal"
                  value={resolvedCategory}
                  onChange={(value) => {
                    setHasTouchedCategory(true);
                    updateField("category", value);
                  }}
                  note={
                    pricingContext.salesChannelId === "mercado-livre"
                      ? "Preenchida com a categoria oficial do Mercado Livre quando houver contexto."
                      : "Preencha com a categoria oficial do marketplace para evitar falha na publicação."
                  }
                />

                <Field
                  label="Estoque inicial"
                  value={String(form.stockQuantity)}
                  onChange={(value) =>
                    updateField("stockQuantity", parseInteger(value))
                  }
                  note="Use 0 para deixar pronto para publicar depois pelo ERP."
                />

                <Field
                  label="Estoque mínimo"
                  value={String(form.minimumStock)}
                  onChange={(value) =>
                    updateField("minimumStock", parseInteger(value))
                  }
                  note="Padrao recomendado: 0."
                />

                {pricingContext.salesChannelId === "mercado-livre" ? (
                  <Field
                    label="Categoria ML"
                    value={resolvedMercadoLivreCategoryLabel}
                    onChange={() => undefined}
                    readOnly
                    note={
                      form.mercadoLivreCategoryId.trim()
                        ? `Código enviado ao ERP: ${form.mercadoLivreCategoryId}`
                        : "Preenchido automaticamente quando houver contexto ML."
                    }
                  />
                ) : null}

                {pricingContext.salesChannelId === "shopee" ? (
                  <Field
                    label="Categoria Shopee ID"
                    value={form.shopeeCategoryId}
                    onChange={(value) => updateField("shopeeCategoryId", value)}
                    note="Use o ID mapeado para a categoria principal do produto."
                  />
                ) : null}
              </div>
            </div>
          </div>

          <aside className="xl:sticky xl:top-6">
            <section className="rounded-[22px] border border-black/8 bg-[#fff3ea] p-4">
              <SectionTitle title="Resumo da publicação" />

              <div className="mt-5 rounded-[22px] border border-[#ff6a00] bg-[#ff6a00] p-5">
                <p className="text-sm font-semibold text-white">
                  Preço de venda
                </p>
                <strong className="mt-2 block text-3xl font-semibold tracking-[-0.04em] text-white">
                  {salePriceLabel}
                </strong>
                <p className="mt-2 text-xs text-white/85">
                  Valor importado da precificadora. O ERP seguirá como origem
                  oficial do catálogo e da publicação no e-commerce.
                </p>
              </div>

              <div className="mt-5 grid gap-4">
                <SummaryLine label="Produto" value={form.name || "Sem nome"} />
                <SummaryLine label="SKU" value={form.sku || "-"} />
                <SummaryLine label="Slug" value={slugify(form.slug) || "-"} />
                <SummaryLine label="Categoria" value={resolvedCategory} />
                <SummaryLine label="Uso no ERP" value={form.usageType} />
                <SummaryLine
                  label="Versão do contrato"
                  value={ERP_PRODUCT_PAYLOAD_VERSION}
                />
                <SummaryLine
                  label="Filamento ERP"
                  value={
                    pricingContext.productType === "3d"
                      ? `${pricingContext.filamentRequirements.length} cor(es) · ${pricingContext.filamentRequirementsInputWeightTotal.toFixed(2)} g`
                      : "Nao se aplica"
                  }
                />
              </div>

              {pricingContext.productType === "3d" ? (
                <p className="mt-5 text-xs leading-6 text-[#7c6858]">
                  O ERP receberá a composição de filamento por cor para atualizar
                  o estoque. Peso base atual:{" "}
                  {pricingContext.filamentWeightReferenceGrams.toFixed(2)} g.
                </p>
              ) : null}

              {publishState === "error" && errorMessage ? (
                <div className="mt-5 rounded-[18px] border border-[#ff6a00] bg-[#ff6a00] px-4 py-4 text-sm text-white">
                  {errorMessage}
                </div>
              ) : null}

              {publishState === "success" && successMessage ? (
                <div className="mt-5 rounded-[18px] border border-black/8 bg-white px-4 py-4 text-sm text-[#18120d]">
                  {successMessage}
                </div>
              ) : null}

              <div className="mt-6 rounded-[18px] border border-black/8 bg-white px-4 py-4 text-sm text-[#7c6858]">
                A precificadora apenas prepara e envia o produto ao ERP. Se
                houver publicação adicional, ela deve acontecer sob governança
                do ERP, inclusive para marketplaces.
              </div>

              <div className="mt-3 grid gap-3">
                <button
                  type="button"
                  onClick={() => handleSaveToErp(false)}
                  disabled={
                    !isErpFormValid ||
                    publishState === "submitting" ||
                    isUploadingImages
                  }
                  className="w-full rounded-2xl border border-black/8 bg-white px-4 py-4 text-base font-semibold text-[#18120d] transition hover:border-[#ff6a00]/30 hover:bg-[#ff6a00] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {publishState === "submitting" && publishTarget === "erp"
                    ? "Enviando ao ERP..."
                    : isUploadingImages
                      ? "Enviando imagens..."
                      : "Salvar no ERP"}
                </button>

                <button
                  type="button"
                  onClick={() => handleSaveToErp(true)}
                  disabled={
                    !canPublishToMercadoLivre ||
                    publishState === "submitting" ||
                    isUploadingImages
                  }
                  className="w-full rounded-2xl border border-[#ff6a00] bg-[#ff6a00] px-4 py-4 text-base font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {publishState === "submitting" &&
                  publishTarget === "mercado-livre"
                    ? "Salvando no ERP e enviando ao ML..."
                    : "Salvar no ERP e solicitar envio ao ML"}
                </button>
              </div>

              {!canPublishToMercadoLivre ? (
                <p className="mt-3 text-xs leading-5 text-[#7c6858]">
                  Para enviar ao Mercado Livre, mantenha o produto como vendavel
                  ou ambos, informe uma categoria ML valida e envie a imagem
                  principal.
                </p>
              ) : null}
            </section>
          </aside>
        </div>
      ) : null}
    </section>
  );
}

function buildInitialForm(
  pricingContext: SiteProductPublisherProps["pricingContext"],
): SiteProductFormState {
  const defaultMaterial =
    pricingContext.productType === "3d"
      ? inferPreferredFilamentMaterial(pricingContext)
      : "Produto pronto";
  const defaultName = pricingContext.productName.trim() || "Sem nome";
  const defaultShortName = buildShortName(defaultName);

  return {
    name: defaultName,
    shortName: defaultShortName,
    sku: buildSku(defaultName),
    slug: slugify(defaultName),
    category: inferMarketplaceCategoryName(pricingContext),
    material: defaultMaterial,
    dimensions: "",
    imageUrl: "",
    imageFileName: "",
    galleryImages: [],
    galleryFileNames: [],
    description: buildDefaultDescription(defaultName, defaultMaterial),
    tagsText:
      pricingContext.productType === "3d" ? "3d, impresso em 3d" : "produto",
    stockQuantity: 0,
    minimumStock: 0,
    usageType: "SELLABLE",
    mercadoLivreCategoryId: pricingContext.mercadoLivreCategoryId ?? "",
    mercadoLivreCategoryName: pricingContext.mercadoLivreCategoryName ?? "",
    shopeeCategoryId: "",
    shopeeCategoryName: "",
  };
}

function syncFormWithPricingContext(
  form: SiteProductFormState,
  pricingContext: SiteProductPublisherProps["pricingContext"],
  hasTouchedCategory: boolean,
  hasTouchedMaterial: boolean,
): SiteProductFormState {
  return {
    ...form,
    category: hasTouchedCategory
      ? form.category
      : inferMarketplaceCategoryName(pricingContext, form.category),
    material: hasTouchedMaterial
      ? form.material
      : inferPreferredFilamentMaterial(pricingContext, form.material),
    mercadoLivreCategoryId: pricingContext.mercadoLivreCategoryId ?? "",
    mercadoLivreCategoryName: pricingContext.mercadoLivreCategoryName ?? "",
  };
}

function inferPreferredFilamentMaterial(
  pricingContext: SiteProductPublisherProps["pricingContext"],
  fallbackMaterial = "",
) {
  const filamentMaterial = normalizeOptionalString(
    pricingContext.preferredFilamentMaterial ?? "",
  );

  return filamentMaterial ?? normalizeOptionalString(fallbackMaterial) ?? "PLA";
}

function inferMarketplaceCategoryName(
  pricingContext: SiteProductPublisherProps["pricingContext"],
  fallbackCategory = "",
) {
  const officialMercadoLivreCategory = normalizeOptionalString(
    pricingContext.mercadoLivreCategoryName ?? "",
  );

  if (officialMercadoLivreCategory) {
    return officialMercadoLivreCategory;
  }

  return normalizeOptionalString(fallbackCategory) ?? officialMercadoLivreCategory ?? "";
}

function buildDefaultDescription(name: string, material: string) {
  return [
    `${name} produzido em ${material}.`,
    "",
    "Descreva aqui o uso do produto, acabamento, compatibilidade e diferenciais para ERP e canais de venda.",
  ].join("\n");
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

function buildSku(value: string) {
  const normalizedValue = slugify(value).toUpperCase();

  return normalizedValue || "PRODUTO";
}

function buildShortName(value: string) {
  return value.trim().slice(0, 60);
}

function parseLinesOrCsv(value: string) {
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseInteger(value: string) {
  const digits = value.replace(/[^\d-]/g, "");
  const parsedValue = Number(digits);

  if (!Number.isFinite(parsedValue)) {
    return 0;
  }

  return Math.max(Math.trunc(parsedValue), 0);
}

function normalizeOptionalString(value: string) {
  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : undefined;
}

function normalizeNullableString(value: string) {
  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : null;
}

function isAcceptedImageFile(file: File) {
  if (
    ACCEPTED_IMAGE_TYPES.includes(
      file.type as (typeof ACCEPTED_IMAGE_TYPES)[number],
    )
  ) {
    return true;
  }

  const lowerCaseName = file.name.toLowerCase();
  return ACCEPTED_IMAGE_EXTENSIONS.some((extension) =>
    lowerCaseName.endsWith(extension),
  );
}

async function uploadProductImage(
  file: File,
  form: SiteProductFormState,
  kind: "main" | "gallery",
): Promise<PutBlobResult> {
  const pathname = buildBlobPath(form, file.name, kind);

  try {
    return await upload(pathname, file, {
      access: "public",
      contentType: file.type || undefined,
      handleUploadUrl: "/api/erp-products/assets/upload",
    });
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? error.message
        : "Falha ao enviar imagem para o storage.",
    );
  }
}

function buildBlobPath(
  form: SiteProductFormState,
  fileName: string,
  kind: "main" | "gallery",
) {
  const safeSlug = slugify(form.slug || form.name || "produto");
  const safeFileName = fileName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return buildWorkspaceUploadPath(
    "erp-products",
    `${safeSlug}/${kind}-${safeFileName || "image"}`,
  );
}

function ChoiceCard({
  title,
  description,
  active,
  onClick,
}: {
  title: string;
  description: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-[22px] border px-5 py-4 text-left transition ${
        active
          ? "border-[#ff6a00] bg-[#ff6a00] text-white shadow-[inset_0_0_0_1px_rgba(196,78,0,0.14)]"
          : "border-black/8 bg-white text-[#18120d] hover:border-[#ff6a00]/30 hover:bg-[#ff6a00]"
      }`}
    >
      <strong className="block text-lg font-semibold tracking-[-0.04em]">
        {title}
      </strong>
      <span
        className={`mt-2 block text-sm ${
          active ? "text-white/80" : "text-[#7c6858]"
        }`}
      >
        {description}
      </span>
    </button>
  );
}

function SectionTitle({ title }: { title: string }) {
  return (
    <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-[#7c6858]">
      {title}
    </p>
  );
}

function InfoStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[18px] border border-black/8 bg-white px-4 py-4">
      <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-[#7c6858]">
        {label}
      </p>
      <p className="mt-3 text-sm font-medium text-[#18120d]">{value}</p>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  note,
  readOnly = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  note?: string;
  readOnly?: boolean;
}) {
  return (
    <label className="block">
      <span className="font-mono text-[11px] uppercase tracking-[0.24em] text-[#7c6858]">
        {label}
      </span>

      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        readOnly={readOnly}
        className={`mt-2 w-full rounded-[20px] border border-black/8 bg-white px-4 py-3 text-base text-[#18120d] outline-none transition placeholder:text-[#7c6858] focus:border-[#ff6a00]/40 ${
          readOnly ? "cursor-default bg-[#faf6f2]" : ""
        }`}
      />

      {note ? <p className="mt-2 text-xs text-[#7c6858]">{note}</p> : null}
    </label>
  );
}

function TextArea({
  label,
  value,
  onChange,
  rows,
  note,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows: number;
  note?: string;
}) {
  return (
    <label className="block">
      <span className="font-mono text-[11px] uppercase tracking-[0.24em] text-[#7c6858]">
        {label}
      </span>

      <textarea
        value={value}
        rows={rows}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-[20px] border border-black/8 bg-white px-4 py-3 text-base text-[#18120d] outline-none transition placeholder:text-[#7c6858] focus:border-[#ff6a00]/40"
      />

      {note ? <p className="mt-2 text-xs text-[#7c6858]">{note}</p> : null}
    </label>
  );
}

function FileField({
  label,
  accept,
  helper,
  multiple = false,
  onChange,
  disabled = false,
}: {
  label: string;
  accept: string;
  helper: string;
  multiple?: boolean;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void | Promise<void>;
  disabled?: boolean;
}) {
  return (
    <label className="block">
      <span className="font-mono text-[11px] uppercase tracking-[0.24em] text-[#7c6858]">
        {label}
      </span>

      <input
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={onChange}
        disabled={disabled}
        className="mt-2 block w-full rounded-[20px] border border-black/8 bg-white px-4 py-3 text-sm text-[#18120d] file:mr-4 file:rounded-full file:border-0 file:bg-[#ff6a00] file:px-4 file:py-2 file:text-sm file:font-medium file:text-white disabled:cursor-not-allowed disabled:opacity-60"
      />

      <p className="mt-2 text-xs text-[#7c6858]">{helper}</p>
    </label>
  );
}

function SummaryLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-[18px] border border-black/8 bg-white px-4 py-3">
      <span className="text-sm text-[#7c6858]">{label}</span>
      <strong className="text-sm text-[#18120d]">{value}</strong>
    </div>
  );
}

function ImagePreviewCard({
  title,
  imageUrl,
  fileName,
  onRemove,
}: {
  title: string;
  imageUrl: string;
  fileName: string;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-[18px] border border-black/8 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-[#7c6858]">
            {title}
          </p>
          <p className="mt-2 text-sm text-[#18120d]">{fileName}</p>
        </div>

        <button
          type="button"
          onClick={onRemove}
          className="rounded-full border border-black/8 px-3 py-1 text-xs text-[#18120d] transition hover:border-[#ff6a00]/30 hover:bg-[#ff6a00]"
        >
          Remover
        </button>
      </div>

      <div className="relative mt-4 h-36 overflow-hidden rounded-[16px]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt={fileName}
          className="size-full object-cover"
        />
      </div>
    </div>
  );
}
