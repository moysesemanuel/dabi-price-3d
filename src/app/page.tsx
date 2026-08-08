import Link from "next/link";

const heroPortraits = [
  {
    name: "Maya",
    role: "Precificação",
    palette: "from-[#d8e4ff] via-[#f5f7ff] to-[#c8d2f7]",
    accent: "bg-[#4d5cff]",
    height: "h-[188px]",
  },
  {
    name: "Alicia",
    role: "Operações",
    palette: "from-[#ffe7d5] via-[#fff4ee] to-[#ffd0ab]",
    accent: "bg-[#ff6a00]",
    height: "h-[214px]",
  },
  {
    name: "Rina",
    role: "Marketplace",
    palette: "from-[#d9f3ef] via-[#f4fffd] to-[#bde5dd]",
    accent: "bg-[#1f8b83]",
    height: "h-[196px]",
  },
  {
    name: "Victor",
    role: "Fundador",
    palette: "from-[#e8ebf5] via-[#f8faff] to-[#d2d8ea]",
    accent: "bg-[#252847]",
    height: "h-[226px]",
  },
  {
    name: "Noah",
    role: "Análises",
    palette: "from-[#e8e2ff] via-[#faf8ff] to-[#cec2ff]",
    accent: "bg-[#6c56ff]",
    height: "h-[174px]",
  },
  {
    name: "Caio",
    role: "Produção",
    palette: "from-[#dff1ff] via-[#f4fbff] to-[#c5e2fb]",
    accent: "bg-[#0f87d8]",
    height: "h-[204px]",
  },
  {
    name: "Sara",
    role: "Financeiro",
    palette: "from-[#ffe8e0] via-[#fff5f0] to-[#ffd0bf]",
    accent: "bg-[#e45e2c]",
    height: "h-[184px]",
  },
  {
    name: "Lina",
    role: "Comercial",
    palette: "from-[#deebff] via-[#f7fbff] to-[#bed8f6]",
    accent: "bg-[#4f7cff]",
    height: "h-[210px]",
  },
];

const logoMarks = [
  "Mercado Livre",
  "Shopee",
  "ERP DaBi",
  "E-commerce 3D",
  "Venda Direta",
  "Consignado",
];

const capabilityGroups = [
  "Precificação 3D",
  "Venda por canal",
  "Histórico operacional",
  "Kits e múltiplas peças",
  "Pró-labore e lucro",
  "Regras de margem",
  "Produto artesanal",
  "Comparativo comercial",
  "Integrações futuras",
  "Publicação operacional",
  "Ajuda e suporte",
  "Governança de workspace",
];

const impactPoints = [
  "Custos protegidos antes do lucro",
  "Leitura automática de canal e pressão comercial",
  "Políticas de negócio reaplicáveis em novas simulações",
  "Status de viabilidade em vez de número solto na tela",
];

const impactStats = [
  { value: "4", label: "canais de venda na leitura comercial atual" },
  { value: "3", label: "sistemas do ecossistema DaBi em evolução conjunta" },
  { value: "1", label: "motor central de precificação para produto físico" },
  { value: "100%", label: "da formação de preço orientada por custo real" },
];

const touchpointCards = [
  { title: "Demonstração comercial", tone: "bg-[#fff2e4]" },
  { title: "Educação do cliente", tone: "bg-[#edf2ff]" },
  { title: "Publicação operacional", tone: "bg-[#eef8f2]" },
  { title: "Revisão sob demanda", tone: "bg-[#ece9ff]" },
];

const testimonialRatings = [
  "Suporte bem avaliado",
  "Fluxo confiável para equipes comerciais",
  "Leitura operacional clara",
  "Uso simples sob pressão",
];

const testimonials = [
  {
    quote:
      "Finalmente um sistema de precificação que mostra quando o canal está errado, em vez de fingir que todo produto precisa caber em qualquer marketplace.",
    author: "Carla M.",
    role: "Diretora de Operações Comerciais",
  },
  {
    quote:
      "A estrutura de custo é explícita o suficiente para que o time consiga defender preço sem discutir premissas escondidas toda semana.",
    author: "Miguel T.",
    role: "Líder de Planejamento Comercial",
  },
  {
    quote:
      "A melhor parte não é o número final. É o contexto de decisão sobre margem, proteção e pressão real do canal.",
    author: "Diana R.",
    role: "Fundadora, Studio Goods",
  },
];

