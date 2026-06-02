"use client";

import { type ChangeEvent, useMemo, useState } from "react";
import Image from "next/image";
import type { ProductType } from "@/lib/pricing/initial-pricing-form";
import { formatCurrency } from "@/lib/pricing/formatters";
import type {
  SiteProductPublishRequest,
  SiteProductPublishResponse,
} from "@/lib/site-products/types";

type SiteProductPublisherProps = {
  pricingContext: {
    productName: string;
    salePriceInCents: number;
    marginPercentage: number;
    salesChannelLabel: string;
    productType: ProductType;
  };
  onPublish: (
    payload: Omit<SiteProductPublishRequest, "sourceCalculationId">,
  ) => Promise<SiteProductPublishResponse>;
};

type SiteProductFormState = {
  name: string;
  slug: string;
  compareAtPrice: string;
  category: string;
  material: string;
  dimensions: string;
  accentColor: string;
  imageUrl: string;
  imageFileName: string;
  galleryImages: string[];
  galleryFileNames: string[];
  featured: boolean;
  description: string;
  tagsText: string;
};

type PublishState = "idle" | "submitting" | "success" | "error";

const categoryOptions = [
  { value: "decor", label: "Decor" },
  { value: "gaming", label: "Gaming" },
  { value: "fashion", label: "Fashion" },
  { value: "workspace", label: "Workspace" },
];
const ACCEPTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;
const ACCEPTED_IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"] as const;

