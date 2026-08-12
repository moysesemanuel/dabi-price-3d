"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  businessPresets,
  businessTypeMeta,
  type AppPreferences,
} from "@/lib/settings/app-preferences";

type OnboardingFormProps = {
  initialPreferences: AppPreferences;
  selectedPlan?: "starter" | "growth";
};

export function OnboardingForm({
  initialPreferences,
  selectedPlan,
}: OnboardingFormProps) {
  const router = useRouter();

  const [businessType, setBusinessType] = useState(
    initialPreferences.businessType,
  );

  const [businessPresetId, setBusinessPresetId] = useState(
    initialPreferences.businessPresetId,
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (!businessType) {
      setErrorMessage("Escolha o tipo do seu negócio.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const selectedPreset = businessPresets.find(
        (preset) => preset.id === businessPresetId,
      );

      const response = await fetch("/api/workspace/preferences", {
        method: "PUT",
        headers: {
          Accept: "application/json",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          businessType,
          businessPresetId,
          pricingDefaults:
            selectedPreset?.defaults ?? initialPreferences.pricingDefaults,
          onboardingCompleted: true,
        }),
      });

      const payload = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;

      if (!response.ok) {
        throw new Error(
          payload?.error ?? "Não foi possível concluir o onboarding.",
        );
      }

      if (selectedPlan) {
        router.push(`/app/planos?plan=${selectedPlan}&origin=onboarding`);
      } else {
        router.push("/app/precificacao");
      }

      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível concluir o onboarding.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <section>
        <p className="text-sm font-semibold text-[var(--foreground)]">
          Qual é o seu negócio?
        </p>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {Object.entries(businessTypeMeta).map(([value, meta]) => {
            const isSelected = businessType === value;

            return (
              <button
                key={value}
                type="button"
                onClick={() =>
                  setBusinessType(
                    value as NonNullable<AppPreferences["businessType"]>,
                  )
                }
                className={`rounded-[24px] border p-5 text-left transition ${isSelected
                    ? "border-[#6c56ff] bg-[#6c56ff]/10"
                    : "border-[var(--panel-border)] bg-[var(--panel-soft)]"
                  }`}
              >
                <strong className="block text-[var(--foreground)]">
                  {meta.label}
                </strong>

                <span className="mt-2 block text-sm leading-6 text-[var(--muted)]">
                  {meta.onboardingHint}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <p className="text-sm font-semibold text-[var(--foreground)]">
          Como está sua operação hoje?
        </p>

        <div className="mt-4 grid gap-3">
          {businessPresets.map((preset) => {
            const isSelected = businessPresetId === preset.id;

            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => setBusinessPresetId(preset.id)}
                className={`rounded-[24px] border p-5 text-left transition ${isSelected
                    ? "border-[#6c56ff] bg-[#6c56ff]/10"
                    : "border-[var(--panel-border)] bg-[var(--panel-soft)]"
                  }`}
              >
                <strong className="block text-[var(--foreground)]">
                  {preset.label}
                </strong>

                <span className="mt-2 block text-sm leading-6 text-[var(--muted)]">
                  {preset.description}
                </span>

                <span className="mt-2 block text-xs text-[var(--muted)]">
                  {preset.audience}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {errorMessage ? (
        <div className="rounded-[24px] border border-[#d45f5f]/30 bg-[#fff5f5] px-4 py-4 text-sm text-[#a53b3b]">
          {errorMessage}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={isSubmitting}
        className="app-button app-button-primary w-full rounded-2xl px-5 py-3"
      >
        {isSubmitting
          ? "Configurando seu workspace..."
          : "Começar a precificar"}
      </button>
    </form>
  );
}
