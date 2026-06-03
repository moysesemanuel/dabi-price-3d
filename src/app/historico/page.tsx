"use client";

import { useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { AppSidebar } from "@/components/app/app-sidebar";
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
    router.push("/");
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
                  Use o botão <strong>Salvar cálculo</strong> ou publique um
                  produto no site para começar a preencher esta tabela.
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
                        <HeaderCell>Site</HeaderCell>
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
                          className="border-b border-white/6 last:border-b-0"
                        >
                          <BodyCell>{formatSavedDate(item.savedAt)}</BodyCell>
                          <BodyCell>{item.productName}</BodyCell>
                          <BodyCell>
                            {item.siteProduct ? (
                              <div className="space-y-1">
                                <div className="text-xs font-medium text-[var(--accent)]">
                                  Publicado
                                </div>
                                <div className="text-xs text-[var(--muted)]">
                                  {item.siteProduct.slug}
                                </div>
                                {item.siteProduct.url ? (
                                  <a
                                    href={item.siteProduct.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-xs text-white underline"
                                  >
                                    Abrir produto
                                  </a>
                                ) : null}
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
                          <BodyCell>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleEditItem(item.id)}
                                className="rounded-xl border border-[var(--accent)]/25 px-3 py-2 text-xs font-medium text-[var(--accent)] transition hover:border-[var(--accent)]/40 hover:bg-[var(--accent-soft)]"
                              >
                                Editar
                              </button>

                              <button
                                type="button"
                                onClick={() => handleDeleteItem(item.id)}
                                className="rounded-xl border border-white/8 px-3 py-2 text-xs font-medium text-[#dc2828] transition hover:border-[#dc2828]/30 hover:bg-[#dc2828]/10"
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
