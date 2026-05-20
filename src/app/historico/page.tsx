"use client";

import { useEffect, useState } from "react";
import { AppSidebar } from "@/components/app/app-sidebar";
import { formatCurrency, formatPercent } from "@/lib/pricing/formatters";
import {
  clearCalculationHistory,
  readCalculationHistory,
  type SavedCalculation,
} from "@/lib/history/calculation-history";

export default function HistoryPage() {
  const [items, setItems] = useState<SavedCalculation[]>([]);

  useEffect(() => {
    setItems(readCalculationHistory());
  }, []);

  function handleClearHistory() {
    clearCalculationHistory();
    setItems([]);
  }

  return (
    <main className="app-shell min-h-screen text-white">
      <div className="min-h-screen lg:pl-[215px]">
        <AppSidebar />

        <div className="mx-auto max-w-[1488px] p-8">
          <header className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-white/6 pb-6">
            <div>
              <h1 className="text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">
                Histórico
              </h1>

              <p className="mt-2 text-sm text-[var(--muted)]">
                Cálculos salvos localmente nesta máquina.
              </p>
            </div>

            {items.length > 0 ? (
              <button
                type="button"
                onClick={handleClearHistory}
                className="rounded-2xl border border-white/8 px-4 py-3 text-sm text-white transition hover:border-white/14 hover:bg-white/4"
              >
                Limpar histórico
              </button>
            ) : null}
          </header>

          <section className="rounded-[26px] border border-[var(--panel-border)] bg-[var(--panel)] p-5 shadow-[0_18px_40px_rgba(0,0,0,0.22)] sm:p-6">
            {items.length === 0 ? (
              <div className="rounded-[22px] border border-white/8 bg-[var(--panel-soft)] p-8 text-center">
                <p className="text-lg font-semibold text-white">
                  Nenhum cálculo salvo ainda.
                </p>

                <p className="mt-2 text-sm text-[var(--muted)]">
                  Use o botão <strong>Salvar cálculo</strong> na precificadora
                  para começar a preencher esta tabela.
                </p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-[22px] border border-white/8">
                <div className="overflow-x-auto">
                  <table className="min-w-full bg-[var(--panel-soft)]">
                    <thead>
                      <tr className="border-b border-white/8 text-left">
                        <HeaderCell>Data</HeaderCell>
                        <HeaderCell>Produto</HeaderCell>
                        <HeaderCell>Canal</HeaderCell>
                        <HeaderCell>Moeda</HeaderCell>
                        <HeaderCell>Preço</HeaderCell>
                        <HeaderCell>Custos</HeaderCell>
                        <HeaderCell>Lucro</HeaderCell>
                        <HeaderCell>Margem</HeaderCell>
                      </tr>
                    </thead>

                    <tbody>
                      {items.map((item) => (
                        <tr
                          key={item.id}
                          className="border-b border-white/6 last:border-b-0"
                        >
                          <BodyCell>{formatSavedDate(item.savedAt)}</BodyCell>
                          <BodyCell>{item.productName}</BodyCell>
                          <BodyCell>{item.salesChannelLabel}</BodyCell>
                          <BodyCell>{item.displayCurrency}</BodyCell>
                          <BodyCell>
                            {formatCurrency(
                              item.summary.salePrice,
                              item.displayCurrency,
                            )}
                          </BodyCell>
                          <BodyCell className="text-[#dc2828]">
                            -{" "}
                            {formatCurrency(
                              item.summary.totalCost,
                              item.displayCurrency,
                            )}
                          </BodyCell>
                          <BodyCell className="text-[var(--accent)]">
                            {formatCurrency(
                              item.summary.profit,
                              item.displayCurrency,
                            )}
                          </BodyCell>
                          <BodyCell>{formatPercent(item.summary.marginPercentage)}</BodyCell>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
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
    <td className={`px-4 py-4 text-sm text-white ${className}`}>{children}</td>
  );
}

function formatSavedDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}
