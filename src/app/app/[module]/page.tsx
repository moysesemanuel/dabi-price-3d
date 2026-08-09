import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { BackLink } from "@/components/app/back-link";
import {
  buildConfectioneryFinanceSnapshot,
  buildConfectioneryPreviewOrders,
} from "@/lib/confectionery/preview";
import { getCurrentAuthSession } from "@/lib/auth/session";
import {
  getWorkspacePreferences,
  isPlatformPersistenceAvailable,
  listCalculationSnapshots,
} from "@/lib/server/platform";
import {
  businessTypeCookieName,
  defaultAppPreferences,
  normalizePersistedBusinessType,
} from "@/lib/settings/app-preferences";
import { formatCurrency } from "@/lib/pricing/formatters";

const modulePageContent = {
  agenda: {
    eyebrow: "Agenda",
    title: "Agenda da operação",
    description:
      "Organize entregas, encomendas, horários de produção e compromissos do dia a dia da confeitaria.",
    highlights: [
      "Calendário de pedidos e datas de entrega.",
      "Blocos para produção, retirada e atendimento.",
      "Visão pensada para transformar orçamento em rotina de execução.",
    ],
    ctaLabel: "Ver orçamentos salvos",
    ctaHref: "/app/orcamentos",
  },
  vendas: {
    eyebrow: "Vendas",
    title: "Vendas e atendimento",
    description:
      "Acompanhe pedidos, propostas fechadas, clientes recorrentes e o andamento comercial do ramo.",
    highlights: [
      "Lista de vendas com status comercial.",
      "Atalhos para proposta, confirmação e entrega.",
      "Base pronta para futuras integrações com ERP e checkout.",
    ],
    ctaLabel: "Abrir histórico de orçamentos",
    ctaHref: "/app/orcamentos",
  },
  clientes: {
    eyebrow: "Cadastros",
    title: "Cadastro de clientes",
    description:
      "Centralize dados dos clientes, preferências, contatos e histórico de compras recorrentes.",
    highlights: [
      "Nome, telefone e observações do atendimento.",
      "Referências para eventos, aniversários e pedidos especiais.",
      "Base pensada para suporte, recompra e fidelização.",
    ],
  },
  receitas: {
    eyebrow: "Cadastros",
    title: "Receitas cadastradas",
    description:
      "Organize fichas técnicas, rendimento, ingredientes e modo de preparo dos produtos da confeitaria.",
    highlights: [
      "Receitas separadas da calculadora de preço.",
      "Base para ficha técnica, rendimento e custo-base.",
      "Conexão futura entre produtos, produção e lista de compras.",
    ],
  },
  categorias: {
    eyebrow: "Cadastros",
    title: "Categorias do catálogo",
    description:
      "Separe bolos, doces, kits, combos e outros grupos para manter o catálogo organizado.",
    highlights: [
      "Estrutura do cardápio por tipo de produto.",
      "Organização para filtros, busca e vitrine.",
      "Apoio para relatórios e templates por categoria.",
    ],
  },
  produtos: {
    eyebrow: "Cadastros",
    title: "Produtos cadastrados",
    description:
      "Gerencie os produtos finais vendidos pela operação, com descrição, faixa de preço e categoria.",
    highlights: [
      "Produtos finais ligados ao catálogo do negócio.",
      "Preparação para estoque, pedidos e vitrine.",
      "Base para kits, tamanhos e variações futuras.",
    ],
  },
  insumos: {
    eyebrow: "Cadastros",
    title: "Insumos da operação",
    description:
      "Mantenha ingredientes, embalagens e materiais auxiliares organizados para apoiar custo e reposição.",
    highlights: [
      "Controle da base de ingredientes e embalagens.",
      "Caminho natural para estoque mínimo e alertas.",
      "Ponto de apoio para listas de compra e composição de receitas.",
    ],
  },
  "formas-pagamento": {
    eyebrow: "Cadastros",
    title: "Formas de pagamento",
    description:
      "Defina como a confeitaria recebe: PIX, cartão, dinheiro, boleto ou outras regras comerciais.",
    highlights: [
      "Métodos aceitos no atendimento e no orçamento.",
      "Regras por pedido, sinal e pagamento final.",
      "Pronto para aparecer em documentos e checkout futuro.",
    ],
  },
  producao: {
    eyebrow: "Gestão",
    title: "Produção",
    description:
      "Visualize a fila de produção, o que está em preparo e o que já foi separado para entrega.",
    highlights: [
      "Fila operacional por data e prioridade.",
      "Separação entre pendente, em preparo e concluído.",
      "Espaço para checklists e etapas da cozinha.",
    ],
  },
  estoque: {
    eyebrow: "Gestão",
    title: "Estoque",
    description:
      "Controle consumo, reposição e disponibilidade de insumos para reduzir rupturas na operação.",
    highlights: [
      "Entrada e saída de ingredientes e embalagens.",
      "Acompanhamento de itens críticos do negócio.",
      "Base para alertas e reposição planejada.",
    ],
  },
  financeiro: {
    eyebrow: "Gestão",
    title: "Financeiro",
    description:
      "Concentre visão de recebimentos, custos variáveis, despesas fixas e resultado operacional.",
    highlights: [
      "Receitas por período e por canal.",
      "Comparação entre venda, custo e margem.",
      "Espaço para fluxo de caixa e conciliação futura.",
    ],
  },
  "lista-compras": {
    eyebrow: "Gestão",
    title: "Lista de compras",
    description:
      "Monte listas de reposição com base nos pedidos, no consumo médio e nos itens abaixo do ideal.",
    highlights: [
      "Lista agrupada por ingrediente, embalagem ou fornecedor.",
      "Atalho entre estoque, produção e compras.",
      "Pronto para futuras automações de reposição.",
    ],
  },
  integracoes: {
    eyebrow: "Integrações",
    title: "Integrações do ramo",
    description:
      "Conecte o template da confeitaria com ERP, vendas online, automações e canais operacionais.",
    highlights: [
      "Área dedicada às conexões externas.",
      "Espaço para gateways, ERP e mensageria.",
      "Estrutura separada do núcleo da precificadora.",
    ],
  },
} as const;

type ModuleKey = keyof typeof modulePageContent;

