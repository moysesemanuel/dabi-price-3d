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
    <main className="app-shell min-h-screen text-[#18120d]">
      <div className="min-h-screen transition-[padding] duration-300 lg:pl-[var(--app-sidebar-width)]">
        <AppSidebar />

        <div className="mx-auto max-w-[1488px] p-8">
          <header className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-black/8 pb-6">
            <div>
              <h1 className="text-3xl font-semibold tracking-[-0.04em] text-[#18120d] sm:text-4xl">
                Histórico
              </h1>

              <p className="mt-2 text-sm text-[#7c6858]">
                Cálculos salvos localmente nesta máquina.
              </p>
            </div>

            {items.length > 0 ? (
              <button
                type="button"
                onClick={handleClearHistory}
                className="rounded-2xl border border-black/8 bg-white px-4 py-3 text-sm text-[#18120d] transition hover:border-[#ff6a00]/30 hover:bg-[#ff6a00]"
              >
                Limpar histórico
              </button>
            ) : null}
          </header>

          <section className="rounded-[26px] border border-[#e9ddd4] bg-white p-5 shadow-[0_18px_40px_rgba(0,0,0,0.22)] sm:p-6">
            {items.length === 0 ? (
              <div className="rounded-[22px] border border-black/8 bg-[#fff3ea] p-8 text-center">
                <p className="text-lg font-semibold text-[#18120d]">
                  Nenhum cálculo salvo ainda.
                </p>

                <p className="mt-2 text-sm text-[#7c6858]">
                  Use o botão <strong>Salvar cálculo</strong> ou envie um
                  produto ao ERP para começar a preencher esta tabela.
                </p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-[22px] border border-black/8">
                <div className="overflow-x-auto">
                  <table className="min-w-full bg-[#fff3ea]">
                    <thead>
                      <tr className="border-b border-black/8 text-left">
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
                          className="border-b border-black/6 last:border-b-0"
                        >
                          <BodyCell>{formatSavedDate(item.savedAt)}</BodyCell>
                          <BodyCell>{item.productName}</BodyCell>
                          <BodyCell>
                            {item.erpProduct ? (
                              <div className="space-y-1">
                                <div className="text-xs font-medium text-[#d84f00]">
                                  Sincronizado
                                </div>
                                <div className="text-xs text-[#7c6858]">
                                  {item.erpProduct.sku || item.erpProduct.id || "Sem SKU"}
                                </div>
                                <div className="text-xs text-[#7c6858]">
                                  {formatSavedDate(item.erpProduct.syncedAt)}
                                </div>
                              </div>
                            ) : item.siteProduct ? (
                              <div className="space-y-1">
                                <div className="text-xs font-medium text-[#d84f00]">
                                  Legado
                                </div>
                                <div className="text-xs text-[#7c6858]">
                                  {item.siteProduct.slug}
                                </div>
                              </div>
                            ) : (
                              <span className="text-xs text-[#7c6858]">
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
                          <BodyCell className="text-[#c62828]">
                            -{" "}
                            {formatCurrency(
                              item.summary.totalCost,
                              item.displayCurrency,
                            )}
                          </BodyCell>
                          <BodyCell className="text-[#1f8b4c]">
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
                                className="rounded-xl border border-[#ff6a00]/25 px-3 py-2 text-xs font-medium text-[#18120d] transition hover:border-[#ff6a00]/40 hover:bg-[#ff6a00]"
                              >
                                Editar
                              </button>

                              <button
                                type="button"
                                onClick={() => handleDeleteItem(item.id)}
                                className="rounded-xl border border-black/8 px-3 py-2 text-xs font-medium text-[#18120d] transition hover:border-[#ff6a00]/30 hover:bg-[#ff6a00]"
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
    <th className="px-4 py-4 font-mono text-[11px] uppercase tracking-[0.24em] text-[#7c6858]">
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
    <td className={`px-4 py-4 text-sm text-[#18120d] ${className}`}>{children}</td>
  );
}

function formatSavedDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}
