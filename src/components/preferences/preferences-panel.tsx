"use client";

import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { useSearchParams } from "next/navigation";
import { currencyMeta } from "@/lib/currency/display-currency";
import { validateProfitDestinationPercentages } from "@/lib/pricing/profit-destination";
import {
  buildPreferencesFromPreset,
  businessPresets,
  defaultAppPreferences,
  loadAppPreferences,
  type AppPreferences,
  type BusinessPresetId,
  workspaceRoleMeta,
  writeAppPreferences,
} from "@/lib/settings/app-preferences";

type MercadoLivreStatusSnapshot = {
  mode: "persistent" | "missing";
  connected: boolean;
  userId: string | null;
  expiresAt: string | null;
  updatedAt: string | null;
};

export function PreferencesPanel({
  initialMercadoLivreStatus,
  initialPreferences,
}: {
  initialMercadoLivreStatus: MercadoLivreStatusSnapshot | null;
  initialPreferences?: AppPreferences;
}) {
  const searchParams = useSearchParams();
  const [preferences, setPreferences] = useState<AppPreferences>(
    initialPreferences ?? defaultAppPreferences,
  );
  const [saveState, setSaveState] = useState<"idle" | "saved">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const profitDestinationValidation = validateProfitDestinationPercentages(
    preferences.profitDestinations,
  );
  const mercadoLivreCallbackState = searchParams?.get("meli");
  const mercadoLivreCallbackReason = searchParams?.get("reason");
  const mercadoLivreCallbackRequestId = searchParams?.get("requestId");
  const mercadoLivreStatus =
    initialMercadoLivreStatus ??
    ({
      mode: "missing",
      connected: false,
      userId: null,
      expiresAt: null,
      updatedAt: null,
    } satisfies MercadoLivreStatusSnapshot);

  useEffect(() => {
    let isMounted = true;

    void loadAppPreferences()
      .then((nextPreferences) => {
        if (isMounted) {
          setPreferences(nextPreferences);
        }
      })
      .catch(() => undefined);

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (saveState !== "saved") {
      return;
    }

    const timeoutId = window.setTimeout(() => setSaveState("idle"), 2200);

    return () => window.clearTimeout(timeoutId);
  }, [saveState]);

  async function handleSave() {
    if (!profitDestinationValidation.isValid) {
      return;
    }

    setErrorMessage(null);

    try {
      const savedPreferences = await writeAppPreferences(preferences);
      setPreferences(savedPreferences);
      setSaveState("saved");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Falha ao salvar preferências.",
      );
    }
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
      {mercadoLivreCallbackState === "connected" ? (
        <section className="rounded-[26px] border border-[#1f8b4c]/20 bg-[#eef8f2] p-5 text-sm text-[#1f8b4c] shadow-[0_18px_40px_rgba(0,0,0,0.04)]">
          <strong>Mercado Livre conectado.</strong> A autorização da conta foi
          concluída com sucesso.
        </section>
      ) : null}

      {mercadoLivreCallbackState === "error" ? (
        <section className="rounded-[26px] border border-[#d45f5f]/30 bg-[#fff5f5] p-5 text-sm text-[#a53b3b] shadow-[0_18px_40px_rgba(0,0,0,0.04)]">
          <strong>Falha ao conectar o Mercado Livre.</strong>{" "}
          {mercadoLivreCallbackReason ||
            "Não foi possível concluir a autorização da conta."}
          {mercadoLivreCallbackRequestId ? (
            <p className="mt-2 font-mono text-xs uppercase tracking-[0.18em] text-[#a53b3b]">
              Ref: {mercadoLivreCallbackRequestId}
            </p>
          ) : null}
        </section>
      ) : null}

      <section className="rounded-[26px] border border-[#e9ddd4] bg-white p-6 shadow-[0_18px_40px_rgba(0,0,0,0.08)]">
        <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-[#7c6858]">
          Integrações
        </p>

        <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-[#18120d]">
          Mercado Livre
        </h2>

        <p className="mt-3 max-w-3xl text-sm leading-7 text-[#7c6858]">
          Controle a conexão usada para categoria oficial, taxas e estimativas
          automáticas do Mercado Livre dentro da precificadora.
        </p>

        <div className="mt-6 rounded-[22px] border border-black/8 bg-[#fcfaf8] p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-base font-semibold text-[#18120d]">
                  {getMercadoLivreStatusTitle(mercadoLivreStatus)}
                </p>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    mercadoLivreStatus.connected
                      ? "bg-[#eef8f2] text-[#1f8b4c]"
                      : mercadoLivreStatus.mode === "persistent"
                        ? "bg-[#fff3ea] text-[#d84f00]"
                        : "bg-[#f2ece7] text-[#7c6858]"
                  }`}
                >
                  {getMercadoLivreStatusBadge(mercadoLivreStatus)}
                </span>
              </div>

              <p className="mt-2 text-sm leading-7 text-[#7c6858]">
                {getMercadoLivreStatusDescription(mercadoLivreStatus)}
              </p>
            </div>

            {mercadoLivreStatus.mode === "persistent" ? (
              <a
                href="/api/auth/meli/start"
                className="rounded-full bg-[#ff6a00] px-5 py-3 text-sm font-semibold text-white transition hover:brightness-110"
              >
                {mercadoLivreStatus.connected
                  ? "Reconectar conta"
                  : "Conectar conta"}
              </a>
            ) : null}
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <IntegrationStat
              label="Modo"
              value={getMercadoLivreModeLabel(mercadoLivreStatus.mode)}
            />
            <IntegrationStat
              label="Conta conectada"
              value={mercadoLivreStatus.userId ?? "Nenhuma"}
            />
            <IntegrationStat
              label="Expira em"
              value={formatOptionalDateTime(mercadoLivreStatus.expiresAt)}
            />
          </div>

          {mercadoLivreStatus.updatedAt ? (
            <p className="mt-4 text-xs leading-6 text-[#7c6858]">
              Última atualização registrada em{" "}
              {formatOptionalDateTime(mercadoLivreStatus.updatedAt)}.
            </p>
          ) : null}

          {mercadoLivreStatus.mode === "missing" ? (
            <p className="mt-4 text-xs leading-6 text-[#7c6858]">
              Para habilitar OAuth por workspace, configure `DATABASE_URL`,
              `MELI_CLIENT_ID`, `MELI_CLIENT_SECRET` e `MELI_REDIRECT_URI`.
            </p>
          ) : null}
        </div>
      </section>

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

      {errorMessage ? (
        <section className="rounded-[26px] border border-[#d45f5f]/30 bg-[#fff5f5] p-5 text-sm text-[#a53b3b] shadow-[0_18px_40px_rgba(0,0,0,0.04)]">
          {errorMessage}
        </section>
      ) : null}

      <section className="rounded-[26px] border border-[#e9ddd4] bg-white p-6 shadow-[0_18px_40px_rgba(0,0,0,0.08)]">
        <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-[#7c6858]">
          Presets de negócio
        </p>

        <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-[#18120d]">
          Perfil comercial da operação
        </h2>

        <p className="mt-3 max-w-3xl text-sm leading-7 text-[#7c6858]">
          Escolha um perfil base e ajuste as políticas abaixo para manter novas
          simulações consistentes.
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
            Valide presets e políticas com produtos reais para ganhar confiança
            nos preços sugeridos antes de aplicar em escala.
          </p>
        </div>
      </section>
    </div>
  );
}

function getMercadoLivreStatusTitle(status: MercadoLivreStatusSnapshot) {
  if (status.connected) {
    return "Conta pronta para consulta oficial";
  }

  if (status.mode === "persistent") {
    return "OAuth do workspace disponível";
  }

  return "Integração não disponível";
}

function getMercadoLivreStatusBadge(status: MercadoLivreStatusSnapshot) {
  if (status.connected) {
    return "Conectado";
  }

  if (status.mode === "persistent") {
    return "Pronto para conectar";
  }

  return "Não configurado";
}

function getMercadoLivreStatusDescription(status: MercadoLivreStatusSnapshot) {
  if (status.connected && status.mode === "persistent") {
    return "A conta conectada pertence ao workspace atual e será usada nas consultas automáticas de taxas, categoria e frete.";
  }

  if (status.mode === "persistent") {
    return "Este ambiente já suporta OAuth persistente por workspace. Falta apenas autorizar a conta do Mercado Livre.";
  }

  return "Este ambiente ainda não expõe uma conexão utilizável do Mercado Livre para a precificadora.";
}

function getMercadoLivreModeLabel(
  mode: MercadoLivreStatusSnapshot["mode"],
) {
  if (mode === "persistent") {
    return "OAuth por workspace";
  }

  return "Indisponível";
}

function formatOptionalDateTime(value: string | null) {
  if (!value) {
    return "Nao informado";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}

function IntegrationStat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[18px] border border-black/8 bg-white p-4">
      <p className="text-xs uppercase tracking-[0.2em] text-[#7c6858]">
        {label}
      </p>
      <strong className="mt-2 block text-sm font-semibold text-[#18120d]">
        {value}
      </strong>
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
