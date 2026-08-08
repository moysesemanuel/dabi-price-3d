import type { PersistenceMode } from "@/lib/server/persistence-mode";

export function RuntimeModeBanner({
  mode,
}: {
  mode: PersistenceMode;
}) {
  if (mode !== "local") {
    return null;
  }

  return (
    <div className="mx-auto flex max-w-[1488px] justify-end px-4 pt-4 sm:px-6 lg:px-8">
      <span
        className="inline-flex rounded-full border border-[color:var(--warning)]/24 bg-[color:var(--warning)]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--warning)]"
        title="Modo local sem DATABASE_URL. Os dados deste ambiente nao sao compartilhados entre maquinas."
      >
        Local
      </span>
    </div>
  );
}
