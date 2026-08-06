"use client";

import { useMemo, useState } from "react";
import { currencyMeta, type DisplayCurrency } from "@/lib/currency/display-currency";
import {
  buildPreferencesFromPreset,
  businessPresets,
  type AppPreferences,
  type BusinessPresetId,
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
      <div className="w-full max-w-4xl rounded-[32px] border border-black/8 bg-white shadow-[0_40px_100px_rgba(0,0,0,0.22)]">
        <div className="border-b border-black/8 px-6 py-6 sm:px-8">
          <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-[#d84f00]">
            Setup inicial
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-[#18120d]">
            Configure sua operação antes da primeira precificação
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-[#7c6858]">
            Um SaaS maduro precisa nascer com políticas claras. Escolha o perfil
            da operação, defina quem administra a conta e salve um padrão para
            novas simulações.
          </p>
        </div>

        <div className="px-6 py-6 sm:px-8">
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
            <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-[#7c6858]">
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
                        ? "border-[#ff6a00] bg-[#fff3ea]"
                        : "border-black/8 bg-white hover:border-[#ff6a00]/40"
                    }`}
                  >
                    <p className="text-base font-semibold text-[#18120d]">
                      {preset.label}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-[#7c6858]">
                      {preset.description}
                    </p>
                    <p className="mt-3 text-xs text-[#7c6858]">
                      {preset.audience}
                    </p>
                  </button>
                );
              })}
            </div>

            <div className="mt-5 rounded-[24px] border border-black/8 bg-[#fcfaf8] px-5 py-5">
              <p className="text-sm font-semibold text-[#18120d]">
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
                  label="Expansão/h"
                  value={`R$ ${activePreset.defaults.expansionReserveCostPerHour.toFixed(2).replace(".", ",")}`}
                />
              </div>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-black/8 pt-5">
            <p className="max-w-2xl text-sm text-[#7c6858]">
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
                    defaultDisplayCurrency: currency,
                    onboardingCompleted: true,
                    applyPresetToNewCalculations: true,
                  }),
                )
              }
              className="rounded-full bg-[#ff6a00] px-5 py-3 text-sm font-semibold text-white transition hover:brightness-110"
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
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[18px] border border-black/8 bg-white p-4">
      <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-[#7c6858]">
        {label}
      </p>
      <p className="mt-2 text-sm font-semibold text-[#18120d]">{value}</p>
    </div>
  );
}
