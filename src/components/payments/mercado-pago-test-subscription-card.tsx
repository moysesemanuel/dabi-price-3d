"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type WorkspacePlanId = "starter" | "growth";
type MercadoPagoGeneratedTestUser = {
  id: number;
  nickname: string;
  password: string;
  email: string;
  emailSource: "mercado_pago" | "derived_fallback";
  siteId: string | null;
};

const planOptions: Array<{ id: WorkspacePlanId; label: string }> = [
  { id: "starter", label: "DaBi Essencial" },
  { id: "growth", label: "DaBi Pro" },
];

export function MercadoPagoTestSubscriptionCard() {
  const router = useRouter();
  const [planId, setPlanId] = useState<WorkspacePlanId>("starter");
  const [payerEmail, setPayerEmail] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [generatedTestUser, setGeneratedTestUser] =
    useState<MercadoPagoGeneratedTestUser | null>(null);
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
        Use aqui o e-mail do comprador de teste do Mercado Pago, não o ID e nem o seu e-mail real.
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

                try {
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
                        error?: string;
                        requestId?: string;
                        initPoint?: string;
                      }
                    | null;

                  if (!response.ok || !payload?.initPoint) {
                    setFeedback(
                      payload?.error
                        ? `${payload.error}${payload.requestId ? ` · requestId ${payload.requestId}` : ""}`
                        : "Não foi possível iniciar o checkout de teste.",
                    );
                    return;
                  }

                  window.location.assign(payload.initPoint);
                  return;
                } catch {
                  setFeedback(
                    "Não foi possível abrir o checkout de teste agora. Tente novamente em instantes.",
                  );
                }
              });
            }}
            className="app-button app-button-primary w-full justify-center disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? "Abrindo..." : "Abrir checkout de teste"}
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={isPending}
          onClick={() => {
            startTransition(async () => {
              setFeedback(null);
              try {
                const response = await fetch(
                  "/api/payments/mercado-pago/test-users/create",
                  {
                    method: "POST",
                  },
                );

                const payload = (await response.json().catch(() => null)) as
                  | {
                      error?: string;
                      requestId?: string;
                      testUser?: MercadoPagoGeneratedTestUser;
                    }
                  | null;

                if (!response.ok || !payload?.testUser) {
                  setFeedback(
                    payload?.error
                      ? `${payload.error}${payload.requestId ? ` · requestId ${payload.requestId}` : ""}`
                      : "Não foi possível criar o comprador de teste.",
                  );
                  return;
                }

                setGeneratedTestUser(payload.testUser);
                setPayerEmail(payload.testUser.email ?? "");

                if (payload.testUser.emailSource === "derived_fallback") {
                  setFeedback(
                    `O Mercado Pago não devolveu o e-mail desse comprador. Usei o fallback ${payload.testUser.email} para seguir com o teste.`,
                  );
                }
              } catch {
                setFeedback(
                  "Não foi possível criar o comprador de teste agora. Tente novamente em instantes.",
                );
              }
            });
          }}
          className="app-button app-button-secondary"
        >
          {isPending ? "Processando..." : "Criar comprador de teste"}
        </button>

        <button
          type="button"
          disabled={isPending}
          onClick={() => {
            startTransition(async () => {
              setFeedback(null);

              try {
                const response = await fetch(
                  "/api/payments/mercado-pago/subscriptions/simulate",
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

                const payload = (await response.json().catch(() => null)) as
                  | {
                      ok?: boolean;
                      error?: string;
                      requestId?: string;
                      changed?: boolean;
                    }
                  | null;

                if (!response.ok || !payload?.ok) {
                  setFeedback(
                    payload?.error
                      ? `${payload.error}${payload.requestId ? ` · requestId ${payload.requestId}` : ""}`
                      : "Não foi possível simular a assinatura do workspace.",
                  );
                  return;
                }

                setFeedback(
                  payload.changed
                    ? "Assinatura simulada com sucesso. O plano atual do workspace foi atualizado."
                    : "A simulação foi executada, mas o workspace já estava nesse mesmo plano.",
                );
                router.refresh();
              } catch {
                setFeedback(
                  "Não foi possível simular a assinatura agora. Tente novamente em instantes.",
                );
              }
            });
          }}
          className="app-button app-button-secondary"
        >
          {isPending ? "Aplicando..." : "Simular ativação interna"}
        </button>
      </div>

      <div className="mt-6 rounded-[22px] border border-[var(--panel-border)] bg-[rgba(255,255,255,0.72)] px-5 py-4 text-sm text-[var(--muted)]">
        Use comprador de teste do Mercado Pago e cartão de teste. Este botão cria o
        preapproval pelo backend e abre o `init_point` retornado pela integração, igual
        ao fluxo novo de checkout pendente. Se a lista de contas de teste mostrar só
        `User ID` e `Usuário`, use o botão acima: a API do Mercado Pago devolve o
        `email` do comprador de teste, que é o dado exigido pela assinatura.
      </div>

      <div className="mt-4 rounded-[22px] border border-[var(--panel-border)] bg-[rgba(255,255,255,0.72)] px-5 py-4 text-sm text-[var(--muted)]">
        Se o sandbox do Mercado Pago bloquear o checkout, use `Simular ativação interna`
        para validar o upgrade do workspace sem depender do ambiente externo.
      </div>

      {generatedTestUser ? (
        <div className="mt-4 rounded-[22px] border border-[var(--panel-border)] bg-[rgba(255,255,255,0.84)] px-5 py-4">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[var(--accent)]">
            Comprador de teste gerado
          </p>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <InfoLine label="User ID" value={String(generatedTestUser.id)} />
            <InfoLine label="Usuário" value={generatedTestUser.nickname} />
            <InfoLine label="Senha" value={generatedTestUser.password} />
            <InfoLine label="E-mail" value={generatedTestUser.email} />
          </div>
          {generatedTestUser.emailSource === "derived_fallback" ? (
            <p className="mt-3 text-xs leading-6 text-[var(--muted)]">
              Esse e-mail foi gerado pela aplicação porque a resposta do Mercado Pago
              veio sem `email`. Ele já é preenchido automaticamente no campo acima.
            </p>
          ) : null}
        </div>
      ) : null}

      {feedback ? (
        <div className="mt-4 rounded-[18px] border border-[#f2d6e3] bg-[#fff5f9] px-4 py-3 text-sm text-[#b85178]">
          {feedback}
        </div>
      ) : null}
    </section>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[18px] border border-[var(--panel-border)] bg-white px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
        {label}
      </p>
      <p className="mt-2 text-sm text-[var(--foreground)]">{value}</p>
    </div>
  );
}
