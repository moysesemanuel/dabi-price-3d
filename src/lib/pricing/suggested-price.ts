/**
 * Preco sugerido a partir do custo, com margem sobre o PRECO.
 *
 * Esta e a unica definicao de "margem" do produto. Antes existiam duas: a
 * impressao 3D e a landing dividiam o custo por (1 - taxas - margem), enquanto
 * a confeitaria multiplicava o custo por (1 + margem). Para o mesmo custo e a
 * mesma margem os dois davam numeros diferentes, e "margem de 30%" significava
 * duas coisas dentro do mesmo produto.
 *
 * Margem sobre o preco e o modelo correto aqui porque as taxas de venda e os
 * tributos incidem sobre o preco, nao sobre o custo: so dividindo pelo que
 * sobra depois delas a margem pedida e a margem obtida coincidem.
 */
export type SuggestedPriceInput = {
  /** Custo ja com perdas aplicadas. */
  costWithLoss: number;
  /** Valor fixo cobrado por venda, somado ao custo antes da divisao. */
  fixedFee?: number;
  /** Taxas proporcionais ao preco (marketplace, tributos), de 0 a 1. */
  variableFeeRate: number;
  /** Margem desejada sobre o preco, de 0 a 1. */
  marginRate: number;
};

/** Retorna 0 quando taxas + margem consomem 100% do preco. */
export function calculateSuggestedPrice(input: SuggestedPriceInput): number {
  const retentionRate = 1 - input.variableFeeRate - input.marginRate;

  if (!(retentionRate > 0)) {
    return 0;
  }

  return (input.costWithLoss + (input.fixedFee ?? 0)) / retentionRate;
}

export function isSuggestedPriceViable(input: {
  variableFeeRate: number;
  marginRate: number;
}): boolean {
  return 1 - input.variableFeeRate - input.marginRate > 0;
}
