"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type ManualPixCheckoutButtonProps = {
  planId: "starter" | "growth";
  billingCycle?: "monthly" | "annual";
  label?: string;
  className?: string;
  loadingLabel?: string;
};

export function ManualPixCheckoutButton({
  planId,
  billingCycle = "monthly",
  label = "Gerar Pix manual",
  className = "app-button app-button-secondary w-full",
  loadingLabel = "Gerando Pix...",
}: ManualPixCheckoutButtonProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCheckout() {
    if (isLoading) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/billing/checkout/pix", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          planId,
          billingCycle,
        }),
      });

      const payload = (await response.json().catch(() => null)) as {
        error?: string;
        redirectTo?: string;
        refresh?: boolean;
      } | null;

      if (!response.ok) {
        if (payload?.refresh) {
          router.refresh();
          return;
        }

        setError(
          payload?.error ?? "Não foi possível gerar o Pix da assinatura.",
        );
        return;
      }

      if (payload?.redirectTo) {
        router.push(payload.redirectTo);
        router.refresh();
        return;
      }

      router.refresh();
    } catch {
      setError(
        "Não foi possível conectar ao serviço de cobrança. Tente novamente.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="grid gap-2">
      <button
        type="button"
        onClick={handleCheckout}
        disabled={isLoading}
        className={className}
      >
        {isLoading ? loadingLabel : label}
      </button>

      {error ? (
        <p className="text-sm leading-6 text-red-600" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
