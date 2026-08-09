"use client";

import { useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BackLink } from "@/components/app/back-link";
import { formatCurrency, formatPercent } from "@/lib/pricing/formatters";
import {
  clearCalculationHistory,
  deleteCalculationFromHistory,
  loadCalculationHistory,
  queueCalculationForEditing,
  readCalculationHistory,
  subscribeCalculationHistory,
} from "@/lib/history/calculation-history";

export default function BudgetsPage() {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const items = useSyncExternalStore(
    subscribeCalculationHistory,
    readCalculationHistory,
    () => [],
  );

  useEffect(() => {
    void loadCalculationHistory().catch((error) => {
      setErrorMessage(
        error instanceof Error ? error.message : "Falha ao carregar os orçamentos.",
      );
    });
  }, []);

  async function handleClearHistory() {
    setErrorMessage(null);

    try {
      await clearCalculationHistory();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Falha ao limpar os orçamentos.",
      );
    }
  }

  async function handleDeleteItem(id: string) {
    setErrorMessage(null);

    try {
      await deleteCalculationFromHistory(id);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Falha ao excluir o orçamento.",
      );
    }
  }

  function handleEditItem(id: string) {
    queueCalculationForEditing(id);
    router.push("/app/precificacao");
  }

  return (
    <div className="app-page">
      <header className="app-header flex flex-wrap items-end justify-between gap-4">
        <div>
          <BackLink href="/app" label="Voltar para o início" />
          <p className="app-eyebrow">Orçamentos</p>
          <h1 className="app-title">Orçamentos salvos do workspace</h1>
          <p className="app-copy max-w-[620px]">
            Reencontre cálculos já salvos, retome edições e mantenha a camada de
            orçamento separada da montagem técnica da precificação.
          </p>
        </div>

        {items.length > 0 ? (
          <button
            type="button"
            onClick={handleClearHistory}
            className="app-button app-button-secondary"
          >
            Limpar lista
          </button>
        ) : null}
      </header>

      <section className="app-card p-5 sm:p-6">
        {errorMessage ? (
          <div className="mb-4 rounded-[20px] border border-[#d45f5f]/30 bg-[#fff5f5] px-4 py-3 text-sm text-[#a53b3b]">
            {errorMessage}
          </div>
        ) : null}

        {items.length === 0 ? (
          <div className="app-card-soft p-8 text-center">
            <p className="text-lg font-semibold text-[var(--foreground)]">
              Nenhum orçamento salvo ainda.
            </p>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Use a precificadora e salve o primeiro cálculo para começar sua base
              de orçamentos.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-[22px] border border-[var(--panel-border)]">
            <div className="overflow-x-auto">
              <table className="min-w-full bg-[var(--panel-soft)]">
                <thead>
                  <tr className="border-b border-[var(--panel-border)] text-left">
                    <HeaderCell>Data</HeaderCell>
                    <HeaderCell>Produto</HeaderCell>
                    <HeaderCell>Canal</HeaderCell>
                    <HeaderCell>Moeda</HeaderCell>
                    <HeaderCell>Venda</HeaderCell>
                    <HeaderCell>Custos</HeaderCell>
                    <HeaderCell>Lucro</HeaderCell>
                    <HeaderCell>Margem</HeaderCell>
                    <HeaderCell>ERP</HeaderCell>
                    <HeaderCell>Ações</HeaderCell>
                  </tr>
                </thead>

                <tbody>
                  {items.map((item) => (
                    <tr
                      key={item.id}
                      className="border-b border-[var(--panel-border)] last:border-b-0"
                    >
                      <BodyCell>{formatSavedDate(item.savedAt)}</BodyCell>
                      <BodyCell>{item.productName}</BodyCell>
                      <BodyCell>{item.salesChannelLabel}</BodyCell>
                      <BodyCell>{item.displayCurrency}</BodyCell>
                      <BodyCell>
                        {formatCurrency(item.summary.salePrice, item.displayCurrency)}
                      </BodyCell>
                      <BodyCell className="text-[#c62828]">
                        -{" "}
                        {formatCurrency(item.summary.totalCost, item.displayCurrency)}
                      </BodyCell>
                      <BodyCell className="text-[#1f8b4c]">
                        {formatCurrency(item.summary.profit, item.displayCurrency)}
                      </BodyCell>
                      <BodyCell>
                        {formatPercent(item.summary.marginPercentage)}
                      </BodyCell>
                      <BodyCell>
                        {item.erpProduct ? (
                          <div className="space-y-1">
                            <div className="text-xs font-medium text-[var(--accent)]">
                              Sincronizado
                            </div>
                            <div className="text-xs text-[var(--muted)]">
                              {item.erpProduct.sku || item.erpProduct.id || "Sem SKU"}
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-[var(--muted)]">Sem vínculo</span>
                        )}
                      </BodyCell>
                      <BodyCell>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleEditItem(item.id)}
                            className="rounded-xl border border-[#6c56ff]/25 px-3 py-2 text-xs font-medium text-[var(--foreground)] transition hover:border-[var(--accent)] hover:bg-[var(--accent)] hover:text-white"
                          >
                            Editar
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteItem(item.id)}
                            className="rounded-xl border border-[var(--panel-border)] px-3 py-2 text-xs font-medium text-[var(--foreground)] transition hover:border-[var(--accent)] hover:bg-[var(--accent)] hover:text-white"
                          >
                            Excluir
                          </button>
                        </div>
                      </BodyCell>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function HeaderCell({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-4 font-mono text-[11px] uppercase tracking-[0.24em] text-[var(--muted)]">
      {children}
    </th>
  );
}

function BodyCell({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <td className={`px-4 py-4 text-sm text-[var(--foreground)] ${className}`}>
      {children}
    </td>
  );
}

function formatSavedDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}
