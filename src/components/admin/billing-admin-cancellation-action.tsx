"use client";

import { useState } from "react";

export function BillingAdminCancellationAction({ subscriptionId }: { subscriptionId: string }) {
  const [isCancelling, setIsCancelling] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  async function cancelSubscription() {
    if (!window.confirm("Agendar o cancelamento ao fim do período atual?")) return;
    setIsCancelling(true);
    setFeedback(null);
    try {
      const response = await fetch(`/api/admin/billing/subscriptions/${subscriptionId}/cancel`, { method: "POST" });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(payload?.error ?? "Falha ao agendar cancelamento.");
      setFeedback("Cancelamento agendado para o fim do período atual.");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Falha ao agendar cancelamento.");
    } finally {
      setIsCancelling(false);
    }
  }

  return (
    <div className="rounded-[22px] border border-red-200 bg-red-50 p-4">
      <p className="text-sm font-semibold text-red-950">Agendar cancelamento administrativo</p>
      <p className="mt-2 text-sm leading-7 text-red-900">Cancela a renovação no provider e mantém o acesso até o fim do período atual.</p>
      <button type="button" onClick={() => void cancelSubscription()} disabled={isCancelling} className="app-button mt-4 border border-red-300 bg-white text-red-900">
        {isCancelling ? "Agendando..." : "Agendar cancelamento"}
      </button>
      {feedback ? <p className="mt-3 text-sm text-red-950">{feedback}</p> : null}
    </div>
  );
}
