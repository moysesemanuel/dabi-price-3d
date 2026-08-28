"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { AdminDashboardAnalytics } from "@/lib/billing/admin-dashboard-analytics";
import {
  formatAdminAnalyticsCurrency,
  formatAdminAnalyticsDate,
  getDistributionLabel,
  hasAdminAnalyticsData,
} from "@/lib/billing/admin-dashboard-chart-data";

const colors = [
  "var(--accent)",
  "var(--success)",
  "var(--warning)",
  "var(--danger)",
  "var(--muted)",
  "var(--accent-strong)",
];

type TooltipItem = { name?: string; value?: number; color?: string };

function ChartCard({
  title,
  description,
  children,
  empty,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  empty: boolean;
}) {
  return (
    <section className="app-card min-w-0 p-5 sm:p-6" aria-labelledby={`chart-${title}`}>
      <div className="mb-5 space-y-1">
        <h2 id={`chart-${title}`} className="text-lg font-semibold tracking-[-0.03em] text-[var(--foreground)]">
          {title}
        </h2>
        <p className="text-sm leading-6 text-[var(--muted)]">{description}</p>
      </div>
      {empty ? (
        <div className="flex h-[264px] items-center justify-center rounded-2xl border border-dashed border-[var(--panel-border)] bg-[var(--panel-soft)] px-6 text-center text-sm leading-6 text-[var(--muted)]">
          Ainda não há dados para este período.
        </div>
      ) : children}
    </section>
  );
}

function AnalyticsTooltip({
  active,
  label,
  payload,
  currency = false,
}: {
  active?: boolean;
  label?: string;
  payload?: TooltipItem[];
  currency?: boolean;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-[var(--panel-border)] bg-[var(--panel-strong)] px-3 py-2.5 shadow-lg">
      {label ? <p className="mb-2 text-xs font-semibold text-[var(--foreground)]">{formatAdminAnalyticsDate(label)}</p> : null}
      <div className="space-y-1.5">
        {payload.map((item) => (
          <p key={item.name} className="flex items-center justify-between gap-5 text-xs text-[var(--muted)]">
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full" style={{ background: item.color }} />
              {item.name}
            </span>
            <strong className="font-semibold text-[var(--foreground)]">
              {currency ? formatAdminAnalyticsCurrency(Number(item.value ?? 0)) : Number(item.value ?? 0).toLocaleString("pt-BR")}
            </strong>
          </p>
        ))}
      </div>
    </div>
  );
}

function DateAxis() {
  return <XAxis dataKey="date" tickFormatter={formatAdminAnalyticsDate} minTickGap={28} tick={{ fill: "var(--muted)", fontSize: 11 }} axisLine={false} tickLine={false} />;
}

function NumberAxis() {
  return <YAxis allowDecimals={false} width={32} tick={{ fill: "var(--muted)", fontSize: 11 }} axisLine={false} tickLine={false} />;
}

