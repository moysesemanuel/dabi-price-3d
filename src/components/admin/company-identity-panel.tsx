"use client";

import { useState } from "react";
import type { CompanyIdentity } from "@/lib/legal/company";

type ChangeEntry = {
  id: string;
  changes: Record<string, { from: string | null; to: string | null }>;
  changed_at: string;
  changed_by_email: string | null;
};

const fields: Array<{
  key: keyof CompanyIdentity;
  label: string;
  hint: string;
  required?: boolean;
}> = [
  {
    key: "legalName",
    label: "Razão social",
    hint: "Nome empresarial como consta na Receita.",
    required: true,
  },
  {
    key: "tradeName",
    label: "Nome comercial",
    hint: "Como a marca aparece para o cliente.",
  },
  {
    key: "cnpj",
    label: "CNPJ",
    hint: "Exigido pelo Decreto 7.962/2013 nas páginas públicas.",
    required: true,
  },
  {
    key: "address",
    label: "Endereço",
    hint: "Endereço físico completo, com CEP.",
    required: true,
  },
  {
    key: "privacyEmail",
    label: "E-mail de privacidade",
    hint: "Canal do titular de dados exigido pela LGPD.",
    required: true,
  },
  {
    key: "dataProtectionOfficer",
    label: "Encarregado (DPO)",
    hint: "Opcional para empresa de pequeno porte.",
  },
  {
    key: "supportEmail",
    label: "E-mail de suporte",
    hint: "Opcional.",
  },
];

export function CompanyIdentityPanel({
  initialIdentity,
  history,
}: {
  initialIdentity: CompanyIdentity;
  history: ChangeEntry[];
}) {
  const [form, setForm] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      fields.map((field) => [field.key, initialIdentity[field.key] ?? ""]),
    ),
  );
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setIsSaving(true);
    setFeedback(null);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/admin/settings/company", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });

      const payload = (await response.json().catch(() => null)) as {
        changedFields?: string[];
        error?: string;
      } | null;

      if (!response.ok) {
        setErrorMessage(payload?.error ?? "Não foi possível salvar.");
        return;
      }

      const changed = payload?.changedFields ?? [];
      setFeedback(
        changed.length === 0
          ? "Nada mudou."
          : `Salvo. Campos alterados: ${changed.join(", ")}. As páginas legais já refletem a mudança.`,
      );
    } catch {
      setErrorMessage("Falha de rede ao salvar.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
        {fields.map((field) => (
          <label key={field.key} className="flex flex-col gap-2">
            <span className="text-sm font-semibold">
              {field.label}
              {field.required ? (
                <span className="ml-1 text-[var(--danger)]">*</span>
              ) : null}
            </span>
            <input
              type="text"
              value={form[field.key] ?? ""}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  [field.key]: event.target.value,
                }))
              }
              className="app-input"
            />
            <span className="text-xs text-[var(--muted)]">{field.hint}</span>
          </label>
        ))}

        <div className="md:col-span-2 flex flex-wrap items-center gap-4">
          <button
            type="submit"
            disabled={isSaving}
            className="app-button app-button-primary rounded-2xl px-5 py-3 text-sm"
          >
            {isSaving ? "Salvando..." : "Salvar identidade"}
          </button>
          <span className="text-xs text-[var(--muted)]">
            Campo em branco mantém o valor atual; não apaga.
          </span>
        </div>
      </form>

      {feedback ? (
        <p className="text-sm text-[var(--success)]">{feedback}</p>
      ) : null}
      {errorMessage ? (
        <p className="text-sm text-[var(--danger)]">{errorMessage}</p>
      ) : null}

      <div className="space-y-3">
        <h4 className="text-sm font-semibold">Histórico de alterações</h4>
        {history.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">
            Nenhuma alteração registrada. Os valores vêm do código.
          </p>
        ) : (
          <ul className="space-y-2">
            {history.map((entry) => (
              <li
                key={entry.id}
                className="rounded-2xl border border-[var(--panel-border)] px-4 py-3 text-sm"
              >
                <div className="flex flex-wrap justify-between gap-2 text-xs text-[var(--muted)]">
                  <span>
                    {new Date(entry.changed_at).toLocaleString("pt-BR")}
                  </span>
                  <span>{entry.changed_by_email ?? "usuário removido"}</span>
                </div>
                <ul className="mt-2 space-y-1">
                  {Object.entries(entry.changes).map(([key, change]) => (
                    <li key={key}>
                      <strong>{key}</strong>: {change.from ?? "vazio"} →{" "}
                      {change.to ?? "vazio"}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
