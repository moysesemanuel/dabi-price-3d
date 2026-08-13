export type SegmentLandingSlug =
  | "impressao-3d"
  | "confeitaria"
  | "revenda"
  | "marketplaces";

export type SegmentLandingConfig = {
  slug: SegmentLandingSlug;
  navLabel: string;
  title: string;
  metadataTitle: string;
  metadataDescription: string;
  eyebrow: string;
  headline: string;
  description: string;
  costs: string[];
  proofLabel: string;
  proofTitle: string;
  proofRows: Array<{ label: string; value: string }>;
  proofResultLabel: string;
  proofResultValue: string;
  steps: Array<{
    label: string;
    title: string;
    description: string;
  }>;
  segmentCardDescription: string;
  ctaTitle: string;
  ctaDescription: string;
  ctaHref: string;
  ctaLabel: string;
};

export const segmentLandings: Record<SegmentLandingSlug, SegmentLandingConfig> = {
  "impressao-3d": {
    slug: "impressao-3d",
    navLabel: "Impressão 3D",
    title: "Precificação para impressão 3D",
    metadataTitle: "Precificação para impressão 3D | DaBi Price",
    metadataDescription:
      "Descubra quanto sua impressão 3D realmente custa considerando filamento, tempo de máquina, energia, manutenção, falhas, mão de obra e margem.",
    eyebrow: "Precificação para impressão 3D",
    headline: "Descubra quanto sua impressão 3D realmente custa.",
    description:
      "Considere filamento, tempo de máquina, energia, manutenção, falhas, mão de obra e margem antes de definir o preço.",
    costs: [
      "Filamento",
      "Tempo de máquina",
      "Energia",
      "Manutenção",
      "Falhas",
      "Mão de obra",
    ],
    proofLabel: "Simulação de uma peça",
    proofTitle: "Antes de anunciar, veja o peso real da produção.",
    proofRows: [
      { label: "184 g de filamento", value: "R$ 16,20" },
      { label: "7h42 de impressão", value: "R$ 8,40" },
      { label: "Energia e manutenção", value: "R$ 4,30" },
      { label: "Falhas e acabamento", value: "R$ 3,60" },
    ],
    proofResultLabel: "Preço recomendado",
    proofResultValue: "R$ 54,90",
    steps: [
      {
        label: "1. Cadastre o produto",
        title: "Informe o que entra na produção",
        description:
          "Filamento, tempo de máquina, retrabalho, acabamento e outros custos da peça.",
      },
      {
        label: "2. Escolha o canal",
        title: "Compare venda direta e marketplaces",
        description:
          "Veja quanto as taxas e regras de cada canal tiram da sua margem.",
      },
      {
        label: "3. Veja a margem real",
        title: "Defina preço com mais segurança",
        description:
          "O DaBi Price mostra o preço recomendado e quanto realmente sobra em cada venda.",
      },
    ],
    segmentCardDescription:
      "Calcule filamento, máquina, energia, falhas e margem antes de publicar.",
    ctaTitle: "Precifique sua operação 3D com menos improviso.",
    ctaDescription:
      "Leve a lógica da produção, dos canais e da margem para uma rotina mais previsível.",
    ctaHref: "/cadastro?origin=impressao-3d",
    ctaLabel: "Começar com impressão 3D",
  },
  confeitaria: {
    slug: "confeitaria",
    navLabel: "Confeitaria",
    title: "Precificação para confeitaria",
    metadataTitle: "Precificação para confeitaria | DaBi Price",
    metadataDescription:
      "Descubra quanto realmente custa produzir cada doce considerando ingredientes, embalagem, rendimento, perdas, mão de obra e margem.",
    eyebrow: "Precificação para confeitaria",
    headline: "Descubra quanto realmente custa produzir cada doce.",
    description:
      "Considere ingredientes, embalagem, rendimento, perdas, mão de obra e margem sem depender de planilhas complicadas.",
    costs: [
      "Ingredientes",
      "Embalagem",
      "Rendimento",
      "Perdas",
      "Mão de obra",
      "Taxas de venda",
    ],
    proofLabel: "Simulação de produção",
    proofTitle: "O preço fica mais claro quando todo o lote entra na conta.",
    proofRows: [
      { label: "Ingredientes", value: "R$ 35,00" },
      { label: "Embalagem e energia", value: "R$ 12,00" },
      { label: "Mão de obra", value: "R$ 30,00" },
      { label: "Perdas e despesas", value: "R$ 16,25" },
    ],
    proofResultLabel: "Preço sugerido do lote",
    proofResultValue: "R$ 133,21",
    steps: [
      {
        label: "1. Monte a produção",
        title: "Cadastre ingredientes, rendimento e perdas",
        description:
          "Veja o que de fato entra no custo do lote antes de pensar em margem.",
      },
      {
        label: "2. Valorize seu tempo",
        title: "Inclua mão de obra e rotina operacional",
        description:
          "Pare de trabalhar no limite porque parte do esforço ficou fora da conta.",
      },
      {
        label: "3. Defina o preço",
        title: "Receba uma sugestão coerente com seu negócio",
        description:
          "O sistema mostra preço, margem e lucro de forma mais previsível.",
      },
    ],
    segmentCardDescription:
      "Calcule ingredientes, rendimento, embalagem, perdas e mão de obra sem chute.",
    ctaTitle: "Organize a precificação da sua confeitaria.",
    ctaDescription:
      "Transforme receitas, lotes e margens em uma rotina mais clara e lucrativa.",
    ctaHref: "/cadastro?origin=confeitaria",
    ctaLabel: "Começar com confeitaria",
  },
  revenda: {
    slug: "revenda",
    navLabel: "Revenda",
    title: "Precificação para revenda",
    metadataTitle: "Precificação para revenda | DaBi Price",
    metadataDescription:
      "Saiba quanto precisa cobrar antes de anunciar considerando custo de compra, frete, impostos, taxas do marketplace e margem real.",
    eyebrow: "Precificação para revenda",
    headline: "Saiba quanto precisa cobrar antes de anunciar.",
    description:
      "Considere custo de compra, frete, impostos, taxas do marketplace e sua margem real antes de vender.",
    costs: [
      "Custo de compra",
      "Frete",
      "Impostos",
      "Taxas do marketplace",
      "Comissões",
      "Margem",
    ],
    proofLabel: "Simulação de revenda",
    proofTitle: "Um preço que parece bom pode sumir quando as taxas entram.",
    proofRows: [
      { label: "Custo do fornecedor", value: "R$ 27,50" },
      { label: "Frete e recebimento", value: "R$ 5,60" },
      { label: "Impostos", value: "R$ 3,20" },
      { label: "Taxas e comissão", value: "R$ 7,10" },
    ],
    proofResultLabel: "Preço recomendado",
    proofResultValue: "R$ 59,90",
    steps: [
      {
        label: "1. Informe sua compra",
        title: "Cadastre custo de aquisição e logística",
        description:
          "Inclua o que você paga para comprar, receber e preparar o item para venda.",
      },
      {
        label: "2. Compare canais",
        title: "Veja o impacto de cada regra comercial",
        description:
          "Mercado Livre, loja própria ou outro canal podem gerar resultados bem diferentes.",
      },
      {
        label: "3. Proteja a margem",
        title: "Venda com mais previsibilidade",
        description:
          "O DaBi Price mostra quando um anúncio parece competitivo, mas ainda destrói o lucro.",
      },
    ],
    segmentCardDescription:
      "Considere custo de compra, frete, impostos, taxas e margem antes de anunciar.",
    ctaTitle: "Evite anunciar com preço bonito e margem ruim.",
    ctaDescription:
      "Centralize compra, taxas e lucro esperado em um fluxo mais simples de decisão.",
    ctaHref: "/cadastro?origin=revenda",
    ctaLabel: "Começar com revenda",
  },
  marketplaces: {
    slug: "marketplaces",
    navLabel: "Marketplaces",
    title: "Precificação para marketplaces",
    metadataTitle: "Precificação para marketplaces | DaBi Price",
    metadataDescription:
      "Compare Mercado Livre, Shopee e outros canais antes de publicar. Entenda taxas, regras comerciais e margem real em cada cenário.",
    eyebrow: "Precificação para marketplaces",
    headline: "Compare canais antes de publicar o produto.",
    description:
      "Entenda como Mercado Livre, Shopee e outros canais afetam o lucro real com taxas, comissões e regras diferentes.",
    costs: [
      "Taxas do canal",
      "Comissões",
      "Frete",
      "Impostos",
      "Subsídios",
      "Margem líquida",
    ],
    proofLabel: "Comparação de canais",
    proofTitle: "O mesmo produto pode ter resultados muito diferentes.",
    proofRows: [
      { label: "Venda direta", value: "Lucro R$ 18,20" },
      { label: "Mercado Livre", value: "Lucro R$ 8,70" },
      { label: "Shopee", value: "Lucro R$ 10,40" },
      { label: "Outro canal", value: "Lucro R$ 13,40" },
    ],
    proofResultLabel: "Canal mais saudável",
    proofResultValue: "Venda direta",
    steps: [
      {
        label: "1. Defina o produto",
        title: "Cadastre custo e meta de margem",
        description:
          "Parta de uma base real antes de levar o item para vários canais.",
      },
      {
        label: "2. Simule cenários",
        title: "Teste taxas e regras de cada marketplace",
        description:
          "Compare o efeito de comissão, frete, taxa fixa e campanhas no resultado final.",
      },
      {
        label: "3. Escolha melhor",
        title: "Publique com mais critério",
        description:
          "Descubra em qual canal o produto faz sentido e onde ele só consome margem.",
      },
    ],
    segmentCardDescription:
      "Compare Mercado Livre, Shopee e outros canais antes de publicar e perder margem.",
    ctaTitle: "Publique onde o produto realmente faz sentido.",
    ctaDescription:
      "Use o mesmo motor de precificação para comparar canais e decidir com mais critério.",
    ctaHref: "/cadastro?origin=marketplaces",
    ctaLabel: "Começar comparando canais",
  },
};

export const segmentCards = [
  {
    title: "Impressão 3D",
    href: "/impressao-3d",
    description: segmentLandings["impressao-3d"].segmentCardDescription,
  },
  {
    title: "Confeitaria",
    href: "/confeitaria",
    description: segmentLandings.confeitaria.segmentCardDescription,
  },
  {
    title: "Revenda",
    href: "/revenda",
    description: segmentLandings.revenda.segmentCardDescription,
  },
  {
    title: "Marketplaces",
    href: "/marketplaces",
    description: segmentLandings.marketplaces.segmentCardDescription,
  },
] as const;
