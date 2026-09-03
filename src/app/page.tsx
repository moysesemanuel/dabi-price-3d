import Link from "next/link";
import {
  LandingHeader,
  LandingWordmark,
} from "@/components/public/landing-header";
import { LandingPlanCards } from "@/components/public/landing-plan-cards";
import { segmentCards } from "@/lib/public/segment-landings";

const costBreakdown = [
  { label: "Material", value: "8,20", width: "29%", tone: "muted" },
  { label: "Mão de obra", value: "6,00", width: "21%", tone: "muted" },
  { label: "Taxas de venda", value: "6,78", width: "24%", tone: "gold" },
  { label: "Despesas e reservas", value: "4,30", width: "15%", tone: "action" },
  { label: "Embalagem", value: "1,50", width: "5%", tone: "muted" },
  { label: "Energia e produção", value: "1,20", width: "4%", tone: "muted" },
] as const;

const howItWorks = [
  {
    step: "01",
    title: "Informe o produto",
    description:
      "Material, embalagem, mão de obra, tempo de produção e os demais custos envolvidos.",
  },
  {
    step: "02",
    title: "Escolha como você vende",
    description:
      "Venda direta, marketplace, kit, atacado ou consignado — cada canal com suas regras.",
  },
  {
    step: "03",
    title: "Defina sua estratégia",
    description: "Margem, lucro, reservas e as regras comerciais do seu negócio.",
  },
  {
    step: "04",
    title: "Veja o preço ideal",
    description:
      "O cálculo mostra custos, taxas, resultado esperado e quanto você realmente ganha.",
  },
];

const resultRows = [
  { label: "Custo do produto", value: "R$ 24,80", tone: "ink" },
  { label: "Preço sugerido", value: "R$ 49,90", tone: "ink" },
  { label: "Lucro por venda", value: "R$ 14,32", tone: "profit" },
  { label: "Margem", value: "28,7%", tone: "profit" },
] as const;

const heroCostRows = [
  { label: "Material e insumos", value: "11,30", width: "78%", tone: "muted" },
  { label: "Mão de obra", value: "6,00", width: "56%", tone: "gold" },
  { label: "Taxas do canal", value: "4,18", width: "42%", tone: "action" },
  { label: "Despesas e reservas", value: "3,32", width: "34%", tone: "muted" },
] as const;

const channelComparison = [
  {
    channel: "Venda direta",
    salePrice: "R$ 49,90",
    note: "Sem taxas de intermediário",
    profit: "R$ 18,20",
    best: true,
  },
  {
    channel: "Mercado Livre",
    salePrice: "R$ 49,90",
    note: "Taxas maiores",
    profit: "R$ 8,70",
    best: false,
  },
  {
    channel: "Outro canal",
    salePrice: "R$ 49,90",
    note: "Comissão intermediária",
    profit: "R$ 13,40",
    best: false,
  },
];

const benefitCards = [
  {
    title: "Saiba onde seu dinheiro está indo",
    description:
      "Materiais, mão de obra, taxas e despesas aparecem separados, com o peso de cada um.",
  },
  {
    title: "Proteja sua margem",
    description:
      "Pare de vender mais barato do que deveria só porque o concorrente cobra determinado valor.",
  },
  {
    title: "Simule antes de decidir",
    description:
      "Teste preços, custos, margens e cenários diferentes sem alterar sua operação.",
  },
  {
    title: "Organize suas precificações",
    description:
      "Produtos e cálculos ficam registrados para consultar e revisar depois.",
  },
  {
    title: "Adapte ao seu negócio",
    description:
      "Configure as regras de acordo com a realidade da sua operação, não de um modelo genérico.",
  },
  {
    title: "Decida com números",
    description:
      "Entenda quais produtos vale manter, ajustar ou deixar de vender.",
  },
];

