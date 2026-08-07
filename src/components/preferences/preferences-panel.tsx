"use client";

import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { WorkspaceCommercialPanel } from "@/components/preferences/workspace-commercial-panel";
import { currencyMeta } from "@/lib/currency/display-currency";
import { validateProfitDestinationPercentages } from "@/lib/pricing/profit-destination";
import {
  buildPreferencesFromPreset,
  businessPresets,
  getWorkspacePlan,
  readAppPreferences,
  type AppPreferences,
  type BusinessPresetId,
  type WorkspacePlanId,
  workspacePlans,
  workspaceRoleMeta,
  writeAppPreferences,
} from "@/lib/settings/app-preferences";

export function PreferencesPanel() {
  const [preferences, setPreferences] = useState<AppPreferences>(() =>
    readAppPreferences(),
  );
  const [saveState, setSaveState] = useState<"idle" | "saved">("idle");
  const profitDestinationValidation = validateProfitDestinationPercentages(
    preferences.profitDestinations,
  );

  useEffect(() => {
    if (saveState !== "saved") {
      return;
    }

    const timeoutId = window.setTimeout(() => setSaveState("idle"), 2200);

    return () => window.clearTimeout(timeoutId);
  }, [saveState]);

  function handleSave() {
    if (!profitDestinationValidation.isValid) {
      return;
    }

    writeAppPreferences(preferences);
    setSaveState("saved");
  }

  function applyPreset(presetId: BusinessPresetId) {
    setPreferences((current) => ({
      ...current,
      ...buildPreferencesFromPreset(presetId, current),
      onboardingCompleted: current.onboardingCompleted,
      workspaceName: current.workspaceName,
      operatorName: current.operatorName,
      operatorEmail: current.operatorEmail,
      defaultDisplayCurrency: current.defaultDisplayCurrency,
      applyPresetToNewCalculations: current.applyPresetToNewCalculations,
    }));
  }

  const activePreset = businessPresets.find(
    (preset) => preset.id === preferences.businessPresetId,
  );

  return (
    <div className="space-y-6">
      <section className="rounded-[26px] border border-[#e9ddd4] bg-white p-6 shadow-[0_18px_40px_rgba(0,0,0,0.08)]">
        <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-[#7c6858]">
          Workspace
        </p>

        <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-[#18120d]">
          Identidade e padrão operacional
        </h2>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <PreferenceField
            label="Nome do workspace"
            value={preferences.workspaceName}
            onChange={(value) =>
              setPreferences((current) => ({ ...current, workspaceName: value }))
            }
            note="Aparece no onboarding e no menu lateral."
          />
          <PreferenceField
            label="Responsável"
            value={preferences.operatorName}
            onChange={(value) =>
              setPreferences((current) => ({ ...current, operatorName: value }))
            }
            note="Nome de quem configura a política comercial."
          />
          <PreferenceField
            label="E-mail operacional"
            value={preferences.operatorEmail}
            onChange={(value) =>
              setPreferences((current) => ({ ...current, operatorEmail: value }))
            }
            note="Contato visível na navegação lateral."
          />
          <PreferenceSelect
            label="Papel do operador"
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
          />
          <PreferenceSelect
            label="Moeda padrão"
            value={preferences.defaultDisplayCurrency}
            onChange={(value) =>
              setPreferences((current) => ({
                ...current,
                defaultDisplayCurrency: value as AppPreferences["defaultDisplayCurrency"],
              }))
            }
            options={(["BRL", "USD", "EUR"] as const).map((currency) => ({
              value: currency,
              label: `${currency} · ${currencyMeta[currency].label}`,
            }))}
          />
        </div>
      </section>

      <section className="rounded-[26px] border border-[#e9ddd4] bg-white p-6 shadow-[0_18px_40px_rgba(0,0,0,0.08)]">
        <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-[#7c6858]">
          Presets de negócio
        </p>

        <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-[#18120d]">
          Perfil comercial da operação
        </h2>

        <p className="mt-3 max-w-3xl text-sm leading-7 text-[#7c6858]">
          Escolha um perfil base e ajuste as políticas abaixo. Em um SaaS maduro,
          essas premissas precisam ser explícitas e reaplicáveis.
        </p>

        <div className="mt-6 grid gap-4 xl:grid-cols-3">
          {businessPresets.map((preset) => {
            const isActive = preset.id === preferences.businessPresetId;

            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => applyPreset(preset.id)}
                className={`rounded-[22px] border p-5 text-left transition ${
                  isActive
                    ? "border-[#ff6a00] bg-[#fff3ea]"
                    : "border-black/8 bg-white hover:border-[#ff6a00]/40"
                }`}
              >
                <p className="text-sm font-semibold text-[#18120d]">
                  {preset.label}
                </p>
                <p className="mt-2 text-sm leading-6 text-[#7c6858]">
                  {preset.description}
                </p>
                <p className="mt-3 text-xs text-[#7c6858]">{preset.audience}</p>
              </button>
            );
          })}
        </div>

        {activePreset ? (
          <div className="mt-5 rounded-[22px] border border-black/8 bg-[#fcfaf8] px-5 py-4 text-sm text-[#5f4d40]">
            Perfil ativo: <strong>{activePreset.label}</strong>. Os valores abaixo
            podem ser editados e salvos como política padrão.
          </div>
        ) : null}
      </section>

      <section className="rounded-[26px] border border-[#e9ddd4] bg-white p-6 shadow-[0_18px_40px_rgba(0,0,0,0.08)]">
        <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-[#7c6858]">
          Plano comercial
        </p>

        <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-[#18120d]">
          Capacidade e posicionamento do produto
        </h2>

        <p className="mt-3 max-w-3xl text-sm leading-7 text-[#7c6858]">
          A camada SaaS precisa explicitar o que o workspace contratou, quanto
          pode usar e qual nível de operação ele suporta.
        </p>

        <div className="mt-6 grid gap-4 xl:grid-cols-3">
          {workspacePlans.map((plan) => {
            const isActive = plan.id === preferences.subscription.planId;

            return (
              <button
                key={plan.id}
                type="button"
                onClick={() =>
                  setPreferences((current) => ({
                    ...current,
                    subscription: {
                      ...current.subscription,
                      planId: plan.id,
                    },
                  }))
                }
                className={`rounded-[22px] border p-5 text-left transition ${
                  isActive
                    ? "border-[#ff6a00] bg-[#fff3ea]"
                    : "border-black/8 bg-white hover:border-[#ff6a00]/40"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-semibold text-[#18120d]">
                    {plan.label}
                  </p>
                  <span className="rounded-full border border-black/8 bg-white px-3 py-1 text-xs text-[#7c6858]">
                    {plan.monthlyPriceLabel}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-6 text-[#7c6858]">
                  {plan.description}
                </p>
                <p className="mt-4 text-xs text-[#7c6858]">
                  {plan.historyLimit} cálculos · {plan.seatsIncluded} assento(s) ·{" "}
                  {plan.supportLabel}
                </p>
              </button>
            );
          })}
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <PreferenceSelect
            label="Status da assinatura"
            value={preferences.subscription.status}
            onChange={(value) =>
              setPreferences((current) => ({
                ...current,
                subscription: {
                  ...current.subscription,
                  status: value as AppPreferences["subscription"]["status"],
                },
              }))
            }
            options={[
              { value: "internal", label: "Uso interno" },
              { value: "trial", label: "Trial" },
              { value: "active", label: "Ativo" },
            ]}
          />
          <PreferenceNumberField
            label="Assentos em uso"
            value={preferences.subscription.seatsUsed}
            onChange={(value) =>
              setPreferences((current) => ({
                ...current,
                subscription: {
                  ...current.subscription,
                  seatsUsed: Math.max(
                    1,
                    Math.round(Number(value.replace(",", ".")) || 1),
                  ),
                },
              }))
            }
          />
          <ReadOnlyPlanField planId={preferences.subscription.planId} />
        </div>
      </section>

      <section className="rounded-[26px] border border-[#e9ddd4] bg-white p-6 shadow-[0_18px_40px_rgba(0,0,0,0.08)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-[#7c6858]">
              Políticas padrão
            </p>
            <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-[#18120d]">
              Regras que entram em novas precificações
            </h2>
          </div>

          <Toggle
            label="Aplicar automaticamente em novos cálculos"
            checked={preferences.applyPresetToNewCalculations}
            onToggle={() =>
              setPreferences((current) => ({
                ...current,
                applyPresetToNewCalculations:
                  !current.applyPresetToNewCalculations,
              }))
            }
          />
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <PreferenceNumberField
            label="Margem alvo"
            value={preferences.pricingDefaults.profitMarginPercentage}
            suffix="%"
            onChange={(value) =>
              updatePricingDefaults(
                setPreferences,
                "profitMarginPercentage",
                value,
              )
            }
          />
          <PreferenceNumberField
            label="Margem saudável"
            value={preferences.pricingDefaults.healthyMarginTargetPercentage}
            suffix="%"
            onChange={(value) =>
              updatePricingDefaults(
                setPreferences,
                "healthyMarginTargetPercentage",
                value,
              )
            }
          />
          <PreferenceNumberField
            label="Perdas"
            value={preferences.pricingDefaults.lossPercentage}
            suffix="%"
            onChange={(value) =>
              updatePricingDefaults(setPreferences, "lossPercentage", value)
            }
          />
          <PreferenceNumberField
            label="Mão de obra sujeita a falha"
            value={preferences.pricingDefaults.lossLaborSharePercentage}
            suffix="%"
            onChange={(value) =>
              updatePricingDefaults(
                setPreferences,
                "lossLaborSharePercentage",
                value,
              )
            }
          />
          <PreferenceNumberField
            label="Pró-labore por hora"
            value={preferences.pricingDefaults.laborCostPerHour}
            prefix="R$"
            onChange={(value) =>
              updatePricingDefaults(setPreferences, "laborCostPerHour", value)
            }
          />
          <PreferenceNumberField
            label="Manutenção por hora"
            value={preferences.pricingDefaults.maintenanceCostPerHour}
            prefix="R$"
            onChange={(value) =>
              updatePricingDefaults(
                setPreferences,
                "maintenanceCostPerHour",
                value,
              )
            }
          />
          <PreferenceNumberField
            label="Imposto operacional"
            value={preferences.pricingDefaults.taxPercentage}
            suffix="%"
            onChange={(value) =>
              updatePricingDefaults(setPreferences, "taxPercentage", value)
            }
          />
          <PreferenceNumberField
            label="kWh padrão"
            value={preferences.pricingDefaults.kwhPrice}
            prefix="R$"
            onChange={(value) =>
              updatePricingDefaults(setPreferences, "kwhPrice", value)
            }
          />
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-black/8 pt-5">
          <p className="text-sm text-[#7c6858]">
            Use estas políticas como padrão das novas simulações. Cálculos já
            salvos continuam preservados no histórico.
          </p>

          <button
            type="button"
            onClick={handleSave}
            disabled={!profitDestinationValidation.isValid}
            className="rounded-full bg-[#ff6a00] px-5 py-3 text-sm font-semibold text-white transition hover:brightness-110"
          >
            {saveState === "saved" ? "Preferências salvas" : "Salvar preferências"}
          </button>
        </div>
      </section>

      <section className="rounded-[26px] border border-[#e9ddd4] bg-white p-6 shadow-[0_18px_40px_rgba(0,0,0,0.08)]">
        <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-[#7c6858]">
          Destinação do lucro
        </p>

        <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-[#18120d]">
          Como o lucro é distribuído depois da venda
        </h2>

        <p className="mt-3 max-w-3xl text-sm leading-7 text-[#7c6858]">
          Esta política é apenas gerencial. Ela não entra na formação do preço e
          serve para mostrar como o lucro realizado pode ser repartido dentro da
          empresa.
        </p>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <PreferenceNumberField
            label="Expansão"
            value={preferences.profitDestinations.expansionPercentage}
            suffix="%"
            onChange={(value) =>
              updateProfitDestinations(
                setPreferences,
                "expansionPercentage",
                value,
              )
            }
          />
          <PreferenceNumberField
            label="Reserva de caixa"
            value={preferences.profitDestinations.cashReservePercentage}
            suffix="%"
            onChange={(value) =>
              updateProfitDestinations(
                setPreferences,
                "cashReservePercentage",
                value,
              )
            }
          />
          <PreferenceNumberField
            label="Distribuição aos sócios"
            value={preferences.profitDestinations.ownerDistributionPercentage}
            suffix="%"
            onChange={(value) =>
              updateProfitDestinations(
                setPreferences,
                "ownerDistributionPercentage",
                value,
              )
            }
          />
        </div>

        <div
          className={`mt-5 rounded-[22px] border px-5 py-4 text-sm ${
            profitDestinationValidation.isValid
              ? "border-[#1f8b4c]/20 bg-[#eef8f2] text-[#1f8b4c]"
              : "border-[#c1372b]/20 bg-[#fff1f1] text-[#c1372b]"
          }`}
        >
          Total configurado:{" "}
          <strong>{profitDestinationValidation.totalPercentage.toFixed(2).replace(".", ",")}%</strong>
          {profitDestinationValidation.errorMessage ? (
            <span className="ml-2">{profitDestinationValidation.errorMessage}</span>
          ) : (
            <span className="ml-2">
              A soma está válida e será usada apenas na leitura gerencial do lucro.
            </span>
          )}
        </div>
      </section>

      <WorkspaceCommercialPanel preferences={preferences} />

      <section className="rounded-[26px] border border-[#e9ddd4] bg-white p-6 shadow-[0_18px_40px_rgba(0,0,0,0.08)]">
        <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-[#7c6858]">
          Governança
        </p>

        <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-[#18120d]">
          Limites assumidos pela ferramenta
        </h2>

        <div className="mt-5 space-y-3 text-sm leading-7 text-[#7c6858]">
          <p>
            A precificadora entrega uma leitura operacional e comercial do preço.
            Ela não substitui cálculo fiscal definitivo, DRE completa ou regime
            tributário parametrizado por contador.
          </p>
          <p>
            Para vender como SaaS, a recomendação é validar presets e políticas
            com amostras reais de produtos antes de escalar o uso comercial.
          </p>
        </div>
      </section>
    </div>
  );
}

function updatePricingDefaults(
  setPreferences: Dispatch<SetStateAction<AppPreferences>>,
  field: keyof AppPreferences["pricingDefaults"],
  value: string,
) {
  const normalizedValue = Number(value.replace(",", ".")) || 0;

  setPreferences((current) => ({
    ...current,
    pricingDefaults: {
      ...current.pricingDefaults,
      [field]: normalizedValue,
    },
  }));
}

function updateProfitDestinations(
  setPreferences: Dispatch<SetStateAction<AppPreferences>>,
  field: keyof AppPreferences["profitDestinations"],
  value: string,
) {
  const normalizedValue = Number(value.replace(",", ".")) || 0;

  setPreferences((current) => ({
    ...current,
    profitDestinations: {
      ...current.profitDestinations,
      [field]: normalizedValue,
    },
  }));
}

function PreferenceField({
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
    <label>
      <span className="font-mono text-[11px] uppercase tracking-[0.24em] text-[#7c6858]">
        {label}
      </span>
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-2xl border border-black/8 bg-white px-4 py-3 text-base text-[#18120d] outline-none transition focus:border-[#ff6a00] focus:ring-2 focus:ring-[#ff6a00]/20"
      />
      {note ? <p className="mt-2 text-xs text-[#7c6858]">{note}</p> : null}
    </label>
  );
}

function PreferenceNumberField({
  label,
  value,
  onChange,
  prefix,
  suffix,
}: {
  label: string;
  value: number;
  onChange: (value: string) => void;
  prefix?: string;
  suffix?: string;
}) {
  return (
    <label>
      <span className="font-mono text-[11px] uppercase tracking-[0.24em] text-[#7c6858]">
        {label}
      </span>
      <div className="mt-2 flex items-center overflow-hidden rounded-2xl border border-black/8 bg-white">
        {prefix ? (
          <span className="border-r border-black/8 px-4 py-3 text-sm text-[#7c6858]">
            {prefix}
          </span>
        ) : null}
        <input
          type="text"
          inputMode="decimal"
          value={String(value).replace(".", ",")}
          onChange={(event) => onChange(event.target.value)}
          className="min-w-0 flex-1 px-4 py-3 text-base text-[#18120d] outline-none"
        />
        {suffix ? (
          <span className="border-l border-black/8 px-4 py-3 text-sm text-[#7c6858]">
            {suffix}
          </span>
        ) : null}
      </div>
    </label>
  );
}

function PreferenceSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label>
      <span className="font-mono text-[11px] uppercase tracking-[0.24em] text-[#7c6858]">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-2xl border border-black/8 bg-white px-4 py-3 text-base text-[#18120d] outline-none transition focus:border-[#ff6a00] focus:ring-2 focus:ring-[#ff6a00]/20"
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

function Toggle({
  label,
  checked,
  onToggle,
}: {
  label: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex items-center gap-3 rounded-full border border-black/8 bg-[#fcfaf8] px-4 py-3 text-sm text-[#18120d]"
    >
      <span>{label}</span>
      <span
        className={`relative h-7 w-12 rounded-full border transition ${
          checked ? "border-[#ff6a00] bg-[#ff6a00]" : "border-[#bdaa99] bg-[#d9cec4]"
        }`}
      >
        <span
          className={`absolute top-1 size-5 rounded-full bg-white shadow-sm transition ${
            checked ? "left-6" : "left-1"
          }`}
        />
      </span>
    </button>
  );
}

function ReadOnlyPlanField({ planId }: { planId: WorkspacePlanId }) {
  const plan = getWorkspacePlan(planId);

  return (
    <div>
      <span className="font-mono text-[11px] uppercase tracking-[0.24em] text-[#7c6858]">
        Limite do plano
      </span>
      <div className="mt-2 rounded-2xl border border-black/8 bg-[#fcfaf8] px-4 py-3">
        <p className="text-base text-[#18120d]">
          {plan.historyLimit} cálculos no histórico
        </p>
        <p className="mt-2 text-xs text-[#7c6858]">
          {plan.erpSyncEnabled ? "ERP liberado" : "ERP indisponível"} ·{" "}
          {plan.marketplaceAutomationEnabled
            ? "automação de canais ativa"
            : "automação de canais limitada"}
        </p>
      </div>
    </div>
  );
}
