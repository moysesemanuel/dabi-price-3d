import Image from "next/image";
import Link from "next/link";
import horizontalLogo from "@/app/dabi-price-horizontal.svg";
import whiteLogo from "@/app/logo-dabi-branco.svg";
import { workspacePlans } from "@/lib/settings/app-preferences";
import { segmentCards } from "@/lib/public/segment-landings";

const hiddenCostItems = [
  "Mão de obra",
  "Embalagem",
  "Energia",
  "Manutenção",
  "Impostos",
  "Taxas de marketplace",
  "Perdas",
  "Frete",
  "Despesas do negócio",
  "Reservas",
  "Comissões",
];

const resultCards = [
  { label: "Custo do produto", value: "R$ 24,80", tone: "bg-[#f6f1ff] text-[#3b2d73]" },
  { label: "Preço sugerido", value: "R$ 49,90", tone: "bg-[#eef8f3] text-[#20543f]" },
  { label: "Lucro por venda", value: "R$ 14,32", tone: "bg-[#fff3ea] text-[#a04f15]" },
  { label: "Margem", value: "28,7%", tone: "bg-[#eef4ff] text-[#1f4d9a]" },
];

const howItWorks = [
  {
    step: "1. Informe o produto",
    description:
      "Cadastre material, embalagem, mão de obra, tempo de produção e outros custos envolvidos.",
  },
  {
    step: "2. Escolha como você vende",
    description:
      "Venda direta, marketplace, kit, atacado ou outros cenários.",
  },
  {
    step: "3. Defina sua estratégia",
    description:
      "Escolha margem, lucro, reservas e regras comerciais.",
  },
  {
    step: "4. Veja o preço ideal",
    description:
      "O DaBi Price calcula custos, taxas, resultado esperado e mostra quanto você realmente ganha.",
  },
];

const practicalCaseRows = [
  { label: "Material", value: "R$ 8,20" },
  { label: "Embalagem", value: "R$ 1,50" },
  { label: "Mão de obra", value: "R$ 6,00" },
  { label: "Energia e produção", value: "R$ 1,20" },
  { label: "Taxas de venda", value: "R$ 6,78" },
  { label: "Despesas e reservas", value: "R$ 4,30" },
];

const benefitCards = [
  {
    title: "Saiba onde seu dinheiro está indo",
    description:
      "Visualize materiais, mão de obra, taxas, despesas e outros custos separadamente.",
  },
  {
    title: "Proteja sua margem",
    description:
      "Evite vender mais barato do que deveria simplesmente porque o concorrente cobra determinado valor.",
  },
  {
    title: "Simule antes de decidir",
    description:
      "Teste preços, custos, margens e diferentes cenários sem alterar sua operação.",
  },
  {
    title: "Organize suas precificações",
    description:
      "Mantenha seus produtos e cálculos registrados para consultar posteriormente.",
  },
  {
    title: "Adapte ao seu negócio",
    description:
      "Configure regras de acordo com a realidade da sua operação.",
  },
  {
    title: "Tome decisões com números",
    description:
      "Entenda quais produtos fazem sentido manter, ajustar ou deixar de vender.",
  },
];

const channelComparison = [
  {
    channel: "Venda direta",
    salePrice: "R$ 49,90",
    note: "Sem taxas de intermediário",
    profit: "R$ 18,20",
    accent: "border-[#dcebe4] bg-[#f7fcf9]",
  },
  {
    channel: "Mercado Livre",
    salePrice: "R$ 49,90",
    note: "Taxas maiores",
    profit: "R$ 8,70",
    accent: "border-[#f0dccf] bg-[#fff8f3]",
  },
  {
    channel: "Outro canal",
    salePrice: "R$ 49,90",
    note: "Comissão intermediária",
    profit: "R$ 13,40",
    accent: "border-[#e4def7] bg-[#faf8ff]",
  },
];

const beforeItems = [
  "Planilhas espalhadas",
  "Calculadora",
  "Anotações",
  "Fórmulas difíceis",
  "Custos esquecidos",
  "Preço baseado no concorrente",
  "Dificuldade para saber o lucro",
];

const afterItems = [
  "Custos centralizados",
  "Cálculo automático",
  "Histórico organizado",
  "Margem conhecida",
  "Lucro visível",
  "Simulações rápidas",
  "Decisões baseadas em números",
];

const trustCards = [
  {
    title: "Acesso protegido",
    description:
      "Sua conta e suas informações ficam protegidas por autenticação.",
  },
  {
    title: "Dados organizados",
    description:
      "Suas precificações ficam centralizadas em um único ambiente.",
  },
  {
    title: "Privacidade",
    description:
      "Suas informações comerciais não são utilizadas para competir com seu negócio.",
  },
  {
    title: "Pagamentos seguros",
    description:
      "A cobrança da assinatura é processada por uma plataforma de pagamento especializada.",
  },
];