const confectioneryCustomerPreview = [
  {
    name: "João Antonio da Silva",
    segment: "Recorrente",
    note: "Compra pães e bolos para a família aos fins de semana.",
    lastOrder: "Último pedido há 2 dias",
    pendingAmount: 45,
    ordersCount: 8,
    tone: "rose" as const,
  },
  {
    name: "Mariana Ribeiro",
    segment: "Eventos",
    note: "Foco em bolo de aniversário e kits personalizados.",
    lastOrder: "Entrega amanhã às 10:00",
    pendingAmount: 95,
    ordersCount: 4,
    tone: "mint" as const,
  },
  {
    name: "Carla Mendes",
    segment: "Corporativo",
    note: "Encomendas de caixas para brindes e ações internas.",
    lastOrder: "Retirada programada para sexta",
    pendingAmount: 0,
    ordersCount: 6,
    tone: "sky" as const,
  },
] as const;

const confectioneryCategoryPreview = [
  {
    label: "Bolos",
    description: "Produtos principais com maior ticket médio.",
    products: 12,
    tone: "rose" as const,
  },
  {
    label: "Doces finos",
    description: "Linha de alto giro para eventos e kits.",
    products: 18,
    tone: "mint" as const,
  },
  {
    label: "Pães e caseiros",
    description: "Itens recorrentes com produção diária ou semanal.",
    products: 9,
    tone: "amber" as const,
  },
  {
    label: "Combos e kits",
    description: "Agrupamentos para datas sazonais e aniversários.",
    products: 7,
    tone: "sky" as const,
  },
] as const;

const confectioneryProductPreview = [
  {
    name: "Pão caseiro",
    category: "Pães e caseiros",
    note: "Produto de giro com retirada rápida.",
    price: 90,
    yield: "4 unidades",
    tone: "rose" as const,
  },
  {
    name: "Bolo de aniversário 2kg",
    category: "Bolos",
    note: "Principal item sob encomenda do catálogo.",
    price: 185,
    yield: "1 bolo",
    tone: "mint" as const,
  },
  {
    name: "Caixa de brigadeiros",
    category: "Doces finos",
    note: "Modelo ideal para kits e pedidos corporativos.",
    price: 120,
    yield: "3 caixas",
    tone: "sky" as const,
  },
  {
    name: "Kit festa pequeno",
    category: "Combos e kits",
    note: "Agrupa bolo, docinhos e embalagem.",
    price: 240,
    yield: "1 kit",
    tone: "amber" as const,
  },
] as const;

const confectionerySupplyPreview = [
  {
    name: "Farinha de trigo",
    unit: "kg",
    averageCost: 6.9,
    stockLabel: "Estoque confortável",
    tone: "mint" as const,
  },
  {
    name: "Chocolate nobre",
    unit: "kg",
    averageCost: 38.5,
    stockLabel: "Atenção para reposição",
    tone: "rose" as const,
  },
  {
    name: "Caixa premium",
    unit: "un",
    averageCost: 3.4,
    stockLabel: "Uso frequente em kits",
    tone: "sky" as const,
  },
  {
    name: "Leite condensado",
    unit: "cx",
    averageCost: 7.8,
    stockLabel: "Base de várias receitas",
    tone: "amber" as const,
  },
] as const;

