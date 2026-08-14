"use client";

import { useState } from "react";

type BillingDowngradeButtonProps = {
  targetPlanId: "starter" | "growth";
  label: string;
  className?: string;
};

export function BillingDowngradeButton({
  targetPlanId,
  label,
  className = "app-button app-button-secondary w-full",
}: BillingDowngradeButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDowngrade() {
    if (isLoading) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/billing/subscriptions/downgrade", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          planId: targetPlanId,
        }),
      });

      const payload = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;

      if (!response.ok) {
        setError(
          payload?.error ??
            "Não foi possível agendar o downgrade. Tente novamente.",
        );
        return;
      }

      window.location.reload();
    } catch {
      setError(
        "Não foi possível conectar ao serviço de billing. Tente novamente.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="grid gap-2">
      <button
        type="button"
        onClick={handleDowngrade}
        disabled={isLoading}
        className={className}
      >
        {isLoading ? "Agendando..." : label}
      </button>

      {error ? (
        <p className="text-sm leading-6 text-red-600" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
