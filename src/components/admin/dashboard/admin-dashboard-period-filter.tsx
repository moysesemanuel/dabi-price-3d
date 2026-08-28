import Link from "next/link";
import {
  adminAnalyticsPeriodPresets,
  type AdminAnalyticsPeriodPreset,
} from "@/lib/billing/admin-dashboard-analytics";

const labels: Record<AdminAnalyticsPeriodPreset, string> = {
  "7d": "7 dias",
  "30d": "30 dias",
  "90d": "90 dias",
  year: "Ano atual",
};

export function AdminDashboardPeriodFilter({
  period,
}: {
  period: AdminAnalyticsPeriodPreset;
}) {
  return (
    <nav aria-label="Período dos gráficos" className="flex flex-wrap gap-2">
      {adminAnalyticsPeriodPresets.map((preset) => {
        const active = preset === period;
        return (
          <Link
            key={preset}
            href={`/admin/dashboard?period=${preset}`}
            aria-current={active ? "page" : undefined}
            className={active
              ? "rounded-full bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-[var(--accent-ink)]"
              : "rounded-full border border-[var(--panel-border)] bg-[var(--panel-soft)] px-3 py-2 text-sm font-medium text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--foreground)]"}
          >
            {labels[preset]}
          </Link>
        );
      })}
    </nav>
  );
}
