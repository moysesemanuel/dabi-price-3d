import Image from "next/image";
import Link from "next/link";
import { BackLink } from "@/components/app/back-link";
import { getCurrentAuthSession } from "@/lib/auth/session";
import {
  getWorkspacePreferences,
  isPlatformPersistenceAvailable,
} from "@/lib/server/platform";
import {
  businessTypeMeta,
  defaultAppPreferences,
} from "@/lib/settings/app-preferences";

export default async function BudgetModelsPage() {
  const session = await getCurrentAuthSession();
  const preferences =
    session && isPlatformPersistenceAvailable()
      ? await getWorkspacePreferences(session.workspace.id).catch(
          () => defaultAppPreferences,
        )
      : defaultAppPreferences;
  const activeBusinessMeta = preferences.businessType
    ? businessTypeMeta[preferences.businessType]
    : null;

  return (
    <div className="app-page space-y-6">
      <header className="app-header flex flex-wrap items-end justify-between gap-4">
        <div>
          <BackLink href="/app" label="Voltar para o início" />
          <p className="app-eyebrow">Modelos de orçamento</p>
          <h1 className="app-title">Estrutura comercial dos seus orçamentos</h1>
          <p className="app-copy max-w-[720px]">
            Esta primeira versão organiza os modelos de orçamento do seu ramo
            principal dentro da precificadora, sem depender do ERP, e prepara a
            evolução para editor visual e PDF completo.
          </p>
        </div>

        <Link href="/app/perfil-empresa" className="app-button app-button-primary">
          Configurar empresa
        </Link>
      </header>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-4">
          <article className="app-card p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-[var(--accent)]">
                  Modelo ativo
                </p>
                <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-[var(--foreground)]">
                  Modelo padrão
                </h2>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--muted)]">
                  Serve como base comercial para a fase inicial do ramo{" "}
                  {activeBusinessMeta?.label ?? "da conta"}. A próxima etapa
                  adiciona personalização visual mais profunda e geração de PDF.
                </p>
              </div>
              <span className="rounded-full border border-[var(--accent)] bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent)]">
                Ativo
              </span>
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-3">
              <ModelCard
                title="Layout"
                description="Estrutura limpa para transformar a precificação em orçamento apresentável."
                footer="Ajustes visuais entram na próxima etapa."
              />
              <ModelCard
                title="Cabeçalho"
                description={`Usa ${preferences.workspaceName || "sua empresa"} e o contato operacional como base.`}
                footer="Logo da empresa será conectada aqui."
              />
              <ModelCard
                title="Conteúdo"
                description={
                  activeBusinessMeta
                    ? activeBusinessMeta.templatesSummary
                    : "Foco em nome do item, composição do custo, preço e margem da venda."
                }
                footer="Pensado para caber bem na rotina comercial."
              />
            </div>
          </article>

          <article className="app-card-soft p-6">
            <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-[var(--muted)]">
              Próximos encaixes
            </p>
            <div className="mt-4 grid gap-3">
              <InlineLink
                href="/app/perfil-empresa"
                title="Adicionar dados da empresa"
                description="Nome, responsável e contato já centralizados para alimentar os modelos."
              />
              <InlineLink
                href="/app/precificacao"
                title="Conferir ramo principal"
                description={
                  activeBusinessMeta
                    ? `A conta está estruturada para ${activeBusinessMeta.label.toLowerCase()}.`
                    : "Escolha o ramo principal da conta antes de avançar."
                }
              />
              <InlineLink
                href="/app/orcamentos"
                title="Validar com orçamentos salvos"
                description="Os cálculos salvos formam a base do fluxo comercial desta área."
              />
              <InlineLink
                href="/app/preferencias"
                title="Revisar política de preço"
                description="Margens e regras do motor continuam vindo da camada operacional."
              />
            </div>
          </article>
        </div>

        <aside className="app-card p-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-[var(--muted)]">
            Prévia conceitual
          </p>
          <div className="mt-5 rounded-[28px] border border-[var(--panel-border)] bg-white p-6 text-[#18120d] shadow-[0_18px_40px_rgba(0,0,0,0.06)]">
            <div className="flex items-start justify-between gap-4 border-b border-black/10 pb-5">
              <div className="flex items-center gap-4">
                {preferences.companyLogoUrl ? (
                  <div className="relative flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-[18px] border border-black/10 bg-white">
                    <Image
                      src={preferences.companyLogoUrl}
                      alt={`Logo de ${preferences.workspaceName}`}
                      fill
                      unoptimized
                      sizes="56px"
                      className="object-contain p-2"
                    />
                  </div>
                ) : null}
                <div>
                  <p className="text-lg font-semibold">{preferences.workspaceName}</p>
                  <p className="mt-1 text-sm text-[#7c6858]">
                    {preferences.operatorEmail || "contato operacional"}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs uppercase tracking-[0.2em] text-[#7c6858]">
                  Orçamento
                </p>
                <p className="mt-2 text-sm font-semibold">Modelo padrão</p>
              </div>
            </div>

            <div className="mt-6 space-y-4">
              <PreviewLine label="Cliente" value="Nome do cliente" />
              <PreviewLine label="Produto" value="Item precificado" />
              <PreviewLine
                label={activeBusinessMeta?.previewMaterialLabel ?? "Material"}
                value={
                  activeBusinessMeta?.previewMaterialValue ?? "Filamento / processo"
                }
              />
              <PreviewLine label="Valor" value="Preço calculado com base real" />
            </div>

            <div className="mt-8 rounded-[22px] bg-[#fcfaf8] px-4 py-4 text-sm text-[#7c6858]">
              Esta prévia é propositalmente enxuta. O editor visual e o PDF final
              entram na sequência, em cima desta estrutura.
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
}

function ModelCard({
  title,
  description,
  footer,
}: {
  title: string;
  description: string;
  footer: string;
}) {
  return (
    <div className="rounded-[24px] border border-[var(--panel-border)] bg-[rgba(255,255,255,0.78)] p-5">
      <h3 className="text-lg font-semibold text-[var(--foreground)]">{title}</h3>
      <p className="mt-3 text-sm leading-7 text-[var(--muted)]">{description}</p>
      <p className="mt-4 text-xs leading-6 text-[var(--muted)]">{footer}</p>
    </div>
  );
}

function InlineLink({
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
      className="rounded-[22px] border border-[var(--panel-border)] bg-[rgba(255,255,255,0.72)] px-4 py-4 transition hover:border-[var(--accent)]"
    >
      <p className="text-base font-semibold text-[var(--foreground)]">{title}</p>
      <p className="mt-2 text-sm leading-7 text-[var(--muted)]">{description}</p>
    </Link>
  );
}

function PreviewLine({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#7c6858]">
        {label}
      </p>
      <p className="mt-1 text-sm font-medium text-[#18120d]">{value}</p>
    </div>
  );
}
