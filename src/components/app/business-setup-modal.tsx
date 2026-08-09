"use client";

import { useMemo, useState } from "react";
import { currencyMeta, type DisplayCurrency } from "@/lib/currency/display-currency";
import {
  businessTypeMeta,
  buildPreferencesFromPreset,
  businessPresets,
  type AppPreferences,
  type BusinessPresetId,
  type BusinessType,
} from "@/lib/settings/app-preferences";

type BusinessSetupModalProps = {
  open: boolean;
  onComplete: (preferences: AppPreferences) => void;
};

export function BusinessSetupModal({
  open,
  onComplete,
}: BusinessSetupModalProps) {
  const [workspaceName, setWorkspaceName] = useState("Dabi Tech 3D");
  const [operatorName, setOperatorName] = useState("");
  const [operatorEmail, setOperatorEmail] = useState("");
  const [businessType, setBusinessType] = useState<BusinessType | null>(null);
  const [presetId, setPresetId] = useState<BusinessPresetId>("studio");
  const [currency, setCurrency] = useState<DisplayCurrency>("BRL");

  const activePreset = useMemo(
    () => businessPresets.find((preset) => preset.id === presetId) ?? businessPresets[1],
    [presetId],
  );

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 py-8">
      <div className="w-full max-w-4xl rounded-[32px] border border-[var(--panel-border)] bg-[rgba(255,255,255,0.96)] shadow-[0_36px_90px_rgba(57,37,118,0.16)] backdrop-blur-xl">
        <div className="border-b border-[var(--panel-border)] px-6 py-6 sm:px-8">
          <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-[var(--accent)]">
            Setup inicial
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-[var(--foreground)]">
            Configure sua operação antes da primeira precificação
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--muted)]">
            Escolha o perfil da operação, defina quem administra a conta e salve
            um padrão para novas simulações.
          </p>
        </div>

        <div className="px-6 py-6 sm:px-8">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-[var(--muted)]">
              Ramo principal
            </p>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--muted)]">
              Essa escolha estrutura a precificadora, os modelos e a linguagem do
              workspace. Depois ela fica travada para o usuário final e só muda
              via suporte/admin.
            </p>

            <div className="mt-4 grid gap-4 xl:grid-cols-2">
              {Object.entries(businessTypeMeta).map(([value, meta]) => {
                const typedValue = value as BusinessType;
                const isActive = typedValue === businessType;

                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setBusinessType(typedValue)}
                    className={`rounded-[24px] border p-5 text-left transition ${
                      isActive
                        ? "border-[var(--accent)] bg-[var(--panel-soft)]"
                        : "border-[var(--panel-border)] bg-white hover:border-[#6c56ff]/40"
                    }`}
                  >
                    <p className="text-base font-semibold text-[var(--foreground)]">
                      {meta.label}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                      {meta.description}
                    </p>
                    <p className="mt-3 text-xs text-[var(--muted)]">
                      {meta.onboardingHint}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <TextField
              label="Nome do workspace"
              value={workspaceName}
              onChange={setWorkspaceName}
            />
            <TextField
              label="Responsável"
              value={operatorName}
              onChange={setOperatorName}
            />
            <TextField
              label="E-mail operacional"
              value={operatorEmail}
              onChange={setOperatorEmail}
              type="email"
            />
            <SelectField
              label="Moeda padrão"
              value={currency}
              onChange={(value) => setCurrency(value as DisplayCurrency)}
              options={(["BRL", "USD", "EUR"] as const).map((item) => ({
                value: item,
                label: `${item} · ${currencyMeta[item].label}`,
              }))}
            />
          </div>

          <div className="mt-8">
            <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-[var(--muted)]">
              Perfil de negócio
            </p>

            <div className="mt-4 grid gap-4 xl:grid-cols-3">
              {businessPresets.map((preset) => {
                const isActive = preset.id === presetId;

                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => setPresetId(preset.id)}
                    className={`rounded-[24px] border p-5 text-left transition ${
                      isActive
                        ? "border-[var(--accent)] bg-[var(--panel-soft)]"
                        : "border-[var(--panel-border)] bg-white hover:border-[#6c56ff]/40"
                    }`}
                  >
                    <p className="text-base font-semibold text-[var(--foreground)]">
                      {preset.label}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                      {preset.description}
                    </p>
                    <p className="mt-3 text-xs text-[var(--muted)]">
                      {preset.audience}
                    </p>
                  </button>
                );
              })}
            </div>

            <div className="mt-5 rounded-[24px] border border-[var(--panel-border)] bg-[var(--panel-soft)] px-5 py-5">
              <p className="text-sm font-semibold text-[var(--foreground)]">
                Políticas iniciais do perfil {activePreset.label}
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                <Stat
                  label="Margem alvo"
                  value={`${activePreset.defaults.profitMarginPercentage}%`}
                />
                <Stat
                  label="Margem saudável"
                  value={`${activePreset.defaults.healthyMarginTargetPercentage}%`}
                />
                <Stat
                  label="Perdas"
                  value={`${activePreset.defaults.lossPercentage}%`}
                />
                <Stat
                  label="Pró-labore/h"
                  value={`R$ ${activePreset.defaults.laborCostPerHour.toFixed(2).replace(".", ",")}`}
                />
                <Stat
                  label="MO sujeita à falha"
                  value={`${activePreset.defaults.lossLaborSharePercentage}%`}
                />
              </div>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--panel-border)] pt-5">
            <p className="max-w-2xl text-sm text-[var(--muted)]">
              Você poderá ajustar todos esses parâmetros depois em{" "}
              <strong>Preferências</strong>.
            </p>

            <button
              type="button"
              onClick={() =>
                onComplete(
                  buildPreferencesFromPreset(presetId, {
                    workspaceName,
                    operatorName,
                    operatorEmail,
                    businessType,
                    defaultDisplayCurrency: currency,
                    onboardingCompleted: businessType !== null,
                    applyPresetToNewCalculations: true,
                  }),
                )
              }
              disabled={businessType === null}
              className="rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white transition hover:brightness-110"
            >
              Salvar e começar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "email";
}) {
  return (
    <label>
      <span className="font-mono text-[11px] uppercase tracking-[0.24em] text-[var(--muted)]">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-2xl border border-[var(--panel-border)] bg-white px-4 py-3 text-base text-[var(--foreground)] outline-none transition focus:border-[#6c56ff] focus:ring-2 focus:ring-[#6c56ff]/20"
      />
    </label>
  );
}

function SelectField({
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
      <span className="font-mono text-[11px] uppercase tracking-[0.24em] text-[var(--muted)]">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-2xl border border-[var(--panel-border)] bg-white px-4 py-3 text-base text-[var(--foreground)] outline-none transition focus:border-[#6c56ff] focus:ring-2 focus:ring-[#6c56ff]/20"
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[18px] border border-[var(--panel-border)] bg-white p-4">
      <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-[var(--muted)]">
        {label}
      </p>
      <p className="mt-2 text-sm font-semibold text-[var(--foreground)]">
        {value}
      </p>
    </div>
  );
}
