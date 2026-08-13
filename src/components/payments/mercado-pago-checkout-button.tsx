"use client";

import { useState } from "react";

type MercadoPagoCheckoutButtonProps = {
  planId: "starter" | "growth";
  label?: string;
  className?: string;
};

export function MercadoPagoCheckoutButton({
  planId,
  label = "Assinar este plano",
  className = "app-button app-button-primary w-full",
}: MercadoPagoCheckoutButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCheckout() {
    if (isLoading) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        "/api/payments/mercado-pago/subscriptions/checkout",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            planId,
          }),
        },
      );

      const payload = (await response.json().catch(() => null)) as {
        initPoint?: string;
        error?: string;
      } | null;

      if (!response.ok) {
        setError(
          payload?.error ??
            "Não foi possível iniciar a assinatura. Tente novamente.",
        );
        return;
      }

      if (!payload?.initPoint) {
        setError(
          "O checkout foi iniciado, mas a URL de pagamento não foi retornada.",
        );
        return;
      }

      window.location.href = payload.initPoint;
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
        onClick={handleCheckout}
        disabled={isLoading}
        className={className}
      >
        {isLoading ? "Abrindo Mercado Pago..." : label}
      </button>

      {error ? (
        <p className="text-sm leading-6 text-red-600" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}