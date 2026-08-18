"use client";

import { useState } from "react";

type MercadoPagoSubscriptionManageButtonProps = {
  action: "resume" | "cancel";
  label: string;
  className?: string;
};

export function MercadoPagoSubscriptionManageButton({
  action,
  label,
  className = "app-button app-button-primary w-full",
}: MercadoPagoSubscriptionManageButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAction() {
    if (isLoading) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        "/api/payments/mercado-pago/subscriptions/manage",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action,
          }),
        },
      );

      const payload = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;

      if (!response.ok) {
        setError(
          payload?.error ??
            "Não foi possível atualizar a assinatura. Tente novamente.",
        );
        return;
      }

      window.location.reload();
    } catch {
      setError(
        "Não foi possível conectar ao serviço de assinatura. Tente novamente.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="grid gap-2">
      <button
        type="button"
        onClick={handleAction}
        disabled={isLoading}
        className={className}
      >
        {isLoading ? "Processando..." : label}
      </button>

      {error ? (
        <p className="text-sm leading-6 text-red-600" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
