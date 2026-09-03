"use client";

import { useState } from "react";

type BillingAdminSubscriptionActionsProps = {
  subscriptionId: string;
  currentAccessUntil: string | null;
};

export function BillingAdminSubscriptionActions({
  subscriptionId,
  currentAccessUntil,
}: BillingAdminSubscriptionActionsProps) {
  const [draftAccessUntil, setDraftAccessUntil] = useState(
    normalizeDateTimeLocalValue(currentAccessUntil),
  );
  const [accessUntilReason, setAccessUntilReason] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isInspecting, setIsInspecting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [providerSnapshot, setProviderSnapshot] = useState<string | null>(null);

  async function handleAccessUntilSave(nextAccessUntil: string | null) {
    if (isSaving) {
      return;
    }

    setIsSaving(true);
    setFeedback(null);

    try {
      const response = await fetch(
        `/api/admin/billing/subscriptions/${subscriptionId}/access-until`,
        {
          method: "POST",
          headers: {
            Accept: "application/json",
            "content-type": "application/json",
          },
          body: JSON.stringify({
            accessUntil: nextAccessUntil,
            reason: accessUntilReason,
          }),
        },
      );
      const payload = (await response.json().catch(() => null)) as
        | { error?: string; subscription?: { accessUntil?: string | null } }
        | null;

      if (!response.ok) {
        throw new Error(payload?.error ?? "Falha ao atualizar accessUntil.");
      }

      setFeedback("accessUntil atualizado com sucesso.");
      setDraftAccessUntil(
        normalizeDateTimeLocalValue(payload?.subscription?.accessUntil ?? null),
      );
      setAccessUntilReason("");
    } catch (error) {
      setFeedback(
        error instanceof Error
          ? error.message
          : "Falha ao atualizar accessUntil.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleInspectProvider() {
    if (isInspecting) {
      return;
    }

    setIsInspecting(true);
    setFeedback(null);

    try {
      const response = await fetch(
        `/api/admin/billing/subscriptions/${subscriptionId}/provider`,
        {
          method: "POST",
          headers: {
            Accept: "application/json",
          },
        },
      );
      const payload = (await response.json().catch(() => null)) as
        | { error?: string }
        | Record<string, unknown>
        | null;

      if (!response.ok) {
        throw new Error(
          payload && "error" in payload
            ? String(payload.error ?? "")
            : "Falha ao consultar provider.",
        );
      }

      setProviderSnapshot(JSON.stringify(payload, null, 2));
      setFeedback("Consulta ao provider realizada.");
    } catch (error) {
      setFeedback(
        error instanceof Error ? error.message : "Falha ao consultar provider.",
      );
    } finally {
      setIsInspecting(false);
    }
  }

  return (
    <section className="app-card-soft space-y-5 p-6">
      <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-[var(--muted)]">
          Ferramentas administrativas
        </p>
        <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-[var(--foreground)]">
          Intervenções de suporte
        </h2>
        <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
          Use estas ações quando precisar conceder exceção operacional sem alterar o
          período comercial, ou quando for necessário conferir o estado remoto da
          assinatura no provider.
        </p>
      </div>

      <div className="rounded-[22px] border border-[var(--panel-border)] bg-[rgba(255,255,255,0.82)] p-4">
        <label className="block text-sm font-medium text-[var(--foreground)]">
          accessUntil
        </label>
        <p className="mt-2 text-xs leading-6 text-[var(--muted)]">
          A data abaixo concede exceção administrativa de acesso. Limpar o campo
          remove a exceção manual. Toda mudança exige justificativa e fica na
          auditoria da assinatura.
        </p>
        <input
          type="datetime-local"
          value={draftAccessUntil}
          onChange={(event) => setDraftAccessUntil(event.target.value)}
          className="mt-4 w-full rounded-[16px] border border-[var(--panel-border)] bg-white px-4 py-3 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--accent)]"
        />
        <label className="mt-4 block text-sm font-medium text-[var(--foreground)]">
          Justificativa
          <textarea
            value={accessUntilReason}
            onChange={(event) => setAccessUntilReason(event.target.value)}
            maxLength={500}
            rows={3}
            placeholder="Ex.: prazo adicional aprovado pelo suporte devido a indisponibilidade do provider."
            className="mt-2 w-full resize-y rounded-[16px] border border-[var(--panel-border)] bg-white px-4 py-3 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--accent)]"
          />
        </label>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() =>
              handleAccessUntilSave(
                draftAccessUntil ? new Date(draftAccessUntil).toISOString() : null,
              )
            }
            disabled={isSaving || !accessUntilReason.trim()}
            className="app-button app-button-primary"
          >
            {isSaving ? "Salvando..." : "Salvar accessUntil"}
          </button>
          <button
            type="button"
            onClick={() => {
              setDraftAccessUntil("");
              void handleAccessUntilSave(null);
            }}
            disabled={isSaving || !accessUntilReason.trim()}
            className="app-button app-button-secondary"
          >
            Remover exceção
          </button>
        </div>
      </div>

      <div className="rounded-[22px] border border-[var(--panel-border)] bg-[rgba(255,255,255,0.82)] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-[var(--foreground)]">
              Consultar provider remoto
            </p>
            <p className="mt-2 text-xs leading-6 text-[var(--muted)]">
              Busca o estado atual da assinatura diretamente no provider e registra
              a inspeção na auditoria.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void handleInspectProvider()}
            disabled={isInspecting}
            className="app-button app-button-secondary"
          >
            {isInspecting ? "Consultando..." : "Consultar provider"}
          </button>
        </div>
      </div>

      {feedback ? (
        <p className="rounded-[18px] border border-[var(--panel-border)] bg-[rgba(255,255,255,0.78)] px-4 py-3 text-sm text-[var(--foreground)]">
          {feedback}
        </p>
      ) : null}

      {providerSnapshot ? (
        <pre className="overflow-x-auto rounded-[22px] border border-[var(--panel-border)] bg-[rgb(14,23,43)] p-4 text-xs leading-6 text-[rgb(226,232,240)]">
          {providerSnapshot}
        </pre>
      ) : null}
    </section>
  );
}

function normalizeDateTimeLocalValue(value: string | null) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const timezoneOffsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - timezoneOffsetMs).toISOString().slice(0, 16);
}
