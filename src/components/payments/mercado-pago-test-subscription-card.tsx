"use client";

import { useState, useTransition } from "react";

type WorkspacePlanId = "starter" | "growth";

const planOptions: Array<{ id: WorkspacePlanId; label: string }> = [
  { id: "starter", label: "DaBi Essencial" },
  { id: "growth", label: "DaBi Pro" },
];

export function MercadoPagoTestSubscriptionCard() {
  const [planId, setPlanId] = useState<WorkspacePlanId>("starter");
  const [payerEmail, setPayerEmail] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const canSubmit = payerEmail.trim().length > 0 && !isPending;

  return (
    <section className="app-card p-6 sm:p-7">
      <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-[var(--accent)]">
        Sandbox operacional
      </p>
      <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-[var(--foreground)]">
        Assinatura de teste com integração
      </h2>
      <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--muted)]">
        Gere um checkout de assinatura pelo backend já vinculado ao workspace.
        Use aqui o e-mail do comprador de teste do Mercado Pago, não o seu e-mail real.
      </p>

      <div className="mt-6 grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)_220px]">
        <label className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
            Plano
          </span>
          <select
            value={planId}
            onChange={(event) => setPlanId(event.target.value as WorkspacePlanId)}
            className="w-full rounded-[18px] border border-[var(--panel-border)] bg-white px-4 py-3 text-sm text-[var(--foreground)] outline-none"
          >
            {planOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
            E-mail do comprador de teste
          </span>
          <input
            type="email"
            value={payerEmail}
            onChange={(event) => setPayerEmail(event.target.value)}
            placeholder="teste_comprador@email.com"
            className="w-full rounded-[18px] border border-[var(--panel-border)] bg-white px-4 py-3 text-sm text-[var(--foreground)] outline-none"
          />
        </label>

        <div className="flex items-end">
          <button
            type="button"
            disabled={!canSubmit}
            onClick={() => {
              startTransition(async () => {
                setFeedback(null);

                const response = await fetch(
                  "/api/payments/mercado-pago/subscriptions/start",
                  {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                      planId,
                      payerEmail,
                    }),
                  },
                );

                const payload = (await response.json().catch(() => null)) as
                  | {
                      initPoint?: string;
                      error?: string;
                      requestId?: string;
                    }
                  | null;

                if (!response.ok || !payload?.initPoint) {
                  setFeedback(
                    payload?.error
                      ? `${payload.error}${payload.requestId ? ` · requestId ${payload.requestId}` : ""}`
                      : "Não foi possível gerar a assinatura de teste.",
                  );
                  return;
                }

                window.open(payload.initPoint, "_blank", "noopener,noreferrer");
              });
            }}
            className="app-button app-button-primary w-full justify-center disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? "Gerando..." : "Abrir checkout de teste"}
          </button>
        </div>
      </div>

      <div className="mt-6 rounded-[22px] border border-[var(--panel-border)] bg-[rgba(255,255,255,0.72)] px-5 py-4 text-sm text-[var(--muted)]">
        Use comprador de teste do Mercado Pago e cartão de teste. O checkout aberto aqui
        já leva `external_reference` do workspace para o webhook conseguir vincular a assinatura.
      </div>

      {feedback ? (
        <div className="mt-4 rounded-[18px] border border-[#f2d6e3] bg-[#fff5f9] px-4 py-3 text-sm text-[#b85178]">
          {feedback}
        </div>
      ) : null}
    </section>
  );
}