export function AdminDashboardAnalyticsCharts({ analytics }: { analytics: AdminDashboardAnalytics }) {
  const revenueEmpty = !analytics.revenue.some((row) => row.paidRevenueCents > 0);
  const invoicesEmpty = !analytics.invoices.some((row) => row.created + row.paid + row.pending + row.failed > 0);
  const webhooksEmpty = !analytics.webhooks.some((row) => row.processed + row.failed + row.ignored > 0);
  const distributionEmpty = !analytics.distributions.plan.some((row) => row.count > 0);
  const hasData = hasAdminAnalyticsData(analytics);

  return (
    <div className="space-y-6">
      {!hasData ? (
        <div className="rounded-2xl border border-dashed border-[var(--panel-border)] bg-[var(--panel-soft)] p-5 text-sm leading-6 text-[var(--muted)]">
          Não há atividade comercial ou operacional registrada no período selecionado.
        </div>
      ) : null}
      <div className="grid gap-6 xl:grid-cols-2">
        <ChartCard title="Receita recebida" description="Valores brutos de invoices pagas no período selecionado." empty={revenueEmpty}>
          <div className="h-[264px]" role="img" aria-label="Gráfico de receita recebida por dia">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={analytics.revenue} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs><linearGradient id="revenue-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--accent)" stopOpacity={0.32} /><stop offset="100%" stopColor="var(--accent)" stopOpacity={0.02} /></linearGradient></defs>
                <CartesianGrid vertical={false} stroke="var(--panel-border)" strokeDasharray="3 3" />
                <DateAxis />
                <YAxis tickFormatter={(value) => formatAdminAnalyticsCurrency(Number(value))} width={68} tick={{ fill: "var(--muted)", fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip content={<AnalyticsTooltip currency />} />
                <Area type="monotone" dataKey="paidRevenueCents" name="Receita recebida" stroke="var(--accent)" strokeWidth={2.5} fill="url(#revenue-fill)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="Faturas no período" description="Criações e transições de status registradas por dia." empty={invoicesEmpty}>
          <div className="h-[264px]" role="img" aria-label="Gráfico de faturas por status e dia">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.invoices} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--panel-border)" strokeDasharray="3 3" />
                <DateAxis /><NumberAxis />
                <Tooltip content={<AnalyticsTooltip />} /><Legend wrapperStyle={{ fontSize: 12, color: "var(--muted)" }} />
                <Bar dataKey="created" name="Criadas" stackId="invoices" fill="var(--accent)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="paid" name="Pagas" stackId="invoices" fill="var(--success)" />
                <Bar dataKey="pending" name="Pendentes" stackId="invoices" fill="var(--warning)" />
                <Bar dataKey="failed" name="Falhas" stackId="invoices" fill="var(--danger)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="Webhooks por dia" description="Volume operacional por resultado de processamento." empty={webhooksEmpty}>
          <div className="h-[264px]" role="img" aria-label="Gráfico de webhooks por status e dia">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.webhooks} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--panel-border)" strokeDasharray="3 3" />
                <DateAxis /><NumberAxis />
                <Tooltip content={<AnalyticsTooltip />} /><Legend wrapperStyle={{ fontSize: 12, color: "var(--muted)" }} />
                <Bar dataKey="processed" name="Processados" stackId="webhooks" fill="var(--success)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="failed" name="Falhos" stackId="webhooks" fill="var(--danger)" />
                <Bar dataKey="ignored" name="Ignorados" stackId="webhooks" fill="var(--muted)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="Distribuição de assinaturas" description="Leitura atual por plano, ciclo e status comercial." empty={distributionEmpty}>
          <div className="grid gap-4 sm:grid-cols-3" role="group" aria-label="Distribuições de assinaturas">
            <Distribution data={analytics.distributions.plan} dimension="plan" title="Plano" />
            <Distribution data={analytics.distributions.billingCycle} dimension="billingCycle" title="Ciclo" />
            <Distribution data={analytics.distributions.status} dimension="status" title="Status" />
          </div>
        </ChartCard>
      </div>
    </div>
  );
}

function Distribution({
  data,
  dimension,
  title,
}: {
  data: Array<{ key: string; count: number }>;
  dimension: "plan" | "billingCycle" | "status";
  title: string;
}) {
  const total = data.reduce((sum, item) => sum + item.count, 0);
  return (
    <section className="rounded-xl border border-[var(--panel-border)] bg-[var(--panel-soft)] p-3" aria-label={`Distribuição por ${title.toLowerCase()}`}>
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">{title}</p>
      <div className="mt-2 h-28">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="count" nameKey="key" innerRadius="52%" outerRadius="78%" paddingAngle={2} stroke="none">
              {data.map((item, index) => <Cell key={item.key} fill={colors[index % colors.length]} />)}
            </Pie>
            <Tooltip formatter={(value, name) => [`${value ?? 0} (${total ? Math.round((Number(value ?? 0) / total) * 100) : 0}%)`, getDistributionLabel(dimension, String(name ?? ""))]} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="mt-2 space-y-1.5 text-xs text-[var(--muted)]">
        {data.map((item, index) => <li key={item.key} className="flex items-center justify-between gap-2"><span className="flex min-w-0 items-center gap-1.5"><span className="h-2 w-2 shrink-0 rounded-full" style={{ background: colors[index % colors.length] }} />{getDistributionLabel(dimension, item.key)}</span><strong className="text-[var(--foreground)]">{item.count}</strong></li>)}
      </ul>
    </section>
  );
}