const faqItems = [
  {
    question: "Preciso instalar o DaBi Price?",
    answer: "Não. O DaBi Price funciona diretamente pelo navegador.",
  },
  {
    question: "Funciona no celular?",
    answer:
      "Sim. Você pode acessar sua conta pelo navegador do celular, tablet ou computador.",
  },
  {
    question: "Preciso entender de contabilidade?",
    answer:
      "Não. O sistema foi pensado para transformar os cálculos de precificação em um processo mais simples.",
  },
  {
    question: "Posso comparar canais antes de vender?",
    answer:
      "Sim. O DaBi Price ajuda você a entender como taxas e regras comerciais afetam o lucro em cada canal.",
  },
  {
    question: "A assinatura pode ser cancelada?",
    answer:
      "Sim. O fluxo comercial foi pensado para assinatura recorrente com cancelamento quando fizer sentido para a operação.",
  },
];

const footerLinks = [
  { label: "Como funciona", href: "#como-funciona" },
  { label: "Planos", href: "#planos" },
  { label: "FAQ", href: "#faq" },
  { label: "Entrar", href: "/login" },
];

export default function LandingPage() {
  const starterPlan = workspacePlans.find((plan) => plan.id === "starter");
  const growthPlan = workspacePlans.find((plan) => plan.id === "growth");
  const scalePlan = workspacePlans.find((plan) => plan.id === "scale");

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#fffdf9] text-[#21352d]">
      <section className="border-b border-[#e6e1d4] bg-[radial-gradient(circle_at_top_left,rgba(255,213,181,0.32),transparent_28%),radial-gradient(circle_at_88%_14%,rgba(223,241,230,0.48),transparent_24%),linear-gradient(180deg,#fffefb_0%,#fff8f2_100%)]">
        <div className="mx-auto max-w-[1200px] px-4 pb-14 pt-6 sm:px-6 lg:px-8">
          <header className="flex flex-wrap items-center justify-between gap-4">
            <Link href="/" aria-label="DaBi Price" className="inline-flex">
              <Image
                src={horizontalLogo}
                alt="Dabi Price"
                width={176}
                height={42}
                unoptimized
                className="h-8 w-auto"
              />
            </Link>

            <nav className="hidden items-center gap-6 text-base text-[#42574d] lg:flex">
              <a href="#como-funciona" className="transition hover:text-[#21352d]">
                Como funciona
              </a>
              <a href="#recursos" className="transition hover:text-[#21352d]">
                Recursos
              </a>
              <a href="#para-quem-e" className="transition hover:text-[#21352d]">
                Para quem é
              </a>
              <a href="#planos" className="transition hover:text-[#21352d]">
                Planos
              </a>
              <a href="#faq" className="transition hover:text-[#21352d]">
                FAQ
              </a>
            </nav>

            <div className="flex items-center gap-2">
              <Link
                href="/login"
                className="rounded-full border border-[#d7e3dc] bg-white px-5 py-2.5 text-base font-medium text-[#21352d] transition hover:border-[#f06d2f] hover:text-[#a24b1c]"
              >
                Entrar
              </Link>
              <Link
                href="/planos"
                className="rounded-full bg-[#21352d] px-6 py-2.5 text-base font-semibold text-white transition hover:bg-[#17251f]"
              >
                Começar agora
              </Link>
            </div>
          </header>

          <div className="grid gap-10 pt-12 lg:grid-cols-[minmax(0,1.02fr)_minmax(380px,0.98fr)] lg:items-center">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.32em] text-[#b8511d]">
                Precificação com clareza
              </p>
              <h1 className="mt-4 max-w-[720px] text-6xl font-semibold leading-[0.9] tracking-[-0.07em] text-[#17261f] sm:text-[5.2rem]">
                Pare de colocar preço no chute.
              </h1>
              <p className="mt-6 max-w-[700px] text-xl leading-9 text-[#374b42]">
                Calcule o preço ideal dos seus produtos considerando custos,
                mão de obra, taxas, despesas, margem e lucro, tudo em um só
                lugar.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/planos"
                  className="inline-flex items-center justify-center rounded-full bg-[#21352d] px-7 py-3.5 text-lg font-semibold text-white transition hover:bg-[#17251f]"
                >
                  Começar agora
                </Link>
                <a
                  href="#como-funciona"
                  className="inline-flex items-center justify-center rounded-full border border-[#d7e3dc] bg-white px-7 py-3.5 text-lg font-semibold text-[#21352d] transition hover:border-[#21352d]"
                >
                  Ver como funciona
                </a>
              </div>

              <p className="mt-6 text-lg text-[#42574d]">
                Sem planilhas complicadas • Configure em poucos minutos •
                Cancele quando quiser
              </p>
            </div>

            <PricingEditorMock />
          </div>
        </div>
      </section>

      <section className="border-b border-[#ece6db] bg-white">
        <div className="mx-auto max-w-[1120px] px-4 py-16 sm:px-6 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1.06fr)_360px]">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-[#d16025]">
                Dor principal
              </p>
              <h2 className="mt-4 text-5xl font-semibold leading-[1.02] tracking-[-0.06em] text-[#17261f]">
                Você sabe quanto realmente ganha em cada produto que vende?
              </h2>
              <p className="mt-5 max-w-[760px] text-lg leading-9 text-[#42574d]">
                É fácil olhar para o preço de venda, descontar o material e
                achar que o restante é lucro. Mas no meio do caminho existem
                vários custos que diminuem o resultado real da operação.
              </p>
            </div>

            <div className="rounded-[30px] border border-[#e7e1d6] bg-[#fff9f3] p-6 shadow-[0_20px_48px_rgba(41,55,45,0.06)]">
              <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-[#9b7a64]">
                Custos escondidos
              </p>
              <div className="mt-4 grid gap-2">
                {hiddenCostItems.map((item) => (
                  <div
                    key={item}
                    className="rounded-2xl border border-[#efe6dc] bg-white px-4 py-3 text-sm text-[#476056]"
                  >
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-8 rounded-[28px] border border-[#f0d7c8] bg-[#fff2ea] px-6 py-5 text-center">
            <p className="text-xl font-semibold tracking-[-0.03em] text-[#9d4615]">
              Vender muito não significa lucrar muito.
            </p>
          </div>
        </div>
      </section>

      <section id="recursos" className="border-b border-[#ece6db] bg-[#fcfbf8]">
        <div className="mx-auto max-w-[1120px] px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-[760px] text-center">
            <p className="font-mono text-xs uppercase tracking-[0.28em] text-[#b8511d]">
              A solução
            </p>
            <h2 className="mt-4 text-5xl font-semibold leading-[1.02] tracking-[-0.06em] text-[#17261f]">
              O DaBi Price faz as contas por você.
            </h2>
            <p className="mt-5 text-lg leading-9 text-[#42574d]">
              Cadastre seus custos, escolha como você vende e veja exatamente
              quanto custa produzir, quanto precisa cobrar e quanto realmente
              sobra.
            </p>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {resultCards.map((card) => (
              <div
                key={card.label}
                className={`rounded-[28px] border border-white/70 p-6 shadow-[0_18px_40px_rgba(41,55,45,0.05)] ${card.tone}`}
              >
                <p className="font-mono text-[11px] uppercase tracking-[0.24em] opacity-70">
                  {card.label}
                </p>
                <p className="mt-4 text-3xl font-semibold tracking-[-0.05em]">
                  {card.value}
                </p>
              </div>
            ))}
          </div>

          <p className="mt-5 text-center text-sm text-[#7a8d83]">
            Exemplo ilustrativo.
          </p>
        </div>
      </section>

      <section id="como-funciona" className="border-b border-[#ece6db] bg-white">
        <div className="mx-auto max-w-[1120px] px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-[760px] text-center">
            <p className="font-mono text-xs uppercase tracking-[0.28em] text-[#b8511d]">
              Como funciona
            </p>
            <h2 className="mt-4 text-5xl font-semibold leading-[1.02] tracking-[-0.06em] text-[#17261f]">
              Precificar não precisa ser complicado.
            </h2>
          </div>

          <div className="mt-10 grid gap-4 lg:grid-cols-2">
            {howItWorks.map((item) => (
              <div
                key={item.step}
                className="rounded-[30px] border border-[#e7e1d6] bg-[#fffdf9] p-6 shadow-[0_18px_40px_rgba(41,55,45,0.04)]"
              >
                <p className="font-mono text-xs uppercase tracking-[0.24em] text-[#b8511d]">
                  {item.step}
                </p>
                <p className="mt-4 text-lg leading-9 text-[#42574d]">
                  {item.description}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-10 text-center">
            <Link
              href="/cadastro"
              className="inline-flex items-center justify-center rounded-full bg-[#21352d] px-7 py-3.5 text-base font-semibold text-white transition hover:bg-[#17251f]"
            >
              Criar minha primeira precificação
            </Link>
          </div>
        </div>
      </section>

      <section className="border-b border-[#ece6db] bg-[linear-gradient(180deg,#fffdfa_0%,#f7fbf8_100%)]">
        <div className="mx-auto max-w-[1120px] px-4 py-16 sm:px-6 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-center">
            <LargePricingShowcase />

            <div>
              <p className="font-mono text-xs uppercase tracking-[0.28em] text-[#b8511d]">
                Demonstração real
              </p>
              <h2 className="mt-4 text-5xl font-semibold tracking-[-0.06em] text-[#17261f]">
                Veja o resultado antes de colocar o produto à venda.
              </h2>
              <p className="mt-4 text-lg leading-9 text-[#42574d]">
                Você não recebe apenas um preço. Você entende de onde ele veio.
              </p>

              <div className="mt-6 grid gap-4">
                <DetailCard
                  title="Custos do produto"
                  description="Veja exatamente o que está consumindo sua margem."
                />
                <DetailCard
                  title="Preço recomendado"
                  description="Descubra quanto cobrar de acordo com sua estratégia."
                />
                <DetailCard
                  title="Lucro real"
                  description="Saiba quanto efetivamente sobra depois de todos os custos."
                />
                <DetailCard
                  title="Margem"
                  description="Compare cenários e encontre equilíbrio entre competitividade e rentabilidade."
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-[#ece6db] bg-white">
        <div className="mx-auto max-w-[1120px] px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-[760px] text-center">
            <p className="font-mono text-xs uppercase tracking-[0.28em] text-[#b8511d]">
              Caso prático
            </p>
            <h2 className="mt-4 text-5xl font-semibold tracking-[-0.06em] text-[#17261f]">
              R$ 39,90 parece um bom preço. Até você fazer todas as contas.
            </h2>
          </div>

          <div className="mt-10 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="rounded-[32px] border border-[#e7e1d6] bg-[#fffdf9] p-6 shadow-[0_18px_44px_rgba(41,55,45,0.05)]">
              <div className="flex items-end justify-between gap-4 border-b border-[#eee6db] pb-5">
                <div>
                  <p className="font-mono text-sm uppercase tracking-[0.24em] text-[#5c6e65]">
                    Produto vendido por
                  </p>
                  <p className="mt-3 text-5xl font-semibold tracking-[-0.06em] text-[#21352d]">
                    R$ 39,90
                  </p>
                </div>
                <span className="rounded-full bg-[#fff2ea] px-4 py-2 text-xs font-semibold text-[#b1561d]">
                  Exemplo ilustrativo
                </span>
              </div>

              <div className="mt-6 grid gap-3">
                {practicalCaseRows.map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center justify-between rounded-2xl border border-[#efe8dd] bg-white px-4 py-4 text-base"
                  >
                    <span className="text-[#42574d]">{item.label}</span>
                    <span className="font-semibold text-[#21352d]">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-4">
              <StatSummary
                label="Custo considerado"
                value="R$ 27,98"
                tone="bg-[#f6f1ff] text-[#3d2f77]"
              />
              <StatSummary
                label="Lucro"
                value="R$ 11,92"
                tone="bg-[#eef8f3] text-[#20543f]"
              />
              <StatSummary
                label="Margem"
                value="29,87%"
                tone="bg-[#fff3ea] text-[#a04f15]"
              />
              <div className="rounded-[28px] border border-[#f0dccf] bg-[#fff8f3] p-6">
                <p className="text-lg leading-9 text-[#5f4d42]">
                  Agora imagine descobrir isso antes de definir o preço de
                  todos os seus produtos.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-8 rounded-[30px] bg-[#21352d] px-6 py-8 text-center text-white">
            <p className="mx-auto max-w-[760px] text-xl font-semibold tracking-[-0.04em]">
              O DaBi Price transforma esse cálculo em um processo simples e
              repetível.
            </p>
            <Link
              href="/planos"
              className="mt-6 inline-flex items-center justify-center rounded-full bg-white px-7 py-3.5 text-base font-semibold text-[#21352d] transition hover:bg-[#f1f4f2]"
            >
              Quero precificar melhor
            </Link>
          </div>
        </div>
      </section>

      <section className="border-b border-[#ece6db] bg-[#fcfbf8]">
        <div className="mx-auto max-w-[1120px] px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-[760px] text-center">
            <p className="font-mono text-xs uppercase tracking-[0.28em] text-[#b8511d]">
              Benefícios
            </p>
            <h2 className="mt-4 text-5xl font-semibold tracking-[-0.06em] text-[#17261f]">
              Mais do que uma calculadora de preço.
            </h2>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {benefitCards.map((item) => (
              <InfoCard
                key={item.title}
                title={item.title}
                description={item.description}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-[#ece6db] bg-white">
        <div className="mx-auto max-w-[1120px] px-4 py-16 sm:px-6 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-[320px_minmax(0,1fr)]">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.28em] text-[#b8511d]">
                Marketplace
              </p>
              <h2 className="mt-4 text-5xl font-semibold tracking-[-0.06em] text-[#17261f]">
                Um produto pode ser lucrativo em um canal e dar prejuízo em outro.
              </h2>
              <p className="mt-4 text-lg leading-9 text-[#42574d]">
                Compare antes de publicar. O DaBi Price ajuda você a entender o
                impacto das taxas e regras comerciais de cada canal sobre seu
                resultado.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {channelComparison.map((item) => (
                <div
                  key={item.channel}
                  className={`rounded-[28px] border p-5 shadow-[0_18px_40px_rgba(41,55,45,0.05)] ${item.accent}`}
                >
                  <p className="font-mono text-xs uppercase tracking-[0.24em] text-[#5c6e65]">
                    {item.channel}
                  </p>
                  <p className="mt-4 text-3xl font-semibold tracking-[-0.05em] text-[#21352d]">
                    {item.salePrice}
                  </p>
                  <p className="mt-2 text-base text-[#42574d]">{item.note}</p>
                  <div className="mt-6 rounded-2xl bg-white/82 px-4 py-4">
                    <p className="text-sm uppercase tracking-[0.18em] text-[#5c6e65]">
                      Lucro
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-[#21352d]">
                      {item.profit}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="para-quem-e" className="border-b border-[#ece6db] bg-[#f8fbf9]">
        <div className="mx-auto max-w-[1120px] px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-[760px] text-center">
            <p className="font-mono text-xs uppercase tracking-[0.28em] text-[#b8511d]">
              Segmentos
            </p>
            <h2 className="mt-4 text-5xl font-semibold tracking-[-0.06em] text-[#17261f]">
              Feito para diferentes formas de produzir e vender.
            </h2>
            <p className="mt-5 text-lg leading-9 text-[#42574d]">
              A home explica o que é o DaBi Price. As páginas por segmento
              mostram como a mesma lógica resolve o problema específico de cada
              operação.
            </p>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {segmentCards.map((item) => (
              <SegmentCard
                key={item.href}
                title={item.title}
                description={item.description}
                href={item.href}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-[#ece6db] bg-white">
        <div className="mx-auto max-w-[1120px] px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-[760px] text-center">
            <p className="font-mono text-xs uppercase tracking-[0.28em] text-[#b8511d]">
              Antes x DaBi Price
            </p>
            <h2 className="mt-4 text-5xl font-semibold tracking-[-0.06em] text-[#17261f]">
              Precificar pode ser assim:
            </h2>
          </div>

          <div className="mt-10 grid gap-4 lg:grid-cols-2">
            <ComparisonPanel
              title="Sem DaBi Price"
              items={beforeItems}
              accent="border-[#f1ddd2] bg-[#fff7f2] text-[#7c5f52]"
            />
            <ComparisonPanel
              title="Com DaBi Price"
              items={afterItems}
              accent="border-[#d9ebe1] bg-[#f7fcf9] text-[#345647]"
            />
          </div>

          <div className="mt-8 text-center">
            <Link
              href="/planos"
              className="inline-flex items-center justify-center rounded-full bg-[#21352d] px-7 py-3.5 text-base font-semibold text-white transition hover:bg-[#17251f]"
            >
              Começar agora
            </Link>
          </div>
        </div>
      </section>

      <section className="border-b border-[#ece6db] bg-[#fcfbf8]">
        <div className="mx-auto max-w-[980px] px-4 py-16 text-center sm:px-6 lg:px-8">
          <p className="font-mono text-xs uppercase tracking-[0.28em] text-[#b8511d]">
            Por que o DaBi Price existe
          </p>
          <h2 className="mt-4 text-5xl font-semibold tracking-[-0.06em] text-[#17261f]">
            Criado a partir de um problema real.
          </h2>
          <p className="mx-auto mt-5 max-w-[760px] text-lg leading-9 text-[#42574d]">
            Quem produz e vende precisa tomar várias decisões de preço. O
            problema é que, com o crescimento do negócio, uma conta
            aparentemente simples começa a envolver matéria-prima, mão de obra,
            taxas, impostos, despesas, perdas e margem.
          </p>
          <p className="mx-auto mt-4 max-w-[760px] text-lg leading-9 text-[#42574d]">
            O DaBi Price nasceu para transformar essa conta em um processo mais
            simples, organizado e confiável.
          </p>
          <p className="mt-8 text-2xl font-semibold tracking-[-0.04em] text-[#21352d]">
            Menos improviso. Mais clareza sobre seus números.
          </p>
        </div>
      </section>

      <section className="border-b border-[#ece6db] bg-white">
        <div className="mx-auto max-w-[1120px] px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-[760px] text-center">
            <p className="font-mono text-xs uppercase tracking-[0.28em] text-[#b8511d]">
              Confiança
            </p>
            <h2 className="mt-4 text-5xl font-semibold tracking-[-0.06em] text-[#17261f]">
              Seus dados e seu negócio continuam sendo seus.
            </h2>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {trustCards.map((item) => (
              <InfoCard
                key={item.title}
                title={item.title}
                description={item.description}
              />
            ))}
          </div>
        </div>
      </section>

      <section id="planos" className="border-b border-[#ece6db] bg-[linear-gradient(180deg,#f8fbf9_0%,#fff9f4_100%)]">
        <div className="mx-auto max-w-[1120px] px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-[760px] text-center">
            <p className="font-mono text-xs uppercase tracking-[0.28em] text-[#b8511d]">
              Planos
            </p>
            <h2 className="mt-4 text-5xl font-semibold tracking-[-0.06em] text-[#17261f]">
              Um plano que se paga quando você começa a precificar melhor.
            </h2>
          </div>

          <div className="mt-10 grid gap-4 lg:grid-cols-3">
            <PlanCard
              eyebrow="Entrada"
              title={starterPlan?.label ?? "DaBi Essencial"}
              price={starterPlan?.monthlyPriceLabel ?? "R$ 49"}
              description="Para começar a organizar sua precificação com estrutura."
              items={[
                "Controle essencial de custos",
                "Histórico operacional inicial",
                "Leitura básica da viabilidade",
              ]}
              href="/cadastro?plan=starter"
              cta="Começar agora"
            />
            <PlanCard
              eyebrow="Mais escolhido"
              title={growthPlan?.label ?? "DaBi Pro"}
              price={growthPlan?.monthlyPriceLabel ?? "R$ 149"}
              description="Para quem vende regularmente e precisa proteger margem."
              items={[
                "Precificação completa",
                "Comparação de canais",
                "Histórico ampliado",
                "Recursos avançados e suporte prioritário",
              ]}
              href="/cadastro?plan=growth"
              cta="Assinar Pro"
              highlighted
            />
            <PlanCard
              eyebrow="Consultivo"
              title={scalePlan?.label ?? "DaBi Equipe"}
              price={scalePlan?.monthlyPriceLabel ?? "Sob consulta"}
              description="Para operações com time, volume e necessidade de desenho comercial."
              items={[
                "Mais usuários e histórico",
                "Acompanhamento consultivo",
                "Prioridade máxima em suporte e evolução",
              ]}
              href="/contato?plan=scale&origin=site"
              cta="Falar com consultor"
            />
          </div>

          <p className="mt-5 text-center text-base text-[#4f6259]">
            Economize tempo, preserve margem e leve o visitante direto para o
            fluxo comercial certo.
          </p>
        </div>
      </section>

      <section className="border-b border-[#ece6db] bg-white">
        <div className="mx-auto max-w-[980px] px-4 py-16 text-center sm:px-6 lg:px-8">
          <p className="font-mono text-xs uppercase tracking-[0.28em] text-[#b8511d]">
            Demonstração de ROI
          </p>
          <h2 className="mt-4 text-5xl font-semibold tracking-[-0.06em] text-[#17261f]">
            Quanto custa precificar errado?
          </h2>

          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            <RoiCard sales="100 vendas" value="R$ 400" />
            <RoiCard sales="500 vendas" value="R$ 2.000" />
            <RoiCard sales="1.000 vendas" value="R$ 4.000" />
          </div>

          <p className="mt-6 text-lg leading-9 text-[#42574d]">
            Exemplo hipotético para demonstrar impacto de custos não
            considerados.
          </p>
          <p className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-[#21352d]">
            Uma pequena diferença no preço pode pagar vários meses do DaBi Price.
          </p>
        </div>
      </section>

      <section id="faq" className="border-b border-[#ece6db] bg-[#fcfbf8]">
        <div className="mx-auto max-w-[1120px] px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-[760px] text-center">
            <p className="font-mono text-xs uppercase tracking-[0.28em] text-[#b8511d]">
              FAQ
            </p>
            <h2 className="mt-4 text-5xl font-semibold tracking-[-0.06em] text-[#17261f]">
              Ficou com alguma dúvida?
            </h2>
          </div>

          <div className="mt-10 grid gap-4 lg:grid-cols-2">
            {faqItems.map((item) => (
              <div
                key={item.question}
                className="rounded-[30px] border border-[#e7e1d6] bg-white p-6 shadow-[0_18px_40px_rgba(41,55,45,0.04)]"
              >
                <h3 className="text-xl font-semibold tracking-[-0.03em] text-[#21352d]">
                  {item.question}
                </h3>
                <p className="mt-4 text-lg leading-9 text-[#42574d]">
                  {item.answer}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#1a2b24] text-white">
        <div className="mx-auto max-w-[1200px] px-4 py-12 sm:px-6 lg:px-8">
          <div className="rounded-[34px] bg-[linear-gradient(135deg,#d16025,#f38a42)] px-6 py-10 shadow-[0_26px_80px_rgba(0,0,0,0.22)] sm:px-8">
            <div className="flex flex-wrap items-end justify-between gap-6">
              <div className="max-w-[620px]">
                <p className="font-mono text-xs uppercase tracking-[0.28em] text-white/90">
                  Próximo passo
                </p>
                <h2 className="mt-4 text-4xl font-semibold tracking-[-0.06em]">
                  Pare de precificar no improviso.
                </h2>
                <p className="mt-4 text-lg leading-9 text-white">
                  Comece agora pelo plano certo e leve sua precificação para uma
                  rotina mais clara, profissional e repetível.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Link
                  href="/planos"
                  className="rounded-full bg-[#1a2b24] px-7 py-3.5 text-base font-semibold text-white transition hover:bg-[#111c17]"
                >
                  Começar agora
                </Link>
                <Link
                  href="/login"
                  className="rounded-full border border-white/30 bg-white px-7 py-3.5 text-base font-semibold text-[#1a2b24] transition hover:bg-[#f7f4f0]"
                >
                  Entrar
                </Link>
              </div>
            </div>
          </div>

          <footer className="mt-10 grid gap-10 border-t border-white/10 pt-10 lg:grid-cols-[280px_minmax(0,1fr)]">
            <div>
              <Image
                src={whiteLogo}
                alt="Dabi Price"
                width={84}
                height={84}
                unoptimized
                className="h-14 w-auto"
              />
              <p className="mt-4 max-w-[240px] text-base leading-8 text-white/88">
                Precificação mais clara para quem produz, vende e precisa
                proteger a margem com números reais.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {footerLinks.map((item) =>
                item.href.startsWith("/") ? (
                  <Link
                    key={item.label}
                    href={item.href}
                    className="text-base text-white/88 transition hover:text-white"
                  >
                    {item.label}
                  </Link>
                ) : (
                  <a
                    key={item.label}
                    href={item.href}
                    className="text-base text-white/88 transition hover:text-white"
                  >
                    {item.label}
                  </a>
                ),
              )}
            </div>
          </footer>
        </div>
      </section>
    </main>
  );
}

function PricingEditorMock() {
  return (
    <div className="rounded-[34px] border border-[#e5ded1] bg-white p-4 shadow-[0_28px_80px_rgba(33,53,45,0.12)] sm:p-5">
      <div className="rounded-[28px] border border-[#ece6db] bg-[#fffdf9] p-5">
        <div className="flex items-center justify-between gap-3 border-b border-[#efe8dc] pb-4">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-[#84968d]">
              Editor de precificação
            </p>
            <p className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[#21352d]">
              Caneca 3D personalizada
            </p>
          </div>
          <span className="rounded-full bg-[#eef8f3] px-3 py-2 text-xs font-semibold text-[#20543f]">
            Resultado saudável
          </span>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_220px]">
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <MetricTile label="Custo total" value="R$ 24,80" note="Material + produção" />
              <MetricTile label="Preço sugerido" value="R$ 49,90" note="Meta de margem aplicada" />
              <MetricTile label="Margem" value="28,7%" note="Resultado atual" />
              <MetricTile label="Lucro" value="R$ 14,32" note="Por unidade vendida" />
            </div>

            <div className="rounded-[24px] border border-[#ece6db] bg-white p-4">
              <div className="flex items-center justify-between">
                <p className="text-base font-semibold text-[#21352d]">
                  Distribuição do custo
                </p>
                <span className="text-sm uppercase tracking-[0.18em] text-[#5c6e65]">
                  Canal Mercado Livre
                </span>
              </div>
              <div className="mt-4 space-y-3">
                <CostBar label="Material e insumos" value="R$ 11,30" width="w-[78%]" color="bg-[#21352d]" />
                <CostBar label="Mão de obra" value="R$ 6,00" width="w-[56%]" color="bg-[#d16025]" />
                <CostBar label="Taxas do canal" value="R$ 4,18" width="w-[42%]" color="bg-[#4e7d69]" />
                <CostBar label="Despesas e reservas" value="R$ 3,32" width="w-[34%]" color="bg-[#8aa99a]" />
              </div>
            </div>
          </div>

          <div className="grid gap-4">
            <div className="rounded-[24px] border border-[#ece6db] bg-[#21352d] p-4 text-white">
              <p className="text-sm uppercase tracking-[0.18em] text-white/84">
                Canal de venda
              </p>
              <p className="mt-2 text-xl font-semibold">Marketplace</p>
              <p className="mt-3 text-base leading-8 text-white/88">
                Taxas e regras comerciais consideradas no cálculo final.
              </p>
            </div>
            <div className="rounded-[24px] border border-[#ece6db] bg-[#fff8f3] p-4">
              <p className="text-sm uppercase tracking-[0.18em] text-[#8a5b38]">
                Alerta atual
              </p>
              <p className="mt-2 text-xl font-semibold text-[#7f3f15]">
                Ainda existe pressão de taxa
              </p>
              <p className="mt-3 text-base leading-8 text-[#634a38]">
                O sistema mostra quando o canal aperta a margem antes da
                publicação.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function LargePricingShowcase() {
  return (
    <div className="rounded-[34px] border border-[#e5ded1] bg-white p-5 shadow-[0_24px_72px_rgba(33,53,45,0.09)]">
      <div className="rounded-[30px] border border-[#ece6db] bg-[#fffdf9] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#efe8dc] pb-4">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.24em] text-[#5c6e65]">
              Resultado da precificação
            </p>
            <p className="mt-2 text-3xl font-semibold tracking-[-0.05em] text-[#21352d]">
              Resumo antes de vender
            </p>
          </div>
          <Link
            href="/planos"
            className="rounded-full border border-[#dce8e2] bg-white px-5 py-2.5 text-base font-semibold text-[#21352d] transition hover:border-[#21352d]"
          >
            Ver planos
          </Link>
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_250px]">
          <div className="rounded-[24px] border border-[#ece6db] bg-white p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <MetricTile label="Preço recomendado" value="R$ 49,90" note="Meta comercial aplicada" />
              <MetricTile label="Lucro real" value="R$ 14,32" note="Após todos os custos" />
              <MetricTile label="Margem" value="28,7%" note="Equilíbrio saudável" />
              <MetricTile label="Canal" value="Marketplace" note="Taxas consideradas" />
            </div>

            <div className="mt-5 rounded-[24px] bg-[#f8fbf9] p-4">
              <p className="text-base font-semibold text-[#21352d]">
                Composição detalhada
              </p>
              <div className="mt-4 space-y-3">
                <CostBar label="Custos do produto" value="R$ 18,80" width="w-[72%]" color="bg-[#21352d]" />
                <CostBar label="Taxas do canal" value="R$ 4,18" width="w-[38%]" color="bg-[#d16025]" />
                <CostBar label="Despesas e reservas" value="R$ 1,82" width="w-[24%]" color="bg-[#4e7d69]" />
                <CostBar label="Lucro esperado" value="R$ 14,32" width="w-[52%]" color="bg-[#8aa99a]" />
              </div>
            </div>
          </div>

          <div className="grid gap-4">
            <div className="rounded-[24px] border border-[#ece6db] bg-[#f6f1ff] p-4">
              <p className="text-sm uppercase tracking-[0.18em] text-[#5d4f82]">
                Custos sob controle
              </p>
              <p className="mt-2 text-xl font-semibold text-[#3d2f77]">
                Nada fica invisível
              </p>
              <p className="mt-3 text-base leading-8 text-[#4f4370]">
                Você entende o peso de cada bloco no resultado final.
              </p>
            </div>
            <div className="rounded-[24px] border border-[#ece6db] bg-[#eef8f3] p-4">
              <p className="text-sm uppercase tracking-[0.18em] text-[#2e5946]">
                Decisão mais clara
              </p>
              <p className="mt-2 text-xl font-semibold text-[#20543f]">
                Preço recomendado com contexto
              </p>
              <p className="mt-3 text-base leading-8 text-[#365848]">
                O valor deixa de ser chute e vira política operacional.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-[24px] border border-[#e7e1d6] bg-white px-5 py-5 shadow-[0_12px_26px_rgba(41,55,45,0.04)]">
      <p className="text-xl font-semibold tracking-[-0.03em] text-[#17261f]">
        {title}
      </p>
      <p className="mt-3 text-base leading-8 text-[#42574d]">{description}</p>
    </div>
  );
}

function InfoCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-[30px] border border-[#e7e1d6] bg-white p-6 shadow-[0_18px_40px_rgba(41,55,45,0.05)]">
      <p className="text-[1.65rem] font-semibold tracking-[-0.03em] text-[#17261f]">
        {title}
      </p>
      <p className="mt-4 text-lg leading-9 text-[#42574d]">{description}</p>
    </div>
  );
}

function SegmentCard({
  title,
  description,
  href,
}: {
  title: string;
  description: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-[30px] border border-[#dfe7e1] bg-white p-6 shadow-[0_18px_40px_rgba(41,55,45,0.05)] transition hover:-translate-y-0.5 hover:border-[#21352d]"
    >
      <p className="font-mono text-xs uppercase tracking-[0.24em] text-[#b8511d]">
        Página específica
      </p>
      <p className="mt-4 text-[1.65rem] font-semibold tracking-[-0.03em] text-[#17261f]">
        {title}
      </p>
      <p className="mt-4 text-lg leading-9 text-[#42574d]">{description}</p>
      <span className="mt-6 inline-flex items-center gap-2 text-base font-semibold text-[#21352d]">
        Ver página do segmento
        <span className="transition group-hover:translate-x-1">→</span>
      </span>
    </Link>
  );
}

function ComparisonPanel({
  title,
  items,
  accent,
}: {
  title: string;
  items: string[];
  accent: string;
}) {
  return (
    <div className={`rounded-[32px] border p-6 shadow-[0_18px_40px_rgba(41,55,45,0.05)] ${accent}`}>
      <p className="text-[1.9rem] font-semibold tracking-[-0.04em]">{title}</p>
      <div className="mt-6 grid gap-3">
        {items.map((item) => (
          <div
            key={item}
            className="rounded-2xl border border-white/70 bg-white/80 px-4 py-3.5 text-base"
          >
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}

function PlanCard({
  eyebrow,
  title,
  price,
  description,
  items,
  href,
  cta,
  highlighted = false,
}: {
  eyebrow: string;
  title: string;
  price: string;
  description: string;
  items: string[];
  href: string;
  cta: string;
  highlighted?: boolean;
}) {
  return (
    <div
      className={`rounded-[34px] border p-6 shadow-[0_20px_48px_rgba(41,55,45,0.06)] ${
        highlighted
          ? "border-[#f0d7c8] bg-[#fff7f1]"
          : "border-[#e7e1d6] bg-white"
      }`}
    >
      <p className="font-mono text-xs uppercase tracking-[0.24em] text-[#b8511d]">
        {eyebrow}
      </p>
      <h3 className="mt-4 text-[2.15rem] font-semibold tracking-[-0.05em] text-[#17261f]">
        {title}
      </h3>
      <p className="mt-4 text-lg leading-9 text-[#42574d]">{description}</p>
      <p className="mt-5 text-4xl font-semibold tracking-[-0.06em] text-[#21352d]">
        {price}
      </p>
      <div className="mt-6 grid gap-3">
        {items.map((item) => (
          <div key={item} className="flex items-start gap-3">
            <span className="mt-1 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-[#eef8f3] text-[10px] font-bold text-[#20543f]">
              ✓
            </span>
            <p className="text-base leading-8 text-[#42574d]">{item}</p>
          </div>
        ))}
      </div>
      <Link
        href={href}
        className={`mt-8 inline-flex w-full items-center justify-center rounded-full px-5 py-3.5 text-base font-semibold transition ${
          highlighted
            ? "bg-[#21352d] text-white hover:bg-[#17251f]"
            : "border border-[#d7e3dc] bg-white text-[#21352d] hover:border-[#21352d]"
        }`}
      >
        {cta}
      </Link>
    </div>
  );
}

function RoiCard({
  sales,
  value,
}: {
  sales: string;
  value: string;
}) {
  return (
    <div className="rounded-[30px] border border-[#e7e1d6] bg-white p-6 shadow-[0_18px_40px_rgba(41,55,45,0.04)]">
      <p className="font-mono text-xs uppercase tracking-[0.24em] text-[#60736a]">
        {sales}
      </p>
      <p className="mt-4 text-4xl font-semibold tracking-[-0.06em] text-[#21352d]">
        {value}
      </p>
      <p className="mt-3 text-base text-[#42574d]">
        potencialmente deixados para trás na precificação
      </p>
    </div>
  );
}

function StatSummary({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: string;
}) {
  return (
    <div className={`rounded-[30px] p-6 ${tone}`}>
      <p className="font-mono text-[11px] uppercase tracking-[0.24em] opacity-70">
        {label}
      </p>
      <p className="mt-4 text-4xl font-semibold tracking-[-0.05em]">{value}</p>
    </div>
  );
}

function MetricTile({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className="rounded-[22px] border border-[#ece6db] bg-[#fffdf9] px-4 py-4">
      <p className="text-sm uppercase tracking-[0.16em] text-[#5f7269]">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[#21352d]">
        {value}
      </p>
      <p className="mt-2 text-base text-[#465950]">{note}</p>
    </div>
  );
}

function CostBar({
  label,
  value,
  width,
  color,
}: {
  label: string;
  value: string;
  width: string;
  color: string;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3 text-base">
        <span className="text-[#42574d]">{label}</span>
        <span className="font-semibold text-[#21352d]">{value}</span>
      </div>
      <div className="h-3 rounded-full bg-[#eef2ef]">
        <div className={`h-3 rounded-full ${width} ${color}`} />
      </div>
    </div>
  );
}
