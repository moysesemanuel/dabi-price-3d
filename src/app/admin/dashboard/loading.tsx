export default function AdminDashboardLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Carregando dashboard administrativo">
      <div className="h-28 animate-pulse rounded-2xl bg-[var(--panel-soft)]" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 8 }, (_, index) => <div key={index} className="h-36 animate-pulse rounded-2xl bg-[var(--panel-soft)]" />)}
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <div className="h-96 animate-pulse rounded-2xl bg-[var(--panel-soft)]" />
        <div className="h-96 animate-pulse rounded-2xl bg-[var(--panel-soft)]" />
      </div>
    </div>
  );
}
