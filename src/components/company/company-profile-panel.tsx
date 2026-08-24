"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { upload } from "@vercel/blob/client";
import { buildWorkspaceUploadPath } from "@/lib/client/workspace-upload-path";
import { currencyMeta } from "@/lib/currency/display-currency";
import {
  businessTypeMeta,
  companyPaymentMethodMeta,
  defaultAppPreferences,
  getCompanyProfileChecklist,
  getWorkspacePlan,
  isCompanyProfileComplete,
  type AppPreferences,
  type BusinessType,
  type CompanyPaymentMethod,
  loadAppPreferences,
  readAppPreferences,
  subscribeAppPreferences,
  workspaceRoleMeta,
  writeAppPreferences,
} from "@/lib/settings/app-preferences";

const brandAccentOptions = [
  "#ff6a00",
  "#0f766e",
  "#2563eb",
  "#111827",
  "#7c3aed",
  "#dc2626",
] as const;

export function CompanyProfilePanel({
  initialPreferences,
  canEditBusinessType,
}: {
  initialPreferences: AppPreferences;
  canEditBusinessType: boolean;
}) {
  const router = useRouter();
  const [preferences, setPreferences] = useState<AppPreferences>(initialPreferences);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [logoState, setLogoState] = useState<"idle" | "uploading" | "removing">(
    "idle",
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    void loadAppPreferences()
      .then((nextPreferences) => {
        setPreferences(nextPreferences);
      })
      .catch((error) => {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Falha ao carregar o perfil da empresa.",
        );
      });

    return subscribeAppPreferences(() => {
      setPreferences(readAppPreferences());
    });
  }, []);

  useEffect(() => {
    if (saveState !== "saved") {
      return;
    }

    const timeoutId = window.setTimeout(() => setSaveState("idle"), 2200);
    return () => window.clearTimeout(timeoutId);
  }, [saveState]);

  async function handleSave() {
    setSaveState("saving");
    setErrorMessage(null);

    try {
      const savedPreferences = await writeAppPreferences(
        buildSavablePreferences(preferences),
      );
      setPreferences(savedPreferences);
      setSaveState("saved");
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Falha ao salvar o perfil da empresa.",
      );
      setSaveState("idle");
    }
  }

  async function handleLogoUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (!isAcceptedLogoFile(file)) {
      setErrorMessage("Envie uma imagem JPG, PNG ou WEBP para a logo.");
      event.target.value = "";
      return;
    }

    setLogoState("uploading");
    setErrorMessage(null);

    try {
      const blob = await upload(
        buildLogoBlobPath(file.name),
        file,
        {
          access: "public",
          contentType: file.type || undefined,
          handleUploadUrl: "/api/workspace/logo/upload",
        },
      );
      const savedPreferences = await writeAppPreferences(
        buildSavablePreferences({
          ...preferences,
          companyLogoUrl: blob.url,
        }),
      );

      setPreferences(savedPreferences);
      setSaveState("saved");
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Falha ao enviar a logo da empresa.",
      );
    } finally {
      setLogoState("idle");
      event.target.value = "";
    }
  }

  async function handleLogoRemove() {
    setLogoState("removing");
    setErrorMessage(null);

    try {
      const savedPreferences = await writeAppPreferences(
        buildSavablePreferences({
          ...preferences,
          companyLogoUrl: "",
        }),
      );
      setPreferences(savedPreferences);
      setSaveState("saved");
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Falha ao remover a logo da empresa.",
      );
    } finally {
      setLogoState("idle");
    }
  }

  function togglePaymentMethod(method: CompanyPaymentMethod) {
    setPreferences((current) => {
      const isSelected = current.paymentMethods.includes(method);

      if (isSelected && current.paymentMethods.length === 1) {
        return current;
      }

      return {
        ...current,
        paymentMethods: isSelected
          ? current.paymentMethods.filter((item) => item !== method)
          : [...current.paymentMethods, method],
      };
    });
  }

  const workspaceInitials = buildInitials(
    preferences.workspaceName || defaultAppPreferences.workspaceName,
  );
  const activeBusinessMeta = preferences.businessType
    ? businessTypeMeta[preferences.businessType]
    : null;
  const profileChecklist = getCompanyProfileChecklist(preferences);
  const profileComplete = isCompanyProfileComplete(preferences);
  const workspacePlan = getWorkspacePlan(preferences.subscription.planId);
  const paymentMethodsSummary = preferences.paymentMethods
    .map((method) => companyPaymentMethodMeta[method].label)
    .join(" · ");

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_360px]">
      <div className="space-y-6">
        <section className="app-card p-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-[var(--accent)]">
            Identidade e marca
          </p>
          <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-[var(--foreground)]">
            A base da empresa que aparece no produto
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--muted)]">
            Nome, responsável, logo e cor principal ficam centralizados aqui para
            sustentar o início, os orçamentos e os próximos PDFs do workspace.
          </p>

          <div className="mt-6 rounded-[24px] border border-[var(--panel-border)] bg-[rgba(255,255,255,0.72)] px-5 py-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-[var(--foreground)]">
                  Ramo principal do workspace
                </p>
                <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
                  {activeBusinessMeta?.description ??
                    "Escolha definida no primeiro acesso da precificadora."}
                </p>
              </div>
              {canEditBusinessType ? (
                <div className="min-w-[220px]">
                  <label className="block">
                    <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                      Super admin
                    </span>
                    <select
                      value={preferences.businessType ?? ""}
                      onChange={(event) =>
                        setPreferences((current) => ({
                          ...current,
                          businessType:
                            event.target.value === ""
                              ? null
                              : (event.target.value as BusinessType),
                        }))
                      }
                      className="mt-2 w-full rounded-[16px] border border-[var(--panel-border)] bg-white px-4 py-3 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--accent)]"
                    >
                      <option value="">Selecione o ramo</option>
                      {Object.entries(businessTypeMeta).map(([value, meta]) => (
                        <option key={value} value={value}>
                          {meta.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              ) : (
                <span className="rounded-full border border-[var(--accent)] bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent)]">
                  {activeBusinessMeta?.label ?? "Pendente"}
                </span>
              )}
            </div>
            <p className="mt-4 text-xs leading-6 text-[var(--muted)]">
              {canEditBusinessType
                ? "Como super admin, voce pode trocar o ramo para validacao e suporte. Para o usuario final, essa escolha continua travada."
                : "Para evitar mistura de regras entre nichos, essa escolha fica travada para o usuario final e so muda via suporte/admin."}
            </p>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <ProfileField
              label="Nome da empresa"
              value={preferences.workspaceName}
              onChange={(value) =>
                setPreferences((current) => ({ ...current, workspaceName: value }))
              }
              note="Usado no menu lateral, na conta e na apresentação dos orçamentos."
            />
            <ProfileField
              label="Responsável"
              value={preferences.operatorName}
              onChange={(value) =>
                setPreferences((current) => ({ ...current, operatorName: value }))
              }
              note="Pessoa principal para operação, atendimento e suporte."
            />
            <ProfileField
              label="E-mail operacional"
              type="email"
              value={preferences.operatorEmail}
              onChange={(value) =>
                setPreferences((current) => ({ ...current, operatorEmail: value }))
              }
              note="Contato principal do workspace."
            />
            <ProfileField
              label="Telefone / WhatsApp"
              type="tel"
              value={preferences.operatorPhone}
              onChange={(value) =>
                setPreferences((current) => ({ ...current, operatorPhone: value }))
              }
              note="Canal rápido para atendimento, fechamento e suporte."
            />
          </div>

          <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
            <div className="rounded-[24px] border border-[var(--panel-border)] bg-[rgba(255,255,255,0.72)] p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-[var(--foreground)]">
                    Logo da empresa
                  </p>
                  <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
                    JPG, PNG ou WEBP. O upload já salva direto no workspace.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={logoState !== "idle"}
                    className="app-button app-button-secondary"
                  >
                    {logoState === "uploading" ? "Enviando..." : "Enviar logo"}
                  </button>
                  {preferences.companyLogoUrl ? (
                    <button
                      type="button"
                      onClick={() => void handleLogoRemove()}
                      disabled={logoState !== "idle"}
                      className="app-button app-button-secondary"
                    >
                      {logoState === "removing" ? "Removendo..." : "Remover"}
                    </button>
                  ) : null}
                </div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(event) => void handleLogoUpload(event)}
              />
            </div>

            <div className="rounded-[24px] border border-[var(--panel-border)] bg-[rgba(255,255,255,0.72)] p-5">
              <p className="text-sm font-semibold text-[var(--foreground)]">
                Cor principal
              </p>
              <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
                Vai ajudar a manter a identidade do PDF e dos destaques da conta.
              </p>

              <div className="mt-4 flex flex-wrap gap-3">
                {brandAccentOptions.map((color) => {
                  const isSelected = preferences.brandAccentHex === color;

                  return (
                    <button
                      key={color}
                      type="button"
                      onClick={() =>
                        setPreferences((current) => ({
                          ...current,
                          brandAccentHex: color,
                        }))
                      }
                      className={`relative size-11 rounded-2xl border-2 transition ${
                        isSelected
                          ? "border-[var(--foreground)] shadow-[0_0_0_3px_rgba(255,255,255,0.92)]"
                          : "border-white/70"
                      }`}
                      style={{ backgroundColor: color }}
                      aria-label={`Selecionar cor ${color}`}
                    >
                      {isSelected ? (
                        <span className="absolute inset-0 flex items-center justify-center text-sm font-semibold text-white">
                          ✓
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        <section className="app-card p-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-[var(--accent)]">
            Contato e localização
          </p>
          <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-[var(--foreground)]">
            Como a operação vai se apresentar
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--muted)]">
            Esses dados sustentam a comunicação comercial e deixam a conta pronta
            para evoluir depois para modelos mais completos de orçamento.
          </p>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <ProfileField
              label="Endereço"
              value={preferences.addressLine}
              onChange={(value) =>
                setPreferences((current) => ({ ...current, addressLine: value }))
              }
              note="Rua, número ou referência principal."
            />
            <ProfileField
              label="Cidade"
              value={preferences.city}
              onChange={(value) =>
                setPreferences((current) => ({ ...current, city: value }))
              }
              note="Usada no contexto comercial da empresa."
            />
            <ProfileField
              label="Estado"
              value={preferences.state}
              onChange={(value) =>
                setPreferences((current) => ({ ...current, state: value }))
              }
              note="UF da operação."
            />
            <ProfileSelectField
              label="Moeda padrão"
              value={preferences.defaultDisplayCurrency}
              onChange={(value) =>
                setPreferences((current) => ({
                  ...current,
                  defaultDisplayCurrency:
                    value as AppPreferences["defaultDisplayCurrency"],
                }))
              }
              options={Object.entries(currencyMeta).map(([value, meta]) => ({
                value,
                label: `${meta.label} · ${value}`,
              }))}
              note="Base inicial para novas precificações."
            />
            <ProfileSelectField
              label="Papel padrão do responsável"
              value={preferences.operatorRole}
              onChange={(value) =>
                setPreferences((current) => ({
                  ...current,
                  operatorRole: value as AppPreferences["operatorRole"],
                }))
              }
              options={Object.entries(workspaceRoleMeta).map(([value, meta]) => ({
                value,
                label: meta.label,
              }))}
              note="Referência operacional do responsável principal."
            />
            <ProfileSelectField
              label="Preset da operação"
              value={preferences.businessPresetId}
              onChange={(value) =>
                setPreferences((current) => ({
                  ...current,
                  businessPresetId: value as AppPreferences["businessPresetId"],
                }))
              }
              options={[
                { value: "maker", label: "Maker Enxuto" },
                { value: "studio", label: "Estúdio Profissional" },
                { value: "farm", label: "Fábrica 3D" },
              ]}
              note="Contexto inicial da política comercial e operação."
            />
          </div>
        </section>

        <section className="app-card p-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-[var(--accent)]">
            Pagamentos
          </p>
          <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-[var(--foreground)]">
            Formas de recebimento da empresa
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--muted)]">
            Marque como a empresa costuma receber. Isso ajuda a preparar os
            próximos modelos de orçamento e o contexto comercial da conta.
          </p>

          <div className="mt-6 grid gap-3 md:grid-cols-2">
            {Object.entries(companyPaymentMethodMeta).map(([value, meta]) => {
              const method = value as CompanyPaymentMethod;
              const isSelected = preferences.paymentMethods.includes(method);

              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => togglePaymentMethod(method)}
                  className={`rounded-[22px] border px-4 py-4 text-left transition ${
                    isSelected
                      ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                      : "border-[var(--panel-border)] bg-[rgba(255,255,255,0.72)] hover:border-[var(--accent)]"
                  }`}
                >
                  <div className="flex items-center justify-between gap-4">
                    <p className="text-sm font-semibold text-[var(--foreground)]">
                      {meta.label}
                    </p>
                    <span
                      className={`rounded-full px-2 py-1 text-[11px] font-semibold ${
                        isSelected
                          ? "bg-[var(--accent)] text-white"
                          : "bg-[var(--panel-soft)] text-[var(--muted)]"
                      }`}
                    >
                      {isSelected ? "Ativo" : "Opcional"}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
                    {meta.description}
                  </p>
                </button>
              );
            })}
          </div>
        </section>

        <section className="app-card p-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-[var(--accent)]">
            Presença online
          </p>
          <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-[var(--foreground)]">
            Canais públicos da empresa
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--muted)]">
            Site e Instagram já ficam guardados para quando a conta começar a
            mostrar esses pontos em materiais comerciais e no PDF.
          </p>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <ProfileField
              label="Site"
              type="url"
              value={preferences.websiteUrl}
              onChange={(value) =>
                setPreferences((current) => ({ ...current, websiteUrl: value }))
              }
              note="Ex.: https://suaempresa.com.br"
            />
            <ProfileField
              label="Instagram"
              value={preferences.instagramHandle}
              onChange={(value) =>
                setPreferences((current) => ({
                  ...current,
                  instagramHandle: value,
                }))
              }
              note="Pode ser o @perfil ou a URL completa."
            />
          </div>
        </section>

        {errorMessage ? (
          <div className="rounded-[20px] border border-[color:var(--danger)]/28 bg-[color:var(--danger)]/8 px-4 py-3 text-sm text-[var(--danger)]">
            {errorMessage}
          </div>
        ) : null}

        <div className="app-card-soft flex flex-wrap items-center justify-between gap-4 p-5">
          <div>
            <p className="text-base font-semibold text-[var(--foreground)]">
              Salvar perfil da empresa
            </p>
            <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
              O salvamento atualiza a identidade do início, da conta, da sidebar e
              dos modelos de orçamento.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saveState === "saving"}
            className="app-button app-button-primary"
          >
            {saveState === "saving"
              ? "Salvando..."
              : saveState === "saved"
                ? "Salvo"
                : "Salvar alterações"}
          </button>
        </div>
      </div>

      <aside className="space-y-4">
        <section className="app-card-soft p-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-[var(--muted)]">
            Prévia rápida
          </p>

          <div className="mt-5 rounded-[28px] border border-[var(--panel-border)] bg-[rgba(255,255,255,0.76)] p-5">
            <div className="flex items-center gap-4">
              {preferences.companyLogoUrl ? (
                <div className="relative flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-[22px] border border-[var(--panel-border)] bg-white">
                  <Image
                    src={preferences.companyLogoUrl}
                    alt={`Logo de ${preferences.workspaceName}`}
                    fill
                    unoptimized
                    sizes="64px"
                    className="object-contain p-2"
                  />
                </div>
              ) : (
                <div
                  className="flex size-16 shrink-0 items-center justify-center rounded-[22px] text-xl font-semibold text-white"
                  style={{ backgroundColor: preferences.brandAccentHex }}
                >
                  {workspaceInitials}
                </div>
              )}

              <div className="min-w-0">
                <p className="truncate text-lg font-semibold text-[var(--foreground)]">
                  {preferences.workspaceName || "Sua empresa"}
                </p>
                <p className="mt-1 truncate text-sm text-[var(--muted)]">
                  {preferences.operatorName || "Responsável ainda não definido"}
                </p>
                <p className="mt-1 truncate text-sm text-[var(--muted)]">
                  {preferences.operatorEmail || "Sem e-mail operacional"}
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              <PreviewStat label="Plano atual" value={workspacePlan.label} />
              <PreviewStat
                label="Telefone"
                value={preferences.operatorPhone || "Ainda não informado"}
              />
              <PreviewStat
                label="Cidade"
                value={formatLocation(preferences.city, preferences.state)}
              />
              <PreviewStat
                label="Recebimentos"
                value={paymentMethodsSummary || "Sem meios definidos"}
              />
              <PreviewStat
                label="Ramo"
                value={activeBusinessMeta?.label ?? "Pendente"}
              />
            </div>
          </div>
        </section>

        <section className="app-card-soft p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-[var(--muted)]">
                Checklist
              </p>
              <p className="mt-2 text-lg font-semibold text-[var(--foreground)]">
                {profileComplete ? "Empresa pronta" : "Faltam dados essenciais"}
              </p>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                profileComplete
                  ? "bg-[color:var(--success)]/14 text-[color:var(--success)]"
                  : "bg-[var(--accent-soft)] text-[var(--accent)]"
              }`}
            >
              {profileChecklist.filter((item) => item.done).length}/{profileChecklist.length}
            </span>
          </div>

          <div className="mt-5 space-y-3">
            {profileChecklist.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-4 rounded-[20px] border border-[var(--panel-border)] bg-[rgba(255,255,255,0.72)] px-4 py-3"
              >
                <p className="text-sm font-medium text-[var(--foreground)]">
                  {item.label}
                </p>
                <span
                  className={`rounded-full px-2 py-1 text-[11px] font-semibold ${
                    item.done
                      ? "bg-[color:var(--success)]/14 text-[color:var(--success)]"
                      : "bg-[var(--panel-soft)] text-[var(--muted)]"
                  }`}
                >
                  {item.done ? "Ok" : "Pendente"}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="app-card-soft p-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-[var(--muted)]">
            Próxima reutilização
          </p>
          <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
            Esta base será reaproveitada por início, conta, equipe, modelos de
            orçamento e futuras saídas em PDF.
          </p>
          <div className="mt-4 rounded-[20px] border border-[var(--panel-border)] bg-[rgba(255,255,255,0.72)] px-4 py-4 text-sm leading-7 text-[var(--muted)]">
            Site: {preferences.websiteUrl || "não informado"}
            <br />
            Instagram: {formatInstagramHandle(preferences.instagramHandle)}
          </div>
        </section>
      </aside>
    </div>
  );
}

function ProfileField({
  label,
  value,
  onChange,
  note,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  note: string;
  type?: "text" | "email" | "tel" | "url";
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-[var(--foreground)]">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-[18px] border border-[var(--panel-border)] bg-[rgba(255,255,255,0.82)] px-4 py-3 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--accent)]"
      />
      <span className="mt-2 block text-xs leading-6 text-[var(--muted)]">{note}</span>
    </label>
  );
}

function ProfileSelectField({
  label,
  value,
  onChange,
  options,
  note,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  note: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-[var(--foreground)]">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-[18px] border border-[var(--panel-border)] bg-[rgba(255,255,255,0.82)] px-4 py-3 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--accent)]"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <span className="mt-2 block text-xs leading-6 text-[var(--muted)]">{note}</span>
    </label>
  );
}

function PreviewStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[20px] border border-[var(--panel-border)] bg-[rgba(255,255,255,0.72)] px-4 py-3">
      <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[var(--muted)]">
        {label}
      </p>
      <p className="mt-2 text-sm font-semibold text-[var(--foreground)]">{value}</p>
    </div>
  );
}

function buildInitials(value: string) {
  const parts = value
    .split(/\s+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 2);

  if (parts.length === 0) {
    return "DP";
  }

  return parts.map((item) => item[0]?.toUpperCase() ?? "").join("");
}

function isAcceptedLogoFile(file: File) {
  const acceptedTypes = ["image/jpeg", "image/png", "image/webp"];

  if (acceptedTypes.includes(file.type)) {
    return true;
  }

  const lowerName = file.name.toLowerCase();
  return [".jpg", ".jpeg", ".png", ".webp"].some((extension) =>
    lowerName.endsWith(extension),
  );
}

function buildLogoBlobPath(fileName: string) {
  const safeFileName = fileName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return buildWorkspaceUploadPath(
    "workspace-logos",
    `logo-${safeFileName || "image"}`,
  );
}

function buildSavablePreferences(preferences: AppPreferences): AppPreferences {
  return {
    ...preferences,
    onboardingCompleted:
      preferences.onboardingCompleted || isCompanyProfileComplete(preferences),
  };
}

function formatLocation(city: string, state: string) {
  if (!city && !state) {
    return "Ainda não informado";
  }

  if (!city) {
    return state;
  }

  if (!state) {
    return city;
  }

  return `${city} · ${state}`;
}

function formatInstagramHandle(value: string) {
  if (!value.trim()) {
    return "não informado";
  }

  if (value.startsWith("@") || value.startsWith("http")) {
    return value;
  }

  return `@${value}`;
}
