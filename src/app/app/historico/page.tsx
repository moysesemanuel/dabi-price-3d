"use client";

import { useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { BackLink } from "@/components/app/back-link";
import { formatCurrency, formatPercent } from "@/lib/pricing/formatters";
import {
  clearCalculationHistory,
  deleteCalculationFromHistory,
  queueCalculationForEditing,
  readCalculationHistory,
  subscribeCalculationHistory,
} from "@/lib/history/calculation-history";

export default function HistoryPage() {
  const router = useRouter();
  const items = useSyncExternalStore(
    subscribeCalculationHistory,
    readCalculationHistory,
    () => [],
  );

  function handleClearHistory() {
    clearCalculationHistory();
  }

  function handleDeleteItem(id: string) {
    deleteCalculationFromHistory(id);
  }

  function handleEditItem(id: string) {
    queueCalculationForEditing(id);
    router.push("/app/precificacao");
  }

  return (
    <div className="app-page">
      <header className="app-header flex flex-wrap items-end justify-between gap-4">
        <div>
          <BackLink href="/app/precificacao" label="Voltar para a precificadora" />
          <p className="app-eyebrow">Histórico</p>
          <h1 className="app-title">Cálculos salvos localmente</h1>

          <p className="app-copy max-w-[520px]">
            Cálculos salvos localmente nesta máquina.
          </p>
        </div>

        {items.length > 0 ? (
          <button
            type="button"
            onClick={handleClearHistory}
            className="app-button app-button-secondary"
          >
            Limpar histórico
          </button>
        ) : null}
      </header>

      <section className="app-card p-5 sm:p-6">
        {items.length === 0 ? (
          <div className="app-card-soft p-8 text-center">
            <p className="text-lg font-semibold text-[var(--foreground)]">
              Nenhum cálculo salvo ainda.
            </p>

            <p className="mt-2 text-sm text-[var(--muted)]">
              Use o botão <strong>Salvar cálculo</strong> ou envie um produto ao
              ERP para começar a preencher esta tabela.
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
                    <HeaderCell>ERP</HeaderCell>
                    <HeaderCell>Canal</HeaderCell>
                    <HeaderCell>Moeda</HeaderCell>
                    <HeaderCell>Preço</HeaderCell>
                    <HeaderCell>Custos</HeaderCell>
                    <HeaderCell>Lucro</HeaderCell>
                    <HeaderCell>Margem</HeaderCell>
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
                      <BodyCell>
                        {item.erpProduct ? (
                            <div className="space-y-1">
                            <div className="text-xs font-medium text-[var(--accent)]">
                              Sincronizado
                            </div>
                            <div className="text-xs text-[var(--muted)]">
                              {item.erpProduct.sku || item.erpProduct.id || "Sem SKU"}
                            </div>
                            <div className="text-xs text-[var(--muted)]">
                              {formatSavedDate(item.erpProduct.syncedAt)}
                            </div>
                          </div>
                        ) : item.siteProduct ? (
                          <div className="space-y-1">
                            <div className="text-xs font-medium text-[var(--accent)]">
                              Legado
                            </div>
                            <div className="text-xs text-[var(--muted)]">
                              {item.siteProduct.slug}
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-[var(--muted)]">
                            Só histórico local
                          </span>
                        )}
                      </BodyCell>
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
