"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type BillingUpgradePixButtonProps = {
  targetPlanId: "growth" | "scale";
  label: string;
  className?: string;
};

export function BillingUpgradePixButton({
  targetPlanId,
  label,
  className = "app-button app-button-primary w-full",
}: BillingUpgradePixButtonProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleUpgrade() {
    if (isLoading) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/billing/subscriptions/upgrade/pix", {
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
        redirectTo?: string;
      } | null;

      if (!response.ok) {
        setError(
          payload?.error ?? "Não foi possível gerar o Pix do upgrade.",
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
        onClick={handleUpgrade}
        disabled={isLoading}
        className={className}
      >
        {isLoading ? "Gerando upgrade..." : label}
      </button>

      {error ? (
        <p className="text-sm leading-6 text-red-600" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
