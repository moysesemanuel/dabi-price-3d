"use client";

import { useMemo, useSyncExternalStore } from "react";
import {
  readCalculationHistory,
  subscribeCalculationHistory,
} from "@/lib/history/calculation-history";
import { formatPercent } from "@/lib/pricing/formatters";
import { getWorkspacePlan, type AppPreferences } from "@/lib/settings/app-preferences";
import {
  readWorkspaceAuditLog,
  subscribeWorkspaceAuditLog,
} from "@/lib/workspace/audit-log";
import { buildWorkspaceCommercialSnapshot } from "@/lib/workspace/commercial-insights";

type WorkspaceCommercialPanelProps = {
  preferences: AppPreferences;
};

export function WorkspaceCommercialPanel({
  preferences,
}: WorkspaceCommercialPanelProps) {
  const history = useSyncExternalStore(
    subscribeCalculationHistory,
    readCalculationHistory,
    () => [],
  );
  const auditLog = useSyncExternalStore(
    subscribeWorkspaceAuditLog,
    readWorkspaceAuditLog,
    () => [],
  );
  const snapshot = useMemo(
    () =>
      buildWorkspaceCommercialSnapshot({
        preferences,
        history,
        auditLog,
      }),
    [auditLog, history, preferences],
  );
  const plan = getWorkspacePlan(preferences.subscription.planId);

  return (
    <section className="rounded-[26px] border border-[#e9ddd4] bg-white p-6 shadow-[0_18px_40px_rgba(0,0,0,0.08)]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-[#7c6858]">
            Operação SaaS
          </p>
          <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-[#18120d]">
            Prontidão comercial do workspace
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-[#7c6858]">
            Aqui ficam os sinais que sustentam um produto vendável: plano,
            capacidade, uso, rastreabilidade e base mínima de validação real.
          </p>
        </div>

        <div
          className={`rounded-[22px] border px-5 py-4 text-right ${
            snapshot.readinessTone === "ready"
              ? "border-[#1f8b4c]/20 bg-[#eef8f2]"
              : snapshot.readinessTone === "attention"
                ? "border-[#ff6a00]/20 bg-[#fff3ea]"
                : "border-[#c62828]/20 bg-[#fff1f1]"
          }`}
        >
          <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-[#7c6858]">
            Score
          </p>
          <p className="mt-2 text-3xl font-semibold tracking-[-0.05em] text-[#18120d]">
            {snapshot.readinessScore}
          </p>
          <p className="mt-1 text-sm text-[#7c6858]">{snapshot.readinessLabel}</p>
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-4">
        <Metric
          label="Plano ativo"
          value={snapshot.planLabel}
          note={`${snapshot.planStatusLabel} · ${snapshot.planSupportLabel}`}
        />
        <Metric
          label="Uso do histórico"
          value={`${snapshot.historyCount}/${snapshot.historyLimit}`}
          note={`${snapshot.usagePercentage.toFixed(0)}% da janela do plano`}
        />
        <Metric
          label="Assentos"
          value={`${snapshot.seatsUsed}/${snapshot.seatsIncluded}`}
          note={
            snapshot.seatsBalance >= 0
              ? `${snapshot.seatsBalance} assento(s) livres`
              : `${Math.abs(snapshot.seatsBalance)} acima do incluído`
          }
        />
        <Metric
          label="Papel operacional"
          value={snapshot.roleLabel}
          note={`Preset ${preferences.businessPresetId} · ${plan.monthlyPriceLabel}/mês`}
        />
      </div>

      <div className="mt-8 grid gap-8 xl:grid-cols-[1.2fr_0.8fr]">
        <div>
          <h3 className="text-lg font-semibold tracking-[-0.03em] text-[#18120d]">
            Checklist de venda
          </h3>

          <div className="mt-4 space-y-3">
            {snapshot.readinessItems.map((item) => (
              <div
                key={item.id}
                className="rounded-[22px] border border-black/8 bg-[#fcfaf8] px-5 py-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-[#18120d]">
                    {item.label}
                  </p>
                  <StatusBadge status={item.status} />
                </div>
                <p className="mt-2 text-sm leading-6 text-[#7c6858]">
                  {item.description}
                </p>
                <p className="mt-2 text-sm text-[#5f4d40]">{item.detail}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-8">
          <div>
            <h3 className="text-lg font-semibold tracking-[-0.03em] text-[#18120d]">
              Uso e retenção
            </h3>

            <div className="mt-4 rounded-[24px] border border-black/8 bg-[#fcfaf8] p-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <InsightLine
                  label="Margem média salva"
                  value={formatPercent(snapshot.averageMarginPercentage)}
                />
                <InsightLine
                  label="Itens lucrativos"
                  value={`${snapshot.profitableItemsCount}/${snapshot.historyCount || 0}`}
                />
                <InsightLine
                  label="Canais exercitados"
                  value={String(snapshot.channelsUsedCount)}
                />
                <InsightLine
                  label="Sincronizações ERP"
                  value={String(snapshot.erpSyncCount)}
                />
                <InsightLine
                  label="Links de catálogo"
                  value={String(snapshot.siteProductLinksCount)}
                />
                <InsightLine
                  label="Eventos auditados"
                  value={String(snapshot.recentAuditCount)}
                />
              </div>

              <div className="mt-5 border-t border-black/8 pt-4 text-sm text-[#7c6858]">
                <p>
                  Último cálculo salvo:{" "}
                  <strong className="text-[#18120d]">
                    {snapshot.lastSavedAt
                      ? formatDate(snapshot.lastSavedAt)
                      : "Ainda sem histórico"}
                  </strong>
                </p>
                <p className="mt-2">
                  Último evento de auditoria:{" "}
                  <strong className="text-[#18120d]">
                    {snapshot.lastAuditAt
                      ? formatDate(snapshot.lastAuditAt)
                      : "Sem eventos recentes"}
                  </strong>
                </p>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold tracking-[-0.03em] text-[#18120d]">
              Trilhas recentes
            </h3>

            <div className="mt-4 overflow-hidden rounded-[24px] border border-black/8 bg-[#fcfaf8]">
              {auditLog.length === 0 ? (
                <div className="px-5 py-6 text-sm text-[#7c6858]">
                  Nenhum evento auditável ainda. Salvar preferências, cálculos
                  e integrações vai preencher esta trilha.
                </div>
              ) : (
                <div className="divide-y divide-black/8">
                  {auditLog.slice(0, 6).map((event) => (
                    <div key={event.id} className="px-5 py-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-[#18120d]">
                          {event.title}
                        </p>
                        <EventToneBadge tone={event.tone} />
                      </div>
                      <p className="mt-2 text-sm leading-6 text-[#7c6858]">
                        {event.description}
                      </p>
                      <p className="mt-2 text-xs text-[#7c6858]">
                        {formatDate(event.occurredAt)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Metric({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className="rounded-[22px] border border-black/8 bg-[#fcfaf8] p-5">
      <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-[#7c6858]">
        {label}
      </p>
      <p className="mt-3 text-xl font-semibold tracking-[-0.04em] text-[#18120d]">
        {value}
      </p>
      <p className="mt-2 text-sm leading-6 text-[#7c6858]">{note}</p>
    </div>
  );
}

function InsightLine({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[#7c6858]">
        {label}
      </p>
      <p className="mt-2 text-sm font-semibold text-[#18120d]">{value}</p>
    </div>
  );
}

function StatusBadge({
  status,
}: {
  status: "ready" | "attention" | "pending";
}) {
  const statusMap = {
    ready: {
      label: "Pronto",
      className: "border-[#1f8b4c]/20 bg-[#eef8f2] text-[#1f8b4c]",
    },
    attention: {
      label: "Ajustar",
      className: "border-[#ff6a00]/20 bg-[#fff3ea] text-[#d84f00]",
    },
    pending: {
      label: "Pendente",
      className: "border-[#c62828]/20 bg-[#fff1f1] text-[#c62828]",
    },
  } as const;
  const meta = statusMap[status];

  return (
    <span
      className={`rounded-full border px-3 py-1 text-xs font-medium ${meta.className}`}
    >
      {meta.label}
    </span>
  );
}

function EventToneBadge({
  tone,
}: {
  tone: "neutral" | "success" | "warning";
}) {
  const toneMap = {
    neutral: "border-black/8 bg-white text-[#18120d]",
    success: "border-[#1f8b4c]/20 bg-[#eef8f2] text-[#1f8b4c]",
    warning: "border-[#ff6a00]/20 bg-[#fff3ea] text-[#d84f00]",
  } as const;

  return (
    <span className={`rounded-full border px-3 py-1 text-xs ${toneMap[tone]}`}>
      {tone === "success"
        ? "Sucesso"
        : tone === "warning"
          ? "Atenção"
          : "Registro"}
    </span>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}