const partnershipServices = [
  "Onboarding guiado para a operação",
  "Apoio no desenho das políticas de precificação",
  "Acompanhamento comercial dedicado",
  "Revisão operacional de canal, taxa e margem",
  "Suporte para rollout interno do workspace",
  "Playbooks de cenário para produto, marketplace e venda direta",
];

const partnerLogos = [
  "DaBi Tech 3D",
  "Sales System",
  "E-commerce 3D",
  "Mercado Livre",
  "Shopee",
];

const integrations = [
  "ERP DaBi",
  "Auditoria de workspace",
  "Dados de marketplace",
  "Publicação no site",
  "Custeio Mercado Livre",
  "Histórico de produto",
  "Camada de permissões",
  "Políticas de precificação",
];

const securityCards = [
  "Workspaces por papel",
  "Gestão de sessão",
  "Recuperação de senha",
  "Logs de auditoria",
  "Histórico operacional",
  "Rastreabilidade por canal",
  "Snapshots de política",
  "Roteamento de suporte",
  "Visibilidade de erro",
  "Propriedade do workspace",
  "Separação de ambiente",
  "Preparação para SSO",
];

const footerGroups = [
  {
    title: "Plataforma",
    links: ["Precificadora", "Histórico", "Preferências", "Conta"],
  },
  {
    title: "Casos de uso",
    links: ["Impressão 3D", "Produto artesanal", "Marketplace", "Venda direta"],
  },
  {
    title: "Recursos",
    links: ["Solicitar demo", "Contato", "Ajuda", "Roadmap"],
  },
  {
    title: "Empresa",
    links: ["Sobre", "Privacidade", "Termos", "Suporte"],
  },
];

