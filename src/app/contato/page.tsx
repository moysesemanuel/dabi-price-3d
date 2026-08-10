import Link from "next/link";
import { BackLink } from "@/components/app/back-link";
import { getMercadoPagoSubscriptionUrl } from "@/lib/payments/mercado-pago";
import {
  getWorkspacePlan,
  workspacePlans,
  type WorkspacePlanId,
} from "@/lib/settings/app-preferences";

type ContactSearchParams = {
  plan?: string;
  origin?: string;
  intent?: string;
};

export default async function ContactPage({
  searchParams,
}: {
  searchParams?: Promise<ContactSearchParams>;
}) {
  const params = (await searchParams) ?? {};
  const selectedPlanId = normalizePlanId(params.plan);
  const selectedPlan = selectedPlanId ? getWorkspacePlan(selectedPlanId) : null;
  const subscriptionUrl = selectedPlanId
    ? getMercadoPagoSubscriptionUrl(selectedPlanId)
    : null;
  const originLabel = getOriginLabel(params.origin);
  const consultIntent = params.intent === "consultor";

  return (
    <main className="public-shell px-4 py-10 sm:px-6">
      <div className="public-panel mx-auto max-w-[1160px] rounded-[40px] p-6 sm:p-8">
        <BackLink
          href={params.origin === "confeitaria" ? "/confeitaria" : "/planos"}
          label={
            params.origin === "confeitaria"
              ? "Voltar para a landing"
              : "Voltar para os planos"
          }
        />

        <p className="public-badge mt-8">Contratação</p>
        <h1 className="public-title max-w-[860px] text-4xl sm:text-5xl">
          {selectedPlan
            ? `Quase lá: vamos ativar o ${selectedPlan.label} para você.`
            : "Canal comercial e operacional da plataforma."}
        </h1>
        <p className="public-copy max-w-[860px] text-base">
          {selectedPlan
            ? subscriptionUrl
              ? "O plano já pode seguir para a assinatura do Mercado Pago. Depois da confirmação do pagamento, o próximo passo é automatizar a liberação do acesso ao projeto."
              : "O fluxo correto agora é confirmar o plano, validar a necessidade da operação e seguir para contratação consultiva. Só depois disso o acesso ao projeto deve ser liberado."
            : "Esta página já estabelece um ponto público para contato antes mesmo da área autenticada completa de suporte. Na próxima fase, ela pode disparar leads, tickets e onboarding comercial."}
        </p>

        <div className="mt-10 grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_360px]">
          <section className="app-card p-6 sm:p-7">
            <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-[var(--accent)]">
              Resumo da contratação
            </p>

            {selectedPlan ? (
              <>
                <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h2 className="text-3xl font-semibold tracking-[-0.04em] text-[var(--foreground)]">
                      {selectedPlan.label}
                    </h2>
                    <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--muted)]">
                      {selectedPlan.description}
                    </p>
                  </div>
                  <span className="rounded-full border border-[var(--accent)] bg-[var(--accent-soft)] px-4 py-2 text-xs font-semibold text-[var(--accent)]">
                    Plano selecionado
                  </span>
                </div>

                <div className="mt-6 grid gap-3 md:grid-cols-3">
                  <InfoStat
                    label="Valor"
                    value={`${selectedPlan.monthlyPriceLabel}/mês`}
                  />
                  <InfoStat
                    label="Usuários"
                    value={`${selectedPlan.seatsIncluded} ${
                      selectedPlan.seatsIncluded === 1 ? "usuário" : "usuários"
                    }`}
                  />
                  <InfoStat
                    label="Histórico"
                    value={`Até ${selectedPlan.historyLimit}`}
                  />
                </div>

                <div className="mt-6 rounded-[24px] border border-[var(--panel-border)] bg-[rgba(255,255,255,0.72)] px-5 py-5">
                  <p className="text-sm font-semibold text-[var(--foreground)]">
                    Próximo passo
                  </p>
                  <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
                    {subscriptionUrl
                      ? "Este plano já pode abrir a assinatura do Mercado Pago. A próxima etapa operacional é conectar o retorno da assinatura e o webhook para liberar o acesso automaticamente."
                      : "Este plano ainda segue por atendimento consultivo. O funil público já está organizado para receber assinatura do Mercado Pago assim que a URL desta faixa for configurada."}
                  </p>
                </div>
              </>
            ) : (
              <div className="mt-5 rounded-[24px] border border-[var(--panel-border)] bg-[rgba(255,255,255,0.72)] px-5 py-5">
                <p className="text-sm leading-7 text-[var(--muted)]">
                  Nenhum plano foi selecionado ainda. Se você veio da página de
                  planos, escolha uma faixa para seguir com uma contratação mais
                  guiada.
                </p>
                <div className="mt-5">
                  <Link href="/planos" className="app-button app-button-primary">
                    Escolher um plano
                  </Link>
                </div>
              </div>
            )}
          </section>

          <aside className="app-card-soft p-6">
            <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-[var(--muted)]">
              Atendimento
            </p>
            <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-[var(--foreground)]">
              {consultIntent ? "Falar com consultor" : "Solicitar ativação"}
            </h2>
            <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
              {selectedPlan
                ? `Origem: ${originLabel}. Plano em análise: ${selectedPlan.label}.`
                : `Origem: ${originLabel}.`}
            </p>

            <div className="mt-5 grid gap-3">
              <ContactLine
                label="Comercial"
                value={
                  subscriptionUrl
                    ? "Use este canal para dúvidas antes da compra ou apoio na ativação após o pagamento."
                    : "Use este canal para contratação, ativação do plano e próximos passos."
                }
              />
              <ContactLine
                label="Operacional"
                value="Clientes ativos também terão central própria em /app/suporte."
              />
              {subscriptionUrl ? (
                <ContactLine
                  label="Assinatura"
                  value="Cobrança recorrente no ambiente do Mercado Pago com redirecionamento externo."
                />
              ) : null}
              {selectedPlan ? (
                <ContactLine
                  label="Plano"
                  value={`${selectedPlan.label} · ${selectedPlan.monthlyPriceLabel}/mês`}
                />
              ) : null}
            </div>

            <div className="mt-6 grid gap-3">
              {subscriptionUrl ? (
                <a href={subscriptionUrl} className="app-button app-button-primary w-full">
                  Assinar com Mercado Pago
                </a>
              ) : (
                <Link
                  href={{
                    pathname: "/contato",
                    query: {
                      ...(selectedPlanId ? { plan: selectedPlanId } : {}),
                      ...(params.origin ? { origin: params.origin } : {}),
                      intent: "consultor",
                    },
                  }}
                  className="app-button app-button-primary w-full"
                >
                  Solicitar contato comercial
                </Link>
              )}
              <Link
                href="/planos"
                className="app-button app-button-secondary w-full"
              >
                Revisar planos
              </Link>
            </div>
          </aside>
        </div>

        <section className="mt-8 grid gap-4 md:grid-cols-3">
          {workspacePlans.map((plan) => (
            <article key={plan.id} className="app-card-soft p-6">
              <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-[var(--accent)]">
                Faixa comercial
              </p>
              <p className="mt-3 text-lg font-semibold text-[var(--foreground)]">
                {plan.label}
              </p>
              <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
                {plan.description}
              </p>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}

function normalizePlanId(value?: string): WorkspacePlanId | null {
  if (!value) {
    return null;
  }

  return workspacePlans.some((plan) => plan.id === value)
    ? (value as WorkspacePlanId)
    : null;
}

function getOriginLabel(origin?: string) {
  if (origin === "confeitaria") {
    return "Landing da confeitaria";
  }

  if (origin === "site") {
    return "Página pública";
  }

  return "Fluxo público";
}

function InfoStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[22px] border border-[var(--panel-border)] bg-[rgba(255,255,255,0.72)] px-4 py-4">
      <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[var(--muted)]">
        {label}
      </p>
      <p className="mt-3 text-lg font-semibold text-[var(--foreground)]">{value}</p>
    </div>
  );
}

function ContactLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[20px] border border-[var(--panel-border)] bg-[rgba(255,255,255,0.72)] px-4 py-4">
      <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[var(--muted)]">
        {label}
      </p>
      <p className="mt-2 text-sm leading-7 text-[var(--foreground)]">{value}</p>
    </div>
  );
}
