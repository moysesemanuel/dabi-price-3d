import Link from "next/link";
import {
  AdminPageHeader,
  AdminPageSection,
  EmptyAdminState,
  FindingsList,
  SummaryGrid,
} from "@/components/admin/billing-admin-ui";
import { BillingAdminReconciliationAction } from "@/components/admin/billing-admin-reconciliation-action";
import { createBillingAdminService } from "@/lib/billing/server-admin-service";
import { requireCurrentAuthSession } from "@/lib/auth/session";

export default async function BillingAdminSystemPage() {
  const session = await requireCurrentAuthSession();
  const snapshot = await createBillingAdminService().getSnapshot(session);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Sistema"
        title="Saúde operacional e ferramentas administrativas"
        description="Leitura do modo de persistência, fila de reconciliação, estado operacional do billing e atalhos de suporte administrativo."
      />

      <AdminPageSection
        title="Resumo sistêmico"
        description="Panorama curto para validar se o ambiente tem persistência ativa e se o billing está operando sem backlog anormal."
      >
        <SummaryGrid summary={snapshot.summary} />

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <SystemCard
            label="Persistência"
            value={snapshot.persistence.enabled ? "Banco ativo" : "Modo local"}
            note={`mode=${snapshot.persistence.mode}`}
          />
          <SystemCard
            label="Findings"
            value={String(snapshot.findings.length)}
            note="Itens operacionais ainda abertos"
          />
          <SystemCard
            label="Leitura"
            value={snapshot.generatedAt}
            note="Momento da coleta do snapshot"
          />
        </div>
      </AdminPageSection>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.9fr)]">
        <AdminPageSection
          title="Backlog operacional"
          description="Divergências e falhas que o suporte deve acompanhar de perto."
        >
          <FindingsList findings={snapshot.findings} />
        </AdminPageSection>

        <AdminPageSection
          title="Ferramentas"
          description="Atalhos para as outras áreas administrativas disponíveis neste ambiente."
        >
          <div className="grid gap-3">
            <AdminShortcut
              href="/admin/usuarios"
              title="Cadastro global de usuarios"
              description="Acesso ao painel já existente de super admin para localizar, ajustar e remover usuarios."
            />
            <AdminShortcut
              href="/admin/assinaturas"
              title="Assinaturas e exceções"
              description="Abra a lista de contratos para consultar provider e conceder accessUntil."
            />
            <AdminShortcut
              href="/admin/eventos"
              title="Webhooks e auditoria"
              description="Acompanhe falhas, eventos processados e backlog de reconciliação."
            />
          </div>

          {snapshot.persistence.enabled ? <BillingAdminReconciliationAction /> : null}

          {!snapshot.persistence.enabled ? (
            <div className="mt-4">
              <EmptyAdminState message="Este ambiente está sem DATABASE_URL. O console administrativo continua acessível, mas as ações de billing que dependem de persistência compartilhada não podem ser executadas." />
            </div>
          ) : null}
        </AdminPageSection>
      </div>
    </div>
  );
}

function SystemCard({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <article className="rounded-[22px] border border-[var(--panel-border)] bg-[rgba(255,255,255,0.8)] p-4">
      <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[var(--muted)]">
        {label}
      </p>
      <p className="mt-3 text-sm font-semibold text-[var(--foreground)]">{value}</p>
      <p className="mt-2 text-xs leading-6 text-[var(--muted)]">{note}</p>
    </article>
  );
}

function AdminShortcut({
  href,
  title,
  description,
}: {
  href: string;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-[22px] border border-[var(--panel-border)] bg-[rgba(255,255,255,0.82)] p-4 transition hover:border-[var(--accent)] hover:shadow-[0_20px_60px_rgba(15,23,42,0.08)]"
    >
      <p className="text-sm font-semibold text-[var(--foreground)]">{title}</p>
      <p className="mt-2 text-sm leading-7 text-[var(--muted)]">{description}</p>
    </Link>
  );
}
