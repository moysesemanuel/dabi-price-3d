"use client";

import { startTransition, useState } from "react";

export function BillingAdminReconciliationAction() {
  const [isRunning, setIsRunning] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  async function runReconciliation() {
    if (
      !window.confirm(
        "Executar a reconciliação de até 20 registros do provider agora?",
      )
    ) {
      return;
    }

    setIsRunning(true);
    setFeedback(null);

    try {
      const response = await fetch("/api/admin/billing/reconciliation", {
        method: "POST",
        headers: { Accept: "application/json" },
      });
      const payload = (await response.json().catch(() => null)) as
        | { error?: string; processed?: number; changed?: number; findings?: number }
        | null;

      if (!response.ok) {
        throw new Error(payload?.error ?? "Falha ao executar a reconciliação.");
      }

      startTransition(() => {
        setFeedback(
          `Reconciliação concluída: ${payload?.processed ?? 0} processados, ${payload?.changed ?? 0} alterados, ${payload?.findings ?? 0} findings.`,
        );
      });
    } catch (error) {
      setFeedback(
        error instanceof Error ? error.message : "Falha ao executar a reconciliação.",
      );
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <div className="mt-4 rounded-[22px] border border-[var(--panel-border)] bg-[rgba(255,255,255,0.82)] p-4">
      <p className="text-sm font-semibold text-[var(--foreground)]">
        Executar reconciliação do provider
      </p>
      <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
        Processa no máximo 20 assinaturas e invoices pendentes, registra a ação na auditoria e não substitui os jobs automáticos.
      </p>
      <button
        type="button"
        onClick={() => void runReconciliation()}
        disabled={isRunning}
        className="app-button app-button-secondary mt-4"
      >
        {isRunning ? "Reconciliando..." : "Executar reconciliação"}
      </button>
      {feedback ? <p className="mt-3 text-sm text-[var(--foreground)]">{feedback}</p> : null}
    </div>
  );
}