export default async function BusinessModulePage({
  params,
}: {
  params: Promise<{ module: string }>;
}) {
  const session = await getCurrentAuthSession();
  const { module } = await params;
  const content = modulePageContent[module as ModuleKey];
  const cookieStore = await cookies();
  const fallbackBusinessType = normalizePersistedBusinessType(
    cookieStore.get(businessTypeCookieName)?.value ?? null,
  );

  if (!content) {
    notFound();
  }

  const preferences =
    session && isPlatformPersistenceAvailable()
      ? await getWorkspacePreferences(session.workspace.id).catch(
          () => defaultAppPreferences,
        )
      : {
          ...defaultAppPreferences,
          businessType: fallbackBusinessType,
          onboardingCompleted: fallbackBusinessType !== null,
        };
  const history =
    session && isPlatformPersistenceAvailable()
      ? await listCalculationSnapshots(session.workspace.id).catch(() => [])
      : [];

  const ctaHref = "ctaHref" in content ? content.ctaHref : undefined;
  const ctaLabel = "ctaLabel" in content ? content.ctaLabel : undefined;

  if (preferences.businessType === "confectionery" && module === "agenda") {
    const orders = buildConfectioneryPreviewOrders(history);
    const totalDayValue = orders.reduce((total, order) => total + order.totalValue, 0);
    const finishedCount = orders.filter((order) => order.status === "done").length;
    const inProgressCount = orders.filter(
      (order) => order.status === "in_progress",
    ).length;

    return (
      <div className="app-page space-y-6">
        <header className="app-header">
          <BackLink href="/app" label="Voltar para o início" />
          <p className="app-eyebrow">Agenda</p>
          <h1 className="app-title">Agenda operacional da confeitaria</h1>
          <p className="app-copy max-w-[760px]">
            Pedidos, produção, entrega e saldo do dia em uma visão só, com foco
            no que precisa sair da bancada e virar entrega.
          </p>
        </header>

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_360px]">
          <article className="app-card overflow-hidden p-0">
            <div className="border-b border-[var(--panel-border)] bg-[linear-gradient(135deg,rgba(255,247,251,0.96)_0%,rgba(243,251,246,0.96)_100%)] px-6 py-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[#cf7395]">
                    Hoje
                  </p>
                  <p className="mt-2 text-3xl font-semibold tracking-[-0.05em] text-[var(--foreground)]">
                    {formatCurrency(totalDayValue, preferences.defaultDisplayCurrency)}
                  </p>
                </div>
                <div className="rounded-[24px] border border-white/80 bg-white/84 px-4 py-3 text-sm text-[var(--muted)]">
                  <p>1 agendado</p>
                  <p>{inProgressCount} em produção</p>
                  <p>{finishedCount} pronto(s)</p>
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-5">
                {[
                  { month: "Ago", day: "09", week: "Dom", active: true, badge: "2" },
                  { month: "Ago", day: "10", week: "Seg", active: false, badge: "1" },
                  { month: "Ago", day: "11", week: "Ter", active: false, badge: "0" },
                  { month: "Ago", day: "12", week: "Qua", active: false, badge: "3" },
                  { month: "Ago", day: "13", week: "Qui", active: false, badge: "1" },
                ].map((day) => (
                  <div
                    key={`${day.month}-${day.day}`}
                    className={`rounded-[24px] border px-4 py-4 text-center ${
                      day.active
                        ? "border-[#f3bfd1] bg-white shadow-[0_12px_30px_rgba(207,115,149,0.12)]"
                        : "border-[var(--panel-border)] bg-white/76"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-[var(--muted)]">
                        {day.month}
                      </span>
                      <span className="rounded-full bg-[#fff1f6] px-2 py-0.5 text-[11px] font-semibold text-[#cf7395]">
                        {day.badge}
                      </span>
                    </div>
                    <p className="mt-3 text-3xl font-semibold tracking-[-0.06em] text-[var(--foreground)]">
                      {day.day}
                    </p>
                    <p className="mt-1 text-sm text-[var(--muted)]">{day.week}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4 p-5 sm:p-6">
              {orders.map((order) => (
                <div
                  key={order.id}
                  className="rounded-[28px] border border-[var(--panel-border)] bg-white/82 p-5 shadow-[0_12px_30px_rgba(115,173,142,0.08)]"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h2 className="text-[1.4rem] font-semibold tracking-[-0.05em] text-[var(--foreground)]">
                        {order.clientName}
                      </h2>
                      <p className="mt-1 text-sm text-[var(--muted)]">
                        {order.scheduledLabel}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-4 py-2 text-sm font-semibold ${
                        order.status === "scheduled"
                          ? "bg-[#fff1f6] text-[#cf7395]"
                          : order.status === "in_progress"
                            ? "bg-[#eaf8f1] text-[#5f9079]"
                            : "bg-[#eef6fd] text-[#6492bc]"
                      }`}
                    >
                      {order.statusLabel}
                    </span>
                  </div>

                  <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
                    <div>
                      <div className="grid gap-2 text-sm text-[var(--muted)]">
                        <p>{order.quantityLabel}</p>
                        <p>Tempo de produção: {order.productionDurationLabel}</p>
                        <p>
                          Adiantamento:{" "}
                          {formatCurrency(
                            order.advancePaid,
                            preferences.defaultDisplayCurrency,
                          )}
                        </p>
                      </div>

                      <div className="mt-4">
                        <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                          <span>{order.progressLabel}</span>
                          <span>{order.progressPercent}%</span>
                        </div>
                        <div className="mt-2 h-3 rounded-full bg-[#eef7f2]">
                          <div
                            className={`h-3 rounded-full ${
                              order.status === "scheduled"
                                ? "bg-[#ef7aa6]"
                                : order.status === "in_progress"
                                  ? "bg-[#67c195]"
                                  : "bg-[#6fa8d8]"
                            }`}
                            style={{ width: `${order.progressPercent}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="rounded-[24px] border border-[var(--panel-border)] bg-[#fcfffd] p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                        Fechamento
                      </p>
                      <p className="mt-3 text-lg font-semibold text-[var(--foreground)]">
                        {formatCurrency(
                          order.totalValue,
                          preferences.defaultDisplayCurrency,
                        )}
                      </p>
                      <p className="mt-2 text-sm text-[var(--muted)]">
                        Restante:{" "}
                        {formatCurrency(
                          order.remainingAmount,
                          preferences.defaultDisplayCurrency,
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </article>

          <aside className="space-y-4">
            <section className="app-card p-6">
              <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[var(--muted)]">
                Filtro de status
              </p>
              <div className="mt-4 grid gap-3">
                {[
                  "Agendado",
                  "Em produção",
                  "Pronto para retirada",
                ].map((item, index) => (
                  <div
                    key={item}
                    className={`rounded-[20px] border px-4 py-3 text-sm font-semibold ${
                      index === 0
                        ? "border-[#f5c7d7] bg-[#fff4f8] text-[#cf7395]"
                        : index === 1
                          ? "border-[#cfe9db] bg-[#f4fbf7] text-[#5f9079]"
                          : "border-[#cfe2f5] bg-[#f7fbff] text-[#6492bc]"
                    }`}
                  >
                    {item}
                  </div>
                ))}
              </div>
            </section>

            <section className="app-card-soft p-6">
              <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[var(--muted)]">
                Próximas ações
              </p>
              <div className="mt-4 grid gap-3">
                <Link href="/app/producao" className="app-button app-button-secondary">
                  Abrir produção
                </Link>
                <Link href="/app/vendas" className="app-button app-button-secondary">
                  Ir para vendas
                </Link>
                <Link href="/app/precificacao" className="app-button app-button-primary">
                  Abrir calculadora
                </Link>
              </div>
            </section>
          </aside>
        </section>
      </div>
    );
  }

  if (preferences.businessType === "confectionery" && module === "vendas") {
    const orders = buildConfectioneryPreviewOrders(history);
    const confirmedRevenue = orders.reduce((total, order) => total + order.totalValue, 0);
    const pendingReceivables = orders.reduce(
      (total, order) => total + order.remainingAmount,
      0,
    );
    const advances = orders.reduce((total, order) => total + order.advancePaid, 0);

    return (
      <div className="app-page space-y-6">
        <header className="app-header">
          <BackLink href="/app" label="Voltar para o início" />
          <p className="app-eyebrow">Vendas</p>
          <h1 className="app-title">Pedidos e atendimento da confeitaria</h1>
          <p className="app-copy max-w-[760px]">
            Acompanhe cliente, valor fechado, adiantamento, saldo e situação do
            pedido em uma visão comercial mais direta.
          </p>
        </header>

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_360px]">
          <article className="app-card p-6 sm:p-7">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[var(--accent)]">
                  Pedidos pendentes
                </p>
                <h2 className="mt-3 text-2xl font-semibold tracking-[-0.05em] text-[var(--foreground)]">
                  Vendas do período
                </h2>
              </div>
              <span className="rounded-full border border-[#f3bfd1] bg-[#fff3f7] px-4 py-2 text-xs font-semibold text-[#cf7395]">
                {orders.length} pedidos ativos
              </span>
            </div>

            <div className="mt-6 space-y-4">
              {orders.map((order, index) => (
                <article
                  key={order.id}
                  className="rounded-[28px] border border-[var(--panel-border)] bg-white/86 p-5 shadow-[0_12px_30px_rgba(115,173,142,0.08)]"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-[1.4rem] font-semibold tracking-[-0.05em] text-[var(--foreground)]">
                        {order.clientName}
                        <span className="ml-2 text-[var(--muted)]">#{index + 1}</span>
                      </p>
                      <p className="mt-1 text-sm text-[var(--muted)]">
                        {order.productName} · {order.scheduledLabel}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-4 py-2 text-sm font-semibold ${
                        order.status === "scheduled"
                          ? "bg-[#fff1f6] text-[#cf7395]"
                          : order.status === "in_progress"
                            ? "bg-[#eaf8f1] text-[#5f9079]"
                            : "bg-[#eef6fd] text-[#6492bc]"
                      }`}
                    >
                      {order.statusLabel}
                    </span>
                  </div>

                  <div className="mt-5 grid gap-4 border-t border-[var(--panel-border)] pt-4 lg:grid-cols-[minmax(0,1fr)_220px]">
                    <div className="space-y-3 text-sm text-[var(--muted)]">
                      <p>{order.quantityLabel}</p>
                      <p>
                        Adiantamento:{" "}
                        {formatCurrency(
                          order.advancePaid,
                          preferences.defaultDisplayCurrency,
                        )}
                      </p>
                      <p>
                        Restante a pagar:{" "}
                        {formatCurrency(
                          order.remainingAmount,
                          preferences.defaultDisplayCurrency,
                        )}
                      </p>
                    </div>

                    <div className="rounded-[24px] border border-[var(--panel-border)] bg-[#fcfffd] p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                        Total do pedido
                      </p>
                      <p className="mt-3 text-2xl font-semibold tracking-[-0.05em] text-[var(--foreground)]">
                        {formatCurrency(
                          order.totalValue,
                          preferences.defaultDisplayCurrency,
                        )}
                      </p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </article>

          <aside className="space-y-4">
            <section className="app-card p-6">
              <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[var(--muted)]">
                Resumo comercial
              </p>
              <div className="mt-4 grid gap-3">
                <SalesMetric
                  label="Receita confirmada"
                  value={formatCurrency(
                    confirmedRevenue,
                    preferences.defaultDisplayCurrency,
                  )}
                  tone="mint"
                />
                <SalesMetric
                  label="Adiantamentos"
                  value={formatCurrency(advances, preferences.defaultDisplayCurrency)}
                  tone="sky"
                />
                <SalesMetric
                  label="Saldo pendente"
                  value={formatCurrency(
                    pendingReceivables,
                    preferences.defaultDisplayCurrency,
                  )}
                  tone="rose"
                />
              </div>
            </section>

            <section className="app-card-soft p-6">
              <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[var(--muted)]">
                Atalhos
              </p>
              <div className="mt-4 grid gap-3">
                <Link href="/app/agenda" className="app-button app-button-secondary">
                  Ver agenda
                </Link>
                <Link href="/app/financeiro" className="app-button app-button-secondary">
                  Abrir financeiro
                </Link>
                <Link href="/app/clientes" className="app-button app-button-primary">
                  Ir para clientes
                </Link>
              </div>
            </section>
          </aside>
        </section>
      </div>
    );
  }

  if (preferences.businessType === "confectionery" && module === "producao") {
    const orders = buildConfectioneryPreviewOrders(history);
    const scheduledOrders = orders.filter((order) => order.status === "scheduled");
    const inProgressOrders = orders.filter((order) => order.status === "in_progress");
    const doneOrders = orders.filter((order) => order.status === "done");

    return (
      <div className="app-page space-y-6">
        <header className="app-header">
          <BackLink href="/app" label="Voltar para o início" />
          <p className="app-eyebrow">Produção</p>
          <h1 className="app-title">Fila de produção da confeitaria</h1>
          <p className="app-copy max-w-[760px]">
            Separe o que está agendado, em bancada e concluído, com leitura
            rápida de progresso e impacto no dia.
          </p>
        </header>

        <section className="grid gap-5 xl:grid-cols-3">
          <ProductionColumn
            title="Produções agendadas"
            subtitle="Pedidos prontos para entrar na fila."
            tone="rose"
            items={scheduledOrders}
            currency={preferences.defaultDisplayCurrency}
          />
          <ProductionColumn
            title="Em produção"
            subtitle="Pedidos com execução ativa."
            tone="mint"
            items={inProgressOrders}
            currency={preferences.defaultDisplayCurrency}
          />
          <ProductionColumn
            title="Concluídos"
            subtitle="Pedidos finalizados e prontos para saída."
            tone="sky"
            items={doneOrders}
            currency={preferences.defaultDisplayCurrency}
          />
        </section>

        <section className="app-card-soft p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[var(--muted)]">
                Próximas ações
              </p>
              <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
                O próximo passo aqui é plugar checklists, tempos reais e transição
                manual entre as etapas da produção.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/app/agenda" className="app-button app-button-secondary">
                Voltar para agenda
              </Link>
              <Link href="/app/estoque" className="app-button app-button-secondary">
                Abrir estoque
              </Link>
            </div>
          </div>
        </section>
      </div>
    );
  }

  if (preferences.businessType === "confectionery" && module === "clientes") {
    const pendingAmount = confectioneryCustomerPreview.reduce(
      (total, client) => total + client.pendingAmount,
      0,
    );
    const recurringCount = confectioneryCustomerPreview.filter(
      (client) => client.ordersCount >= 5,
    ).length;

    return (
      <div className="app-page space-y-6">
        <header className="app-header">
          <BackLink href="/app" label="Voltar para o início" />
          <p className="app-eyebrow">Clientes</p>
          <h1 className="app-title">Base de clientes da confeitaria</h1>
          <p className="app-copy max-w-[760px]">
            Centralize quem compra, o tipo de pedido, saldo em aberto e sinais
            de recorrência para apoiar atendimento e recompra.
          </p>
        </header>

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_360px]">
          <article className="app-card p-6 sm:p-7">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[var(--accent)]">
                  Relacionamento
                </p>
                <h2 className="mt-3 text-2xl font-semibold tracking-[-0.05em] text-[var(--foreground)]">
                  Clientes acompanhados
                </h2>
              </div>
              <span className="rounded-full border border-[#f3bfd1] bg-[#fff3f7] px-4 py-2 text-xs font-semibold text-[#cf7395]">
                {confectioneryCustomerPreview.length} perfis no preview
              </span>
            </div>

            <div className="mt-6 space-y-4">
              {confectioneryCustomerPreview.map((client) => (
                <CustomerPreviewCard
                  key={client.name}
                  client={client}
                  currency={preferences.defaultDisplayCurrency}
                />
              ))}
            </div>
          </article>

          <aside className="space-y-4">
            <section className="app-card p-6">
              <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[var(--muted)]">
                Indicadores
              </p>
              <div className="mt-4 grid gap-3">
                <SalesMetric
                  label="Saldo pendente"
                  value={formatCurrency(
                    pendingAmount,
                    preferences.defaultDisplayCurrency,
                  )}
                  tone="rose"
                />
                <SalesMetric
                  label="Clientes recorrentes"
                  value={`${recurringCount} ativos`}
                  tone="mint"
                />
                <SalesMetric
                  label="Pedidos registrados"
                  value={`${confectioneryCustomerPreview.reduce((t, c) => t + c.ordersCount, 0)}`}
                  tone="sky"
                />
              </div>
            </section>

            <section className="app-card-soft p-6">
              <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[var(--muted)]">
                Próxima camada
              </p>
              <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
                Aqui entram filtros, histórico completo, datas especiais e
                observações para suporte e recompra.
              </p>
            </section>
          </aside>
        </section>
      </div>
    );
  }

  if (preferences.businessType === "confectionery" && module === "categorias") {
    return (
      <div className="app-page space-y-6">
        <header className="app-header">
          <BackLink href="/app" label="Voltar para o início" />
          <p className="app-eyebrow">Categorias</p>
          <h1 className="app-title">Organização do catálogo</h1>
          <p className="app-copy max-w-[760px]">
            Separe produtos por grupos comerciais para facilitar vitrine, busca,
            orçamento e leitura de desempenho.
          </p>
        </header>

        <section className="app-card p-6 sm:p-7">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {confectioneryCategoryPreview.map((category) => (
              <CategoryPreviewCard key={category.label} category={category} />
            ))}
          </div>
        </section>
      </div>
    );
  }

  if (preferences.businessType === "confectionery" && module === "receitas") {
    return (
      <div className="app-page space-y-6">
        <header className="app-header">
          <BackLink href="/app" label="Voltar para o início" />
          <p className="app-eyebrow">Receitas</p>
          <h1 className="app-title">Fichas técnicas da confeitaria</h1>
          <p className="app-copy max-w-[760px]">
            Aqui entram as receitas base dos produtos, com ingredientes,
            rendimento, observações de preparo e ligação futura com estoque,
            produção e lista de compras.
          </p>
        </header>

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1.08fr)_340px]">
          <article className="app-card p-6 sm:p-7">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[var(--accent)]">
                  Base técnica
                </p>
                <h2 className="mt-3 text-2xl font-semibold tracking-[-0.05em] text-[var(--foreground)]">
                  Receitas em estrutura
                </h2>
              </div>
              <span className="rounded-full border border-[#f3bfd1] bg-[#fff3f7] px-4 py-2 text-xs font-semibold text-[#cf7395]">
                4 receitas no preview
              </span>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {[
                {
                  title: "Bolo de chocolate",
                  yieldLabel: "1 bolo de 2kg",
                  note: "Massa, recheio, cobertura e acabamento final.",
                },
                {
                  title: "Brigadeiro gourmet",
                  yieldLabel: "30 unidades",
                  note: "Base para festas, kits e vendas unitárias.",
                },
                {
                  title: "Pão caseiro",
                  yieldLabel: "4 unidades",
                  note: "Receita recorrente com produção semanal.",
                },
                {
                  title: "Caixa de docinhos",
                  yieldLabel: "12 unidades",
                  note: "Composição pensada para kits e encomendas.",
                },
              ].map((recipe) => (
                <div
                  key={recipe.title}
                  className="rounded-[24px] border border-[var(--panel-border)] bg-white/80 p-5"
                >
                  <p className="text-lg font-semibold text-[var(--foreground)]">
                    {recipe.title}
                  </p>
                  <p className="mt-2 text-sm font-medium text-[var(--accent)]">
                    {recipe.yieldLabel}
                  </p>
                  <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
                    {recipe.note}
                  </p>
                </div>
              ))}
            </div>
          </article>

          <aside className="space-y-4">
            <section className="app-card p-6">
              <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[var(--muted)]">
                Fluxo certo
              </p>
              <div className="mt-4 grid gap-3">
                <Link href="/app/precificacao" className="app-button app-button-primary">
                  Abrir calculadora
                </Link>
                <Link href="/app/produtos" className="app-button app-button-secondary">
                  Ver produtos
                </Link>
                <Link href="/app/insumos" className="app-button app-button-secondary">
                  Ver insumos
                </Link>
              </div>
            </section>

            <section className="app-card-soft p-6">
              <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[var(--muted)]">
                Observação
              </p>
              <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
                Receita é a ficha técnica do produto. A calculadora usa essa base
                para montar custo, margem e preço final.
              </p>
            </section>
          </aside>
        </section>
      </div>
    );
  }

  if (preferences.businessType === "confectionery" && module === "produtos") {
    return (
      <div className="app-page space-y-6">
        <header className="app-header">
          <BackLink href="/app" label="Voltar para o início" />
          <p className="app-eyebrow">Produtos</p>
          <h1 className="app-title">Catálogo comercial da confeitaria</h1>
          <p className="app-copy max-w-[760px]">
            Organize o que é vendido no negócio, com categoria, rendimento,
            preço-base e conexão futura com receitas e pedidos.
          </p>
        </header>

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1.08fr)_340px]">
          <article className="app-card p-6 sm:p-7">
            <div className="grid gap-4 md:grid-cols-2">
              {confectioneryProductPreview.map((product) => (
                <ProductPreviewCard
                  key={product.name}
                  product={product}
                  currency={preferences.defaultDisplayCurrency}
                />
              ))}
            </div>
          </article>

          <aside className="space-y-4">
            <section className="app-card p-6">
              <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[var(--muted)]">
                Conexões
              </p>
              <div className="mt-4 grid gap-3">
                <Link href="/app/receitas" className="app-button app-button-primary">
                  Abrir receitas
                </Link>
                <Link href="/app/precificacao" className="app-button app-button-secondary">
                  Abrir calculadora
                </Link>
                <Link href="/app/categorias" className="app-button app-button-secondary">
                  Ver categorias
                </Link>
              </div>
            </section>

            <section className="app-card-soft p-6">
              <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[var(--muted)]">
                Observação
              </p>
              <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
                O produto final é a camada comercial. A composição vive em
                receitas e o cálculo de custo/preço acontece na calculadora.
              </p>
            </section>
          </aside>
        </section>
      </div>
    );
  }

  if (preferences.businessType === "confectionery" && module === "insumos") {
    return (
      <div className="app-page space-y-6">
        <header className="app-header">
          <BackLink href="/app" label="Voltar para o início" />
          <p className="app-eyebrow">Insumos</p>
          <h1 className="app-title">Base de insumos e embalagem</h1>
          <p className="app-copy max-w-[760px]">
            Mantenha ingredientes, embalagens e materiais de apoio organizados
            para sustentar custo, estoque e lista de compras.
          </p>
        </header>

        <section className="app-card p-6 sm:p-7">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {confectionerySupplyPreview.map((supply) => (
              <SupplyPreviewCard
                key={supply.name}
                supply={supply}
                currency={preferences.defaultDisplayCurrency}
              />
            ))}
          </div>
        </section>
      </div>
    );
  }

  if (preferences.businessType === "confectionery" && module === "financeiro") {
    const orders = buildConfectioneryPreviewOrders(history);
    const finance = buildConfectioneryFinanceSnapshot(orders);

    return (
      <div className="app-page space-y-6">
        <header className="app-header">
          <BackLink href="/app" label="Voltar para o início" />
          <p className="app-eyebrow">Financeiro</p>
          <h1 className="app-title">Painel financeiro da confeitaria</h1>
          <p className="app-copy max-w-[760px]">
            Uma visão mais leve de receitas, despesas e categorias, pensada para
            leitura rápida no dia a dia da operação.
          </p>
        </header>

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1.05fr)_380px]">
          <article className="app-card p-6 sm:p-7">
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[var(--accent)]">
              Receitas vs despesas
            </p>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="rounded-[26px] border border-[#cfe9db] bg-[#f4fbf7] p-5">
                <p className="text-sm text-[var(--muted)]">Receitas</p>
                <p className="mt-2 text-4xl font-semibold tracking-[-0.06em] text-[#3f936b]">
                  {formatCurrency(finance.revenue, preferences.defaultDisplayCurrency)}
                </p>
              </div>
              <div className="rounded-[26px] border border-[#f5c7d7] bg-[#fff5f8] p-5">
                <p className="text-sm text-[var(--muted)]">Despesas</p>
                <p className="mt-2 text-4xl font-semibold tracking-[-0.06em] text-[#d25581]">
                  {formatCurrency(finance.expenses, preferences.defaultDisplayCurrency)}
                </p>
              </div>
            </div>

            <div className="mt-6 space-y-4">
              <FinanceProgressLine
                label="Receitas"
                percentage={finance.revenueShare}
                tone="mint"
              />
              <FinanceProgressLine
                label="Despesas"
                percentage={finance.expenseShare}
                tone="rose"
              />
            </div>
          </article>

          <aside className="app-card p-6">
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[var(--muted)]">
              Distribuição
            </p>
            <div className="mt-5 flex items-center justify-center">
              <div className="relative size-[240px] rounded-full bg-[conic-gradient(#37bd8d_0_44.2%,#42a0dd_44.2%_83.9%,#f3b35b_83.9%_91.5%,#ef5b88_91.5%_96.6%,#9a67e8_96.6%_100%)] shadow-[0_18px_40px_rgba(95,144,121,0.14)]">
                <div className="absolute inset-[26px] rounded-full bg-white/96" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <p className="text-sm text-[var(--muted)]">Este mês</p>
                    <p className="mt-2 text-3xl font-semibold tracking-[-0.06em] text-[var(--foreground)]">
                      64,8%
                    </p>
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      custo sobre a receita
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </aside>
        </section>

        <section className="app-card p-6 sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[var(--accent)]">
                Despesas por categoria
              </p>
              <h2 className="mt-3 text-2xl font-semibold tracking-[-0.05em] text-[var(--foreground)]">
                Leitura operacional do custo
              </h2>
            </div>
            <span className="rounded-full border border-[var(--panel-border)] bg-white/80 px-4 py-2 text-xs font-semibold text-[var(--muted)]">
              Preview do template financeiro
            </span>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            {finance.categories.map((category) => (
              <div
                key={category.label}
                className="rounded-[24px] border border-[var(--panel-border)] bg-white/82 p-5"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span
                      className={`inline-flex size-3 rounded-full ${
                        category.tone === "mint"
                          ? "bg-[#37bd8d]"
                          : category.tone === "sky"
                            ? "bg-[#42a0dd]"
                            : category.tone === "amber"
                              ? "bg-[#f3b35b]"
                              : category.tone === "rose"
                                ? "bg-[#ef5b88]"
                                : "bg-[#9a67e8]"
                      }`}
                    />
                    <p className="text-base font-semibold text-[var(--foreground)]">
                      {category.label}
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-[var(--muted)]">
                    {category.percentage.toFixed(1).replace(".", ",")}%
                  </span>
                </div>
                <p className="mt-4 text-2xl font-semibold tracking-[-0.05em] text-[var(--foreground)]">
                  {formatCurrency(category.amount, preferences.defaultDisplayCurrency)}
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="app-page">
      <header className="app-header">
        <BackLink href="/app" label="Voltar para o início" />
        <p className="app-eyebrow">{content.eyebrow}</p>
        <h1 className="app-title">{content.title}</h1>
        <p className="app-copy max-w-[760px]">{content.description}</p>
      </header>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(280px,0.8fr)]">
        <article className="app-card p-5 sm:p-6">
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full border border-[#bddfcf] bg-[#eef8f2] px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-[#4e7968]">
              Template confeitaria
            </span>
            <span className="rounded-full border border-[var(--panel-border)] bg-[var(--panel-soft)] px-3 py-1 text-xs font-medium text-[var(--muted)]">
              Estrutura pronta para evoluir
            </span>
          </div>

          <div className="mt-5 space-y-3">
            <p className="text-sm leading-6 text-[var(--muted)]">
              Este módulo já está separado dentro do template da confeitaria para
              que cada área do negócio possa evoluir sem misturar fluxo comercial,
              produção e precificação.
            </p>

            <ul className="grid gap-3 md:grid-cols-3">
              {content.highlights.map((highlight) => (
                <li
                  key={highlight}
                  className="rounded-[24px] border border-[var(--panel-border)] bg-[var(--panel-soft)] p-4 text-sm leading-6 text-[var(--foreground)]"
                >
                  {highlight}
                </li>
              ))}
            </ul>
          </div>

          {ctaHref && ctaLabel ? (
            <div className="mt-6">
              <Link href={ctaHref} className="app-button app-button-primary">
                {ctaLabel}
              </Link>
            </div>
          ) : null}
        </article>

        <aside className="app-card p-5 sm:p-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-[var(--muted)]">
            Próximos blocos
          </p>
          <div className="mt-4 space-y-3">
            <div className="rounded-[22px] border border-[var(--panel-border)] bg-[var(--panel-soft)] p-4">
              <p className="text-sm font-semibold text-[var(--foreground)]">
                Dados do ramo
              </p>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                A tela já está reservada dentro do template correto. O próximo passo
                é plugar os dados reais e as automações específicas da confeitaria.
              </p>
            </div>

            <div className="rounded-[22px] border border-[var(--panel-border)] bg-[var(--panel-soft)] p-4">
              <p className="text-sm font-semibold text-[var(--foreground)]">
                Precificação vinculada
              </p>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                Custos, receitas, vendas e operação podem conversar entre si sem
                depender do layout da impressão 3D.
              </p>
            </div>

            <div className="rounded-[22px] border border-[var(--panel-border)] bg-[var(--panel-soft)] p-4">
              <p className="text-sm font-semibold text-[var(--foreground)]">
                Próxima expansão
              </p>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                Quando você definir a prioridade, esse módulo pode ganhar listagem,
                formulário, filtros e integrações próprias.
              </p>
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
}

function FinanceProgressLine({
  label,
  percentage,
  tone,
}: {
  label: string;
  percentage: number;
  tone: "mint" | "rose";
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="text-[var(--foreground)]">{label}</span>
        <span className="font-semibold text-[var(--muted)]">
          {percentage.toFixed(1).replace(".", ",")}%
        </span>
      </div>
      <div className="mt-2 h-3 rounded-full bg-[#edf5f0]">
        <div
          className={`h-3 rounded-full ${
            tone === "mint" ? "bg-[#37bd8d]" : "bg-[#ef5b88]"
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

function SalesMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "mint" | "rose" | "sky";
}) {
  const className =
    tone === "mint"
      ? "border-[#cfe9db] bg-[#f4fbf7] text-[#3f936b]"
      : tone === "rose"
        ? "border-[#f5c7d7] bg-[#fff5f8] text-[#d25581]"
        : "border-[#cfe2f5] bg-[#f7fbff] text-[#6492bc]";

  return (
    <div className={`rounded-[24px] border px-4 py-4 ${className}`}>
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold tracking-[-0.05em]">{value}</p>
    </div>
  );
}

function ProductionColumn({
  title,
  subtitle,
  tone,
  items,
  currency,
}: {
  title: string;
  subtitle: string;
  tone: "rose" | "mint" | "sky";
  items: ReturnType<typeof buildConfectioneryPreviewOrders>;
  currency: typeof defaultAppPreferences.defaultDisplayCurrency;
}) {
  return (
    <section
      className={`app-card p-5 ${
        tone === "rose"
          ? "bg-[linear-gradient(180deg,#fff8fb_0%,rgba(255,255,255,0.94)_100%)]"
          : tone === "mint"
            ? "bg-[linear-gradient(180deg,#f6fcf8_0%,rgba(255,255,255,0.94)_100%)]"
            : "bg-[linear-gradient(180deg,#f7fbff_0%,rgba(255,255,255,0.94)_100%)]"
      }`}
    >
      <div className="border-b border-[var(--panel-border)] pb-4">
        <p className="text-lg font-semibold text-[var(--foreground)]">{title}</p>
        <p className="mt-2 text-sm leading-7 text-[var(--muted)]">{subtitle}</p>
      </div>

      <div className="mt-4 space-y-4">
        {items.map((order) => (
          <article
            key={order.id}
            className="rounded-[24px] border border-white/80 bg-white/86 p-4 shadow-[0_10px_26px_rgba(136,181,158,0.10)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-base font-semibold text-[var(--foreground)]">
                  {order.productName}
                </p>
                <p className="mt-1 text-sm text-[var(--muted)]">{order.clientName}</p>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  tone === "rose"
                    ? "bg-[#fff1f6] text-[#cf7395]"
                    : tone === "mint"
                      ? "bg-[#eaf8f1] text-[#5f9079]"
                      : "bg-[#eef6fd] text-[#6492bc]"
                }`}
              >
                {order.statusLabel}
              </span>
            </div>

            <div className="mt-4 space-y-2 text-sm text-[var(--muted)]">
              <p>{order.scheduledLabel}</p>
              <p>Tempo: {order.productionDurationLabel}</p>
              <p>Quantidade: {order.quantityLabel}</p>
            </div>

            <div className="mt-4">
              <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                <span>{order.progressLabel}</span>
                <span>{order.progressPercent}%</span>
              </div>
              <div className="mt-2 h-2 rounded-full bg-[#edf5f0]">
                <div
                  className={`h-2 rounded-full ${
                    tone === "rose"
                      ? "bg-[#ef7aa6]"
                      : tone === "mint"
                        ? "bg-[#67c195]"
                        : "bg-[#6fa8d8]"
                  }`}
                  style={{ width: `${order.progressPercent}%` }}
                />
              </div>
            </div>

            <div className="mt-4 rounded-[18px] border border-[var(--panel-border)] bg-[#fcfffd] px-3 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                Total
              </p>
              <p className="mt-1 text-sm font-semibold text-[var(--foreground)]">
                {formatCurrency(order.totalValue, currency)}
              </p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function CustomerPreviewCard({
  client,
  currency,
}: {
  client: (typeof confectioneryCustomerPreview)[number];
  currency: typeof defaultAppPreferences.defaultDisplayCurrency;
}) {
  return (
    <article className="rounded-[28px] border border-[var(--panel-border)] bg-white/84 p-5 shadow-[0_12px_30px_rgba(115,173,142,0.08)]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[1.3rem] font-semibold tracking-[-0.05em] text-[var(--foreground)]">
            {client.name}
          </p>
          <p className="mt-2 text-sm leading-7 text-[var(--muted)]">{client.note}</p>
        </div>
        <span
          className={`rounded-full px-4 py-2 text-xs font-semibold ${
            client.tone === "rose"
              ? "bg-[#fff1f6] text-[#cf7395]"
              : client.tone === "mint"
                ? "bg-[#eaf8f1] text-[#5f9079]"
                : "bg-[#eef6fd] text-[#6492bc]"
          }`}
        >
          {client.segment}
        </span>
      </div>

      <div className="mt-5 grid gap-4 border-t border-[var(--panel-border)] pt-4 md:grid-cols-3">
        <InfoCard label="Pedidos" value={`${client.ordersCount}`} />
        <InfoCard label="Último movimento" value={client.lastOrder} muted />
        <InfoCard
          label="Saldo"
          value={formatCurrency(client.pendingAmount, currency)}
          emphasize={client.pendingAmount > 0}
        />
      </div>
    </article>
  );
}

function CategoryPreviewCard({
  category,
}: {
  category: (typeof confectioneryCategoryPreview)[number];
}) {
  return (
    <article
      className={`rounded-[26px] border p-5 ${
        category.tone === "rose"
          ? "border-[#f5c7d7] bg-[#fff7fa]"
          : category.tone === "mint"
            ? "border-[#cfe9db] bg-[#f5fbf7]"
            : category.tone === "amber"
              ? "border-[#f3ddb5] bg-[#fffaf1]"
              : "border-[#cfe2f5] bg-[#f7fbff]"
      }`}
    >
      <p className="text-lg font-semibold text-[var(--foreground)]">{category.label}</p>
      <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
        {category.description}
      </p>
      <div className="mt-5 rounded-[18px] border border-white/80 bg-white/80 px-4 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
          Produtos
        </p>
        <p className="mt-1 text-lg font-semibold text-[var(--foreground)]">
          {category.products}
        </p>
      </div>
    </article>
  );
}

function ProductPreviewCard({
  product,
  currency,
}: {
  product: (typeof confectioneryProductPreview)[number];
  currency: typeof defaultAppPreferences.defaultDisplayCurrency;
}) {
  return (
    <article className="rounded-[28px] border border-[var(--panel-border)] bg-white/84 p-5 shadow-[0_12px_30px_rgba(115,173,142,0.08)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-lg font-semibold text-[var(--foreground)]">{product.name}</p>
          <p className="mt-1 text-sm text-[var(--muted)]">{product.category}</p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            product.tone === "rose"
              ? "bg-[#fff1f6] text-[#cf7395]"
              : product.tone === "mint"
                ? "bg-[#eaf8f1] text-[#5f9079]"
                : product.tone === "amber"
                  ? "bg-[#fff3de] text-[#d29a41]"
                  : "bg-[#eef6fd] text-[#6492bc]"
          }`}
        >
          {product.yield}
        </span>
      </div>

      <p className="mt-4 text-sm leading-7 text-[var(--muted)]">{product.note}</p>

      <div className="mt-5 rounded-[20px] border border-[var(--panel-border)] bg-[#fcfffd] px-4 py-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
          Preço-base
        </p>
        <p className="mt-1 text-xl font-semibold tracking-[-0.04em] text-[var(--foreground)]">
          {formatCurrency(product.price, currency)}
        </p>
      </div>
    </article>
  );
}

function SupplyPreviewCard({
  supply,
  currency,
}: {
  supply: (typeof confectionerySupplyPreview)[number];
  currency: typeof defaultAppPreferences.defaultDisplayCurrency;
}) {
  return (
    <article className="rounded-[28px] border border-[var(--panel-border)] bg-white/84 p-5 shadow-[0_12px_30px_rgba(115,173,142,0.08)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-lg font-semibold text-[var(--foreground)]">{supply.name}</p>
          <p className="mt-1 text-sm text-[var(--muted)]">{supply.stockLabel}</p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            supply.tone === "mint"
              ? "bg-[#eaf8f1] text-[#5f9079]"
              : supply.tone === "rose"
                ? "bg-[#fff1f6] text-[#cf7395]"
                : supply.tone === "amber"
                  ? "bg-[#fff3de] text-[#d29a41]"
                  : "bg-[#eef6fd] text-[#6492bc]"
          }`}
        >
          / {supply.unit}
        </span>
      </div>

      <div className="mt-5 rounded-[20px] border border-[var(--panel-border)] bg-[#fcfffd] px-4 py-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
          Custo médio
        </p>
        <p className="mt-1 text-xl font-semibold tracking-[-0.04em] text-[var(--foreground)]">
          {formatCurrency(supply.averageCost, currency)}
        </p>
      </div>
    </article>
  );
}

function InfoCard({
  label,
  value,
  muted = false,
  emphasize = false,
}: {
  label: string;
  value: string;
  muted?: boolean;
  emphasize?: boolean;
}) {
  return (
    <div className="rounded-[18px] border border-[var(--panel-border)] bg-[#fcfffd] px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
        {label}
      </p>
      <p
        className={`mt-1 text-sm font-semibold ${
          emphasize
            ? "text-[#cf7395]"
            : muted
              ? "text-[var(--muted)]"
              : "text-[var(--foreground)]"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
