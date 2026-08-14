"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type BillingCycleChangeButtonProps = {
  targetBillingCycle: "monthly" | "annual";
};

export function BillingCycleChangeButton({
  targetBillingCycle,
}: BillingCycleChangeButtonProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isAnnual = targetBillingCycle === "annual";

  async function handleCycleChange() {
    if (isLoading) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        isAnnual
          ? "/api/billing/subscriptions/cycle-change/pix"
          : "/api/billing/subscriptions/cycle-change",
        { method: "POST" },
      );
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
        redirectTo?: string;
      } | null;

      if (!response.ok) {
        setError(
          payload?.error ?? "Não foi possível alterar o ciclo da assinatura.",
        );
        return;
      }

      if (payload?.redirectTo) {
        router.push(payload.redirectTo);
      }

      router.refresh();
    } catch {
      setError("Não foi possível conectar ao serviço de billing. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="grid gap-2">
      <button
        type="button"
        onClick={handleCycleChange}
        disabled={isLoading}
        className="app-button app-button-primary"
      >
        {isLoading
          ? isAnnual
            ? "Gerando Pix anual..."
            : "Agendando mudança..."
          : isAnnual
            ? "Mudar para anual com crédito proporcional"
            : "Agendar mudança para mensal"}
      </button>
      <p className="text-sm leading-6 text-[var(--muted)]">
        {isAnnual
          ? "O valor anual recebe crédito proporcional do mês já pago."
          : "A assinatura anual permanece ativa até o fim do período atual."}
      </p>
      {error ? (
        <p className="text-sm leading-6 text-red-600" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