export default function LandingPage() {
  return (
    <main className="min-h-screen overflow-x-hidden bg-[#f6f3ff] text-[#22144f]">
      <section className="border-b border-[#dfdbf0] bg-[linear-gradient(180deg,#ffffff_0%,#f6f3ff_100%)]">
        <div className="mx-auto max-w-[1180px] px-4 pb-14 pt-6 sm:px-6 lg:px-8">
          <header className="flex flex-wrap items-center justify-between gap-4">
            <Link
              href="/"
              className="text-xl font-semibold tracking-[-0.06em] text-[#22144f]"
            >
              Dabi<span className="text-[#ff6a00]"> Price</span>
            </Link>

            <nav className="hidden items-center gap-7 text-sm text-[#625688] md:flex">
              <a href="#platform" className="transition hover:text-[#22144f]">
                Plataforma
              </a>
              <a href="#partnership" className="transition hover:text-[#22144f]">
                Parceria
              </a>
              <a href="#integrations" className="transition hover:text-[#22144f]">
                Integrações
              </a>
            </nav>

            <div className="flex items-center gap-2">
              <Link
                href="/login"
                className="rounded-full border border-[#d9d1f3] bg-white px-4 py-2 text-sm font-medium text-[#22144f] transition hover:border-[#6c56ff] hover:text-[#6c56ff]"
              >
                Entrar
              </Link>
              <Link
                href="/contato"
                className="rounded-full bg-[#2f2367] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#22144f]"
              >
                Solicitar demo
              </Link>
            </div>
          </header>

          <div className="mx-auto max-w-[780px] pt-12 text-center">
            <p className="font-mono text-[11px] uppercase tracking-[0.32em] text-[#6c56ff]">
              Por que Dabi Price?
            </p>
            <h1 className="mx-auto mt-4 max-w-[700px] text-4xl font-semibold leading-[0.96] tracking-[-0.08em] text-[#22144f] sm:text-6xl">
              Crie experiências de precificação que geram decisões comerciais mais inteligentes.
            </h1>
            <p className="mx-auto mt-5 max-w-[640px] text-sm leading-7 text-[#625688] sm:text-base">
              A Dabi Price ajuda equipes de produto e operação a precificar
              bens físicos com custo real, leitura clara de pressão por canal e
              política comercial reaproveitável em toda a rotina.
            </p>

            <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/contato"
                className="rounded-full bg-[#2f2367] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#22144f]"
              >
                Solicitar demo
              </Link>
              <Link
                href="/app/precificacao"
                className="rounded-full border border-[#d9d1f3] bg-white px-5 py-2.5 text-sm font-semibold text-[#22144f] transition hover:border-[#6c56ff] hover:text-[#6c56ff]"
              >
                Abrir produto
              </Link>
            </div>
          </div>

          <div className="mx-auto mt-10 grid max-w-[860px] grid-cols-2 gap-4 sm:grid-cols-4">
            {heroPortraits.map((portrait) => (
              <PortraitCard key={portrait.name} portrait={portrait} />
            ))}
          </div>

          <div className="mt-10 grid grid-cols-2 gap-x-5 gap-y-4 border-t border-[#e5e0f4] pt-8 text-center text-[11px] font-semibold uppercase tracking-[0.24em] text-[#5f5680] sm:grid-cols-3 lg:grid-cols-6">
            {logoMarks.map((mark) => (
              <span key={mark}>{mark}</span>
            ))}
          </div>
        </div>
      </section>

      <section
        id="platform"
        className="border-b border-[#e3dff1] bg-[linear-gradient(180deg,#f7f5ff_0%,#f4f0ff_100%)]"
      >
        <div className="mx-auto max-w-[1180px] px-4 py-16 sm:px-6 lg:px-8">
          <div className="grid gap-4 lg:grid-cols-[340px_minmax(0,1fr)] lg:items-end">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-[#6c56ff]">
                Solução central
              </p>
              <h2 className="mt-3 max-w-[280px] text-3xl font-semibold leading-tight tracking-[-0.06em] text-[#22144f] sm:text-4xl">
                Uma plataforma para toda a experiência de precificação.
              </h2>
            </div>

            <p className="max-w-[620px] text-sm leading-7 text-[#625688]">
              A Dabi Price reúne estratégia de preço, simulação por canal e
              reaproveitamento operacional em um workspace conectado para times
              de produto, comercial e operação.
            </p>
          </div>

          <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {capabilityGroups.map((item) => (
              <CapabilityTile key={item} label={item} />
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-[#e3dff1] bg-white">
        <div className="mx-auto max-w-[1180px] px-4 py-16 sm:px-6 lg:px-8">
          <div className="grid gap-10 lg:grid-cols-[380px_minmax(0,1fr)] lg:items-center">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-[#6c56ff]">
                Impacto comercial
              </p>
              <h2 className="mt-3 text-3xl font-semibold leading-tight tracking-[-0.06em] text-[#22144f] sm:text-4xl">
                Direcionamento prático para operações mais fortes e impacto mensurável.
              </h2>
              <p className="mt-4 text-sm leading-7 text-[#625688]">
                Transforme a precificação em um sistema operacional comercial,
                em vez de uma conta solta espalhada entre anotações, planilhas e
                tentativa e erro.
              </p>

              <div className="mt-6 grid gap-3">
                {impactPoints.map((point) => (
                  <div
                    key={point}
                    className="flex items-start gap-3 rounded-2xl border border-[#ebe7f8] bg-[#faf8ff] px-4 py-3"
                  >
                    <span className="mt-1 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-[#6c56ff] text-[10px] font-bold text-white">
                      +
                    </span>
                    <p className="text-sm leading-7 text-[#4f4673]">{point}</p>
                  </div>
                ))}
              </div>
            </div>

            <DashboardShowcase />
          </div>

          <div className="mt-12 grid gap-6 border-t border-[#ece7fa] pt-8 sm:grid-cols-2 lg:grid-cols-4">
            {impactStats.map((stat) => (
              <div key={stat.label}>
                <p className="text-3xl font-semibold tracking-[-0.05em] text-[#22144f]">
                  {stat.value}
                </p>
                <p className="mt-2 text-xs leading-6 uppercase tracking-[0.2em] text-[#7e73a4]">
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-[#e3dff1] bg-[linear-gradient(180deg,#ffffff_0%,#faf8ff_100%)]">
        <div className="mx-auto max-w-[1180px] px-4 py-16 sm:px-6 lg:px-8">
          <div className="max-w-[640px]">
              <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-[#6c56ff]">
                Feito para o fluxo real
              </p>
              <h2 className="mt-3 text-3xl font-semibold leading-tight tracking-[-0.06em] text-[#22144f] sm:text-4xl">
                Estruture cada ponto do processo com experiências pensadas para decisão.
              </h2>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {touchpointCards.map((card, index) => (
              <MiniProductCard key={card.title} title={card.title} tone={card.tone} index={index} />
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-[#e3dff1] bg-[#f5f1ff]">
        <div className="mx-auto max-w-[1180px] px-4 py-16 sm:px-6 lg:px-8">
          <div className="max-w-[640px]">
              <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-[#6c56ff]">
                Camada de personalização
              </p>
              <h2 className="mt-3 text-3xl font-semibold leading-tight tracking-[-0.06em] text-[#22144f] sm:text-4xl">
                Use personalização para gerar conversão e leitura mais aderente ao negócio.
              </h2>
          </div>

          <div className="mt-10 grid gap-4 lg:grid-cols-2">
            <SoftPanel
              title="Personalização"
              description="Monte experiências de precificação baseadas em cenário, produto, canal e contexto comercial."
              variant="light"
            />
            <SoftPanel
              title="Coleta progressiva"
              description="Reúna as premissas certas aos poucos, sem transformar o fluxo em uma parede de campos."
              variant="dark"
            />
          </div>
        </div>
      </section>

      <section className="border-b border-[#141035] bg-[#140f33] text-white">
        <div className="mx-auto max-w-[1180px] px-4 py-16 sm:px-6 lg:px-8">
          <div className="max-w-[760px]">
              <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-[#8e84ff]">
                Camada de inteligência
              </p>
              <h2 className="mt-3 text-3xl font-semibold leading-tight tracking-[-0.06em] sm:text-4xl">
                Gere insights e desdobramentos com base na inteligência de precificação.
              </h2>
          </div>

          <div className="mt-10 grid gap-5 lg:grid-cols-2">
            <DarkFeatureCard
              title="Insights e automação"
              bullets={[
                "Destacar pressão de custo causada pelo comportamento do canal",
                "Sinalizar configurações de margem arriscadas",
                "Sugerir próximos passos depois da análise de viabilidade",
                "Priorizar produtos pela qualidade de contribuição",
              ]}
            />
            <DarkFeatureCard
              title="Desdobramento de conteúdo"
              bullets={[
                "Gerar resumos de decisões de precificação",
                "Criar playbooks internos a partir de cenários recorrentes",
                "Produzir briefings por canal de venda",
                "Transformar revisões em orientação reutilizável",
              ]}
            />
          </div>
        </div>
      </section>

      <section className="border-b border-[#e3dff1] bg-white">
        <div className="mx-auto max-w-[1180px] px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-[760px] text-center">
              <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-[#6c56ff]">
                Satisfação do cliente
              </p>
              <h2 className="mt-3 text-3xl font-semibold leading-tight tracking-[-0.06em] text-[#22144f] sm:text-4xl">
                Aprovada por operadores, gestores comerciais e quem vive a rotina do produto.
              </h2>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {testimonialRatings.map((item, index) => (
              <RatingCard key={item} label={item} score={`${4.8 + index / 10}`.slice(0, 3)} />
            ))}
          </div>

          <div className="mt-10 grid gap-4 lg:grid-cols-3">
            {testimonials.map((item) => (
              <TestimonialCard
                key={item.quote}
                quote={item.quote}
                author={item.author}
                role={item.role}
              />
            ))}
          </div>
        </div>
      </section>

      <section
        id="partnership"
        className="border-b border-[#e3dff1] bg-[linear-gradient(180deg,#f9f7ff_0%,#ffffff_100%)]"
      >
        <div className="mx-auto max-w-[1180px] px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-[760px] text-center">
              <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-[#6c56ff]">
                Nível de parceria
              </p>
              <h2 className="mt-3 text-3xl font-semibold leading-tight tracking-[-0.06em] text-[#22144f] sm:text-4xl">
                A prova aparece na parceria operacional.
              </h2>
          </div>

          <div className="mt-10 grid gap-6 lg:grid-cols-[minmax(0,1fr)_440px] lg:items-center">
            <div className="rounded-[30px] border border-[#e5def7] bg-white p-6 shadow-[0_18px_48px_rgba(0,0,0,0.04)]">
              <p className="text-sm leading-7 text-[#625688]">
                Sustentar um programa de precificação forte exige mais do que
                software. A Dabi Price pode evoluir como camada de operação e
                parceria para gerar decisões comerciais mais consistentes.
              </p>

              <div className="mt-6 grid gap-3">
                {partnershipServices.map((item) => (
                  <div key={item} className="flex items-start gap-3">
                    <span className="mt-1 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-[#ece8ff] text-[10px] font-bold text-[#6c56ff]">
                      ✓
                    </span>
                    <p className="text-sm leading-7 text-[#4f4673]">{item}</p>
                  </div>
                ))}
              </div>
            </div>

            <PartnershipMock />
          </div>

          <div className="mt-10 grid gap-4 border-t border-[#ece7fa] pt-8 sm:grid-cols-2 lg:grid-cols-5">
            {partnerLogos.map((logo) => (
              <div key={logo}>
                <p className="text-lg font-semibold tracking-[-0.04em] text-[#22144f]">
                  {logo}
                </p>
                <p className="mt-1 text-xs leading-6 uppercase tracking-[0.18em] text-[#7e73a4]">
                  Ecossistema ativo →
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section
        id="integrations"
        className="border-b border-[#e3dff1] bg-[linear-gradient(180deg,#ffffff_0%,#faf8ff_100%)]"
      >
        <div className="mx-auto max-w-[1180px] px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-[760px] text-center">
              <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-[#6c56ff]">
                Integrações
              </p>
              <h2 className="mt-3 text-3xl font-semibold leading-tight tracking-[-0.06em] text-[#22144f] sm:text-4xl">
                Integrações que acompanham a operação.
              </h2>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {integrations.map((item, index) => (
              <IntegrationCard key={item} label={item} index={index} />
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-[#ddd7ef] bg-[#f3f0ff]">
        <div className="mx-auto max-w-[1180px] px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-[760px] text-center">
              <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-[#6c56ff]">
                Segurança e governança
              </p>
              <h2 className="mt-3 text-3xl font-semibold leading-tight tracking-[-0.06em] text-[#22144f] sm:text-4xl">
                Infraestrutura, controle e proteção pensados para crescer como SaaS.
              </h2>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {securityCards.map((item, index) => (
              <SecurityCard key={item} label={item} index={index} />
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-[#1c1646] bg-[#19133d] text-white">
        <div className="mx-auto max-w-[1180px] px-4 py-12 sm:px-6 lg:px-8">
          <div className="rounded-[28px] border border-white/10 bg-white/5 px-6 py-8 text-center">
            <p className="mx-auto max-w-[860px] text-lg leading-8 text-white/88">
              “O melhor é quando a plataforma mostra que o problema não está na
              conta, mas no canal ou no formato da oferta. Isso muda a decisão.”
            </p>
            <div className="mt-5">
              <p className="text-sm font-semibold">Cecília Souza</p>
              <p className="mt-1 text-xs uppercase tracking-[0.22em] text-white/52">
                Diretora de Estratégia Comercial
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#140f33] text-white">
        <div className="mx-auto max-w-[1180px] px-4 py-12 sm:px-6 lg:px-8">
          <div className="rounded-[32px] bg-[#7f73ff] px-6 py-8 shadow-[0_24px_80px_rgba(0,0,0,0.22)] sm:px-8">
            <div className="flex flex-wrap items-end justify-between gap-6">
              <div className="max-w-[620px]">
              <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-white/70">
                Próximo passo
              </p>
              <h2 className="mt-3 text-3xl font-semibold leading-tight tracking-[-0.06em]">
                Leve sua precificação para um nível mais claro, profissional e reutilizável.
              </h2>
              <p className="mt-3 text-sm leading-7 text-white/82">
                Solicite uma demonstração para ver como a Dabi Price ajuda sua
                operação a sair do improviso e entrar em uma rotina comercial
                estruturada.
              </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Link
                  href="/contato"
                  className="rounded-full bg-[#22144f] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#170f37]"
                >
                  Solicitar demo
                </Link>
                <Link
                  href="/app/precificacao"
                  className="rounded-full border border-white/26 bg-white px-5 py-3 text-sm font-semibold text-[#22144f] transition hover:bg-[#f6f3ff]"
                >
                  Abrir workspace
                </Link>
              </div>
            </div>
          </div>

          <footer className="mt-10 grid gap-10 border-t border-white/10 pt-10 lg:grid-cols-[280px_repeat(4,minmax(0,1fr))]">
            <div>
              <p className="text-2xl font-semibold tracking-[-0.06em]">
                Dabi<span className="text-[#ffb07a]"> Price</span>
              </p>
              <p className="mt-4 max-w-[220px] text-sm leading-7 text-white/72">
                Software de precificação comercial para produtos físicos e
                decisões de canal mais inteligentes.
              </p>
              <div className="mt-5 flex gap-2">
                {["A", "B", "C", "D"].map((item) => (
                  <span
                    key={item}
                    className="inline-flex size-9 items-center justify-center rounded-full border border-white/12 bg-white/6 text-xs font-semibold"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>

            {footerGroups.map((group) => (
              <div key={group.title}>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/50">
                  {group.title}
                </p>
                <div className="mt-4 grid gap-3 text-sm text-white/72">
                  {group.links.map((item) => (
                    <span key={item}>{item}</span>
                  ))}
                </div>
              </div>
            ))}
          </footer>
        </div>
      </section>
    </main>
  );
}

function PortraitCard({
  portrait,
}: {
  portrait: {
    name: string;
    role: string;
    palette: string;
    accent: string;
    height: string;
  };
}) {
  return (
    <div
      className={`${portrait.height} relative overflow-hidden rounded-[22px] border border-[#dfdbf0] bg-gradient-to-br ${portrait.palette} shadow-[0_16px_36px_rgba(34,20,79,0.12)]`}
    >
      <div className="absolute inset-x-4 top-4 flex items-center justify-between">
        <span className={`${portrait.accent} rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white`}>
          {portrait.role}
        </span>
        <span className="rounded-full bg-white/80 px-2 py-1 text-[10px] font-semibold text-[#22144f]">
          Online
        </span>
      </div>
      <div className="absolute bottom-0 left-0 right-0 h-[74%]">
        <div className="absolute bottom-0 left-[16%] h-[74%] w-[40%] rounded-t-[70px] bg-[#f7d4b7]/90" />
        <div className="absolute bottom-[37%] left-[22%] size-[72px] rounded-full bg-[#3d2e28]" />
        <div className="absolute bottom-[20%] left-[48%] h-[26%] w-[35%] rounded-[22px] bg-white/72" />
        <div className="absolute bottom-0 left-0 right-0 h-[20%] bg-white/30 backdrop-blur-sm" />
      </div>
      <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between rounded-2xl bg-white/78 px-3 py-2 backdrop-blur">
        <div>
          <p className="text-sm font-semibold text-[#22144f]">{portrait.name}</p>
          <p className="text-[11px] uppercase tracking-[0.18em] text-[#625688]">
            Workspace ativo
          </p>
        </div>
        <span className="rounded-full bg-[#ece8ff] px-2 py-1 text-[10px] font-semibold text-[#6c56ff]">
          Pronto
        </span>
      </div>
    </div>
  );
}

function CapabilityTile({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-[#e3dff1] bg-white px-4 py-3 shadow-[0_8px_20px_rgba(34,20,79,0.04)]">
      <span className="text-sm font-medium text-[#413665]">{label}</span>
      <span className="inline-flex size-6 items-center justify-center rounded-full bg-[#ece8ff] text-xs font-bold text-[#6c56ff]">
        +
      </span>
    </div>
  );
}

function DashboardShowcase() {
  return (
    <div className="grid gap-4 rounded-[30px] border border-[#e8e3f6] bg-[#fbf9ff] p-5 shadow-[0_18px_48px_rgba(34,20,79,0.08)] lg:grid-cols-[minmax(0,1fr)_220px]">
      <div className="rounded-[24px] border border-[#ebe7f8] bg-white p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#7e73a4]">
              Saúde do preço
            </p>
            <p className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[#22144f]">
              R$ 48,70
            </p>
          </div>
          <div className="rounded-full bg-[#f0ecff] px-3 py-1 text-xs font-semibold text-[#6c56ff]">
            Saudável
          </div>
        </div>
        <div className="mt-5 grid gap-3">
          <div className="h-24 rounded-[22px] bg-[linear-gradient(180deg,#f4f1ff_0%,#ece8ff_100%)] p-4">
            <div className="flex items-end gap-2">
              {[36, 58, 44, 76, 68, 94].map((height, index) => (
                <span
                  key={height}
                  className={`inline-block w-full rounded-t-xl ${
                    index === 5 ? "bg-[#ff6a00]" : "bg-[#6c56ff]"
                  }`}
                  style={{ height }}
                />
              ))}
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl bg-[#faf8ff] px-4 py-3">
              <p className="text-xs uppercase tracking-[0.18em] text-[#8a81aa]">
                Preço de mercado
              </p>
              <p className="mt-2 text-lg font-semibold text-[#22144f]">R$ 32,99</p>
            </div>
            <div className="rounded-2xl bg-[#fff3ea] px-4 py-3">
              <p className="text-xs uppercase tracking-[0.18em] text-[#c26c1d]">
                Alerta do canal
              </p>
              <p className="mt-2 text-lg font-semibold text-[#9a3f00]">Pressão de frete</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4">
        <div className="rounded-[24px] border border-[#ebe7f8] bg-white p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-[#8a81aa]">
            Margem agora
          </p>
          <p className="mt-2 text-3xl font-semibold tracking-[-0.05em] text-[#22144f]">
            27.4%
          </p>
        </div>
        <div className="rounded-[24px] border border-[#ebe7f8] bg-[#23184b] p-4 text-white">
          <p className="text-xs uppercase tracking-[0.18em] text-white/50">
            Status do cenário
          </p>
          <p className="mt-2 text-lg font-semibold">Bom, abaixo da meta</p>
          <p className="mt-3 text-sm leading-7 text-white/68">
            O preço vende, mas ainda existe distância até a margem mais saudável.
          </p>
        </div>
      </div>
    </div>
  );
}

function MiniProductCard({
  title,
  tone,
  index,
}: {
  title: string;
  tone: string;
  index: number;
}) {
  return (
    <div className={`rounded-[26px] border border-[#e6e1f4] p-4 shadow-[0_12px_28px_rgba(34,20,79,0.05)] ${tone}`}>
      <div className="rounded-[18px] border border-white/70 bg-white p-3 shadow-[0_8px_18px_rgba(34,20,79,0.06)]">
        <div className="flex items-center justify-between">
          <span className="rounded-full bg-[#ece8ff] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#6c56ff]">
            Visão {index + 1}
          </span>
          <span className="text-xs font-medium text-[#7d739c]">Prévia</span>
        </div>
        <div className="mt-4 h-28 rounded-[16px] bg-[linear-gradient(180deg,#ffffff_0%,#f0ebff_100%)] p-3">
          <div className="grid gap-2">
            <div className="h-3 w-24 rounded-full bg-[#22144f]/12" />
            <div className="h-3 w-16 rounded-full bg-[#6c56ff]/18" />
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <div className="h-14 rounded-xl bg-[#fff5ee]" />
              <div className="h-14 rounded-xl bg-[#eef2ff]" />
            </div>
          </div>
        </div>
      </div>
      <p className="mt-4 text-sm font-semibold text-[#22144f]">{title}</p>
    </div>
  );
}

function SoftPanel({
  title,
  description,
  variant,
}: {
  title: string;
  description: string;
  variant: "light" | "dark";
}) {
  const isDark = variant === "dark";

  return (
    <div
      className={`rounded-[30px] border p-6 ${
        isDark
          ? "border-[#d9d0ff] bg-[linear-gradient(135deg,#4a3cb2_0%,#2f2367_100%)] text-white"
          : "border-[#dfd7ff] bg-[linear-gradient(135deg,#f0ecff_0%,#e4deff_100%)] text-[#22144f]"
      }`}
    >
      <p className={`font-mono text-[11px] uppercase tracking-[0.24em] ${isDark ? "text-white/58" : "text-[#6c56ff]"}`}>
        {title}
      </p>
      <p className={`mt-3 max-w-[420px] text-sm leading-7 ${isDark ? "text-white/80" : "text-[#544a75]"}`}>
        {description}
      </p>

      <div className={`mt-6 rounded-[24px] border p-4 ${isDark ? "border-white/12 bg-white/6" : "border-white/70 bg-white/72"}`}>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className={`rounded-2xl p-4 ${isDark ? "bg-[#140f33]" : "bg-[#f8f6ff]"}`}>
            <p className={`text-xs uppercase tracking-[0.18em] ${isDark ? "text-white/48" : "text-[#7f75a6]"}`}>
              Fluxo
            </p>
            <p className="mt-2 text-sm font-semibold">Workspace personalizado</p>
          </div>
          <div className={`rounded-2xl p-4 ${isDark ? "bg-[#140f33]" : "bg-[#f8f6ff]"}`}>
            <p className={`text-xs uppercase tracking-[0.18em] ${isDark ? "text-white/48" : "text-[#7f75a6]"}`}>
              Resultado
            </p>
            <p className="mt-2 text-sm font-semibold">Maior clareza de conversão</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function DarkFeatureCard({
  title,
  bullets,
}: {
  title: string;
  bullets: string[];
}) {
  return (
    <div className="rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,#1b1544_0%,#0f0b28_100%)] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.22)]">
      <div className="rounded-[22px] border border-white/8 bg-white/5 p-4">
        <div className="grid gap-2">
          <div className="h-3 w-20 rounded-full bg-white/18" />
          <div className="h-3 w-28 rounded-full bg-[#8e84ff]/55" />
          <div className="mt-2 grid gap-2">
            <div className="h-9 rounded-xl bg-white/8" />
            <div className="h-9 rounded-xl bg-white/8" />
            <div className="h-9 rounded-xl bg-white/8" />
          </div>
        </div>
      </div>
      <h3 className="mt-5 text-2xl font-semibold tracking-[-0.04em]">{title}</h3>
      <div className="mt-5 grid gap-3">
        {bullets.map((item) => (
          <div key={item} className="flex items-start gap-3">
            <span className="mt-1 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-white/10 text-[10px] font-bold text-white">
              +
            </span>
            <p className="text-sm leading-7 text-white/72">{item}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function RatingCard({
  label,
  score,
}: {
  label: string;
  score: string;
}) {
  return (
    <div className="rounded-[24px] border border-[#ebe7f8] bg-[#faf8ff] px-4 py-5 text-center">
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#7e73a4]">
        {label}
      </p>
      <p className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-[#ff6a00]">
        {score}
      </p>
      <p className="mt-2 text-xs uppercase tracking-[0.22em] text-[#6c56ff]">
        ★★★★★
      </p>
    </div>
  );
}

function TestimonialCard({
  quote,
  author,
  role,
}: {
  quote: string;
  author: string;
  role: string;
}) {
  return (
    <div className="rounded-[28px] border border-[#ebe7f8] bg-white p-6 shadow-[0_14px_40px_rgba(34,20,79,0.05)]">
      <p className="text-sm leading-7 text-[#4f4673]">“{quote}”</p>
      <div className="mt-5 border-t border-[#f0ecfa] pt-4">
        <p className="text-sm font-semibold text-[#22144f]">{author}</p>
        <p className="mt-1 text-xs uppercase tracking-[0.18em] text-[#7e73a4]">
          {role}
        </p>
      </div>
    </div>
  );
}

function PartnershipMock() {
  return (
    <div className="rounded-[30px] border border-[#ebe7f8] bg-white p-4 shadow-[0_18px_48px_rgba(34,20,79,0.06)]">
      <div className="h-[360px] overflow-hidden rounded-[24px] bg-[linear-gradient(180deg,#fff6f0_0%,#f5f1ff_100%)]">
        <div className="absolute hidden" />
        <div className="relative flex h-full items-end justify-end p-6">
          <div className="absolute left-6 top-6 w-[58%] rounded-[20px] bg-white/88 p-4 shadow-[0_14px_28px_rgba(34,20,79,0.08)]">
            <div className="h-3 w-24 rounded-full bg-[#22144f]/10" />
            <div className="mt-2 h-3 w-16 rounded-full bg-[#6c56ff]/18" />
            <div className="mt-4 grid gap-2">
              <div className="h-11 rounded-xl bg-[#f4f1ff]" />
              <div className="h-11 rounded-xl bg-[#f9f5ee]" />
            </div>
          </div>
          <div className="absolute bottom-0 right-6 h-[75%] w-[58%] rounded-t-[120px] bg-[#eed7c1]" />
          <div className="absolute bottom-[42%] right-[24%] size-[96px] rounded-full bg-[#4a352d]" />
          <div className="absolute bottom-[16%] right-[8%] h-[32%] w-[44%] rounded-[28px] bg-white/80" />
        </div>
      </div>
    </div>
  );
}

function IntegrationCard({
  label,
  index,
}: {
  label: string;
  index: number;
}) {
  const colors = [
    "bg-[#e7f3ff] text-[#0f87d8]",
    "bg-[#efe8ff] text-[#6c56ff]",
    "bg-[#ffe7e7] text-[#db4949]",
    "bg-[#fff0de] text-[#ff7d1f]",
  ];

  return (
    <div className="rounded-[24px] border border-[#ebe7f8] bg-white px-4 py-5 text-center shadow-[0_10px_26px_rgba(34,20,79,0.04)]">
      <span
        className={`mx-auto inline-flex size-11 items-center justify-center rounded-2xl text-sm font-semibold ${
          colors[index % colors.length]
        }`}
      >
        {label.slice(0, 2).toUpperCase()}
      </span>
      <p className="mt-4 text-sm font-semibold text-[#22144f]">{label}</p>
      <p className="mt-2 text-xs leading-6 text-[#7e73a4]">
        Camada operacional conectada
      </p>
    </div>
  );
}

function SecurityCard({
  label,
  index,
}: {
  label: string;
  index: number;
}) {
  const palette = [
    "bg-[#e8f3ff] text-[#0f87d8]",
    "bg-[#f0ecff] text-[#6c56ff]",
    "bg-[#ecfff1] text-[#1f8b4c]",
    "bg-[#fff2e7] text-[#ff6a00]",
  ];

  return (
    <div className="rounded-[24px] border border-[#e5def7] bg-white px-4 py-5 shadow-[0_10px_24px_rgba(34,20,79,0.04)]">
      <span
        className={`inline-flex rounded-2xl px-3 py-2 text-xs font-semibold ${
          palette[index % palette.length]
        }`}
      >
        Seguro
      </span>
      <p className="mt-4 text-sm font-semibold text-[#22144f]">{label}</p>
      <p className="mt-2 text-xs leading-6 text-[#7e73a4]">
        Placeholder visual para comunicar prontidão de operação SaaS.
      </p>
    </div>
  );
}