const beforeItems = [
  "Planilhas espalhadas",
  "Calculadora e anotações",
  "Fórmulas difíceis de manter",
  "Custos esquecidos",
  "Preço copiado do concorrente",
  "Lucro incerto",
];

const afterItems = [
  "Custos centralizados",
  "Cálculo automático",
  "Histórico organizado",
  "Margem conhecida",
  "Lucro visível por canal",
  "Decisão baseada em número",
];

const trustCards = [
  {
    title: "Acesso protegido",
    description: "Sua conta e suas informações ficam protegidas por autenticação.",
  },
  {
    title: "Dados organizados",
    description: "Suas precificações ficam centralizadas em um único ambiente.",
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

const roiCards = [
  { sales: "100 vendas", value: "R$ 400" },
  { sales: "500 vendas", value: "R$ 2.000" },
  { sales: "1.000 vendas", value: "R$ 4.000" },
];

const faqItems = [
  {
    question: "Preciso instalar o DaBi Price?",
    answer: "Não. O DaBi Price funciona diretamente pelo navegador.",
  },
  {
    question: "Funciona no celular?",
    answer:
      "Sim. Você acessa sua conta pelo navegador do celular, tablet ou computador.",
  },
  {
    question: "Preciso entender de contabilidade?",
    answer:
      "Não. O sistema foi pensado para transformar os cálculos de precificação em um processo mais simples.",
  },
  {
    question: "Posso comparar canais antes de vender?",
    answer:
      "Sim. Você entende como as taxas e regras comerciais de cada canal afetam o lucro.",
  },
  {
    question: "A assinatura pode ser cancelada?",
    answer:
      "Sim. A assinatura é recorrente e pode ser cancelada quando fizer sentido para a operação.",
  },
];

const footerLinks = [
  { label: "Como funciona", href: "#como-funciona" },
  { label: "Segmentos", href: "#segmentos" },
  { label: "Planos", href: "#planos" },
  { label: "FAQ", href: "#faq" },
  { label: "Entrar", href: "/login" },
  { label: "Criar conta", href: "/cadastro" },
];

const barTone: Record<string, string> = {
  muted: "var(--landing-muted-soft)",
  gold: "var(--landing-gold)",
  action: "var(--landing-action)",
  profit: "var(--landing-profit)",
};

export default function LandingPage() {
  return (
    <main className="landing-root min-h-screen overflow-x-hidden">
      <LandingHeader />

      {/* ---------- herói ---------- */}
      <section className="landing-hero">
        <div className="landing-shell">
          <div className="landing-hero__grid">
            <div className="flex flex-col gap-7">
              <span className="landing-eyebrow">Precificação com clareza</span>

              <h1 className="landing-display">
                Pare de colocar preço{" "}
                <span className="landing-turn">no chute</span>.
              </h1>

              <p
                className="landing-lede"
                style={{ maxWidth: "46ch", fontSize: "1.0625rem" }}
              >
                Calcule o preço dos seus produtos considerando custos, mão de
                obra, taxas, despesas, margem e lucro — e veja quanto realmente
                sobra em cada canal de venda.
              </p>

              <div className="flex flex-wrap gap-3">
                <Link href="/planos" className="landing-cta">
                  Começar agora
                </Link>
                <a href="#como-funciona" className="landing-cta landing-cta--ghost">
                  Ver como funciona
                </a>
              </div>

              <p className="landing-note">
                Sem planilhas complicadas · Configure em poucos minutos ·
                Cancele quando quiser
              </p>
            </div>

            <div className="landing-hero__bleed">
              <PricingPanel />
            </div>
          </div>
        </div>
      </section>

      {/* ---------- o problema ---------- */}
      <section className="landing-section landing-section--alt">
        <div className="landing-shell landing-split">
          <div className="flex flex-col gap-5">
            <span className="landing-eyebrow">O problema</span>
            <h2 className="landing-h2">R$ 39,90 parece um bom preço.</h2>
            <p className="landing-lede">
              Até você somar tudo o que sai do caminho antes de o dinheiro
              chegar. É fácil descontar o material e achar que o resto é lucro.
            </p>

            <div
              className="mt-3 flex flex-col gap-1 pt-6"
              style={{ borderTop: "1px solid var(--landing-line)" }}
            >
              <span
                className="landing-num"
                style={{
                  fontSize: 11,
                  letterSpacing: "0.22em",
                  textTransform: "uppercase",
                  color: "var(--landing-muted-soft)",
                }}
              >
                Sobra de verdade
              </span>
              <span
                style={{
                  fontFamily: "var(--font-display-ui)",
                  fontSize: "clamp(2.75rem, 5vw, 4rem)",
                  lineHeight: 1,
                  color: "var(--landing-profit)",
                }}
              >
                R$ 11,92
              </span>
              <span className="landing-note">
                29,87% de margem — não os 79% que a conta de cabeça sugere.
              </span>
            </div>
          </div>

          <div className="landing-rail">
            <div
              className="landing-rail__head flex items-baseline justify-between gap-4 px-6 py-5 sm:px-7"
              style={{ borderBottom: "1px solid var(--landing-line)" }}
            >
              <span className="text-[15px] font-semibold">
                O que come os R$ 39,90
              </span>
              <span
                className="landing-num"
                style={{
                  fontSize: 11,
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  color: "var(--landing-muted-soft)",
                }}
              >
                Exemplo ilustrativo
              </span>
            </div>

            {costBreakdown.map((row) => (
              <div key={row.label} className="landing-row">
                <span
                  className="text-sm"
                  style={{ color: "var(--landing-ink-soft)" }}
                >
                  {row.label}
                </span>
                <span className="landing-bar">
                  <span
                    style={{ width: row.width, background: barTone[row.tone] }}
                  />
                </span>
                <span
                  className="landing-num text-right text-sm"
                  style={{
                    color:
                      row.tone === "gold"
                        ? "var(--landing-gold)"
                        : "var(--landing-ink-soft)",
                  }}
                >
                  {row.value}
                </span>
              </div>
            ))}

            <div
              className="landing-rail__foot landing-row"
              style={{ borderTop: "1px solid var(--landing-gold-soft)" }}
            >
              <span className="text-sm font-semibold">Sobra</span>
              <span className="landing-bar">
                <span
                  style={{ width: "30%", background: "var(--landing-profit)" }}
                />
              </span>
              <span
                className="landing-num text-right text-[15px] font-semibold"
                style={{ color: "var(--landing-profit)" }}
              >
                11,92
              </span>
            </div>
          </div>
        </div>

        <div className="landing-shell mt-14">
          <div
            className="landing-card landing-card--gold flex flex-wrap items-center justify-between gap-8"
            style={{ padding: "34px clamp(24px, 3vw, 40px)" }}
          >
            <div className="flex flex-col gap-2">
              <span className="landing-h3">
                Descubra isso <span className="landing-turn">antes</span> de
                definir o preço.
              </span>
              <span className="landing-note">Não depois de cem vendas.</span>
            </div>
            <Link href="/planos" className="landing-cta">
              Começar agora
            </Link>
          </div>
        </div>
      </section>

      {/* ---------- como funciona ---------- */}
      <section id="como-funciona" className="landing-section">
        <div className="landing-shell flex flex-col gap-12">
          <div className="flex flex-col gap-5" style={{ maxWidth: "62ch" }}>
            <span className="landing-eyebrow">Como funciona</span>
            <h2 className="landing-h2">Precificar não precisa ser complicado.</h2>
            <p className="landing-lede">
              Quatro passos, uma vez. Depois disso, cada produto novo entra na
              mesma régua.
            </p>
          </div>

          <div className="landing-grid landing-grid--4">
            {howItWorks.map((item) => (
              <div key={item.step} className="landing-card flex flex-col gap-4">
                <span
                  className="landing-num"
                  style={{
                    fontSize: 11,
                    letterSpacing: "0.26em",
                    color: "var(--landing-gold)",
                  }}
                >
                  {item.step}
                </span>
                <span className="text-lg font-semibold tracking-[-0.01em]">
                  {item.title}
                </span>
                <p className="landing-note">{item.description}</p>
              </div>
            ))}
          </div>

          <div>
            <Link href="/cadastro" className="landing-cta">
              Criar minha primeira precificação
            </Link>
          </div>
        </div>
      </section>

      {/* ---------- demonstração ---------- */}
      <section className="landing-section landing-section--alt">
        <div className="landing-shell landing-split landing-split--wide-first">
          <div className="landing-rail">
            <div
              className="landing-rail__head flex flex-wrap items-baseline justify-between gap-3 px-6 py-5 sm:px-7"
              style={{ borderBottom: "1px solid var(--landing-line)" }}
            >
              <span className="text-[15px] font-semibold">
                Resumo antes de vender
              </span>
              <span
                className="landing-num"
                style={{
                  fontSize: 11,
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  color: "var(--landing-muted-soft)",
                }}
              >
                Canal · Marketplace
              </span>
            </div>

            {resultRows.map((row) => (
              <div
                key={row.label}
                className="flex items-baseline justify-between gap-4 px-6 py-5 sm:px-7"
                style={{ borderBottom: "1px solid var(--landing-line)" }}
              >
                <span
                  className="text-sm"
                  style={{ color: "var(--landing-ink-soft)" }}
                >
                  {row.label}
                </span>
                <span
                  className="landing-num text-xl font-semibold"
                  style={{
                    color:
                      row.tone === "profit"
                        ? "var(--landing-profit)"
                        : "var(--landing-ink)",
                  }}
                >
                  {row.value}
                </span>
              </div>
            ))}

            <div className="px-6 py-6 sm:px-7">
              <span
                className="landing-num"
                style={{
                  fontSize: 11,
                  letterSpacing: "0.22em",
                  textTransform: "uppercase",
                  color: "var(--landing-muted-soft)",
                }}
              >
                Composição do custo
              </span>
              <div className="mt-4 flex flex-col gap-4">
                {heroCostRows.map((row) => (
                  <div key={row.label} className="flex flex-col gap-2">
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <span style={{ color: "var(--landing-ink-soft)" }}>
                        {row.label}
                      </span>
                      <span className="landing-num font-semibold">
                        R$ {row.value}
                      </span>
                    </div>
                    <span className="landing-bar">
                      <span
                        style={{
                          width: row.width,
                          background: barTone[row.tone],
                        }}
                      />
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-5">
            <span className="landing-eyebrow">Demonstração</span>
            <h2 className="landing-h2">
              Você não recebe só um preço. Você entende{" "}
              <span className="landing-turn">de onde ele veio</span>.
            </h2>
            <p className="landing-lede">
              Cada bloco do resultado é rastreável: custo do produto, taxas do
              canal, despesas, reservas e o lucro que sobra no fim.
            </p>
            <p className="landing-note">Exemplo ilustrativo.</p>
          </div>
        </div>
      </section>

      {/* ---------- canais ---------- */}
      <section className="landing-section">
        <div className="landing-shell landing-split">
          <div className="flex flex-col gap-5">
            <span className="landing-eyebrow">Canais</span>
            <h2 className="landing-h2">
              O mesmo produto pode dar lucro em um canal e prejuízo em outro.
            </h2>
            <p className="landing-lede">
              Compare antes de publicar. As taxas e regras comerciais de cada
              canal entram no cálculo.
            </p>
          </div>

          <div className="landing-grid landing-grid--3">
            {channelComparison.map((item) => (
              <div
                key={item.channel}
                className={`landing-card flex flex-col gap-4 ${
                  item.best ? "landing-card--gold" : ""
                }`}
              >
                <span
                  className="landing-num"
                  style={{
                    fontSize: 11,
                    letterSpacing: "0.22em",
                    textTransform: "uppercase",
                    color: item.best
                      ? "var(--landing-gold)"
                      : "var(--landing-muted-soft)",
                  }}
                >
                  {item.channel}
                </span>
                <span className="landing-num text-2xl font-semibold">
                  {item.salePrice}
                </span>
                <p className="landing-note">{item.note}</p>
                <div
                  className="mt-2 flex items-baseline justify-between gap-3 pt-4"
                  style={{ borderTop: "1px solid var(--landing-line)" }}
                >
                  <span
                    className="text-sm"
                    style={{ color: "var(--landing-muted)" }}
                  >
                    Lucro
                  </span>
                  <span
                    className="landing-num text-xl font-semibold"
                    style={{ color: "var(--landing-profit)" }}
                  >
                    {item.profit}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- segmentos ---------- */}
      <section id="segmentos" className="landing-section landing-section--alt">
        <div className="landing-shell flex flex-col gap-12">
          <div className="flex flex-col gap-5" style={{ maxWidth: "62ch" }}>
            <span className="landing-eyebrow">Segmentos</span>
            <h2 className="landing-h2">
              Feito para diferentes formas de produzir e vender.
            </h2>
            <p className="landing-lede">
              A mesma lógica de cálculo, ajustada ao que cada operação precisa
              considerar.
            </p>
          </div>

          <div className="landing-grid landing-grid--4">
            {segmentCards.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="landing-card flex flex-col gap-4 transition"
                style={{ textDecoration: "none" }}
              >
                <span
                  className="landing-num"
                  style={{
                    fontSize: 11,
                    letterSpacing: "0.22em",
                    textTransform: "uppercase",
                    color: "var(--landing-gold)",
                  }}
                >
                  Página do segmento
                </span>
                <span className="landing-h3">{item.title}</span>
                <p className="landing-note">{item.description}</p>
                <span
                  className="mt-auto pt-2 text-sm font-semibold"
                  style={{ color: "var(--landing-action)" }}
                >
                  Ver página →
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- benefícios ---------- */}
      <section className="landing-section">
        <div className="landing-shell flex flex-col gap-12">
          <div className="flex flex-col gap-5" style={{ maxWidth: "62ch" }}>
            <span className="landing-eyebrow">Benefícios</span>
            <h2 className="landing-h2">Mais do que uma calculadora de preço.</h2>
          </div>

          <div className="landing-grid landing-grid--3">
            {benefitCards.map((item) => (
              <div key={item.title} className="landing-card flex flex-col gap-3">
                <span className="landing-h3">{item.title}</span>
                <p className="landing-note">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- antes x depois ---------- */}
      <section className="landing-section landing-section--alt">
        <div className="landing-shell flex flex-col gap-12">
          <div className="flex flex-col gap-5" style={{ maxWidth: "62ch" }}>
            <span className="landing-eyebrow">Antes e depois</span>
            <h2 className="landing-h2">Precificar pode ser assim:</h2>
          </div>

          <div className="landing-grid landing-grid--2">
            <ComparisonPanel title="Sem DaBi Price" items={beforeItems} />
            <ComparisonPanel title="Com DaBi Price" items={afterItems} positive />
          </div>
        </div>
      </section>

      {/* ---------- confiança ---------- */}
      <section className="landing-section">
        <div className="landing-shell flex flex-col gap-12">
          <div className="flex flex-col gap-5" style={{ maxWidth: "62ch" }}>
            <span className="landing-eyebrow">Confiança</span>
            <h2 className="landing-h2">
              Seus dados e seu negócio continuam sendo seus.
            </h2>
          </div>

          <div className="landing-grid landing-grid--4">
            {trustCards.map((item) => (
              <div key={item.title} className="landing-card flex flex-col gap-3">
                <span className="text-lg font-semibold tracking-[-0.01em]">
                  {item.title}
                </span>
                <p className="landing-note">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- planos ---------- */}
      <section id="planos" className="landing-section landing-section--alt">
        <div className="landing-shell flex flex-col gap-12">
          <div className="flex flex-col gap-5" style={{ maxWidth: "62ch" }}>
            <span className="landing-eyebrow">Planos</span>
            <h2 className="landing-h2">
              Um plano que se paga quando você começa a precificar melhor.
            </h2>
          </div>

          <LandingPlanCards />
        </div>
      </section>

      {/* ---------- ROI ---------- */}
      <section className="landing-section">
        <div className="landing-shell flex flex-col gap-12">
          <div className="flex flex-col gap-5" style={{ maxWidth: "62ch" }}>
            <span className="landing-eyebrow">O custo de errar</span>
            <h2 className="landing-h2">Quanto custa precificar errado?</h2>
            <p className="landing-lede">
              Exemplo hipotético: R$ 4 de custo não considerado por venda.
            </p>
          </div>

          <div className="landing-grid landing-grid--3">
            {roiCards.map((item) => (
              <div key={item.sales} className="landing-card flex flex-col gap-3">
                <span
                  className="landing-num"
                  style={{
                    fontSize: 11,
                    letterSpacing: "0.22em",
                    textTransform: "uppercase",
                    color: "var(--landing-muted-soft)",
                  }}
                >
                  {item.sales}
                </span>
                <span
                  style={{
                    fontFamily: "var(--font-display-ui)",
                    fontSize: "2.75rem",
                    lineHeight: 1,
                    color: "var(--landing-gold)",
                  }}
                >
                  {item.value}
                </span>
                <p className="landing-note">
                  potencialmente deixados para trás na precificação
                </p>
              </div>
            ))}
          </div>

          <p className="landing-lede" style={{ color: "var(--landing-ink)" }}>
            Uma pequena diferença no preço pode pagar vários meses do DaBi
            Price.
          </p>
        </div>
      </section>

      {/* ---------- FAQ ---------- */}
      <section id="faq" className="landing-section landing-section--alt">
        <div className="landing-shell landing-split">
          <div className="flex flex-col gap-5">
            <span className="landing-eyebrow">FAQ</span>
            <h2 className="landing-h2">Ficou com alguma dúvida?</h2>
          </div>

          <div className="flex flex-col">
            {faqItems.map((item) => (
              <div
                key={item.question}
                className="flex flex-col gap-3 py-6"
                style={{ borderBottom: "1px solid var(--landing-line)" }}
              >
                <h3 className="text-lg font-semibold tracking-[-0.01em]">
                  {item.question}
                </h3>
                <p className="landing-note">{item.answer}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- CTA final + rodapé ---------- */}
      <section className="landing-section">
        <div className="landing-shell flex flex-col gap-16">
          <div
            className="landing-card landing-card--gold flex flex-wrap items-end justify-between gap-8"
            style={{ padding: "clamp(32px, 5vw, 56px) clamp(24px, 4vw, 48px)" }}
          >
            <div className="flex flex-col gap-4" style={{ maxWidth: "34ch" }}>
              <span className="landing-eyebrow">Próximo passo</span>
              <span className="landing-h2">
                Pare de precificar no <span className="landing-turn">improviso</span>.
              </span>
              <p className="landing-lede">
                Comece pelo plano certo e leve sua precificação para uma rotina
                clara e repetível.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/planos" className="landing-cta">
                Começar agora
              </Link>
              <Link href="/login" className="landing-cta landing-cta--ghost">
                Entrar
              </Link>
            </div>
          </div>

          <footer
            className="flex flex-wrap justify-between gap-10 pt-10"
            style={{ borderTop: "1px solid var(--landing-line)" }}
          >
            <div className="flex flex-col gap-4" style={{ maxWidth: "34ch" }}>
              <LandingWordmark />
              <p className="landing-note">
                Precificação mais clara para quem produz, vende e precisa
                proteger a margem com números reais.
              </p>
            </div>

            <nav className="grid gap-3 sm:grid-cols-2">
              {footerLinks.map((item) =>
                item.href.startsWith("/") ? (
                  <Link key={item.label} href={item.href} className="landing-link">
                    {item.label}
                  </Link>
                ) : (
                  <a key={item.label} href={item.href} className="landing-link">
                    {item.label}
                  </a>
                ),
              )}
            </nav>
          </footer>
        </div>
      </section>
    </main>
  );
}

function PricingPanel() {
  return (
    <div className="landing-rail">
      <div
        className="landing-rail__head flex flex-wrap items-baseline justify-between gap-3 px-6 py-5 sm:px-7"
        style={{ borderBottom: "1px solid var(--landing-line)" }}
      >
        <div className="flex flex-col gap-1">
          <span
            className="landing-num"
            style={{
              fontSize: 11,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: "var(--landing-muted-soft)",
            }}
          >
            Editor de precificação
          </span>
          <span className="text-lg font-semibold tracking-[-0.01em]">
            Caneca 3D personalizada
          </span>
        </div>
        <span
          className="landing-num"
          style={{
            fontSize: 11,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "var(--landing-profit)",
          }}
        >
          Resultado saudável
        </span>
      </div>

      <div
        className="grid grid-cols-2"
        style={{ borderBottom: "1px solid var(--landing-line)" }}
      >
        {resultRows.map((row, index) => (
          <div
            key={row.label}
            className="flex flex-col gap-2 px-6 py-5 sm:px-7"
            style={{
              borderRight:
                index % 2 === 0 ? "1px solid var(--landing-line)" : undefined,
              borderTop:
                index > 1 ? "1px solid var(--landing-line)" : undefined,
            }}
          >
            <span
              className="landing-num"
              style={{
                fontSize: 10,
                letterSpacing: "0.20em",
                textTransform: "uppercase",
                color: "var(--landing-muted-soft)",
              }}
            >
              {row.label}
            </span>
            <span
              className="landing-num text-2xl font-semibold"
              style={{
                color:
                  row.tone === "profit"
                    ? "var(--landing-profit)"
                    : "var(--landing-ink)",
              }}
            >
              {row.value}
            </span>
          </div>
        ))}
      </div>

      <div className="px-6 py-6 sm:px-7">
        <span
          className="landing-num"
          style={{
            fontSize: 11,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: "var(--landing-muted-soft)",
          }}
        >
          Distribuição do custo
        </span>
        <div className="mt-4 flex flex-col gap-4">
          {heroCostRows.map((row) => (
            <div key={row.label} className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span style={{ color: "var(--landing-ink-soft)" }}>
                  {row.label}
                </span>
                <span className="landing-num font-semibold">R$ {row.value}</span>
              </div>
              <span className="landing-bar">
                <span
                  style={{ width: row.width, background: barTone[row.tone] }}
                />
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ComparisonPanel({
  title,
  items,
  positive = false,
}: {
  title: string;
  items: string[];
  positive?: boolean;
}) {
  return (
    <div
      className={`landing-card flex flex-col gap-5 ${
        positive ? "landing-card--gold" : ""
      }`}
    >
      <span className="landing-h3">{title}</span>
      <ul className="flex flex-col gap-3" style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {items.map((item) => (
          <li
            key={item}
            className="flex items-baseline gap-3 pb-3 text-sm"
            style={{
              borderBottom: "1px solid var(--landing-line)",
              color: "var(--landing-ink-soft)",
            }}
          >
            <span
              aria-hidden="true"
              style={{
                color: positive
                  ? "var(--landing-profit)"
                  : "var(--landing-muted-soft)",
              }}
            >
              {positive ? "✓" : "—"}
            </span>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