export function SiteProductPublisher({
  pricingContext,
  onPublish,
}: SiteProductPublisherProps) {
  const [mode, setMode] = useState<"history" | "site-product">("history");
  const [form, setForm] = useState<SiteProductFormState | null>(null);
  const [hasTouchedSlug, setHasTouchedSlug] = useState(false);
  const [publishState, setPublishState] = useState<PublishState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [publishedProductUrl, setPublishedProductUrl] = useState<string | null>(
    null,
  );

  const salePriceLabel = useMemo(
    () => formatCurrency(pricingContext.salePriceInCents / 100, "BRL"),
    [pricingContext.salePriceInCents],
  );

  const isSiteProductMode = mode === "site-product";
  const isFormValid =
    form &&
    form.name.trim().length > 0 &&
    form.slug.trim().length > 0 &&
    form.category.trim().length > 0 &&
    form.material.trim().length > 0 &&
    form.dimensions.trim().length > 0 &&
    form.description.trim().length > 0;

  function activateSiteProductMode() {
    if (!form) {
      setForm(buildInitialForm(pricingContext));
    }

    setMode("site-product");
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

      return nextForm;
    });
  }

  async function handleMainImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file || !form) {
      return;
    }

    if (!isAcceptedImageFile(file)) {
      setPublishState("error");
      setErrorMessage("Use apenas arquivos JPEG, JPG, PNG ou WEBP.");
      event.target.value = "";
      return;
    }

    const dataUrl = await readFileAsDataUrl(file);
    setErrorMessage(null);
    setPublishState("idle");
    setForm({
      ...form,
      imageUrl: dataUrl,
      imageFileName: file.name,
    });
    event.target.value = "";
  }

  async function handleGalleryImagesChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);

    if (files.length === 0 || !form) {
      return;
    }

    const invalidFile = files.find((file) => !isAcceptedImageFile(file));

    if (invalidFile) {
      setPublishState("error");
      setErrorMessage("Use apenas arquivos JPEG, JPG, PNG ou WEBP.");
      event.target.value = "";
      return;
    }

    const dataUrls = await Promise.all(files.map((file) => readFileAsDataUrl(file)));
    setErrorMessage(null);
    setPublishState("idle");
    setForm({
      ...form,
      galleryImages: [...form.galleryImages, ...dataUrls],
      galleryFileNames: [...form.galleryFileNames, ...files.map((file) => file.name)],
    });
    event.target.value = "";
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
  }

  async function handlePublish() {
    if (!form) {
      return;
    }

    const compareAtPriceInCents = parseMoneyToCents(form.compareAtPrice);

    setPublishState("submitting");
    setErrorMessage(null);

    try {
      const response = await onPublish({
        name: form.name.trim(),
        slug: slugify(form.slug),
        priceInCents: pricingContext.salePriceInCents,
        category: form.category,
        material: form.material.trim(),
        dimensions: form.dimensions.trim(),
        accentColor: normalizeHexColor(form.accentColor),
        featured: form.featured,
        description: form.description.trim(),
        tags: parseLinesOrCsv(form.tagsText),
        imageUrl: normalizeOptionalString(form.imageUrl),
        galleryImages: form.galleryImages,
        ...(compareAtPriceInCents &&
        compareAtPriceInCents > pricingContext.salePriceInCents
          ? { compareAtPriceInCents }
          : {}),
      });

      setPublishedProductUrl(response.productUrl);
      setPublishState("success");
    } catch (error) {
      setPublishState("error");
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Falha ao criar produto no site.",
      );
    }
  }

  return (
    <section className="rounded-[26px] border border-[var(--panel-border)] bg-[var(--panel)] p-5 shadow-[0_18px_40px_rgba(0,0,0,0.22)] sm:p-6">
      <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-[var(--muted)]">
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
          title="Produto do site"
          description="Abre os campos do catálogo e publica no e-commerce."
          active={isSiteProductMode}
          onClick={activateSiteProductMode}
        />
      </div>

      {isSiteProductMode && form ? (
        <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-4">
            <div className="rounded-[22px] border border-white/8 bg-[var(--panel-soft)] p-4">
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

            <div className="rounded-[22px] border border-white/8 bg-[var(--panel-soft)] p-4">
              <SectionTitle title="Dados principais" />

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <Field
                  label="Nome do produto"
                  value={form.name}
                  onChange={(value) => updateField("name", value)}
                />

                <Field
                  label="Slug"
                  value={form.slug}
                  onChange={(value) => {
                    setHasTouchedSlug(true);
                    updateField("slug", value);
                  }}
                  note="URL do produto no site."
                />

                <SelectField
                  label="Categoria"
                  value={form.category}
                  options={categoryOptions}
                  onChange={(value) => updateField("category", value)}
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

                <label className="block">
                  <span className="font-mono text-[11px] uppercase tracking-[0.24em] text-[var(--muted)]">
                    Cor de destaque
                  </span>

                  <div className="mt-2 flex items-center gap-3 rounded-[20px] border border-white/10 bg-[#0d182b] px-4 py-3">
                    <input
                      type="color"
                      value={normalizeHexColor(form.accentColor)}
                      onChange={(event) =>
                        updateField("accentColor", event.target.value)
                      }
                      className="size-10 rounded-xl border border-white/10 bg-transparent"
                    />

                    <input
                      value={form.accentColor}
                      onChange={(event) =>
                        updateField("accentColor", event.target.value)
                      }
                      className="min-w-0 flex-1 bg-transparent text-white outline-none"
                    />
                  </div>
                </label>
              </div>
            </div>

            <div className="rounded-[22px] border border-white/8 bg-[var(--panel-soft)] p-4">
              <SectionTitle title="Conteúdo do catálogo" />

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
                    helper="Selecione um arquivo JPEG, JPG, PNG ou WEBP."
                    onChange={handleMainImageChange}
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
                  helper="Você pode selecionar várias imagens de uma vez."
                  multiple
                  onChange={handleGalleryImagesChange}
                />

                {form.imageUrl ? (
                  <ImagePreviewCard
                    title="Imagem principal selecionada"
                    imageUrl={form.imageUrl}
                    fileName={form.imageFileName}
                    onRemove={removeMainImage}
                  />
                ) : null}

                {form.galleryImages.length > 0 ? (
                  <div className="rounded-[18px] border border-white/8 bg-[#0d182b] p-4">
                    <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-[var(--muted)]">
                      Galeria selecionada
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
          </div>

          <aside className="xl:sticky xl:top-6">
            <section className="rounded-[22px] border border-white/8 bg-[var(--panel-soft)] p-4">
              <SectionTitle title="Resumo da publicação" />

              <div className="mt-5 rounded-[22px] border border-[var(--accent)]/30 bg-[var(--accent-soft)] p-5">
                <p className="text-sm font-semibold text-[var(--accent)]">
                  Preço de venda
                </p>
                <strong className="mt-2 block text-3xl font-semibold tracking-[-0.04em] text-[var(--accent)]">
                  {salePriceLabel}
                </strong>
                <p className="mt-2 text-xs text-[var(--muted)]">
                  Valor importado da precificadora. O cadastro do site será
                  publicado com este preço.
                </p>
              </div>

              <div className="mt-5 grid gap-4">
                <div className="rounded-[18px] border border-white/6 bg-[#0d182b] px-4 py-4">
                  <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-[var(--muted)]">
                    Preço promocional opcional
                  </p>
                  <input
                    value={form.compareAtPrice}
                    onChange={(event) =>
                      updateField("compareAtPrice", event.target.value)
                    }
                    placeholder="Ex.: 149,90"
                    className="mt-3 w-full bg-transparent text-lg text-white outline-none placeholder:text-[#5d7398]"
                  />
                </div>

                <SummaryLine label="Produto" value={form.name || "Sem nome"} />
                <SummaryLine label="Slug" value={slugify(form.slug) || "-"} />
                <SummaryLine label="Categoria" value={form.category} />
                <SummaryLine
                  label="Destaque"
                  value={form.featured ? "Sim" : "Não"}
                />
              </div>

              <label className="mt-5 flex items-center gap-3 rounded-[18px] border border-white/8 bg-[#0d182b] px-4 py-4">
                <input
                  type="checkbox"
                  checked={form.featured}
                  onChange={(event) =>
                    updateField("featured", event.target.checked)
                  }
                  className="size-4 rounded border-white/20 bg-transparent"
                />
                <div>
                  <p className="text-sm font-medium text-white">
                    Marcar como destaque
                  </p>
                  <p className="text-xs text-[var(--muted)]">
                    O produto entra como destaque no catálogo do site.
                  </p>
                </div>
              </label>

              {publishState === "error" && errorMessage ? (
                <div className="mt-5 rounded-[18px] border border-[#dc2828]/25 bg-[#dc2828]/10 px-4 py-4 text-sm text-[#ffb3b3]">
                  {errorMessage}
                </div>
              ) : null}

              {publishState === "success" ? (
                <div className="mt-5 rounded-[18px] border border-[var(--accent)]/25 bg-[var(--accent-soft)] px-4 py-4 text-sm text-[#a7edfb]">
                  Produto criado no site com sucesso.
                  {publishedProductUrl ? (
                    <>
                      {" "}
                      <a
                        href={publishedProductUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="font-semibold text-white underline"
                      >
                        Abrir produto
                      </a>
                    </>
                  ) : null}
                </div>
              ) : null}

              <button
                type="button"
                onClick={handlePublish}
                disabled={!isFormValid || publishState === "submitting"}
                className="mt-6 w-full rounded-2xl bg-[var(--accent)] px-4 py-4 text-base font-semibold text-[#07110d] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {publishState === "submitting"
                  ? "Salvando no site..."
                  : "Salvar no site"}
              </button>
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
    pricingContext.productType === "3d" ? "PLA" : "Produto pronto";
  const defaultName = pricingContext.productName.trim() || "Sem nome";

  return {
    name: defaultName,
    slug: slugify(defaultName),
    compareAtPrice: "",
    category: "decor",
    material: defaultMaterial,
    dimensions: "",
    accentColor: "#11b8f5",
    imageUrl: "",
    imageFileName: "",
    galleryImages: [],
    galleryFileNames: [],
    featured: false,
    description: buildDefaultDescription(defaultName, defaultMaterial),
    tagsText:
      pricingContext.productType === "3d" ? "3d, impresso em 3d" : "produto",
  };
}

function buildDefaultDescription(name: string, material: string) {
  return [
    `${name} produzido em ${material}.`,
    "",
    "Descreva aqui o uso do produto, acabamento, compatibilidade e diferenciais para o catálogo do site.",
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

function normalizeHexColor(value: string) {
  const trimmedValue = value.trim();

  if (/^#[0-9a-fA-F]{6}$/.test(trimmedValue)) {
    return trimmedValue;
  }

  return "#11b8f5";
}

function parseLinesOrCsv(value: string) {
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseMoneyToCents(value: string) {
  const normalizedValue = Number(value.replace(/\./g, "").replace(",", "."));

  if (!Number.isFinite(normalizedValue) || normalizedValue <= 0) {
    return null;
  }

  return Math.round(normalizedValue * 100);
}

function normalizeOptionalString(value: string) {
  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : undefined;
}

function isAcceptedImageFile(file: File) {
  if (ACCEPTED_IMAGE_TYPES.includes(file.type as (typeof ACCEPTED_IMAGE_TYPES)[number])) {
    return true;
  }

  const lowerCaseName = file.name.toLowerCase();
  return ACCEPTED_IMAGE_EXTENSIONS.some((extension) =>
    lowerCaseName.endsWith(extension),
  );
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }

      reject(new Error("Falha ao ler a imagem selecionada."));
    };

    reader.onerror = () => reject(new Error("Falha ao ler a imagem selecionada."));
    reader.readAsDataURL(file);
  });
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
          ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)] shadow-[inset_0_0_0_1px_rgba(17,184,245,0.14)]"
          : "border-white/8 bg-[var(--panel-soft)] text-white hover:border-white/16 hover:bg-white/3"
      }`}
    >
      <strong className="block text-lg font-semibold tracking-[-0.04em]">
        {title}
      </strong>
      <span className="mt-2 block text-sm text-[var(--muted)]">
        {description}
      </span>
    </button>
  );
}

function SectionTitle({ title }: { title: string }) {
  return (
    <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-[var(--muted)]">
      {title}
    </p>
  );
}

function InfoStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[18px] border border-white/6 bg-[#0d182b] px-4 py-4">
      <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-[var(--muted)]">
        {label}
      </p>
      <p className="mt-3 text-sm font-medium text-white">{value}</p>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  note,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  note?: string;
}) {
  return (
    <label className="block">
      <span className="font-mono text-[11px] uppercase tracking-[0.24em] text-[var(--muted)]">
        {label}
      </span>

      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-[20px] border border-white/10 bg-[#0d182b] px-4 py-3 text-base text-white outline-none transition placeholder:text-[#5d7398] focus:border-[var(--accent)]/40"
      />

      {note ? <p className="mt-2 text-xs text-[var(--muted)]">{note}</p> : null}
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
      <span className="font-mono text-[11px] uppercase tracking-[0.24em] text-[var(--muted)]">
        {label}
      </span>

      <textarea
        value={value}
        rows={rows}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-[20px] border border-white/10 bg-[#0d182b] px-4 py-3 text-base text-white outline-none transition placeholder:text-[#5d7398] focus:border-[var(--accent)]/40"
      />

      {note ? <p className="mt-2 text-xs text-[var(--muted)]">{note}</p> : null}
    </label>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="font-mono text-[11px] uppercase tracking-[0.24em] text-[var(--muted)]">
        {label}
      </span>

      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-[20px] border border-white/10 bg-[#0d182b] px-4 py-3 text-white outline-none transition focus:border-[var(--accent)]/40"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function SummaryLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-[18px] border border-white/6 bg-[#0d182b] px-4 py-3">
      <span className="text-sm text-[var(--muted)]">{label}</span>
      <strong className="text-sm text-white">{value}</strong>
    </div>
  );
}

function FileField({
  label,
  accept,
  helper,
  multiple = false,
  onChange,
}: {
  label: string;
  accept: string;
  helper: string;
  multiple?: boolean;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void | Promise<void>;
}) {
  return (
    <label className="block">
      <span className="font-mono text-[11px] uppercase tracking-[0.24em] text-[var(--muted)]">
        {label}
      </span>

      <input
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={onChange}
        className="mt-2 block w-full rounded-[20px] border border-white/10 bg-[#0d182b] px-4 py-3 text-sm text-white file:mr-4 file:rounded-full file:border-0 file:bg-[var(--accent-soft)] file:px-4 file:py-2 file:text-sm file:font-medium file:text-[var(--accent)]"
      />

      <p className="mt-2 text-xs text-[var(--muted)]">{helper}</p>
    </label>
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
    <div className="rounded-[18px] border border-white/8 bg-[#0d182b] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-[var(--muted)]">
            {title}
          </p>
          <p className="mt-2 text-sm text-white">{fileName}</p>
        </div>

        <button
          type="button"
          onClick={onRemove}
          className="rounded-full border border-white/10 px-3 py-1 text-xs text-white transition hover:border-white/20 hover:bg-white/4"
        >
          Remover
        </button>
      </div>

      <div className="relative mt-4 h-36 overflow-hidden rounded-[16px]">
        <Image
          src={imageUrl}
          alt={fileName}
          fill
          unoptimized
          className="object-cover"
        />
      </div>
    </div>
  );
}
